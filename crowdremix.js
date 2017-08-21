
 /* eslint-disable */


function CrowdRemixEngine(){
	// development
	//window.CrowdRemixEngine = this;
	let self = this;

	////////////
	// CONFIG //
	////////////

	// ---Generator---
	// loops are powered by a generator function*
	// The function continues every generator_interval milliseconds (interval)
	// And queues the next generator_window seconds ahead (window)

	// Generator_window is best being slightly above the generator_interval
	self.generator_window = 1.200; // loops/stepsequences/compositions get queued this many seconds ahead
	// progress the playback (run generator.next) every this many milliseconds
	// If this is below 1000ms, you will probably use too many extra computing resources
	self.generator_interval = 1000;
	// move the playhead every this many milliseconds
	self.playhead_position_interval = 30;

	// keep track of all the setInterval IDs during playback, so we can stop them all
	self.playback_timer_ids = [];

	// Epsilon block -- Negligible fraction of a beat;
	// add this to block positions/lengths to prevent accidental block overwriting due to rounding errors
	self.epsilon_block = 0.01

	// When hitting play, sometimes it cuts off the first transient,
	// because of a tiny latency in processing the first window of audio.
	// Therefore, wait a small delay of time after hitting the playbutton:
	self.play_pattern_starting_delay = .01; // 10ms

	// songs list
	self.songs = [];
	// [ {...}, {...} ]
	self.analysis = {};
	// { song_id: {...}, song_id, {...} }
	self.hires_spectrograms = {};

	////////////
	// mixins //
	////////////

	CrowdRemixHitsPatterns(self);
	CrowdRemixLoading(self);
	CrowdRemixPlayback(self);
	CrowdRemixComposer(self);
	CrowdRemixDraw(self);
	CrowdRemixTestSuite(self);
	CrowdRemixPatternTemplates(self);
	CrowdRemixOfflineRender(self);

	//////////////////
	// sound engine //
	//////////////////

	self.Sound = new SuperSoundEngine();
	self.Sound.initialize();


	/* Return the parameters of this step,
		If a parameter isn't defined on the step level, or if it is set to "default",
		look back to the pattern level for that parameter.
		In the case of gain, compute the gain by multiplying the gains from every level together.
	*/
	/*
	self.compute_step_params = function(step, pattern, session){
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
	*/

	/*
	// queues one step of a pattern
	// queues the segment into the sound engine
 	// returns the SoundEngine-readable segment object
	self.get_next_pattern_step = function(i, pattern_start_time, secs_per_beat, pattern, session){
		let step, chaos, gaps, gain, pos, len, seg, bpm, when, segment, tempo_multiplier;
		let segment_id, analysis_id, duration, layer, pool, song_id;

		step = pattern["sequence"][i];

		[chaos, pool, gain, pos, layer, gaps, len] = self.compute_step_params(step, pattern, session);

		//get the step
		if(chaos){
			seg = pool[Math.floor(Math.random() * pool.length)];
		}else{
			seg = step["seg"];
		}
		song_id = seg[0];
		segment_id = seg[1];
		segment = self.analysis[song_id]["segments"][segment_id];

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



		return playSeg;
	}*/




}




