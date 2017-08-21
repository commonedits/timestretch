
 /* eslint-disable */

function CrowdRemixHitsPatterns(_self){
	let self = _self;

	// The purpose of the seed is to keep a predictable randomness when changing features in the sampler
	// So that you can move between pattern A and B with minimal changes;
	self.seed = 1;
	// Seeded randomness
	self.random = function(seed) {
	    var x = Math.sin(seed) * 10000;
	    return x - Math.floor(x);
	}
	// Call this when hitting refresh
	self.refresh_seed = function(){
		self.seed+=1;
	}

	//////////////
	//   HITS   //
	//////////////

	/*

	Hit
		pool: pool
		chaos: true/false
		gain: 1.0
		seg: [song_id, segment_id]
		gaps: "gaps" or "flows" or "stretch"

	Pool
		Is a list of segments and/or ranges
		    segments
		        [song_id, [segment_id, segment_id]]
		    ranges
		        [song_id, "s", 10, 20] (segments 10 to 20, inclusive, on the [s]ong selector)
		        [song_id, "t", 100, 200] (segments 100 to 200, inclusive, on the [t]imbre spectrum)
		        [song_id, "m", 0.245,0.546,5] [on the tsne [m]ap at X and Y coords, with 5 neighbors]
		If it’s an array of two numbers, you know it’s a list of segments
		If it’s four or five things, you know it’s a range
	*/

	// Validates that the pool has a valid object structure
	// Returns true/false
	self.validate_pool = function (pool){
		if(!(pool instanceof Array)) {
			console.error("Warning: Pool is not array", pool);
			return false; // can't be empty
		}
		if(pool.length===0){
			console.error("Warning: Pool is empty", pool);
			return false; // can't be empty
		}
		for(let i in pool){
		// for each element
			let p = pool[i]
			if(!(p instanceof Array)){
				console.error("Warning: Pool must be an array of subpools (which themselves are arrays)", p);
				return false;
			}
			if(p.length===2){
			// if length 2, it's a list of segment ids from that song
				if(parseInt(p[0],10)!==p[0]){
					console.error("Warning: Subpool must be [song_id(int), [segment_id, ...]]", p);
					return false;
				}
				if(!(p[1] instanceof Array)){
					console.error("Warning: Subpool must be [song_id, [segment_id, segment_id, ...)]]", p);
					return false;
				}
				for(let s in p[1]){
					if(parseInt(p[1][s],10)!==p[1][s]){
						console.error("Warning: Subpool must be [song_id(int), [segment_id(int), ...]]", p, s);
						return false;
					}
				}
				// [song_id, [segment_id, segment_id]]
			}else if(p.length===4){
			// if length 4, it's a 1D Range selector
				if(parseInt(p[0],10)!==p[0]){
					console.error("Warning: Subpool range must be [song_id(int), 's' or 't', start, end]]", p);
					return false;
				}
				if(parseInt(p[2],10)!==p[2]){
					console.error("Warning: Subpool range must be [song_id, 's' or 't', start(int), end]]", p);
					return false;
				}
				if(parseInt(p[3],10)!==p[3]){
					console.error("Warning: Subpool range must be [song_id, 's' or 't', start, end(int)]]", p);
					return false;
				}
				if(!(p[1] === "s" || p[1] === "t")){
					console.error("Warning: Subpool range spectrum_selector must be 's' or 't'", p);
					return false;
				}
				// [s]ong or [t]imbre spectrum
				// song_id, spectrum_selector, start, end
			}else if(p.length===5){
			// if length 5, it's a TSNE [M]ap
				if(p[1]!==["m"]) {
					console.error("Warning: Subpool tsne spectrum_selector must be 'm' ", p);
					return false;
				}
				if(parseInt(p[0],10)!==p[0]){
					console.error("Warning: Subpool tsne must be [song_id(int), 'm', x, y, k]]", p);
					return false;
				}
				if(parseFloat(p[2],10)!==p[2]){
					console.error("Warning: Subpool tsne must be [song_id, 'm', x(float), y, k]]", p);
					return false;
				}
				if(parseFloat(p[3],10)!==p[3]){
					console.error("Warning: Subpool tsne must be [song_id, 'm', x, y(float), k]]", p);
					return false;
				}
				if(parseInt(p[4],10)!==p[4]){
					console.error("Warning: Subpool tsne must be [song_id, 'm', x, y, k(int)]]", p);
					return false;
				}
				if(p[2]>1) {
					console.error("Warning: Subpool tsne x out of range", p);
					return false;
				}
				if(p[2]<0) {
					console.error("Warning: Subpool tsne x out of range", p);
					return false;
				}
				if(p[3]>1) {
					console.error("Warning: Subpool tsne y out of range", p);
					return false;
				}
				if(p[3]<0) {
					console.error("Warning: Subpool tsne y out of range", p);
					return false;
				}
				// song_id, spectrum_selector, x, y, neighbors
			}else{
				console.error("Invalid length of p", p, p.length);
				return false;
			}
		}
		return true;
	}

	// validates a value
	// should be a float between 0 and 1
	self.validate_gain = function(gain){
		if(parseFloat(gain)!==gain) return false;
		if(gain < 0) return false;
		if(gain > 1) return false;
		return true;
	}

	// validates a gaps value
	self.validate_gaps = function(gaps){
		let options = ["gaps","flows","fulls","cuts","spills"];
		return options.indexOf(gaps)!=-1;
	}

	// validates a tempo multiplier value
	self.validate_tempo_multiplier = function(tempo_multiplier){
		if(parseFloat(tempo_multiplier) !== tempo_multiplier){
			console.warn("Warning: tempo_multiplier must be a float", tempo_multiplier);
			return false;
		}
		if(!tempo_multiplier || tempo_multiplier<=0){
			console.warn("Warning: tempo_multiplier must be greater than 0", tempo_multiplier);
			return false;
		}
	}

	self.validate_hit = function(hit){
		if(!("pool" in hit)){
			console.error("Warning: Hit needs a pool");
			return false;
		}
		if(!(self.validate_pool(hit["pool"]))){
			console.error("Warning: Invalid pool", hit);
			return false;
		}
		if(!("chaos" in hit)){
			console.error("Warning: Missing chaos value", hit);
			return false;
		}
		if(!(hit["chaos"]===true || hit["chaos"]===false)){
			console.error("Warning: Chaos must be true or false");
			return false;
		}
		if(!("gain" in hit)){
			console.error("Warning: Missing gain value", hit);
			return false;
		}
		if(!("gaps" in hit)){
			console.error("Warning: Missing gaps value", hit);
			return false;
		}
		if(!self.validate_gaps(hit["gaps"])){
			console.error("Warning: Missing gain value", hit);
			return false;
		}
		if(!("seg" in hit)){
			console.error("Warning: Missing seg value", hit);
			return false;
		}
		if(!(hit["seg"] instanceof Array)){
			console.error("Warning: seg is not array", hit);
			return false;
		}
		if(hit["seg"].length!==2){
			console.error("Warning: invalid seg", hit);
			return false;
		}
		if(parseInt(hit["seg"][0],10)!==hit["seg"][0] || parseInt(hit["seg"][1],10)!==hit["seg"][1]){
			console.error("Warning: invalid seg", hit);
			return false;
		}
		return true;
	}

	self.validate_pattern_template = function(pattern){
		if(!(pattern instanceof Object)){
			console.error("Warning: Pattern Template is not object", pattern);
			return false;
		}
		if(!("len" in pattern)){
			console.error("Warning: Pattern missing length ", pattern);
			return false;
		}
		if(pattern["len"] !== parseFloat(pattern["len"],10)){
			console.error("Warning: Pattern len is not a float", pattern)
			return false;
		}
		if(!pattern["len"] || pattern["len"]<=0){
			console.warn("Warning: Pattern len must be greater than 0 beats ", pattern);
			return false;
		}
		if(pattern["rows"].length===0){
			console.error("Warning: Pattern has no rows", pattern);
			return false;
		}
		if(!("rows" in pattern)){
			console.error("Warning: Pattern rows is missing", pattern);
			return false;
		}
		if(!(pattern["rows"] instanceof Array)){
			console.error("Warning: Pattern rows is not array", pattern);
			return false;
		}
		for(let r in pattern["rows"]){
			let row = pattern["rows"][r];
			if(!("blocks" in row)){
				console.error("Warning: Pattern row",r," is missing 'blocks' param", pattern, row);
				return false;
			}
			let blocks = row["blocks"];
			if(!(blocks instanceof Array)){
				console.error("Warning: Pattern row",r," blocks is not array", pattern, row, blocks);
				return false;
			}
			// don't bother checking blocks
		}
		return true;

	}
	// validates a pattern object
	// INCOMPLETE
	self.validate_pattern = function(pattern){
		if(!(pattern instanceof Object)){
			console.error("Warning: Pattern is not object", pattern );
			return false;
		}
		if(!("hue" in pattern)){
			console.error("Warning: Pattern needs a hue value", pattern);
			return false;
		}
		if(pattern["hue"] !== parseInt(pattern["hue"],10)){
			console.error("Warning: Pattern hue is not an integer", pattern)
			return false;
		}
		if(pattern["hue"] < 0 || pattern["hue"]>360){
			console.error("Warning: Pattern hue should be a value between 0 and 360", pattern)
			return false;
		}
		if(!self.validate_pattern_template(pattern)){
			return false;
		}
		// TODO: for each row, validate blocks

		return true;
	}



	// Pick one segment from self pool
	// The same seed should give the same results
	self.fish_segment_from_pool = function(pool, seed){
		if(!seed) seed = Math.random();
		// 1. pick a random subpool
		let i = Math.floor(self.random(seed) * pool.length)
		let p = pool[i]; // subpool
		if(p.length===2){
			// if length 2, it's a list of segment ids from that song
			// [song_id, [segment_id, segment_id]]
			let song_id = parseInt(p[0]);
			let r = self.random(seed*111);
			let segment_id = p[1][Math.floor(r * p[1].length)];
			//console.log(seed, segment_id);
			return [song_id, segment_id];
		}else if(p.length===4){
			// if length 4, it's a 1D Range selector
			// [song_id, spectrum_selector, start, end]
			let song_id = parseInt(p[0]);
			let start = parseInt(p[2]);
			let end = parseInt(p[3]);
			// spectrum selector [s]ong or [t]imbre spectrum
			if(p[1]==="s"){
				let r = self.random(seed*222)
				let segment_id = start + Math.floor(r * (end - start + 1))
				return [song_id, segment_id];
			}else if(p[1]==="t"){
				let r = self.random(seed*333);
				let timbre_index = start + Math.floor(r * (end - start + 1))
				let timbre_spectrum = self.get_segment_ids_sorted_by_rolloff(song_id);
				let segment_id = timbre_spectrum[timbre_index];
				//console.log("timbre", song_id, start, end, r, timbre_index, timbre_spectrum, segment_id)
				//console.log(r, segment_id);
				// probably should change the "segment_ids" heading in the analyzer, it's stupid ambiguous
				return [song_id, segment_id];
			}else{
				console.error("Warning: Pool range from unknown spectrum selector");
				return;
			}
		}else if(p.length===5){
			// if length 5, it's a TSNE [M]ap
			let song_id = parseInt(p[0]);
			let x = parseFloat(p[2]);
			let y = parseFloat(p[3]);
			let k = parseInt(p[4])
			if(p[1]!=="m"){
				console.error("Warning: pool range from unknown tSNE map");
			}
			console.warn("Warning: tSNE pools not yet supported", x, y, k);
			// Instead pick a random
			let r = self.random(seed*444)
			let segment_id = Math.floor(r * self.analysis[song_id]["segments"].length);
			//console.log(r, segment_id);
			return [song_id, segment_id];
			// song_id, spectrum_selector, x, y, neighbors
		}
	}

	// Hit maker function (called by the make hit tray)
	// Validate the inputs before creating a new hit
	self.make_hit = function(pool, chaos=false, gain=1.0, gaps="gaps"){
		// validate input
		if(pool.length===0){
			console.error("Warning: Tried to create pattern with empty pool", pool);
			return {};
		}
		if(!self.validate_pool(pool)){
			console.error("Warning: Invalid pool object structure", pool);
			return {};
		}
		chaos = chaos ? true : false;
		if(!self.validate_gain(gain)){
			console.warn("Warning: Invalid gain value", gain);
			gain = 1.0; // set it to 1.0
		}
		if(!self.validate_gaps(gaps)){
			console.warn("Warning: Invalid gaps value", gaps);
			gaps = "gaps";
		}
		var seg = self.fish_segment_from_pool(pool, self.seed);
		if(!seg){
			console.error("Warning: Problem fishing segment from pool", pool);
			return {};
		}
		return self._create_hit(pool, seg, chaos, gain, gaps);
	}

	// Create a new hit object with the following params:
	// (Private method)
	self._create_hit = function(pool, seg, chaos=false, gain=1.0, gaps="gaps"){
		return {
			"pool": pool,
			"seg": seg,
			"chaos": chaos,
			"gain": gain,
			"gaps": gaps
		}
	}

	// Make a new pattern (called by the make pattern tray)
	// pattern_template is a pattern object (all of its hits will be replaced)
	self.make_pattern = function(pool, pattern_template, jumble=false, chaos=false, gain=1.0, gaps="flows", tempo_multiplier=1.0){
		/// validate input
		if(pool.length===0){
			console.error("Warning: Tried to create pattern with empty pool", pool);
			return {};
		}
		if(!self.validate_pool(pool)){
			console.error("Warning: Invalid pool object structure", pool);
			return {};
		}
		// chaos means "everytime you play it, it is different"
		chaos = chaos ? true : false;
		// jumble means "ignore the MIDI notes and always pick a random segment"
		jumble = jumble ? true : false;
		if(!self.validate_gain(gain)){
			console.warn("Warning: Invalid gain value", gain);
			gain = 1.0; // set it to 1.0
		}
		if(!self.validate_gaps(gaps)){
			gaps = "flows";
		}
		if(!self.validate_tempo_multiplier(tempo_multiplier)){
			tempo_multiplier = 1.0
		}
		if(!self.validate_pattern_template(pattern_template)){
			console.warn("Warning: invalid pattern template", pattern_template)
			return {};
		}

		// clone the template
		// then change its properties
		let pattern = JSON.parse(JSON.stringify(pattern_template));
		let rows = pattern["rows"];
		// store the randomness seed for this pattern
		// so that when recalling this pattern in the pattern list, 
		// we can explore its variations
		pattern.seed = self.seed; 

		let midi_notes = [];
		if(!jumble){
			// for each unique midi note block, fish a segment from the pool
			for(let i in rows){
				let row = rows[i];
				for(let b in row["blocks"]){
					let note = row["blocks"][b]["midi"];
					let seed = pattern.seed + i*1000 + b*1000; 
					midi_notes[note] = self.fish_segment_from_pool(pool, seed);
				}
			}
		}

		// Now go through the template again and turn the blocks into legit hits
		for(let i in rows){
			let row = rows[i];
			for(let b in row["blocks"]){
				b = parseInt(b);
				let block = row["blocks"][b];
				// set a new universal unique id
				block["uuid"] = self.uuid();
				block["type"] = "hit" // the templates should ALL be hits
				let seg = null;
				if(jumble){
					// if jumble is true, always fish a new segment 
					let seed = pattern.seed + i*1000 + b*1000; 
					seg = self.fish_segment_from_pool(pool, seed);
				}else{
					// if jumble if false, pick a segment according to this blocks' midi note
					seg = midi_notes[block["midi"]];
				}
				let hit_gain = 1.0
				//block["gain"] = 1.0

				block["hit"] = self._create_hit(pool, seg, chaos, hit_gain, gaps)
				// ["gaps","flows","fulls","cuts","spills"];
				// Cuts:  Gaps + flows
				// Dices: Gaps + fulls
				// Spills: Full segments with overlap
				if(gaps == "spills"){
					// extend every hit to the end of the pattern, but as "gaps"
					// This way, every hit plays without getting interrupted
					// Except at the end
					block["len"] = pattern["len"] - block["pos"];
					//block["len"] += 0.5; // extend it a little bit to even the loop
					block["hit"]["gaps"] = "gaps"; // on the backend, this is gaps behavior
				}else if(gaps == "fulls"){
					// Remove the rests
					// This hit should flow into the next hit in the same row
					if(b==row["blocks"].length-1){
						// last block in row
						// Extend it till the end of the pattern
						block["len"] = pattern["len"] - block["pos"]
					}else{
						// earlier block in row
						// Extend it till the next block
						block["len"] = row["blocks"][b+1]["pos"] - block["pos"];
					}
					block["hit"]["gaps"] = "flows"; // on the backend, this is flows behavior
				}else if(gaps == "flows"){
					// Each hit continues until the next hit (on any row)
					// Find the next start time
					let next_start_pos = pattern["len"];
					for(let r2 in rows){ // don't get this mixed up with the outer rows loop
						for(let b2 in rows[r2]["blocks"]){
							let block2 = rows[r2]["blocks"][b2];
							if(block2["pos"] <= block["pos"]){
								// this hit starts at the same time
								// or before 
								// IGNORE
								continue;
							}else{
								// this hit starts after
								if(block2["pos"] < next_start_pos){
									// and it comes earlier than the previous candidate we found
									next_start_pos = block2["pos"];
								}
								break; // there should be no more hits to test in this row because they're ordered
							}
						}
					}
					// set the new length 
					block["len"] = next_start_pos - block["pos"];

				}
			}
		}
		pattern["tempo_multiplier"] = tempo_multiplier
		pattern["gain"] = gain
		// random hue
		pattern["hue"] = self.pattern_hue()
		return pattern;
	}

	// returns a random string which is very likely to be unique
	self.uuid = function(){
		return Math.floor((1 + Math.random()) * 0x100000000).toString(36).substr(1);
	}


	// generates a random hue for a pattern block.
	// valid output values are between 0 and 360
	// but self range may be tweaked for aesthetic reasons
	self.pattern_hue = function(){
		// Give the pattern block a random hue
		return (Math.floor(Math.random()*210) + 150) % 360
		// actually we want 90 to 360, because 0 to 90 looks like puke/poop
		// we want to ignore 50 to 150 because greens look too bright
	}


	// Verify that this hit_id (example: "a0") has been saved to the session (and has a pad)
	self.verify_hit_id_exists = function(hit_id, session){
		return (hit_id in session["hits"]) && (session["hits"][hit_id]);
	}

	// Verify that this pattern_id (example: "a0") has been saved to the session (and has a pad)
	self.verify_pattern_id_exists = function(pattern_id, session){
		return (pattern_id in session["patterns"]) && (session["patterns"][pattern_id]);
	}

	// Get the hit object which has this id (example: "a0") in the session
	self.get_hit_from_id = function(hit_id, session){
		return session["hit"][hit_id];
	}

	// Get the pattern object which has this id (example: "a0") in the session
	self.get_pattern_from_id = function(pattern_id, session){
		return session["patterns"][pattern_id];
	}

	/*
	// Return a new pattern with all the segments refreshed from the pool
	self.refresh_pattern = function(pattern){
		let p = JSON.parse(JSON.stringify(pattern));
		for(let i in p["sequence"]){
			p["sequence"][i]["seg"] = p["pool"][Math.floor(Math.random() * p["pool"].length)]
		}
		return p;
	}*/


	// A session has a global BPM
	// Multiply it by the pattern's tempo_multiplier
	self.calculate_secs_per_beat = function(pattern, session){
		let tempo_multiplier = 1.0; // default
		if("tempo_multiplier" in pattern) tempo_multiplier = pattern["tempo_multiplier"];
		let bpm = session["global_bpm"] * tempo_multiplier;
		let secs_per_beat = 60.0 / bpm;
		return secs_per_beat;
	}



	// Return the list of segment_ids sorted by Rolloff
	// If it hasn't been calculated, it will calculate it for the first time and store it
	self.get_segments_sorted_by_rolloff = function(song_id){
		let rolloff_segment_ids = self.get_segment_ids_sorted_by_rolloff(song_id);
		let segments_sorted_by_rolloff  = [];
		for(let i in rolloff_segment_ids){
			let segment_id = rolloff_segment_ids[i];
			let seg = self.analysis[song_id].segments[segment_id];
			segments_sorted_by_rolloff .push(seg);
		}
		return segments_sorted_by_rolloff;
	}

	// Return the list of segment_ids sorted by Rolloff
	// If it hasn't been calculated, it will calculate it for the first time and store it
	self.get_segment_ids_sorted_by_rolloff = function(song_id){
		if(!(song_id in self.analysis)){
			return console.error("Tried to get timbre spectrum segment list for song_id "+song_id+" which isn't loaded, or whose analysis has not finished loading")
		}
		if("segment_ids_sorted_by_rolloff" in self.analysis[song_id]){
			// If this has already been calculated, return it
			return self.analysis[song_id].segment_ids_sorted_by_rolloff;
		}else{
			// If not, build it
			let segment_ids_sorted_by_rolloff = self._build_segment_ids_sorted_by_rolloff(song_id);
			// Store it with the analysis
			self.analysis[song_id].segment_ids_sorted_by_rolloff = segment_ids_sorted_by_rolloff
			// Return it 
			return segment_ids_sorted_by_rolloff
		}	
	}

	// Calculate the list of segments sorted by rolloff
	// This should only run once, the first time it is needed
	self._build_segment_ids_sorted_by_rolloff = function(song_id){
		// Get the analysis
		song_id = parseInt(song_id,10);
		let segment_list = self.analysis[song_id].segments;
		// Add the segment ID to the object so we can retrieve it 
		for(let s in segment_list){
			segment_list[s].id = parseInt(s);
		}
		// Clone the segment_list
		let segment_list_sorted = segment_list.slice(0);

		// Sort by Rolloff
		segment_list_sorted.sort(function(a, b){
			//console.log(a["ro"], b["ro"]);
			return parseFloat(a["ro"]) - parseFloat(b["ro"]);
		})
		// Now pull just the ID list
		let segment_id_list = [] 
		for(let s in segment_list){
			segment_id_list.push(segment_list_sorted[s].id);
		}
		return segment_id_list
	}



	////////
	// UI //
	////////



	// The segment list may be sorted by anything
	// Given the highlighted range return the pool of segments for one song
	// Also return snapped start and end times
	self.make_pool_from_song_range = function(song_id, startPercent, endPercent, type) {
		//all segments
		song_id = parseInt(song_id,10);
		let segments;
		if(type==="s"){	
			// SEGMENTS SORTED BY TIME
			segments = self.analysis[song_id].segments;
		}else if(type==="t"){
			// TIMBRE SPECTRUM
			segments = self.get_segments_sorted_by_rolloff(song_id);
		}else{
			console.warning("Unknown segment pool type, expecting 's' for normal segment list or 't' for timbre spectrum ", type)
			// Just set it to normal
			type = "s"; 
		}
		// total time in seconds of song
		let total_duration = self.analysis[song_id].duration

		// The following should work despite whatever way segments is sorted: 

		// the time at the left boundary
		let left_time = Math.min(startPercent, endPercent) / 100.0 * total_duration;
		// the time at the right boundary
		let right_time = Math.max(startPercent, endPercent) / 100.0 * total_duration; 

		// Loop through the segments and find which segments exist at the 
		// left and right boundaries of the selection 
		let left_s = 0;
		let right_s = segments.length-1;
		// epsilon-- tiny amount to account for rounding errors
		let eps = 0.000001
		// start is a running increment of start_time
		let start = 0.0;
		let snappedStartPercent = startPercent;
		let snappedEndPercent = endPercent;

		for(let s in segments){
			s = parseInt(s);
			let seg = segments[s];
			let duration = parseFloat(seg.duration);
			let end = start + duration;
			if(start <= left_time + eps){
				left_s = s;
				snappedStartPercent = start/total_duration * 100;
			}
			if(end >= right_time - eps){
				right_s = s;
				snappedEndPercent = end/total_duration * 100;

				break;
			}
			start += duration;
		}

		/*
		// METHOD when segments are sorted by time: 

		// the time at the left boundary
		let left_time = Math.min(startPercent, endPercent) / 100.0 * total_duration;
		// the time at the right boundary
		let right_time = Math.max(startPercent, endPercent) / 100.0 * total_duration; 

		// Loop through the segments and find which segments exist at the 
		// left and right boundaries of the selection 
		let left_s = 0;
		let right_s = segments.length-1;
		// epsilon-- tiny amount to account for rounding errors
		let eps = 0.000001
		for(let s in segments){
			s = parseInt(s);
			let seg = segments[s];
			let start = parseFloat(seg.start)
			let end = start + parseFloat(seg.duration)
			if(start <= left_time + eps){
				left_s = s ;
			}
			if(end >= right_time - eps){
				right_s = s ;
				break;
			}
		}
		*/

		// value sanitization
		left_s = Math.max(left_s, 0);
		right_s = Math.min(right_s, segments.length-1);

		/*
		// Old method for representing pools 
		let pool = []
		for(let i = left_s; i<=right_s; i++){
			pool.push(i);
		}
		pool = [song_id, pool];
		*/

		// New method, smaller filesize
		let pool = [song_id, type, left_s, right_s];
		//console.log("pool", pool);
		// Return 
		return {"pool": [pool], 
			"snappedStartPercent": snappedStartPercent,
			"snappedEndPercent": snappedEndPercent}
	}



}
