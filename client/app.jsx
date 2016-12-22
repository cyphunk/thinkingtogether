'use strict';

localStorage.debug = '';

// var React = require('react');
import React, { Component } from 'react';
// import ReactCSSTransitionGroup from 'react-addons-css-transition-group';
// Doesnt work:
//import Shuffle from 'react-shuffle';
// for FlipMove also change React.render() at end to ReactDOM.render()
//https://github.com/joshwcomeau/react-flip-move
import FlipMove from 'react-flip-move';
import ReactDOM from 'react-dom';
import Textarea from 'react-textarea-autosize';

import { Tab, Tabs, TabList, TabPanel } from 'react-tabs';

import config from '../config';

//
// ordering the list a ghetto way for now. maybe better in the future with more time
//
/* ORDER:
  your signal
  your select
  top#1
  top#2 / this removed if s
  neighbor
  latest
  random

*/
var actual_latest = null // change on new epoch
var current_selected = null // need this. eg. select latest but after n seconds
var current_top = null // change every N time
var current_neighbor = null // change on new epoch
var current_latest = null // /use on timeout to set_latest latest changes. should still see selected
var current_random = null
// these ony show up if the above overlap
var current_second = null
var current_latest2 = null
var current_random2 = null
// call whenever a new signal comes in
var signal_order_timer = null // started on start and

// if we have a previous uid send it. uid's are unique and only valid per session
console.log("localStorage.uid = ", localStorage.uid)
var using_hash_uid=false; // turn on with hash
if (window.location.hash.length > 1) {
    var socket = io.connect({query: 'uid='+window.location.hash.substr(1)});
    using_hash_uid = true;
}
else if (localStorage.uid) {
    var socket = io.connect({query: 'uid='+localStorage.uid });
}
else {
    var socket = io.connect();
}
window.onhashchange = function() {
    window.location.reload();
}

var Writer = React.createClass({
    handle_submit(e) {
        console.log("Writer handle_submit");
        e.preventDefault();
        socket.emit('send:signal', {
            user : this.props.user,
            text : this.props.signal //.replace(/\n|\./g,'')
        });
    },
    handle_change(e) {
        console.log('Writer handle_change - match .', e.target.value.match(/\. *$/g))
        if (e.target.value.length>config.writer.max_chars+3) return;
        this.props.handle_writer_signal_field_changed(e.target.value);
        // the . match includes catch double space bar added periods from phones
        if (( config.writer.submit_on_linebreak &&
              e.target.value[e.target.value.length-1] == "\n") ||
            ( config.writer.submit_on_period &&
              e.target.value.match(/\. *$/g) !== null) ) {
            console.log("Writer handle_change - submit");
            socket.emit('send:signal', {
                user : this.props.user,
                text : e.target.value.replace(/\n|\./g, '')
            });
        }
        else if (config.writer.send_live_input) {
            //TODO
            console.log("Writer handle_change - to stage: "+e.target.value+' code:'+e.keyCode);
            socket.emit('send:signal', {
                user : this.props.user,
                text : e.target.value
            });
        }
        //Supposedly pressing enter in text input calls the forms submit
        // so we do not need to call this.handle_submit on enter
    },
    moveCaretAtEnd(e) {
      var temp_value = e.target.value
      e.target.value = ''
      e.target.value = temp_value
    },
    render() {
        console.log('text',this.props.signal)
        var submit_elem = null
        if (config.writer.show_submit_button)
            submit_elem = <input className="submit_button" type="submit" value="Submit"/>
        return (
            <form onSubmit={this.handle_submit} >
            <table className="writer_table"><tr><td colSpan="2">
                <Textarea
                    type="text"
                    placeholder={"Propose signal <"+config.writer.max_chars+" letters..."}
                    ref={(input) => this.signalInput = input}
                    onChange={this.handle_change}
                    value={this.props.signal}
                    autoFocus="true"
                    onFocus={this.moveCaretAtEnd}
                >
                </Textarea>
                </td></tr><tr><td>
                <span className="user_name">You are {this.props.user.name}</span></td><td>
                {submit_elem}</td></tr></table>
            </form>
        );
    },

});
var Signal = React.createClass({
    handle_vote(e) {
        console.log("Signal.handle_vote()", this.props.voter.uid, this.props.signal.user.uid);
        if (config.voter.prevent_vote_self &&
            this.props.voter.uid === this.props.signal.user.uid)
            return;
        this.props.update_state_vote(this.props.voter.uid, this.props.signal.user.uid);
        socket.emit("send:vote", {
            voter: this.props.voter.uid,
            signal: this.props.signal.user.uid
        } );
    },
    handle_modify(e) {
        console.log("Signal.handle_modify()",this.props.signal.text);
        // console.log("Signal.handle_modify()",this.refs.signalInput.getDOMNode().textContent);
        // console.log("Signal handle_modify:",this.refs.signalInput.getDOMNode().children[0].textContent);
        console.log("on error check the html and per sure there are no spaces in your babel");
        // var value = this.refs.signalInput.getDOMNode().textContent;
        // remove . and \n from the new text. So that detection to change tab on . and \n works
        this.props.update_state_signal(this.props.signal.text.replace(/\.|\n/g,""));
    },
	render() {
		return (
			<div className={this.props.this_class_name}>
                <table>
                    <tbody>
                            <td>
                <button    className="modify_button"
                           onClick={this.handle_modify}>&nbsp;</button>

                {/* <span className="vote_count">{this.props.signal.vote_count}</span> */}
            </td><td>
				<span className="signal_text"
                      onClick={this.handle_vote}>{this.props.signal.text}</span>
                {/* <span className="UID"
                      ref="UID">{this.props.signal.user.uid}</span> */}
              <button    className="vote_button"
                         onClick={this.handle_vote}>{this.props.signal.vote_count}&nbsp;&nbsp;<span className="user_name">({this.props.signal.user.name})</span></button>
                {/* <span className="user_name"
                      onClick={this.handle_vote}>({this.props.signal.user.name})</span> */}
            </td></tbody></table>
			</div>
		);
	}
});
// percentage test http://jsfiddle.net/mjEDY/99/

