var n_clients = 15;
var io = require('socket.io-client');

var clients = []
var starttime = new Date().getTime()

function start(i) {
    console.log(i)
    var socket = io.connect('http://localhost:8081', {
                reconnect: true,
                extraHeaders: {referer: '/'}
            }
        );
    socket.on('connect', function (s) {
        console.log('Connected!');
    });
    socket.on('init', function(data) {
        console.log('init')
        setInterval( function(user) {
            console.log('emit: '+i)
            socket.emit('send:signal', {
            user : user,
            text : user.name + ': ' + (new Date().getTime() - starttime) //.replace(/\n|\./g,'')
            })},
            Math.floor(Math.random() * 10000) + 1000, data.user
        );
    });
    clients[i] = socket;
    if (i < n_clients) {
        setTimeout(function() { start(i+1) }, Math.floor(Math.random() * 100) + 300 );
    }
}

start(0);
// Add a connect listener
