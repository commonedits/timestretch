
 /* eslint-disable */

function CrowdRemixDraw(_self){
	let self = _self;

	/////////////
	// DRAWING //
	/////////////

	self.draw_pattern = function(ctx, pattern, session, block_len, offset,
		depths_until_solidcolor_patterns=Infinity,
		depths_until_solidcolor_hits=Infinity,
		background_fill_color="#000000"){
		// console.log("breakpoint", depths_until_solidcolor_patterns, depths_until_solidcolor_hits)
		let canvas_w = ctx.canvas.width;
		let canvas_h = ctx.canvas.height;
		let canvas_x = 0;
		let canvas_y = 0;
		if(typeof pattern === "string"){
			// this is a reference pointer to the pattern object in the session
			pattern = session["patterns"][pattern];
		}

		//console.log("draw_pattern", ctx, pattern);
		self.draw_pattern_in_region(canvas_x, canvas_y, canvas_w, canvas_h,
		ctx, pattern, session, block_len, offset,
		depths_until_solidcolor_patterns,
		depths_until_solidcolor_hits,
		background_fill_color);
	}

	self.draw_pattern_in_region = function(canvas_x, canvas_y, canvas_w, canvas_h,
		ctx, pattern, session, block_len, offset,
		depths_until_solidcolor_patterns=Infinity,
		depths_until_solidcolor_hits=Infinity,
		background_fill_color="#000000"){
		// draw the things innside


		if(depths_until_solidcolor_patterns<=0){
			// we've reached the bottom
			let fill_color = "hsla("+pattern["hue"]+",60%,50%,1.0)";
			ctx.beginPath();
			ctx.rect(canvas_x, canvas_y, canvas_w, canvas_h);
			ctx.fillStyle = fill_color;
			ctx.fill();
			return
		}
		// background
		ctx.beginPath();
		ctx.rect(canvas_x, canvas_y, canvas_w, canvas_h);
		ctx.fillStyle = background_fill_color;
		ctx.fill();
		// What is the length of the pattern loop
		let pattern_len = pattern["len"]

		// What is the length of the pattern block (how many times repeated)
		if(!block_len){
			// if this pattern is in inside of another pattern's block
			// the block length might be different from the pattern length
			// If shorter, cut the ss short
			// If longer, repeat and extend it
			block_len = pattern["len"];
		}	
		if(!offset){
			// the start time might be non-zero (starts in the middle of the pattern)
			// example: this pattern is inside of another pattern's block
			offset = 0.0;
		}else{
			// If pattern_offset is greater than pattern_len, that's okay.
			// Pretend the pattern had looped around and calculate the new offset. 
			// If offset is less than 0, that's okay. 
			// Modulo fixes all. 
			offset = parseFloat(offset) % pattern_len; 
		}

		// What are the loop start/end times
		// (not yet supported)

		// okay start drawing

		// The number of times this block loops
		let num_loops = Math.ceil(parseFloat(block_len)/pattern_len);
		// The length in pixels of a single loop 
		let canvas_loop_w = canvas_w / num_loops;

		//console.log("drawregio2",  offset, num_loops, block_len, pattern_len );
		//console.log("draw_pattern_in_region", 
		//	pattern["len"], block_len, offset, num_loops, canvas_w);

		// todo : offset support 

		for(let pos_offset = -offset; pos_offset <= block_len; pos_offset += pattern_len){
			// For each row, draw the hits according to their color
			let num_rows = pattern["rows"].length
			let row_h = canvas_h / num_rows;
			for(let row_num in pattern["rows"]){
				let row = pattern["rows"][row_num];
				let row_y = row_h * row_num + canvas_y;
				for(let block_index in row["blocks"]){
					let block = row["blocks"][block_index]
					// position / length
					let pos = block["pos"];					
					let len = block["len"];
					if(pos >= pattern_len ){
						// this block goes beyond the right border of the pattern
						//console.log("beyond the pattern", pos, pattern_len)
						break; // end the row
					}
					// adjust for offset
					pos += pos_offset;
					if(pos >= block_len){
						// this block goes beyond the right border of the parent block
						//console.log("beyond the block", pos, block_len)
						break;
					}	
					if(pos+len <= 0){
						// this block is beyond the left border of the parent block
						continue;
					}			
					let block_y = row_y
					let block_h = row_h
					let block_w = canvas_w/block_len * len 
					let block_x = canvas_w/block_len * pos + canvas_x

					if(pos+len > block_len){
						// this block should only be drawn partially.
						// This block extends beyond the right border of the parent block 
						block_w = canvas_w+canvas_x - block_x;
						// Clone the block, crop the length
						// This method of cloning will break if block contains a data structure which cannot be stringified
						// But it's not supposed to; otherwise we can't save sessions to .json files 
						block = JSON.parse(JSON.stringify(block))
						block["len"] = block_len - pos;
					}
					if(pos < 0 && pos+len > 0){
						// this block should only be drawn partially
						// This block extends beyond the left border of the parent block, because of offset
						// Clone the block, crop the length, set an offset
						block = JSON.parse(JSON.stringify(block))
						block["pos"] = 0
						block["offset"] = -pos;
						block["len"] += pos; // subtract the offset position
						block_x = canvas_x; // start the block at the beginning of the region
						block_w += pos * canvas_w/block_len // adjust the beginning
					}

					// Final check to make sure nothing is drwan outside the border
					// This will squeeze any final blocks on the right border
					// If they weren't caught by the cornercase checks above
					if(block_x + block_w > canvas_x + canvas_w) block_w = canvas_w + canvas_x - block_x; 

					/*console.log("draw_block_in_region", block_x, block_y, block_w, block_h,
							ctx, pattern, row_num, block_uuid, session, depths_until_solidcolor_patterns - 1,
							depths_until_solidcolor_hits - 1)*/

					self.draw_block_in_region(block_x, block_y, block_w, block_h,
							ctx, block, session,
							depths_until_solidcolor_patterns - 1,
							depths_until_solidcolor_hits - 1);

				}
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
	self.draw_block = function(ctx, parent_pattern, row_num, block_uuid, session,
											depths_until_solidcolor_patterns=1,
											depths_until_solidcolor_hits=1){
		let canvas_x = 0;
		let canvas_y = 0;
		let canvas_w = ctx.canvas.width;
		let canvas_h = ctx.canvas.height;

		// GET THE BLOCK FROM THE UUID
		let block_index = self.composer.find_block(parent_pattern, row_num, block_uuid);
		let block = parent_pattern["rows"][row_num]["blocks"][block_index];
		if(!block){
			return console.error("Block_uuid", block_uuid, "is not in row", row_num, "in this pattern", parent_pattern)
		}

		// COLOR THE BLOCK
		/*let is_comp = self.composer.block.is_pattern(block["block_id"]);
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

		//console.log("draw_block", block_uuid, block)
		self.draw_block_in_region(canvas_x, canvas_y, canvas_w, canvas_h,
		ctx, block, session,
		depths_until_solidcolor_patterns,
		depths_until_solidcolor_hits);

		/*if(is_comp){
			ctx.filter = "none";
		}*/
	}

	// Either for drawing a full composer block
	// Or for drawing a block within a block
	self.draw_block_in_region = function(canvas_x, canvas_y, canvas_w, canvas_h,
		ctx, block, session,
		depths_until_solidcolor_patterns=Infinity,
		depths_until_solidcolor_hits=Infinity){

		let block_len = block["len"]; // length of the block, not the loop length of the thing inside
		let offset = isNaN(block["offset"])?0:parseFloat(block["offset"]); // if offset>0, the thing starts in the middle of its loop
		//console.log("draw_block_in_region", depths_until_solidcolor_patterns, depths_until_solidcolor_hits);

		if(block["type"]==="hit"){
			// hit
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
			let solidcolor = (depths_until_solidcolor_hits<=0)
			//console.log("draw_hit_in_region", solidcolor, hit_object)
			

			self.draw_hit_in_region(canvas_x, canvas_y, canvas_w, canvas_h,
										ctx, hit_object, session, block_len, offset, solidcolor);
			// todo: accept a len parameter
		}else if(block["type"]==="pattern"){
			// pattern
			let pattern_object;
			if(typeof block["pattern"] === "string"){
				// this is  a reference pointer to the pattern object in the session
				let pattern_id = block["pattern"]
				pattern_object = session["patterns"][pattern_id];
			}else if(block["pattern"] instanceof Object){
				// This is a real hit object
				console.error("Block patterns need to be pattern_id pointers, not full patterns", block);
			}

			//console.log("draw_pattern_in_region", block, pattern_object, ctx)
			self.draw_pattern_in_region(canvas_x, canvas_y, canvas_w, canvas_h,
											ctx, pattern_object, session, block_len, offset,
											depths_until_solidcolor_patterns,
											depths_until_solidcolor_hits);
			// todo: accept a len parameter
		}
	}


	// fills the whole canvas with the segment
	self.draw_hit = function(ctx, hit, session, solidcolor=false){
		let canvas_w = ctx.canvas.width;
		let canvas_h = ctx.canvas.height;
		let canvas_x = 0
		let canvas_y = 0
		self.draw_hit_in_region(canvas_x, canvas_y, canvas_w, canvas_h, ctx, hit, session, null, 0, solidcolor)
	}

	// Draw the hit in the region of the canvas
	// if block_len is null, it fills the whole space with the hit segment
	self.draw_hit_in_region = function(canvas_x, canvas_y, canvas_w, canvas_h,
		ctx, hit, session, block_len, offset, solidcolor=false){

		// Figure out which segment we are drawing
		let seg;
		let gaps = hit["gaps"];
		let chaos = hit["chaos"];
		let pool = hit["pool"];
		if(chaos){
			// chaos true: pick a random segment from the pool
			seg = self.fish_segment_from_pool(pool)
		}else{
			// chaos false: pick the saved segment
			seg = hit["seg"];
		}
		let song_id = seg[0];
		let segment_id = seg[1];
		// this is the segment we're going to draw
		let segment = self.analysis[song_id]["segments"][segment_id];

		//console.log("draw_hit_in_region", song_id, segment_id, segment, solidcolor)
		if(solidcolor){
			// Colid this region with a SOLID COLOR
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
			// DRAW the SPECTROGRAM
			// Black Background
			ctx.beginPath();
			ctx.rect(canvas_x, canvas_y, canvas_w, canvas_h);
			ctx.fillStyle = "black";
			ctx.fill();

			// Based only on global bpm for now
			// TODO: tempo multipliers
			let bpm = session["global_bpm"]; // beats/minute
			let block_duration;
			// block_len // beats
			//console.log(block_len, canvas_x, canvas_w)

			if(!block_len){
				// If this is a pad, or the hit generator, block_len is not yet set
				// In which case, set block_duration to the length of the segment 
				block_duration = segment.duration;
			}else{
				// else calculate the duration compared to the bpm 
				block_duration = block_len/bpm*60.0; // seconds
			}
			// offset // beats
			offset = isNaN(offset)?0:parseFloat(offset); // if offset>0, the beginning of the hit is cut
			offset = Math.max(offset, 0); // minimum 0
			let offset_duration = offset/bpm*60.0 // seconds

			// default start/duration behavior
			let seg_start = parseFloat(segment.start) // seconds
			let seg_duration = parseFloat(segment.duration); // seconds
			// Now some logic to correctly draw flows and gaps, based on BPM/blocklength
			if(gaps==="gaps"){
				// draw, start at segment start, plus the offset, until 1) end of segment, or 2) end of block
				if(offset_duration >= seg_duration){
					// the offset was so long the segment never had a chance to play
					return;
				}
				seg_start = segment.start + offset_duration;
				if(seg_duration - offset_duration < block_duration){
					// segment is shorter than the block
					// draw till the end of segment
					seg_duration = seg_duration - offset_duration;
					// Need to change canvas_w, shrink to range of segment
					canvas_w *= seg_duration/block_duration
				}else{
					//segment is longer or equal to the length of the block 
					// draw till the end of block
					seg_duration = block_duration;
				}
				//console.log(canvas_w, seg_start, seg_duration, segment.start, segment.duration, offset_duration, block_duration)

			}else if(gaps==="flows"){
				// draw, starting at segment start, plus the offset, for the length of the entire block
				seg_start = segment.start + offset_duration 
				seg_duration = block_duration;
			}
			//console.log("drawspec",offset, offset_duration, seg_start, seg_duration);

			self.draw_spectrum_in_region(canvas_x, canvas_y, canvas_w, canvas_h,
				ctx, song_id, seg_start, seg_duration);
		}
	}

	self.draw_spectrum_in_region = function(canvas_x, canvas_y, canvas_w, canvas_h,
		ctx, song_id, seg_start, seg_duration){

		//console.log("draw_spectrum_in_region", song_id, segment_id)
		// The height of the hires spectrogram
		let spectrogram_height = self.hires_spectrograms[song_id][0].height;
		// The hires spectrogram may have been split up into two or more JPGs
		// Because of a JPG limit in pixel width
		// Calculate the total width of all these hires spectrograms
		// And remember the crossover points
		let total_width = 0;
		let crossovers = [0]
		for(let i in self.hires_spectrograms[song_id]){
			total_width += self.hires_spectrograms[song_id][i].width;
			crossovers.push(total_width)
		}

		// Find the last segment in the song
		let lindx = self.analysis[song_id]["segments"].length - 1;
		let lseg = self.analysis[song_id]["segments"][lindx];
		// Now calculate the total length of the song
		let song_duration_secs = lseg["start"]+lseg["duration"];
		// song_duration_secs = self.analysis[song_id].duration // may also be available

		let ratio_s = total_width / song_duration_secs; // turn seconds into hires_specotrogram pixel widths
		let ratio_c = canvas_w / seg_duration; // turn seconds into canvas pixel widths
		let ssp = seg_start * ratio_s; // start pixel on hires_spectrogram

		let swp = seg_duration * ratio_s; // width in pixels of segment on hires_spectrgram

		let sx =  ssp;
		let sy = 0;
		let sWidth = swp;
		let sHeight = spectrogram_height

		let dx = canvas_x
		let dy = canvas_y
		let dWidth = seg_duration * ratio_c;
		let dHeight = canvas_h

		if(self.hires_spectrograms[song_id].length === 1){
			// The hires_spectogram has not been split. We can easily copy the segment from the one image.
			let img = self.hires_spectrograms[song_id][0];
			ctx.drawImage(img, sx, sy, sWidth, sHeight, dx, dy, dWidth, dHeight);
			//console.log("DD", img, sx, sy, sWidth, sHeight, dx, dy, dWidth, dHeight)
		}else{
			// there are multiple hires spectrograms
			// find which hires image has the start of the segment
			let i, j;
			for(i in crossovers){
				if(crossovers[i] >= ssp){
					break;
				}
			}
			i -= 1;

			// find which hires spectrogram image has the end of the segment
			for(j in crossovers){
				if(crossovers[j] > ssp + swp){
					break;
				}
			}
			j -= 1;


			if(i===j){
				// segment is contained in the same spectrograms
				sx = ssp - crossovers[i];
				let img = self.hires_spectrograms[song_id][i];
				ctx.drawImage(img, sx, sy, sWidth, sHeight, dx, dy, dWidth, dHeight);
				//console.log("CC", img, sx, sy, sWidth, sHeight, dx, dy, dWidth, dHeight)

			}else{
				// segment crosses over two spectrograms
				sx = ssp - crossovers[i];
				let img_start = self.hires_spectrograms[song_id][i];
				sWidth = img_start.width;
				ctx.drawImage(img_start, sx, sy, sWidth, sHeight, dx, dy, dWidth, dHeight);

				//console.log("BB", img_start, sx, sy, sWidth, sHeight, dx, dy, dWidth, dHeight)

				sWidth = (ssp + swp) - crossovers[j]
				let img_end = self.hires_spectrograms[song_id][j];
				sx = 0;
				ctx.drawImage(img_end,   sx, sy, sWidth, sHeight, dx, dy, dWidth, dHeight);
				//console.log("AA", img_end, sx, sy, sWidth, sHeight, dx, dy, dWidth, dHeight)
				// one segment should never be longer than the length of a hires_spectrogram (~8 minutes),
				// so we provide no support for segments which need three spectrograms to render
			}
		}

	}


/*
	// draws the pattern in the xywh region of the canvas
	self.draw_pattern_in_region = function(canvas_x, canvas_y, canvas_w, canvas_h,
		ctx, pattern, session, block_len, offset, solidcolor=false){

		let seg, step, analysis_id, segment_id, segment, song_id;
		let sx, sy, sWidth, sHeight, dx, dy, dWidth, dHeight;
		let pattern_length, pattern_length_secs, duration;
		let chaos, pool, gain, pos, layer, gaps, len;
		let img, img_start, img_end;
		let secs_per_beat = self.calculate_secs_per_beat(pattern, session);

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



			duration = segment["duration"]; //default
			if(len==="full"){
				// play until duration
				duration = segment["duration"];

			}else{
				len = parseFloat(len);
				if(gaps==="gaps"){
					if(len*secs_per_beat < segment["duration"]){
						duration = len*secs_per_beat;
					}else{
						duration = segment["duration"];
					}
				}else if(gaps==="flows"){
					duration = len*secs_per_beat;
				}else if(gaps==="stretch"){
					// incompete
				}
			}

			// Compute the length of the PATTERN
			if(pattern["type"] === "hit"){
				if(pattern["len"]==="full"){
					// length is length of segment
					// todo: fix for multi-segment hits
					pattern_length_secs = duration
				}else{
					pattern_length_secs = parseFloat(pattern["len"]) * secs_per_beat;
				}
			}
			//console.log(pattern_length_secs, duration, pattern["len"], secs_per_beat)
			// start drawing




		}
	}*/

	// Draw the timbre spectrum
	// This is a song visualization where segments are sorted by rolloff
	self.draw_timbre_spectrum = function(ctx, song_id, 
		background_fill_color="#000000"){
		// Get the list of segments sorted by rolloff
		let timbre_spectrum_segment_list = self.get_segments_sorted_by_rolloff(song_id);
		// Canvas details
		let canvas_w = ctx.canvas.width;
		let canvas_h = ctx.canvas.height;
		let canvas_x = 0;
		let canvas_y = 0;
		// background
		ctx.beginPath();
		ctx.rect(canvas_x, canvas_y, canvas_w, canvas_h);
		ctx.fillStyle = background_fill_color;
		ctx.fill();
		// Get the total song duration
		let total_duration = self.analysis[song_id].duration
		// seg_x will be incremented, starting at 0 
		let seg_x = 0;
		// Loop through segment list, draw
		for(let s in timbre_spectrum_segment_list){
			let seg = timbre_spectrum_segment_list[s];
			let seg_w = seg.duration / total_duration * canvas_w;
			self.draw_spectrum_in_region(seg_x, 0, seg_w, canvas_h,
				ctx, song_id, seg.start, seg.duration);
			// increment seg_x
			seg_x += seg_w; 
		}
	}

}
