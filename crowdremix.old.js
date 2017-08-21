
 /* eslint-disable */

import SuperSoundEngine from './sound-engine'

function CrowdRemixEngine__old(){

	/////////////////
	// constructor //
	/////////////////

	this.Sound = new SuperSoundEngine();
	this.Sound.initialize();
	// CONFIG
	// ---Generator---
	// loops are powered by a generator function*
	// The function continues every generator_interval milliseconds (interval)
	// And queues the next generator_window seconds ahead (window)

	// Generator_window is best being slightly above the generator_interval
	this.generator_window = 1200; // loops/stepsequences/compositions get queued this many seconds ahead
	// progress the playback (run generator.next) every this many milliseconds
	// If this is below 1000ms, you will probably use too many extra computing resources
	this.generator_interval = 1000;
	// move the playhead every this many milliseconds
	this.playhead_position_interval = 30;

	// keep track of all the setInterval IDs during playback, so we can stop them all
	this.playback_timer_ids = [];

	// Epsilon block -- Negligible fraction of a beat;
	// add this to block positions/lengths to prevent accidental block overwriting due to rounding errors
	this.epsilon_block = 0.01

	// When hitting play, sometimes it cuts off the first transient,
	// because of a tiny latency in processing the first window of audio.
	// Therefore, wait a small delay of time after hitting the playbutton:
	this.play_composition_starting_delay = .01; // 10ms
	this.play_stepsequence_starting_delay = .01; // 10ms

	// song object
	this.songs = {};
	// { song_id: [full analysis], ... }
	this.analysis = {};
	// { song_id: [Object HTMLImageElement], ... }
	this.hires_spectrograms = {};

	this.is_loaded = function(){
		return this.songs.length > 0 && this.analysis.length > 0 && this.hires_spectrograms.length > 0;
	}
	// development
	window.CrowdRemixEngine = this;
	var self = this;







	/* songs should look like this:
	var songs = [
		{
			"analysis_id": 	"67",
			"song_id": 543,
			"song_url": 	"http://1.s3.commonedits.com/commonedits/6c98aa3cf0319684257559a6bef7907f-song.mp3",
			"analysis_json_url": "http://2.s3.commonedits.com/commonedits/6c98aa3cf0319684257559a6bef7907f-analysis.json",
			"hires_spectrogram_urls": [
				"http://s3.commonedits.com/commonedits/6c98aa3cf0319684257559a6bef7907f-timbre_hires0.jpg"
			],
			"lores_spectrogram_url": "http://s3.commonedits.com/commonedits/6c98aa3cf0319684257559a6bef7907f-timbre_lores.jpg"
		},
		...
	]
	*/

	this.set_songs = function(songs){
		// save songs
		console.log("setting songs");
		this.songs = songs;
		// validate song object
		for(let s in songs){
			if(!("song_id" in songs[s])) console.error("CrowdRemixEngine: missing song_id");
			if(!("song_url" in songs[s])) console.error("CrowdRemixEngine: missing song_url");
			if(!("analysis_json_url" in songs[s])) console.error("CrowdRemixEngine: missing analysis_url");
			if(!("analysis_id" in songs[s])) console.error("CrowdRemixEngine: missing analysis_id");
			if(!("lores_spectrogram_url" in songs[s])) console.error("CrowdRemixEngine: missing lores_spectrogram_url");
			if(!("hires_spectrogram_urls" in songs[s])) console.error("CrowdRemixEngine: missing hires_spectrogram_urls");
			if(!Array.isArray(songs[s]["hires_spectrogram_urls"])){
				console.error("CrowdRemixEngine: hires_spectrogram_urls is not an array");
			}
			if(songs[s]["hires_spectrogram_urls"].length <= 0){
				console.error("CrowdRemixEngine: hires_spectrogram_urls length is not greater than zero ");
			}
		}
	}


	/*
	progress 	callback function(song_id, percent_complete [float, 0 to 1])
	success		callback function() called when all songs have finished loading into buffers
	error		callback function(e) called on error
	*/
	this.load_audio = function(progress, success, error){
		let things_loaded = 0;
		let self = this;
		self.Sound.load(self.songs, progress, function(song_id){
			things_loaded += 1;
			if(things_loaded == self.songs.length){
				success();
			}
		}, error);
	}

	/*
	success		callback function() called when all analyses have finished loading
	error		callback function(e) called on error
	*/
	this.load_analysis = function(success, error){
		let things_loaded = 0;
		let analysis = {}
		let self = this;
		for(let i in self.songs){
			let url = self.songs[i]["analysis_json_url"];
			let analysis_id = self.songs[i]["analysis_id"];
			let song_id = self.songs[i]["song_id"];
			let xmlhttp = new XMLHttpRequest();
			xmlhttp.onreadystatechange = function() {
			    if (this.readyState == 4 && this.status == 200) {
			        self.analysis[song_id] = JSON.parse(this.responseText);
			        self.analysis[song_id]["analysis_id"] = analysis_id;
			        things_loaded += 1;
			        if(things_loaded == self.songs.length){
			        	success(analysis);
			        }
			    }
			};
			xmlhttp.open("GET", url, true);
			xmlhttp.send();
			xmlhttp.onerror = error;
		}
	}

	/*
	success		callback function() called when all spectrograms have finished loading
	error		callback function(e) called on error
	*/
	this.load_spectrograms = function(success, error){
		let self = this;
		let total = self.songs.length;
		let loaded = 0;
		for(let i in self.songs){
			let hires = self.songs[i]["hires_spectrogram_urls"];
			let song_id = self.songs[i]["song_id"];
			self.hires_spectrograms[song_id] = [];
			//console.log(hires, song_id)
			for(let s in hires){
				// create a new <img> tag
				let img = document.createElement("img");
				// set the src
				let url = hires[s];
				img.setAttribute('src', url);
				// set the id
				let element_id = 'hires_spectrogram_' + song_id + '_' + s;
				// save it to this class object
				self.hires_spectrograms[song_id][s] = img
				//document.body.appendChild(img);
				let loadHandler = function(e){
					loaded += 1
					if(loaded == total) success(self.hires_spectrograms);
				}
				img.onload = loadHandler;
				img.onerror = error;
			    if (img.complete) loadHandler();
			}
		}
	}





	// Load the mp3s, the analysis jsons, and the hires spectrograms
	// Callback success() when all three things are done loading for all songs
	// progress_audio callback is only for the mp3 loading
	this.load = function(progress_audio, success, error){

		let things_loaded = 0;
		let self = this;
		let check = function(){
			things_loaded += 1;
			if(things_loaded == 3) success();
		}

		self.load_audio(
			progress_audio,
			function (){
				console.log("Done loading music");
				check();
			}, error
		);

		self.load_analysis(
			function(analysis){
				console.log("Done loading analysis")
				check();
			}, error
		);

		self.load_spectrograms(
			function(hires_spectrograms){
				console.log("Done loading spectrograms");
				check();
			}, error
		);
	}

	//////////////
	// PATTERNS //
	//////////////

	/*

	Pool is a list of segments:
	song_id, followed by segment_id
	[[296, 12], [296, 13], [296, 14], [296, 15], [296, 16]]

	*/
	this.create_pattern_hit = function(pool, chaos){
		// validate input
		if(pool.length==0){
			console.error("Warning: Tried to create pattern with empty pool");
			return {};
		}
		chaos = chaos ? true : false;
		// pick random segment from pool
		var segment = pool[Math.floor(Math.random() * pool.length)]
		return {
			"pool": pool,
			"chaos": chaos ? true : false,
			"gain": 1.0, // pattern gain
			"type": "hit", // play just once
			"layer": 0, // put all hits on layer 0.
			"sequence": [{
				"seg": segment,
				"gain": 1.0, // segment gain
				"pos": 0.0,  // start immediately
				"len": "full"  // play the full segment
			}],
			"len": "full" // the pattern's end point is the end of the final segment
		}
	}

	this.create_pattern_loop = function(pool, chaos, gaps, tempo_multiplier, template){

		// validate input
		if(pool.length==0){
			console.error("Warning: Tried to create pattern with empty pool");
			return {};
		}
		chaos = chaos ? true : false;
		if(!(gaps=="gaps" || gaps=="flows" || gaps=="stretch")){
			console.warn("Warning: Gaps must be one of 'gaps' 'flows' or 'stretch'");
			gaps = "flows"
		}else if(gaps=="stretch"){
			console.warn("Warning: Gaps = 'stretch' is not implemented yet");
			gaps = "flows"
		}
		tempo_multiplier = parseFloat(tempo_multiplier)
		if(!tempo_multiplier || tempo_multiplier<=0){
			console.warn("Warning: Pattern tempo_multiplier must be greater than 0");
			tempo_multiplier = 1.0
		}
		if(template["sequence"].length==0){
			console.error("Warning: Tried to create pattern with an empty sequence");
		}
		if(!("len" in template)){
			console.error("Warning: Template missing length ");
		}
		let len = parseFloat(template["len"])
		if(!len || len<=0){
			console.warn("Warning: Template length must be greater than 0 beats ");
			len = 4.0
		}

		/* clone the template */
		let sequence = JSON.parse(JSON.stringify(template["sequence"]))
		for(var i=0;i<sequence.length;i++){
			// pick random segment from pool
			sequence[i]["seg"] = pool[Math.floor(Math.random() * pool.length)]
			if(!("gain" in sequence[i])) sequence[i]["gain"] = 1.0
			if(!("chaos" in sequence[i])) sequence[i]["chaos"] = "default"
			if(!("gaps" in sequence[i])) sequence[i]["gaps"] = "default"
			if(!("len" in sequence[i])) console.error("Warning: Length missing for sequence item " + i);
			if(!("pos" in sequence[i])) console.error("Warning: Position missing for sequence item " + i);
		}
		return {
			"pool": pool,
			"chaos": chaos,
			"gaps": gaps,
			"gain": 1.0, // pattern gain
			"type": "loop", // play just once
			"layer": 1, // put all loops on layer 1 for now.
			"len": len, // length of the loop
			/*"subdivisions": 8.0, // mostly a calculation used in snapping*/
			"sequence": sequence,
			"tempo_multiplier": tempo_multiplier
		}
	}

	// A session has a global BPM
	// Multiply it by the pattern's
	this.calculate_secs_per_beat = function(pattern, session){
		let tempo_multiplier = 1.0; // default
		if("tempo_multiplier" in pattern) tempo_multiplier = pattern["tempo_multiplier"];
		let bpm = session["global_bpm"] * tempo_multiplier;
		let secs_per_beat = 60.0 / bpm;
		return secs_per_beat;
	}


	// runs inside of a timer
	// queues up the next generator_window seconds worth of segments
	// yield means "pause the function here", calling .next() resumes the function
	this.pattern_generator = function*(pattern, pattern_start_time, pattern_end_time, gain, session){
		//console.log("pattern_generator", pattern, pattern_start_time, pattern_end_time);
		/* calculate seconds per beat */
		let secs_per_beat = self.calculate_secs_per_beat(pattern, session)
		let pattern_length = parseFloat(pattern["len"]); // length in beats
		if(pattern_length<=0) console.warn("Invalid pattern length: " + pattern_length)
		else pattern_length *= secs_per_beat; // length in seconds

		while(true){ // play the loop forever
			for(let i in pattern["sequence"]){

				// queue the next segment
				let seg = self.get_next_pattern_step(i, pattern_start_time, secs_per_beat, pattern, session)
				if(seg["when"] >= pattern_end_time){
					// This segment starts after the pattern_end_time, so ignore it
					//console.log("starts after pattern_end_time", seg["when"], pattern_end_time);
					break;
				}
				// OK cool, nice, queue the segment
				//console.log("queued the segment", seg)
				self.Sound.queueSegment(seg);
				// if that next step started > 5.0 seconds from now, pause the generator..
				//console.log(seg, self.generator_window, self.Sound.context.currentTime);
				while(seg["when"] - self.generator_window > self.Sound.context.currentTime){
					//console.log("waiting for geneartor_window to catch up")
					yield {
						"earliest_event": seg["when"],
						"has_block_completed": false // we're not DONE
					}
				}
			}
			/* Add the pattern length to the new pattern_start_time */
			if(pattern["len"]=="full"){
				//console.log("non-looping, probably a hit");
				break; // non-looping, probably a hit
			}
			pattern_start_time += pattern_length;
			if(pattern_start_time >= pattern_end_time){
				// THE END
				//console.log("the end")
				break;
			}
		}
		//console.log("yielding the very end of everything");
		yield {
			"earliest_event": pattern_end_time, // i think this is ok to do
			"has_block_completed": true // we're DONE
		}
	}

	// play the pattern
	// if hit, plays once
	// if loop, creates a generator function that queues the next segments on a timeout, loops infinitely
	this.play_pattern = function(pattern, session, position_callback){
		//console.log("pattern", pattern, "session", session);
		let self = this;
		let pattern_start_time = self.Sound.context.currentTime;
		/* calculate seconds per beat */
		let secs_per_beat = self.calculate_secs_per_beat(pattern, session)
		let pattern_length = parseFloat(pattern["len"]); // length in beats
		if(pattern_length<=0) console.warn("Invalid pattern length: " + pattern_length)
		else pattern_length *= secs_per_beat; // length in seconds

		// Our pattern is either a forever loop or a one time hit
		// TODO: should use generators for patterns that are long but not forever
		if(pattern["type"]=="loop"){
			self.stop_all_loops()
			let pattern_end_time = Infinity;
			// create new loop generator
			let gain = 1.0 // or the global gain

			let generator = self.pattern_generator(pattern, pattern_start_time, pattern_end_time, gain, session);
			// run the generator every generator_interval milliseconds
			let generator_timer_id = setInterval(function(){
				generator.next()
				// calculate the current beat position, call the position callback
			}, self.generator_interval);
			// call the first pass of the generator
			generator.next();

			// remember the timer_id so we can stop it later
			self.playback_timer_ids.push(generator_timer_id);
			//console.log(self.playback_timer_ids, timer_id);

			// Move the playhead every playhead_position_interval milliseconds
			if(typeof position_callback == "function"){
				let playhead_timer_id = setInterval(function(){
					let current = self.Sound.context.currentTime;
					let elapsed = current - pattern_start_time;
					let pattern_position_seconds = elapsed % pattern_length;
					let pattern_position_beats = pattern_position_seconds / secs_per_beat;
					position_callback(pattern_position_beats);
				}, self.playhead_position_interval);
				self.playback_timer_ids.push(playhead_timer_id);

			}

		}else if(pattern["type"]=="hit"){
			// hit, just play the sequence once
			for(let i in pattern["sequence"]){
				// this is usually just one segment
				// but in the future a "hit" might be a combination of segments in a sequence
				// hence the for loop
				let seg = self.get_next_pattern_step(i, pattern_start_time, secs_per_beat, pattern, session)
				self.Sound.queueSegment(seg);
			}
		}else{
			console.warn("Pattern type is not HIT nor LOOP");
		}
	}


	/* Return the parameters of this step,
		If a parameter isn't defined on the step level, or if it is set to "default",
		look back to the pattern level for that parameter.
		In the case of gain, compute the gain by multiplying the gains from every level together.
	*/
	this.compute_step_params = function(step, pattern, session){
		let chaos, gaps, gain, pos, len, seg, bpm, when, segment, tempo_multiplier;
		let segment_id, analysis_id, song_id, duration, layer, pool;

		chaos = false; // no chaos by default
		if("chaos" in pattern) chaos = pattern["chaos"];
		if("chaos" in step){
			// Segment level parameters override pattern level parameters
			if(step["chaos"] != "default") chaos = step["chaos"];
		}

		pool = pattern["pool"];

		gain = 1.0; // default
		if("gain" in session) gain *= session["gain"];
		if("gain" in pattern) gain *= pattern["gain"];
		if("gain" in step) gain *= step["gain"];

		pos = 0.0; // default for hits
		if("pos" in step){
			pos = parseFloat(step["pos"]);
		}

		layer = 0; // default
		if("layer" in pattern) layer = pattern["layer"];
		if("layer" in step) layer = step["layer"];

		gaps = "flows";
		if("gaps" in pattern) gaps = pattern["gaps"];
		if("gaps" in step && step["gaps"]!="default") gaps = step["gaps"];

		len = step["len"];

		return [chaos, pool, gain, pos, layer, gaps, len];
	}

	// queues one step of a pattern
	// queues the segment into the sound engine
 	// returns the SoundEngine-readable segment object
	this.get_next_pattern_step = function(i, pattern_start_time, secs_per_beat, pattern, session){
		let step, chaos, gaps, gain, pos, len, seg, bpm, when, segment, tempo_multiplier;
		let segment_id, analysis_id, duration, layer, pool, song_id;

		step = pattern["sequence"][i];

		[chaos, pool, gain, pos, layer, gaps, len] = this.compute_step_params(step, pattern, session);

		/* get the step */
		if(chaos){
			seg = pool[Math.floor(Math.random() * pool.length)];
		}else{
			seg = step["seg"];
		}
		song_id = seg[0];
		segment_id = seg[1];
		segment = this.analysis[song_id]["segments"][segment_id];

		duration = 0;
		if(len=="full"){
			// play until duration
			duration = segment["duration"];
		}else{
			len = parseFloat(len);
			if(gaps=="gaps"){
				if(len*secs_per_beat < segment["duration"]){
					duration = len*secs_per_beat;
				}else{
					duration = segment["duration"];
				}
			}else if(gaps=="flows"){
				duration = len*secs_per_beat;
			}else if(gaps=="stretch"){
				// incompete
			}
		}
		//console.log(gaps, len, secs_per_beat, len*secs_per_beat, segment["duration"], duration)

		when = pos*secs_per_beat + pattern_start_time;

		let playSeg = Object.assign({},segment,{
			"when": when,
			"duration": duration,
			"song_id": song_id,
			"gain": gain,
			"layer": layer
		});

		return playSeg;
	}

	// stop all sound
	// clear all loop generators
	this.stop_all_sound = function(){
		console.log("stop_all_sound");

		for(let i in this.playback_timer_ids){
			clearInterval(this.playback_timer_ids[i])
		}
		this.Sound.stopAll();
	}

	// temporary solution
	this.stop_all_loops = function(){
		console.log("stop_all_loops");
		for(let i in this.playback_timer_ids){
			clearInterval(this.playback_timer_ids[i])
		}
		this.Sound.stopLayer(1);
	}


	////////////////////
	// STEP SEQUENCER //
	////////////////////

	this.stepsequencer = {};
	this.stepsequencer.create = function(){
		//console.log('making step sequencer');
		return {
			"rows": [],
			"tempo_multiplier": 1.0,
			"len": 8.0,
			"gain": 1.0,
			"default_grid": 0.5
		}
	}

	// change the length of the the stepsequence
	this.stepsequencer.change_length = function(stepsequence, len){
		let ss = JSON.parse(JSON.stringify(stepsequence))
		ss["len"] = len;
		return ss;
	}

	// change the gain of the the stepsequence
	this.stepsequencer.change_gain = function(stepsequence, gain){
		let ss = JSON.parse(JSON.stringify(stepsequence))
		ss["gain"] = gain;
		return ss;
	}

	// change the tempo multiplier of the the stepsequence
	this.stepsequencer.change_tempo_multiplier = function(stepsequence, tempo_multiplier){
		let ss = JSON.parse(JSON.stringify(stepsequence))
		ss["tempo_multiplier"] = tempo_multiplier;
		return ss;
	}

	// change the default grid size of the the stepsequence
	// the default grid size is the memory of the last grid size used while editing
	this.stepsequencer.change_default_grid = function(stepsequence, default_grid){
		let ss = JSON.parse(JSON.stringify(stepsequence))
		ss["default_grid"] = default_grid;
		return ss;
	}

	// Creating a new row by populating a row with pattern
	// Row number will be the new row, and everything below it gets pushed down.
	this.stepsequencer.insert_row = function(stepsequence, row_num, pattern){
		let pattern_clone = JSON.parse(JSON.stringify(pattern))
		let ss = JSON.parse(JSON.stringify(stepsequence))
		row_num = parseInt(row_num)
		if(row_num > ss["rows"].length){
			console.error("Cannot insert at row", row_num, "because there are only", ss["rows"].length, "rows in", ss);
			return false;
		}
		let original_pattern_length = pattern["len"]
		while(pattern_clone["len"] < ss["len"]){
			// We need to fill the empty space
			// Extend it by a full pattern_length
			let extend_pos = pattern_clone["len"]
			pattern_clone["len"] += original_pattern_length
			// copy the sequence
			let original_sequence_clone = JSON.parse(JSON.stringify(pattern["sequence"]))
			// shift the positions up
			original_sequence_clone.map(function(s){s["pos"]+=extend_pos; return s})
			// add the new hits to the end of the sequence
			pattern_clone["sequence"].push.apply(pattern_clone["sequence"], original_sequence_clone)
		}
		// Remember what the first segment was in the pattern sequence, and store it in "default_seg"
		// Particularly for hits, this is so the same hit gets added by the user in the stepsequence
		if(pattern_clone["sequence"].length>0){
			pattern_clone["default_seg"] = pattern_clone["sequence"][0]["seg"]
		}else{
			// Else if the pattern sequence is empty..
			// The default segment is random from the pool
			let pool = pattern_clone["pool"];
			pattern_clone["default_seg"] = pool[Math.floor(Math.random() * pool.length)];
		}
		// #todo: validate pattern is a pattern
		ss["rows"].splice(row_num, 0, pattern_clone);
		//console.log("pattern_clone", pattern_clone);
		//console.log("default_seg", ss);
		return ss;
	}

	this.stepsequencer.add_hit = function(stepsequence, row_num, pos, len){
		let ss = JSON.parse(JSON.stringify(stepsequence))
		len = parseFloat(len)
		pos = parseFloat(pos)
		row_num = parseInt(row_num)
		if(!(row_num in ss["rows"])){
			console.error("Row", row_num, "does not exist in stepsequence", ss);
			return false;
		}
		let pattern = ss["rows"][row_num];
		let sequence = pattern["sequence"];
		let pool = pattern["pool"];
		let seg = null;
		if(pattern["default_seg"]){
			// Default segment (the first)
			seg = pattern["default_seg"];
		}else{
			// Random segment from pool
			seg = pool[Math.floor(Math.random() * pool.length)];
		}
		//console.log("ADD HIT", seg, pattern)

		// new hit
		let hit = {
			"seg": seg,
			"gain": 1.0,
			"chaos": "default",
			"gaps": "default",
			"len": len,
			"pos": pos
		}

		// #todo validate new sequence

		// remove any hit with the same start position, or close enough start position
		for(let s=0;sequence[s];s++){
			if(Math.abs(sequence[s]["pos"] - hit["pos"]) < self.epsilon_block){
				// remove any hit which is closer than a small % of a beat
				// fixing any potential rounding errors
				sequence.splice(s, 1);
				s--;
			}
		}
		sequence.push(hit)
		// sort by start time
		sequence.sort(function(a,b){
			return a["pos"] - b["pos"];
		});

		ss["rows"][row_num]["sequence"] = sequence;
		return ss;
	}


	// in the given stepsequence and row, delete the hit with the given index
	this.stepsequencer.remove_hit = function(stepsequence, row_num, hit_index){
		let ss = JSON.parse(JSON.stringify(stepsequence))
		row_num = parseInt(row_num)
		if(!(row_num in ss["rows"])){
			console.error("Row", row_num, "does not exist in stepsequence", ss);
			return false;
		}
		if(!(hit_index in ss["rows"][row_num]["sequence"])){
			console.error("Hit", hit_index, "does not exist in row", row_num, "in step sequence", ss);
			return false;
		}
		let pattern = ss["rows"][row_num];
		let sequence = pattern["sequence"];
		sequence.splice(hit_index, 1);
		return ss;
	}

	// in the given stepsequence and row, delete the hit with the given index
	this.stepsequencer.translate_hit = function(stepsequence, row_num, hit_index, new_pos, new_len){
		let ss = JSON.parse(JSON.stringify(stepsequence))
		row_num = parseInt(row_num)
		if(!(row_num in ss["rows"])){
			console.error("Row", row_num, "does not exist in stepsequence", ss);
			return false;
		}
		let sequence = ss["rows"][row_num]["sequence"];
		if(!(hit_index in sequence)){
			console.error("Hit", hit_index, "does not exist in row", row_num, "in step sequence", ss);
			return false;
		}
		let hit = sequence[hit_index];
		hit["pos"] = parseFloat(new_pos)
		hit["len"] = parseFloat(new_len)

		// remove any hit with the same start position, or close enough start position

		for(let s=0;sequence[s];s++){
			if(s==hit_index){
				continue; // ignore the block we're editing
			}
			let p1 = sequence[s]["pos"];
			let l1 = sequence[s]["len"]; // might be "full"
			if(l1 == "full") l1 = 0
			let p2 = hit["pos"];
			let l2 = hit["len"];
			if(Math.abs(p1 - p2) < self.epsilon_block){
				// remove any block which is closer than a small % of a beat
				// fixing any potential rounding errors
				sequence.splice(s, 1);
				if(hit_index>s) hit_index-=1 // shift this hit back
				s-=1

			}else if(p1 + l1 - self.epsilon_block <= p2){
				// ignore, too far behind
			}else if(p1 >= p2 + l2 - self.epsilon_block){
				// ignore, too far ahead
			}else{
				// remove
				sequence.splice(s, 1);
				if(hit_index>s) hit_index-=1 // shift this hit back
				s-=1

				// TODO: function more like ableton
				// Where the beginning of a block can start in the middle of its content
				// And then when we translate a block in its way, we just change the content start position
			}
		}


		// Re-Sort the sequence
		sequence.sort(function(a,b){
			return a["pos"] - b["pos"];
		});
		return ss;
	}

	// in the given stepsequence and row, refresh the pattern with new segments from the pool;
	// return a new stepsequence
	this.stepsequencer.refresh_row = function(stepsequence, row_num){
		let ss = JSON.parse(JSON.stringify(stepsequence))
		row_num = parseInt(row_num)
		if(!(row_num in ss["rows"])){
			console.error("Row", row_num, "does not exist in stepsequence", ss);
			return false;
		}
		ss["rows"][row_num] = self.refresh_pattern(ss["rows"][row_num]);
		return ss;
	}

	// remove the row
	this.stepsequencer.remove_row = function(stepsequence, row_num){
		let ss = JSON.parse(JSON.stringify(stepsequence))
		row_num = parseInt(row_num)
		if(!(row_num in ss["rows"])){
			console.error("Row", row_num, "does not exist in stepsequence", ss);
			return false;
		}
		ss.splice(row_num, 1);
		return ss;
	}

	this.stepsequencer.example = function(){
		let ss = this.create()
		let p = {"pool":[["320",263],["320",264],["320",265],["320",266],["320",267],["320",268],["320",269],["320",270],["320",271],["320",272],["320",273],["320",274],["320",275],["320",276],["320",277],["320",278],["320",279],["320",280],["320",281],["320",282],["320",283],["320",284],["320",285],["320",286],["320",287],["320",288],["320",289],["320",290],["320",291],["320",292],["320",293],["320",294],["320",295],["320",296],["320",297],["320",298],["320",299],["320",300],["320",301],["320",302],["320",303],["320",304],["320",305],["320",306],["320",307],["320",308],["320",309],["320",310],["320",311],["320",312],["320",313],["320",314],["320",315],["320",316],["320",317],["320",318],["320",319],["320",320],["320",321],["320",322],["320",323],["320",324],["320",325],["320",326],["320",327],["320",328],["320",329],["320",330],["320",331],["320",332],["320",333],["320",334],["320",335],["320",336],["320",337],["320",338],["320",339],["320",340],["320",341],["320",342],["320",343],["320",344],["320",345],["320",346],["320",347],["320",348],["320",349],["320",350],["320",351],["320",352],["320",353],["320",354],["320",355],["320",356],["320",357],["320",358],["320",359],["320",360],["320",361],["320",362],["320",363],["320",364],["320",365],["320",366],["320",367],["320",368],["320",369],["320",370],["320",371],["320",372],["320",373],["320",374],["320",375],["320",376],["320",377],["320",378],["320",379],["320",380],["320",381],["320",382],["320",383],["320",384],["320",385],["320",386],["320",387],["320",388],["320",389],["320",390],["320",391],["320",392],["320",393],["320",394],["320",395],["320",396],["320",397],["320",398],["320",399],["320",400],["320",401],["320",402],["320",403],["320",404],["320",405],["320",406],["320",407],["320",408],["320",409],["320",410],["320",411],["320",412],["320",413],["320",414],["320",415],["320",416],["320",417],["320",418],["320",419],["320",420],["320",421],["320",422],["320",423],["320",424],["320",425],["320",426],["320",427],["320",428],["320",429],["320",430],["320",431],["320",432],["320",433],["320",434],["320",435],["320",436],["320",437],["320",438],["320",439],["320",440],["320",441],["320",442],["320",443],["320",444],["320",445],["320",446],["320",447],["320",448],["320",449],["320",450],["320",451],["320",452],["320",453],["320",454],["320",455],["320",456],["320",457],["320",458],["320",459],["320",460],["320",461]],"chaos":false,"gaps":"flows","gain":1,"type":"loop","layer":1,"len":4,"sequence":[{"len":0.5,"pos":0,"gain":1,"seg":["320",426],"chaos":"default","gaps":"default"},{"len":0.5,"pos":0.5,"gain":1,"seg":["320",391],"chaos":"default","gaps":"default"},{"len":0.5,"pos":1,"gain":1,"seg":["320",325],"chaos":"default","gaps":"default"},{"len":0.5,"pos":1.5,"gain":1,"seg":["320",456],"chaos":"default","gaps":"default"},{"len":0.5,"pos":2,"gain":1,"seg":["320",349],"chaos":"default","gaps":"default"},{"len":0.5,"pos":2.5,"gain":1,"seg":["320",267],"chaos":"default","gaps":"default"},{"len":0.5,"pos":3,"gain":1,"seg":["320",266],"chaos":"default","gaps":"default"},{"len":0.5,"pos":3.5,"gain":1,"seg":["320",266],"chaos":"default","gaps":"default"}],"tempo_multiplier":1}
		let session = {"gain":1, "global_bpm": 120}
		ss = this.insert_row(ss, 0, p);
		self.play_stepsequence(ss, 0, session, function(t){console.log(t)})
		return ss;
	}

	// Return a new pattern with all the segments refreshed from the pool
	this.refresh_pattern = function(pattern){
		let p = JSON.parse(JSON.stringify(pattern));
		for(let i in p["sequence"]){
			p["sequence"][i]["seg"] = p["pool"][Math.floor(Math.random() * p["pool"].length)]
		}
		return p;
	}

	// runs inside of a timer
	// queues up the next generator_window seconds worth of segments
	// yield means "pause the function here", calling .next() resumes the function
	// ss_end_time is the time at which the generator should cease
	this.stepsequence_generator = function* ss_generator(stepsequence, ss_start_time, ss_end_time, gain, session){
		let secs_per_beat = self.calculate_secs_per_beat(stepsequence, session)
		// length in beats of the stepsequence (not the block)
		// The block might be shorter in length, in which case the composition will end early
		// If the block is longer in length, the composition will loop to fill the space
		let ss_length = parseFloat(stepsequence["len"]); // length in beats
		if(ss_length<=0) console.warn("Invalid pattern length: " + ss_length)
		else ss_length *= secs_per_beat; // length in seconds

		let loop_start_time = ss_start_time;
		while(true){ // play the loop forever
			//console.log("------\nNew Loop\n------");

			// We look through every row-pattern and queue any segment that's about to play
			// We remember the current position-index of the steps in every row-pattern
			let indexes = [];
			let rows = stepsequence["rows"];
			// initialize to 0
			for(let r in rows){
				indexes[r] = 0;
			}
			// how many rows still have segments that are unqueued?
			let unfinished_rows = rows.length;
			// the "when" time of the earliest queued segment
			let earliest_seg_loop = Infinity;
			while(true){
				// Go through all the rows once, queue all the next row-segments
				//console.log("---Row Cycle---");

				let earliest_seg_row_cycle = Infinity;
				for(let r in rows){
					//console.log("-Row", r);
					//console.log(indexes)
					//console.log(unfinished_rows, rows.length)

					let pattern = rows[r];
					let i = indexes[r];
					if(i >= pattern["sequence"].length){
						// Ooops, at the end of the row
						//console.log("End of row", r, i);
						continue;
					}
					let pos = pattern["sequence"][i]["pos"]
					//console.log("POS", pos, stepsequence["len"], i)
					//console.log("unfinished_rows", unfinished_rows)
					if(pos >= stepsequence["len"]){
						// Even though this hit is present in the row,
						// It's longer than the stepsequence length
						// So it's hidden
						continue;
					}
					// when will this segment play?
					let when = pos * secs_per_beat + loop_start_time;
					// update the minimum "when"
					// The earliest queued segment in this row cycle
					if(when < earliest_seg_row_cycle){
						earliest_seg_row_cycle = when
					}
					if(when - self.generator_window > self.Sound.context.currentTime){
						// this next segment is too far ahead
						//console.log("Too Far ahead", when)
						continue;
					}

					// OKAY we're definitely going to queue this segment
					let seg = self.get_next_pattern_step(i, loop_start_time, secs_per_beat, pattern, session)
					self.Sound.queueSegment(seg);

					// advance the position-index for this row
					indexes[r]+=1;
					if(indexes[r] >= pattern["sequence"].length){
						// no more steps in this row
						// Mark this row as finished
						unfinished_rows -= 1;
						//console.log("No more steps in row", r);
					}else if(pattern["sequence"][i+1]["pos"]>=stepsequence["len"]){
						// the next step in this row is "hidden" (beyond the step sequence length)
						// Mark this row as finished
						unfinished_rows -= 1;
					}

				}
				if(unfinished_rows <= 0){
					// all the segments in this loop have been queued
					//console.log("break");
					break; // break and repeat the loop
				}
				if((ss_end_time != Infinity) && earliest_seg_row_cycle >= ss_end_time){
					// If the earliest event happens after ss_end_time
					// Then we've reached the end of the stepsequence  block
					// Break all the row cycles
					break;
				}

				// if the earliest segment started > 5.0 seconds from now, pause the generator..
				while(earliest_seg_row_cycle - self.generator_window > self.Sound.context.currentTime){
					//console.log("yield", earliest_seg_row_cycle, self.generator_window, self.Sound.context.currentTime);
					yield {
						"earliest_event": earliest_seg_row_cycle,
						"has_block_completed": false // we're NOT DONE
					}
				}
			}

			// Start the Loop over
			// Add the pattern length to the new ss_start_time */
			//if(pattern["len"]=="full") break; // non-looping
			loop_start_time += ss_length;
			// Do we repeat the stepseqeunce? And start the Loop over?
			if(loop_start_time >= ss_end_time){
				// THE END
				break;
			}
			// We're going to repeat the stepsequence
			// Check if we should wait until we loop around
			while(loop_start_time - self.generator_window > self.Sound.context.currentTime){
				//console.log("yield3", loop_start_time);
				yield {
					"earliest_event": loop_start_time,
					"has_block_completed": false
				}
			}
		}
		yield {
			"earliest_event": ss_end_time, // i think this is ok to do
			"has_block_completed": true // we're DONE
		}
	}

	// playback of the stepsequence
	// this is not for playback within a composition block
	// this is for
	// * playback when the user is in the stepsequence editor, or
	// * has clicked on a stepsequence pad
	// start_position is the beat# (float) where playback begins
	this.play_stepsequence = function(stepsequence, start_position, session, position_callback){
		// pause everything else
		self.stop_all_loops()

		let ss_start_time = self.Sound.context.currentTime; // start now
		// scoot it ahead a delay
		// otherwise the beginning might get cut off (while the generator is prepping)
		ss_start_time += self.play_stepsequence_starting_delay

		let ss_end_time = Infinity; // loop forever, because this is not within block playback

		let secs_per_beat = self.calculate_secs_per_beat(stepsequence, session)
		// length in beats of the stepsequence (not the block)
		// The block might be shorter in length, in which case the composition will end early
		// If the block is longer in length, the composition will loop to fill the space
		let ss_length = parseFloat(stepsequence["len"]); // length in beats
		if(ss_length<=0) console.warn("Invalid pattern length: " + ss_length)
		else ss_length *= secs_per_beat; // length in seconds

		let gain = 1.0 // else the global gain
		// create new loop generator
		let generator = this.stepsequence_generator(stepsequence, ss_start_time, ss_end_time, gain, session);
		// run the generator every generator_interval milliseconds
		let generator_timer_id = setInterval(function(){
			// continue the generator!!!!!
			generator.next()
		}, self.generator_interval);
		// call the first pass of the generator
		generator.next();
		// remember the timer_id so we can stop it later
		self.playback_timer_ids.push(generator_timer_id);
		//console.log(self.playback_timer_ids, timer_id);

		if(typeof position_callback == "function"){
			let playhead_timer_id = setInterval(function(){
				// calculate the current beat position, call the position callback
				let current = self.Sound.context.currentTime;
				let elapsed = current - ss_start_time;
				let ss_position_seconds = elapsed % ss_length;
				let ss_position_beats = ss_position_seconds / secs_per_beat;
				//console.log("T", ss_start_time, current, elapsed, ss_length, ss_position_seconds)
				position_callback(ss_position_beats)
			}, self.playhead_position_interval);
			self.playback_timer_ids.push(playhead_timer_id);
		}


	}

	////////////////
	/// COMPOSER ///
	////////////////

	// Rows with Position/Lengths of Blocks
	// Hit, Pattern, Stepsequence, or Composition

	this.composer = {};

	// Create a new composition object
	// Compositions have rows.
	// Rows have blocks.
	// A block is a reference to a pattern, stepsequence, or composition in the sessions object
	this.composer.create = function(){
		//console.log('new composition');

		// Give the composition a random hue
		let hue = (Math.floor(Math.random()*210) + 150) % 360
		// actually we want 90 to 360, because 0 to 90 looks like puke/poop
		// we want to ignore 50 to 150 because greens look too bright

		return {
			"rows": [],				// A list of block events
			"tempo_multiplier": 1.0,
			"len": 8.0,
			"gain": 1.0,
			"default_grid": 0.5,
			"hue": hue
			/*,
			"deepness": 0 			// How many levels of compositions within compositions?*/
		}
	}

	// change the length of the the composition
	this.composer.change_length = function(composition, len){
		let comp = JSON.parse(JSON.stringify(composition))
		comp["len"] = len;
		return comp;
	}

	// change the gain of the the composition
	this.composer.change_gain = function(composition, gain){
		let comp = JSON.parse(JSON.stringify(composition))
		comp["gain"] = gain;
		return comp;
	}

	// change the tempo multiplier of the the composition
	this.composer.change_tempo_multiplier = function(composition, tempo_multiplier){
		let comp = JSON.parse(JSON.stringify(composition))
		comp["tempo_multiplier"] = tempo_multiplier;
		return comp;
	}

	// change the default grid size of the the composition
	// the default grid size is the memory of the last grid size used while editing
	this.composer.change_default_grid = function(composition, default_grid){
		let comp = JSON.parse(JSON.stringify(composition))
		comp["default_grid"] = default_grid;
		return comp;
	}

	// Creating a new row by populating a row with pattern
	// Row number will be the new row, and everything below it gets pushed down.
	this.composer.insert_row = function(composition, row_num){
		let comp = JSON.parse(JSON.stringify(composition))
		row_num = parseInt(row_num)
		if(row_num > comp["rows"].length){
			console.error("Cannot insert at row", row_num, "because there are only", comp["rows"].length, "rows in", comp);
			return false;
		}
		let new_row = {
			"blocks": [],
			"gain": 1.0
		}
		comp["rows"].splice(row_num, 0, new_row);
		return comp;
	}

	// BLOCKS
	// composer.block handles block_id stuff
	// block_ids are of the form "ss0" or "co1" or "pa432"
	// "ss" means stepsequence
	// "co" means composition
	// "pa" means pattern
	// The number represents the index you would find this block in the session object
	// For example "pa432" refers to session["patterns"][432]
	// A block_object can be a Pattern, a Stepsequence, or Composition
	this.composer.block = {}

	// does this block_id refer to anything in the session
	this.composer.block.exists = function(block_id, session){
		return this.get_index(block_id) in session[this.get_type(block_id)];
	}

	// get the block_object from the session to which the block_id refers
	this.composer.block.get = function(block_id, session){
		if(this.exists(block_id, session)){
			return session[this.get_type(block_id)][this.get_index(block_id)];
		}else{
			console.error("Block_id does not exist", session)
		}
	}

	// the default length of a block
	// Give it the current grid_size of the composer; hits will be one grid_size long.

	this.composer.block.get_default_length = function(block_id, session, grid_size){
		let block = this.get(block_id, session);
		if(block["len"] == "full"){
			// For for HITS
			return grid_size;
		}else{
			// For loops, stepsequences, and compositions
			return parseFloat(block["len"]);
		}
	}

	// what is the two letter code for this block type?
	this.composer.block.get_type = function(block_id){
		let type = block_id.substring(0,2);
		if(type=="pa") return "patterns";
		if(type=="co") return "compositions";
		if(type=="ss") return "stepsequences";
		else console.error("Unknown block type", block_id);
	}

	// what is the index of this block_id, as in session[type][index]
	this.composer.block.get_index = function(block_id){
		return parseInt(block_id.substring(2));
	}

	// is this block_id a pattern?
	this.composer.block.is_pattern = function(block_id){
		return this.get_type(block_id) == "patterns"
	}

	// is this block_id a composition?
	this.composer.block.is_composition = function(block_id){
		return this.get_type(block_id) == "compositions"
	}

	// is this block_id a step sequence?
	this.composer.block.is_stepsequence = function(block_id){
		return this.get_type(block_id) == "stepsequences"
	}

	// Recursively check if this composition contains the target block_id
	// This is used to prevent compositions containing themselves
	this.composer.contains_block = function(composition, block_id_target, session){
		for(let r in composition["rows"]){
			let row = composition["rows"][r]
			for(let b in row["blocks"]){
				let _block = row["blocks"][b]
				if(_block["block_id"] == block_id_target){
					return true;
				}else{
					if(this.block.is_composition(_block["block_id"])){
						let comp = this.block.get(_block["block_id"], session);
						if(this.contains_block(comp, block_id_target, session)) return true;
						else continue;
					}
				}
			}
		}
		return false;
	}

	// returns a random string which is very likely to be unique
	this.uuid = function(){
		return Math.floor((1 + Math.random()) * 0x100000000).toString(36)
	}

	// Add the block to the composition at the give row_num, position with length
	// Block_id is an identifier which is given to composer.block.get()
	// Composition_id is this composition's block_id, example: co12,
	// which refers to session["compositions"][12]
	// The reason for passing the composition id is that we want to
	// avoid compositions going inside of themselves.

	// This returns an object {"composition": changed_composition, "new_block": new_block}
	this.composer.add_block = function(composition, composition_id, block_id, row_num, pos, len, session){
		let comp = JSON.parse(JSON.stringify(composition))
		len = parseFloat(len)
		pos = parseFloat(pos)
		row_num = parseInt(row_num)
		if(!(row_num in comp["rows"])){
			console.error("Row", row_num, "does not exist in composition", comp);
			return {"composition": composition, "new_uuid": undefined};
		}
		if(!this.block.exists(block_id, session)){
			console.error("Block_id does nost exist", block_id);
			return {"composition": composition, "new_uuid": undefined};
		}

		let blocks = comp["rows"][row_num]["blocks"];
		let uuid = self.uuid();
		// new block
		let _block = {
			"block_id": block_id,
			"gain": 1.0,
			"len": len,
			"pos": pos,
			"uuid": uuid,
			"color": randomHex() // temporary, remember to remove once draw functions are in place
		}
		let blockobj = this.block.get(block_id, session);
		if(this.block.is_composition(block_id)){
			// If this block is a composition:
			// if it's an integer, turn it into its block_id format:
			if(parseInt(composition_id)==composition_id) composition_id = "co" + composition_id
			// Validate that the block isn't the same composition
			if(block_id == composition_id){
				console.warn("Can't put the composition inside of itself")
				return {"composition": composition, "new_block": undefined};
			}
			// Validate that the block doesn't contain the same composition anywhere
			if(this.contains_block(blockobj, composition_id, session)){
				console.warn("Can't put the composition deeply inside of itself")
				return {"composition": composition, "new_block": undefined};
			}
			// Todo: Put a limit on composition depth?
			/*// Increment the deepness
			if(comp["deepness"] <= blockobj["deepness"]){
				comp["deepness"] = blockobj["deepness"] + 1
			}*/
		}

		// remove any block with the same start position, or close enough start position

		for(let s=0;blocks[s];s++){
			let p1 = blocks[s]["pos"];
			let l1 = blocks[s]["len"];
			let p2 = _block["pos"];
			let l2 = _block["len"];
			if(Math.abs(p1 - p2) < self.epsilon_block){
				// remove any block which is closer than 0.001th of a beat
				// fixing any potential rounding errors
				blocks.splice(s, 1);
				s-=1
			}else if(p1 + l1 - self.epsilon_block <= p2){
				// ignore, too far behind
			}else if(p1 >= p2 + l2 - self.epsilon_block){
				// ignore, too far ahead
			}else{
				// remove
				blocks.splice(s, 1);
				s-=1
				// TODO: function more like ableton
				// Where the beginning of a block can start in the middle of its content
				// And then when we translate a block in its way, we just change the content start position
			}
		}
		// add new block to blocks
		blocks.push(_block)
		// sort by start time
		blocks.sort(function(a,b){
			return a["pos"] - b["pos"];
		});
		return {"composition": comp, "new_block": _block};
	}


	// in the given composition and row, delete the hit with the given index
	this.composer.remove_block = function(composition, row_num, block_index){
		let comp = JSON.parse(JSON.stringify(composition))
		row_num = parseInt(row_num)
		if(!(row_num in comp["rows"])){
			console.error("Row", row_num, "does not exist in composition", comp);
			return false;
		}
		if(!(block_index in comp["rows"][row_num]["blocks"])){
			console.error("Block", block_index, "does not exist in row", row_num, "in composition", comp);
			return false;
		}
		let blocks = comp["rows"][row_num]["blocks"];
		//console.log(block_index, "block remove")
		blocks.splice(block_index, 1);
		return comp;
	}

	// in the given composition and row, change the block at block_index to have new position and length
	//
	this.composer.translate_block = function(composition, row_num, block_index, new_pos, new_len, new_row_num){
		let comp = JSON.parse(JSON.stringify(composition))
		row_num = parseInt(row_num)
		if(!(row_num in comp["rows"])){
			console.error("Row", row_num, "does not exist in composition", comp);
			return composition;
		}
		if(isNaN(new_row_num)){
			// if new_row_num is not set, assume the row hasn't changed
			new_row_num = row_num
		}else{
			if(!(new_row_num in comp["rows"])){
				console.error("Row", new_row_num, "does not exist in composition", comp);
				return composition;
			}else{
				new_row_num = parseInt(new_row_num);
			}
		}
		let old_row_blocks = comp["rows"][row_num]["blocks"]
		if(!(block_index in old_row_blocks)){
			console.error("Hit", block_index, "does not exist in row", row_num, "in composition", comp);
			return composition;
		}
		let _block = old_row_blocks[block_index]
		_block["len"] = parseFloat(new_len)
		_block["pos"] = parseFloat(new_pos)
		let new_row_blocks = comp["rows"][new_row_num]["blocks"]

		// remove any block with the same start position, or close enough start position
		//console.log("block_index", block_index)
		for(let s=0;new_row_blocks[s];s++){
			//console.log(JSON.stringify(new_row_blocks))
			if(s==block_index){
				//console.log("ignore blockindex ", s)
				continue; // ignore the block we're editing
			}
			let p1 = new_row_blocks[s]["pos"];
			let l1 = new_row_blocks[s]["len"];
			let p2 = _block["pos"];
			let l2 = _block["len"];
			if(Math.abs(p1 - p2) < self.epsilon_block){
				// remove any block which is closer than 0.001th of a beat
				// fixing any potential rounding errors
				new_row_blocks.splice(s, 1);
				if(block_index>s) block_index-=1 // shift this hit back
				//console.log("Removed ontop",s, "New block_index", block_index)
				s-=1
			}else if(p1 + l1 - self.epsilon_block <= p2 ){
				// ignore, too far behind
				//console.log("ignore behind", s)
			}else if(p1 >= p2 + l2 - self.epsilon_block){
				// ignore, too far ahead

				//console.log("ignore ahead", s)
			}else{
				// remove
				new_row_blocks.splice(s, 1);
				if(block_index>s) block_index-=1 // shift this hit back
				//console.log("Removed",s, "New block_index", block_index)
				s-=1
				// TODO: function more like ableton
				// Where the beginning of a block can start in the middle of its content
				// And then when we translate a block in its way, we just change the content start position
			}
		}

		// Resort the blocks
		new_row_blocks.sort(function(a,b){
			return a["pos"] - b["pos"];
		});

		return comp;
	}

	// remove the row
	this.composer.remove_row = function(composition, row_num){
		let comp = JSON.parse(JSON.stringify(composition))
		row_num = parseInt(row_num)
		if(!(row_num in comp["rows"])){
			console.error("Row", row_num, "does not exist in composition", comp);
			return false;
		}
		comp["rows"].splice(row_num, 1);
		return comp;
	}

	// runs inside of a timer
	// queues up the next generator_window seconds worth of segments
	// yield means "pause the function here", calling .next() resumes the function
	this.composition_generator = function*(composition, comp_start_time, comp_end_time, gain, session){
		let secs_per_beat = self.calculate_secs_per_beat(composition, session)
		let comp_length = parseFloat(composition["len"]);
		// length in beats of the composition (not the block)
		// The block might be shorter in length, in which case the composition will end early
		// If the block is longer in length, the composition will loop to fill the space
		if(comp_length<=0) console.warn("Invalid composition length: " + comp_length)
		else comp_length *= secs_per_beat; // length in seconds

		let loop_start_time = comp_start_time;
		let earliest_event = Infinity;
		while(true){
			// loop the composition (until comp_end_time)

			//console.log("------\nNew Loop\n------");

			// We look through every row
			// and call any block generator that's about to play
			// and .next() any block generator that's currently playing
			// We remember the current block index of each row
			let row_block_indexes = [];
			// We remember the current block generator of the row
			// (there can only be one block per row at a time)
			let row_block_generators = [];
			// initialize:
			let rows = composition["rows"];
			for(let r in rows){
				row_block_indexes[r] = 0;
				// 0 means start at the first block in the row
				row_block_generators[r] = null;
				// null means the this is a new composition loop
				// OR it means the last block finished and the next block hasn't started
			}
			// how many rows still have blocks that haven't completed yet?
			// when this decrements to 0, we know that all the blocks have completed
			let unfinished_rows = rows.length;

			while(true){
				// Go through all the rows one-by-one, until all the blocks are done
				// start all new block generators
				// and .next() all the existing generators
				// The block generators will queue the next generator_window seconds worth of stuff

				//console.log("---Row Cycle---");

				// The earliest event time for anything within anything in this row cycle
				earliest_event = Infinity
				// Set the earliest time to the end of the composition
				// let earliest_event_in_row_cycle = loop_start_time + comp_length;
				for(let r in rows){
					//console.log("-Row", r);
					//console.log(row_block_indexes)
					//console.log(unfinished_rows, rows.length)

					let row = rows[r]
					let i = row_block_indexes[r];
					if(i >= row["blocks"].length){
						// Ooops, at the end of the row
						//console.log("Ooops, at the end of the row")

						continue;
					}
					let block = row["blocks"][i];
					let pos = block["pos"];
					let block_length = block["len"];
					if(pos >= composition["len"]){
						// Even though this block is present in the row,
						// It's longer than the composition length
						// So it's "hidden" and doesn't play
						//console.log("Even though this block is present in the row, it's hidden so dont play it")
						continue;
					}

					if(row_block_generators[r] === null){
						// BLOCK HASNT STARTED YET
						// Start time for the block:
						let block_start_time = pos * secs_per_beat + loop_start_time;
						if(block_start_time < earliest_event){
							earliest_event = block_start_time
						}
						if(block_start_time - self.generator_window > self.Sound.context.currentTime){
							// this next block is too far ahead
							//console.log("Too Far ahead")
							continue;
						}
						// Calculate the block end time
						let block_end_time = block_start_time + (block["len"] * secs_per_beat);
						// START THE BLOCK:
						//console.log("Start the block!");
						//console.log(block, block_start_time, block_end_time)
						row_block_generators[r] = self.get_block_generator(block, block_start_time, block_end_time, gain, session)
						// A new block has started
						//console.log("new block has started", row_block_generators[r] );
						//console.log("ee1", earliest_event, block_start_time);
					}

					// BLOCK HAS ALREADY STARTED:
					// Continue advancing block
					// Advancing queues the next self.generator_window seconds of the block
					let block_gen = row_block_generators[r];
					//console.log("row block geneators", row_block_generators);

					let g = block_gen.next().value;
					//console.log("block_gen_next", g);
					// block_generator needs to yield an object with
					// "has_block_completed": boolean
					// "earliest_event_when": seconds
					let has_block_completed = g["has_block_completed"];
					// update the minimum "when" of the earliest event in this row cycle

					if(has_block_completed){
						//console.log("block has finished");
						// This block has finished advancing and queuing
						// destroy the generator
						row_block_generators[r] = null;
						// Advance the row to the next block
						row_block_indexes[r]+=1;
						// Also check if the row has completed:
						if(row_block_indexes[r] >= row["blocks"].length){
							// no more steps in this row
							// Mark this row as finished
							unfinished_rows -= 1;
							//console.log("No more steps in row", r);
						}else if(row["blocks"][i+1]["pos"]>=composition["len"]){
							// the next step in this row is "hidden" (beyond the step sequence length)
							// Mark this row as finished
							unfinished_rows -= 1;
						}
					}else{
						// block has not finished
						if(g["earliest_event"] < earliest_event){
							earliest_event = g["earliest_event"]
						}
						//console.log("ee2", earliest_event, g["earliest_event"]);
					}

				}

				if(unfinished_rows <= 0){
					// all the blocks in this composition have queued everything

					//console.log("all the blocks in this composition have queued everything")
					break; // break all the row cycles
				}

				if((comp_end_time != Infinity) && (earliest_event >= comp_end_time)){
					// If the earliest event happens after comp_end_time
					// Then we've reached the end of the composition block
					// Break all the row cycles
					//console.log("we've reached the end of the composition block", earliest_event, comp_end_time)
					break;
				}

				//console.log("finished one row cycle..", earliest_event, earliest_event - self.generator_window, self.Sound.context.currentTime)
				// We just finished one row cycle
				// We should pause the generator if...
				// the earliest event started > generator_window seconds from now
				while(earliest_event - self.generator_window > self.Sound.context.currentTime){
					//console.log("yield1", earliest_event);
					yield {
						"earliest_event": earliest_event,
						"has_block_completed": false
					}
				}


			}
			// All the blocks have been queued

			// Do we repeat the composition? And start the Loop over?
			/* Add the commposition length to the new comp_start_time */
			loop_start_time += comp_length;
			//console.log("All the blocks have been queued", loop_start_time, comp_end_time)

			if(loop_start_time >= comp_end_time){
				// THE END
				//console.log("The end");
				break;
			}
			// We're going to repeat the composition
			// Check if we should wait until we loop around
			while(loop_start_time - self.generator_window > self.Sound.context.currentTime){
				//console.log("yield3", loop_start_time);
				yield {
					"earliest_event": loop_start_time,
					"has_block_completed": false
				}
			}
		}
		//console.log("yield2", comp_end_time);
		earliest_event = earliest_event<comp_end_time?earliest_event:comp_end_time;
		yield {
			"earliest_event": earliest_event, // i think this is ok to do
			"has_block_completed": true // we're DONE
		}
	}

	this.get_block_generator = function(composition_block, block_start_time, block_end_time, parent_gain, session){
		//console.log("block generator", composition_block, block_start_time, block_end_time, parent_gain);
		// get the block
		let block_id = composition_block["block_id"];
		let gain = composition_block["gain"] * parent_gain; // multiply the block gain by the gain passed down from the parent
		// Retrieve the block from the session
		let block_object = self.composer.block.get(block_id, session);
		// check what type it is
		//console.log(block_id, gain, block_object)
		if(self.composer.block.is_pattern(block_id)){
			//console.log(block_id, "is pattern");
			// if it's a pattern
			return self.pattern_generator(block_object, block_start_time, block_end_time, gain, session);
		}else if(self.composer.block.is_stepsequence(block_id)){
			//console.log(block_id, "is stepsequence");

			// if its a stepsequence
			return self.stepsequence_generator(block_object, block_start_time, block_end_time, gain, session);
		}else if(self.composer.block.is_composition(block_id)){
			//console.log(block_id, "is composition");

			// if its a composition
			return self.composition_generator(block_object, block_start_time, block_end_time, gain, session);
		}else{
			console.error("Block has unknown type", block_id)
		}
	}

	// playback of the composition
	// start_position is the beat# (float) where playback begins
	// A composition has rows
	// Rows have blocks
	// Blocks have start positions and lengths
	// A block is a reference to a pattern, stepsequence, or composition in the session
	// That's right, compositions-within-compositions with arbitrary depth
	// Assume a composition does not contain itself.
	this.play_composition = function(composition, start_position, session, position_callback, end_callback){

		//console.log("play composition", composition, start_position)
		//console.log(typeof position_callback)
		//console.log(position_callback)
		// start/length/end timing
		let comp_start_time = self.Sound.context.currentTime;
		// scoot it ahead a delay
		// otherwise the beginning might get cut off (while the generator is prepping)
		comp_start_time += self.play_composition_starting_delay
		// calculate seconds per beat
		let secs_per_beat = self.calculate_secs_per_beat(composition, session)
		let comp_length = parseFloat(composition["len"]); // length in beats
		if(comp_length<=0) console.warn("Invalid composition length: " + comp_length)
		else comp_length *= secs_per_beat; // length in seconds
		let comp_end_time = comp_start_time + comp_length;
		//comp_end_time = Infinity;

		// Stop Everything else
		self.stop_all_loops()


		let gain = 1.0 // else the global gain

		// PLAYBACK GENERATOR
		// create new composition generator
		let generator = self.composition_generator(composition, comp_start_time, comp_end_time, gain, session);
		//console.log("comp_generator", comp_start_time, comp_end_time);
		let generate = function(){
			// continue the generator!!!!!
			generator.next()
			// calculate the current beat position, call the position callback
			let current = self.Sound.context.currentTime;
			if(current >= comp_end_time){
				// the composition has finished playing
				// STOP everything!!!
				console.log("stop everything");
				generator = null;
				self.stop_all_loops();
				if(typeof end_callback == "function"){
					end_callback();
				}
			}
		};
		// run the generator every generator_interval milliseconds
		let generator_timer_id = setInterval(generate, self.generator_interval);
		// remember the timer_id so we can stop it later
		self.playback_timer_ids.push(generator_timer_id);
		// run the first generator update
		generate();

		// PLAYHEAD
		// The playhead update callback
		if(typeof position_callback == "function"){
			let playhead_update = function(){
				let current = self.Sound.context.currentTime;
				let elapsed = current - comp_start_time
				let comp_position_seconds = elapsed % comp_length;
				let comp_position_beats = comp_position_seconds / secs_per_beat;
				//console.log("T", comp_start_time, current, elapsed, comp_length, comp_position_seconds)
				position_callback(comp_position_beats)
			}
			// Set the playhead to update every playhead_position_interval
			let playhead_timer_id = setInterval(playhead_update, self.playhead_position_interval);
			// Push it to the list, so we can stop it when we stop sound
			self.playback_timer_ids.push(playhead_timer_id);
			// run the first playhead update
			playhead_update();
		}


	}





	/////////////
	// DRAWING //
	/////////////

	// draw a single segment onto its canvas
	// probably on the step sequencer
	// sequencestep is the kind of segment you would find in pattern["sequence"][0]
	// solidcolor=true if you don't want to see the spectrogram

	this.draw_stepsequence_in_region = function(canvas_x, canvas_y, canvas_w, canvas_h,
		ctx, ss, session, block_len, offset){

		ctx.beginPath();
		ctx.rect(canvas_x, canvas_y, canvas_w, canvas_h);
		ctx.fillStyle = "black";
		ctx.fill();

		// What is the length of the stepsequence loop
		let ss_len = ss["len"]

		// What is the length of the stepsequence block (how many times repeated)
		if(!block_len){
			// if this stepsequence is in inside of a composition block
			// the block length might be different from the ss length
			// If shorter, cut the ss short
			// If longer, repeat and extend it
			block_len = ss["len"];
		}
		if(!offset){
			// if this stepsequence is inside of a composition bock
			// the start time might be non-zero (starts in the middle of the ss)
			// offset is measured in beats
			offset = 0;
		}

		// What are the loop start/end times
		// (not yet supported)



		// Okay start drawing

		// For each row, draw the hits according to their color
		let num_rows = ss["rows"].length
		let row_h = canvas_h / num_rows;
		for(let row in ss["rows"]){
			let pattern = ss["rows"][row];
			let row_y = row_h * row;
			for(let hit_index in pattern["sequence"]){
				let hit = pattern["sequence"][hit_index]
				// position / length
				let pos = hit["pos"];
				let len = hit["len"];
				if(pos >= block_len){
					// this segment goes beyond the border of the SS
					break; // end the row
				}
				if(len=="full"){
					len = ss["default_grid"]
				}
				let hit_w = canvas_w * (len / ss_len)
				let hit_x = canvas_w * (pos / ss_len)
				let hit_y = row_y
				let hit_h = row_h
				if(pos+len >= block_len){
					// this segment should only be drawn partially.
					let hit_w = canvas_w - hit_x
					// warning: this will squeeze the last segment
					// todo: draw a cut off version
				}
				//console.log("draw_segment_in_region", hit_x, hit_y, hit_w, hit_h,
				//		ctx, pattern, hit_index, session)
				this.draw_segment_in_region(hit_x, hit_y, hit_w, hit_h,
						ctx, pattern, hit_index, session, true);

			}
		}

		// Then tint the whole thing a certain color? (average?)

		// Add a border?


		//console.log("draw_step_sequence", canvas_w, canvas_h)
	}

	// Draw the stepsequence on this canvas
	// Fill the entire canvas
	this.draw_stepsequence = function(ctx, ss, session, block_len, offset){
		//console.log("draw_stepsequence");
		let canvas_w = ctx.canvas.width;
		let canvas_h = ctx.canvas.height;
		let canvas_x = 0;
		let canvas_y = 0;
		this.draw_stepsequence_in_region(canvas_x, canvas_y, canvas_w, canvas_h,
		ctx, ss, session, block_len, offset)
	}

	this.draw_composition = function(ctx, comp, session, block_len, offset,
		depths_until_solidcolor_comps=Infinity,
		depths_until_solidcolor_hits=Infinity){
		let canvas_w = ctx.canvas.width;
		let canvas_h = ctx.canvas.height;
		let canvas_x = 0;
		let canvas_y = 0;
		this.draw_composition_in_region(canvas_x, canvas_y, canvas_w, canvas_h,
		ctx, comp, session, block_len, offset,
		depths_until_solidcolor_comps,
		depths_until_solidcolor_hits);
	}

	this.draw_composition_in_region = function(canvas_x, canvas_y, canvas_w, canvas_h,
		ctx, comp, session, block_len, offset,
		depths_until_solidcolor_comps=Infinity,
		depths_until_solidcolor_hits=Infinity){
		// draw the things innside

		if(depths_until_solidcolor_comps<=0){
			// we've reached the bottom
			let fill_color = "hsla("+comp["hue"]+",60%,50%,1.0)";
			ctx.beginPath();
			ctx.rect(canvas_x, canvas_y, canvas_w, canvas_h);
			ctx.fillStyle = fill_color;
			ctx.fill();
			return
		}
		// Temporary:
		let fill_color = "#2f2f2f";
		ctx.beginPath();
		ctx.rect(canvas_x, canvas_y, canvas_w, canvas_h);
		ctx.fillStyle = fill_color;
		ctx.fill();
		// What is the length of the composition loop
		let comp_len = comp["len"]

		// What is the length of the composition block (how many times repeated)
		if(!block_len){
			// if this composition is in inside of another composition's block
			// the block length might be different from the comp length
			// If shorter, cut the ss short
			// If longer, repeat and extend it
			block_len = comp["len"];
		}
		if(!offset){
			// the start time might be non-zero (starts in the middle of the comp)
			// example: this composition is inside of another composition's block
			offset = 0;
		}

		// What are the loop start/end times
		// (not yet supported)

		// okay start drawing

		// Okay start drawing

		// For each row, draw the hits according to their color
		let num_rows = comp["rows"].length
		let row_h = canvas_h / num_rows;
		for(let row_num in comp["rows"]){
			let pattern = comp["rows"][row_num];
			let row_y = row_h * row_num + canvas_y;
			for(let block_index in pattern["blocks"]){
				let block = pattern["blocks"][block_index]
				let block_uuid = block["uuid"]
				// position / length
				let pos = block["pos"];
				let len = block["len"];
				if(pos >= block_len){
					// this block goes beyond the border of the composotion
					break; // end the row
				}
				let block_w = canvas_w * (len / comp_len)
				let block_x = canvas_w * (pos / comp_len) + canvas_x;
				let block_y = row_y
				let block_h = row_h
				if(pos+len >= block_len){
					// this block should only be drawn partially.
					let block_w = canvas_w - block_x
					// warning: this will squeeze the last block
					// todo: draw a cut off version
				}
				/*console.log("draw_block_in_region", block_x, block_y, block_w, block_h,
						ctx, comp, row_num, block_uuid, session, depths_until_solidcolor_comps - 1,
						depths_until_solidcolor_hits - 1)*/

				this.composer.draw_block_in_region(block_x, block_y, block_w, block_h,
						ctx, comp, block, session,
						depths_until_solidcolor_comps - 1,
						depths_until_solidcolor_hits - 1);


			}
		}

		// END : tint it

		/*
		context.shadowOffsetX = 500;
		context.shadowOffsetY = 0;
		context.shadowBlur = 15;
		context.shadowColor = 'rgba(30,30,30,1)';

		context.beginPath();
		context.arc(cw/2-500,ch/2,75,0,Math.PI*2);
		context.stroke();
		context.stroke();
		context.stroke();*/
		/*
		// This random 0-1 is based on the UUID
		let hasher = function(str) {
		  var hash = 0, i, chr;
		  if (str.length === 0) return hash;
		  for (i = 0; i < str.length; i++) {
		    chr   = str.charCodeAt(i);
		    hash  = ((hash << 5) - hash) + chr;
		    hash |= 0; // Convert to 32bit integer
		  }
		  return hash;
		};
		let s = hasher(JSON.stringify(comp));*/

		//ctx.filter = "sepia(1.0) hue-rotate("+hue+"deg) saturate(150%) brightness(1.1)";
		//ctx.globalCompositeOperation='source-atop';

		// Tint the whole thing by the hue
		/*ctx.beginPath();
		ctx.rect(canvas_x, canvas_y, canvas_w, canvas_h);
		ctx.fillStyle = "hsla("+comp["hue"]+",100%,50%,0.5)";
		ctx.fill();*/
		ctx.beginPath();
		// draw
		/*
		ctx.rect(canvas_x, canvas_y, canvas_w, 10); // top
		ctx.rect(canvas_x, canvas_h-10, canvas_w, 10); //bottom
		ctx.rect(canvas_x, canvas_y, 10, canvas_h); // left
		ctx.rect(canvas_w-10, canvas_y, canvas_w-10, canvas_h); // right
		ctx.fillStyle = fill_color;
		ctx.fill();
		*/
	}

	// For drawing a block inside of the composer
	this.composer.draw_block = function(ctx, composition, row_num, block_uuid, session,
											depths_until_solidcolor_comps=1,
											depths_until_solidcolor_hits=1){
		let canvas_x = 0;
		let canvas_y = 0;
		let canvas_w = ctx.canvas.width;
		let canvas_h = ctx.canvas.height;

		// GET THE BLOCK FROM THE UUID
		let blocks = composition["rows"][row_num]["blocks"];
		let block = undefined
		// Look for the block in this row with that UUID
		for(let b in blocks){
			if(blocks[b]["uuid"]==block_uuid){
				block = blocks[b]
				break;
			}
		}
		if(!block){
			return console.error("Block_uuid", block_uuid, "is not in row", row_num, "in this composition", composition)
		}

		// COLOR THE BLOCK
		/*let is_comp = self.composer.block.is_composition(block["block_id"]);
		if(is_comp){
			// This random 0-1 is based on the UUID
			let rand = '0.'+Math.sin(block["uuid"].charCodeAt(0)+1).toString().substr(6)
			console.log("UUID", block["uuid"], rand);
			// Which gives us a random hue
			// I think sepia is a hue of 30 degrees
			let hue = Math.floor(rand*360);
			ctx.filter = "sepia(1.0) hue-rotate("+hue+"deg) saturate(150%) brightness(1.1)";
		}*/

		// DRAW THE BLOCK

		this.draw_block_in_region(canvas_x, canvas_y, canvas_w, canvas_h,
		ctx, composition, block, session,
		depths_until_solidcolor_comps,
		depths_until_solidcolor_hits);

		/*if(is_comp){
			ctx.filter = "none";
		}*/
	}

	// Either for drawing a full composer block
	// Or for drawing a block within a block
	this.composer.draw_block_in_region = function(canvas_x, canvas_y, canvas_w, canvas_h,
		ctx, composition, block, session,
		depths_until_solidcolor_comps=Infinity,
		depths_until_solidcolor_hits=Infinity){


		let block_id = block["block_id"];
		let block_len = block["len"]; // length of the block, not the loop length of the thing inside
		let offset = block["offset"]; // if offset>0, the thing starts in the middle of its loop
		let thing = self.composer.block.get(block_id, session);
		//console.log("draw_block", block_id)
		if(this.block.is_pattern(block_id)){
			// pattern
			let solidcolor = (depths_until_solidcolor_hits<=0)
			if(thing["type"]=="hit"){
				// This is terrible at the moment
				self.draw_segment_in_region(canvas_x, canvas_y, canvas_w, canvas_h,
										ctx, thing, 0, session, solidcolor);
			}else{
				self.draw_pattern_in_region(canvas_x, canvas_y, canvas_w, canvas_h,
										ctx, thing, session, block_len, offset, solidcolor);
			}
			// todo: accept a len parameter

		}else if(this.block.is_stepsequence(block_id)){
			// step sequence
			self.draw_stepsequence_in_region(canvas_x, canvas_y, canvas_w, canvas_h,
											ctx, thing, session, block_len, offset);
			// todo: accept a len parameter

		}else if(this.block.is_composition(block_id)){
			// composition
			self.draw_composition_in_region(canvas_x, canvas_y, canvas_w, canvas_h,
											ctx, thing, session, block_len, offset,
											depths_until_solidcolor_comps,
											depths_until_solidcolor_hits);
			// todo: accept a len parameter
		}
	}

	// front end calls this to draw hits in the step sequencer
	this.stepsequencer.draw_hit = function(ctx, stepsequence, row_num, hit_index, session, solidcolor){
		let pattern = stepsequence["rows"][row_num]
		self.draw_segment(ctx, pattern, hit_index, session, solidcolor);
	}

	this.draw_segment_in_region = function(canvas_x, canvas_y, canvas_w, canvas_h,
		ctx, pattern, hit_index, session, solidcolor=false){

		let hit = pattern["sequence"][hit_index]
		let song_id = hit["seg"][0]
		let segment_id = hit["seg"][1]
		let segment = this.analysis[song_id]["segments"][segment_id];
		//console.log("draw_segment_in_region2", canvas_x, canvas_y, canvas_w, canvas_h,
		//ctx, pattern, hit_index, session, solidcolor);
		if(solidcolor){
			let hue = 0;
			if("ro" in segment){
				let rolloff = segment["ro"];
				// paint it the rolloff
				hue = rolloff
			}else if("palette_hues" in segment){
				// paint it the palette_hue color (earlier version)
				let palette_index = segment["segment_id"].indexof(segment_id);
				hue = segment["palette_hues"][palette_index]
			}
			// Color it according to rolloff
			ctx.beginPath();
			ctx.rect(canvas_x, canvas_y, canvas_w, canvas_h);

			// desaturate the greens
			hue *= 360.0
			let saturate = "60%";
			if(hue>50 && hue<150){ saturate = "35%"; }

			ctx.fillStyle = 'hsl('+hue+','+saturate+',60%)';
			ctx.fill();
		}else{
			// hack
			// copy the pattern
			// remove the other sequences
			let fake_pattern = JSON.parse(JSON.stringify(pattern))
			fake_pattern["len"] = "full";
			hit = JSON.parse(JSON.stringify(hit)) // clone
			hit["pos"] = 0;
			hit["len"] = "full";
			fake_pattern["sequence"] = [hit]
			fake_pattern["type"] = "hit";
			//console.log("draw_pattern_in_region", canvas_x, canvas_y, canvas_w, canvas_h)
			this.draw_pattern_in_region(canvas_x, canvas_y, canvas_w, canvas_h,
				ctx, fake_pattern, session, "full", 0, solidcolor)
		}
	}

	// fills the whole canvas with the segment
	this.draw_segment = function(ctx, pattern, hit_index, session, solidcolor=false){
		let canvas_w = ctx.canvas.width;
		let canvas_h = ctx.canvas.height;
		let canvas_x = 0
		let canvas_y = 0
		self.draw_segment_in_region(canvas_x, canvas_y, canvas_w, canvas_h, ctx, pattern, hit_index, session, solidcolor)
	}

	// draws the pattern in the xywh region of the canvas
	this.draw_pattern_in_region = function(canvas_x, canvas_y, canvas_w, canvas_h,
		ctx, pattern, session, block_len, offset, solidcolor=false){

		let seg, step, analysis_id, segment_id, segment, song_id;
		let sx, sy, sWidth, sHeight, dx, dy, dWidth, dHeight;
		let pattern_length, pattern_length_secs, duration;
		let chaos, pool, gain, pos, layer, gaps, len;
		let img, img_start, img_end;
		let secs_per_beat = this.calculate_secs_per_beat(pattern, session);

		//console.log("draw_pattern_in_region", block_len, pattern["len"], solidcolor);

		if(!block_len){
			// if this pattern is in inside of a composition block
			// the block length might be different from the pattern length
			// If shorter, cut the pattern short
			// If longer, repeat and extend it
			block_len = pattern["len"]; // usually a float, but might be the string "full"
		}
		if(!offset){
			// if this pattern is inside of a composition bock
			// the start time might be non-zero (starts in the middle of the pattern)
			offset = 0;
		}
		//console.log(pattern);

		// Black Background
		ctx.beginPath();
		ctx.rect(canvas_x, canvas_y, canvas_w, canvas_h);
		ctx.fillStyle = "black";
		ctx.fill();

		if(pattern["type"]=="loop"){
			pattern_length_secs = parseFloat(pattern["len"]) * secs_per_beat;
		}

		//var img = this.hires_spectrograms[song_id][0];
		//ctx.drawImage(img, 0, 0, 150, 150);
		//ctx.drawImage(img, sx, sy, sWidth, sHeight, dx, dy, dWidth, dHeight);



		for(let i in pattern["sequence"]){
			step = pattern["sequence"][i];
			[chaos, pool, gain, pos, layer, gaps, len] = this.compute_step_params(step, pattern, session);
			if(chaos){
				// random?
				seg = step["seg"]
			}else{
				seg = step["seg"]
			}
			song_id = seg[0];
			segment_id = seg[1];

			//console.log(seg);
			segment = this.analysis[song_id]["segments"][segment_id];


			duration = segment["duration"]; //default
			if(len=="full"){
				// play until duration
				duration = segment["duration"];

			}else{
				len = parseFloat(len);
				if(gaps=="gaps"){
					if(len*secs_per_beat < segment["duration"]){
						duration = len*secs_per_beat;
					}else{
						duration = segment["duration"];
					}
				}else if(gaps=="flows"){
					duration = len*secs_per_beat;
				}else if(gaps=="stretch"){
					// incompete
				}
			}

			// Compute the length of the PATTERN
			if(pattern["type"] == "hit"){
				if(pattern["len"]=="full"){
					// length is length of segment
					// todo: fix for multi-segment hits
					pattern_length_secs = duration
				}else{
					pattern_length_secs = parseFloat(pattern["len"]) * secs_per_beat;
				}
			}
			//console.log(pattern_length_secs, duration, pattern["len"], secs_per_beat)
			// start drawing



			let total_width = 0;
			let spectrogram_height = this.hires_spectrograms[song_id][0].height;
			let crossovers = [0]
			// pick the correct image
			for(let i in this.hires_spectrograms[song_id]){
				total_width += this.hires_spectrograms[song_id][i].width;
				crossovers.push(total_width)
			}
			let lindx = this.analysis[song_id]["segments"].length - 1;
			let lseg = this.analysis[song_id]["segments"][lindx];
			let song_duration_secs = lseg["start"]+lseg["duration"];
			let ratio_s = total_width / song_duration_secs; // turn seconds into specotrogram pixel widths
			let ratio_c = canvas_w / pattern_length_secs; // turn seconds into canvas pixel widths
			let ssp = segment["start"] * ratio_s; // start pixel
			let swp = duration * ratio_s; // width in pixels

			sx =  ssp;
			sy = 0;
			sWidth = swp;
			sHeight = spectrogram_height

			dx = pos * secs_per_beat * ratio_c + canvas_x;
			dy = canvas_y
			dWidth = duration * ratio_c;
			dHeight = canvas_h

			if(this.hires_spectrograms[song_id].length == 1){
				img = this.hires_spectrograms[song_id][0];
				ctx.drawImage(img, sx, sy, sWidth, sHeight, dx, dy, dWidth, dHeight);
				//console.log("DD", img, sx, sy, sWidth, sHeight, dx, dy, dWidth, dHeight)
			}else{
				// there are multiple spectrograms hires
				// find which hires image has the start of the segment
				let i, j;
				for(i in crossovers){
					if(crossovers[i] <= ssp){
						break;
					}
				}
				// find which hires spectrogram image has the end of the segment
				for(j in crossovers){
					if(crossovers[j] < ssp + swp){
						break;
					}
				}

				if(i==j){
					// segment is contained in the same spectrograms
					sx = ssp - crossovers[i];
					img = this.hires_spectrograms[song_id][i];
					ctx.drawImage(img, sx, sy, sWidth, sHeight, dx, dy, dWidth, dHeight);
					//console.log("CC", img_start, sx, sy, sWidth, sHeight, dx, dy, dWidth, dHeight)

				}else{
					// segment crosses over two spectrograms
					sx = ssp - crossovers[i];
					img_start = this.hires_spectrograms[song_id][i];
					sWidth = img_start.width;
					ctx.drawImage(img_start, sx, sy, sWidth, sHeight, dx, dy, dWidth, dHeight);

					//console.log("BB", img_start, sx, sy, sWidth, sHeight, dx, dy, dWidth, dHeight)

					sWidth = (ssp + swp) - crossovers[j]
					img_end = this.hires_spectrograms[song_id][j];
					sx = 0;
					ctx.drawImage(img_end,   sx, sy, sWidth, sHeight, dx, dy, dWidth, dHeight);
					//console.log("AA", img_end, sx, sy, sWidth, sHeight, dx, dy, dWidth, dHeight)
					// one segment should never be longer than the length of a hires_spectrogram (~8 minutes),
					// so we provide no support for segments which need three spectrograms to render
				}
			}
		}
	}

	// draw the given pattern on the canvas context
	// solidcolor=true not yet supported
	this.draw_pattern = function(ctx, pattern, session, block_len, offset, solidcolor=false){
		let w = ctx.canvas.width;
		let h = ctx.canvas.height;
		let x = 0
		let y = 0
		this.draw_pattern_in_region(x, y, w, h, ctx, pattern, session, block_len, offset, solidcolor)
	}


	////////
	// UI //
	////////

	/* still needs to be fixed */

	// Given the highlighted range, return the pool of segments for one song
	this.make_pool_from_song_range = function(song_id, startPercent, endPercent) {
		//all segments
		const segments = this.analysis[song_id].segments;
		//placeholder for assigning the final answer
		let beginningSegment = 0
		let lastSegment = (segments.length - 1)

		let songDuration = segments[lastSegment].start + segments[lastSegment].duration;

		//while loop expressions
		let searchingStart = true;
		let searchingEnd = true;
		//highlight converted to decimal
		const start = (startPercent / 100);
		const end = (endPercent / 100);
		//calculate the second as deemed by highlight (actual second)
		const startSecond = (start * songDuration)
		const endSecond = (end * songDuration)
		let segmentStart = beginningSegment;
		let segmentEnd = lastSegment;
		//round segment to integer
		if (Math.round(start * segments.length) - 1 >= 0) {
			segmentStart = (Math.round(start * segments.length) - 1)
		} else {
			segmentStart = 0;
		}
		if (Math.round(end * segments.length) - 1 <= segments.length - 1) {
			segmentEnd = (Math.round(end * segments.length) - 1)
		} else {
			segmentEnd = (segments.length - 1)
		}
		//see that segments start time
		const approxStart = segments[segmentStart].start
		const approxEnd = segments[segmentEnd].start
		//compare to highlight calculation if startSecond is lower then approxStart push SegmentStart - 1 endSecond higher push segmentEnd + 1
		while (searchingStart) {
			if (segmentStart < 0) {
				searchingStart = false;
				beginningSegment = 0;
			} else if (segments[segmentStart].start > startSecond) {
				segmentStart--
			} else if (segments[segmentStart].start <= startSecond) {
				searchingStart = false;
				beginningSegment = segmentStart;
			}
		}
		while (searchingEnd) {
			if (segmentEnd >= segments.length) {
				searchingEnd = false;
				lastSegment = segments.length - 1;
			} else if (segments[segmentEnd].start < endSecond) {
				segmentEnd++
			} else if (segments[segmentEnd].start >= endSecond) {
				searchingEnd = false;
				lastSegment = segmentEnd;
			}
		}

		let pool = []
		for(let i = beginningSegment; i<=lastSegment; i++){
			pool.push([song_id, i]);
		}
		return pool

	}


}

// Generate a random hex color
function randomHex() {
    var letters = '0123456789ABCDEF';
    var color = '#';
    for (var i = 0; i < 6; i++) {
        color += letters[Math.floor(Math.random() * 16)];
    }
    return color;
}


module.exports = CrowdRemixEngine__old;
