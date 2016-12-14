var config = {}
config.server = {}
config.writer = {}
config.voter = {}
config.stage = {}
config.epoch = {}
config.admin = {}

config.server.port = 8080
config.server.mode = 'production'  //NODE_ENV production or development
config.server.load_data_files = false // load .data/*.json on start?

// if server.reject_empty_signal is true AND writer.send_live_input is true you can wind up with
// entries with just one character
config.server.reject_empty_signal = false
// if one of the submits is not selected and send_live_input is false then nothing
// will show up in the voter. So one of the following 3 should be true, at least
config.default_tab = 1  // change to determine default tab 0 = writer, 1 = voter
config.writer.send_live_input = false
config.writer.submit_on_linebreak = true
config.writer.submit_on_period = true
config.writer.max_chars = 140
config.voter.show_joined_messages = false
config.voter.prevent_vote_self = true
config.voter.min_signal_length = 1  // 0 to show empty. 1 to allow char only. 3etc for forcing sentences
config.stage.opacity_step = 0.0  // dec opacity on signal list by this much with Signal on top starting at 1.0
config.stage.show_signal_activity = true  // false means only the current signal is shown
// for stage and voter:
// on bang signals state will be cleared
config.epoch.wait_for_bang_to_start = true  // false then just go
config.epoch.seed_length = 10  // time to vote
config.epoch.pause_length = 15  // time before voter faded in
config.epoch.pause_forced = false  // when true client interface fade out all but count down
// config.epoch.pause_show_progress = true  // show progress cont down
config.epoch.start_new_epoch_after_pause = false  // if false forces admin bang.
config.epoch.winner_switches_to_write_tab = true  // if true then whoever wens an epoch will be switched to the writer tab in their ui
module.exports = config
