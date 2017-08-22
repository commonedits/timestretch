/*
 * STRETCHER-JS GLOBAL VARIABLES
 */
var GLOBAL_ACTIONS = {
        'play': function() {
            if (current_state !== state.playing && current_state !== state.init) {
                current_state = state.playing;
                filter = new soundtouch.SimpleFilter(wavesurfer.backend.source.buffer, st, 1323000);
                filter.sourcePosition = source_position;
                node = soundtouch.getWebAudioNode(wavesurfer.backend.ac, filter);
                wavesurfer.backend.setFilter(node);
                wavesurfer.play(current_time);
                console.log("playing");
                setAttributes($('#play_button')[0], {"style": "display:none"});
                setAttributes($('#pause_button')[0], {"style": "display:block"});
            }
        },
        'pause': function() {
            if (current_state === state.playing) {
                current_state = state.paused;
                //wavesurfer.backend.source.stop(0);
                current_time = wavesurfer.getCurrentTime();
                source_position = filter.sourcePosition;
                node.disconnect();
                wavesurfer.pause();
                console.log("pausing");
                setAttributes($('#pause_button')[0], {"style": "display:none"});
                setAttributes($('#play_button')[0], {"style": "display:block"});
            }
        },
        'stop': function(){
            if (current_state === state.playing) {
                current_state = state.stopped;
                //wavesurfer.backend.source.stop(0);
                node.disconnect();
                wavesurfer.stop();
                current_time = 0;
                setAttributes($('#pause_button')[0], {"style": "display:none"});
                setAttributes($('#play_button')[0], {"style": "display:block"});
                
            }
            if (current_state === state.paused) {
                current_state = state.stopped;
                wavesurfer.stop();
                current_time = 0;
            }
        }
    },
    state = {
        init: 0,
        ready: 1,
        playing: 2,
        paused: 3,
        stopped: 4
    },
    current_state = state.init,
    current_time = 0,
    current_progress = 0,
    source_position = 0,
    sample_rate = 44100,
    //bpm,
    context = new AudioContext(),
    warp = {
        down: {
            eighth: 0.875,
            quarter: 0.75,
            half: 0.5
        },
        up: {
            eighth: 1.125,
            quarter: 1.25,
            half: 1.50
        }
    },
    st, source, filter, node,
    /*
     * WAVESURFER-JS
     */
    wavesurfer = Object.create(WaveSurfer);
    wavesurfer.init({
        audioContext: context,
        container: '#wave',
        waveColor: '#BDCCD4',
        progressColor: '#3FA9F5',
        audioRate: 1,
        normalize: true,
        pixelRation: 1,
        interact: true,
        height: 60,
        hideScrollbar: true
    });
/*
 * EVENTS
 */
wavesurfer.on('audioprocess', function(t){
});
//waveform error reporting
wavesurfer.on('error', function(err) {
    console.error(err);
});
//waveform initial loading function
wavesurfer.on('loading', function(percent, request) {
    console.log(percent);
    console.log(request);
    if (percent >= 100) {
        document.getElementById("loading").innerHTML = "initializing...";
    } else {
        document.getElementById("loading").innerHTML = percent + "% loaded";
    }
});
wavesurfer.on('ready', function(){
        reInit();
        var timeline = Object.create(WaveSurfer.Timeline);
        timeline.init({
            wavesurfer: wavesurfer,
            container: "#wave-timeline"
        });
        wavesurfer.backend.source.loop = true;
        wavesurfer.backend.source.loopStart = 0;
        wavesurfer.backend.source.loopEnd = 1//wavesurfer.backend.buffer.duration
        st = new soundtouch.SoundTouch(sample_rate);
        
        //var buffer = soundtouch.WebAudioBufferSource(wavesurfer.backend.source.buffer)
        wavesurfer.backend.source.buffer.extract = function(target, numFrames, position) {
            var l = wavesurfer.backend.source.buffer.getChannelData(0),
                r = wavesurfer.backend.source.buffer.getChannelData(1);
            length = l.length;
            for (var i = 0; i < numFrames; i++) {
                target[i * 2] = l[i + position];
                target[i * 2 + 1] = r[i + position];
            }
            return Math.min(numFrames, l.length - position);
        };
        filter = new soundtouch.SimpleFilter(wavesurfer.backend.source.buffer, st);
        current_state = state.ready;
        console.log(wavesurfer.backend)
        node = soundtouch.getWebAudioNode(wavesurfer.backend.ac, filter);
        wavesurfer.backend.setFilter(node);
        document.getElementById("loading").innerHTML = "";
        wavesurfer.backend.filters[0].disconnect();
        //getBPM(wavesurfer.backend.source.buffer);
        setPitch(0);
        setTempo(1);
        enableControls();
});
//waveform end of track funciton
wavesurfer.on('finish', function() {
    console.log('Finished playing');
    GLOBAL_ACTIONS.stop();
});
//waveform time seek function
wavesurfer.on('seek', function(progress) {
    current_progress = progress;
    console.log('seeking to ' + Math.round(progress * 100) + "%");
    if(current_state == state.playing){
        GLOBAL_ACTIONS.pause();
    }
    source_position = Math.floor(progress*wavesurfer.backend.source.buffer.length);
    current_time = wavesurfer.getCurrentTime();
});
/*
 * SOUNDTOUCH-JS DATA SETTERS
 */
