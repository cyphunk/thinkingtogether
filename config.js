var config = {}
config.server = {}
config.writer = {}
config.voter = {}
config.stage = {}
config.epoch = {}
config.admin = {}
config.debug = false // set to true to turn on client debuggin. use ctrl+d for server

//config.server.port = 8080
config.server.port = 8081
config.server.mode = 'production'  //NODE_ENV production or development
config.server.load_data_files = false // load .data/*.json on start?

// if server.reject_empty_signal is true AND writer.send_live_input is true you can wind up with
// entries with just one character
config.server.reject_empty_signal = false


config.default_tab = 0  // 0=BRUSSELS. change to determine default tab 0 = writer, 1 = voter
// if one of the submits is not selected and send_live_input is false then nothing
// will show up in the voter. So one of the following 3 should be true, at least
config.writer.send_live_input = false // clients send as they type?
// config.writer.submit_on_linebreak = true
config.writer.submit_on_linebreak = false // BRUSSELS
// config.writer.submit_on_period = true
config.writer.submit_on_period = false // BRUSSELS
// config.writer.max_chars = 140
config.writer.max_chars = 300 // BRUSSELS

config.writer.show_submit_button = true // true=BRUSSELS
config.writer.writer_show_thankyou = true // true=FRASCATI2

config.voter.show_joined_messages = false
config.voter.prevent_vote_self = true
config.voter.min_signal_length = 1  // len chars. 0 to show empty. 1 to allow char only. 3etc for forcing sentences
config.voter.show_n_signals = 5 //
config.voter.reorder_wait_time = 7 //
config.voter.enabled = true // false=BRUSSELS. if false the vote tab isnt shown
// attempt at fixing the glitchy update issue? FRASCATI2
config.voter.update_list_ever_n_milseconds = 7000;

config.stage.show_signal_activity = true  // false means only the current signal is shown
config.stage.show_vote_count = false
config.stage.show_n_signals = 10 // if you want all of them, idk, set to 9999
// for stage and voter:
// on bang signals state will be cleared
config.stage.group_side_by_side = true; // adds float left css
config.stage.show_in_chat_bubbles = false; // adds chatbubble css
config.stage.show_message_for_n_sec = 30;

config.epoch.a = {}
config.epoch.a.wait_for_bang_to_start = true  // false then just go
config.epoch.a.seed_length = 15  // time to vote
config.epoch.a.pause_length = 2  // time before voter faded in
config.epoch.a.start_new_epoch_after_pause = false    // if false forces admin bang.

config.epoch.b = {}
config.epoch.b.wait_for_bang_to_start = config.epoch.a.wait_for_bang_to_start
config.epoch.b.seed_length = config.epoch.a.seed_length
config.epoch.b.pause_length = config.epoch.a.pause_length
config.epoch.b.start_new_epoch_after_pause = config.epoch.a.start_new_epoch_after_pause

config.epoch.pause_forced = false  // when true client interface fade out all but count down
// config.epoch.pause_show_progress = true  // show progress cont down
config.epoch.winner_switches_to_write_tab = true  // if true then whoever wens an epoch will be switched to the writer tab in their ui
config.epoch.delete_winner = true
config.epoch.require_min_votes = 0 // 0=BRUSSELS. set to 0 for no limit
config.epoch.clear_votes_on_epoch = true
config.epoch.clear_signals_on_epoch = false; // false=BRUSSELS
config.epoch.sound_on_signal_chosen = true // beep on send of epoch
config.epoch.sound_on_signal_chosen_uri = '/beep.mp3' // in public dir
config.epoch.sound_on_signal_chosen_uri_b = '/tap.wav' // for group b
config.epoch.sound_on_seeding = false //BRUSSELS. play sound during seeding phase
//config.epoch.sound_on_seeding_uri = '/countdown.mp3' // in public dir
//config.epoch.sound_on_seeding_uri = '/familyfeud.mp3'  // in public dir
//config.epoch.sound_on_seeding_uri = '/johnroberts.mp3'  // in public dir
config.epoch.sound_on_seeding_uri = '/icydemons.mp3'  // in public dir
config.epoch.sound_on_seeding_subtract_each_play = 5.0 // - ms from currentTime position. It's a nice effect if wave is long. 0 other wise

module.exports = config
