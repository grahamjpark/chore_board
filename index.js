var app = require('express')();
var http = require('http').Server(app);
var io = require('socket.io')(http);
var databaseUrl = "data";
var collections = ["chores", "users"];
var db = require("mongojs").connect(databaseUrl, collections);
var currentIDIndex = 0;

app.use(require('express').static(__dirname +'/public'));

app.get('/', function(req, res){
	res.sendfile('list.html');
});

io.on('connection', function(socket){
	console.log('user connection');
	socket.on('register', function(user, pass, group){register(socket, user, pass, group);});
	socket.on('login', function(user, pass, group){login(socket, user, pass, group);});
	socket.on('addPublicJob', function(group, id, jobName, username, desc, value){addJob(socket, true, group, id, jobName, username, desc, value);});
	socket.on('addPrivateJob', function(group, id, jobName, username, desc, value){addJob(socket, false, group, id, jobName, username, desc, value);});
	socket.on('viewJobs', function(isPublic){viewJobs(socket, isPublic);});
	socket.on('viewLeaderboard', function(){viewLeaderboard(socket);});
	socket.on('movePrivate', function(job, bounty, user){movePrivate(socket, job, bounty, user);});
	socket.on('submitBidJob', function(name, description, points){submitBidJob(socket, name, description, points);});
	socket.on('transferPoints', function(first, second, points){transferPoints(socket, first, second, points);});
	socket.on('bid', function(user, job, points){bid(socket, user, job, points);});
	socket.on('complete', function(job){complete(socket, job);});
	socket.on('verify', function(job, user){verify(socket, job, user);});
});

//TODO: THESE FUNCTIONS
//use the following to send things back to the index
//io.emit('<functionname>', '<information>');

function addJob(socket, isPublic, group, id, jobName, username, desc, value) {
	var p = db.chores;
	p.save({groupID: parseInt(group), ID: parseInt(id), name: jobName, user: username, description: desc, points: parseInt(value), isVerifying: false, isDone: false, isPublic: isPublic}, function(err, saved) {
		if( err || !saved ) console.log("Job not saved");
		else {
			socket.emit('addJob');
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

function login(socket, user, pass, group) {
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
			socket.emit('login');
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

function viewJobs(socket, isPublic) {
	//view jobs (special | chores) [get jobs from db]
	socket.emit('clearList');
	socket.emit('setSection', isPublic ? 'Public' : 'Private');
	db.chores.find({isPublic: isPublic}, function(err, chores) {
		if( err || !chores) {
			socket.emit('addList', "No chores found");
			console.log("No chores found");
		} else chores.forEach( function(chore) {
			socket.emit('viewJobs', chore.name, chore.description, chore.points, chore.isDone); //TODO:
			//socket.emit('addList', chore.name + ': ' + chore.description);
			console.log(chore.name + ': ' + chore.description);
		});
	});
	console.log('view jobs public/private ' + isPublic);
}

function viewLeaderboard(socket) {
	//view leaderboard [get users from db]
	socket.emit('clearList');
	socket.emit('setSection', 'Leaderboard');
	db.users.find({}, function(err, users) {
		if( err || !users) {
			socket.emit('addList', "No users found");
			console.log("No users found");
		} else users.forEach( function(user) {
			socket.emit('viewLeaderboard', user.username, user.points);
			console.log(user.username + ': ' + user.points);
		});
	});
	console.log('view leaderboard');
}

function movePrivate(socket, job, bounty, user) {
	db.chores.find({ID: job, isPublic: false}, function(err, chores) {
		if( err || !chores || chores.length == 0) {
			socket.emit('addList', "Job not found");
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
			socket.emit('movePrivate');
		});
	});
}

function submitBidJob(socket, name, description, points) {
	//submit special jobs (?) [add special job to db]
	addJob(true, 0, currentIDIndex, name, "", description, points);
	currentIDIndex++;
	console.log('submit bid job ' + name + ',' + description + ',' + points);
}

function transferPoints(socket, first, second, points) {
//sends points from first to second
	db.users.update({username: first}, {$inc: {points: -points}});
	db.users.update({username: second}, {$inc: {points: points}});
	console.log('transfer ' + points + ' points from ' + first + ' to ' + second);
	socket.emit('transferPoints');
}

function bid(socket, user, job, points) {
	db.chores.update({ID: job}, {$inc: {points: points}});
	db.users.update({username: user}, {$inc: {points: -points}});
	console.log(user + ' bid ' + points + ' points to ' + job);
	socket.emit('bid');
}

function complete(socket, job, user) {
	db.chores.update({ID: job}, {$set: {isDone: true}});
	db.chores.update({ID: job}, {$set: {isVerifying: true}});
	db.chores.update({ID: job}, {$set: {user: user}});
	console.log(user + ' completed ' + job);
	socket.emit('complete');
}

function verify(socket, job, user) {
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
			socket.emit('verify');
		});
	});
	console.log('verify ' + job + ',' + user);
}

//function nudge(user) {
//nudge another user [set target.nudges, user.points]
//}

http.listen(3000, function(){
  console.log('listening on *:3000');
});