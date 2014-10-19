var app = require('express')();
var http = require('http').Server(app);
var io = require('socket.io')(http);
var databaseUrl = "data";
var collections = ["chores", "users"];
var db = require("mongojs").connect(databaseUrl, collections);
var currentIDIndex = 0;
var accountSid = '[SID]'; //Change to run
var authToken = '[authToken]';  //Change to run
var client = require('twilio')(accountSid, authToken); 


app.use(require('express').static(__dirname +'/public'));

app.get('/', function(req, res){
	res.sendfile('list.html');
});

io.on('connection', function(socket){
	console.log('user connection');
	socket.on('register', function(clientID, user, pass, group){register(clientID, user, pass, group);});
	socket.on('login', function(clientID, user, pass, group){login(clientID, user, pass, group);});
	socket.on('addPublicJob', function(clientID, group, id, jobName, username, desc, value){addJob(clientID, true, group, id, jobName, username, desc, value);});
	socket.on('addPrivateJob', function(clientID, group, id, jobName, username, desc, value){addJob(clientID, false, group, id, jobName, username, desc, value);});
	socket.on('viewJobs', function(clientID, isPublic){viewJobs(clientID, isPublic);});
	socket.on('viewLeaderboard', function(clientID){viewLeaderboard(clientID);});
	socket.on('movePrivate', function(clientID, job, bounty, user){movePrivate(clientID, job, bounty, user);});
	socket.on('submitBidJob', function(clientID, name, description, points){submitBidJob(clientID, name, description, points);});
	socket.on('transferPoints', function(clientID, first, second, points){transferPoints(clientID, first, second, points);});
	socket.on('bid', function(clientID, user, job, points){bid(clientID, user, job, points);});
	socket.on('complete', function(clientID, job){complete(clientID, job);});
	socket.on('verify', function(clientID, job, user){verify(clientID, job, user);});
});

//TODO: THESE FUNCTIONS
//use the following to send things back to the index
//io.emit('<functionname>', '<information>');

function addJob(clientID, isPublic, group, id, jobName, username, desc, value) {
	var p = db.chores;
	p.save({groupID: parseInt(group), ID: parseInt(id), name: jobName, user: username, description: desc, points: parseInt(value), isVerifying: false, isDone: false, isPublic: isPublic}, function(err, saved) {
		if( err || !saved ) console.log("Job not saved");
		else {
			io.emit('addJob', clientID);
			console.log("Job saved");
		}
	});
}

function moveJobFromUser(user, id, bounty) {
	db.users.update({username: user}, {$inc: {points: -bounty}}, {$pullAll: {jobs: parseInt(id)}}, function(err, updated) {
		if( err || !updated ) console.log("User jobs not updated");
		else console.log("User jobs updated");
	});
}

function register(user, pass, group) {
	db.users.save({username: user, password: pass, group: group, points: 100}, function(err, saved) {
		if( err || !saved ) console.log("User not saved");
		else console.log("User saved");
	});
}

function login(clientID, user, pass, group) {
	//login/register [add user to db]
	console.log('login ' + group + ': ' + user + ',' + pass);
	db.users.find({username : user}, function(err, theUsers) {
		//console.log("something");
		//console.log(theUsers.length);
		if( err || !theUsers || theUsers.length == 0) {
			//register
			console.log("No users found");
			register(user, pass, group);
			console.log("Registering " + group + ":" + user + "," + pass);
			io.emit('login', clientID);
		} else theUsers.forEach( function(user) {
			//login
			//io.emit('addList', user.name + ': ' + user.description);
			if (user.password == pass) {
				console.log("Logging in " + group + ":" + user.username + "," + pass);
			} else {
				console.log("Incorrect password/username combination");
			}
		});
	});
}

function viewJobs(clientID, isPublic) {
	//view jobs (special | chores) [get jobs from db]
	io.emit('clearList');
	io.emit('setSection', isPublic ? 'Public' : 'Private');
	db.chores.find({isPublic: isPublic}, function(err, chores) {
		if( err || !chores) {
			io.emit('addList', "No chores found");
			console.log("No chores found");
		} else chores.forEach( function(chore) {
			io.emit('viewJobs', clientID);
			io.emit('addList', chore.name + ': ' + chore.description);
			console.log(chore.name + ': ' + chore.description);
		});
	});
	console.log('view jobs public/private ' + isPublic);
}