function setTempo(speed) {
    console.log("setting speed to " + speed);
    st.tempo = speed;
    wavesurfer.setPlaybackRate(speed);
    //document.getElementById("tempo_value").innerHTML = parseInt(speed*bpm)+" BPM";
    document.getElementById("tempo_value").innerHTML = parseInt(speed*100)+"% speed";
}

function setPitch(semitones) {
    //calculate factor to multiply frequency by
    var frequency_factor = Math.pow(2, (semitones / 12));
    console.log("setting pitch to " + frequency_factor + "% (" + semitones + " halfsteps)");
    st.pitch = frequency_factor;
        if (semitones > 0){
        document.getElementById("pitch_value").innerHTML = "+"+semitones+" half steps";
    } else if (semitones < 0){
        document.getElementById("pitch_value").innerHTML = semitones+" half steps";
    } else {
        document.getElementById("pitch_value").innerHTML = "original pitch"
    }
}

/*
 * AUDIO TRANSPORT BUTTONS
 */
function pressButton(action){
    if (action) GLOBAL_ACTIONS[action]();
}

/*
 * jQuery-mobile-SLIDERS
 */
//function to set a batch of attributes for an HTML element and object pair
var setAttributes = function(element, attributes) {
    for (attribute in attributes) {
        element.setAttribute(attribute, attributes[attribute]);
    }
    return element;
};
//Enable tempo slider, pitch slider, play/pause button
function enableControls(){
    // reset a tempo slider
    setAttributes($("#play_button")[0],{"style": "display:block"});
    setAttributes($("#stop_button")[0],{"style": "display:block"});
}
function reInit(){
    current_state = state.init;
    current_time = 0;
    current_progress = 0;
    source_position = 0;
    st = undefined;
    filter = undefined;
    node = undefined;
}
function resetSliders(){
    $('#tempo_slider')[0].value = 1.0;
    $('#pitch_slider')[0].value = 0;
    setTempo(1.0);
    setPitch(0);
}
function disableControls(){
    //close tune browser popup windows
    $( "#tune_list" ).popup( "close" );
    // disable tempo slider
    $('#tempo_slider').slider({ disabled: true});
    $('#pitch_slider').slider({ disabled: true});
    // reset values
    $('#tempo_slider').val(1).slider("refresh");
    $('#pitch_slider').val(0).slider("refresh");
    setAttributes($("#pause_button")[0],{"style": "display:none"});
    setAttributes($("#play_button")[0],{"style": "display:none"});
    setAttributes($("#stop_button")[0],{"style": "display:none"});
}
//Browse
function loadAudioFromServer(file_path){
    file_path = defaultFor(file_path, "");
    if(file_path !== ""){
        disableControls();
        wavesurfer.load(file_path);
    } else {
        console.warn("Add a valid file path!");
    }
}
function loadAudioBlob(){
}
// Drag'n'drop
function addDrag(){
    document.addEventListener('DOMContentLoaded', function () {
        var toggleActive = function (e, toggle) {
            e.stopPropagation();
            e.preventDefault();
            toggle ? e.target.classList.add('wavesurfer-dragover') :
                e.target.classList.remove('wavesurfer-dragover');
        };

        var handlers = {
            // Drop event
            drop: function (e) {
                toggleActive(e, false);
                $( "#lightbox" ).popup( "close" );
                if(current_state === state.playing){
                    GLOBAL_ACTIONS.stop();
                }
                disableControls();
                // Load the file into wavesurfer
                if (e.dataTransfer.files.length) {
                    wavesurfer.loadBlob(e.dataTransfer.files[0]);
                } else {
                    wavesurfer.fireEvent('error', 'Not a file');
                }
            },

            // Drag-over event
            dragover: function (e) {
                toggleActive(e, true);
            },

            // Drag-leave event
            dragleave: function (e) {
                toggleActive(e, false);
            }
        };

        var dropTarget = document.querySelector('#drop');
        Object.keys(handlers).forEach(function (event) {
            dropTarget.addEventListener(event, handlers[event]);
        });
    });
}

function init(embed) {
    var request = location.search.slice(1);
    var f_name = './audio/crazy.mp3';
    if (embed){
        if (request !== ''){
            f_name = '/content/NotationMixer/data/'+request+'/0.mp3';
        }
    } else {
        f_name = './audio/'+request+'.mp3';
        addDrag();
    }
    console.log(f_name);
    wavesurfer.load(f_name);
}