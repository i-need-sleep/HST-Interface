// Initialize MIDI visualizer //////////////////////////////////////////////////////////////////////////////////
const vis = document.getElementById('vis');
const vis_out = document.getElementById('vis_out');
const player_out = document.getElementById('player_out');
const swapped_player = document.getElementById('swapped_player')

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

const rep_chd = document.getElementById('rep_chd');
const sug_chd = document.getElementById('sug_chd');
const submit = document.getElementById('submit');

const chd_in_send = document.getElementById('chd_in_send');

var prev = 0;
var chd_in = {'chd': []};

rep_chd.onclick = rep_chd_go;
submit.onclick = submit_go;
sug_chd.onclick = search_chd;

function add_chd_go(){
    if (link_length() < SAMPLE_LEN/CHORD_LEN_QUANT){
        prev_root = [0,1,1,2,2,3,4,4,5,5,6,6,7][current_root];
        let root_in = current_root;
        let chroma_in = [0];
        let bass_in = "0";
    
        chroma_in.push([3,3,4,2,5,4][inner_selected].toString());
        chroma_in.push([7,6,8,7,7,7][inner_selected].toString());
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
        prev = [root_in, chroma_in, bass_in];
        chd_in_send.value = JSON.stringify(chd_in);

        if (find_last_node().temp){
            last_node = find_parent_id(last_node);
        }

        graph_clear_temp()
    
        for (let i=0; i<nodes_entered.length; i++){
            let node = nodes_entered[i];
            node.y += 100;
            node.x = Math.random()*150-75;
        }
        nodes_entered.push(new node_entered(0,200,current_chord));
        
        let node = {id: nodes.length, name: current_chord, chord: prev, chord_symbol:find_node(last_node).chord_symbol,  _size: 45, svgSym: nodeIcon}
        nodes.push(node)

        if (nodes.length>1){
            link = {tid:nodes[nodes.length-1], sid: last_node, _svgAttrs:{}}
            if (link_length()*CHORD_LEN_QUANT%4 == 0){
                link._svgAttrs['stroke-dasharray'] = '10'
                link._svgAttrs['stroke-width'] = '10'
            }
            links.push(link)
            
        }
        nodeClick(NaN,node)
        search_chd();
    }
}

function rep_chd_go(){
    if (prev != 0 && link_length()<SAMPLE_LEN/CHORD_LEN_QUANT){
        chd_in_send.value = JSON.stringify(chd_in);

        for (let i=0; i<nodes_entered.length; i++){
            let node = nodes_entered[i];
            node.y += 100;
            node.x = Math.random()*150-75;
        }
        nodes_entered.push(new node_entered(0,200,""));

        if (find_last_node().temp){
            last_node = find_parent_id(last_node);
        }
        graph_clear_temp()
        last_node_node = find_last_node();
        let node = {id: nodes.length, name: last_node_node.name, chord: last_node_node.chord, _size: 30, small: true, svgSym: nodeIcon}
        if (node.name == " "){
            node.name = last_node_node.chord_symbol;
        }
        nodes.push(node)
        if (nodes.length>1){
            link = {tid:nodes[nodes.length-1], sid: last_node, _svgAttrs:{}}
            link._svgAttrs['stroke-width'] = '3'
            if (link_length()*CHORD_LEN_QUANT%4 == 0){
                link._svgAttrs['stroke-dasharray'] = '10'
            }
            links.push(link)
            
        }
        nodeClick(NaN,node)
        search_chd();
    }
}

function clear_progression(){
    prev_root = -1;
    chd_in = {'chd': []};
    prog = [];
    prev = 0;
    outer_selected = 0
    inner_selected = 5
    current_root = 0
    clear_graph();
    init_graph();
}

