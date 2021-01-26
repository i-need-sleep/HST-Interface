// Initialize MIDI visualizer //////////////////////////////////////////////////////////////////////////////////
const vis = document.getElementById('vis');
const vis_out = document.getElementById('vis_out');

const cfg = {
    noteHeight: 4,
    pixelsPerTimeStep: 100,
    minPitch: 30,
    maxPitch: 90,
    noteSpacing: 1
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

if (document.getElementById("chd_back").innerHTML){
    chd_in = JSON.parse(document.getElementById("chd_back").innerHTML)
}

add_chd.onclick = add_chd_go;
rep_chd.onclick = rep_chd_go;


function add_chd_go(){
    if (chd_in["chd"].length<8){
        prev_root = [0,1,1,2,2,3,4,4,5,5,6,6,7][current_root];
        let root_in = current_root;
        let chroma_in = [0];
        let bass_in = "0";
    
        chroma_in.push([3,4,2,5,4,3][inner_selected].toString());
        chroma_in.push([6,8,7,7,7,7][inner_selected].toString());
        let outer_lst = [2,3,5,6,9,10,11,1];
        if (inner_selected == 5){
            outer_lst[1] = 4
        }
        if (outer_selected){
            chroma_in.push(outer_lst[outer_selected].toString());
        }
        
        if (JSON.stringify(prev) == JSON.stringify([root_in, chroma_in, bass_in])){
            rep_chd_go();
            return;
        }
        console.log(prev)
        console.log([root_in, chroma_in, bass_in])
        prev = [root_in, chroma_in, bass_in];
        chd_in['chd'].push(prev);
        chd_in_display.innerHTML = JSON.stringify(chd_in);
        chd_in_send.value = JSON.stringify(chd_in);
        clear_all();
        console.log(chd_in);
        search_chd();
    
        document.getElementById("new_"+chd_in['chd'].length).innerHTML = current_chord;
    
        for (let i=0; i<nodes_entered.length; i++){
            let node = nodes_entered[i];
            node.y += 100;
            node.x = Math.random()*150-75;
        }
        nodes_entered.push(new node_entered(0,200,current_chord));
    
        document.getElementById("new_"+chd_in['chd'].length).classList.remove("chord_input");
        document.getElementById("new_"+(chd_in['chd'].length+1)).classList.add("chord_input");

    }
}

function rep_chd_go(){
    if (prev != 0 && chd_in["chd"].length<8){
        chd_in['chd'].push(prev);
        chd_in_display.innerHTML = JSON.stringify(chd_in);
        chd_in_send.value = JSON.stringify(chd_in);
        clear_all();
        console.log(chd_in);

        for (let i=0; i<nodes_entered.length; i++){
            let node = nodes_entered[i];
            node.y += 100;
            node.x = Math.random()*150-75;
        }
        nodes_entered.push(new node_entered(0,200,""));

        document.getElementById("new_"+chd_in['chd'].length).classList.remove("chord_input");
        document.getElementById("new_"+(chd_in['chd'].length+1)).classList.add("chord_input");
    }
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
    // chromas[11].classList.add("chroma_selected")
    // bass = basses[11].id;
    // basses[11].classList.add("bass_selected")
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
    prev = 0;
    clear_connections();
    clear_root();
    for (let i=1; i<9; i++){
        document.getElementById("new_"+i).innerHTML = "&nbsp";
        document.getElementById("new_"+i).classList.remove("chord_input");
    }
    document.getElementById("new_1").classList.add("chord_input");
}

// clear_all();

function add_chroma(i_lst){
    for (let j=0; j<i_lst.length; j++){
        let i=11-i_lst[j];
        if (!chroma.includes(chromas[i].id)){
            chroma.push(chromas[i].id);
            chromas[i].classList.add("chroma_selected");
        }
    }
}

// document.getElementById("m3").onclick = function(){
//     clear_chroma_bass();
//     add_chroma([3,7]);
// }
// document.getElementById("M3").onclick = function(){
//     clear_chroma_bass();
//     add_chroma([4,7]);
// }
// document.getElementById("clear_chd").onclick = function(){
//     clear_all();
// }
document.getElementById("clear_prog").onclick = function(){
    clear_progression();
    nodes_new = [];
    nodes_entered = [];
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
                // for (let i=0; i<3; i++){
                //     let next = data[i]["chord_ID"];
                //     let prob = data[i]["probability"]
                //     if (next.length==1){
                //         $().connections({ from: '.r'+start, to: '.r'+next });
                //         $(".r"+next).attr("data-original-title", prob);
                //     }
                // }
                let i = 0;
                nodes_new = [];
                while (data[i]["probability"] >= 0.05){
                    nodes_new.push(new node_new(-200,-200, pitches[tonic_pitches[parseInt(data[i]["chord_ID"])-1]], (data[i]["probability"].toFixed(2)*100).toFixed(0)+"%"));
                    i ++;
                }
                for (let i=0; i<nodes_new.length; i++){
                    let a = 0.6 * Math.PI / (nodes_new.length-1) * i - 0.8 * Math.PI;
                    nodes_new[i].x = 300*Math.cos(a);
                    nodes_new[i].y = 300*Math.sin(a);
                }
        });
}