var Voter = React.createClass({
    add_vote_count_to_signals(keys) {
        // calculate vote_count and store it in signals
        var signals = this.props.signals;
        var votes = this.props.votes;
        keys.map((key) => {
            // incompatible with many browsers:
            // var vote_count = Object.values(votes).filter(
            //                   function(val){
            //                        return val == key;
            //                   }).length;
            signals[key].vote_count = 0;
      	    Object.keys(votes).forEach(function (k) {
                      if (votes[k] == key) signals[key].vote_count+=1;
                  });
            // signals[key].vote_count = vote_count;
        });
        console.log('Voter.addvote_count - signals after vote_count added', signals);
        // BUG TODO : DO we need to call set_state ?
    },
    organize_signal_keys(keys) {
        var signals = this.props.signals;
        var user = this.props.user;
        var group_mode = this.props.group_mode;
        console.log('Voter.organize_signal_keys - keys', keys);
        // remove our key/uid from list if it is there
        if (keys.indexOf(user.uid)>=0)
            keys.splice(keys.indexOf(user.uid),1);
        console.log('Voter.organize_signal_keys - without own', keys);
        // sort by votes
        var sorted = keys.sort(function(a,b) {
            // lowest first, to highest end
            //return signals[a].vote_count - signals[b].vote_count;
            // highest first, to lowest end
            return signals[b].vote_count - signals[a].vote_count;
        });
        console.log('Voter.organize_signal_keys - keys sorted by vote_count', sorted);
        // put into groups if group_mode is true
        // if in group_mode split into a/b. Else everything into a
        // Also, remove empty if config says so
        var groups = {a: [], b: []};
        sorted.map((key) => {
            var signal = signals[key];
            if (signal.text.length < config.voter.min_signal_length)
                return;
            console.log('Voter.organize_signal_keys key,gid', key, signal.user.gid)
            if (group_mode && signal.user.gid == 'b')
                groups.b.push(key)
            else
                groups.a.push(key)
        });
        console.log('Voter.organize_signal_keys - groups', groups);
        return groups;
    },
    set_signal_order(signal_keys) { // expect signal keys ordered by vote
        console.log('Voter.set_signal_order()')
        console.log('Voter.set_signal_order() - current_neighbor', current_neighbor)
        var current_selected = this.props.votes[this.props.user.uid]
        var current_top = signal_keys[0]
        signal_keys.shift()

        // current neighbor set in timer loop
        // if (!current_neighbor)
        //     current_neighbor = signal_keys[2]
        if (!current_latest)
            current_latest   = signal_keys.length > 0 ? signal_keys.splice(-1,1)[0] : undefined
        if (!current_random)
            current_random   = signal_keys.length > 0 ? signal_keys[Math.floor(Math.random() * signal_keys.length)] : undefined
        // make sure we cover cases where several overlaps happen
        if (!current_latest2)
            current_latest2  = signal_keys.length > 0 ? signal_keys.splice(-1,1)[0] : undefined
        if (!current_random2)
            current_random2  = signal_keys.length > 0 ? signal_keys[Math.floor(Math.random() * signal_keys.length)] : undefined
        var current_second = signal_keys[0]
        // do not shift because it may be current second never shows up

        var ret = [
            signal_keys[0],
            current_selected,
            current_neighbor,
            current_latest,
            current_random,
            signal_keys[1],
            current_latest2,
            current_random2
        ]
        // unique and remove undefined
        var ret = ret.filter(function(value,index,self) {
            return value && self.indexOf(value) === index
        })
        // make sure no more than 5
        var ret = ret.slice(0,config.voter.show_n_signals)
        return ret
    },
	render() {
        var signal_keys = Object.keys(this.props.signals);
        // add vote_count to signals[]
        this.add_vote_count_to_signals(signal_keys)
        // sort keys by votes and groups
        var key_groups = this.organize_signal_keys(signal_keys);
        console.log('Voter render - key_groups', key_groups);
        if (this.props.group_mode)
            var keys = key_groups[this.props.user.gid];
        else
            var keys = key_groups.a;
        console.log('Voter render - keys', keys);
        // setup ordering
        keys = this.set_signal_order(keys)
        console.log('Voter render - keys after order', keys)

        var my_signal = null;
        if (this.props.signals[this.props.user.uid]) {
            my_signal = <div className='signal my_signal'>
                    <table><tbody><td>
                            <button    className="modify_button"
                                       onClick={() => this.props.update_state_signal(this.props.signals[this.props.user.uid].text.replace(/\.|\n/g,""))}>&nbsp;</button>
                           </td><td>
            				<span className="signal_text">{this.props.signals[this.props.user.uid].text}</span>
                            <button    className="vote_button"
                                       onClick={() => alert('you cannot vote for yourself')}>{this.props.signals[this.props.user.uid].vote_count}</button>
                            <span className="user_name">(Yours)</span>
            			</td></tbody></table></div>;
        }

        if (keys.length <= 0 && !my_signal) {
            return (<div>
                    <span>No signals to vote on.</span><br/>
                    <span>Click "Write" to submit.</span>
                    </div>);
        }
        if (keys.length <= 0 && my_signal) {
            return (<div className='signals'>
                    {my_signal}
                    <br/><span>Wait for additional signals to begin voting.</span>
                    </div>
                   );
        }
        // else
		return (
			<div className='signals'>
                {my_signal}
                <FlipMove
                    staggerDurationBy="30"
                    duration={500}
                    enterAnimation='accordianVertical'
                    leaveAnimation='accordianVertical'
                    >
				{
                    //Object.keys(this.props.signals).map((signal_key) => {
                    //keys.slice(0,config.voter.show_n_signals).map(
                    keys.slice(0,config.voter.show_n_signals).map(
                        (signal_key) => {
                        console.log('Voter render - signal_key', signal_key);
                        var this_class_name = 'signal';
                        if (this.props.user.uid === signal_key)
                            this_class_name += ' my_signal';
                        if (this.props.votes[this.props.user.uid] &&
                            this.props.votes[this.props.user.uid] === signal_key)
                            this_class_name += ' myVote';

                        // var __this = this;
                        // var vote_count = Object.keys(this.props.votes).filter(
                        //                   function(key){
                        //                       return __this.props.votes[key] == signal_key;
                        //                   }).length;
                        // var vote_count = Object.values(this.props.votes).filter(
                        //                   function(v){
                        //                        return v == signal_key;
                        //                   }).length;
                        console.log('Voter render - vote_count', this.props.signals[signal_key].vote_count);

						return (
							<Signal
                                this_class_name={this_class_name}
                                voter={this.props.user}
								key={signal_key}
                                signal={this.props.signals[signal_key]}
                                update_state_signal={this.props.update_state_signal}
                                update_state_vote={this.props.update_state_vote}
							/>
						);
					})
				}
            </FlipMove>
			</div>
		);
	}
});


