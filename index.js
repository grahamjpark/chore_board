var app = require('express')();
var http = require('http').Server(app);
var io = require('socket.io')(http);

app.get('/', function(req, res){
	res.sendfile('index.html');
});

io.on('connection', function(socket){
	console.log('user connection');
	socket.on('login', function(user, pass){login(user, pass);});
	socket.on('viewJobs', function(isPublic){viewJobs(isPublic);});
	socket.on('viewLeaderboard', function(){viewLeaderboard();});
	socket.on('movePrivate', function(job, bounty){movePrivate(job, bounty);});
	socket.on('submitBidJob', function(name, description, points){submitBidJob(name, description, points);});
	socket.on('transferPoints', function(user, points){transferPoints(user, points);});
	socket.on('bid', function(job, points){bid(job, points);});
	socket.on('complete', function(job){complete(job);});
	socket.on('verify', function(job){verify(job);});
});

//TODO: THESE FUNCTIONS
//use the following to send things back to the index
//io.emit('<functionname>', '<information>');

function login(user, pass) {
	//login/register [add user to db]
	console.log('login ' + user + ',' + pass);
}

function viewJobs(isPublic) {
	//view jobs (special | chores) [get jobs from db]
	console.log('view jobs public/private ' + isPublic);
}

function viewLeaderboard() {
	//view leaderboard [get users from db]
	console.log('view leaderboard');
}

function movePrivate(job, bounty) {
	//move chores to special at a cost of points [set job.isSpecial, job.points, user.points]
	console.log('move private ' + job + ',' + bounty);
}

function submitBidJob(name, description, points) {
	//submit special jobs (?) [add special job to db]
	console.log('submit bid job ' + name + ',' + description + ',' + points);
}

function transferPoints(user, points) {
	//transfer points [set user.points, target.points]
	//remove own points [set user.points]
	//allow transfer to "null" user for point removal
	console.log('transfer ' + points + ' points to ' + user);
}

function bid(job, points) {
	//bid to special job
	console.log('bid ' + points + ' points to ' + job);
}

function complete(job) {
	//complete special jobs [set job.isVerifying]
	console.log('complete ' + job);
}

function verify(job) {
	//verify that a user did a special job [set job.isDone, job.isVerifying]
	console.log('verify ' + job);
}

//function nudge(user) {
//nudge another user [set target.nudges, user.points]
//}

http.listen(3000, function(){
  console.log('listening on *:3000');
});