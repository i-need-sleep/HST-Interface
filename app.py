import os
import random
import json
import datetime

import torch
import numpy as np
import dataset as dtst
from model import DisentangleVAE

import pretty_midi

from flask import Flask, render_template, request, session, url_for, redirect, flash
from werkzeug.utils import secure_filename

import webbrowser


SAMPLE_LEN = 16
CHORD_LEN_QUANT = 2
SELECT_SAMPLES_PATH = "static/select_samples/phrases"
select_sample_folders = os.listdir(SELECT_SAMPLES_PATH)

# Load things #################################################################################################################
# with open('cleaned.json') as json_file:
#     index_data = json.load(json_file)

# shift_low = -6
# shift_high = 6
# num_bar = 2
# contain_chord = True
# fns = dtst.collect_data_fns()
# dataset = dtst.wrap_dataset(fns, np.arange(len(fns)), shift_low, shift_high,
#                         num_bar=num_bar, contain_chord=contain_chord)

device = torch.device('cuda' if torch.cuda.is_available() else 'cpu')
model = DisentangleVAE.init_model(device)
model_path = 'result/models/disvae-nozoth_epoch.pt'  
model.load_model(model_path, map_location=device)

print("Model loaded")

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

def allowed_file(filename):
    return '.' in filename and \
           filename.rsplit('.', 1)[1].lower() in ALLOWED_EXTENSIONS

# The Main Thing ##################################################################################################################
@app.route('/library', methods=['POST','GET'])
def library():
    return render_template('library.html', index_data=index_data)

@app.route('/loadFromLibrary', methods=['POST','GET'])
def loadFromLibrary():
    song_data = json.loads(request.form['select'].replace('\'','\"'))
    song_id = song_data['song_id']
    song_path = './static/POP909/{}/{}.mid'.format(song_id,song_id)
    return render_template('index.html', midi='POP909/{}/{}.mid'.format(song_id,song_id))

@app.route('/upload', methods=['POST','GET'])
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
        # print(pretty_midi.PrettyMIDI(path).get_tempo_changes())
        return render_template('index.html', midi='uploads/'+filename)
    return render_template('index.html')

# @app.route('/', methods=['POST','GET'])
# def fetch_random():
#     melody, pr, pr_mat, ptree, chord = dataset[random.randint(0,len(dataset))]
#     ptree = torch.from_numpy(ptree)
#     _, notes = model.decoder.grid_to_pr_and_notes(ptree.squeeze(0).numpy().astype(int))
#     out_midi = pretty_midi.PrettyMIDI()
#     out_midi.instruments = [pretty_midi.Instrument(0)]
#     out_midi.instruments[0].notes = notes
#     midi_path = 'static/uploads/{}.mid'.format(str(datetime.datetime.today()).replace("-","").replace(" ","").replace(":","").replace(".",""))
#     np.savez(midi_path[:-3]+'npz',pr_mat=pr_mat,chord=chord)
#     out_midi.write(midi_path)
#     return render_template('index.html', midi=midi_path[7:], chords=chd_to_str(chord), chd_mat=chord.tolist(), config={'SAMPLE_LEN':8})

# @app.route('/get_prog_prob', methods=['GET'])
# def get_prog_prob():
#     return {"ha":"llo"}

