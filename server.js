
if (process.argv.length < 3 ) {
	console.error("usage: "+process.argv[0]+" sessionid [password]")
	console.error("\nsessionid should be different between shows so that clients that may have it part of a saved uid from an older show (or test run) do not have a the possibility to collide with uid's for the current show")
	//process.exit(0)
}

var sessionid = process.argv[2] || parseInt(Math.random() *10000) // parseInt(Math.random() *10000)
// sent by admin to change settings (such as group mode)
//var password = process.argv[3] || 'gettinglaidorgettingpaid'
var password = process.env.ADMIN_PASSWORD || 'change_me'
// when true clients only see other signals from their own group
var group_mode = false
var config = require('./config')
var stage_messages_store = __dirname + '/stage_messages.json'
// just store signular epoch to be sent to clients and controlled via admin
var https = require('https') // to download stage messages

function debug_log() {
    if (config.debug)
        console.log.apply(this, arguments)
}


process.env.NODE_ENV = config.server.mode

var express = require('express')
var http = require('http')
var fs = require('fs')
var app = express()
var server = http.createServer(app)

app.get('/admin', function(req, res){ res.sendFile(__dirname+'/public/admin.html') })
app.get('/stage', function(req, res){ res.sendFile(__dirname+'/public/stage.html') })
app.get('/monitor', function(req, res){ res.sendFile(__dirname+'/public/stage.html') })
app.use(express.static(__dirname + '/public'))
app.set('port', config.server.port)

if (process.env.NODE_ENV === 'development') {
	app.use(express.errorHandler({ dumpExceptions: true, showStack: true }))
}


var write_data = function (name, data) {
	var file = __dirname+'/.data/'+name+'.json'
	var s = JSON.stringify(data, null, 2)
	if (s.length <= 3)
		return
	if (!fs.existsSync(".data"))
		fs.mkdirSync(".data")
	fs.writeFile(file, s, function(e){
		if (e) console.error(file+' '+e)
		else console.log('saved '+file)
	})
}
var load_data = function(name) {
	var file = __dirname+'/.data/'+name+'.json'
	console.log('loading '+file)
	if (fs.existsSync(file))
		return require(file)
	console.log('does not exist '+file)
}
// Keep track of which names are used so that there are no duplicates
var users = (function () {
	var users = {} // userList[uid] = {name: name, uid: uid, gid: "a"|"b"}
	// uid is just an incremented number for now
	var key_groups = {a: [], b: []}
	var name_iterator = 1
	var name_prefix = 'User ' // TODO: orion may want to change
	var reset = function () {
		users = {}
		key_groups = {a: [], b: []}
		name_iterator = 1
	}
	var save = function () {
		write_data('users', {users: users, key_groups: key_groups, name_iterator: name_iterator})
	}
	var load = function () {
		var tmp = load_data('users')
		users = tmp.users
		key_groups = tmp.key_groups
		name_iterator = tmp.name_iterator
		delete tmp
	}
	var _new = function() {
		var new_uid = sessionid+'#'+name_iterator
		var gid = name_iterator%2 ? 'b' : 'a' // give group based on odd/even
		users[new_uid] = {
			name: name_prefix+name_iterator,
			uid: new_uid,
			gid: gid
		}
		key_groups[gid].push(new_uid)
		name_iterator += 1
		return users[new_uid]
	}
	var get_or_new = function (uid) {
		debug_log('users.get_or_new()')
		var sid = null;
		if (!uid || sessionid != uid.split('#').shift()) {
			debug_log('users.get_or_new - missing uid or sessionid wrong', uid, sessionid)
			return _new()
		}
		else {
			// if the server restarted with the same sessionid argument
			// we will have conditions were clients reconnect but the db is empty actuall
			debug_log('users.get_or_new - uid and sid already valid. (browser refreshed?)', uid, sid, sessionid)
			if (users[uid] && users[uid].name) {
				return users[uid]
			}
			else {
				debug_log('yet still, can\'t find uid in db with name. perhaps server restarted without changing sessionid')
				return _new()
			}
		}
	}
	var get = function () {
		return users
	}
	var groups = function () {
		return key_groups
	}
	return {
		get_or_new: get_or_new,
		get: get,
		groups: groups,
		reset: reset,
		save: save,
		load: load
	}
}())


