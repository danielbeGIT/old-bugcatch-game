// Socket variable
const socket = io();

// Document elements to use/manipulate
const startScreenEl = document.querySelector('#start-screen');
const nameFormEl = document.querySelector('#name-form');
const waitingScreenEl = document.querySelector('#waiting-screen');
const endScreenEl = document.querySelector('#endResults');
const winner = document.querySelector('#winnersName');
const userResults = document.querySelector('#result');
const playerName = document.querySelector('#user')
const opponentName = document.querySelector('#opponent')
const positionEl = document.querySelectorAll('.position');
const timestampEl = document.querySelector('#time-stamp');
const userScoreEl = document.querySelector('#user');
const opponentScoreEl = document.querySelector('#opponent');
const gameScreenEl = document.querySelector('#game-screen');
const playerTimeEl = document.querySelector('#userTime h5');
const roundCountdownEl = document.querySelector('#round-countdown');
const roundCountdownInfoEl = document.querySelector('#round-countdown p');
const roundCountdownSpanEl = document.querySelector('#round-countdown span');
const virusFieldEl = document.querySelector('#virus-field');
const playingFieldEl = document.querySelector('#playing-field');

// Username to identify client
let username = null;
let opponent = null;
let room = null;
let playerDisc = false;

// Score
let userScore = 0;
let opponentScore = 0;

// Rounds
let rounds = 0;

// The target to kill virus
let target;

// Randomizer
let randomizer = Math.floor(Math.random() * (3 - 1 + 1) + 1);

// Variable for time passed before user clicks
let timePassed = null;

// Variable for the timer that will update and render timer to user
let timer = null;
let oTimer = null;

// Variable for amount of milliseconds since 1 Jan 1970 at the point when the timer starts 
let timeBeforeRound = null;

// Div where virus will display each round
let randomizePositionEl = null;
let roundCountdownInterval = null;

// Variable to count down before a round starts
let countdown = 3;


// Funtion to stop timer and calculate player click time
const stopTimer = () => {
	// Stop the interval timer that prints time to user
	clearInterval(timer);

	// Calculate how long time it took for the player to click
	timePassed = Date.now() - timeBeforeRound;
	console.log('It took you ' + timePassed + ' milliseconds to click');

	// Show user the final time
	playerTimeEl.innerText = `${Math.floor(timePassed/1000)} : ${timePassed%1000}`;

	// Remove the click event from secretSquare
	randomizePositionEl.removeEventListener('click', stopTimer);

	// Remove virus from element
	randomizePositionEl.classList.remove('virus');

	// Give time to server
	socket.emit('game:round-result', timePassed, username);
};


const startTimer = (virusPosition) => {
	console.log("Wait time over, lets start!");
	console.log("Round", rounds)
	
	// Reset user click time
	timePassed = 0;
	// Get the amount of milliseconds since 1 Jan 1970
	timeBeforeRound = Date.now();
	console.log(timeBeforeRound);
	// Update user with timer repeatedly 
	timer = setInterval( () => {
		timePassed = Date.now() - timeBeforeRound;
		playerTimeEl.innerText = `${Math.floor(timePassed/1000)} : ${timePassed%1000}`;
	}, 10 );

	// Display estimated time for opponent during round
	oTimer = setInterval( () => {
		let oTime = Date.now() - timeBeforeRound;
		document.querySelector('#opponentTime h5').innerText = `${Math.floor(oTime/1000)} : ${oTime%1000}`;
	}, 10 );

	// User virusPosition from server to pick wich div the virus gonna be at
	randomizePositionEl = positionEl[virusPosition];
	randomizePositionEl.classList.add('virus');

	target = randomizePositionEl.id;

	// Add eventlistener for secret square that the user has to click
	// --- Change from game screen to the specific square --
	randomizePositionEl.addEventListener('click', stopTimer);
	rounds++;
	console.log("Rounds played:",rounds)
	
};


// Function to display countdown to user before starting a new round
const countdownBR = (timeToWait, virusPosition) => {
	// Decrease countdown by one
	countdown--;
	// Show new countdown number to user
	roundCountdownSpanEl.innerText = countdown;

	// If countdown reach zero, stop countdown and start round
	if (countdown === 0) {

		// Stop countdown interval timer
		clearInterval(roundCountdownInterval);

		// Hide countdown display
		roundCountdownEl.classList.add('hide');

		// Show virus field
		positionEl.forEach(position => {
			position.classList.remove('hide');
		});

		// Reset countdown variable for future rounds
		countdown = 3;
		roundCountdownSpanEl.innerText = countdown;

		// Wait before showing user which square to click
		setTimeout(startTimer, timeToWait, virusPosition);
	
	}
};


// Function to start up a new round
const gameRound = (timeToWait, virusPosition) => {
	console.log("Starting timer " + timeToWait + " for virus on position " + virusPosition);

	// Make sure no div have virus class attached
	positionEl.forEach(position => {
		position.classList.remove('virus');
	});

	// Start countdown before next round starts
	roundCountdownEl.classList.remove('hide');
	roundCountdownInterval = setInterval(countdownBR, 1000, timeToWait, virusPosition);

	// Hide virus field
	positionEl.forEach(position => {
		position.classList.add('hide');
	});
};


