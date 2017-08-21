
 /* eslint-disable */

function CrowdRemixPlayback(_self){
	let self = _self;

	// stop all sound
	// clear all loop generators
	self.stop_all_sound = function(){
		self.clear_playback_timers();
		self.Sound.stopAll();
	}

	// stop all pattern playback, but let non-pattern hits keep playing
	self.stop_all_loops = function(){
		self.clear_playback_timers();
		self.Sound.stopLayer(1);
	}

	// Clear the playback generators
	self.clear_playback_timers = function(){
		for(let i in self.playback_timer_ids){
			clearInterval(self.playback_timer_ids[i])
		}
	}

	// Clear the generators, clear any queued segments, 
	// but let any segments currently playing fade out
	// fadeout_time [seconds]
	self.fade_out = function(fadeout_time=0.5){
		self.clear_playback_timers()
		self.Sound.fadeOut(fadeout_time)
	}

	// play the hit
	// This is a free hit which is not contained in a pattern or master_composition
	self.play_hit = function(hit, session){
		window.__CrowdRemixSession = session; // for debugging
		let song_id, segment_id;
		let now = self.Sound.context.currentTime;

		let chaos = hit["chaos"];
		let pool = hit["pool"];
		if(chaos){
			// chaos true: pick a random segment from the pool
			[song_id, segment_id] = self.fish_segment_from_pool(pool)
		}else{
			// chaos false: pick the saved segment
			[song_id, segment_id] = hit["seg"];
		}
		// this is the segment we're going to play
		let segment = self.analysis[song_id]["segments"][segment_id];
		let duration = segment["duration"];
		let start = segment["start"];
		let gain = hit["gain"] * session["global_gain"];
		let playseg = {
			"when": now,
			"duration": duration,
			"start": start,
			"song_id": song_id,
			"gain": gain,
			"layer": 0 // free hits on layer 0, everything else layer 1
		};
		//console.log(playseg);
		self.Sound.queueSegment(playseg);
	}



	// runs inside of a timer
	// queues up the next generator_window seconds worth of segments
	// yield means "pause the function here", calling .next() resumes the function
	self.pattern_generator = function*(pattern, pattern_offset, pattern_start_time, pattern_end_time, parent_gain, session, silent_attribution_segments_run){
		let secs_per_beat = self.calculate_secs_per_beat(pattern, session)
		let pattern_length = parseFloat(pattern["len"]);
		// pattern_offset is the beat# (float) where the pattern should begin		
		//console.log("pattern_generator.pattern_offset", pattern_offset)

		pattern_offset = isNaN(pattern_offset)?0:parseFloat(pattern_offset);
		// If pattern_offset is greater than pattern_len, that's okay.
		// Pretend the pattern had looped around and calculate the new offset. 
		// If offset is less than 0, that's okay. 
		// Modulo fixes all. 
		pattern_offset %= pattern_length;
		// length in beats of the pattern (not the block)
		// The block might be shorter in length, in which case the pattern will end early
		// If the block is longer in length, the pattern will loop to fill the space
		if(pattern_length<=0){ 
			console.error("Invalid pattern length: " + pattern_length);
			return;
		}
		let pattern_duration = pattern_length * secs_per_beat; // length in seconds

		let loop_start_time = pattern_start_time;
		let earliest_event = Infinity;
		//console.log("whiletrue", pattern.hue, pattern_end_time, secs_per_beat, pattern_duration, loop_start_time)
		while(true){
			// loop the pattern (until pattern_end_time)

			//console.log("------\nNew Loop\n------", loop_start_time, pattern_start_time);

			// patterns don't always loop around, but when they do, first_loop becomes false. 
			let first_loop = (loop_start_time == pattern_start_time)

			// We look through every row
			// and call any block generator that's about to play
			// and .next() any block generator that's currently playing
			// We remember the current block index of each 

			// initialize:
			let row_block_indexes = [];
			// We remember the current block generator of the row
			// (there can only be one block per row at a time)
			let row_block_generators = [];
			let rows = pattern["rows"];
			// how many rows still have blocks that haven't completed yet?
			// when this decrements to 0, we know that all the blocks have completed
			// let unfinished_rows = rows.length;
			
			// how many rows have completed? 
			// when this fills up, we know all blocks have completed
			let finished_rows = [];
			for(let r in rows){
				row_block_indexes[r] = 0;
				// 0 means start at the first block in the row
				row_block_generators[r] = null;
				// null means the this is a new pattern loop
				// OR it means the last block finished and the next block hasn't started

				if(rows[r]["blocks"].length == 0){
					// this row is done!
					finished_rows.push(r);
				}
			}

			while(true){
				// Go through all the rows one-by-one, until all the blocks are done
				// start all new block generators
				// and .next() all the existing generators
				// The block generators will queue the next generator_window seconds worth of stuff

				//console.log("---Row Cycle---", pattern.hue);

				// The earliest event time for anything within anything in this row cycle
				earliest_event = Infinity
				// Set the earliest time to the end of the pattern
				// let earliest_event_in_row_cycle = loop_start_time + pattern_duration;

				for(let r in rows){
					//console.log("row r", r, pattern.hue, finished_rows)
					if(finished_rows.indexOf(r)!=-1){
						// This row has finished. Ignore it
						//console.log("this row has finished, ignore it")
						continue;
					}

					//console.log(row_block_indexes)

					let row = rows[r]

					// This loop is only significant if pattern_offset > 0 
					// Loop through and skip any initial blocks that came before the offset
					let skip_row = false; // check if this row has already finished
					let i, block, pos, block_length;
					while(true){
						i = row_block_indexes[r];
						if(i >= row["blocks"].length){
							// Ooops, at the end of the row
							//console.log(i, "Ooops, at the end of the row")
							finished_rows.push(r);
							skip_row = true;
							break;
						}
						block = row["blocks"][i];
						pos = block["pos"];
						block_length = block["len"];
						if(pos >= pattern["len"]){
							// Even though this block is present in the row,
							// It starts *after* the pattern end point
							// So it's "hidden" and doesn't play
							// I think this means the row is done, and maybe should be marked as done?
							//console.log("Even though this block is present in the row, it's hidden so dont play it")
							finished_rows.push(r);
							skip_row = true;
							break;
						}

						//console.log(pattern_offset, pos, block_length, first_loop)

						// Skip any block that comes before the offset
						if(first_loop && (pos + block_length < pattern_offset)){
							// This block is "hidden" because it ended before the offset
							// Advance the row to the next block
							//console.log(r, "ended before the offset")
							row_block_indexes[r]+=1;
							continue; // loop to the next block
						}
						// we found a legit block 
						break;
					}
					if(skip_row) continue; // This row is totally finished



					if(row_block_generators[r] === null){
						// BLOCK HASNT STARTED YET
						// Start time for the block:

						let block_start_time = pos * secs_per_beat + loop_start_time;
						if(first_loop) block_start_time -= pattern_offset * secs_per_beat;
						if(block_start_time < earliest_event){
							earliest_event = block_start_time
						}
						//console.log(r, "ee1", earliest_event, block_start_time);
						if(block_start_time - self.generator_window > self.Sound.context.currentTime){
							// this next block is too far ahead
							// It starts beyond the generator_window
							//console.log(r, "Too Far ahead", pattern_start_time, pattern.hue);
							continue;
						}

						// Calculate the block end time
						let block_end_time = block_start_time + (block["len"] * secs_per_beat);
						// TODO: support block offsets
						let block_offset = isNaN(block["offset"])?0:parseFloat(block["offset"]);
						let gain = isNaN(row["gain"])? parent_gain : parent_gain*row["gain"];
						// START THE BLOCK:
						//console.log("Start the block!");
						//console.log("block", block_start_time, pattern.hue, self.Sound.context.currentTime)
						row_block_generators[r] = self.get_block_generator(block, block_offset, block_start_time, block_end_time, gain, session, silent_attribution_segments_run)
						// A new block has started
						//console.log("new block has started", row_block_generators[r] );
						
					}

					// BLOCK HAS ALREADY STARTED:
					// Continue advancing block
					// Advancing queues the next self.generator_window seconds of the block
					let block_gen = row_block_generators[r];
					//console.log(r, "row block geneators", row_block_generators);

					let g = block_gen.next().value;
					////console.log("block_gen_next", g);
					// block_generator needs to yield an object with
					// "has_block_completed": boolean
					// "earliest_event_when": seconds
					
					// Update earliest event
					if(g["earliest_event"] < earliest_event){
						earliest_event = g["earliest_event"]
					}

					if(g["has_block_completed"]){
						//console.log("block has finished");
						// This block has finished advancing and queuing
						// destroy the generator
						row_block_generators[r] = null;
						// Advance the row to the next block
						row_block_indexes[r]+=1;
						//continue;
					}else{
						// block has not finished
					}

				}

				if(finished_rows.length == rows.length){
					// all the blocks in this pattern have queued everything

					//console.log(pattern_start_time, pattern["len"], "all the blocks in this pattern have queued everything", pattern.hue)
					break; // break all the row cycles
				}

				if(earliest_event === Infinity){
					// There are still blocks to play 
					// Yet nothing was queued
					// Run it again
					//console.log("earliest_event was infinity")
					continue
				}

				if((pattern_end_time !== Infinity) &&
					(earliest_event !== Infinity) &&
					(earliest_event >= pattern_end_time)){
					// If the earliest event happens after pattern_end_time
					// Then we've reached the end of the pattern block
					// Break all the row cycles
					//console.log("we've reached the end of the pattern block")
					break;
				}

				//console.log("finished one row cycle..", earliest_event, earliest_event - self.generator_window, self.Sound.context.currentTime)
				// We just finished one row cycle
				// We should pause the generator if...
				// the earliest event started > generator_window seconds from now
				while(earliest_event - self.generator_window > self.Sound.context.currentTime){
					//console.log(pattern_start_time, pattern["len"], "yield1", earliest_event, pattern.hue);
					yield {
						"earliest_event": earliest_event,
						"has_block_completed": false
					}
				}


			}
			// All the blocks have been queued

			// Do we repeat the pattern? And start the Loop over?

			// Calculate when the next iteration of the loop would start
			if(first_loop && pattern_offset != 0){
				//console.log("Adjust offset", loop_start_time, (pattern_length - pattern_offset) * secs_per_beat);
				// Adjust for the offset
				loop_start_time += (pattern_length - pattern_offset) * secs_per_beat;
			}else{
				//console.log("Add the duration as usual", loop_start_time, pattern_duration);
				// Just add the duration as usual 
				loop_start_time += pattern_duration;
			}
			//console.log(pattern_start_time, pattern["len"], "All the blocks have been queued", loop_start_time, pattern_end_time)

			if(loop_start_time >= pattern_end_time){
				// THE END
				//console.log(pattern_start_time, pattern["len"], "The end", loop_start_time, pattern_end_time, pattern.hue);
				break;
			}
			// We're going to repeat the pattern
			// Check if we should wait until we loop around
			while(loop_start_time - self.generator_window > self.Sound.context.currentTime){
				//console.log(pattern_start_time, pattern["len"], "yield3", loop_start_time, pattern.hue);
				yield {
					"earliest_event": loop_start_time,
					"has_block_completed": false
				}
			}
		}
		earliest_event = earliest_event<pattern_end_time?earliest_event:pattern_end_time;
		//console.log("ee3",earliest_event, pattern_end_time, pattern.hue)
		//console.log(pattern_start_time, pattern["len"], "yield2", earliest_event, pattern_end_time, pattern.hue);

		yield {
			"earliest_event": earliest_event, // i think this is ok to do
			"has_block_completed": true // we're DONE
		}
	}

	self.get_block_generator = function(block, offset, block_start_time, block_end_time, parent_gain, session, silent_attribution_segments_run){
		// console.log("block generator", pattern_block, block_start_time, block_end_time, parent_gain);
		let gain = isNaN(block["gain"])? parent_gain : block["gain"]*parent_gain; // multiply the block gain (if set) by the gain passed down from the parent

		if(block["type"]==="hit"){
			let hit_object;
			// this is a hit block
			if(typeof block["hit"] === "string"){
				// this is  a reference pointer to a hit object in the session
				// We dont want that
				console.error("Block hit needs to be a full hit, not a hit_id", block);
				// let hit_id = block["hit"]
				// hit_object = session["hits"][hit_id];
			}else if(block["hit"] instanceof Object){
				// This is a real hit object
				hit_object = block["hit"];
			}
			return self.hit_generator(hit_object, block_start_time, block_end_time, gain, session, silent_attribution_segments_run);
		}else if(block["type"]==="pattern"){
			// this is a pattern block
			let pattern_object;
			if(typeof block["pattern"] === "string"){
				// this is  a reference pointer to the pattern object in the session
				let pattern_id = block["pattern"]
				pattern_object = session["patterns"][pattern_id];
			}else if(block["pattern"] instanceof Object){
				// This is a real hit object
				console.error("Block patterns need to be pattern_id pointers, not full patterns", block);
			}
			return self.pattern_generator(pattern_object, offset, block_start_time, block_end_time, gain, session, silent_attribution_segments_run);
		}else{
			console.error("Block has unknown type", block)
		}
	}

	// Runs inside of the pattern_generator
	// These are hits that fall within a parent pattern
	// yield means "pause the function here", calling .next() resumes the function
	// start_time and end_time are in seconds
	self.hit_generator = function*(hit, start_time, end_time, parent_gain, session, silent_attribution_segments_run){
		// play the hit
		let song_id, segment_id, play_duration;
		let gaps = hit["gaps"];
		let chaos = hit["chaos"];
		let pool = hit["pool"];
		if(chaos){
			// chaos true: pick a random segment from the pool
			[song_id, segment_id] = self.fish_segment_from_pool(pool)
		}else{
			// chaos false: pick the saved segment
			[song_id, segment_id] = hit["seg"];
		}
		// this is the segment we're going to play
		let segment = self.analysis[song_id]["segments"][segment_id];
		// duration in seconds of the block
		let block_duration = end_time - start_time;
		// segment start
		let start = segment["start"]
		if(gaps === "gaps"){
			// gaps: limit the segment to the segment length
			if(block_duration < segment["duration"]){
				// the segment is longer than the block, cut it short
				play_duration = block_duration;
			}else{
				// the segment is shorter than the block, use its own duration
				play_duration = segment["duration"];
			}
		}else if(gaps === "flows"){
			// flows: let the segment fill the duration
			play_duration = block_duration
		}else{
			console.error("Invalid gaps value", hit, gaps);
		}
		// If hit gain is set, multiply the hit gain by the gain passed down
		let gain = isNaN(hit["gain"]) ? parent_gain : hit["gain"]*parent_gain;
		// Construct the playseg
		// TODO: add time stretch parameter(s)
		let playseg = {
			"when": start_time,
			"duration": play_duration,
			"start": start,
			"song_id": song_id,
			"gain": gain,
			"layer": 1 // free hits on layer 0, everything else layer 1
			// we're inside of a pattern or master_composition right now, so layer 1
		};
		// Give it to the sound engine
		//console.log("PLAY", playseg)
		if(silent_attribution_segments_run){
			// Don't play the audio, instead save this segment to the attribution segments list
			// This is used when calculating the pie
			let attrseg = [song_id, start, play_duration];
			self.attribution_segments.push(attrseg);
		}else{
			// Normal playback
			self.Sound.queueSegment(playseg);
		}
		yield {
			"earliest_event": start_time,
			"has_block_completed": true
		}
		return;
		// Does the hit generator need to be a generator?
		// Not really. Maybe in the future.
		// Return immediately
	}

	// playback of the pattern (or master composition)
	// offset is the beat# (float) where playback begins
	// A pattern has rows
	// Rows have blocks
	// Blocks have start positions and lengths
	// A block is a reference to a pattern or hit in the session
	// That's right, patterns-within-patterns with arbitrary depth
	// Assume a patterns does not contain itself.
	self.play_pattern = function(pattern, pattern_offset, loop_forever, session, position_callback, end_callback){
		//console.log("play_pattern", pattern_offset)
		window.__CrowdRemixSession = session; // for debugging
		//console.log("play pattern", pattern, start_position, loop_forever, session, position_callback, end_callback)
		//console.log(typeof position_callback)
		//console.log(position_callback)
		// start/length/end timing
		let pattern_start_time = self.Sound.context.currentTime;
		// scoot it ahead a delay
		// otherwise the beginning might get cut off (while the generator is prepping)
		// this is only helpful for the user playback ui
		// we don't need this when offlineRendering WAVs
		pattern_start_time += self.play_pattern_starting_delay
		// calculate seconds per beat
		let secs_per_beat = self.calculate_secs_per_beat(pattern, session)
		let pattern_length = parseFloat(pattern["len"]); // length in beats
		if(pattern_length<=0){
			console.error("Invalid pattern length: " + pattern_length)
			return;
		}
		let pattern_duration = pattern_length * secs_per_beat; // length in seconds

		let pattern_end_time;
		if(loop_forever){
			// If loop_forever is true, this will play forever
			pattern_end_time = Infinity;
		}else{
			// Else, play until the end of the composition
			pattern_end_time = pattern_start_time + pattern_duration;
		}
		//console.log("patern_end_time", pattern_end_time)
		//console.log("pattern_length", pattern_length)
		//pattern_end_time = Infinity;

		//console.log("play_pattern.pattern_offset",pattern_offset )
		// pattern_offset is the beat# (float) where the playback should begin
		pattern_offset = isNaN(pattern_offset)?0:parseFloat(pattern_offset);
		// If pattern_offset is greater than pattern_length, that's okay.
		// Pretend the pattern had looped around and calculate the new offset. 
		// If offset is less than 0, that's okay. 
		// Modulo fixes all. 
		pattern_offset %= pattern_length;

		// Stop Everything else
		self.stop_all_loops()

		let gain = session["global_gain"];

		// PLAYBACK GENERATOR
		// create new pattern generator
		let generator = self.pattern_generator(pattern, pattern_offset, pattern_start_time, pattern_end_time, gain, session, false);
		//console.log("pattern_generator", pattern_start_time, pattern_end_time);
		let generate = function(){
			// continue the generator!!!!!
			generator.next()
			// calculate the current beat position, call the position callback
			let current = self.Sound.context.currentTime;
			//console.log(current, "current")
			if(current >= pattern_end_time){
				// the pattern has finished playing
				// STOP everything!!!
				//console.log("stop everything");
				generator = null;
				self.stop_all_loops();
				if(typeof end_callback === "function"){
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
		if(typeof position_callback === "function"){
			let playhead_update = function(){
				let current = self.Sound.context.currentTime;
				let elapsed = current - pattern_start_time;
				let beats_elapsed = elapsed / secs_per_beat;
				let pattern_position_beats = (beats_elapsed + pattern_offset) % pattern_length;
				//console.log("T", pattern_start_time, current, elapsed, pattern_length, pattern_position_seconds)
				position_callback(pattern_position_beats)
			}
			// Set the playhead to update every playhead_position_interval
			let playhead_timer_id = setInterval(playhead_update, self.playhead_position_interval);
			// Push it to the list, so we can stop it when we stop sound
			self.playback_timer_ids.push(playhead_timer_id);
			// run the first playhead update
			playhead_update();
		}
	}




}