var signals = (function () {
	var sigs = {}
	var reset = function() {
		sigs = {}
	}
	var save = function () {
		write_data('signals', sigs)
	}
	var load = function () {
		sigs = load_data('signals')
	}
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
		sigs[data.user.uid] = data
	}
	var get = function (key) {
		if (key) return sigs[key]
		else     return sigs
	}
	var free = function (key) {
		delete sigs[key]
	}
	return {
		put: put,
		get: get,
		free: free,
		reset: reset,
		save: save,
		load: load
	}
}())
var votes = (function () {
	var vots = {}
	/*
	 vots['voter_uid'] = 'voted_for'
	*/
	var reset = function () {
		vots = {}
	}
	var save = function () {
		write_data('votes', vots)
	}
	var load = function () {
		vots = load_data('votes')
	}

	var make = function (voter_uid, signal_uid) {
		vots[voter_uid] = signal_uid
	}
	var get = function () {
		return vots
	}
	var free = function (uid) {
		// remove all votes for the UID but leave their vote in
		// who uid voted for:
		//delete vots[uid]
		// votes for uid:
		Object.keys(vots).forEach((k) => {
			if (vots[k] == uid) delete vots[k] })
	}
	return {
		make: make,
		get: get,
		free: free,
		reset: reset,
		save: save,
		load: load
	}
}())
// dependent highly on config.epoch and io
var Epoch = function (gid) {
	var gid = gid
	var timer = null
	var pause_timer = null
	var active_signals = { a: {text: '', user: {uid: null, name: ''}},
	b: {text: '', user: {uid: null, name: ''}} }
	// to allow for a master /stage instance and also debug instances
	// we set the master stage_id to the first that is connected
	var master_id = null
	// we can only execute start() after this master_id has been set
	// that means that an admin attempting to start() before there is a stage
	// will be ignored
	var reset = function() {
		active_signals = { a: {text: '', user: {uid: null, name: ''}},
		b: {text: '', user: {uid: null, name: ''}} }
	}
	var change_gid = function(g) {
		gid = g
	}
	var _run_on_start_end = function () {
		debug_log('epoch._run_on_end()');
		var progress = { percent: -1,
						 autoIncrement: false }
		_set_active_signal()
		_start_pause()

	}
	var _set_active_signal = function () {
		debug_log('epoch._set_active_signal()');

		var sigs = signals.get()
		var usrs = users.get()
		var vts = votes.get()
		var key_groups = users.groups()
		var highest_a = {count: -1, uid: null}
		var highest_b = {count: -1, uid: null}
		Object.keys(sigs).map((key) => {
			var vote_count = Object.keys(vts).filter(function(voter){
							 return vts[voter] == key; }).length;
			if (config.epoch.require_min_votes && vote_count < config.epoch.require_min_votes) return;
			if (!group_mode) {
				if (vote_count > highest_a.count) {
					highest_a = {count: vote_count, uid: key}
					highest_b = {count: 0, uid: null}
				}
			}
			else {
				if (sigs[key].user.gid == 'a' &&
				    vote_count > highest_a.count) {
					highest_a = {count: vote_count, uid: key}
				}
				else
				if (sigs[key].user.gid == 'b' &&
					vote_count > highest_b.count) {
					highest_b = {count: vote_count, uid: key}
				}
			}
		});
		debug_log('highest_a',highest_a)
		if (highest_b.uid != null && group_mode) {
			active_signals.b.text = sigs[highest_b.uid].text
			active_signals.b.user = usrs[highest_b.uid]
			// remove signal
			if (config.epoch.delete_winner) {
				//signals.put({user: usrs[highest_b.uid], text: ''})
				signals.free(highest_b.uid)
				// remove votes
				votes.free(highest_b.uid)
			}
		}
		if (highest_a.uid != null) {
			active_signals.a.text = sigs[highest_a.uid].text
			active_signals.a.user = usrs[highest_a.uid]
			// clear winning entry
			if (config.epoch.delete_winner) {
				//signals.put({user: usrs[highest_a.uid], text: ''})
				signals.free(highest_a.uid)
				// remove votes
				votes.free(highest_a.uid)
			}
		}
		// mix in the flag that determines if clients should delete votes
		// why? because epoch:admin changes do not broadcast to clients. yeah, this is getting messy
		if (config.epoch.clear_votes_on_epoch) {
			votes.reset()
		}
		if (config.epoch.clear_signals_on_epoch) {
			signals.reset()
		}
		active_signals.config = {
			clear_votes_on_epoch: config.epoch.clear_votes_on_epoch,
			clear_signals_on_epoch: config.epoch.clear_signals_on_epoch,
			sound_on_signal_chosen: config.epoch.sound_on_signal_chosen,
			gid: gid
		}
		debug_log('epoch._set_active_signal - active', active_signals);
		//////////////////////////////////////////////
		io.emit('epoch:active_signals', active_signals)
		//////////////////////////////////////////////
	}
	var _start_pause = function () {
		debug_log('epoch._start_pause()');
		debug_log('epoch._start_pause - time', config.epoch[gid].pause_length);
		if (config.epoch.pause_forced) {
			debug_log('TODO: handle pause_forced')
		}
		if (pause_timer)
			clearTimeout(pause_timer);
		pause_timer = setTimeout(_run_on_pause_end,
							config.epoch[gid].pause_length*1000);
		io.emit('epoch:stop_progress', {gid: gid})
	}
	var _run_on_pause_end = function () {
		debug_log('epoch._run_on_pause_end()');
		if (config.epoch[gid].start_new_epoch_after_pause) {
			start()
		}
	}
	var get_active_signals = function () {
		return active_signals
	}
	var start = function () {
		debug_log('epoch.start()');
		if (!master_id) {
			debug_log('epoch.start - no master_id');
			return
		}
		debug_log('epoch.start - time', config.epoch[gid].seed_length);
		var progress = { percent: 0,
						 autoIncrement: true,
						 intervalTime: config.epoch[gid].seed_length*10,
					  	 gid: gid }
		debug_log('epoch.start - progress', progress);
		////////////////////////////////
		io.emit('epoch:start', progress)
		////////////////////////////////
		if (timer)
			clearTimeout(timer);
		timer = setTimeout(_run_on_start_end,
						   (config.epoch[gid].seed_length+1)*1000);
	}
	var set_master_id = function (id) {
		debug_log('epoch.set_master_id()');
		debug_log('epoch.set_master_id - new id, old id', id, master_id);
		// if (master_id) {
		// 	debug_log('epoch.set_master_id - id already set', master_id);
		// 	return false
		// }
		master_id = id
		return id
	}
	var get_master_id = function () { return master_id }
	return {
		start: start,
		get_active_signals: get_active_signals,
		set_master_id: set_master_id,
		get_master_id: get_master_id,
		reset: reset,
		change_gid: change_gid
	}
}
var epoch = new Epoch('a')
// oh so ugly but this is how we can quickly maybe add a epoch timer split between group a and group b
var epoch_b = new Epoch('b')
// var epoch_b = Object.assign({},epoch);
// epoch_b.change_gid('b')

