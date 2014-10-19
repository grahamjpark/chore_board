var app = require('express')();
var http = require('http').Server(app);
var io = require('socket.io')(http);
var databaseUrl = "data";
var collections = ["chores", "users"];
var db = require("mongojs").connect(databaseUrl, collections);

app.use(require('express').static(__dirname +'/public'));

app.get('/', function(req, res){
	res.sendfile('list.html');
});

io.on('connection', function(socket){
	console.log('user connection');
	socket.on('register', function(user, pass, group){register(user, pass, group);});
	socket.on('login', function(user, pass, group){login(user, pass, group);});
	socket.on('addPublicJob', function(group, id, jobName, username, desc, value){addJob(true, group, id, jobName, username, desc, value);});
	socket.on('addPrivateJob', function(group, id, jobName, username, desc, value){addJob(false, group, id, jobName, username, desc, value);});
	socket.on('viewJobs', function(isPublic){viewJobs(isPublic);});
	socket.on('viewLeaderboard', function(){viewLeaderboard();});
	socket.on('movePrivate', function(job, bounty, user){movePrivate(job, bounty, user);});
	socket.on('submitBidJob', function(name, description, points){submitBidJob(name, description, points);});
	socket.on('transferPoints', function(first, second, points){transferPoints(first, second, points);});
	socket.on('bid', function(job, points){bid(job, points);});
	socket.on('complete', function(job){complete(job);});
	socket.on('verify', function(job, user){verify(job, user);});
});

//TODO: THESE FUNCTIONS
//use the following to send things back to the index
//io.emit('<functionname>', '<information>');

function addJob(isPublic, group, id, jobName, username, desc, value) {
	var p = db.chores;
	p.save({groupID: parseInt(group), ID: parseInt(id), name: jobName, user: username, description: desc, points: parseInt(value), isVerifying: false, isDone: false, isPublic: isPublic}, function(err, saved) {
		if( err || !saved ) console.log("Job not saved");
		else {
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

function login(user, pass, group) {
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

function viewJobs(isPublic) {
	//view jobs (special | chores) [get jobs from db]
	io.emit('clearList');
	io.emit('setSection', isPublic ? 'Public' : 'Private');
	db.chores.find({isPublic: isPublic}, function(err, chores) {
		if( err || !chores) {
			io.emit('addList', "No chores found");
			console.log("No chores found");
		} else chores.forEach( function(chore) {
			io.emit('addList', chore.name + ': ' + chore.description);
			console.log(chore.name + ': ' + chore.description);
		});
	});
	console.log('view jobs public/private ' + isPublic);
}

function viewLeaderboard() {
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

function movePrivate(job, bounty, user) {
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
		});
	});
}

function submitBidJob(name, description, points) {
	//submit special jobs (?) [add special job to db]
	console.log('submit bid job ' + name + ',' + description + ',' + points);
}

function transferPoints(first, second, points) {
//sends points from first to second
	db.users.update({username: first}, {$inc: {points: -points}});
	db.users.update({username: second}, {$inc: {points: points}});
	console.log('transfer ' + points + ' points from ' + first + ' to ' + second);
}

function bid(job, points) {
	//TODO
	//THIS IS CONCEPTUAL AND NEEDS TO BE REFINED AND TESTED
	//TODO: Test and update with current field names
	//bid to special job
	db.publicChores.find({ID: job}, function(err, chore) {
		if( err || !publicChores) {
			io.emit('addList', "Job not found");
			console.log("Job not found");
		} else privateChores.forEach( function(chore) {
				chore.points = chore.points + points;
		});
	});
	console.log('bid ' + points + ' points to ' + job);
}

function complete(job, user) {
	//TODO
	//THIS IS CONCEPTUAL AND NEEDS TO BE REFINED AND TESTED
	//complete special jobs [set job.isVerifying]
	db.users.find({username : user}, function(err, worker) {
		if( err || !users) {
				io.emit('addList', "User not found");
				console.log("User not found");
			} else privateChores.forEach( function(chore) {
				db.publicChores.find({ID: job}, function(err, users) {
					if( err || !publicChores) {
						io.emit('addList', "Job not found");
						console.log("Job not found");
					} else privateChores.forEach( function(chore) {
						worker.points += chore.points;
					});
				});
			});
		});
	
	console.log('complete ' + job);
}

function verify(job, user) {
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