@app.route('/swap_in_place', methods=['POST'])
def swap():
    print(request.form)

    chord = json.loads(request.form['chd'])
    midi_in = request.form['midi_in']
    chord_in = request.form['chd_in']
    for c in chord:
        c[0] = int(c[0])
        c[2] = int(c[2])
        for i in range(len(c[1])):
            c[1][i] = (int(c[1][i])+c[0])%12
    chord = simpleChd_to_chd(chord)
    chd_mat_swapped = chord.tolist()
    chord_out = chd_to_str(chord)
    chord_in = chord_in[1:-1].replace("'",'').split(',')
    data = np.load('static/'+midi_in[:-3]+'npz')
    pr_mat = data['pr_mat']
    c_out = data['chord']
    pr_mat = torch.from_numpy(pr_mat).float().to(device)
    chord = torch.from_numpy(chord).float().unsqueeze(0).to(device)
    c = torch.from_numpy(c_out).float().unsqueeze(0).to(device)
    print(pr_mat.shape, c.shape)
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
    midi_out = 'static/'+midi_in[:-4]+str(datetime.datetime.today()).replace("-","").replace(" ","").replace(":","").replace(".","")+".mid"

    out_midi.write(midi_out)
    return {"midi_out": midi_out,"chd_mat_swapped": chd_mat_swapped}   

@app.route('/resample', methods=['POST','GET'])
def resample():
    chord, pr_mat, midi_in_path = get_select_sample()
    
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
    return {"midi": midi_path, "chords": chd_to_str(chord), "chd_mat": chord.tolist()}

@app.route('/', methods=['POST','GET'])
def first_sample():
    chord, pr_mat, midi_in_path = get_select_sample()
    
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

    send = {}
    send['midi_path'] = midi_path[7:]
    send['chords'] = chd_to_str(chord)
    send['chd_mat'] = chord.tolist()
    send['SAMPLE_LEN'] = SAMPLE_LEN
    send['CHORD_LEN_QUANT'] = CHORD_LEN_QUANT
    return render_template('index.html', send = send)

def get_select_sample():
    SELECT_SAMPLES_PATH = "static/select_samples/phrases"
    select_sample_folders = os.listdir(SELECT_SAMPLES_PATH)
    folder = random.choice(select_sample_folders)
    chord_path = "{}/{}/chord.npy".format(SELECT_SAMPLES_PATH,folder)
    mixed_path = "{}/{}/mixed.npy".format(SELECT_SAMPLES_PATH,folder)
    midi_path = "{}/{}/mixed.mid".format(SELECT_SAMPLES_PATH,folder)
    chord = np.load(chord_path)
    mixed = np.load(mixed_path)
    mixed = mixed.reshape(1,mixed.shape[0],mixed.shape[1])
    root = np.zeros((16,12))
    bass = np.zeros((16,12))
    root[[i for i in range(16)],chord[:,0].astype(int)] = 1
    bass[[i for i in range(16)],chord[:,-1].astype(int)] = 1
    chord = np.concatenate((root,chord[:,1:-1],bass),axis=1)
    return chord, mixed, midi_path

# Alternative Layouts
@app.route('/layoutB', methods=['POST','GET'])
def first_sampleB():
    chord, pr_mat, midi_in_path = get_select_sample()
    
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

    send = {}
    send['midi_path'] = midi_path[7:]
    send['chords'] = chd_to_str(chord)
    send['chd_mat'] = chord.tolist()
    send['SAMPLE_LEN'] = SAMPLE_LEN
    send['CHORD_LEN_QUANT'] = CHORD_LEN_QUANT
    return render_template('indexB.html', send = send)

@app.route('/layoutC', methods=['POST','GET'])
def first_sampleC():
    chord, pr_mat, midi_in_path = get_select_sample()
    
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

    send = {}
    send['midi_path'] = midi_path[7:]
    send['chords'] = chd_to_str(chord)
    send['chd_mat'] = chord.tolist()
    send['SAMPLE_LEN'] = SAMPLE_LEN
    send['CHORD_LEN_QUANT'] = CHORD_LEN_QUANT
    return render_template('indexC.html', send = send)

if __name__ == '__main__':
    host = "127.0.0.2"
    port = 5000
    webbrowser.open("http://{}:{}/".format(host,port), new=0, autoraise=True)
    # webbrowser.open("http://{}:{}/layoutB".format(host,port), new=0, autoraise=True)
    # webbrowser.open("http://{}:{}/layoutC".format(host,port), new=0, autoraise=True)
    app.run(host, port, debug = True)
