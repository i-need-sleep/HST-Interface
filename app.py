import os
import copy
import random
import json
import datetime
import threading

import torch
import numpy as np
import dataset as dtst
from model import DisentangleVAE
from flask_cors import CORS, cross_origin

import pretty_midi

from flask import Flask, render_template, request, session, url_for, redirect, flash
from werkzeug.utils import secure_filename

import webbrowser


SAMPLE_LEN = 16
CHORD_LEN_QUANT = 2
SELECT_SAMPLES_PATH = "static/select_samples/phrases"
select_sample_folders = os.listdir(SELECT_SAMPLES_PATH)

# Load things #################################################################################################################

device = torch.device('cuda' if torch.cuda.is_available() else 'cpu')
model = DisentangleVAE.init_model(device)
model_path = 'result/models/disvae-nozoth_epoch.pt'  
model.load_model(model_path, map_location=device)

# Helpers ########################################################################################################################
def chd_to_str(c_mat):
    out = []
    pitches = ['C','C#','D','D#','E','F','F#','G','G#','A','A#','B']
    for c in c_mat:
        root = np.argmax(c[:12])
        root_s = pitches[root]
        chroma = np.array([i for i in range(12)])[c[12:24]==1]
        chroma = (chroma - root) % 12
        bass = np.argmax(c[24:])
        if len(chroma) == 3:
            if 7 in chroma:
                if 4 in chroma:
                    c_type = ''
                if 3 in chroma:
                    c_type = 'm'
                if 1 in chroma or 2 in chroma:
                    c_type = 'sus2'
                if 5 in chroma or 6 in chroma:
                    c_type = 'sus4'
            else:
                c_type = '6'
        else:
            c_type = ''
        if bass == 0:
            bass_s = ''
        else:
            bass_s = '/' + pitches[(root + bass) % 12]
        out.append('{}{}{}'.format(root_s, c_type, bass_s))
    for i in range(len(out)-1, 0, -1):
        if out[i] == out[i-1]:
            out[i] = ''
    return out

def simpleChd_to_chd(simple):
    out = np.zeros((len(simple), 36))
    for i, c in enumerate(simple):
        if c == []:
            out[i] = out[i-1]
        else:
            root = np.array(c[0])
            chroma = np.array(c[1])
            bass = np.array(c[2])
            out[i][root] = 1
            out[i][chroma + 12] = 1
            out[i][bass + 24] = 1
    return out


def chd_to_deg(c_mat, key):
    out = []
    pitches = ['C','C#','D','D#','E','F','F#','G','G#','A','A#','B']
    pitches_flat  = ['C','Db','D','Eb','E','F','Gb','G','Ab','A','Bb','B']
    deg = ['I', 'IIb', 'II', 'IIIb', 'III', 'IV', 'Vb', 'V', 'VIb', 'VI', 'VIIb', 'VI']

    key = key[:-3]
    if key in pitches:
        key = pitches.index(key)
    else:
        key = pitches_flat.index(key)

    for c in c_mat:
        root = np.argmax(c[:12])
        root_s = (root-key)%12
        chroma = np.array([i for i in range(12)])[c[12:24]==1]
        chroma = (chroma - root) % 12
        bass = np.argmax(c[24:])
        c_type = deg[root_s]
        if 3 in chroma:
            c_type = deg[root_s].lower()
        if 1 in chroma or 2 in chroma:
            c_type += 'sus2'
        if 5 in chroma or 6 in chroma:
            c_type += 'sus4'
        if bass != 0:
            c_type += '/' + deg[(root + bass - key) % 12]
        out.append(c_type)
    for i in range(len(out)-1, 0, -1):
        if out[i] == out[i-1]:
            out[i] = ''
    return out

# Server Setup ###################################################################################################################
UPLOAD_FOLDER = 'static/uploads/'
ALLOWED_EXTENSIONS = {'mid'}

for filename in os.listdir(UPLOAD_FOLDER):
    file_path = os.path.join(UPLOAD_FOLDER, filename)
    try:
        os.unlink(file_path)
    except:
        pass

app = Flask(__name__)
app.secret_key = str(random.random())
app.config['UPLOAD_FOLDER'] = UPLOAD_FOLDER
CORS(app)

def allowed_file(filename):
    return '.' in filename and \
           filename.rsplit('.', 1)[1].lower() in ALLOWED_EXTENSIONS

