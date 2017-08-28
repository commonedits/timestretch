/* eslint-disable */

/* author CJ Carr
 * MIT License
 * MazeMetal SoundEngine
 * cortexel.us | github.com/cortexelus
*/

// browser timing correction

/*

 - The main functionality is queueSegment!!
 - Every 50ms the next 5 seconds is loaded into buffer from the segmentQueue

 - For infinite loops you need a generator that queues the next n seconds on setInterval

 - Loads multiple songs
 - Play segments from any song.
*/

 /* eslint-disable */
function SuperSoundEngine(){
	// Audio Contexts
	let context = window.AudioContext || window.webkitAudioContext;
	this.context = new context; 	// For browser playback

	this.sources = {};		// holds buffer sources for the full songs, keys are analysis ids
	this.bufferQueue = [] // only necessary to keep track of what to stop


	this.timerWorker = null

	this.interval = 1000 // call the segmentScheduler every ___ ms
	this.windowLength = 1.2 // How far ahead to schedule audio (sec)
	this.rampAttack = .002 // 2 millisecond ramp at beginning of segment
	this.rampRelease = .0010 // 10 millisecond ramp at the end of segment
	this.rampEpsilon = 0.001 // start and end at some low gain, 0 doesn't work

	this.segmentQueue = []
	// segments that have been put into the queue,
    // and may or may not have played yet. {when, start, duration, segment_id, callback_onended, gain, layer}

	this.initialize = function(){
		// initialize
		/* This regulates the playback queuing of individual segments */
		// It isn't actually fully necessary to have the metronome
		// since calling queueSegments runs the segmentScheduler immediately
		this.initMetronome();
	}

	// Unload a song from the sound engine
	this.unload_song = function(song_id){
		/** TODO **/
		// Shut down all the audio
		this.stopAll();
		// check if song_id is in sources
		if(song_id in this.sources){
			delete this.sources[song_id]
		}
		// hopefully this will garbage collect all the buffer data
	}

	// Terminate everything about this sound engine
	this.terminate = function(){
		this.stopAll();
		this.stopMetronome()
		if(this.timerWorker){
			this.timerWorker.terminate();
			this.timerWorker = undefined;
		}
		this.sources = {};
	}

	// songs: must be an array of { "song_id": int, "song_url": String }
	// callback function will be called for every URL loaded, and received URL as argument
	this.load = function(songs, progress_callback, success_callback){
		let self = this;   // Unambiguous reference to the SoundEngine object

		if(songs instanceof Object &&
			"song_id" in songs && "song_url" in songs){
			// we got a single song instead of an array, that's okay we'll put it into an array
			songs = [songs]
		}
		if(songs instanceof Array){
			for(let i in songs){
				if(!("song_id" in songs[i] && "song_url" in songs[i])){
					throw new Error('SoundEngine.load songs expected to be { "song_id": int, "song_url": String } ');
				}
			}
		}
		/*
		// Validate urls type;
		if(typeof urls === 'string' || urls instanceof String){
			// we got a string instead of an array
			// put it in an one-element array
			urls = [urls];
		}else if(urls instanceof Array){
			// list of audio_urls
		}else{
			throw new TypeError("SoundEngine needs audio file urls which are type String or [Array of String]");
		}*/

		// For aggregating the sum total of the loading percentages for all songs
		let sum = function(a,b){ return parseFloat(a)+parseFloat(b); }
		let percentages = {};

		// go through the list of urls
		for(let i in songs){
			// important to use "let" here, to keep the references in asynchronous functions behaving as expected
			let song = songs[i];
			let url = song["song_url"]
			let id = song["song_id"];
			percentages[id] = 0;

			if(id in this.sources){
				// id has already been loaded
				console.warn('SoundEngine.load attempted to load id ' + song["song_id"] + ' which is already loaded. ');
				if(typeof success_callback === "function"){
					success_callback(id);
				}
				// skip it and go to the next
				continue;
			}

			let source = this.context.createBufferSource();
			self.sources[id] = source; // add to the list of sources

			// Remember the extension
			// As a hacky way to figure out what encoding the file is
			// We need to know the encoding so we can adjust the segment timing due to browser decoding error
			let extension = url.substring(url.length-4)
			if(extension == ".mp3"){
				source.encoding = "mp3"; // mp3
			}else if(extension == ".m4a"){
				source.encoding = "aac_hev2"; // aac HEv2
			}else{
				source.encoding = ""; // dont know, dont care
			}

			let request = new XMLHttpRequest(); // Request to get the mp3
			request.open('GET', url, true);   // Point the request to the sound-file
			// Set the XHR response-type to 'arraybuffer' to store binary data
			request.responseType = "arraybuffer";
			request.addEventListener( 'progress', function(e){
				if (e.lengthComputable) {
				    if(typeof progress_callback === "function"){
				    	// the percentage amount this song has loaded (from 0 to 1)
				    	percentages[id] = e.loaded / e.total;
				    	// the total percentage all songs have been loaded
				    	// Sum the percentages:
				    	let total_percentage_all_songs = Object.values(percentages).reduce(sum, 0);
				    	// divide by number of songs to get value between 0 and 1
				    	total_percentage_all_songs /= Object.values(percentages).length;
				    	// Call the callback (song_id, song_percentage, total_percentage_all_songs)
				    	progress_callback(id, percentages[id], total_percentage_all_songs)
				    }
				} else {
				    // Unable to compute progress information since the total size is unknown
				}
			})
			// Make an EventListener to handle the sound-file after it has been loaded
			request.addEventListener( 'load', function( e ){
				// Beginning decoding the audio data from loaded sound-file ...
				// console.log("Loaded, begin decoding", e)
				self.context.decodeAudioData( request.response, function( decoded_data ){
					// console.log("Finished decoding");
					// Store the decoded audio buffer data in the source object
					source.buffer = decoded_data;
					// Connect the source node to the Web Audio destination node
					source.connect( self.context.destination );
					// Let the client know this song has been loaded
					if(typeof success_callback === "function"){
						success_callback(id);
					}
				}, function( e ){
					console.log("decoding error", e );
				});
			}, false );

			request.onerror = function(e) {
	            // console.log("request error", e)
	        }

			// Begin requesting the sound-file from the server
			request.send();
		}
	}

	this.play = function(seg){		
		let self = this;   // Unambiguous reference to the SoundEngine object

		//console.log("play", seg);
		// { id, when, start, duration, callback_onended, gain, layer }

		let song_id = seg["song_id"];
		let song_source = this.sources[song_id]
		if(!(song_source instanceof AudioBufferSourceNode)){
			throw new Error('song_id ' + song_id + ' has not been loaded into SoundEngine');
		}else if(song_source.buffer === null){
			throw new Error('song_id ' + song_id + ' is still loading & decoding');
		}

		// Create a new BufferSource
		let seg_source = this.context.createBufferSource();
		// Point to the buffered data from the song's source buffer
		seg_source.buffer = song_source.buffer;


		// Layer
		if(!seg.layer) seg.layer = 0; // set to layer 0 by default
		seg_source.layer = seg.layer;

		// Timing
		let when_start, when_end, duration, seg_start;
		if(seg.when < this.context.currentTime){
			console.warn('late!!!')
			// We're late!
			// this segment was scheduled to play in the past
			// scootch start time up + duration accordingly
			var diff = this.context.currentTime - seg.when;
			//console.log(diff)
			if(seg.duration - diff > 0){
				//console.log("start", this.context.currentTime, seg.start+diff, seg.duration - diff);
				when_start = this.context.currentTime;
				when_end = this.context.currentTime + seg.duration - diff;
				duration = seg.duration - diff;
				seg_start = seg.start + diff;
			}else{
				// Too late!
				// This segment would have finished playing by now
				// don't play it
				return; // exit
			}
		}else{
			// Ahead of schedule
			// Schedule to play the full segment in the future
			when_start = seg.when;
			when_end = seg.when + seg.duration;
			seg_start = seg.start;
			duration = seg.duration;
		}

		// Adjust any timing corrections due to browser decoding errors
		// (If the timing correction has been calculated in decoder_timing_correction.js)
		// The "encoding" parameter is set during load() and is hackily based on the url extension
		if(song_source.encoding == "mp3" && window.mp3_timing_correction){
			seg_start += window.mp3_timing_correction;
		}else if(song_source.encoding == "aac_hev2" && window.aac_hev2_timing_correction){
			seg_start += window.aac_hev2_timing_correction
		}else{
			// default behavior, no correction
			// WAV should work OK
			// FLAC (if the browser supports it) should work OK
		}
		// but sometimes there's a negative timing correction
		// and the browser cuts off the beginning of the file
		// but we can't have a negative start time, so force it to be zero
		if(seg_start<0) seg_start = 0;


		//SoundTouch
		//seg_source.playbackRate.value = 1/seg.speed
		let sample_rate = seg_source.buffer.sampleRate;

		let st = new soundtouch.SoundTouch(sample_rate); //creates RateTransposer, Stretch, and FIFOSampleBuffers
		seg.st = st;

		//console.log(sample_rate)
		let frequency_factor = Math.pow(2, (seg.semitones / 12));
		
		seg.st.tempo = 1/seg.speed;
		seg.st.pitch = frequency_factor;
		//duration += 0.1
		let buffer_source = new soundtouch.WebAudioBufferSource(song_source.buffer)
		let st_filter = new soundtouch.SimpleFilter(buffer_source, seg.st);
		st_filter.sourcePosition = Math.ceil(seg_start*sample_rate);
		st_filter.sourceEnd = Math.ceil((duration)*sample_rate);
		console.warn(st_filter.sourcePosition)
		let st_node = soundtouch.getTimedWebAudioNode(this.context, st_filter, when_start, duration);
		

		// Gain
		let gain = 1.0 // overall gain of segment, default 1.0
		if(seg["gain"]) gain = seg["gain"];
		let gainNode = this.context.createGain();

		gainNode.gain.value = gain;  // default: steady gain, gives you clicks

		/*// Amplitude Envelope
		// We fade in/out to avoid clicks
		// start silent
		gainNode.gain.setValueAtTime(this.rampEpsilon, when_start);
		// ramp up to gain value
		gainNode.gain.exponentialRampToValueAtTime(gain, when_start + this.rampAttack);
		// hold until end
		gainNode.gain.setValueAtTime(gain, when_end - this.rampRelease);
		// ramp down
    	gainNode.gain.exponentialRampToValueAtTime(this.rampEpsilon, when_end);*/

    	// connect the source, through the gain node, to the destination
    	st_node.connect(gainNode)
		/*
		setTimeout(function(){
			st_node.connect(gainNode)
		}, (when_start-this.context.currentTime)*1000.0);
			//st_node.connect(gainNode)		
		*/
		gainNode.connect(self.context.destination);
		seg_source.gainNode = gainNode; 

    	// Play it!
    	// console.log("PlaySeg", when_start, seg_start, duration);
    	//seg_source.start(when_start, seg_start, duration);
    	seg_source.when = when_start; 
    	seg_source.duration = duration;
    	// Keep track of it in the buffer queue (so we can stop it later)
		self.bufferQueue.push(seg_source);
		//seg_source.onended = callback_onended;
		/*if(seg.callback_onended != null){
			seg_source.onended = function(){
				if(this.context.currentTime >= this.beginTime){
					callback_onended(seg.segment_id, song);
				}
			}
		}*/



	}

	/*
	playFinal: function(when,start,duration,callback){
		// Create a new BufferSource
		newSource = this.context.createBufferSource();
		// Copy the buffer data from the loaded sound
		newSource.buffer = this.source.buffer;
		// Connect the new source to the new destination
		newSource.connect( this.context.destination );
		// Play the sound immediately
		newSource.onended = callback

		newSource.start( when + c, start, duration );

		this.playQueue.push(newSource)

	},*/

	// Stop all the sounds!
	// Dump the segment queue and the buffer queue
	this.stopAll = function(){
		//if(parseInt(when)!==when){ when = 0; }
		//console.log("stopAll")
		var bq = this.bufferQueue;
		for(var b=0;b< bq.length;b++){
				bq[b].stop(/*when + */this.context.currentTime);
		}
		this.bufferQueue = []
		this.segmentQueue = [];
	}

	// stop any segments that haven't played yet 
	// but let any currently playing segments continue and fade out
	// fadeoutTime [seconds]
	this.fadeOut = function(fadeoutTime=0.5){
		let bq = this.bufferQueue;
		console.log(bq.length, "bq.length")
		for(let b=0;b< bq.length;b++){
			if(bq[b].when >= this.context.currentTime){
				// this segment hasn't played yet
				// stop it 
				bq[b].stop(this.context.currentTime);
				bq.splice(b, 1); // better not cause problems in the future
				b--;
			}else if(bq[b].when + bq[b].duration < this.context.currentTime){
				// this segment finished playing
				// but hasn't been removed from the queue yet
				// ignore
				bq.splice(b, 1); 
				b--;
			}else{
				// this segment is currently playing
				// Fade it out
				bq[b].gainNode.gain.setValueAtTime(bq[b].gainNode.gain.value, this.context.currentTime);
				bq[b].gainNode.gain.linearRampToValueAtTime(this.rampEpsilon, this.context.currentTime + fadeoutTime);
			} 			
			
		}		
		this.segmentQueue = [];
	}

	// Only Stop sounds on the given layer
	// Layer is an integer
	// Dump anything in the segment queue and the buffer queue of that layer
	// (Best not to run this in parallel to avoid race conditions)
	this.stopLayer = function(layer){
		//if(parseInt(when)!==when){ when = 0; }
		//console.log("stopLayer", layer)
		// stop and remove all layer sources from the bufferqueue
		let bq = this.bufferQueue;
		for(let b=0;b< bq.length;b++){
			if(bq[b].layer === layer){
				bq[b].stop(/*when + */this.context.currentTime);
				bq.splice(b, 1); // hopefully doesn't cause race conditions
				b--;
			}
		}
		// Remove all layer segments from the segment Queue
		let sq = this.segmentQueue
		for(let s=0;s< sq.length;s++){
			if(sq[s].layer === layer){
				sq.splice(s, 1); // hopefully doesn't cause race conditions
				s--;
			}
		}
	}

	// Removes any segments from the bufferQueue that finished playing 
	this.cleanBufferQueue = function(){
		let bq = this.bufferQueue;
		for(let b=0;b< bq.length;b++){
			if(bq[b].when + bq[b].duration < this.context.currentTime){
				bq.splice(b, 1); // hopefully won't cause problems with race conditions
				b--;
			}
		}
	}

	this.initMetronome = function(){
		//console.log("metronome init")
		this.timerWorker = new Worker("metronome-worker.js");
		var self = this;
		this.timerWorker.onmessage = function(e) {
	        if (e.data === "tick") {
	            //console.log("tick!");
	            self.segmentScheduler();
	        }else{
	            //console.log("message: " + e.data);
	        }
		};
		this.setTimerInterval(this.interval);
		this.startMetronome();
	}

	this.startMetronome = function(){
		//console.log("metronome start")
		if(this.timerWorker!==null){
			this.timerWorker.postMessage("start")
		}
	}

	this.stopMetronome = function(){
		//console.log("Metronome stop")
		if(this.timerWorker!==null){
			this.timerWorker.postMessage("stop")
		}
	}

	this.setTimerInterval = function(){
		if(this.timerWorker!==null){
		    this.timerWorker.postMessage({"interval": this.interval});
		}
	}


    this.queueSegment = function(seg){
    	//console.log("queued", seg)
    	this.segmentQueue.push(seg);
    	// call the scheduler again
    	this.segmentScheduler();
    }

    /** this is called every 50ms, or interval ms **/
	this.segmentScheduler = function(){
		//console.log("scheduler");
		//console.log(this.bufferQueue)

	    // while there are segments that will need to play before the next interval,
	    // schedule them and advance the pointer.
	    while((this.segmentQueue.length > 0)
	    	&& (this.segmentQueue[0].when < this.context.currentTime + this.windowLength)){
	    	this.play(this.segmentQueue.shift());
	    }

		// The buffer queue tracks what audio is in the buffer, either currently playing or about to play
		// It's only purpose is to know what audio needs to be STOPPED. 
		// Remove anything from here that finished playing 
		this.cleanBufferQueue()
	}



};



