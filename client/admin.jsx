'use strict';

import React, { Component } from 'react';
import ReactDOM from 'react-dom';
import config from '../config';

var socket = io.connect({query: 'hash=admin' });

var App = React.createClass({
	getInitialState() {
		return {
			group_mode: false,
			password: localStorage.password ? localStorage.password : '',
			stage: config.stage,
			epoch: config.epoch

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
		var {group_mode} = data;
		this.setState({group_mode});
	},
    _error(data) {
        console.log("App._error() - message", data);
        alert("server error:\n"+data.message);
    },
    toggle_group_mode(){
        // var password = location.hash.slice(location.hash.indexOf('#')+1);
        console.log("App.toggle_group_mode() - password", password);
        var {group_mode, password} = this.state;
        group_mode = !group_mode;
        socket.emit('admin:command', {
            password: password,
            command: {
                method: 'setState',
                state: 'group_mode',
                value: group_mode
            }
        });
        this.setState({group_mode});
    },
	change_password(e) {
        localStorage.password = e.target.value;
        this.setState({ password : e.target.value });
    },
	change_opacity(e) {
        var {stage, password} = this.state;
		stage.opacity_step = e.target.value;
        this.setState({ stage });
		if (!isNaN(e.target.value)) {
			socket.emit('admin:stage', {password: password, stage: stage})
		}
    },
	handle_epoch_submit(e) {
		console.log('App.handle_epoch_submit', this.wait_for_bang_to_start.checked);
		e.preventDefault();
		var {epoch, password} = this.state;
		epoch.wait_for_bang_to_start = this.wait_for_bang_to_start.checked;
		epoch.seed_length = parseFloat(this.seed_length.value);
		epoch.pause_length = parseFloat(this.pause_length.value);
		epoch.pause_forced = this.pause_forced.checked;
		// epoch.pause_show_progress = this.pause_show_progress.checked;
		epoch.start_new_epoch_after_pause = this.start_new_epoch_after_pause.checked;
		this.setState({ epoch });
		socket.emit('admin:epoch', {password: password, epoch: epoch});
	},
	handle_epoch_bang(e) {
		console.log('App.handle_epoch_bang');
		socket.emit('admin:epoch', {password: this.state.password, epoch: {start: true}} );
	},
	render() {
        var current_password=location.hash.slice(location.hash.indexOf('#')+1);
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
				</tr><tr>
					<td><button onClick={this.toggle_group_mode}>{this.state.group_mode ? 'true' : 'false'}</button></td>
					<td><span>toggle group mode</span></td>
				</tr><tr>
					<td></td><th><span>Stage</span></th>
				</tr><tr>
				</tr><tr>
					<td><input type="text"
	                    value={this.state.stage.opacity_step}
	                    onChange={this.change_opacity} size="3" /></td>
					<td><span>Stage opacity steps</span></td>
				</tr><tr>
					<td></td><th><span>Epoch</span></th>
				</tr><tr>
								<td>
									<input type="checkbox"
										   defaultChecked={this.state.epoch.wait_for_bang_to_start}
										   ref={(i) => this.wait_for_bang_to_start = i}
									   	   onChange={this.handle_epoch_submit} />
									   </td>
								<td><span>Require "Start" button use to start</span></td>
							</tr><tr>
								  <td><input type="text"
									   defaultValue={this.state.epoch.seed_length}
									   ref={(i) => this.seed_length = i} size="4"
								       onBlur={this.handle_epoch_submit} /></td>
						    	  <td><span>Seed length (seconds)</span></td>
							</tr><tr>
								  <td><input type="text"
										 defaultValue={this.state.epoch.pause_length}
										 ref={(i) => this.pause_length = i} size="4"
									     onBlur={this.handle_epoch_submit}
									     /></td>
								  <td><span>Pause length</span></td>
							</tr><tr>
								  <td><input type="checkbox"
										 defaultValue={this.state.epoch.pause_forced}
										 ref={(i) => this.pause_forced = i}
									     onChange={this.handle_epoch_submit} /></td>
								  <td><span>Pause client UI off during pause</span></td>
							{/* </tr><tr>
								  <td><input type="checkbox"
										 defaultValue={this.state.epoch.pause_show_progress}
										 ref={(i) => this.pause_show_progress = i}
									     onChange={this.handle_epoch_submit} /></td>
								  <td><span>Pause show progess</span></td> */}
							</tr><tr>
								  <td><input type="checkbox"
										 defaultValue={this.state.epoch.start_new_epoch_after_pause}
										 ref={(i) => this.start_new_epoch_after_pause = i}
									     onChange={this.handle_epoch_submit} /></td>
								  <td><span>Start next epoch directly after pause ends</span></td>
							</tr><tr>
								  <td></td><td><button onClick={this.handle_epoch_bang}>Start</button></td>
							</tr>
			</tbody></table>
		    </div>
		);
	}
});
ReactDOM.render(<App/>, document.getElementById('app'));