socket.on('game:print-round', (winner, players) => {
	// Get the opponent player
	const opponent = Object.values(players).find( player => player.username !== username);
	console.log(opponent);

	// Stop timer for opponent
	clearInterval(oTimer);

	// Set final time for opponent
	document.querySelector('#opponentTime h5').innerText = `${Math.floor(opponent.previousReactionTime/1000)} : ${opponent.previousReactionTime%1000}`;
	
	// Increase score for the player that won
	if (winner === username) {
		userScoreEl.innerText = `${username} score: ${++userScore}`;
		// Inform user if they won the round or not
		roundCountdownInfoEl.innerText = 'You won the round!';
		roundCountdownInfoEl.classList.add('won-round');
		roundCountdownInfoEl.classList.remove('lost-round');
	} else {
		opponentScoreEl.innerText = `${opponent.username} score: ${++opponentScore}`;
		// Inform user if they won the round or not
		roundCountdownInfoEl.innerText = 'You lost the round!';
		roundCountdownInfoEl.classList.add('lost-round');
		roundCountdownInfoEl.classList.remove('won-round');
	}
});

// When another client connects
socket.on('user:connected', (username) => {
	console.log(`${username} has connected`);
	// When a game is ready to start
	
});

// If the other player disconnected
socket.on('game:walkover', () => {
	// Switch active screen
	waitingScreenEl.classList.add('hide');
	gameScreenEl.classList.add('hide');
	endScreenEl.classList.remove('hide');

	// Inform user they won due to another player leaving the room
	winner.innerHTML = `You win!`
	userResults.innerHTML = `Opponent disconnected`
});

// When a game/round is ready to start
socket.on('game:start', (timeToWait, virusPosition, players) => {
	console.log('Opponent found, game will begin');

	// Hide waiting screen and display game screen
	waitingScreenEl.classList.add('hide');
	gameScreenEl.classList.remove('hide');

	// Update the score
	userScoreEl.innerText = `${username} score: ${userScore}`;
	opponentScoreEl.innerText = `${Object.values(players).find( player => player.username !== username).username} score: ${opponentScore}`;
	
	playerNames(players);

	// Start a new round with time and position given by server
	gameRound(timeToWait, virusPosition);
});


const playerNames = (players) => {
	username = nameFormEl.username.value;
	console.log('Players: ', players);

	const playerList = Object.values(players);
	const playerNames = [];

	playerList.forEach( (player) => {
		playerNames.push(player.username);
	} );
	
	console.log('List of players: ', playerNames);
	console.log(playerNames.indexOf(username));
	const player1 = playerNames.indexOf(username);
	playerNames.splice(player1, 1);

	console.log(playerNames);

	opponent = playerNames;

	//opponentScoreEl.innerText = `${opponent} Score: ${score}`
}

// Event listener for when a user submits the name form
nameFormEl.addEventListener('submit', (e) => {
	e.preventDefault();
 
	// Take username from the form submitted
	username = nameFormEl.username.value;
	
	// Inform the socket that client wants to join the game
	socket.emit('user:joined', username, (status) => {
		// If the server returns a successful callback
		if (status.success) {
			console.log('Welcome ', username);

			// Hide start-screen element
			startScreenEl.classList.add('hide');

			console.log(status.players);

			// Show waiting-screen element
			waitingScreenEl.classList.remove('hide');

			// Set room client is part of to room id given back by server
			room = status.room;

			// If the startGame property from callback is true, start new game 
			if (status.startGame) {
				console.log("Game will begin");
				waitingScreenEl.classList.add('hide');
				gameScreenEl.classList.remove('hide');
				// Initialize score-table for player and opponent
				userScoreEl.innerText = `${username} score: ${userScore}`;
				opponentScoreEl.innerText = `${Object.values(status.players).find( player => player.username !== username).username} score: ${opponentScore}`;
				playerNames(status.players);
				gameRound(status.timeToWait, status.virusPosition);
			}
			
		} else if (!status.success) {
			// If status.succes did not come back true, inform user with error message
			document.querySelector('#username-error').classList.remove('hide');
			document.querySelector('#username-error').innerText = status.msg;
		}
	})

});

// Destroy the virus function
positionEl.forEach(position => {
	position.addEventListener('click', () => {
		if (position.id === target) {

			// reset the target
			target = null

			// remove the virus from the current spot
			position.classList.remove('virus');
		}
	})
});

socket.on('game:over', (playerOne, playerTwo) => {

	// Hide other sections and show end-screen section
	waitingScreenEl.classList.add('hide');
	gameScreenEl.classList.add('hide');
	endScreenEl.classList.remove('hide');

	// Find out which of the players from params that this client represent
	const self = playerOne.username === username ? playerOne : playerTwo;
	// Find out which of the players from params that other client represent
	const opponent = playerOne.username === username ? playerTwo : playerOne;
	
	// Compare client and opponent score to find out who won
	if(self.points > opponent.points) {
		userResults.innerHTML = `You won! Score: ${self.points} - ${opponent.points}`;
		userResults.classList.add('winResult');
	} else if (opponent.points > self.points) {
		userResults.innerHTML = `You lost! Score: ${self.points} - ${opponent.points}`;
		userResults.classList.add('loseResult');
	} else if(self.points === opponent.points) {
		userResults.innerHTML = `It's a tie! Score: ${self.points} - ${opponent.points}`;
	}
});

// Change cursor image while mouse-button is being held down
playingFieldEl.addEventListener('mousedown', () => {
	document.querySelector('#playing-field').classList.add('aim');
});

playingFieldEl.addEventListener('mouseup', () => {
	document.querySelector('#playing-field').classList.remove('aim');
});