var App = React.createClass({
	getInitialState() {
		return {user: {}, users: [],
                signals:{}, signal: '',
                votes: {}, group_mode: false,
                epoch: config.epoch,
                selected_tab: config.default_tab ? config.default_tab : 0 };
	},

	componentDidMount() {
		socket.on('init', this._initialize);
        socket.on('send:signal', this._signal_recieve);
        socket.on('send:vote', this._vote_recieve);
		socket.on('user:join', this._user_joined);
		socket.on('user:left', this._user_left);
        socket.on('connection', this._on_connection);
        socket.on('admin:command', this._admin_command);
        socket.on('epoch:active_signals', this._epoch_active_signals)
	},
    _on_connection(data) {
        console.log('App._on_connection() - sessionID ' + data.handshake);
    },
	_initialize(data) {
        console.log('App._initialize() - data', data);
		var {users, user, signals, votes, group_mode, epoch, config} = data;
        // save uid in case accidental browser refreshed
        localStorage.uid = user.uid
        if (using_hash_uid)
            window.location.hash=user.uid
        if (signals[user.uid])
            var signal = signals[user.uid].text;
        else
            var signal = '';
		this.setState({users, user: user, signals, signal, votes, group_mode, epoch});
        //console.log('App._initialize() - data.handshake', data.handshake);
        this.signal_order_loop()
	},

	_signal_recieve(data) {
        console.log("App._signal_recieve() - data:\n", data);
        if (this.state.user.uid === data.user.uid) {
            console.log('_signal_recieve', 'self. skip');
            return;
        }
		var {signals} = this.state;
        if (!signals[data.user.uid] || signals[data.user.uid] !== data) {
		    signals[data.user.uid] = data;
		    this.setState({signals});
        }
        console.log('App._signal_recieve() debug state', this.state);
        console.log('App._signal_recieve() debug data', data);
	},
    _vote_recieve(data) {
        console.log("App._vote_recieve() - data:\n", data);
        var {votes} = this.state;
        // only change state when vote is new
        if (!votes[data.voter] || votes[data.voter] !== data.signal) {
            console.log("App._vote_recieve() - set_state");
            votes[data.voter] = data.signal;
            this.setState({votes});
        }
    },
	_user_joined(data) {
        console.log('App.user_joined()')
        console.log('App.user_joined() - data', data)
		var {users, signals} = this.state;
		var {user} = data;
        if (this.state.user.uid === data.user.uid) {
            console.log('App._user_joined()', 'self. skip');
            return;
        }
		users[user.uid] = user;
        if (config.voter.show_joined_messages) {
            signals['###Server'] = {
    			user: {uid: '###Server', name: 'Server'},
    			text : user.name +' Joined'
    		};
            if (config.voter.show_joined_messages_timeout) {
                window.setTimeout(function(){
                    var signals=this.state.signals;
                    if (signals['###Server']) {
                        delete signals['###Server'];
                        this.setState({signals});
                    }
                }.bind(this), config.voter.show_joined_messages_timeout);
            }
        }
		this.setState({users, signals});
	},

	_user_left(data) {
        console.log('App.user_left()')
        if (!data.uid)
            return
        console.log('App.user_left() - data', data)

		var {users, signals} = this.state;
        var {user} = data;
        if (config.voter.show_joined_messages) {
            signals['Server'] = {
                user: {uid:'###Server', name: 'Server'},
                text : user.name +' Joined'
    		};
            if (config.voter.show_left_messages_timeout) {
                window.setTimeout(function(){
                    var signals=this.state.signals;
                    if (signals['###Server']) {
                        delete signals['###Server'];
                        this.setState({signals});
                    }
                }.bind(this), config.voter.show_left_messages_timeout);
            }

        }
        delete users[user.uid];
		this.setState({users, signals});
	},

    update_state_signal(value) {
        console.log("App.update_state_signal() - value:", value);
        // get rid of \n and .
        // set Writer value and change to Writer tab:
        value =  value.replace(/\n|\./g,'');
        localStorage.signal = value
        this.setState({ signal: value, selected_tab: 0 });
    },
    update_state_vote(voter_uid, signal_uid) {
        console.log("App.update_state_votes() - votes:", votes);
        var {votes} = this.state;
        // only if new value
        if (votes[voter_uid] != signal_uid) {
            votes[voter_uid] = signal_uid;
            this.setState({ votes });
        }
    },
    handle_writer_signal_field_changed(value) {
        console.log('App.handle_writer_signal_field_changed() - value', value);
        var {user, signals} = this.state;
        // on change if last char is . or \n change to voting tab
        // catch common phone period after double space bar
        if (value.slice(-1) == "\n" || value.match(/\. *$/g) !== null) {
            this.setState({selected_tab: 1})
        }
        value =  value.replace(/\n|\./g,'');
        signals[user.uid] = {user: user, text: value};
        this.setState({ signal: value, signals});
    },
    _admin_command(command) {
        console.log('App._admin_command() - data', command);
        if (command.method == 'set_state') {
            if (command.state == 'group_mode') {
                var {group_mode} = this.state;
                group_mode = command.value;
                this.setState({group_mode});
                console.log('App._admin_command() - state', this.state);
            }
        }
        else
        if (command.method == 'reload_page') {
            window.location.reload(false);
        }
    },
    signal_order_loop() {
        console.log('App.signal_order_loop()')
        if (signal_order_timer)
            window.clearTimeout(signal_order_timer)
        // setState will cause a render
        // our render calls a function that redefines orders
        // but here we tell it the things we want reset
        current_latest = undefined
        current_random = undefined
        current_latest2 = undefined
        current_random2 = undefined
        var _this = this;
        signal_order_timer = window.setTimeout(function(){
            this.setState(this.state)
            this.signal_order_loop()
        }.bind(this),config.voter.reorder_wait_time*1000)
    },
    // called when epoch has ended. server sends chosen signals
    _epoch_active_signals(active_signals) {
        console.log('App._epoch_active_signals() - active_signals', active_signals)
        var {user, signals, votes} = this.state;

        // setup certain signal list constants:
        current_neighbor = votes[user.uid]
        // console.log('App._epoch_active_signals() - current_neighbor, uid', active_signals, user.uid)

        // restart list change timer for random and latest
        this.signal_order_loop()

        // TODO Show message to the user when it was their signal that won
        if (active_signals.a.user && active_signals.a.user.uid) {
            console.log('App._epoch_active_signals - a key', active_signals.a.user.uid, user.uid)
            delete signals[active_signals.a.user.uid] //.text = ''
            Object.keys(votes).forEach((k) => {
                if (votes[k] == active_signals.a.user.uid)
                    delete votes[k] })
            this.setState({signals,votes})
            if (active_signals.a.user.uid == user.uid) {
                console.log('App._epoch_active_signals is us',config.epoch.winner_switches_to_write_tab)
                if (config.epoch.winner_switches_to_write_tab)
                    this.setState({signal: '',                 selected_tab: 0 })
                else
                    this.setState({signal: ''})
            }
        }
        if (active_signals.b.user && active_signals.b.user.uid) {
            console.log('App._epoch_active_signals - b key', active_signals.b.user.uid, user.uid)
            delete signals[active_signals.b.user.uid] //.text = ''
            Object.keys(votes).forEach((k) => {
                if (votes[k] == active_signals.b.user.uid)
                    delete votes[k] })
            this.setState({signals, votes})
            if (active_signals.b.user.uid == user.uid) {
                console.log('App._epoch_active_signals is us',config.epoch.winner_switches_to_write_tab)
                if (config.epoch.winner_switches_to_write_tab)
                    this.setState({signal: '',                 selected_tab: 0 })
                else
                    this.setState({signal: '',                 selected_tab: 0 })
            }
        }
    },
    on_tab_select (selected_tab,last) {
        var {user} = this.state
        this.setState({ selected_tab });
        // remove \n and .
        if (selected_tab == 0) {
            var {signal, signals} = this.state;
            // if (signals[user.uid].text.slice(-1) == "\n" || signals[user.uid].text.match(/\. *$/g) !== null) {
            //     signals[user.uid].text.replace(/\n/g).replace(/\./g);
            if (signal.slice(-1) == "\n" || signal.match(/\. *$/g) !== null) {
                signal = signal.replace(/\n/g,'').replace(/\./g,'');
                    this.setState({signal});
            }
        }

    },
	render() {
        // if in group mode add group css class to root signal div
        var divClass = 'first_container';
        if (this.state.group_mode) {
            divClass += ' signals_group_'+this.state.user.gid;
            document.body.className = 'signals_group_'+this.state.user.gid;
        }
        else {
            document.body.className = '';
        }
		return (
			<div className={divClass}>
                {/* <Tabs selectedIndex={this.state.selected_tab}
                      onSelect={selected_tab => this.setState({ selected_tab })} > */}
                  <Tabs selectedIndex={this.state.selected_tab}
                        onSelect={this.on_tab_select} >
    				<TabList>
    					<Tab>Write</Tab>
    					<Tab>Vote</Tab>
    				</TabList>
                    <TabPanel>
                        <Writer
                            user={this.state.user}
                            signal={this.state.signal}
                            handle_writer_signal_field_changed={this.handle_writer_signal_field_changed} />
                        {/* <span className="userUID">({this.state.user.uid})</span> */}
                    </TabPanel>
                    <TabPanel>
                        <Voter
                            user={this.state.user}
                            votes={this.state.votes}
                            signals={this.state.signals}
                            update_state_signal={this.update_state_signal}
                            update_state_vote={this.update_state_vote}
                            group_mode={this.state.group_mode} />
                    </TabPanel>
                </Tabs>
			</div>
		);
	}
});

//React.render(<App/>, document.getElementById('app'));
ReactDOM.render(<App/>, document.getElementById('app'));
