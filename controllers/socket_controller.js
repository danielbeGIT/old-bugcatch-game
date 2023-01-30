/**
 * Socket Controller
 */

// Import debug module
const debug = require('debug')('ktv:socket_controller');

let io = null;

// Rooms for games and their users
const rooms = [];
// Number of rooms that exists
let numberOfRooms = 0;
// Number of people currently in queue
let waitingQueue = 0;
// Time to wait before virus pop ups
let timeToWait = 0;
let virusPosition = null;
let currentRoom;

// Set time to wait to a random number between 0 and 5000
const calcTimeAndPosition = () => {	
	timeToWait = Math.round(Math.random()*4000 + 300);
	virusPosition = Math.floor(Math.random() * 9);
} 

// When a user joins a room
const handleUserJoined = function(username, callback) {

	// Varuable to know if the game should start or not
	let startGame = false;
	debug('WQ at start: ', waitingQueue);
	// If waiting queue is empty, create a new room
	if (waitingQueue === 0) {
		rooms.push({
			// Set room id to numberOfRooms variable, then increase the numberOfRooms variable
			room_id: numberOfRooms++,
			numberOfPlayers: 0,
			gameStatus: 'waiting',
			// Object property to hold info about the users that is in the room
			players: {},
			// Number of rounds played in this room
			roundsplayed: 0,
		});
	}

	// Use the latest room pushed to the rooms array so that we can add info to it 
	const currentRoom = rooms[rooms.length - 1];

	// If there is already a user with same name, callback to inform client
	if (currentRoom.numberOfPlayers > 0 && Object.values(currentRoom.players)[0].username === username) {
		callback({
			success: false,
			msg: 'Username already taken, chose another one',
		});
		return;
	}

	// Increase the number of players in the room
	currentRoom.numberOfPlayers++;

	// Have the socket client to join the current room
	this.join(currentRoom);

	// Each player object in a room holds info aboiut their name, current score and their previous reaction time
	currentRoom.players[this.id] = {
		username,
		points: 0,
	 	previousReactionTime: null,
	};
	
	debug('List of rooms: ', rooms);
	debug('Current room: ', currentRoom);

	// Increase the waiting queue
	waitingQueue++;
	debug('WQ after increase: ', waitingQueue);
	// If there is two clients in queue, prepare to start the game
	if (waitingQueue === 2) {
		debug('Client ready to start new game');
		debug(currentRoom.players);
		// Reset waiting queue variable
		waitingQueue = 0;
		// Set current room as active
		currentRoom.gameStatus = 'ongoing',
		// Set startGame variable to true
		startGame = true;
		// Call function to set set timer
		calcTimeAndPosition();
		// Tell the other clients in the room that a new game should start
		this.broadcast.to(currentRoom).emit('game:start', timeToWait, virusPosition, currentRoom.players);
	}

	// Let everyone know a client has connected
	// this.broadcast.emit('user:connected', username);

	// Callback to client
	callback({
		success: true,
		room: currentRoom.room_id,
		players: currentRoom.players,
		startGame,
		timeToWait,
		virusPosition,
	});
}

// When a client disconnects
const handleDisconnect = function() {
	debug(`Client ${this.id} disconnected :(`);

	// Find the room this socket is connected to
	const room = rooms.find(lobby => lobby.players.hasOwnProperty(this.id));
	//If socket is not in a room, do nothing and return
	if(!room) {
		return;
	}
	
	console.log("Player Username:", room.players[this.id].username);

	console.log("Other player automatically wins", room.players);

	debug('WQ on DC: ', waitingQueue);
	// If client was in waiting queue, decrease waitingqueue variable and remove player
	if (room.gameStatus === 'waiting') {
		waitingQueue--;
		room.numberOfPlayers--;
		delete room.players[this.id];
	}else if (room.gameStatus === 'ongoing') {
		// If the game was ongoing, give other player automatic victory
		room.numberOfPlayers--;
		this.broadcast.to(room).emit('game:walkover');
	}
	
}

// Compare reaction time and decide who gets score
const handleScore = function(reaction, player) {
	// Find the room this socket is connected to
	const room = rooms.find(lobby => lobby.players.hasOwnProperty(this.id));
	
	// Get the players reaction time from parameter
	room.players[this.id].previousReactionTime = reaction;

	// Variable to know if both player in room are done
	let foundNull = false;

	// Check if other player finished
	Object.values(room.players).forEach( (player) => {
		if (player.previousReactionTime === null) {
			foundNull = true;
		}
	} )

	// If both players are done
	if (!foundNull) {

		// Single out each player
		const playerOne = Object.values(room.players)[0];
		const playerTwo = Object.values(room.players)[1];

		// Get winning name from comparing both reaction times, and increase their score
		if (playerOne.previousReactionTime < playerTwo.previousReactionTime) {
			winningPlayer = playerOne.username;
			playerOne.points++;
		} else {
			winningPlayer = playerTwo.username;
			playerTwo.points++;
		}

		// Send result to all players in room
		io.in(room).emit('game:print-round', winningPlayer, room.players);

		// Set both players previous reaction time to null for future rounds
		playerOne.previousReactionTime = null;
		playerTwo.previousReactionTime = null;

		// Increase number of rounds played in game room
		room.roundsplayed++;

		// If Rounds played is less than 10, start a new round. Otherwise finish game
		if(room.roundsplayed < 10) {
			// Calculate a new random tim ena position
			calcTimeAndPosition();
			// Start new round
			io.in(room).emit('game:start', timeToWait, virusPosition, room.players);
		} else {
			// Send final result to clients
			io.in(room).emit('game:over', playerOne, playerTwo);
		}
	};

}


// Export function
module.exports = function(socket, _io) {
	io = _io;
	debug('a new client has connected', socket.id);

	// handle user disconnect
	socket.on('disconnect', handleDisconnect);

	// handle user joined
	socket.on('user:joined', handleUserJoined);

	// handle user score
	socket.on('game:round-result', handleScore);
}