var save_state = function() {
	console.log('saving state in ./data')
	users.save()
	signals.save()
	votes.save()
}
var load_state = function () {
	console.log('loading state in ./data')
	users.load()
	signals.load()
	votes.load()
	// app+stage will reload their client pages on this:
	io.emit('admin:command', {method: 'reload_page'})
}


if (process.stdout.isTTY) {
	var stdin = process.openStdin()
	stdin.setRawMode(true)
	stdin.resume()
	stdin.setEncoding('utf8')
	stdin.on( 'data', function( key ){
		if ( key === '\u0003' ) { // ctrl+c aka quit
			// save_state()
			// setTimeout(function(){process.exit()}, PROCESS_EXIT_WAIT)
			process.exit()
		}
		else if ( key === '\u000c') { // ctrl+l aka load
		  load_state()
		}
		else if ( key === '\u0004') { // ctrl+d set debug
			config.debug = !config.debug
		}
		else if ( key === '\u0013') { // ctrl+s aka save
		  save_state()
		}
		else if ( key === '\u0014') { // ctrl+t aka test
			console.log("\nusers:\n", users.get())
			console.log("\nsignals:\n", signals.get())
			console.log("\nvotes:\n", votes.get())
			console.log("\nepoch master_id:", epoch.get_master_id())
			console.log("epoch config:\n", config.epoch)
			console.log("epoch active signals:", epoch.get_active_signals())
			console.log("\nepoch_b master_id:", epoch_b.get_master_id())
			console.log("epoch_b active signals:", epoch_b.get_active_signals())
			console.log("\nstage:\n", config.stage)
		}

		//console.log(util.inspect(key,{depth: null})) // use to see key
		// write the key to stdout all normal like
		process.stdout.write( key )
	})
}