// Access the server for lazy-loading the chord progression probabilities
const prog_url = document.getElementById("get_prog_prob").innerHTML;
axios.get(prog_url)
        .then(response => {
                const data = response.data;
                console.log(data);
        });

// P5-based UI //////////////////////////////////////////////////////////////////////////////////////////////
const canvas_width = 750;
const canvas_height = window.innerHeight*1.25;

const center_x = canvas_width/2;
const center_y = canvas_height/2*0.6;
const ring_width = 100;

const inner_arcs = [0,0.25,0.5,0.75,1,1.5,2]
const outer_arcs = [0,0.25,0.5,0.75,1,1.25,1.5,1.75,2]

const font_size_chord = 25;
const font_size = 20;
const inner_delta_theta = 0.05;
const outer_delta_theta = 0.03;

const pitches = ['C','C#','D','D#','E','F','F#','G','G#','A','A#','B'];
var tonic_pitches = [0,2,4,5,7,9,11];
var inner_text = ["dim", "aug", "sus2", "sus4", "Maj", "min"];
var outer_text = ["9", "#9", "11", "#11", "6", "7", "maj7", "b9"];

var inner_selected;
var outer_selected;

const DIAL_INNER = 0;
const DIAL_FULL = 1;

var state = DIAL_INNER;
var root_select = false;

var current_root = 0;
var current_chord = pitches[current_root];

var inner_mask;
var outer_mask;
get_masks();

var dragged;
var dx;
var dy;

function setup() {
    let canvas = createCanvas(canvas_width, canvas_height);
    canvas.parent("interface");
}

function draw() {
    background(230);

    translate(center_x, center_y)
    draw_nodes_new();
    draw_nodes_entered();

    if (state == DIAL_INNER || state == DIAL_FULL){
        chord_dial_draw_rings();
        chrod_dial_fill_text();
    }

    translate(-center_x, -center_y)

    if (root_select){
        draw_root();   
    }
}

