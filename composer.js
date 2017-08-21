
 /* eslint-disable */

function CrowdRemixComposer(_self){
	let self = _self;

	////////////////
	/// COMPOSER ///
	////////////////

	// Composer builds compositions/patterns
	// A composition and a pattern are the same thing.
	// These words are used interchangably
	// (why two words? they used to be different kinds of objects, now they are the same object)
	// session["master_composition"] is the highest-level pattern in the padception
	// The master_composition behaves identically to other patterns, but it cannot be placed inside of anything

	/*
	EXAMPLE COMPOSITION/PATTERN object
	--------------
		rows
		    blocks
		        uuid
		        len
		        pos
		        gain
		        type: “hit” or “pattern"
		        IF HIT
		            hit: “a0” or the hit object (support for pointers or not)
		        IF PATTERN
		            pattern: “a0” or the pattern object (support for pointers or not)
		tempo_multiplier: 1,
		len: 8,
		gain: 1,
		default_grid: 0.5,
		hue: 352
	*/

	self.composer = {};
	// session["master_composition"] is a pattern


	// Create a new empty pattern object
	// Compositions/pater have rows.
	// Rows have blocks.
	// A block is a hit or reference to a pattern
	self.composer.create = function(){
		//console.log('new pattern');
		return {
			"rows": [
				{"gain": 1.0, "blocks": []}
			],				// A list of block events
			"tempo_multiplier": 1.0,
			"len": 8.0,
			"gain": 1.0,
			"default_grid": 0.5,
			"hue": self.pattern_hue()
		}
	}

	// change the length of the the pattern
	self.composer.change_length = function(pattern, len){
		pattern = JSON.parse(JSON.stringify(pattern))
		pattern["len"] = len;
		return pattern;
	}

	// change the gain of the the pattern
	self.composer.change_gain = function(pattern, gain){
		pattern = JSON.parse(JSON.stringify(pattern))
		pattern["gain"] = gain;
		return pattern;
	}

	// change the tempo multiplier of the the pattern
	self.composer.change_tempo_multiplier = function(pattern, tempo_multiplier){
		pattern = JSON.parse(JSON.stringify(pattern))
		pattern["tempo_multiplier"] = tempo_multiplier;
		return pattern;
	}

	// change the default grid size of the the pattern
	// the default grid size is the memory of the last grid size used while editing
	self.composer.change_default_grid = function(pattern, default_grid){
		pattern = JSON.parse(JSON.stringify(pattern))
		pattern["default_grid"] = default_grid;
		return pattern;
	}

	// Creating a new row by populating a row with pattern
	// Row number will be the new row, and everything below it gets pushed down.
	self.composer.insert_row = function(pattern, row_num){
		pattern = JSON.parse(JSON.stringify(pattern))
		row_num = parseInt(row_num,10)
		if(row_num > pattern["rows"].length){
			console.error("Cannot insert at row", row_num, "because there are only", pattern["rows"].length, "rows in", pattern);
			return false;
		}
		let new_row = {
			"blocks": [],
			"gain": 1.0
		}
		pattern["rows"].splice(row_num, 0, new_row);
		return pattern;
	}

	// BLOCKS
	/*
		uuid
		len
		pos
		gain
		type: “hit” or “pattern"
		IF HIT
		    hit: “a0” or the hit object (support for pointers or not)
		IF PATTERN
		    pattern: “a0” or the pattern object (support for pointers or not)
    */
	// A block contains a hit or a pattern


	// Recursively check if self pattern contains the target block_id
	// This is used to prevent patterns containing themselves
	self.composer.contains_block = function(pattern, pattern_id_target, session){
		for(let r in pattern["rows"]){
			let row = pattern["rows"][r]
			for(let b in row["blocks"]){
				let block = row["blocks"][b]
				if(block["type"]==="pattern"){
					let child_pattern;
					if(typeof block["pattern"] === "string"){
						// this is a pattern_id string
						if(block["pattern"] === pattern_id_target){
							return true;
						}
						// look up the pattern_id
						child_pattern = self.get_pattern_from_id(block["pattern"], session);
					}else if(block["pattern"] instanceof Object){
						// there is actually a pattern inside of the pattern
						console.error("Block pattern must be a pattern_id", block)
						//child_pattern = block["pattern"];
					}
					// Look a level deeper
					try{
						if(self.composer.contains_block(child_pattern, pattern_id_target, session)) return true;
						else continue;
					}catch(err){
						console.log("Call stack error: this pattern contains itself. ");
						return true;
					}
				}
			}
		}
		return false;
	}




	// Add hit to the pattern at the given row and position
	// Let the UI decide the length of a hit.
	// Hit can be a string hit_id (example "a0") which refers to a saved hit in the pads/session
	// OR hit can be a full-on hit object
	// This returns an object {"pattern": changed_pattern, "new_block": new_block}
	self.composer.add_hit_block = function(parent_pattern, hit, row_num, pos, len, session){
		if(typeof hit === "string"){
			// pointer
			if(self.verify_hit_id_exists(hit)){
				// clone the hit.
				hit = self.get_hit_from_id(hit)
				hit = JSON.parse(JSON.stringify(hit))
			}else{
				console.warn("Hit with id", hit, "does not exist");
				return {"new_pattern": parent_pattern, "new_block": undefined }
			}
		}else if(hit instanceof Object){
			if(!self.validate_hit(hit)) return {"new_pattern": parent_pattern, "new_block": undefined }
		}else{
			console.error("Invalid hit object", hit)
			return {"new_pattern": parent_pattern, "new_block": undefined }
		}
		let block = {
			"uuid": self.uuid(),
			"len": len,
			"gain": 1.0, // change in the future to adapt to hit gain or something
			"pos": pos,
			"type": "hit",
			"hit": hit,
			"offset": 0
		}
		return self.composer.add_block(parent_pattern, block, row_num, pos, len, session);
	}

	// Add a pattern block to the pattern at the given row and position
	// Pattern must be a string pattern_id (example "a0") which refers to a saved pattern in the pads/session
	// OR pattern can be a full-on pattern object
	// This returns an object {"pattern": changed_pattern, "new_block": new_block}
	self.composer.add_pattern_block = function(parent_pattern_id, child_pattern_id, row_num, pos, len, session){
		if(!(typeof parent_pattern_id === "string")){
			console.error("parent pattern_id must be a pattern_id string like 'a0' or 'master_composition'",  parent_pattern_id);
			return {"new_pattern": undefined, "new_block": undefined, "error": "INVALID_PARENT_PATTERN_ID"};
			//if(!self.validate_pattern(pattern)) return pattern;
		}
		let parent_pattern = {};
		if(parent_pattern_id === "master_composition"){
			parent_pattern = session["master_composition"];
		}else if(parent_pattern_id in session["patterns"]){
			parent_pattern = session["patterns"][parent_pattern_id]
		}else{
			console.error("Unknown parent parent_id", parent_pattern_id);
			return {"new_pattern": undefined, "new_block": undefined, "error": "UNKNOWN_PARENT_PATTERN_ID"};
		}
		if(typeof child_pattern_id === "string"){
			if(child_pattern_id === parent_pattern_id){
				console.error("Cannot put a pattern inside of itself");
				return {"new_pattern": parent_pattern, "new_block": undefined, "error": "INFINITE_FRACTAL_ERROR"};
			}
			if(!self.verify_pattern_id_exists(child_pattern_id, session)){
				console.error("Pattern with id", child_pattern_id, "does not exist");
				return {"new_pattern": parent_pattern, "new_block": undefined, "error": "UNKNOWN_CHILD_PATTERN_ID"};
			}
			let child_pattern = session["patterns"][child_pattern_id];
			if(self.composer.contains_block(child_pattern, parent_pattern_id, session)){
				console.error("Can't put the pattern deeply inside of itself")
				return {"new_pattern": parent_pattern, "new_block": undefined, "error": "INFINITE_FRACTAL_ERROR"};
			}
			// clone the pattern?
			// no
		}else if(child_pattern_id instanceof Object){
			console.error("Must add a child pattern using a pattern_id string");
			return {"new_pattern": parent_pattern, "new_block": undefined, "error": "INVALID_CHILD_PATTERN_ID"};
			//if(!self.validate_pattern(pattern)) return pattern;
		}else{
			console.error("Invalid child_pattern_id", child_pattern_id)
			return {"new_pattern": parent_pattern, "new_block": undefined, "error": "INVALID_CHILD_PATTERN_ID"};
		}
		let block = {
			"uuid": self.uuid(),
			"len": len,
			"gain": 1.0, // change in the future to adapt to hit gain or something
			"pos": pos,
			"type": "pattern",
			"pattern": child_pattern_id,
			"offset": 0
		}
		// console.log(parent_pattern, block);

		return self.composer.add_block(parent_pattern, block, row_num, pos, len, session);
	}

	// Once you have a block object (using add add_pattern_block or add_hit_block)
	// Or if you are duplicating a block in the composer
	// Use this function to add it to the pattern at row_num, pos with() len
	self.composer.add_block = function(pattern, block, row_num, pos, len, session){
		pattern = JSON.parse(JSON.stringify(pattern))
		len = parseFloat(len,10)
		pos = parseFloat(pos,10)
		row_num = parseInt(row_num,10)
		if(!(row_num in pattern["rows"])){
			console.error("Row", row_num, "does not exist in pattern", pattern);
			return;
		}

		let blocks = pattern["rows"][row_num]["blocks"];
		let _block = JSON.parse(JSON.stringify(block));
		_block["uuid"] = self.uuid(); // assign a new UUID just in case this is a duplication
		if(!("gain" in _block)){
			_block["gain"] = 1.0
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
		return {"new_pattern": pattern, "new_block": _block};
	}


	// in the given pattern and row, delete the hit with the given index
	self.composer.remove_block = function(pattern, row_num, block_uuid){
		pattern = JSON.parse(JSON.stringify(pattern))
		row_num = parseInt(row_num,10)
		if(!(row_num in pattern["rows"])){
			console.error("Row", row_num, "does not exist in pattern", pattern);
			return false;
		}
		let block_index = self.composer.find_block(pattern, row_num, block_uuid);
		if(block_index===undefined){
			console.error("Block", block_uuid, "does not exist in row", row_num, "in pattern", pattern);
			return pattern;
		}
		let blocks = pattern["rows"][row_num]["blocks"];
		//console.log(block_index, "block remove")
		blocks.splice(block_index, 1);
		return pattern;
	}

	// Find the block in the pattern by UUID
	// Returns the index of the block in the row array
	self.composer.find_block = function(pattern, row_num, block_uuid){
		let row = pattern["rows"][row_num];
		for (let b in row["blocks"]){
			let block = row["blocks"][b];
			if(block["uuid"] === block_uuid){
				return b;
			}
		}
		return undefined;
	}

	// Clone the given block into a new block object
	// This may be a duplicate of add_block 
	self.composer.clone_block = function(block, pos, len, offset){
		let new_block = JSON.parse(JSON.stringify(block));
		new_block["pos"] = pos;
		new_block["len"] = len;
		new_block["offset"] = offset;
		new_block["uuid"] = self.uuid(); // assign a new UUID just in case this is a duplication
		return new_block;
	}

	// in the given pattern and row, change the block at block_index to have new position and length
	//
	self.composer.translate_block = function(pattern, row_num, block_uuid, new_pos, new_len, new_row_num){
		if(parseFloat(new_len)<=0){
			// delete the block if LENGTH 0
			return self.composer.remove_block(pattern, row_num, block_uuid);
		}
		if(parseFloat(new_len) + parseFloat(new_pos) <= 0){
			// the block has been completely moved off screen to the left
			// delete it
			return self.composer.remove_block(pattern, row_num, block_uuid);
		}

		pattern = JSON.parse(JSON.stringify(pattern))
		row_num = parseInt(row_num,10)
		if(!(row_num in pattern["rows"])){
			console.error("Row", row_num, "does not exist in pattern", pattern);
			return pattern;
		}
		if(new_row_num===undefined){
			// if new_row_num is not set, assume the row hasn't changed
			new_row_num = row_num
		}else{
			if(!(new_row_num in pattern["rows"])){
				console.error("Row", new_row_num, "does not exist in pattern", pattern);
				return pattern;
			}else{
				new_row_num = parseInt(new_row_num,10)
			}
		}
		let block_index = self.composer.find_block(pattern, row_num, block_uuid);
		if(block_index===undefined){
			console.error("Block", block_uuid, "does not exist in row", row_num, "in pattern", pattern);
			return pattern;
		}

		// This is the block we're translating
		let _block = pattern["rows"][row_num]["blocks"][block_index];

		_block["len"] = parseFloat(new_len)
		_block["pos"] = parseFloat(new_pos)
		if(new_row_num !== row_num){
			// switch rows
			pattern["rows"][row_num]["blocks"].splice(block_index, 1)
			pattern["rows"][new_row_num]["blocks"].push(_block)
		}
		let new_row_blocks = pattern["rows"][new_row_num]["blocks"]

		// Deal with Blocks ontop of Blocks
		//console.log("block_index", block_index)
		for(let s=0;new_row_blocks[s];s++){
			//console.log(JSON.stringify(new_row_blocks))
			if(new_row_blocks[s]["uuid"] === block_uuid){
				continue; // ignore the block we're editing
			}
			let p1 = new_row_blocks[s]["pos"];
			let l1 = new_row_blocks[s]["len"];
			let p2 = _block["pos"];
			let l2 = _block["len"];

			let o1 = isNaN(new_row_blocks[s]["offset"])?0:parseFloat(new_row_blocks[s]["offset"]);

			if(Math.abs(p1 - p2) < self.epsilon_block &&
			   Math.abs(l1 - l2) < self.epsilon_block){
				// remove any block which is taking up the same space 
				// (within a 0.001th of a beat to fix any potential rounding errors)
				new_row_blocks.splice(s, 1);
				if(block_index>s) block_index-=1 // shift self hit back
				//console.log("Removed ontop",s, "New block_index", block_index)
				s-=1
			}else if(p1 + l1 - self.epsilon_block <= p2 ){
				// ignore, too far behind
				//console.log("ignore behind", s)
			}else if(p1 >= p2 + l2 - self.epsilon_block){
				// ignore, too far ahead

				//console.log("ignore ahead", s)
			}else{
				// Block ontop of block, but not the same length 
				if(p2 > p1 && (p2+l2)>=(p1+l1)){
					// Moved block comes after existing block
					// Change the length of the existing block to make room 
					new_row_blocks[s]["len"] = p2-p1;
				}else if(p2 > p1){
					// Moving a tiny block ontop of a huge block
					// Split the block into two 
					new_row_blocks[s]["len"] = p2-p1;
					let rightsplit_pos = p2+l2;
					let rightsplit_len = (l1+p1)-(l2+p2);
					let rightsplit_offset = o1 + (l2) + (p2-p1);
					let new_split_block = self.composer.clone_block(new_row_blocks[s], rightsplit_pos, rightsplit_len, rightsplit_offset);
					// add the new block
					// It's okay to just push, because we sort later
					new_row_blocks.push(new_split_block);					
					//console.log("mitosis", new_split_block,new_row_blocks , rightsplit_pos, rightsplit_len, rightsplit_offset)

				}else if(p2 <= p1 && (p2+l2)<(p1+l1)){
					// New block comes before, crushing the others' start position
					// Change the length of the existing block
					// And shift its offset to make room 	
					new_row_blocks[s]["pos"] = p2+l2;
					new_row_blocks[s]["len"] = (l1+p1) - (p2+l2);
					new_row_blocks[s]["offset"] = o1 + (p2+l2) - p1;
				}else{
					// Moving a huge block ontop of another block
					// Remove the block 
					new_row_blocks.splice(s, 1);
					if(block_index>s) block_index-=1 // shift self hit back
					//console.log("Removed",s, "New block_index", block_index)
					s-=1
				}
			}
		}

		// Resort the blocks
		new_row_blocks.sort(function(a,b){
			return a["pos"] - b["pos"];
		});

		return pattern;
	}

	// remove the row
	self.composer.remove_row = function(pattern, row_num){
		pattern = JSON.parse(JSON.stringify(pattern))
		row_num = parseInt(row_num,10)
		if(!(row_num in pattern["rows"])){
			console.error("Row", row_num, "does not exist in pattern", pattern);
			return false;
		}
		pattern["rows"].splice(row_num, 1);
		return pattern;
	}

}