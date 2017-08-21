
 /* eslint-disable */

////////////////
// Test Suite //
////////////////
function CrowdRemixTestSuite(_self){
	let self = _self;

	self.run_test_suite = function(){
		let session = {};
		session["master_composition"] = {};
		session["patterns"] = {};
		session["hits"] = {};
		session["global_bpm"] = 120;
		session["global_gain"] = 1.0;
		// console.log(session);

		let song_ids = self.songs.map(function(m){return parseInt(m["song_id"],10)})
		console.log("song_ids", song_ids);

		let pools = [];
		let rand1, rand2, start, end, pool, song_id;
		let chaos, gain, gaps, tempo_multiplier;

		for(let i = 0; i<100; i++){
			rand1 = Math.random()
			rand2 = Math.random()
			start = Math.min(rand1, rand2)*100;
			end = Math.max(rand1, rand2)*100;
			song_id = song_ids[Math.floor(Math.random()*song_ids.length)];
			let {pool, start, end} = self.make_pool_from_song_range(song_id, start, end, "s");
			console.log(song_id, start, end, pool)
			assert(self.validate_pool(pool));
			pools.push(pool)
		}
		// do more validation
		console.log("pools", pools)

		let hits = []
		for(let p in pools){
			chaos = Math.random()*2<1;
			gaps = Math.random()*2<1?"gaps":"flows"
			gain = Math.random();
			let hit = self.make_hit(pools[p], chaos, gain, gaps);
			console.log(hit)
			assert(self.validate_hit(hit), "Hit invalid " + p);
			hits[p] = (hit)
			session["hits"]["h"+p] = hit
		}

		let pts = []
		for(let pt in self.pattern_templates){
			pts[pt] = self.pattern_templates[pt]
			console.log("Pattern Template", pt, pts[pt])
			assert(self.validate_pattern_template(pts[pt]), "pattern template " + pt + " invalid");
		}

		let pats = []
		for(let pt in self.pattern_templates){
			chaos = Math.random()*2<1;
			gaps = Math.random()*2<1?"gaps":"flows"
			gain = Math.random();
			tempo_multiplier = Math.random();
			pool = pools[Math.floor(Math.random()*pools.length)]
			let pat = self.make_pattern(pool, pts[pt], chaos, gain, gaps, tempo_multiplier);
			console.log("Pattern", pt, pat)
			pats[pt] = pat
			assert(self.validate_pattern(pat), "Pattern invalid " + pt);
			session["patterns"]["p"+pt] = pat
		}

		let x0 = self.composer.insert_row(pats[0],0)
		console.log("Insert Row", 0, x0)
		session["patterns"]["x0"] = x0

		let x1 = self.composer.insert_row(x0,1)
		console.log("Insert row", 1, x1)
		session["patterns"]["x1"] = x1

		let x2 = self.composer.remove_row(x1,0)
		console.log("Remove row",1, x2)
		session["patterns"]["x2"] = x2

		let x3 = self.composer.add_hit_block(x2, hits[0], 0, 0.1, 1.0, session)["new_pattern"]
		console.log("add_hit_block", x3)
		session["patterns"]["x3"] = x3

		let x4 = self.composer.add_pattern_block("x3", "x2", 1, 4.3, 1.0, session)["new_pattern"]
		console.log("add_pattern_block", x4)
		session["patterns"]["x4"] = x4

		session["master_composition"] = x4;
		// putting a pattern inside of itself
		self.composer.add_pattern_block("x2", "x4", 1, 8.3, 1.0, session)

		let m2 = self.composer.add_pattern_block("master_composition", "x4", 1, 14.3, 1.0, session)
		let uuid = m2["new_block"]["uuid"]
		m2 = m2["new_pattern"]
		session["master_composition"] = m2;
		console.log("add_pattern_block", m2)

		let m3 = self.composer.translate_block(m2, 1, uuid, 0.014, 0.001, 0);
		console.log("translate_block", m3)

		let m4 = self.composer.remove_block(m3, 0, uuid);
		console.log("remove_block", m4)

		window.session = session
		console.log(session, self)

		//CrowdRemixEngine.play_pattern(session["patterns"]["p0"], 0, session, null, null)
		// find_block
		// remove block
		// translate block





	}

	function assert(condition, message) {
	    if (!condition) {
	        message = message || "Assertion failed";
	        if (typeof Error !== "undefined") {
	            throw new Error(message);
	        }
	        throw message; // Fallback
	    }
	}
}

