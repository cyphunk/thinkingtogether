'use strict';


/*
 MAJOR TODO's

 Make TabList fixed in place so user can scroll all signals

 Make epoch progress. MAke it dependent on exhistence of 1+ suggetion for both groups

 Stage cycle:
   decide phase shows top N with N1 least opaque.
   as end of decide phase comes closer N's>1 fade to nothing
     and then top one moves above seperation line and obtains group color
   signals[] goes blank and clients can suggest next phrases.
   however there is a stage pause time before fading in the ranks
   background: linear-gradient(to bottom, rgba(0, 0, 0, 1), rgba(0, 0, 0, 0));
https://developer.mozilla.org/en-US/docs/Web/CSS/linear-gradient

 BUG: pushing signal, reload, push another. causes other cleints to have both
 BUG: only shows most recent signal on reload
 Add epoch by making current epoch_i parent of signals[] on server. client ignorant of this
 add time based and bang based epoch increment
 add progress timer for time based

 Add admin to bang to end current epoch

 Add vote on signals
 Perhaps unify things into just the signals[] array rather than signals and signal

 Save state so that restart picks up where we left off

 BUG: admin page creates a client user. currently this isn't a big problem. only
      causes the group sorting to maybe have one extra and one less in one group
	  but in the future there may be new reasons to resolve this. resolution
	  would be to not create user on recieve of socket init and instead require
	  legit clients to send a new join message after init, and have admin NOT
	  send such a message.


 Add first time overlays
   http://stackoverflow.com/questions/23363529/client-side-feature-tour-tutorial-instructional-overlay-system
      introjs looks nice
   https://github.com/gilbarbara/react-joyride
   https://react-bootstrap.github.io/react-overlays/#portals
   such as an overlay...
     "click to vote" appears first time instead of vote button
	 instructions over on modify on first use

 Add image
  https://developers.google.com/web/fundamentals/native-hardware/capturing-images/


*/


/**
 * Module dependencies.
 */

var config = require('./config');
process.env.NODE_ENV = config.server.mode;

var express = require('express');
var http = require('http');

var socket = require('./socket.js');

var app = express();
var server = http.createServer(app);

/* Configuration */
//app.set('views', __dirname + '/views');
app.get('/admin', function(req, res){ res.sendFile(__dirname+'/public/admin.html'); });
app.get('/stage', function(req, res){ res.sendFile(__dirname+'/public/stage.html'); });
app.use(express.static(__dirname + '/public'));
app.set('port', config.server.port);

if (process.env.NODE_ENV === 'development') {
	app.use(express.errorHandler({ dumpExceptions: true, showStack: true }));
}

/* Socket.io Communication */
var io = require('socket.io').listen(server);
io.sockets.on('connection', socket);
io.use(function (socket, next) {
  var handshake = socket.handshake;
  console.log(handshake.query);
  next();
});
/* Start server */
server.listen(app.get('port'), function (){
  console.log('Express server listening on port %d in %s mode', app.get('port'), app.get('env'));
});


module.exports = app;
