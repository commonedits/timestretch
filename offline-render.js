
/* eslint-disable */

function CrowdRemixOfflineRender(_self){
	let self = _self;
	let status = "standby";
	self.rendered_wave_data = null;
	self.attribution_segments = []; 

	// return the status:
	// - standby (nothing has started rendering)
	// - rendering (engine is rendering the audio)
	// - encoding (rendering complete, now encoding into wav)
	// - failed (something went wrong)
	// - complete (done, it can be downloaded)
	self.check_offline_render_status = function(){
		return status;
	}

	/*
	self.get_rendered_wav_data = function(i){
		return rendered_wave_data.getInt8(i)
	}*/

	// Make a flat segment list (for attribution tracking)
	// TODO: include the randomness Seed, 
	// 	so we know this flat segment list is equivalent to the rendered audio given the same seed
	self.flat_segment_list = function(session){
		// Remember the old settings
		let _generator_window = self.generator_window; 
		let _windowLength = self.Sound.windowLength; 
		// Stop everything
		self.stop_all_loops()
		
		let master = session["master_composition"];
		// Calculate the length in seconds of the composition
		let secs_per_beat = self.calculate_secs_per_beat(master, session)
		let pattern_length = parseFloat(master["len"]); // length in beats
		if(pattern_length<=0){
			console.error("Invalid pattern length: " + pattern_length);
			return
		}
		let pattern_end_time = pattern_length * secs_per_beat;

		self.attribution_segments = [];
		let silent_attribution_segments_run = true
		// Run the generator
		let generator = self.pattern_generator(master, 0, 0, pattern_end_time, master["global_gain"], session, silent_attribution_segments_run);
		generator.next();
		// Saves the result to self.attribution_segments;

		// Return the old settings
		self.generator_window = _generator_window;
		self.Sound.windowLength = _windowLength;

		return self.attribution_segments;

	}

	// Call this AFTER loading songs
	self.render_master_composition = function(session, filename, callback){
		status = "rendering"

		// Stop Everything else
		self.stop_all_loops()
		// Set the windows to Infinity; render everything!!
		self.generator_window = Infinity;
		self.Sound.windowLength = Infinity;

		let master = session["master_composition"];
		// Calculate the length in seconds of the master
		let secs_per_beat = self.calculate_secs_per_beat(master, session)
		let pattern_length = parseFloat(master["len"]); // length in beats
		if(pattern_length<=0){
			console.error("Invalid pattern length: " + pattern_length);
			return
		}
		let pattern_end_time = pattern_length * secs_per_beat; // length in seconds
		// Create the OfflineAudioContext
		// 44100hz, 2 Channel, length of the master composition
		self.Sound.context = new OfflineAudioContext(2, 44100*pattern_end_time, 44100);

		let generator = self.pattern_generator(master, 0, 0, pattern_end_time, master["global_gain"], session);
		generator.next();

		//console.log("Finished queueing through the playback engine");
		// Finished queueing through the playback engine
		// Now render the offlineAudioContext
		self.Sound.context.startRendering().then(function(buffer) {
			//console.log("Finished rendering the offlineAudioContext");
			// Finished rendering the offlineAudioContext
			// Now create the WAV file
			status = "encoding"
			// Interleave the L and R channels
	        let interleaved = interleave_channels(buffer.getChannelData(0), buffer.getChannelData(1))
			// Encode into WAV
			let data = encode_wav(interleaved);
			self.rendered_wave_data = data;
			// Make a blob for downloading
			let blob = new Blob([data], { type: 'audio/wav' });
			// Prompt the user to download
			let url = prompt_download(blob, filename);
			status = "complete"
			if(typeof callback === "function"){
				callback(blob, filename, url);
			}
			return filename;
	    }).catch(function(err) {
	        console.log('Rendering failed: ' + err);
	        status = "failed"
	        // Note: The promise should reject when startRendering is called a second time on an OfflineAudioContext
	    });
	}

	// Prompt the user to download the [blob] file with given filename
	function prompt_download(blob, filename){
	    let url = (window.URL || window.webkitURL).createObjectURL(blob);
	    let link = window.document.createElement('a');
	    link.href = url;
	    link.download = filename || 'output.wav';
	    var event = new MouseEvent('click', {
		    'view': window,
		    'bubbles': true,
		    'cancelable': true
		});
		link.dispatchEvent(event);
		return url;
	}

	///////
	// ENCODE WAV
	// borrowed from recorder.js
	////////

    // Interleave the left and right channels into a stereo WAV file
    function interleave_channels(inputL, inputR){
		let length = inputL.length + inputR.length;
		let result = new Float32Array(length);
		let r = 0; // render index
		let i = 0; // input index
		while (r < length){
			result[r++] = inputL[i];
			result[r++] = inputR[i];
			i++;
		}
		return result;
    }

	function encode_wav(samples){
		let buffer = new ArrayBuffer(44 + samples.length * 2);
		let data = new DataView(buffer);
		let sampleRate = 44100;

		/* RIFF identifier */
		write_string(data, 0, 'RIFF');
		/* file length */
		data.setUint32(4, 32 + samples.length * 2, true);
		/* RIFF type */
		write_string(data, 8, 'WAVE');
		/* format chunk identifier */
		write_string(data, 12, 'fmt ');
		/* format chunk length */
		data.setUint32(16, 16, true);
		/* sample format (raw) */
		data.setUint16(20, 1, true);
		/* channel count */
		data.setUint16(22, 2, true);
		/* sample rate */
		data.setUint32(24, sampleRate, true);
		/* byte rate (sample rate * block align) */
		data.setUint32(28, sampleRate * 4, true);
		/* block align (channel count * bytes per sample) */
		data.setUint16(32, 4, true);
		/* bits per sample */
		data.setUint16(34, 16, true);
		/* data chunk identifier */
		write_string(data, 36, 'data');
		/* data chunk length */
		data.setUint32(40, samples.length * 2, true);

		float_to_16bit_pcm(data, 44, samples);

		return data;
	}

	function write_string(data, offset, string){
		for (let i = 0; i < string.length; i++){
			data.setUint8(offset + i, string.charCodeAt(i));
		}
	}

	function float_to_16bit_pcm(output, offset, input){
		for (let i = 0; i < input.length; i++, offset+=2){
			let s = Math.max(-1, Math.min(1, input[i]));
			output.setInt16(offset, s < 0 ? s * 0x8000 : s * 0x7FFF, true);
		}
	}


	/*** AUTO RENDER ***/
	// Pass session json url into the query string ?session=http://...json
	//self.auto_render_flag = false
	// console.log("window.location", window.location.pathname)
	if(window.location.pathname=="/vektor_blackfuture" && !window.auto_render_flag){
		window.auto_render_flag = true
		let urlParams = new URLSearchParams(window.location.search);
		let session_url = urlParams.get('session')
		let session_id = parseInt(urlParams.get('session_id'))
		let vbf_secret = urlParams.get('vbf_secret')
		if(vbf_secret && session_id && session_url){
			let xobj = new XMLHttpRequest();
		    xobj.overrideMimeType("application/json");
		    xobj.open('GET', session_url, true);
		    console.log("getting", session_url)
		    // Replace 'my_data' with the path to your file
		    xobj.onreadystatechange = function() {
		    	console.log(xobj.readyState, xobj.status)
		        if (xobj.readyState == 4 && xobj.status == "200") {
		        	console.log("loaded", JSON.parse(xobj.responseText))
		            // Required use of an anonymous callback
		            // as .open() will NOT return a value but simply returns undefined in asynchronous mode
		            auto_load_session(vbf_secret, session_id, JSON.parse(xobj.responseText));
		        }
		    };
		    xobj.send();
		}
	}	

	// Get flat list of segments to send to backend for attribution
	self.update_session_pie_from_renderer = function(vbf_secret, session_id, session, callback){
		// Get flat list of segments to send to backend for attribution.
		let flat_segments = self.flat_segment_list(session);
		// Call the backend.
		// The vbf_secret has to match the vbf_secret in the API, so we know this came through a lambda request
		// The problem with this is that any third-party plugins used on CrowdRemix can also see this secret.
		// i.e. Google Analytics, Inspectlet
		// A slightly better solution might use a cryptographic token with an expiration date
		// + headless browser renders of CrowdRemix should block third-party plugins
		// + when running headless in lambda, lambda should block all outgoing requests except to AWS+CommonEdits 
		let data = {
			"flat_segments": flat_segments,
			"session_id": session_id, 
			"vbf_secret": vbf_secret
		}
		// Send to the backend 
		axios.post(api.sessionSaveFlatSegments, data).then((res) => {
			console.log("sessionSaveFlatSegments success", res);
            callback();
        }).catch(function (error) {
		    console.log(error);
		});
	}

	// Load the session
	function auto_load_session(vbf_secret, session_id, session){
		self.set_songs(session["songs"])
		self.load(
			function(i,p,t){console.log([i,p,t])}, // progress
			function(){
				console.log("success");
				self.update_session_pie_from_renderer(vbf_secret, session_id, session, function(){
					// Now render the master composition to a WAV
					self.render_master_composition(session, "render.wav", function(blob, filename, url){
						console.log("done rendering");
						console.log(blob, filename, url);
						auto_upload_blob(blob);
					});
				});
			},
			function(e){console.error("error",e)} // erir
    	)
    	/*self.load_analysis(
			function(){
				console.log("success_analysis");
			},
			function(e){console.error("error_analysis",e)} // erir
    	)   */

    	/*self.load_spectrograms(
			function(){
				console.log("success_spectrogram");
			},
			function(e){console.error("error_spectrogram",e)} // erir
    	)*/
	}
	function auto_upload_blob(blob){
		let urlParams = new URLSearchParams(window.location.search);
		let aws_access_key = urlParams.get('aws_access_key');
		let aws_secret_key = urlParams.get('aws_secret_key');
		let s3Key = urlParams.get('s3Key');
		// The AWS secret key:
		// The problem with this is that any third-party plugins used on CrowdRemix could also see this secret.
		// i.e. Google Analytics, Inspectlet
		// A slightly better solution might use a cryptographic token with an expiration date
		// + headless browser renders of CrowdRemix should block third-party plugins
		// + when running headless in lambda, lambda should block all outgoing requests except to AWS+CommonEdits 
		AWS.config.update({
			accessKeyId : aws_access_key,
			secretAccessKey : aws_secret_key
		});
		AWS.config.region = 'us-west-1';
		var s3 = new AWS.S3({apiVersion: '2006-03-01'});
		var params = {
			"Key": s3Key,
			"ContentType": "audio/x-wav",
			"Body": blob,
			"ACL": "public-read",
			"Bucket": "blobs.crowdremix.io"

		};
		console.log(s3Key, params, aws_access_key, aws_secret_key)
		s3.upload(params, function(err, data) {
		  console.log(err, data);
		});
	}

	/****/

}