document.getElementById("clear_prog").onclick = function(){
    clear_progression();
    nodes_new = [];
    nodes_entered = [];
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

// Chord suggestion /////////////////////////////////////////////////////////////////////////////////////////////
var update_ctr = 0

function search_chd(){
    if (link_length() != SAMPLE_LEN/CHORD_LEN_QUANT){
        if (update_ctr < 0){
            update_ctr = 0
        }
        update_ctr ++;
        let prog = []
        let last = 999
        let chords = get_chd_mats()[0]
        for (let i=0; i<chords.length; i++){
            let r = [1,1,2,2,3,4,4,5,5,6,6,7][chords[i][0]]
            if (last != r){
                last = r;
                prog.push(r)
            }
        }
        let prog_str = prog.join(",");
        axios.get(chord_prog_entry+"?cp="+prog_str, config)
            .then(response => {
                update_ctr --;
                if (update_ctr == 0){
                    graph_clear_temp()
                    const data = response.data;
                    let i = 0;
                    nodes_new = [];
                    while ( data[i] && data[i]["probability"] >= 0.05){
                        nodes_new.push(new node_new(-200,-200, pitches[tonic_pitches[parseInt(data[i]["chord_ID"])-1]], (data[i]["probability"].toFixed(2)*100).toFixed(0)+"%"));
                        graph_suggest_chord(data[i]);
                        i ++;
                    }
                }
            });
        }
}

// Access the server for lazy-loading the chord progression probabilities (under construction)
// const prog_url = document.getElementById("get_prog_prob").innerHTML;
// axios.get(prog_url)
//         .then(response => {
//                 const data = response.data;
//         });

// P5-based UI, to be removed //////////////////////////////////////////////////////////////////////////////////////////////
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
const intervals = ['root','m2','M2',"m3","M3","P4","A4/d5","P5",'m6','M6','m7','M7']
var tonic_pitches = [0,2,4,5,7,9,11];
var inner_text = ["min", "dim", "aug", "sus2", "sus4", "Maj"];
var outer_text = ["maj7", "b9", "9", "#9", "11", "#11", "6", "7"];

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

var dragged;
var dx;
var dy;

// function setup() {
//     let canvas = createCanvas(canvas_width, canvas_height);
//     canvas.parent("interface");
// }

// function draw() {
//     background(230);

//     translate(center_x, center_y)
//     draw_nodes_new();
//     draw_nodes_entered();

//     if (state == DIAL_INNER || state == DIAL_FULL){
//         chord_dial_draw_rings();
//         chrod_dial_fill_text();
//     }

//     translate(-center_x, -center_y)

//     if (root_select){
//         draw_root();   
//     }
// }

// function mousePressed(){
//     if (state == DIAL_INNER || state == DIAL_FULL){
//         let mouse_dist = dist(mouseX, mouseY, center_x, center_y);
//         let mouse_angle = acos((mouseX-center_x)/mouse_dist);

//         if (mouseY-center_y < 0){
//             mouse_angle = 2*PI - mouse_angle;
//         }

//         if (state == DIAL_FULL){
//             for (let i=0; i<outer_arcs.length-1; i++){
//                 if (mouse_dist>ring_width && mouse_dist<1.5*ring_width && mouse_angle/PI>outer_arcs[i] && mouse_angle/PI<outer_arcs[i+1]){
//                     if (outer_selected != i){
//                         outer_selected = i;
//                     }
//                     else{
//                         outer_selected = NaN;
//                     }
//                     get_chord_symbol();
//                 }
//             }
//         }
//         for (let i=0; i<inner_arcs.length-1; i++){
//             if (mouse_dist>0.5*ring_width && mouse_dist<1*ring_width && mouse_angle/PI>inner_arcs[i] && mouse_angle/PI<inner_arcs[i+1]){
//                 inner_selected = i;
//                 state = DIAL_FULL;
//                 get_masks();
//                 get_chord_symbol();
//             }
//         }
//         if (mouse_dist < 0.5*ring_width){
//             root_select = !root_select;
//         }
//     }
//     if (root_select){
//         for (let i=0; i<pitches.length; i++){
//             if (mouseX>root_offset_x && mouseX<root_offset_x+root_width && Math.floor((mouseY-root_offset_y)/root_height) == i){
//                 current_root = i;
//                 get_chord_symbol();
//                 get_masks();
//             }
//         }
//     }
//     for (let i=0; i<nodes_new.length; i++){
//         let node = nodes_new[i]
//         if (dist(mouseX-center_x, mouseY-center_y, node.x, node.y) < nodes_new_size/2){
//             current_root = pitches.indexOf(node.chd);
//             get_chord_symbol();
//             get_masks();
//         }
//     }
//     for (let i=0; i<nodes_entered.length; i++){
//         let node = nodes_entered[i]
//         if (dist(mouseX-center_x, mouseY-center_y, node.x, node.y) < nodes_entered_size/2){
//             dragged = i;
//             let cell = nodes_entered[dragged];
//             dx = mouseX - cell.x;
//             dy = mouseY - cell.y;
//         }
//     }
// }

// function mouseReleased() {
//     dragged = undefined;
//   }


// function mouseDragged() {
//     if (dragged >= 0){
//         let cell = nodes_entered[dragged];
//         cell.x = mouseX - dx;
//         cell.y = mouseY - dy;
//     }
//   }

  
// Force-Directed Graph (unused, to be removed)
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

// function tooltip_new(){
//     for (let i=0; i<nodes_new.length; i++){
//         let node = nodes_new[i];
//         if (dist(mouseX-center_x, mouseY-center_y, node.x, node.y) < nodes_new_size/2){
//             fill(255,255,255);
//             rect(mouseX-center_x-tooltip_size_x/2, mouseY-center_y-tooltip_y_offset-tooltip_size_y/2, tooltip_size_x, tooltip_size_y);
//             fill(0,0,0);
//             textAlign(CENTER, CENTER);
//             textSize(font_size);
//             text(node.prob, mouseX-center_x, mouseY-center_y-tooltip_y_offset);
//         }
//     }
// }

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

function get_chord_symbol(bass=-1, chroma_overwrite=0){
    let chd_type = "";
    let chd_interval = "";
    if (inner_selected >= 0){
        chd_type = inner_text[inner_selected];
    }
    if (outer_selected >= 0){
        chd_interval = outer_text[outer_selected];
    }
    if (inner_selected == 0){
        chd_type = "m";
        if (outer_selected == 3){
            chd_interval = "b11"
        }
    }
    else if (inner_selected == 5){
        chd_type = "";
    }
    
    current_chord = pitches[current_root]+chd_type+chd_interval;

    if (chroma_overwrite){
        console.log(chroma_overwrite)
    }

    if (bass>0){
        current_chord += "/"+pitches[(current_root+bass)%12]    
    }

    d3.selectAll("#central_text").text(current_chord)
    return current_chord;
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
    let chd_mat = get_chd_mats()[0]
    chd_player.start(get_prog([chd_mat[chd_mat.length-1],chd_mat[chd_mat.length-1]]));
}

// Chord Progression Playback (Inputed)
const prog_step_duration = 0.5;
var active_prog = 1
var active_chord_cell
prog_player = new mm.SoundFontPlayer('https://storage.googleapis.com/magentadata/js/soundfonts/sgm_plus');
prog_player_graph = new mm.SoundFontPlayer('https://storage.googleapis.com/magentadata/js/soundfonts/sgm_plus');
prog_player_click = new mm.SoundFontPlayer('https://storage.googleapis.com/magentadata/js/soundfonts/sgm_plus');

prog_player.callbackObject = {
    run: (note) => {prog_playback_highlighting_altered(note)},
      stop: () => {return}
    };

function prog_playback_highlighting_altered(note){
    if (note.startTime==0){
        prog_playback_highlighting_altered_tick(0)
    }
}

function prog_playback_highlighting_altered_tick(i){
    if (prog_player.isPlaying()){
        let time_cell = document.getElementById("time_altered"+(i+1))
        let prog_cell = document.getElementById("altered"+active_prog+"_"+i)
        altered_cell_highlight(time_cell, prog_cell, step=prog_step_duration)
        if (i < SAMPLE_LEN){
            setTimeout(() => {
                prog_playback_highlighting_altered_tick(i+1)
            }, prog_step_duration*1000);
        }
    }  
}

document.getElementById("play_prog").onclick = function(){
    prog_player_graph.start(get_prog(get_chd_mats()[0]));
}

prog_player_click.callbackObject = {
    run: (note) => {prog_playback_highlighting_click(note)},
      stop: () => {return}
    };

function prog_playback_highlighting_click(note){
    if (active_chord_cell.querySelector("div")){
        let cell_list_click = [active_chord_cell]
        let cur_cell = document.getElementById(active_chord_cell.id.split("_")[0]+"_"+(parseInt(active_chord_cell.id.split("_")[1])+1))
        while (cur_cell){
            if (cur_cell.querySelector("div").innerHTML.replace(/\s/g,"")!= ""){
                break
            } 
            cell_list_click.push(cur_cell)
            cur_cell = document.getElementById(cur_cell.id.split("_")[0]+"_"+(parseInt(cur_cell.id.split("_")[1])+1))
        }
        cur_cell = document.getElementById(active_chord_cell.id.split("_")[0]+"_"+(parseInt(active_chord_cell.id.split("_")[1])-1))
        while (cur_cell){
            if (active_chord_cell.querySelector("div").innerHTML.replace(/\s/g,"") != ""){
                break
            }
            cell_list_click.push(cur_cell)
            if (cur_cell.querySelector("div").innerHTML.replace(/\s/g,"") != ""){
                break
            }
            cur_cell = document.getElementById(cur_cell.id.split("_")[0]+"_"+(parseInt(cur_cell.id.split("_")[1])-1))
        }
        for (let i=0; i<cell_list_click.length; i++){
            cell_list_click[i].classList.add("table_cell_active")
        }
        setTimeout(() => {
            for (let i=0; i<cell_list_click.length; i++){
                cell_list_click[i].classList.remove("table_cell_active")
            }
        }, prog_step_duration*1000);
    }
    else{
        let cell_list_click = [active_chord_cell]
        let cur_cell = document.getElementById(active_chord_cell.id.split("prog")[0]+"prog"+(parseInt(active_chord_cell.id.split("prog")[1])+1))
        while (cur_cell){
            if (cur_cell.innerHTML.replace(/\s/g,"")!= ""){
                break
            } 
            cell_list_click.push(cur_cell)
            cur_cell = document.getElementById(cur_cell.id.split("prog")[0]+"prog"+(parseInt(cur_cell.id.split("prog")[1])+1))
        }
        cur_cell = document.getElementById(active_chord_cell.id.split("prog")[0]+"prog"+(parseInt(active_chord_cell.id.split("prog")[1])-1))
        while (cur_cell){
            if (active_chord_cell.innerHTML.replace(/\s/g,"") != ""){
                break
            }
            cell_list_click.push(cur_cell)
            if (cur_cell.innerHTML.replace(/\s/g,"") != ""){
                break
            }
            cur_cell = document.getElementById(cur_cell.id.split("prog")[0]+"prog"+(parseInt(cur_cell.id.split("prog")[1])-1))
        }
        for (let i=0; i<cell_list_click.length; i++){
            cell_list_click[i].classList.add("table_cell_active")
        }
        setTimeout(() => {
            for (let i=0; i<cell_list_click.length; i++){
                cell_list_click[i].classList.remove("table_cell_active")
            }
        }, prog_step_duration*1000);}
    
    
}

function get_prog(chords){ // chords = array of chord [[root(absolute),[chromas(relative)],bass(relative)],...]
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

prog_player_original.callbackObject = {
    run: (note) => {prog_playback_highlighting_original(note)},
      stop: () => {return}
    };

document.getElementById("play_prog_original").onclick = play_prog_original_go;
document.getElementById("play_prog_original2").onclick = play_prog_original_go;

function play_prog_original_go(){
    if (prog_player_original.isPlaying()){
        prog_player_original.stop();
    }
    else {
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
        prog_player_original.start(get_prog(chords))
    }
}

function prog_playback_highlighting_original(note){
    if (note.startTime==0){
        prog_playback_highlighting_original_tick(0)
    }
}
function prog_playback_highlighting_original_tick(i){
    if (prog_player_original.isPlaying()){
        let time_cell = document.getElementById("time"+(i+1))
        let prog_cell = document.getElementById("original_prog"+i)
        original_cell_highlight(time_cell, prog_cell, step=prog_step_duration)
        if (i < SAMPLE_LEN){
            setTimeout(() => {
                prog_playback_highlighting_original_tick(i+1)
            }, prog_step_duration*1000);
        }
    }  
}
// On-Screen Keyboard (Under construction) ///////////////////////////////////////////////////////////////////////////////////////

// Sound and interaction with the user's keyboard
// var keyboard = new AudioKeys();
// const synth = new Tone.PolySynth(Tone.Synth).toDestination();
// const now = Tone.now()

// keyboard.down(function(note) {
//     synth.triggerAttack(Tonal.Note.fromMidi(note.note), now);
//   });

//   keyboard.up(function(note) {
//     synth.triggerRelease(Tonal.Note.fromMidi(note.note), now+0.2);
//   });

// Chord pitch overlay ////////////////////////////////////////////////////////////////////////
const root_overlay_check = document.getElementById("root_overlay");
const chord_overlay_check = document.getElementById("chord_overlay");

var root_overlay = true;
var chord_overlay = false;

const original_svg = d3.select(".original_svg");
const swapped_svg = d3.select(".swapped_svg");

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

// Chord Network ///////////////////////////////////////////////////////////////////////////////////////////////////
var D3Network = window['vue-d3-network']

var nodes = [];
var links = [];

var last_node;

new Vue({
  el: '#graph',
  components: {
    D3Network
  },
  data () {
    return {
      nodes: nodes,
      links: links,
      options:
      { size:{w:1600,h:600},
        force: 4000,
        nodeSize: 20,
        nodeLabels: true,
        linkWidth:5,
        canvas:false
      }
    }
  },
  methods:{
  nodeClick,
  lcb (link) {
    return link
  }
  }
})
const larger_node_size = 45;
const temp_node_size = 40;
const smaller_node_size = 30;
const dial_size = 250;

const nodeIcon = '<svg version="1.1" xmlns="http://www.w3.org/2000/svg" width="40" height="40" viewBox="0 0 40 40"><circle cx="20" cy="20" r="17"></circle></svg>'
function clear_graph(){
    dial = 0
    while (nodes.length>0){
        nodes.pop()
    }
    while (links.length>0){
        links.pop()
    }
}

function nodeClick(event,node){
    
    if (node._cssClass == "selected"){
        graph_clear_temp()
        draw_dial(node)
    }

    else if (node.temp){
        current_root = node.chord[0];
            if ([9,2,4].includes(current_root)){
                inner_selected = 0;
            }
            else{
                inner_selected = 5;
            }
            outer_selected = NaN;
            get_chord_symbol();
            get_masks();
            add_chd_go()
    }

    else if (node._cssClass != "dial"){
        resize_nodes()
        node._cssClass = "selected";
    last_node = node.id;

    let cur_node = last_node;
    // Highlight Path
    while (true) {
        let seek = false;
        for (let i=0; i<links.length; i++){
            if (links[i].tid.id == cur_node){
                cur_node = links[i].sid;
                links[i]._color = "#347dff"
                links[i]._svgAttrs['marker-end'] = 'url(#m-end-highlight)';
                find_node(cur_node)._cssClass = "highlighted"
                seek = true;
                break;
            }
        }
        if (! seek){
            break;
        }
    
    }
    
    // Temporary fix forcing an update of the nodes' coloring
    links.push({tid:0, sid: 0, _svgAttrs:{}})
    links.pop()    
    }

    
    d3.selectAll("#l-nodes").raise()
    d3.selectAll(".dial").raise()

    if (! node.temp){
        update_ctr = -1;
    }
  }

function link_length(){
    if (last_node >= 0){
        let cur_node = last_node;
        let counter = 1;
        while (true) {
            let seek = false;
            for (let i=0; i<links.length; i++){
                if (links[i].tid.id == cur_node){
                    cur_node = links[i].sid;
                    counter ++;
                    seek = true;
                    break;
                }
            }
            if (! seek){
                break;
            }
        }
        return counter
    }
    return 0
}

function find_last_node(){
    return find_node(last_node)
}

function find_node(id){
    for (let i=0; i<nodes.length; i++){
        if (nodes[i].id == id){
            return nodes[i]
        }
    }
    return false
}

function get_chd_mats(){
    let chd_mats = [find_last_node().chord];
    let chd_symbols = [find_last_node().name];
    let cur_node = last_node;
        while (true) {
            let seek = false;
            for (let i=0; i<links.length; i++){
                if (links[i].tid.id == cur_node){
                    cur_node = links[i].sid;
                    chd_mats.push(find_node(cur_node).chord);
                    chd_symbols.push(find_node(cur_node).name);
                    seek = true;
                    break;
                }
            }
            if (! seek){
                break;
            }
        }
        return [chd_mats.reverse(), chd_symbols.reverse()]
}

function submit_go(){
    if (link_length() == SAMPLE_LEN/CHORD_LEN_QUANT && tab_ctr < 9){

        // Chord symbol display
        let chord_mats = get_chd_mats()
        let chords = chord_mats[0];
        let symbols = chord_mats[1];
        let tab_prog=[]
        chords = scale_prog(chords)
        symbols = scale_prog(symbols)
        for (let i=0; i<chords.length; i++){
            if (i>0 && symbols[i]==symbols[i-1]){
                tab_prog.push('')
            }
            else{
                tab_prog.push(symbols[i]+chord_to_roman(chords[i]));
            }
        }
        insert_row(tab_prog, tab_ctr == 1)
        prog_storage.push(chords);

        //  Fetch swapped MIDI
        swap(chords, tab_ctr);
    }
}

var last_ctr = 1
var swapped_chd
function swap(chords, ctr){
    ctr--;
    console.log(chords)
    const swap_in_place = document.getElementById("swap_in_place").innerHTML;
    var form_data = new FormData();

    form_data.append('chd', JSON.stringify(chords));
    form_data.append('midi_in', document.getElementById('player_original').src.slice(7,100));
    form_data.append('chd_in', document.getElementById('chd_in').value);

    axios.post(swap_in_place, form_data)
        .then(response => {
            
            document.getElementById("altered_head"+ctr).style = "text-decoration: underline; font-weight: bold;"
            document.getElementById("altered_head"+ctr).onclick = function(){
                if (document.getElementsByClassName("table-primary").length){
                    document.getElementsByClassName("table-primary")[0].classList.remove("table-primary")
                }
                active_row = ctr
                last_ctr = ctr
                document.getElementById("altered_row"+ctr).classList.add("table-primary")
                apply_swap(response.data["midi_out"],response.data["chd_mat_swapped"])
            }
            if ((first_altered_apply == 0 && ctr==last_ctr)){
                first_altered_apply = 1
                swapped_player.hidden = false;
                document.getElementById("time_steps_altered").hidden = false
                init_altered_highlighting()
                document.getElementById("main").classList.remove("padded_up");
                document.getElementById("main").classList.add("padded_up_higher");

                if (document.getElementsByClassName("table-primary").length){
                    document.getElementsByClassName("table-primary")[0].classList.remove("table-primary")
                }
                active_row = ctr
                document.getElementById("altered_row"+ctr).classList.add("table-primary")
                apply_swap(response.data["midi_out"],response.data["chd_mat_swapped"])
            }
        setTimeout(() => {
            draw_barlines_altered()
        }, 100);
        });
}

function apply_swap(midi, new_swapped_chd, play=false){
    if (player_out.src != midi){
        player_out.src = midi;
        vis_out.src = midi;
    
        // Update overlay
        swapped_chd = new_swapped_chd
    
        clear_overlay();
        if (chord_overlay){
            draw_chord_overlay();
        }
        else if (root_overlay){
            draw_root_overlay();
        }
        if (play){
            setTimeout(() => {
            player_out.start()
            }, 100);
        }
    }
    else{
        if (play){
            if (!player_out.playing){
                setTimeout(() => {
                    player_out.start()
                    }, 100);
            }
            else{
                player_out.stop()
            }
        }
    }
}

function node_is_end(id){
    for (let i=0; i<links.length; i++){
        if (links[i].sid.id == id){
            return false;
        }
    }
    return true
}

function graph_suggest_chord(chord){
    if (node_is_end(last_node) && link_length()<SAMPLE_LEN/CHORD_LEN_QUANT && !dial && ["C","Dm","E","F","G",'Am','B'][chord.chord_ID-1]){
        let node = {id: nodes.length, name: ["C","Dm","E","F","G",'Am','B'][chord.chord_ID-1]+" ("+chord.chord_HTML+")"+" ("+chord.probability+"}", chord: prev, _size: temp_node_size, temp:true}
        let r = chord.chord_ID-1;
        if (r == 2 || r == 6){
            r = [0,2,4,5,7,9,11][r]
            node.chord = [r,[r,(r+3)%12,(r+7)%12],0]
        }
        else{
            r = [0,2,4,5,7,9,11][r]
            node.chord = [r,[r,(r+4)%12,(r+7)%12],0]
        }
        nodes.push(node)
        if (nodes.length>1){
            links.push({tid:nodes[nodes.length-1], sid: last_node, _svgAttrs:{}})
        }
    }
}

function graph_clear_temp(){
    let new_nodes = [];
    let new_links = [];
    let removed_ids = [];
    for (let i=0; i<nodes.length; i++){
        if (nodes[i].temp==true){
            removed_ids.push(nodes[i].id);
        }
        else{
            new_nodes.push(nodes[i]);
        }
    }
    for (let i=0; i<links.length; i++){
        if (!(removed_ids.includes(links[i].tid.id) || removed_ids.includes(links[i].sid.id))){
            new_links.push(links[i]);
        }
    }
    while (nodes.length>0){
        nodes.pop(0)
    }
    while (links.length>0){
        links.pop(0)
    }
    for (let i=0; i<new_nodes.length; i++){
        nodes.push(new_nodes[i])
    }
    for (let i=0; i<new_links.length; i++){
        links.push(new_links[i])
    }
}
function find_parent_id(id){
    for (let i=0; i<links.length; i++){
        if (links[i].tid.id == id){
            return links[i].sid;
        }
    }
    return false
}

function find_child_ids(id){
    let out = []
    for (let i=0; i<links.length; i++){
        if (links[i].sid == id){
            out.push(links[i].tid.id);
        }
    }
    return out
}

function resize_nodes(){
    dial = false;
    document.getElementById("root_select").hidden = true
    document.getElementById("chroma_select").hidden = true
    d3.selectAll(".g").remove().exit();
    for (let i=0; i<nodes.length; i++){
        nodes[i]._cssClass = "";
        if (nodes[i].temp){
            nodes[i]._size = temp_node_size;
        }
        else if (nodes[i].small){
            nodes[i]._size = smaller_node_size
        }
        else{
            nodes[i]._size = larger_node_size;
        }
        if (nodes[i].name == " "){
            nodes[i].name = nodes[i].chord_symbol;
        }
    }
    
    for (let i=0; i<links.length; i++){
        links[i]._color = "rgba(18,120,98,.7)"
        links[i]._svgAttrs['marker-end'] = 'url(#m-end)';
    }
}

const dial_r_outer = 17
const dial_r_inner = 2*dial_r_outer/3
const dial_r_center = dial_r_outer/3

const inner_rads = [0,0.5,0.75,1,1.25,1.5,2]

var dial = false;

function draw_dial(node){
    current_root = node.chord[0]
    node.chord[2] = 0

    dial = true;
    node.chord_symbol = node.name;
    node.name = " ";
    node._cssClass = "dial";
    node._size = dial_size;
    let g = d3.selectAll('.selected').append('g').attr('class', 'g').attr("transform", "translate(20,20)");

    // Outer Ring
    for (let i=0; i < 8; i++){
        if (1 < i && i < 6){
            var arc = d3.arc()
            .innerRadius(dial_r_inner)
            .outerRadius(dial_r_outer)
            .endAngle(i * Math.PI / 4) 
            .startAngle((i+1) * Math.PI / 4)
        
            g.append("path")
                .attr("d", arc)
                .attr("id", 'outer_path'+i)
                .on("click", outer_on_click(i, node))
                .on("click", function(e){outer_on_click(i, node)})
            
            g.append("text") 
            .attr("dx", 6.5)
            .attr("dy", -(-1+dial_r_outer)/6)
            .append("textPath")
                .attr("xlink:href", '#outer_path'+i)
                .style("text-anchor","middle")
                .style("dominant-baseline", "middle")
                .style("fill", "black")
                .style("stroke", "black")
                .style("stroke-width", '0')
                .style("font-size", "3px")
                .style("user-select", "none")
                .attr("id", "outer_text"+i)
                .text(outer_text[i])
                .on("click", function(e){outer_on_click(i, node)})
        }
        else{
            var arc = d3.arc()
            .innerRadius(dial_r_inner)
            .outerRadius(dial_r_outer)
            .startAngle(i * Math.PI / 4) 
            .endAngle((i+1) * Math.PI / 4)
        
            g.append("path")
                .attr("d", arc)
                .attr("id", 'outer_path'+i)
                .on("click", outer_on_click(i, node))
                .on("click", function(e){outer_on_click(i, node)})
            
            g.append("text") 
            .attr("dx", 6.5)
            .attr("dy", (1+dial_r_outer)/6)
            .append("textPath")
                .attr("xlink:href", '#outer_path'+i)
                .style("text-anchor","middle")
                .style("dominant-baseline", "middle")
                .style("fill", "black")
                .style("stroke", "black")
                .style("stroke-width", '0')
                .style("font-size", "3px")
                .style("user-select", "none")
                .attr("id", "outer_text"+i)
                .text(outer_text[i])
                .on("click", function(e){outer_on_click(i, node)})
        }
    }
    

    // Inner Ring
    for (let i=0; i < 6; i++){

        if (0 < i && i < 5){
            var arc = d3.arc()
            .innerRadius(dial_r_center)
            .outerRadius(dial_r_inner)
            .endAngle(inner_rads[i] * Math.PI)
            .startAngle(inner_rads[i+1] * Math.PI)
        
            g.append("path")
                .attr("d", arc)
                .attr("id", 'inner_path'+i)
                .on("click", function(e){inner_on_click(i, node)})

            g.append("text") 
            .attr("dx", 5)
            .attr("dy", -(dial_r_outer)/6)
            .append("textPath")
                .attr("xlink:href", '#inner_path'+i)
                .style("text-anchor","middle")
                .style("dominant-baseline", "middle")
                .style("fill", "black")
                .style("stroke", "black")
                .style("stroke-width", '0')
                .style("font-size", "3px")
                .style("letter-spacing", "0.1em")
                .style("user-select", "none")
                .text(inner_text[i])
                .on("click", function(e){inner_on_click(i, node)})
        }
        else{
            var arc = d3.arc()
            .innerRadius(dial_r_center)
            .outerRadius(dial_r_inner)
            .startAngle(inner_rads[i] * Math.PI)
            .endAngle(inner_rads[i+1] * Math.PI)
        
            g.append("path")
                .attr("d", arc)
                .attr("id", 'inner_path'+i)
                .on("click", function(e){inner_on_click(i, node)})

            g.append("text") 
            .attr("dx", 9)
            .attr("dy", (2+dial_r_outer)/6)
            .append("textPath")
                .attr("xlink:href", '#inner_path'+i)
                .style("text-anchor","middle")
                .style("dominant-baseline", "middle")
                .style("fill", "black")
                .style("stroke", "black")
                .style("stroke-width", '0')
                .style("font-size", "3px")
                .style("letter-spacing", "0.1em")
                .style("user-select", "none")
                .attr("id", "inner_text")
                .text(inner_text[i])
                .on("click", function(e){inner_on_click(i, node)})
        }
    }

    g.append('circle').attr('x',0).attr('y',0).attr('r',dial_r_center)

    g.append("text")      
        .attr("dy",0.5)       
        .style("text-anchor", "middle")
        .style("dominant-baseline", "middle")
        .style("fill", 'black')
        .style("stroke-width", '0')
        .style("font-size", "3px")
        .style("user-select", "none")
        .attr("id","central_text")
        .text(node.name)

    outer_on_click(7, node)
    d3.selectAll(".dial").raise()
}

function inner_on_click(i, node){
    inner_selected = i;

    if(i == 0){
        d3.selectAll("#outer_text3").text("b11")
    }
    else{
        d3.selectAll("#outer_text3").text("#9")
    }

    node.chord_symbol = get_chord_symbol();
    node.chord = update_chord(node)
}

function outer_on_click(i, node){
    if (outer_selected == i){
        outer_selected = undefined;
    }
    else{
        outer_selected = i;
    }
    node.chord_symbol = get_chord_symbol();
    node.chord = update_chord(node)
}

function init_root_select(){
    let table = document.getElementById("root_select")
    for (let i=0; i<pitches.length; i++){
        let cell = table.insertRow().insertCell()
        cell.innerHTML = pitches[i]
        cell.classList.add("root_select_cell")
        cell.id = "root" + i
        cell.onclick = function(){
            if (document.getElementsByClassName("root_cell_selected").length>0){
                document.getElementsByClassName("root_cell_selected")[0].classList.remove("root_cell_selected")
            }
            
            let node = find_node(last_node)
            cell.classList.add("root_cell_selected")
            current_root = i;
            node.chord_symbol = get_chord_symbol();
            node.chord = update_chord(node)
        }
    }
}

function init_chroma_select(){
    let table = document.getElementById("chroma_select")
    for (let i=intervals.length-1; i>-1; i--){
        let row = table.insertRow();
        let bass_cell = row.insertCell()

        bass_cell.id = "bass" + i
        bass_cell.onclick = function(){
            let cell = document.getElementById("bass"+i)
            if (document.getElementsByClassName("bass_cell_selected").length>0){
                document.getElementsByClassName("bass_cell_selected")[0].classList.remove("bass_cell_selected")
            }
            cell.classList.add("bass_cell_selected")
            
            let node = find_node(last_node)
            node.chord_symbol = get_chord_symbol(bass=i);
            node.chord = update_chord(node, bass_in=i)
        }

        let chroma_cell = row.insertCell()
        chroma_cell.innerHTML = intervals[i]
        chroma_cell.classList.add("chroma_select_cell")
        chroma_cell.id = "chroma" + i
        chroma_cell.onclick = function(){
            if (i){
                let cell = document.getElementById("chroma"+i)
                let node = find_node(last_node)
                let chroma = node.chord[1]
                
                if (cell.classList.contains("chroma_cell_selected")){
                    cell.classList.remove("chroma_cell_selected")
                    chroma = chroma.filter(function(item) {
                        return item !== i.toString()
                    })
                }
                else{
                    cell.classList.add("chroma_cell_selected")
                    chroma.push(i.toString())
                }
                node.chord_symbol = get_chord_symbol(bass=node.chord[2],chroma_overwrite=chroma);
                node.chord = update_chord(node,bass_in=-1,chroma_overwrite=chroma)
            }
            
        }
    }
}

init_root_select()
init_chroma_select()

function clean_chroma_select(){
    if (document.getElementsByClassName("bass_cell_selected").length>0){
        document.getElementsByClassName("bass_cell_selected")[0].classList.remove("bass_cell_selected")
    }
    while (document.getElementsByClassName("chroma_cell_selected").length>0){
        document.getElementsByClassName("chroma_cell_selected")[0].classList.remove("chroma_cell_selected")
    }
}

document.getElementById("edit_chd").onclick = function(){
    if (document.getElementById("root_select").hidden){
        draw_dial(find_node(last_node))
        let chord = find_node(last_node)["chord"];

        if (document.getElementsByClassName("root_cell_selected").length>0){
            document.getElementsByClassName("root_cell_selected")[0].classList.remove("root_cell_selected")
        }
        document.getElementById("root"+chord[0]).classList.add("root_cell_selected")

        clean_chroma_select()

        document.getElementById("bass"+chord[2]).classList.add("bass_cell_selected")

        for (let i=0; i<chord[1].length; i++){
            document.getElementById("chroma"+chord[1][i]).classList.add("chroma_cell_selected")
        }

        document.getElementById("root_select").hidden = false
        document.getElementById("chroma_select").hidden = false
    }
    else{
        document.getElementById("root_select").hidden = true
        document.getElementById("chroma_select").hidden = true
    }
}

function update_chord(node, bass_in=-1, chroma_overwrite=0){
    let root_in = current_root;
    let chroma_in = [0];

    chroma_in.push([3,3,4,2,5,4][inner_selected].toString());
    chroma_in.push([7,6,8,7,7,7][inner_selected].toString());
    let outer_lst = [11,1,2,3,5,6,9,10];
    if (inner_selected == 5){
        outer_lst[1] = 4
    }
    if (outer_selected >= 0){
        chroma_in.push(outer_lst[outer_selected].toString());
    }

    if (bass_in == -1 && node.chord[2]){
        bass_in = node.chord[2]
    }
    else if (bass_in == -1){
        bass_in = 0
    }

    if (chroma_overwrite){
        chroma_in = chroma_overwrite
    }

    prev = [root_in, chroma_in, bass_in];

    let children_ids = find_child_ids(node.id)
    for (let i=0; i<children_ids; i++){
        let child = find_node(children_ids[i]);
        if (child.name != node.chord_symbol && child.small){
            child.small = false
        }
        else{
            child.small = true
        }
    } 

    let parent = find_node(find_parent_id(node.id))
    if (node.chord_symbol != parent.name){
        node.small = false
    }
    else if (nodes.length > 1){
        node.small = true
    }

    return prev
}

function init_graph(){
    inner_selected = 5;
    root_selected = 0;
    prev = [0,[0,4,7],0]
    let node = {id: nodes.length, name: "C", chord: prev, _size: 45, svgSym: nodeIcon}
    nodes.push(node)
    nodeClick(0, node)
}

init_graph()

// Click on the canvas to hide the dial
d3.select(".net-svg").append('rect').attr('x',0).attr('y',0).attr('width',9999).attr('height',9999).style('fill','white').lower().on('click', resize_nodes)

// Update the prog table ///////////////////////////////////////////////////////////////////////////////////////////////////////
var tab_ctr = 1;
const prog_table = document.getElementById('saved_prog');
var prog_storage = [];

function insert_row(prog, highlight){
    prog_table.hidden = false;
    let row = prog_table.insertRow();
    let head = row.insertCell();
    row.id = "altered_row"+tab_ctr
    head.innerHTML = "<div class=prog_repos> Altered "+tab_ctr+"</div>";
    head.classList.add("prog_head")
    head.style = "font-weight: normal;"
    head.value = tab_ctr
    head.id = "altered_head"+tab_ctr
    for (let i=0; i<prog.length; i++){
        let cell = row.insertCell();
        cell.innerHTML = "<div class=prog_repos>"+prog[i]+"</div>";
        cell.classList.add("table_cell")
        cell.id = "altered"+tab_ctr+"_"+i
        cell.onclick = function(){
            active_chord_cell = cell
            prog_player_click.start(get_prog([prog_storage[head.value-1][i],prog_storage[head.value-1][i]]));
        }
    }
    let tail2 = row.insertCell();
    let tail = row.insertCell();
    tail2.innerHTML = "<button class='btn btn-light btn-sm' id=prog>progression</button><br>";
    tail2.id = "prog"+tab_ctr
    tail2.onclick = function(){
        active_prog = head.value
        prog_player.start(get_prog(prog_storage[head.value-1]));
    }
    tab_ctr ++;
    if (highlight){
        if (document.getElementsByClassName("table-primary").length){
            document.getElementsByClassName("table-primary")[0].classList.remove("table-primary")
        }
        row.classList.add("table-primary")
        active_row = head.value
    }
    if (tab_ctr>2){
        draw_barlines_altered()
    }
    
}

// function save_go(){
//     if (link_length() == SAMPLE_LEN/CHORD_LEN_QUANT){

//         // Chord symbol display
//         let chord_mats = get_chd_mats()
//         let chords = chord_mats[0];
//         let symbols = chord_mats[1];
//         let tab_prog=[]
//         chords = scale_prog(chords)
//         symbols = scale_prog(symbols)
//         for (let i=0; i<chords.length; i++){
//             if (i>0 && symbols[i]==symbols[i-1]){
//                 tab_prog.push('')
//             }
//             else{
//                 tab_prog.push(symbols[i]+chord_to_roman(chords[i]));
//             }
//         }
//         insert_row(tab_prog, false)
//         prog_storage.push(chords);
//     }
// }
// document.getElementById('save').onclick = save_go;

function scale_prog(chords){
    out = []
    for (let i=0; i<chords.length; i++){
        for (let j=0; j<CHORD_LEN_QUANT; j++){
            out.push(chords[i])
        }
    }
    return out
}

function init_progtable(){
    for (let i=0; i<SAMPLE_LEN; i++){
        let cell = document.getElementById("original_prog"+i)
        cell.onclick = function(){
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
            let chords = [[root, chroma_out, bass],[root, chroma_out, bass]]
            active_chord_cell = cell
            prog_player_click.start(get_prog(chords));}
    }

}
init_progtable();

// Resampling ///////////////////////////////////////////////////////////////////////////////////////
document.getElementById("resample").onclick = resample;

var first_altered_apply = 0

function resample(){
    const resample_url = document.getElementById("resample_url").innerHTML;

    axios.get(resample_url)
        .then(response => {
                let data = response.data
                let midi = data["midi"]
                let chords = data["chords"]
                let chd_mat = data["chd_mat"]

                original_chd = chd_mat;
                
                // Update prog table
                for (let i=0; i<SAMPLE_LEN; i++){
                    let cell = document.getElementById("original_prog"+i)
                    cell.innerHTML = chords[i]
                    cell.onclick = function(){
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
                        let chords = [[root, chroma_out, bass],[root, chroma_out, bass]]
                        active_chord_cell = cell
                        prog_player_click.start(get_prog(chords));}
                }

                // Update midi player
                document.getElementById("player_original").src = midi;
                vis.src = midi;

                // Update overlay
                clear_overlay();
                if (chord_overlay){
                    draw_chord_overlay();
                }
                else if (root_overlay){
                    draw_root_overlay();
                }
                
                // Updated swapped midi
                first_altered_apply = 0
                for (let i=0; i<prog_storage.length;i++){
                    swap(prog_storage[i],i+2)
                }

        });
}

function chord_to_roman(chord){
    let root = chord[0]
    let chroma = chord[1]
    if (tonic_pitches.includes(root)){
        if (chroma.includes(3) || chroma.includes("3")){
            return " ("+["i",0,"ii",0,"iii","iv",0,"v",0,"vi",0,"vii"][root]+")"
        }
        if (chroma.includes(4) || chroma.includes("4")){
            return " ("+["I",0,"II",0,"III","IV",0,"V",0,"VI",0,"VII"][root]+")"
        }
    }
    return ""
}

// Prog stack highlighting (linked to midi player) ///////////////////////////////////////////////////
// Original
const mutationObserver_config = { childList: true, subtree: true, attributes:true };
let original_timer = document.getElementById("player_original").shadowRoot.querySelector(".current-time")
let original_controls = document.getElementById("player_original").shadowRoot.querySelector(".controls")

function original_cell_highlight(time_cell, prog_cell, step=1){
    if (time_cell){
        time_cell.classList.add("time_cell_active")
        setTimeout(() => {
            if (time_cell.classList.contains("time_cell_active")){
                time_cell.classList.remove("time_cell_active")
            }
        }, step*1000);
        if (! prog_cell.classList.contains("table_cell_active")){
            prog_cell.classList.add("table_cell_active")
            let lighted_cells = [prog_cell]
            let timeout = step
            let temp_cell = document.getElementById("original_prog"+(lighted_cells[lighted_cells.length-1].id.slice(13,15)*1+1))
            
            while (temp_cell && temp_cell.innerHTML.replace(/\s/g, '')==""){
                temp_cell.classList.add("table_cell_active")
                lighted_cells.push(temp_cell)
                temp_cell = document.getElementById("original_prog"+(lighted_cells[lighted_cells.length-1].id.slice(13,15)*1+1))
                timeout += step
            }
            setTimeout(() => {
                while (lighted_cells.length > 0){
                    let cell = lighted_cells.pop()
                    if (cell.classList.contains("table_cell_active")){
                        cell.classList.remove("table_cell_active")
                    }
                }
            }, timeout*1000);
        }
    }
}

let original_callback = function(mutationsList, observer) {
    for(var mutation of mutationsList) {
        if (original_controls.classList.contains("playing")){
            let time_cell = document.getElementById("time"+(original_timer.innerHTML.slice(2,4)*1+1))
            let prog_cell = document.getElementById("original_prog"+(original_timer.innerHTML.slice(2,4)*1))
            original_cell_highlight(time_cell, prog_cell)
        }
    }
};

let original_observer = new MutationObserver(original_callback);
original_observer.observe(original_controls, mutationObserver_config);

var active_row = 1
// Altered
function init_altered_highlighting(){
    let altered_timer = document.getElementById("player_out").shadowRoot.querySelector(".current-time")
    let altered_controls = document.getElementById("player_out").shadowRoot.querySelector(".controls")
    
    let altered_callback = function(mutationsList, observer) {
        for(var mutation of mutationsList) {
            if (altered_controls.classList.contains("playing")){
                let time_cell = document.getElementById("time_altered"+(altered_timer.innerHTML.slice(2,4)*1+1))
                let prog_cell = document.getElementById("altered"+active_row+"_"+(altered_timer.innerHTML.slice(2,4)*1))
                altered_cell_highlight(time_cell, prog_cell)
            }
        }
    };
    let altered_observer = new MutationObserver(altered_callback);
    altered_observer.observe(altered_controls, mutationObserver_config);
}

function altered_cell_highlight(time_cell, prog_cell, step=1){
    if (time_cell){
        time_cell.classList.add("time_cell_active")
        setTimeout(() => {
            if (time_cell.classList.contains("time_cell_active")){
                time_cell.classList.remove("time_cell_active")
            }
        }, step*1000);
    }
    if (prog_cell && !prog_cell.classList.contains("table_cell_active")){
        prog_cell.classList.add("table_cell_active")
        let lighted_cells = [prog_cell]
        let timeout = step
        let parts = lighted_cells[lighted_cells.length-1].id.split("_")
        let temp_cell = document.getElementById(parts[0]+"_"+(parts[1]*1+1))
        while (temp_cell && temp_cell.getElementsByClassName("prog_repos")[0].innerHTML.replace(/\s/g, '')==""){
            temp_cell.classList.add("table_cell_active")
            lighted_cells.push(temp_cell)
            parts = lighted_cells[lighted_cells.length-1].id.split("_")
            temp_cell = document.getElementById(parts[0]+"_"+(parts[1]*1+1))
            timeout += step
        }
        setTimeout(() => {
            while (lighted_cells.length > 0){
                let cell = lighted_cells.pop()
                if (cell.classList.contains("table_cell_active")){
                    cell.classList.remove("table_cell_active")
                }
            }
        }, timeout*1000);
    }
}

// Bar lines ///////////////////////////////////////////////////////////////////////////////////////
function draw_barlines_original(){
    d3.selectAll(".barline_original").remove().exit()
    let top_rect = document.getElementById("time1").getBoundingClientRect();
    let bottom_rect = document.getElementById("original_prog0").getBoundingClientRect();

    let l1 = top_rect.left + window.pageXOffset || document.documentElement.scrollLeft
    let l2 = top_rect.right + window.pageXOffset || document.documentElement.scrollLeft
    let t = top_rect.top + window.pageYOffset || document.documentElement.scrollTop
    let b = bottom_rect.bottom + window.pageYOffset || document.documentElement.scrollTop

    for (let i=1; i<SAMPLE_LEN/4; i++){
        d3.selectAll("#original_barline")
        .append('rect')
        .attr('x', l1 + i*4*(l2-l1))
        .attr('y', t)
        .attr('width', 3)
        .attr('height', b-t)
        .attr('class', 'barline barline_original')
    }
}
setTimeout(() => {
    draw_barlines_original()
}, 200);

function draw_barlines_altered(){
    if (document.getElementById("time_altered1") && document.getElementById("altered"+(tab_ctr-1)+"_1")){
        d3.selectAll(".barline_altered").remove().exit()

        let top_rect = document.getElementById("time_altered1").getBoundingClientRect();
        let bottom_rect = document.getElementById("altered"+(tab_ctr-1)+"_1").getBoundingClientRect();

        let l1 = top_rect.left + window.pageXOffset || document.documentElement.scrollLeft
        let l2 = top_rect.right + window.pageXOffset || document.documentElement.scrollLeft
        let t = top_rect.top + window.pageYOffset || document.documentElement.scrollTop
        let b = bottom_rect.bottom + window.pageYOffset || document.documentElement.scrollTop

        for (let i=1; i<SAMPLE_LEN/4; i++){
            d3.selectAll("#altered_barline")
            .append('rect')
            .attr('x', l1 + i*4*(l2-l1))
            .attr('y', t)
            .attr('width', 3)
            .attr('height', b-t)
            .attr('class', 'barline barline_altered')
        }
        place_player()
    }
}

window.onresize = function(){
    setTimeout(()=>{
        draw_barlines_original()
        draw_barlines_altered()
        place_player()
        place_player_original()
    },200)
}

function place_player(){
    if (document.getElementById("altered"+1+"_15")){
        let top_rect = document.getElementById("time_altered16").getBoundingClientRect();
        let bottom_rect = document.getElementById("altered"+1+"_15").getBoundingClientRect();
    
        let l1 = top_rect.left + window.pageXOffset || document.documentElement.scrollLeft
        let l2 = top_rect.right + window.pageXOffset || document.documentElement.scrollLeft
        let t = top_rect.top + window.pageYOffset || document.documentElement.scrollTop
        let b = bottom_rect.top + window.pageYOffset || document.documentElement.scrollTop
     
        player_out.hidden = false
    
        d3.select("#player_out")
        .style("position","absolute")
        .style("left",l2-20+"px")
        .style("top", b-60+"px")
        .style("-webkit-transform","scale(0.65)")
        .raise()
    }
}

function place_player_original(){
    let top_rect = document.getElementById("time16").getBoundingClientRect();
    let bottom_rect = document.getElementById("original_prog15").getBoundingClientRect();

    let l1 = top_rect.left + window.pageXOffset || document.documentElement.scrollLeft
    let l2 = top_rect.right + window.pageXOffset || document.documentElement.scrollLeft
    let t = top_rect.top + window.pageYOffset || document.documentElement.scrollTop
    let b = bottom_rect.bottom + window.pageYOffset || document.documentElement.scrollTop

    d3.select("#player_original")
    .style("position","absolute")
    .style("left",l2-20+"px")
    .style("top", b+60+"px")
    .style("-webkit-transform","scale(0.65)")
    .raise()
}
place_player_original()

// Keyboard shortcuts ///////////////////////////////////////////////////////////
document.addEventListener('keydown', function(event){ 
    if (event.key == "w" || event.key == "ArrowUp"){
        event.preventDefault() 
        shortcut_select_up()
    }
    if (event.key == "s" || event.key == "ArrowDown"){
        event.preventDefault() 
        shortcut_select_down()
    }
    if (event.key == " " || event.key == "Enter"){
        event.preventDefault()
        if (event.ctrlKey){
            if (event.shiftKey){
                shortcut_play_original_prog()
            }
            else{
                shorcut_play_original()
            }
        }
        else{
            if (event.shiftKey){
                shortcut_play_altered_prog()
            }
            else{
                shorcut_play_altered()
            }
        }
    }
    if (event.key == "r"){
        event.preventDefault() 
        resample()
    }
    if (event.key == "a" || event.key == "ArrowLeft"){
        event.preventDefault() 
        shortcut_left()
    }
    if (event.key == "d" || event.key == "ArrowRight"){
        event.preventDefault() 
        shortcut_right()
    }
})

function shortcut_select_up(){
    if (active_row > 1){
        document.getElementById("altered_head"+(active_row-1)).onclick()
    }
}

function shortcut_select_down(){
    if (document.getElementById("altered_head"+(active_row+1))){
        document.getElementById("altered_head"+(active_row+1)).onclick()
    }
}

function shorcut_play_altered(){
    if (!player_out.hidden){
        if (player_out.playing){
            player_out.stop() 
        }
        else{
            player_out.start()  
        }
    }
}

function shortcut_play_altered_prog(){
    if (document.getElementById("prog"+active_row)){
        document.getElementById("prog"+active_row).onclick()
    }
}

function shorcut_play_original(){
    if (player_original.playing){
        player_original.stop() 
    }
    else{
        player_original.start()  
    }
}

function shortcut_play_original_prog(){
    document.getElementById("play_prog_original2").onclick()
}

function shortcut_left(){
    if (player_out.playing){
        if (!player_out.hidden && player_out.currentTime > 0){
            player_out.currentTime --;
        }
    }
    else if (player_original.playing){
        if (!player_original.hidden && player_original.currentTime > 0){
            player_original.currentTime --;
        }
    }
}

function shortcut_right(){
    if (player_out.playing){
        if (!player_out.hidden && player_out.currentTime < SAMPLE_LEN){
            player_out.currentTime ++;
        }
    }
    else if (player_original.playing){
        if (!player_original.hidden && player_original.currentTime < SAMPLE_LEN){
            player_original.currentTime ++;
        }
    }
}

// Popover help and instructions /////////////////////////////////////////////////
$(function () {
    $('[data-toggle="popover"]').popover()
  }) 

  document.getElementById("play_original").onclick = function(){
    if (player_original.playing){
        player_original.stop() 
    }
    else{
        player_original.start()  
    }
  }
