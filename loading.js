
 /* eslint-disable */

function CrowdRemixLoading(_self){
	let self = _self;

	self.is_loaded = function(){
		return self.songs.length > 0 && self.analysis.length > 0 && self.hires_spectrograms.length > 0;
	}

	/* songs should look like they came straight out of the API
		example: api.commonedits.com/v1/song/543
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

	self.set_songs = function(songs){
		// save songs
		// console.log("setting songs");
		self.songs = songs;
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
	self.load_audio = function(progress, success, error){
		let things_loaded = 0;
		self.Sound.load(self.songs, progress, function(song_id){
			things_loaded += 1;
			if(things_loaded === self.songs.length){
				success();
			}
		}, error);
	}

	/*
	success		callback function() called when all analyses have finished loading
	error		callback function(e) called on error
	*/
	self.load_analysis = function(success, error){
		let things_loaded = 0;
		let analysis = {}
		for(let i in self.songs){
			let url = self.songs[i]["analysis_json_url"];
			let analysis_id = self.songs[i]["analysis_id"];
			let song_id = self.songs[i]["song_id"];
			let xmlhttp = new XMLHttpRequest();
			xmlhttp.onreadystatechange = function() {
			    if (xmlhttp.readyState === 4 && xmlhttp.status === 200) {
			    	// Temporary fix convert any NaN to 0.
			    	let analysis_string = xmlhttp.responseText.replace('"ro": NaN','"ro": 0')
			        self.analysis[song_id] = JSON.parse(analysis_string);
			        self.analysis[song_id]["analysis_id"] = analysis_id;
			        things_loaded += 1;
			        if(things_loaded === self.songs.length){
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
	self.load_spectrograms = function(success, error){
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
				// let element_id = 'hires_spectrogram_' + song_id + '_' + s;
				// save it to self class object
				self.hires_spectrograms[song_id][s] = img
				//document.body.appendChild(img);
				let loadHandler = function(e){
					loaded += 1
					if(loaded === total) success(self.hires_spectrograms);
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
	self.load = function(progress_audio, success, error){

		let things_loaded = 0;
		let check = function(){
			things_loaded += 1;
			if(things_loaded === 3) success();
		}

		self.load_audio(
			progress_audio,
			function (){
				// console.log("Done loading music");
				check();
			}, error
		);

		self.load_analysis(
			function(analysis){
				// console.log("Done loading analysis")
				check();
			}, error
		);

		self.load_spectrograms(
			function(hires_spectrograms){
				// console.log("Done loading spectrograms");
				check();
			}, error
		);
	}

	// get the song data from the session
	self.get_song = function(song_id, session){
		for(let i in session["songs"]){
			let song = session["songs"][i];
			if(song["song_id"]===song_id) return song;
		}
		console.error("Song not loaded", song_id);
		return;
	}

	// Unload songs, analyses, spectrograms, and stop the sound 
	self.unload_all = function(){
		self.stop_all_sound();
		for(let song_id in self.songs){
			self.Sound.unload_song(song_id)
		}
		self.songs = [];
		self.analysis = {};
		self.hires_spectrograms = {};
	}

	// Unload just this one song
	// If you're calling this on unused songs, you don't need to do stop_all_sound()
	// But if you don't know if this song is unused, you should probably first stop_all_sound()
	self.unload_song = function(song_id){
		self.Sound.unload_song(song_id);
		delete self.songs[song_id];
		delete self.analysis[song_id];
		delete self.hires_spectrograms[song_id];
	}

	// Which song are being used?
	// Returns two lists of song_ids as {used, not_used}
	// Traverses all the patterns and master_composition
	// There are more efficient ways to traverse, but no need to optimize, this way is simpler
	self.which_songs_are_used_in_session = function(session){
		let loaded_song_ids = self.songs.map(x=>x["song_id"]);
		let used = [];
		// look through patterns
		for(let p in session["patterns"]){
			let pattern = session["patterns"][p];
			used = used.concat(self.which_songs_are_used_in_pattern(pattern, session)["used"]);
		}
		// look through hits
		for(let h in session["hits"]){
			let hit = session["hits"][h];
			used.push(hit["seg"][0]);
		}
		// look through master_composition
		used = used.concat(self.which_songs_are_used_in_pattern(session["master_composition"], session)["used"]);
		// Now build a unique list of used and not_used
		let used_unique = [];
		let not_used_unique = [];
    	for(let i in loaded_song_ids){
    		let id = parseInt(loaded_song_ids[i])
       	 	if(used.indexOf(id)>=0) {
        	    used_unique.push(id);
       	 	}else{
       	 		not_used_unique.push(id)
       	 	}
    	}
		return {"used": used_unique, "not_used": not_used_unique}
	}

	self.which_songs_are_used_in_pattern = function(pattern, session){
		let loaded_song_ids = self.songs.map(x=>x["song_id"]);
		let used = [];
		// Traverse the pattern, concat all song_ids into used
		for(let r in pattern["rows"]){
			let row = pattern["rows"][r];
			for(let b in row["blocks"]){
				let block = row["blocks"][b];
				if(block["type"]==="hit"){
					if(block["hit"] instanceof Object){
						// This is a real hit object
						let hit = block["hit"];
						used.push(parseInt(hit["seg"][0]));
					}else{
						console.error("Block hit needs to be a full hit, not a hit_id", block);
					}
				}else if(block["type"]==="pattern"){
					if(typeof block["pattern"] === "string"){
						// this is a reference pointer to the pattern object in the session
						let pattern_id = block["pattern"]
						let pattern = session["patterns"][pattern_id];
						used = used.concat(self.which_songs_are_used_in_pattern(pattern, session)["used"]);
					}else{
						console.error("Block patterns need to be pattern_id pointers, not full patterns", block);
					}
				}else{
					console.error("Block has unknown type", block)
				}
			}
		}
		// Now build a unique list of used and not_used
		let used_unique = [];
		let not_used_unique = [];
    	for(let i in loaded_song_ids){
    		let id = parseInt(loaded_song_ids[i])
       	 	if(used.indexOf(id)>=0) {
        	    used_unique.push(id);
       	 	}else{
       	 		not_used_unique.push(id)
       	 	}
    	}
		return {"used": used_unique, "not_used": not_used_unique}
	}
}

