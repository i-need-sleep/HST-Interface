// Initialise MIDI visualizer //////////////////////////////////////////////////////////////////////////////////
const vis = document.getElementById('vis');
const vis_out = document.getElementById('vis_out');

const cfg = {
    noteHeight: 4,
    pixelsPerTimeStep: 100,
    minPitch: 30
  };

vis.config = cfg;
if (vis_out){
    vis_out.config = cfg;
}

// Handle chord input ///////////////////////////////////////////////////////////////////////////////////////////
var root
var chroma = []
var bass
var prev_root

const add_chd = document.getElementById('add_chd');
const rep_chd = document.getElementById('rep_chd');

const chd_in_display = document.getElementById('chd_in_display');
const chd_in_send = document.getElementById('chd_in_send');

var prev = 0;
var chd_in = {'chd': []};

add_chd.onclick = add_chd_go;
rep_chd.onclick = rep_chd_go;

function add_chd_go(){
    prev_root = [0,1,1,2,2,3,4,4,5,5,6,6,7][root];
    let root_in = root;
    let chroma_in = chroma;
    let bass_in = bass;
    prev = [root_in, chroma_in, bass_in];
    chd_in['chd'].push(prev);
    chd_in_display.innerHTML = JSON.stringify(chd_in);
    chd_in_send.value = JSON.stringify(chd_in);
    clear_all();
    console.log(chd_in);
    search_chd();
    return;
}

function rep_chd_go(){
    if (prev != 0){
        chd_in['chd'].push(prev);
        chd_in_display.innerHTML = JSON.stringify(chd_in);
        chd_in_send.value = JSON.stringify(chd_in);
        clear_all();
        console.log(chd_in);
    }
    return;
}

const roots = document.getElementsByClassName("root");
for (let i=0; i<roots.length; i++){
    roots[i].onclick = function(){
        if (!roots[i].classList.contains("root_previous")){
            clear_root();
            root = roots[i].id.slice(1,3);
            roots[i].classList.add("root_selected");
        }
    };}

const basses = document.getElementsByClassName("bass");
for (let i=0; i<basses.length; i++){
    basses[i].onclick = function(){
        bass = basses[i].id;
        clear_bass();
        basses[i].classList.add("bass_selected")
    };}

const chromas = document.getElementsByClassName("chroma");
for (let i=0; i<chromas.length-1; i++){
    chromas[i].onclick = function(){
        if (!chroma.includes(chromas[i].id)){
            chroma.push(chromas[i].id);
            chromas[i].classList.add("chroma_selected");
        }
        else{
            chroma.pop(chromas[i].id);
            chromas[i].classList.remove("chroma_selected");
        }
    };}


function clear_root(){
    for (let j=0; j<roots.length; j++){
        roots[j].classList.remove("root_selected")
        roots[j].classList.remove("root_previous")
        if (prev_root>=0){
            roots[prev_root].classList.add("root_previous")
        }
    }
}
function clear_bass(){
    for (let j=0; j<basses.length; j++){
        basses[j].classList.remove("bass_selected")
    }
}
function clear_chroma(){
    for (let j=0; j<chromas.length; j++){
        chromas[j].classList.remove("chroma_selected")
    }
}
function clear_all(){
    clear_root();
    clear_bass();
    clear_chroma();
    chroma = ["0"];
    chromas[11].classList.add("chroma_selected")
    bass = basses[11].id;
    basses[11].classList.add("bass_selected")
}
function clear_chroma_bass(){
    clear_chroma();
    clear_bass();
    chroma = ["0"];
    chromas[11].classList.add("chroma_selected")
    bass = basses[11].id;
    basses[11].classList.add("bass_selected")
}
function clear_connections(){
    $('.connection').connections('remove');
    for (let j=0; j<roots.length; j++){
        $(roots[j]).attr("data-original-title", "");
    }
}
function clear_progression(){
    prev_root = -1;
    chd_in = {'chd': []};
    prog = [];
    clear_connections();
    clear_root();
}
clear_all();

function add_chroma(i_lst){
    for (let j=0; j<i_lst.length; j++){
        let i=11-i_lst[j];
        if (!chroma.includes(chromas[i].id)){
            chroma.push(chromas[i].id);
            chromas[i].classList.add("chroma_selected");
        }
    }
}

document.getElementById("m3").onclick = function(){
    clear_chroma_bass();
    add_chroma([3,7]);
}
document.getElementById("M3").onclick = function(){
    clear_chroma_bass();
    add_chroma([4,7]);
}
document.getElementById("clear_chd").onclick = function(){
    clear_all();
}
document.getElementById("clear_prog").onclick = function(){
    clear_progression();
    chd_in_display.innerHTML = JSON.stringify(chd_in);
    chd_in_send.value = JSON.stringify(chd_in);
}

// Hooktheory API /////////////////////////////////////////////////////////////////////////////////////////////
// const hooktheoryOath = "https://api.hooktheory.com/v1/users/auth";

// console.log("testing api");
// axios.post(hooktheoryOath, {"username": "I_NEED_21EEP","password": "29w55aNUsQxQjjf"})
//   .then(response => {
//           const data = response.data;
//           var key = data["activkey"];
//           console.log("key", key);
//   });

const key = "cfece1b67625dffe720a2af5ddd8bd63";
const chord_prog_entry = "https://api.hooktheory.com/v1/trends/nodes"
const config = {
    headers: {
        Authorization: 'Bearer '+key,
        Accept: "application/json",
        "Content-Type": "application/json"
    }
  }
  
// var cp = "4,5";

// axios.get(chord_prog_entry+"?cp="+cp, config)
//   .then(response => {
//           const data = response.data;
//           console.log("data", data);
//   });

// UI Connection /////////////////////////////////////////////////////////////////////////////////////////////

var prog = [];

function search_chd(){
    let start = prev_root + 1;
    prog.push(start);
    let prog_str = prog.join(",");
    clear_connections();
    axios.get(chord_prog_entry+"?cp="+prog_str, config)
        .then(response => {
                const data = response.data;
                for (let i=0; i<3; i++){
                    let next = data[i]["chord_ID"];
                    let prob = data[i]["probability"]
                    if (next.length==1){
                        $().connections({ from: '.r'+start, to: '.r'+next });
                        $(".r"+next).attr("data-original-title", prob);
                    }
                }
        });
}