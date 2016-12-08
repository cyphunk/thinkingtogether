import React, { Component } from 'react';
import FlipMove from 'react-flip-move';
import ReactDOM from 'react-dom';
import Textarea from 'react-textarea-autosize';
import ProgressBar from 'react-progress-bar-plus';

import config from '../config';
var socket = io.connect();

var App = React.createClass({
	getInitialState() {
		return {user: {}, users: [],
                signals:{},
                votes: {}, group_mode: false,
                stage: config.stage,
				active_signals: {
					a: {text: '', username:''},
					b: {text: '', username:''}
				},
				progress: {
					percent: -1,
					autoIncrement: false,
					intervalTime: 0
				},
				epoch: config.epoch,
				epoch_timer: null,
				pause_timer: null
		}
	},

	componentDidMount() {
		socket.on('init', this._initialize);
        socket.on('send:signal', this._signal_recieve);
        socket.on('send:vote', this._vote_recieve);
        socket.on('connection', this._on_connection);
        socket.on('admin:command', this._admin_command);
        socket.on('admin:stage', this._admin_stage);
        socket.on('admin:epoch', this._admin_epoch);
	},
    _on_connection(data) {
		console.log('App._on_connection()');
        console.log('App._on_connection - data.handshake sessionID', data.handshake);
    },
	_initialize(data) {
		console.log('App._initialize()');
        console.log('App._initialize - data', data);
		// console.log('App._initialize() - data.handshake', data.handshake);
		var {users, user, signals, votes, group_mode, epoch} = data;
		this.setState({users, user: user, signals, votes, group_mode, epoch});
		console.log('App._initialize - state after setState', this.state);
		if (!this.state.epoch.wait_for_bang_to_start) {
			this.epoch_start();
		}
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
			console.log('App._vote_recieve - vote is new. setState');
            votes[data.voter] = data.signal;
            this.setState({votes});
        }
    },

    _admin_command(command) {
		console.log('App._admin_command()');
		console.log('App._admin_command - data', command);
        if (command.method == 'setState') {
            if (command.state == 'group_mode') {
                var {group_mode} = this.state;
                group_mode = command.value;
                this.setState({group_mode});
                console.log('App._admin_command - state', this.state);
            }
        }
    },
    _admin_stage(data) {
        console.log('App._admin_stage()');
		console.log('App._admin_stage - data', data);
        var {stage} = this.state;
        stage = data;
        this.setState({ stage });
        console.log('App._admin_command - state.stage post setState', this.state.stage);
    },
	_admin_epoch(data) {
		console.log('App._admin_epoch()');
		console.log('App._admin_epoch - data', data);
		if (data.start) {
			console.log('App._admin_epoch - is start event');
			this.epoch_start();
		}
		else {
	        var {stage} = this.state;
	        stage = data;
	        this.setState({ stage });
			// TODO ACT ON IT
	        console.log('App._admin_epoch - state.stage post setState', this.state.stage);
		}
    },
    add_vote_count_to_signals(keys) {
		console.log('App.add_vote_count_to_signals()');
        // calculate vote_count and store it in signals
        var signals = this.state.signals;
        var votes = this.state.votes;
        keys.map((key) => {
            var vote_count = Object.values(votes).filter(
                              function(val){
                                   return val == key;
                              }).length;
            signals[key].vote_count = vote_count;
        });
        console.log('App.add_vote_count_to_signals - signals after vote_count added', signals);
        // BUG TODO : DO we need to call setState ?
    },
    organize_signal_keys(keys) {
		console.log('App.organize_signal_keys()');
        var signals = this.state.signals;
        var user = this.state.user;
        var group_mode = this.state.group_mode;
        // console.log('Voter.organize_signal_keys - keys', keys);
        // remove our key/uid from list if it is there
        if (keys.indexOf(user.uid)>=0)
            keys.splice(keys.indexOf(user.uid),1);
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
							 <span className="user_name">{this.state.active_signals[gid].username}</span>
					</div>
                    {
                        keys.map((key, index) => {
                            if (next_opacity <= this.state.stage.opacity_step)
							 	next_opacity = 0.0;
							else
							 	next_opacity -= this.state.stage.opacity_step;

							var class_name = 'signal'
							if (index == 0) {
								class_name += ' first_signal';
							}
                            return (<div className={class_name} key={key} style={{opacity: next_opacity}}>
                                        <span className="vote_count">{this.state.signals[key].vote_count}</span>
                        				<span className="signal_text">{this.state.signals[key].text}</span>
                                        <span className="user_name">{this.state.signals[key].user.name}</span>
                                    </div>
                                );
                        })
                    }
            </FlipMove>
        );
    },
	epoch_start() {
		console.log('App.epoch_start()');
		var {progress, epoch_timer, epoch} =  this.state;
		console.log('App.epoch_start - time', epoch.seed_length);
		progress.percent = 0;
		progress.autoIncrement = true;
		progress.intervalTime = config.epoch.seed_length*10;
		if (epoch_timer)
			window.clearTimeout(epoch_timer);
		epoch_timer = window.setTimeout(this.epoch_run_on_end,
						(epoch.seed_length+1)*1000);
		this.setState({progress, epoch_timer});
  	},
	epoch_run_on_end() {
		console.log('App.epoch_run_on_end()');
		var {progress} =  this.state;
		progress.percent = -1;
		progress.autoIncrement = false;
		this.setState({progress});
		this.epoch_set_active_signal();
		//
		// TODO remove winner from signals and send out '' signal for that user to
		// rest, including owner
		this.epoch_start_pause();
	},
	epoch_set_active_signal() {
		console.log('App.epoch_set_active_signal()');
		console.log('App.epoch_set_active_signal - signals', this.state.signals);
		// get highest vote for group
		var {signals, active_signals} = this.state
		var signal_keys = Object.keys(this.state.signals);
		var key_groups = this.organize_signal_keys(signal_keys);
		console.log('App.epoch_set_active_signal - keygroups', key_groups.a[0]);

		if (key_groups.a.length > 0) {
			active_signals.a.text  =  signals[key_groups.a[0]].text;
			active_signals.a.username  =  signals[key_groups.a[0]].user.name;
		}
		if (this.state.group_mode && key_groups.b.length > 0) {
			active_signals.b.text  =  signals[key_groups.b[0]].text;
			active_signals.b.username  =  signals[key_groups.b[0]].user.name;
		}
		this.setState({active_signals})
		console.log('App.epoch_set_active_signal - active ', this.state.active_signals);
	},
	epoch_start_pause() {
		console.log('App.epoch_start_pause()');
		var {pause_timer, epoch} = this.state;
		console.log('App.epoch_start_pause - time', epoch.pause_length);
		if (epoch.pause_forced) {
			console.log('App.epoch_start_pause forced - make screens blank');
			// TODO case screens to go blank
		}
		if (pause_timer)
			window.clearTimeout(pause_timer);
		pause_timer = window.setTimeout(this.epoch_run_on_pause_end,
						 epoch.pause_length*1000);
		this.setState({pause_timer});
	},
	epoch_run_on_pause_end() {
		console.log('App.epoch_run_on_pause_end()');
		var {epoch} =  this.state;
		if (epoch.start_new_epoch_after_pause) {
			this.epoch_start();
		}
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