function mousePressed(){
    if (state == DIAL_INNER || state == DIAL_FULL){
        let mouse_dist = dist(mouseX, mouseY, center_x, center_y);
        let mouse_angle = acos((mouseX-center_x)/mouse_dist);

        if (mouseY-center_y < 0){
            mouse_angle = 2*PI - mouse_angle;
        }

        if (state == DIAL_FULL){
            for (let i=0; i<outer_arcs.length-1; i++){
                if (mouse_dist>ring_width && mouse_dist<1.5*ring_width && mouse_angle/PI>outer_arcs[i] && mouse_angle/PI<outer_arcs[i+1]){
                    if (outer_selected != i){
                        outer_selected = i;
                    }
                    else{
                        outer_selected = NaN;
                    }
                    get_chord_symbol();
                }
            }
        }
        for (let i=0; i<inner_arcs.length-1; i++){
            if (mouse_dist>0.5*ring_width && mouse_dist<1*ring_width && mouse_angle/PI>inner_arcs[i] && mouse_angle/PI<inner_arcs[i+1]){
                inner_selected = i;
                state = DIAL_FULL;
                get_masks();
                get_chord_symbol();
            }
        }
        if (mouse_dist < 0.5*ring_width){
            root_select = !root_select;
        }
    }
    if (root_select){
        for (let i=0; i<pitches.length; i++){
            if (mouseX>root_offset_x && mouseX<root_offset_x+root_width && Math.floor((mouseY-root_offset_y)/root_height) == i){
                current_root = i;
                get_chord_symbol();
                get_masks();
            }
        }
    }
    for (let i=0; i<nodes_new.length; i++){
        let node = nodes_new[i]
        if (dist(mouseX-center_x, mouseY-center_y, node.x, node.y) < nodes_new_size/2){
            current_root = pitches.indexOf(node.chd);
            get_chord_symbol();
            get_masks();
        }
    }
    for (let i=0; i<nodes_entered.length; i++){
        let node = nodes_entered[i]
        if (dist(mouseX-center_x, mouseY-center_y, node.x, node.y) < nodes_entered_size/2){
            dragged = i;
            let cell = nodes_entered[dragged];
            dx = mouseX - cell.x;
            dy = mouseY - cell.y;
        }
    }
}

function mouseReleased() {
    dragged = undefined;
  }


function mouseDragged() {
    if (dragged >= 0){
        let cell = nodes_entered[dragged];
        cell.x = mouseX - dx;
        cell.y = mouseY - dy;
    }
  }

  
// Force-Directed Graph
var nodes_new = [];
var nodes_entered = [];

const nodes_new_size = 100;
const nodes_entered_size = 80;
const nodes_repeat_size = 50;

const tooltip_y_offset = 20;
const tooltip_size_x = 48;
const tooltip_size_y = 35;

function node_new(x,y,chd,prob){
    this.x = x;
    this.y = y;
    this.chd = chd;
    this.prob = prob;
}

function node_entered(x,y,chd){
    this.x = x;
    this.y = y;
    this.chd = chd;
}

function draw_nodes_new(){
    const node_new_hover = color(116,203,255);
    const node_new_normal = color(255,255,255);

    for (let i=0; i<nodes_new.length; i++){
        let node = nodes_new[i];
        fill(node_new_normal);
        if (dist(mouseX-center_x, mouseY-center_y, node.x, node.y) < nodes_new_size/2){
            fill(node_new_hover);
        }
        line(node.x, node.y, 0, 0);
        ellipse(node.x, node.y, nodes_new_size, nodes_new_size);
        fill(0,0,0);
        textAlign(CENTER, CENTER);
        textSize(font_size_chord);
        text(node.chd, node.x, node.y);
    }
    tooltip_new()
}

function tooltip_new(){
    for (let i=0; i<nodes_new.length; i++){
        let node = nodes_new[i];
        if (dist(mouseX-center_x, mouseY-center_y, node.x, node.y) < nodes_new_size/2){
            fill(255,255,255);
            rect(mouseX-center_x-tooltip_size_x/2, mouseY-center_y-tooltip_y_offset-tooltip_size_y/2, tooltip_size_x, tooltip_size_y);
            fill(0,0,0);
            textAlign(CENTER, CENTER);
            textSize(font_size);
            text(node.prob, mouseX-center_x, mouseY-center_y-tooltip_y_offset);
        }
    }
}

