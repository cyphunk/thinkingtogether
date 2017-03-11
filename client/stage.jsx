import React, { Component } from 'react';
import FlipMove from 'react-flip-move';
import ReactDOM from 'react-dom';
import Textarea from 'react-textarea-autosize';
//import ProgressBar from 'react-progress-bar-plus';
import ProgressBar from 'progressbar.js';
var config = require('../config');
var socket = io.connect();

var broadcast_message_timer = null

var progress_bar_a = null
var progress_bar_b = null
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
				style: {
					fontSize: 1, //em
					paddingTop: 2 //em
				}
		}
	},

	componentDidMount() {
		socket.on('init', this._initialize);
        socket.on('send:signal', this._signal_recieve);
        socket.on('send:vote', this._vote_recieve);
        socket.on('connection', this._on_connection);
        socket.on('admin:command', this._admin_command);
		socket.on('admin:stage', this._admin_stage);
		socket.on('admin:stagestyle', this._admin_stage_style);
		socket.on('admin:stagemessage', this._admin_stage_message);
		socket.on('epoch:start', this._epoch_start);
		socket.on('epoch:config', this._epoch_config);
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
        console.log('App._initialize - data', data, data.stage.group_side_by_side);
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
        if (command.method == 'set_config') {
            config = command.value
			if (command.value.stage) {
				var stage = command.value.stage
				this.setState({stage})
			}
			this.forceUpdate() // BRUSSELS
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
		config.stage = data;
        this.setState({ stage });
        console.log('App._admin_command - state.stage post set_state', this.state.stage);
    },
	_admin_stage_style(data) {
        console.log('App._admin_stage_style()');
		console.log('App._admin_stage_style - data', data);
		var {style} = this.state;
		if (data.command == 'font plus')
				style.fontSize += 0.1
		else if (data.command == 'font minus')
				style.fontSize -= 0.1
		else if (data.command == 'padding plus')
				style.paddingTop += 0.1
		else if (data.command == 'padding minus')
				style.paddingTop -= 0.1
		var container = document.getElementById('app')
		container.style.fontSize = style.fontSize +'em'
		container.style.paddingTop = style.paddingTop +'em'
        this.setState({ style });
    },
	_admin_stage_message(data) {
		console.log('App._admin_stage_message()');
		console.log('App._admin_stage_message - data', data);
		var message = data.message
		if (broadcast_message_timer)
			window.clearTimeout(broadcast_message_timer)
		var elem = document.getElementById('broadcast_message')
		elem.innerHTML = message;
		elem.style.display = 'flex' //flex
		broadcast_message_timer = window.setTimeout(function(){
			document.getElementById('broadcast_message').style.display='none'
		}, config.stage.show_message_for_n_sec*1000)

	},
	_epoch_start(new_progress) {
		console.log('App.epoch_start()');
		var {progress, epoch_timer, epoch, group_mode} =  this.state;
		console.log('App.epoch_start - new progress', new_progress);
		progress = new_progress
		// if (epoch_timer)
		// 	window.clearTimeout(epoch_timer);
		// epoch_timer = window.setTimeout(this.epoch_run_on_end,
		// 				(epoch.seed_length+1)*1000);
		// this.setState({progress, epoch_timer});
		this.setState({progress});
		// new method
		progress_bar_a = document.getElementById('progress_bar_a')
		progress_bar_a.innerHTML = ''
		progress_bar_a = new ProgressBar.Line('#progress_bar_a', {
		    strokeWidth: 2,
			color: '#99f'
		});
		progress_bar_a.animate(1, { duration: progress.intervalTime*100, }, function(){
			console.log('progress_bar_a finished')
		});
		if (group_mode) {
			progress_bar_b = document.getElementById('progress_bar_b')
			progress_bar_b.innerHTML = ''
			progress_bar_b = new ProgressBar.Line('#progress_bar_b', {
			    strokeWidth: 2,
				color: '#f99'
			});
			progress_bar_b.animate(1, {duration: progress.intervalTime*100}, function(){
				console.log('progress_bar_b finished')
			});
		}
		// sound during seeding
		if (config.epoch.sound_on_seeding) {
			var sound = document.getElementById('epoch_seeding_sound')

			if (sound.currentTime > config.epoch.sound_on_seeding_subtract_each_play+1)
				sound.currentTime = sound.currentTime - config.epoch.sound_on_seeding_subtract_each_play
			sound.play()
			window.setTimeout(function(){
				console.log('stop seeding sound')
				document.getElementById('epoch_seeding_sound').pause()
			},(progress.intervalTime*100)) // -100 so other sound has time to spin up
		}
  	},
	_epoch_config(data) {
		console.log('App._epoch_config() - data', data);
		config.epoch = data
		// noticed that render wasnt happening when the require_min_votes changed
		// here we force a render. if this causes issues, maybe add test to only
		// re-render when require_min_votes changed
		this.forceUpdate()
	},
	_epoch_stop_progress() {
		console.log('App.epoch_stop_progress()');
		progress_bar_a = document.getElementById('progress_bar_a')
		progress_bar_a.innerHTML = ''
		if (this.state.group_mode) {
			progress_bar_b = document.getElementById('progress_bar_b')
			progress_bar_b.innerHTML = ''
		}
		var progress = {
			percent: -1,
			autoIncrement: false,
			intervalTime: 0
		}
		this.setState({ progress })
		// sound during seeding
		if (config.epoch.sound_on_seeding)
			document.getElementById('epoch_seeding_sound').pause()
	},
	_epoch_active_signals(new_active_signals) {
		console.log('App._epoch_active_signals()');
		console.log('App._epoch_active_signals - new active signals', new_active_signals);
		// get highest vote for group
		var {signals, active_signals, votes} = this.state
		if (new_active_signals.config.sound_on_signal_chosen) {
			if (active_signals.a.text != new_active_signals.a.text) {
				document.getElementById('epoch_sound').play()
			}
			else
			if (this.state.group_mode &&
				active_signals.b.text != new_active_signals.b.text) {
					document.getElementById('epoch_sound').play()
				}
		}


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
		// clear votes?
		// shall we delete votes before next epoch
		if (active_signals.config.clear_votes_on_epoch) {
			this.setState({votes: {}})
		}
		if (active_signals.config.clear_signals_on_epoch) {
			this.setState({signals: {}})
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
		// BRUSSELS (first show latest first before checking votes)
		if ( !config.voter.enabled )
			var sorted = keys.reverse()
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
			// console.log('config>', config.epoch.require_min_votes, signal.vote_count)
			// BUGBUG TODO: Fuck I dont know but still some signals without proper threshold show up
			if (config.epoch.require_min_votes &&
				config.epoch.require_min_votes > 0 &&
				signal.vote_count < config.epoch.require_min_votes)
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
		var progress_bar_id = 'progress_bar_'+gid
        return (
            <FlipMove
                staggerDurationBy="30"
                duration={500}
                enterAnimation='accordianVertical'
                leaveAnimation='accordianVertical'
                >
					<div key="active" className="signal active_signal">
							 {/*<ProgressBar percent={this.state.progress.percent}
											  autoIncrement={this.state.progress.autoIncrement}
											  intervalTime={this.state.progress.intervalTime}
											  />*/}
							 <span className="signal_text">{this.state.active_signals[gid].text}</span>
							 <span className="user_name">{this.state.active_signals[gid].user.name}</span>
							 <div id={progress_bar_id} className="react-progress-bar"></div>
					</div>
                    {
                        this.state.stage.show_signal_activity &&
						 keys.slice(0,this.state.stage.show_n_signals).map(
							(key, index) => {

							var class_name = 'signal'
							if (index == 0) {
								class_name += ' first_signal';
							}
							var votes_elem = null;
							if (config.stage.show_vote_count)
								votes_elem = <span className="vote_count">{this.state.signals[key].vote_count}</span>;
							else

                            return (<div className={class_name} key={key}>
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
        // if in group mode add group css class to root signal div
        if (!this.state.group_mode) {
            return (
                <div className="signals">
                {signal_group_a}
				<audio ref="epoch_sound" id="epoch_sound" src={config.epoch.sound_on_signal_chosen_uri}   />
				<audio ref="epoch_seeding_sound" id="epoch_seeding_sound" src={config.epoch.sound_on_seeding_uri} loop />
				<div id="broadcast_message" style={{display: "none"}}></div>
				</div>
			);
        }
        else {
			var groupAClass="signals group_a"
			var groupBClass="signals group_b"
			if (this.state.stage.group_side_by_side) {
				groupAClass+=" float_left"
				groupBClass+=" float_right"
			}
			if (this.state.stage.show_in_chat_bubbles) {
				groupAClass+=" chat_bubble"
				groupBClass+=" chat_bubble"
			}

            return (
				<div>
	                <div className={groupAClass}>
	                	{signal_group_a}
	                </div>
					<div className={groupBClass}>
	                	{signal_group_b}
	                </div>
					<audio ref="epoch_sound" id="epoch_sound" src={config.epoch.sound_on_signal_chosen_uri}  />
					<audio ref="epoch_seeding_sound" id="epoch_seeding_sound" src={config.epoch.sound_on_seeding_uri}  loop />
					<div id="broadcast_message" style={{display: "none"}}></div>
				</div>
			);

        }
	}
});

ReactDOM.render(<App/>, document.getElementById('app'));
