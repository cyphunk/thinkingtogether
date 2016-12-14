import React, { Component } from 'react';
import FlipMove from 'react-flip-move';
import ReactDOM from 'react-dom';
import Textarea from 'react-textarea-autosize';
import ProgressBar from 'react-progress-bar-plus';

import config from '../config';
var socket = io.connect();

var App = React.createClass({
	getInitialState() {
		return {
			    users: [],
                signals:{},
                votes: {},
				group_mode: false,
                stage: config.stage,
				active_signals: {
					a: {text: '', user: {uid: null, name: ''}},
					b: {text: '', user: {uid: null, name: ''}}
				},
				progress: {
					percent: -1,
					autoIncrement: false,
					intervalTime: 0
				},
		}
	},

	componentDidMount() {
		socket.on('init', this._initialize);
        socket.on('send:signal', this._signal_recieve);
        socket.on('send:vote', this._vote_recieve);
        socket.on('connection', this._on_connection);
        socket.on('admin:command', this._admin_command);
        socket.on('admin:stage', this._admin_stage);
		socket.on('epoch:start', this._epoch_start);
		socket.on('epoch:stop_progress', this._epoch_stop_progress);
		socket.on('epoch:active_signals', this._epoch_active_signals);
		socket.on('epoch:active_signals_clear', this._epoch_active_signals_clear);
	},
    _on_connection(data) {
		console.log('App._on_connection()');
        console.log('App._on_connection - data.handshake sessionID', data.handshake);
    },
	_initialize(data) {
		console.log('App._initialize()');
        console.log('App._initialize - data', data);
		// console.log('App._initialize() - data.handshake', data.handshake);
		var {users, signals, votes, group_mode, stage, active_signals} = data;
		this.setState({users, signals, votes, group_mode, stage, active_signals});
		console.log('App._initialize - state after set_state', this.state);
	},
	_signal_recieve(data) {
		console.log('App._signal_recieve()');
        console.log('App._signal_recieve - data', data);
		var {signals} = this.state;
        if (!signals[data.user.uid] || signals[data.user.uid] !== data) {
		    signals[data.user.uid] = data;
		    this.setState({signals});
        }
        console.log('App._signal_recieve - debug state', this.state);
        console.log('App._signal_recieve - debug data', data);
	},
    _vote_recieve(data) {
		console.log('App._vote_recieve()');
		console.log('App._vote_recieve - data', data);
        var {votes} = this.state;
        // only change state when vote is new
        if (!votes[data.voter] || votes[data.voter] !== data.signal) {
			console.log('App._vote_recieve - vote is new. set_state');
            votes[data.voter] = data.signal;
            this.setState({votes});
        }
    },
    _admin_command(command) {
		console.log('App._admin_command()');
		console.log('App._admin_command - data', command);
        if (command.method == 'set_state') {
            if (command.state == 'group_mode') {
                var {group_mode} = this.state;
                group_mode = command.value;
                this.setState({group_mode});
                console.log('App._admin_command - state', this.state);
            }
        }
		else
		if (command.method == 'reload_page') {
			window.location.reload(false);
		}
    },
    _admin_stage(data) {
        console.log('App._admin_stage()');
		console.log('App._admin_stage - data', data);
        var {stage} = this.state;
        stage = data;
        this.setState({ stage });
        console.log('App._admin_command - state.stage post set_state', this.state.stage);
    },
	_epoch_start(new_progress) {
		console.log('App.epoch_start()');
		var {progress, epoch_timer, epoch} =  this.state;
		console.log('App.epoch_start - new progress', new_progress);
		progress = new_progress
		// if (epoch_timer)
		// 	window.clearTimeout(epoch_timer);
		// epoch_timer = window.setTimeout(this.epoch_run_on_end,
		// 				(epoch.seed_length+1)*1000);
		// this.setState({progress, epoch_timer});
		this.setState({progress});
  	},
	_epoch_stop_progress() {
		console.log('App.epoch_stop_progress()');
		var progress = {
			percent: -1,
			autoIncrement: false,
			intervalTime: 0
		}
		this.setState({ progress })
	},
	_epoch_active_signals(new_active_signals) {
		console.log('App._epoch_active_signals()');
		console.log('App._epoch_active_signals - new active signals', new_active_signals);
		// get highest vote for group
		var {signals, active_signals, votes} = this.state
		active_signals = new_active_signals
		this.setState({active_signals})
		// clear out
		if (active_signals.a.user) {
			delete signals[active_signals.a.user.uid]//.text = '';
			Object.keys(votes).forEach((k) => {
				if (votes[k] == active_signals.a.user.uid)
					delete votes[k] })
			if (this.state.group_mode && active_signals.b.user) {
				delete signals[active_signals.b.user.uid]//.text = '';
				Object.keys(votes).forEach((k) => {
					if (votes[k] == active_signals.b.user.uid)
						delete votes[k] })
			}
			this.setState({signals, votes})
		}

		// TODO BUG BUG
		// This could cause serious issues if there is more than one /stage up

	},
	_epoch_active_signals_clear() {
		console.log('App._epoch_active_signals_clear()');
		// get highest vote for group
		var active_signals = { a: {text: '', user: {uid: null, name: ''}},
		  					   b: {text: '', user: {uid: null, name: ''}} }
		this.setState({active_signals})
	},
    add_vote_count_to_signals(keys) {
		console.log('App.add_vote_count_to_signals()');
        // calculate vote_count and store it in signals
        var signals = this.state.signals;
        var votes = this.state.votes;
        keys.map((key) => {
            var vote_count = Object.keys(votes).filter(
                              function(val){
                                   return votes[val] == key;
                              }).length;
            signals[key].vote_count = vote_count;
        });
        console.log('App.add_vote_count_to_signals - signals after vote_count added', signals);
        // BUG TODO : DO we need to call set_state ?
    },
    organize_signal_keys(keys) {
		console.log('App.organize_signal_keys()');
        var signals = this.state.signals;
        var user = this.state.user;
        var group_mode = this.state.group_mode;
        // console.log('Voter.organize_signal_keys - without own', keys);
        // sort by votes
        var sorted = keys.sort(function(a,b) {
            // lowest first, to highest end
            //return signals[a].vote_count - signals[b].vote_count;
            // highest first, to lowest end
            return signals[b].vote_count - signals[a].vote_count;
        });
        // console.log('Voter.organize_signal_keys - keys sorted by vote_count', sorted);
        // put into groups if group_mode is true
        // if in group_mode split into a/b. Else everything into a
        // Also, remove empty if config says so
        var groups = {a: [], b: []};
        sorted.map((key) => {
            var signal = signals[key];
            if (signal.text.length < config.voter.min_signal_length)
                return;
            // console.log('Voter.organize_signal_keys key,gid', key, signal.user.gid)
            if (group_mode && signal.user.gid == 'b')
                groups.b.push(key)
            else
                groups.a.push(key)
        });
        // console.log('Voter.organize_signal_keys - groups', groups);
        return groups;
    },
    render_signals(keys, gid) {
		console.log('App.render_signals()');
		if (gid != 'b')
		 	gid = 'a';
		// console.log('App.render_signals - active', this.state.active_signals[gid]);
		var next_opacity = 1.0;
        return (
            <FlipMove
                staggerDurationBy="30"
                duration={500}
                enterAnimation='accordianVertical'
                leaveAnimation='accordianVertical'
                >
					<div key="active" className="signal active_signal">
							 <ProgressBar percent={this.state.progress.percent}
											  autoIncrement={this.state.progress.autoIncrement}
											  intervalTime={this.state.progress.intervalTime}
											  />
							 <span className="vote_count"></span>
							 <span className="signal_text">{this.state.active_signals[gid].text}</span>
							 <span className="user_name">{this.state.active_signals[gid].user.name}</span>
					</div>
                    {
                        this.state.stage.show_signal_activity && keys.map((key, index) => {
                            if (next_opacity <= this.state.stage.opacity_step)
							 	next_opacity = 0.0;
							else
							 	next_opacity -= this.state.stage.opacity_step;

							var class_name = 'signal'
							if (index == 0) {
								class_name += ' first_signal';
							}
							var votes_elem = null;
							if (config.stage.show_vote_count)
								votes_elem = <span className="vote_count">{this.state.signals[key].vote_count}</span>;
							else

                            return (<div className={class_name} key={key} style={{opacity: next_opacity}}>
										{votes_elem}
                        				<span className="signal_text">{this.state.signals[key].text}</span>
                                        <span className="user_name">{this.state.signals[key].user.name}</span>
                                    </div>
                                );
                        })
                    }
            </FlipMove>
        );
    },
	render() {
		console.log('App.render()');
        var signal_keys = Object.keys(this.state.signals);
        // add vote_count to signals[]
        this.add_vote_count_to_signals(signal_keys)
        // sort keys by votes and groups
        var key_groups = this.organize_signal_keys(signal_keys);
        console.log('App.render - key_groups', key_groups);
        var signal_group_a = this.render_signals(key_groups.a);
        if (this.state.group_mode)
            var signal_group_b = this.render_signals(key_groups.b, 'b');
		var signalsClassName = "signals"
        // if in group mode add group css class to root signal div
        if (!this.state.group_mode) {
            return (

                <div className="signals">

                {signal_group_a}
			</div>
			);
        }
        else {
            return (
				<div>

	                <div className="signals group_a">
	                	{signal_group_a}
	                </div>
					<div className="signals group_b">
	                	{signal_group_b}
	                </div>
				</div>
			);

        }
	}
});

ReactDOM.render(<App/>, document.getElementById('app'));