function draw_nodes_entered(){
    const node_entered_normal = color(255,255,255);

    for (let i=0; i<nodes_entered.length; i++){
        let node = nodes_entered[i];

        if (i==nodes_entered.length-1){
            line(node.x, node.y,0,0)
        }

        if (i+1 < nodes_entered.length){
            line(node.x, node.y, nodes_entered[i+1].x, nodes_entered[i+1].y)
        }

        fill(node_entered_normal);
        if (node.chd == ""){
            ellipse(node.x, node.y, nodes_repeat_size, nodes_repeat_size);
        }
        else{
            ellipse(node.x, node.y, nodes_entered_size, nodes_entered_size);
        }
        fill(0,0,0);
        textAlign(CENTER, CENTER);
        textSize(font_size_chord);
        text(node.chd, node.x, node.y);
    }
}

// UI Helpers
function chord_dial_draw_rings(){
    const dial_hover = color(116,203,255);
    const dial_select = color(24,169,255);
    const dial_unavailable = color(185,185,185)
    const dial_normal = color(255,255,255);

    let mouse_dist = dist(mouseX, mouseY, center_x, center_y);
    let mouse_angle = acos((mouseX-center_x)/mouse_dist);

    if (mouseY-center_y < 0){
        mouse_angle = 2*PI - mouse_angle;
    }

    if (state == DIAL_FULL){
        for (let i=0; i<outer_arcs.length-1; i++){
            if (mouse_dist>ring_width && mouse_dist<1.5*ring_width && mouse_angle/PI>outer_arcs[i] && mouse_angle/PI<outer_arcs[i+1]){
                fill(dial_hover);
            }
            else if (outer_selected == i){
                fill(dial_select);
            }
            else if (!outer_mask[i]){
                fill(dial_unavailable);
            }
            else{
                fill(dial_normal);
            }
            arc(0, 0, 3*ring_width, 3*ring_width, outer_arcs[i]*PI, outer_arcs[i+1]*PI, PIE)
        }
    }
    
    for (let i=0; i<inner_arcs.length-1; i++){
        if (mouse_dist>0.5*ring_width && mouse_dist<1*ring_width && mouse_angle/PI>inner_arcs[i] && mouse_angle/PI<inner_arcs[i+1]){
            fill(dial_hover);
        }
        else if (inner_selected == i){
            fill(dial_select);
        }
        else if (!inner_mask[i]){
            fill(dial_unavailable);
        }
        else{
            fill(dial_normal);
        }
        arc(0, 0, 2*ring_width, 2*ring_width, inner_arcs[i]*PI, inner_arcs[i+1]*PI, PIE)
    }
    if (mouse_dist<0.5*ring_width){
        fill(dial_hover);
    }
    else if ((inner_selected && !inner_mask[inner_selected]) || (outer_selected && !outer_mask[outer_selected])){
        fill(dial_unavailable);
    }
    else{
        fill(dial_normal);
    }
    ellipse(0, 0, ring_width, ring_width);
}