var socket = function (socket) {
	debug_log('socket()')
	debug_log('socket() - connect query', socket.handshake.query)

	// only register user uid if this is not the stage or admin page
	var is_stage = socket.handshake.headers.referer.match('/stage') ? true : false
	var is_monitor = socket.handshake.headers.referer.match('/monitor') ? true : false
	var is_admin = socket.handshake.headers.referer.match('/admin') ? true : false
	debug_log('socket() - is admin:', is_admin, 'stage:', is_stage)

	var user = null
	// a valid session uid sent when user accidentally refresh browser.
	if (!is_stage && !is_admin && !is_monitor) {
		var uid = null
		if (socket.handshake.query && socket.handshake.query.uid)
		uid = socket.handshake.query.uid
		debug_log('socket() - query uid', uid)
		user = users.get_or_new(uid)
		debug_log("socket() - user, users[]", user, "\n",users.get())
	}
	// for stage record the id
	if (is_stage || is_monitor) {
		if (is_stage) {
			epoch.set_master_id(socket.id)
			epoch_b.set_master_id(socket.id)
		}
		socket.emit('init', {
			users: users.get(),
			signals: signals.get(),
			votes: votes.get(),
			group_mode: group_mode,
			stage: config.stage,
			active_signals: epoch.get_active_signals()
		})
		if (!config.epoch.a.wait_for_bang_to_start)
			epoch.start()
		if (group_mode && !config.epoch.b.wait_for_bang_to_start)
			epoch_b.start()
	}
	else {
		// send the new user their name and current data
		socket.emit('init', {
			user: user,
			users: users.get(),
			signals: signals.get(),
			votes: votes.get(),
			group_mode: group_mode,
			config: config
		})
		if (!is_admin) {
			// notify other clients that a new user has joined
			socket.broadcast.emit('user:join', {
				user: user
			})
		}
	}

	// broadcast a user's message to other users
	socket.on('send:signal', function (data) {
		if (config.server.reject_empty_signal && !data.text) return // ignore empty
		debug_log('socket.on(send:signal)', data)
		signals.put(data)
		socket.broadcast.emit('send:signal', {
			user: user,
			text: data.text
		})
	})

	socket.on('send:vote', function (data) {
		debug_log('socket.on(send:vote)')
		debug_log('socket.on(send:vote) - data', data)
		// TODO Add function to be used to check if a new incoming value is actually ne
		votes.make(data.voter, data.signal)
		socket.broadcast.emit('send:vote', data)
	})

	socket.on('admin:command', function (data) {
		debug_log('socket.on(admin:command)')
		debug_log('socket.on(admin:command) - data', data)
		if (!data.password || data.password != password) {
			socket.emit('error:message', {
				message: 'bad or missing password'
			})
			debug_log('socket.on(admin:command) - bad or missing admin password')
			debug_log(data.password, '!=', password)
			return
		}
		if (data.command.method == 'set_state') {
			if (data.command.state == 'group_mode') {
				group_mode = data.command.value
				socket.broadcast.emit('admin:command', data.command)
			}
		}
		else
		if (data.command.method == 'set_config') {
			config = data.command.value
			socket.broadcast.emit('admin:command', data.command)
		}
		else
		if (data.command.method == 'broadcast_message') {
			socket.broadcast.emit('admin:command', data.command)
		}

		else
		if (data.command.method == 'get_stage_messages') {
			fs.exists(stage_messages_store, function(exists) { if (exists) {
					fs.readFile(stage_messages_store, function (err, data) {
						var d = []
						try { d = JSON.parse(data) } catch (e) { console.log ('err',e) }
						socket.emit('stage_messages', { messages: d })
						debug_log('sent',d)
					});
				}
			})
		}
		else
		if (data.command.method == 'download_stage_messages') {
			if (!data.command.url) return
			debug_log('http_get request',data.command.url);
			https.get(data.command.url, function(res) {
				var body = '';
				res.on('data', function(d) { body += d })
				res.on('end', function() {
					fs.writeFile(stage_messages_store, body, function(err) {
						if (err) console.log(stage_messages_store+' '+err);
						else     debug_log('saved '+stage_messages_store+' size:'+body.length);
					})
					var d = []
					try { d = JSON.parse(body) } catch (e) { consoel.log ('err',e) }
					socket.emit('stage_messages', { messages: d });
					debug_log('sent',d)
				})
			})
		}
		else
		if (data.command.method == 'broadcast_stage_message') {
			debug_log('stage message', data)
			socket.broadcast.emit('admin:stagemessage', { message: data.command.value})
		}


		if (data.command.method == 'reset_session') {
			users.reset()
			signals.reset()
			votes.reset()
			epoch.reset()
			epoch_b.reset()
			sessionid = parseInt(Math.random() *10000)
			socket.broadcast.emit('admin:command', {method: 'reload_page'})
		}
	})

	socket.on('admin:epoch', function (data) {
		debug_log('socket.on(admin:epoch)')
		debug_log('socket.on(admin:epoch) - data', data)
		if (!data.password || data.password != password) {
			socket.emit('error:message', {
				message: 'bad or missing password in url #: \"'+data.password+'\"'
			})
			debug_log('socket.on(admin:epoch) - bad or missing admin password')
			debug_log(data.password, '!=', password)
			return
		}

		if (data.epoch && data.epoch.start &&
			data.epoch.start == true) {
				if (data.epoch.gid == 'a')
					epoch.start()
				else if (data.epoch.gid == 'b')
					epoch_b.start()
		}
		else
		if (data.epoch) {
			config.epoch = data.epoch
			io.emit('epoch:config', config.epoch)
		}
		else
		if (data.active_signals_clear == true) {
			epoch.reset()
			epoch_b.reset()
			io.emit('epoch:active_signals_clear')
		}
	})

	socket.on('admin:stage', function (data) {
		debug_log('socket.on(admin:stage)')
		debug_log('socket.on(admin:stage) - data', data)
		if (!data.password || data.password != password) {
			socket.emit('error:message', {
				message: 'bad or missing password: \"'+data.password+'\"'
			})
			debug_log('socket.on admin:stage - bad or missing admin password')
			debug_log(data.password, '!=', password)
			return
		}
		config.stage = data.stage
		socket.broadcast.emit('admin:stage', data.stage)
	})

	socket.on('admin:stagestyle', function (data) {
		debug_log('socket.on(admin:stagestyle)')
		debug_log('socket.on(admin:stagestyle) - data', data)
		if (!data.password || data.password != password) {
			socket.emit('error:message', {
				message: 'bad or missing password: \"'+data.password+'\"'
			})
			debug_log('socket.on admin:stage - bad or missing admin password')
			debug_log(data.password, '!=', password)
			return
		}
		socket.broadcast.emit('admin:stagestyle', {command: data.command})
	})

	// validate a user's name change, and broadcast it on success
	// socket.on('change:name', function (data, fn) {
	//   if (userNames.claim(data.name)) {
	//     var oldName = name
	//     userNames.free(oldName)
	//
	//     name = data.name
	//
	//     socket.broadcast.emit('change:name', {
	//       oldName: oldName,
	//       newName: name
	//     })
	//
	//     fn(true)
	//   } else {
	//     fn(false)
	//   }
	// })

	// clean up when a user leaves, and broadcast it to other users
	socket.on('disconnect', function () {
		debug_log('disconnect user', user)
		socket.broadcast.emit('user:left', {
			user: user
		})
		//users.free(user.uid)
	})
}





var io = require('socket.io').listen(server)
io.sockets.on('connection', socket)
io.use(function (socket, next) {
	var handshake = socket.handshake
	debug_log('io.use() - handshake', handshake.query)
	next()
})
/* Start server */
server.listen(app.get('port'), function (){
	console.log('Express server listening on port %d in %s mode', app.get('port'), app.get('env'))
})

if (config.server.load_data_files)
	load_state()

module.exports = app
