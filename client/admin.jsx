'use strict';

// set has to turn on some debug features

import React, { Component } from 'react';
import ReactDOM from 'react-dom';
import config from '../config';

var socket = io.connect({query: 'hash=admin' });

var App = React.createClass({
	getInitialState() {
		return {
			group_mode: false,
			password: localStorage.password ? localStorage.password : '',
			epoch: config.epoch,
			config: config

		};
	},
    componentDidMount() {
		socket.on('init', this._initialize);
        socket.on('connection', this._on_connection);
        socket.on('error:message', this._error);
	},
    _on_connection(data) {
        console.log('App._on_connection() - sessionID ' + data.handshake);
    },
	_initialize(data) {
        console.log('App._initialize() - data', data);
		var {group_mode, config} = data;
		this.setState({group_mode, config});
	},
    _error(data) {
        console.log("App._error() - message", data);
        alert("server error:\n"+data.message);
    },
	toggle_group_mode(){
        console.log("App.toggle_group_mode()");
        var {group_mode, password} = this.state;
        group_mode = !group_mode;
        socket.emit('admin:command', {
            password: password,
            command: {
                method: 'set_state',
                state: 'group_mode',
                value: group_mode
            }
        });
        this.setState({group_mode});
    },
	toggle_debug_mode(){
        console.log("App.toggle_debug_mode()");
        var {config, password} = this.state;
        config.debug = !config.debug;
        socket.emit('admin:command', {
            password: password,
            command: {
                method: 'set_config',
                value: config
            }
        });
        this.setState({config});
    },
	reset_session(){
        // var password = location.hash.slice(location.hash.indexOf('#')+1);
        console.log("App.reset_session()");
        var {password} = this.state;
        socket.emit('admin:command', {
            password: password,
            command: {
                method: 'reset_session',
            }
        });
    },
	change_password(e) {
        localStorage.password = e.target.value;
        this.setState({ password : e.target.value });
    },
	stage_change_opacity(e) {
        var {config, password} = this.state;
		config.stage.opacity_step = e.target.value;
        this.setState({ config });
		if (!isNaN(e.target.value)) {
			socket.emit('admin:stage', {password: password, stage: config.stage})
		}
    },
	stage_toggle_show_signal_activity(){
        console.log("App.stage_toggle_show_signal_activity()");
		var {config, password} = this.state;
        config.stage.show_signal_activity = !config.stage.show_signal_activity;
        this.setState({config});
		socket.emit('admin:stage', {password: password, stage: config.stage})
    },
	stage_toggle_side_by_side(){
        console.log("App.stage_toggle_side_by_side()");
		var {config, password} = this.state;
        config.stage.group_side_by_side = !config.stage.group_side_by_side;
        this.setState({config});
		socket.emit('admin:stage', {password: password, stage: config.stage})
    },
	active_signals_clear(){
		var {password} = this.state;
		socket.emit('admin:epoch', {password: password, active_signals_clear: true})
    },
	handle_epoch_submit(e) {
		console.log('App.handle_epoch_submit');
		var {config, password} = this.state;
		config.epoch.wait_for_bang_to_start = this.wait_for_bang_to_start.checked;
		config.epoch.seed_length = parseFloat(this.seed_length.value);
		config.epoch.pause_length = parseFloat(this.pause_length.value);
		config.epoch.start_new_epoch_after_pause = this.start_new_epoch_after_pause.checked;
		this.setState({ config });
		socket.emit('admin:epoch', {password: password, epoch: config.epoch});
	},
	handle_epoch_bang(e) {
		console.log('App.handle_epoch_bang');
		socket.emit('admin:epoch', {password: this.state.password, epoch: {start: true}} );
	},
	render() {
		return (
			<div>
                <input
                    type="text"
                    placeholder="enter admin password"
                    value={this.state.password}
                    onChange={this.change_password} size="30"/>
					<br/>
					<br/>
				<table><tbody>
				<tr>
					<td></td><th><span>Global</span></th>
				</tr><tr>
					<td><button onClick={this.toggle_group_mode}>toggle</button></td>
					<td><span>group mode (is now {this.state.group_mode ? 'ON' : 'OFF'})</span></td>
				</tr><tr>
					<td><button onClick={this.reset_session}>Reset</button></td>
					<td><span>Restart the entire show</span></td>
				</tr><tr>
					<td></td><th><span>Stage</span></th>
				</tr><tr>
					<td><button onClick={this.stage_toggle_show_signal_activity}>toggle</button></td>
					<td><span>show signal activity (is now {this.state.config.stage.show_signal_activity ? 'ON' : 'OFF'})</span></td>
				</tr><tr>
					<td><button onClick={this.stage_toggle_side_by_side}>toggle</button></td>
					<td><span>show groups side by side (is now {this.state.config.stage.group_side_by_side ? 'ON' : 'OFF'})</span></td>
				</tr><tr>
					<td></td><th><span>Epoch</span></th>
				</tr><tr>
								<td>
									<input type="checkbox"
										   defaultChecked={this.state.config.epoch.wait_for_bang_to_start}
										   ref={(i) => this.wait_for_bang_to_start = i}
									   	   onChange={this.handle_epoch_submit} />
									   </td>
								<td><span>Require "Start" button use to start</span></td>
							</tr><tr>
								  <td><input type="text" size="4"
									   defaultValue={this.state.config.epoch.seed_length}
									   ref={(i) => this.seed_length = i}
								       onBlur={this.handle_epoch_submit} /></td>
						    	  <td><span>Seed length (seconds)</span></td>
							</tr><tr>
								  <td><input type="text" size="4"
										 defaultValue={this.state.config.epoch.pause_length}
										 ref={(i) => this.pause_length = i}
									     onBlur={this.handle_epoch_submit}
									     /></td>
								  <td><span>Pause length</span></td>
							</tr><tr>
								  <td><input type="checkbox"
								  		 defaultChecked={this.state.config.epoch.start_new_epoch_after_pause}
										 ref={(i) => this.start_new_epoch_after_pause = i}
									     onChange={this.handle_epoch_submit} /></td>
								  <td><span>Start next epoch directly after pause ends</span></td>
							</tr><tr>
								  <td></td><td><button onClick={this.handle_epoch_bang}>Start Epoch</button></td>
						  </tr><tr>
								  <td></td><td><button onClick={this.active_signals_clear}>Clear active signals</button>
								  </td>
							</tr>
			</tbody></table>
			<div id='advanced_toggle'>
			<span onClick={function(e) {document.getElementById('advanced').style.display = 'block'}}>+</span>
			<span onClick={function(e) {document.getElementById('advanced').style.display = 'none'}}>-</span>
			</div>
			<div id='advanced'>Advanced options:<br/><button onClick={this.toggle_debug_mode}>toggle</button><br/>
			<span>debug mode (is now {this.state.config.debug ? 'ON' : 'OFF'})</span></div>
		    </div>
		);
	}
});
ReactDOM.render(<App/>, document.getElementById('app'));