function chrod_dial_fill_text(){
    fill(0,0,0)
    textAlign(CENTER, CENTER);
    textSize(font_size_chord);
    text(current_chord, 0, 0);
    
    textAlign(CENTER, CENTER)
    textSize(font_size);

    for (let i=0; i<inner_text.length; i++){
        let current_text = inner_text[i]
        let anchor = (inner_arcs[i] + inner_arcs[i+1]) / 2;
        if (anchor < 1){
            var theta = anchor + inner_delta_theta * (current_text.length-1) / 2;
        }
        else{
            var theta = anchor - inner_delta_theta * (current_text.length-1) / 2;
        }
        for (let j=0; j<current_text.length; j++){
            if (anchor < 1){
                rotate((theta - 0.5 - inner_delta_theta*j)*PI);
                text(current_text[j], 0, 0.75*ring_width);
                rotate(-1*(theta - 0.5 - inner_delta_theta*j)*PI);
            }
            else{
                if (i==4 && j==0){
                    rotate((theta + 0.5 + inner_delta_theta*j -0.01)*PI);
                    text(current_text[j], 0, -0.75*ring_width);
                    rotate(-1*(theta + 0.5 + inner_delta_theta*j -0.01)*PI);
                }
                else{
                    rotate((theta + 0.5 + inner_delta_theta*j)*PI);
                    text(current_text[j], 0, -0.75*ring_width);
                    rotate(-1*(theta + 0.5 + inner_delta_theta*j)*PI);
                }
            }
        }
    }
    if (state == DIAL_FULL){
        for (let i=0; i<outer_text.length; i++){
            let current_text = outer_text[i]
            let anchor = (outer_arcs[i] + outer_arcs[i+1]) / 2;
            if (anchor < 1){
                var theta = anchor + outer_delta_theta * (current_text.length-1) / 2;
            }
            else{
                var theta = anchor - outer_delta_theta * (current_text.length-1) / 2;
            }
            for (let j=0; j<current_text.length; j++){
                if (anchor < 1){
                    rotate((theta - 0.5 - outer_delta_theta*j)*PI);
                    text(current_text[j], 0, 1.25*ring_width);
                    rotate(-1*(theta - 0.5 - outer_delta_theta*j)*PI);
                }
                else{
                    if (i==6 && j==0){
                        rotate((theta + 0.5 + outer_delta_theta*j -0.01)*PI);
                        text(current_text[j], 0, -1.25*ring_width);
                        rotate(-1*(theta + 0.5 + outer_delta_theta*j -0.01)*PI);
                    }
                    else{
                        rotate((theta + 0.5 + outer_delta_theta*j)*PI);
                        text(current_text[j], 0, -1.25*ring_width);
                        rotate(-1*(theta + 0.5 + outer_delta_theta*j)*PI);
                    }
                }
            }
        } 
    }
}

function get_masks(){
    inner_mask = get_inner_mask();
    outer_mask = get_outer_mask();
    if (inner_selected == 5){
        outer_text[1] = "b11";
        if (tonic_pitches.indexOf(current_root) != -1){
            outer_mask[1] = tonic_pitches.includes((current_root+4)%12);
        }
    }
    else{
        outer_text[1] = "#9";
    }
}

function get_inner_mask(){
    let degree = tonic_pitches.indexOf(current_root);
    if (degree == -1){
        return [false,false,false,false,false]
    }
    return [tonic_pitches.includes((current_root + 3)%12) && tonic_pitches.includes((current_root + 6)%12),
        tonic_pitches.includes((current_root + 4)%12) && tonic_pitches.includes((current_root + 8)%12),
        tonic_pitches.includes((current_root + 2)%12), tonic_pitches.includes((current_root + 5)%12),
        tonic_pitches.includes((current_root + 4)%12), tonic_pitches.includes((current_root + 3)%12)]
}

function get_outer_mask(){
    let degree = tonic_pitches.indexOf(current_root);
    if (degree == -1){
        return [false,false,false,false,false,false,false,false]
    }
    return [tonic_pitches.includes((current_root + 2)%12), tonic_pitches.includes((current_root + 3)%12),
        tonic_pitches.includes((current_root + 5)%12), tonic_pitches.includes((current_root + 6)%12),
        tonic_pitches.includes((current_root + 9)%12), tonic_pitches.includes((current_root + 10)%12),
        tonic_pitches.includes((current_root + 11)%12), tonic_pitches.includes((current_root + 1)%12)]
}

function get_chord_symbol(){
    let chd_type = "";
    let chd_interval = "";
    if (inner_selected >= 0){
        chd_type = inner_text[inner_selected];
    }
    if (outer_selected >= 0){
        chd_interval = outer_text[outer_selected];
    }
    if (inner_selected == 5){
        chd_type = "m";
    }
    else if (inner_selected == 4){
        chd_type = "";
    }
    current_chord = pitches[current_root]+chd_type+chd_interval;
}

// Root Menu
const root_offset_x = 20;
const root_offset_y = 20;
const root_width = 120;
const root_height = 35;