function viewLeaderboard(clientID) {
	//view leaderboard [get users from db]
	io.emit('clearList');
	io.emit('setSection', 'Leaderboard');
	db.users.find({}, function(err, users) {
		if( err || !users) {
			io.emit('addList', "No users found");
			console.log("No users found");
		} else users.forEach( function(user) {
			io.emit('addList', user.username + ': ' + user.points);
			console.log(user.username + ': ' + user.points);
		});
	});
	console.log('view leaderboard');
}

function movePrivate(clientID, job, bounty, user) {
	db.chores.find({ID: job, isPublic: false}, function(err, chores) {
		if( err || !chores || chores.length == 0) {
			io.emit('addList', "Job not found");
			console.log("Job not found");
		} else chores.forEach( function(chore) {
			if (chore.user == user) {
				collection = db.collection("chores");
				collection.update(
					{ID: job}, 
					{
						$set: {isPublic: true},
						$set: {user: ""},
						$inc: {points: bounty}
					},
					{ multi: true }
				, 
				function(err, result) {console.log(err);console.log(result)});
				
				collection2 = db.collection("users");
				collection2.update(
					{username: user},
					{$inc:
						{points : -bounty}
					}
				, 
				function(err, result) {console.log(err);console.log(result)});
			}
			console.log('move private ' + job + ',' + bounty);
			io.emit('movePrivate', clientID);
		});
	});
}

function submitBidJob(clientID, name, description, points) {
	//submit special jobs (?) [add special job to db]
	addJob(true, 0, currentIDIndex, name, "", description, points);
	currentIDIndex++;
	console.log('submit bid job ' + name + ',' + description + ',' + points);
}

function transferPoints(clientID, first, second, points) {
//sends points from first to second
	db.users.update({username: first}, {$inc: {points: -points}});
	db.users.update({username: second}, {$inc: {points: points}});
	console.log('transfer ' + points + ' points from ' + first + ' to ' + second);
	io.emit('transferPoints', clientID);
}

function bid(clientID, user, job, points) {
	db.chores.update({ID: job}, {$inc: {points: points}});
	db.users.update({username: user}, {$inc: {points: -points}});
	console.log(user + ' bid ' + points + ' points to ' + job);
	io.emit('bid', clientID);
}

function complete(clientID, job, user) {
	db.chores.update({ID: job}, {$set: {isDone: true}});
	db.chores.update({ID: job}, {$set: {isVerifying: true}});
	db.chores.update({ID: job}, {$set: {user: user}});
	console.log(user + ' completed ' + job);
	io.emit('complete', clientID);

	var choreName;
	db.chores.find({ID: job}, function(err, chores) {
		if (err || !chores) {
			console.log("Job not found");
		} else chores.forEach( function(chore) {
			console.log("Job found");
			choreName =  chore.name;
			console.log(choreName);

			client.messages.create({ 
				to: "XXXXXXXXXX", 
				from: "+XXXXXXXXXX", 
				body: "You have been assigned Chore "+ choreName,   
			}, function(err, message) { 
				console.log(message.sid); 
			});
		});
	});

	//Twilio Text
}

function verify(clientID, job, user) {
	//verify that a user did a special job [set job.isDone, job.isVerifying]
	db.chores.update({ID: job}, {$set: {isDone: true}});
	db.chores.update({ID: job}, {$set: {isVerifying: false}});
	db.chores.find({ID: job}, function(err, chores) {
		if (err || !chores) {
			console.log("Job not found");
		} else chores.forEach( function(chore) {
			console.log("Job found");
			console.log("points " + chore.points);
			db.users.update({username: user}, {$inc: {points: chore.points}});
			io.emit('verify', clientID);
		});
	});
	console.log('verify ' + job + ',' + user);
}

//function nudge(user) {
//nudge another user [set target.nudges, user.points]
//}

http.listen(3000, function(){
  console.log('Starting Chore-board on *:3000');
});