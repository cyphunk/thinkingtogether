// sent by admin to change settings (such as group mode)
var password = 'gettinglaidorgettingpaid';
// when true clients only see other signals from their own group
var group_mode = false;
var config = require('./config');


process.env.NODE_ENV = config.server.mode;

var express = require('express');
var http = require('http');

var app = express();
var server = http.createServer(app);

app.get('/admin', function(req, res){ res.sendFile(__dirname+'/public/admin.html'); });
app.get('/stage', function(req, res){ res.sendFile(__dirname+'/public/stage.html'); });
app.use(express.static(__dirname + '/public'));
app.set('port', config.server.port);

if (process.env.NODE_ENV === 'development') {
	app.use(express.errorHandler({ dumpExceptions: true, showStack: true }));
}


// just store signular epoch to be sent to clients and controlled via admin
var epoch = config.epoch;

var sessionid = new Date().getTime() || Math.random();

// Keep track of which names are used so that there are no duplicates
var users = (function () {
  var users = {}; // userList[uid] = {name: name, uid: uid}
  // uid is just an incremented number for now
  var name_iterator = 1;
  var name_prefix = 'User '; // TODO: orion may want to change

  var get_or_new = function (uid) {
      console.log('users.get_or_new()')
      var sid = uid.split('#').shift();
      if (!uid || sid != sessionid) {
        console.log('users.get_or_new - missing uid or sessoinid wrong', uid, sid, sessionid)
        uid = sid+'#'+name_iterator;
        users[uid] = {
            name: name_prefix+name_iterator,
            uid: uid,
            gid: name_iterator%2 ? 'b' : 'a' // give group based on odd/even
        };
        name_iterator += 1;
      }
      else {
          console.log('users.get_or_new - uid and sid already valid. (browser refreshed?)', uid, sid, sessionid)
          return users[uid];
      }
  };
  var get = function () {
    return users;
  };
  var free = function (uid) {
    if (users[uid]) {
      delete users[uid];
    }
  };

  return {
    free: free,
    get_or_new: get_or_new,
    get: get
  };
}());


var signals = (function () {
    var sigs = {};
    var put = function (data) {
        /* Format

        data = {
            signal_key: {
               user: {uid:, name, gid},
               text:
            },
        }
        atm signal_key is user.uid BECAUSE we have only one signal per user
        */
        sigs[data.user.uid] = data;
    };
    var get = function () {
        // var res = [];
        // for (sig in sigs) {
        //     res.push(sigs[sig]);
        // }
        // return res;
        return sigs;
    };
    return {
        put: put,
        get: get
    }
}());
var votes = (function () {
    var vots = {};
    var make = function (voter_uid, signal_uid) {
        vots[voter_uid] = signal_uid;
    };
    var get = function () {
        return vots;
    };
    // TODO Add function to be used to check if a new incoming value is actually ne
    return {
        make: make,
        get: get
    }
}());

var stdin = process.openStdin();
stdin.setRawMode(true);
stdin.resume();
stdin.setEncoding('utf8');
stdin.on( 'data', function( key ){
  if ( key === '\u0003' ) { // ctrl+c aka quit
    // save_state();
    // setTimeout(function(){process.exit()}, PROCESS_EXIT_WAIT);
	process.exit();
  }
  // else if ( key === '\u0013') { // ctrl+s aka save
  //   save_state();
  // }
  else if ( key === '\u0014') { // ctrl+t aka test
      console.log("\nusers:\n", users.get());
      console.log("\nsignals:\n", signals.get());
      console.log("\nvotes:\n", votes.get());
      console.log("\nepoch:\n", epoch);
  }

  //console.log(util.inspect(key,{depth: null})); // use to see key
  // write the key to stdout all normal like
  process.stdout.write( key );
});






var socket = function (socket) {
  console.log('a user connected');
  console.log('connect user', user);
  console.log('connect query', socket.handshake.query);
  console.log("users[] before\n", users.get());

  // per user is uid and optionally user #hash for debug and testing
  var uid = socket.handshake.address;
  if (socket.handshake.query && socket.handshake.query.uid)
    uid += '#'+socket.handshake.query.hash;
  console.log('connect uid', uid);
  var user = users.get_or_new(uid);
  console.log("users[] after init\n", users.get());

  // send the new user their name and current data
  console.log("signals[] before init\n", signals.get());
  console.log("votes[] before init\n", votes.get());
  socket.emit('init', {
    user: user,
    users: users.get(),
    signals: signals.get(),
    votes: votes.get(),
    group_mode: group_mode,
    epoch: epoch
  });

  // notify other clients that a new user has joined
  socket.broadcast.emit('user:join', {
    user: user
  });

  // broadcast a user's message to other users
  socket.on('send:signal', function (data) {
    if (config.server.reject_empty_signal && !data.text) return; // ignore empty
    console.log('socket.on send:signal', data);
    console.log('socket.on all signals', signals.get());
    signals.put(data);
    socket.broadcast.emit('send:signal', {
      user: user,
      text: data.text
    });
  });

  socket.on('send:vote', function (data) {
    console.log('socket.on send:vote', data);
    // TODO Add function to be used to check if a new incoming value is actually ne
    votes.make(data.voter, data.signal);
    socket.broadcast.emit('send:vote', data);
    console.log('socket.on all votes', votes.get());
  });

  socket.on('admin:command', function (data) {
    console.log('socket.on admin:command', data);
    if (!data.password || data.password != password) {
        socket.emit('error:message', {
            message: 'bad or missing password in url #: \"'+data.password+'\"'
        });
        console.log('socket.on admin:command - bad or missing admin password');
        console.log(data.password, '!=', password);
        return;
    }
    if (data.command.method == 'setState') {
        if (data.command.state == 'group_mode') {
            group_mode = data.command.value;
        }
    }
    socket.broadcast.emit('admin:command', data.command);
  });

  socket.on('admin:epoch', function (data) {
      console.log('socket.on admin:epoch', data);
      if (!data.password || data.password != password) {
          socket.emit('error:message', {
              message: 'bad or missing password in url #: \"'+data.password+'\"'
          });
          console.log('socket.on admin:epoch - bad or missing admin password');
          console.log(data.password, '!=', password);
          return;
      }
      epoch = data.epoch;
      socket.broadcast.emit('admin:epoch', data.epoch);
  });

  socket.on('admin:stage', function (data) {
      console.log('socket.on admin:stage', data);
      if (!data.password || data.password != password) {
          socket.emit('error:message', {
              message: 'bad or missing password: \"'+data.password+'\"'
          });
          console.log('socket.on admin:stage - bad or missing admin password');
          console.log(data.password, '!=', password);
          return;
      }
      socket.broadcast.emit('admin:stage', data.stage);
  });

  // validate a user's name change, and broadcast it on success
  // socket.on('change:name', function (data, fn) {
  //   if (userNames.claim(data.name)) {
  //     var oldName = name;
  //     userNames.free(oldName);
  //
  //     name = data.name;
  //
  //     socket.broadcast.emit('change:name', {
  //       oldName: oldName,
  //       newName: name
  //     });
  //
  //     fn(true);
  //   } else {
  //     fn(false);
  //   }
  // });

  // clean up when a user leaves, and broadcast it to other users
  socket.on('disconnect', function () {
      console.log('disconnect user', user);
    socket.broadcast.emit('user:left', {
      user: user
    });
    //users.free(user.uid);
  });
};





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