function draw_root(){
    const root_hover = color(116,203,255);
    const root_select_color = color(24,169,255);
    const root_unavailable = color(185,185,185);

    let x = 0;
    let y = 0;

    for (let i=0; i<pitches.length; i++){
        if (mouseX>root_offset_x && mouseX<root_offset_x+root_width && Math.floor((mouseY-root_offset_y)/root_height) == i){
            fill(root_hover);
        }
        else if (current_root == i){
            fill(root_select_color);
        }
        else if (! tonic_pitches.includes(i)){
            fill(root_unavailable);
        }
        else{
            fill(255,255,255);
        }
        rect(root_offset_x+x,root_offset_y+y,root_width,root_height);
        fill(0,0,0);
        text(pitches[i],root_offset_x+x+root_width/2,root_offset_y+y+root_height/2);
        y += root_height;
    }
}

// Chord Playback //////////////////////////////////////////////////////////////////////////////////////////////////////////
const chd_playback_time = 1;
const octave_center = 48;

chd_player = new mm.SoundFontPlayer('https://storage.googleapis.com/magentadata/js/soundfonts/sgm_plus');

document.getElementById("play_chd").onclick = function(){
    chd_player.start(get_chord_seq());
}

function get_chord_seq(){
    let root_in = current_root;
    let chroma_in = [0];
    let bass_in = 0;
    let notes_in = [];

    chroma_in.push([3,4,2,5,4,3][inner_selected]);
    chroma_in.push([6,8,7,7,7,7][inner_selected]);
    let outer_lst = [2,3,5,6,9,10,11,1];
    if (inner_selected == 5){
        outer_lst[1] = 4;
    }
    if (outer_selected){
        chroma_in.push(outer_lst[outer_selected]);
    }

    for (let i=0; i<chroma_in.length; i++){
        notes_in.push({pitch: chroma_in[i]+root_in+octave_center, startTime: 0.0, endTime: chd_playback_time});
    }
    notes_in.push({pitch: bass_in+root_in+octave_center-12, startTime: 0.0, endTime: chd_playback_time});
    
    let seq = {notes: notes_in,
      totalTime: chd_playback_time
    };
    return seq;
}

// Chord Progression Playback (Inputed)
const prog_step_duration = 0.5;

prog_player = new mm.SoundFontPlayer('https://storage.googleapis.com/magentadata/js/soundfonts/sgm_plus');

document.getElementById("play_prog").onclick = function(){
    prog_player.start(get_prog(chd_in["chd"]));
}
function get_prog(chords){
    let prog_notes = [];

    if (chords.length > 0){
        let cur_chord = chords[0];
        let cur_dur = prog_step_duration;
        
        for (let i=1; i<chords.length; i++){
            if (JSON.stringify(chords[i])==JSON.stringify(cur_chord)){
                cur_dur += prog_step_duration;
            }
            else {
                let root = parseInt(cur_chord[0]);
                let chroma = cur_chord[1];
                let bass = parseInt(cur_chord[2]);
                for (let j=0; j<chroma.length; j++){
                    prog_notes.push({pitch: parseInt(chroma[j])+root+octave_center, startTime: prog_step_duration*i-cur_dur, endTime: prog_step_duration*i});
                }
                prog_notes.push({pitch:bass+root+octave_center-12, startTime: prog_step_duration*i-cur_dur, endTime: prog_step_duration*i});
                cur_chord = chords[i];
                cur_dur = prog_step_duration;
            }
        }
        let root = parseInt(cur_chord[0]);
        let chroma = cur_chord[1];
        let bass = parseInt(cur_chord[2]);
        for (let j=0; j<chroma.length; j++){
            prog_notes.push({pitch: parseInt(chroma[j])+root+octave_center, startTime: prog_step_duration*chords.length-cur_dur, endTime: prog_step_duration*chords.length});
        }
        prog_notes.push({pitch:bass+root+octave_center-12, startTime: prog_step_duration*chords.length-cur_dur, endTime: prog_step_duration*chords.length});
        
        return {notes: prog_notes, totalTime: prog_step_duration*chords.length};
    }
}