# The Main Thing ##################################################################################################################
@app.route('/library', methods=['POST','GET'])
# Unused, to be removed
def library():
    return render_template('library.html', index_data=index_data)

@app.route('/loadFromLibrary', methods=['POST','GET'])
# Unused, to be removed
def loadFromLibrary():
    song_data = json.loads(request.form['select'].replace('\'','\"'))
    song_id = song_data['song_id']
    song_path = './static/POP909/{}/{}.mid'.format(song_id,song_id)
    return render_template('index.html', midi='POP909/{}/{}.mid'.format(song_id,song_id))

@app.route('/upload', methods=['POST','GET'])
# Unused, to be removed
def upload():
    if 'user_midi' not in request.files:
        flash('No file part')
        return render_template('index.html')
    file = request.files['user_midi']
    if file.filename == '':
        flash('No selected file')
        return render_template('index.html')
    if file and allowed_file(file.filename):
        filename = secure_filename(file.filename)
        path = os.path.join(app.config['UPLOAD_FOLDER'], filename)
        file.save(path)
        notes = pretty_midi.PrettyMIDI(path).instruments[0].notes
        return render_template('index.html', midi='uploads/'+filename)
    return render_template('index.html')

def swap_apply(midi_in, chord):
    data = np.load("static/uploads"+midi_in[:-3]+'npz')
    pr_mat = data['pr_mat']
    c_out = data['chord']
    pr_mat = torch.from_numpy(pr_mat).float().to(device)
    chord = torch.from_numpy(chord).float().unsqueeze(0).to(device)
    c = torch.from_numpy(c_out).float().unsqueeze(0).to(device)
    for i in range(SAMPLE_LEN//8):
        pr_mat_i = pr_mat[:,32*i:32*i+32,:]
        c_i = c[:,8*i:8*i+8,:]
        chord_i = chord[:,8*i:8*i+8,:]
        try:
            ptree_out_i = model.swap(pr_mat_i, pr_mat_i, c_i, chord_i, fix_rhy=True, fix_chd=False)
            pr_out_i, notes_out_i = model.decoder.grid_to_pr_and_notes(ptree_out_i.squeeze(0))
            pr_out = np.concatenate((pr_out,pr_out_i), axis=0)
            for note in notes_out_i:
                notes_out.append(pretty_midi.Note(note.velocity, note.pitch, note.start+8*i, min([note.end+8*i,SAMPLE_LEN])))
        except:
            ptree_out_i = model.swap(pr_mat_i, pr_mat_i, c_i, chord_i, fix_rhy=True, fix_chd=False)
            pr_out, notes_out = model.decoder.grid_to_pr_and_notes(ptree_out_i.squeeze(0))

    for i in range(SAMPLE_LEN):
        notes_out.append(pretty_midi.Note(1, 30, i, i+1))
    out_midi = pretty_midi.PrettyMIDI()
    out_midi.instruments = [pretty_midi.Instrument(0)]
    out_midi.instruments[0].notes = notes_out
    midi_out = 'static/uploads/'+midi_in[:-4]+str(datetime.datetime.today()).replace("-","").replace(" ","").replace(":","").replace(".","")+".mid"
    out_midi.write(midi_out)
    return midi_out

@app.route('/swap_in_place', methods=['POST'])
def swap():
    chord = json.loads(request.form['chd'])
    mixed_in = request.form['mixed_in']
    mel_in = request.form['mel_in']
    acc_in = request.form['acc_in']
    chord_in = request.form['chd_in']
    for c in chord:
        c[0] = int(c[0])
        c[2] = int(c[2])
        for i in range(len(c[1])):
            c[1][i] = (int(c[1][i])+c[0])%12
    chord = simpleChd_to_chd(chord)
    chd_mat_swapped = chord.tolist()
    chord_in = chord_in[1:-1].replace("'",'').split(',')

    mixed_out = swap_apply(mixed_in, chord)
    mel_out = swap_apply(mel_in, chord)
    acc_out = swap_apply(acc_in, chord)

    return {"chd_mat_swapped": chd_mat_swapped,
            "mixed_out": mixed_out,
            "mel_out": mel_out,
            "acc_out": acc_out}   

@app.route('/resample', methods=['POST','GET'])
def resample():
    try:
        song = request.form['song'].split(":")[0]
        segment = request.form['segment']
        targetFolder = "{}_{}".format(song, segment)

        chord, pr_mat, midi_in_path, name, key, mel_path, mel_npy, acc_path, acc_npy = get_select_sample(targetFolder)
    
    except:
        chord, pr_mat, midi_in_path, name, key, mel_path, mel_npy, acc_path, acc_npy = get_select_sample()
    
    
    midi_path = process_midinpy(midi_in_path, pr_mat, chord)
    mel_path = process_midinpy(mel_path, mel_npy, chord)
    acc_path = process_midinpy(acc_path, acc_npy, chord)

    chord_str = chd_to_str(chord)
    chord_deg = chd_to_deg(chord, key)
    for idx, chd_str in enumerate(chord_str):
        if chord_deg[idx] != '':
            chord_str[idx] += " ({})".format(chord_deg[idx])
    return {"midi": midi_path[7:], "chords": chord_str, "chd_mat": chord.tolist(), "midi_in_path":midi_in_path, "name": name, "key": key,
            "mel_path": mel_path[7:], "acc_path": acc_path[7:]}

@app.route('/', methods=['POST','GET'])
def first_sample():
    chord, pr_mat, midi_in_path, name, key, mel_path, mel_npy, acc_path, acc_npy = get_select_sample()

    midi_path = process_midinpy(midi_in_path, pr_mat, chord)
    mel_path = process_midinpy(mel_path, mel_npy, chord)
    acc_path = process_midinpy(acc_path, acc_npy, chord)

    chord_str = chd_to_str(chord)
    chord_deg = chd_to_deg(chord, key)
    for idx, chd_str in enumerate(chord_str):
        if chord_deg[idx] != '':
            chord_str[idx] += " ({})".format(chord_deg[idx])

    send = {}
    send['midi_in_path'] = midi_in_path
    send['midi_path'] = midi_path[7:]
    send['mel_path'] = mel_path[7:]
    send['acc_path'] = acc_path[7:]
    send['chords'] = chord_str
    send['chd_mat'] = chord.tolist()
    send['SAMPLE_LEN'] = SAMPLE_LEN
    send['CHORD_LEN_QUANT'] = CHORD_LEN_QUANT
    send['quickProg'] =     {
                            'I-IV-vi-V':[['C', 'Maj'],['C', 'Maj'],['F', 'Maj'],['F', 'Maj'],['A', 'min'],['A', 'min'],['G', 'Maj'],['G', 'Maj']],
                            'I-IV-V-i':[['C', 'Maj'],['C', 'Maj'],['F', 'Maj'],['F', 'Maj'],['G', 'Maj'],['G', 'Maj'],['C', 'Maj'],['C', 'Maj']],
                            'I-ii-V-i':[['C', 'Maj'],['C', 'Maj'],['D', 'min'],['D', 'min'],['G', 'Maj'],['G', 'Maj'],['C', 'Maj'],['C', 'Maj']],
                            'I-vi-IV-V':[['C', 'Maj'],['C', 'Maj'],['A', 'min'],['A', 'min'],['F', 'Maj'],['F', 'Maj'],['G', 'Maj'],['G', 'Maj']],
                            'I-V-vi-iii':[['C', 'Maj'],['C', 'Maj'],['G', 'Maj'],['G', 'Maj'],['A', 'min'],['A', 'min'],['E', 'min'],['E', 'min']],
                            'IV-I-IV-V':[['F', 'Maj'],['F', 'Maj'],['C', 'Maj'],['C', 'Maj'],['F', 'Maj'],['F', 'Maj'],['G', 'Maj'],['G', 'Maj']],
                            'IV-V-I-vi':[['F', 'Maj'],['F', 'Maj'],['G', 'Maj'],['G', 'Maj'],['C', 'Maj'],['C', 'Maj'],['A', 'min'],['A', 'min']]
                            }
    send['songData'] = getSongData()
    send['name'] = name
    send['key'] = key
    return render_template('index.html', send = send)

def get_select_sample(folder=False):
    SELECT_SAMPLES_PATH = "static/select_samples/phrases"
    select_sample_folders = os.listdir(SELECT_SAMPLES_PATH)
    if folder == False:
        folder = random.choice(select_sample_folders)
    chord_path = "{}/{}/chord.npy".format(SELECT_SAMPLES_PATH,folder)
    mixed_path = "{}/{}/mixed.npy".format(SELECT_SAMPLES_PATH,folder)
    midi_path = "{}/{}/mixed.mid".format(SELECT_SAMPLES_PATH,folder)
    melody_path = "{}/{}/melody.mid".format(SELECT_SAMPLES_PATH,folder)
    acc_path = "{}/{}/accompaniment_track.mid".format(SELECT_SAMPLES_PATH,folder)
    mel_npy = "{}/{}/melody_chord.npy".format(SELECT_SAMPLES_PATH,folder)
    acc_npy = "{}/{}/accompaniment_track.npy".format(SELECT_SAMPLES_PATH,folder)
    json_path = "{}/{}/songData.json".format(SELECT_SAMPLES_PATH,folder)
    chord = np.load(chord_path)
    mixed = np.load(mixed_path)
    mixed = mixed.reshape(1,mixed.shape[0],mixed.shape[1])
    mel_npy = np.load(mel_npy)
    mel_npy = mel_npy.reshape(1,mel_npy.shape[0],mel_npy.shape[1])[:,:,:128]
    acc_npy = np.load(acc_npy)
    acc_npy = acc_npy.reshape(1,acc_npy.shape[0],acc_npy.shape[1])
    root = np.zeros((16,12))
    bass = np.zeros((16,12))
    root[[i for i in range(16)],chord[:,0].astype(int)] = 1
    bass[[i for i in range(16)],chord[:,-1].astype(int)] = 1
    chord = np.concatenate((root,chord[:,1:-1],bass),axis=1)

    with open(json_path, 'r') as jsonFile:
                jsonData = json.load(jsonFile)
                name = jsonData['name']
                key = jsonData['key'][:-1]
                key = key.replace(':','')

    return chord, mixed, midi_path, name, key, melody_path, mel_npy, acc_path, acc_npy

def getSongData():
    # Progressions, keys, etc
    SELECT_SAMPLES_PATH = "static/select_samples/phrases"
    select_sample_folders = os.listdir(SELECT_SAMPLES_PATH)
    songData = {}
    for folder in select_sample_folders:
        [song, segment] = folder.split("_")

        json_path = "{}/{}/songData.json".format(SELECT_SAMPLES_PATH,folder)
        chord_path = "{}/{}/chord.npy".format(SELECT_SAMPLES_PATH,folder)
        mixed_path = "{}/{}/mixed.npy".format(SELECT_SAMPLES_PATH,folder)
        midi_path = "{}/{}/mixed.mid".format(SELECT_SAMPLES_PATH,folder)
        json_path = "{}/{}/songData.json".format(SELECT_SAMPLES_PATH,folder)
        chord = np.load(chord_path)
        mixed = np.load(mixed_path)
        mixed = mixed.reshape(1,mixed.shape[0],mixed.shape[1])
        root = np.zeros((16,12))
        bass = np.zeros((16,12))
        root[[i for i in range(16)],chord[:,0].astype(int)] = 1
        bass[[i for i in range(16)],chord[:,-1].astype(int)] = 1
        chord = np.concatenate((root,chord[:,1:-1],bass),axis=1)

        with open(json_path, 'r') as jsonFile:
                jsonData = json.load(jsonFile)
                name = jsonData['name']
                key = jsonData['key'][:-1]
                key = key.replace(':','')

        songkey = "{}: {}".format(song, name)

        degs = chd_to_deg(chord, key)
        new_deg = []
        for deg in degs:
            if deg != '':
                new_deg.append(deg)

        if songkey not in songData.keys():
            songData[songkey] = {segment: '-'.join(new_deg), 'key': key}
        else:
            songData[songkey][segment] = '-'.join(new_deg)
    return songData


def get_melody_midi():
    # Get a separate melody midi from the lead sheet midi
    SELECT_SAMPLES_PATH = "static/select_samples/phrases"
    select_sample_folders = os.listdir(SELECT_SAMPLES_PATH)
    for folder in select_sample_folders:
        melochd_path = "{}/{}/melody_chord.mid".format(SELECT_SAMPLES_PATH,folder)
        pm = pretty_midi.PrettyMIDI(melochd_path, initial_tempo=90)
        pm_out = pretty_midi.PrettyMIDI(initial_tempo=90)
        pm_out.instruments = [pm.instruments[0]]
        pm_out.write("{}/{}/melody.mid".format(SELECT_SAMPLES_PATH,folder))

def process_midinpy(midi_in_path, pr_mat, chord):
    in_midi_notes = pretty_midi.PrettyMIDI(midi_in_path).instruments[0].notes
    out_midi = pretty_midi.PrettyMIDI()
    out_midi.instruments = [pretty_midi.Instrument(0)]
    for note in in_midi_notes:
        out_midi.instruments[0].notes.append(pretty_midi.Note(note.velocity, note.pitch, note.start*4/3, min([note.end*4/3,SAMPLE_LEN])))

    for i in range(SAMPLE_LEN):
        out_midi.instruments[0].notes.append(pretty_midi.Note(1, 30, i, i+1))
    
    midi_path = 'static/uploads/{}.mid'.format(str(datetime.datetime.today()).replace("-","").replace(" ","").replace(":","").replace(".",""))
    np.savez(midi_path[:-3]+'npz',pr_mat=pr_mat,chord=chord)
    out_midi.write(midi_path)
    return midi_path

# Explore different textures for a given progression

explore_queue = []
@app.route('/explore', methods=['POST','GET'])
def explore_prog():
    chd_mat = json.loads(request.form['chd_mat'])
    chd_str = json.loads(request.form['chd_str'])

    for c in chd_mat:
        c[0] = int(c[0])
        c[2] = int(c[2])
        for i in range(len(c[1])):
            c[1][i] = (int(c[1][i])+c[0])%12
    chd_mat = simpleChd_to_chd(chd_mat)

    explore_queue.append({
        'chd_mat': chd_mat.tolist(),
        'chd_str': chd_str,
        'used': False,
        'processed': []
    })
    return 'hi'

@app.route('/get_exploredata', methods=['GET'])
def get_exploredata():
    out = {}
    for i, explore_data in enumerate(explore_queue):
        if explore_data['used'] == False:
            explore_data['used'] = True
            explore_data['explore_idx'] = i
            out = explore_data
            break
    out = expand_exploredata(out)
    out = expand_exploredata(out)
    return out

def expand_exploredata(explore_data):
    SELECT_SAMPLES_PATH = "static/select_samples/phrases"
    select_sample_folders = os.listdir(SELECT_SAMPLES_PATH)
    out_folder = ''
    for folder in select_sample_folders:
        used = False
        for processed in explore_data['processed']:
            if processed['folder'] == folder:
                used = True
        if not used:
            out_folder = folder
            break
    if out_folder == '':
        return explore_data
    chord_, mixed, mixed_path, name, key, mel_path, mel_npy, acc_path, acc_npy = get_select_sample(folder=out_folder)
    chd_mat = explore_data['chd_mat']

    chord = np.asarray(chd_mat)

    mixed_path = process_midinpy(mixed_path, mixed, chord_)
    mel_path = process_midinpy(mel_path, mel_npy, chord_)
    acc_path = process_midinpy(acc_path, acc_npy, chord_)

    mixed_out = swap_apply(mixed_path[14:], chord)
    mel_out = swap_apply(mel_path[14:], chord)
    acc_out = swap_apply(acc_path[14:], chord)

    chord_str = chd_to_str(chord_)
    chord_deg = chd_to_deg(chord_, key)
    for idx, chd_str in enumerate(chord_str):
        if chord_deg[idx] != '':
            chord_str[idx] += " ({})".format(chord_deg[idx])

    explore_data['processed'].append({
        'folder': out_folder,
        'name': name,
        'key': key,
        'chd_str': chord_str,
        'chd_mat': chord_.tolist(),
        'mixed_path': mixed_path,
        'mixed_out': mixed_out,
        'mel_path': mel_path,
        'mel_out': mel_out,
        'acc_path': acc_path,
        'acc_out': acc_out
    })
    return explore_data

@app.route('/explore_add', methods=['POST','GET'])
def explore_add():
    idx = json.loads(request.form['explore_idx'])
    explore_data = explore_queue[idx]
    explore_queue[idx] = expand_exploredata(explore_data)
    return explore_queue[idx]

if __name__ == '__main__':
    host = "127.0.0.2"
    port = 5000
    # threading.Timer(1.25, lambda: webbrowser.open("http://{}:{}/".format(host,port), new=0, autoraise=True) ).start()
    app.run(host, port, debug = False)