// Chord Progression Playback (Original)
prog_player_original = new mm.SoundFontPlayer('https://storage.googleapis.com/magentadata/js/soundfonts/sgm_plus');

document.getElementById("play_prog_original").onclick = function(){
    let chords = [];
    for (let i=0; i<original_chd.length; i++){
        let chd = original_chd[i];
        let root = chd.slice(0,12).indexOf(1);
        let bass = chd.slice(24,36).indexOf(1);
        let chroma = chd.slice(12,24);
        let chroma_out = [];
        for (let j=0; j<chroma.length; j++){
            if (chroma[j] == 1){
                chroma_out.push((j-root+12)%12)
            }
        }
        chords.push([root, chroma_out, bass])
    }
    console.log(chords)
    prog_player_original.start(get_prog(chords));
}

// On-Screen Keyboard ///////////////////////////////////////////////////////////////////////////////////////

// Sound and interaction with the user's keyboard
var keyboard = new AudioKeys();
const synth = new Tone.PolySynth(Tone.Synth).toDestination();
const now = Tone.now()

keyboard.down(function(note) {
    synth.triggerAttack(Tonal.Note.fromMidi(note.note), now);
  });

  keyboard.up(function(note) {
    synth.triggerRelease(Tonal.Note.fromMidi(note.note), now+0.2);
  });

// Chord pitch overlay ////////////////////////////////////////////////////////////////////////
const root_overlay_check = document.getElementById("root_overlay");
const chord_overlay_check = document.getElementById("chord_overlay");

var root_overlay = true;
var chord_overlay = false;

let original_svg = d3.select(".original_svg");
let swapped_svg = d3.select(".swapped_svg")

root_overlay_check.onclick = function(){
    if (root_overlay){
        root_overlay = false;
        if (! chord_overlay){
            clear_overlay();
        }
    }
    else{
        root_overlay = true;
        if (! chord_overlay){
            draw_root_overlay();
        }
    }
}

chord_overlay_check.onclick = function(){
    if (chord_overlay){
        chord_overlay = false;
        clear_overlay();
        if (root_overlay){
            draw_root_overlay();
        }
    }
    else{
        chord_overlay = true;
        if (root_overlay){
            clear_overlay();
        }
        draw_chord_overlay();
    }
}

function draw_root_overlay(){
    for (let i=0; i<original_chd.length; i++){
        let chd = original_chd[i];
        let root = chd.slice(0,12).indexOf(1);
        draw_overlay_bar(original_svg, i, root, get_color(0));
        if (swapped_chd){
            draw_overlay_bar(swapped_svg, i, swapped_chd[i].slice(0,12).indexOf(1), get_color(0));
        }
    }
}

function draw_chord_overlay(){
    for (let i=0; i<original_chd.length; i++){
        let chd = original_chd[i];
        let root = chd.slice(0,12).indexOf(1);
        for (let j=0; j<12; j++){
            if (chd[12+j] == 1){
                draw_overlay_bar(original_svg, i, j, get_color((j-root)%12));
            }
            if (swapped_chd){
                if (swapped_chd[i][12+j] == 1){
                    draw_overlay_bar(swapped_svg, i, j, get_color((j-swapped_chd[i].slice(0,12).indexOf(1))%12));
                }
            }
        }
    }
}

function draw_overlay_bar(svg, x, pitch, color){
    pitch += 24;
    x *= 100;
    while (pitch <= 90){
        svg.append('rect')
        .attr('fill', color)
        .attr('opacity', 0.3)
        .attr('x', x)
        .attr('y', cfg.noteHeight * (cfg.maxPitch - pitch))
        .attr('width', 100)
        .attr('height', 4)
        .attr('class', 'overlay');
    
        pitch += 12;
    }
}

function clear_overlay(){
    d3.selectAll(".overlay").remove().exit()
}

function get_color(pitch){
    return d3.interpolateSinebow((pitch/12+0.6)%1)
}

draw_root_overlay();