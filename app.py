import os
import random
import json

import torch
import numpy as np
import dataset as dtst
from model import DisentangleVAE

from flask import Flask, render_template, request, session, url_for, redirect, flash
from werkzeug.utils import secure_filename

import pretty_midi

# Load things #################################################################################################################
with open('cleaned.json') as json_file:
    index_data = json.load(json_file)

shift_low = -6
shift_high = 6
num_bar = 2
contain_chord = True
fns = dtst.collect_data_fns()
dataset = dtst.wrap_dataset(fns, np.arange(len(fns)), shift_low, shift_high,
                        num_bar=num_bar, contain_chord=contain_chord)

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
CTR = 0

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
@app.route('/', methods=['POST','GET'])
def index():
    return render_template('index.html')

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

@app.route('/random', methods=['POST','GET'])
def fetch_random():
    global CTR
    melody, pr, pr_mat, ptree, chord = dataset[random.randint(0,len(dataset))]
    ptree = torch.from_numpy(ptree)
    _, notes = model.decoder.grid_to_pr_and_notes(ptree.squeeze(0).numpy().astype(int))
    out_midi = pretty_midi.PrettyMIDI()
    out_midi.instruments = [pretty_midi.Instrument(0)]
    out_midi.instruments[0].notes = notes
    midi_path = 'static/uploads/{}.mid'.format(CTR)
    np.savez(midi_path[:-3]+'npz',pr_mat=pr_mat,chord=chord)
    CTR += 1
    out_midi.write(midi_path)
    return render_template('index.html', midi=midi_path[7:], chords=chd_to_str(chord))

@app.route('/swap', methods=['POST','GET'])
def swap():
    chord = json.loads(request.form['chd'])['chd']
    midi_in = request.form['midi_in']
    chord_in = request.form['chd_in']
    for c in chord:
        c[0] = int(c[0])
        c[2] = int(c[2])
        for i in range(len(c[1])):
            c[1][i] = (int(c[1][i])+c[0])%12
    chord = simpleChd_to_chd(chord)
    chord_out = chd_to_str(chord)
    chord_in = chord_in[1:-1].replace("'",'').split(',')
    data = np.load('static/'+midi_in[:-3]+'npz')
    pr_mat = data['pr_mat']
    c = data['chord']
    pr_mat = torch.from_numpy(pr_mat).float().to(device)
    chord = torch.from_numpy(chord).float().unsqueeze(0).to(device)
    c = torch.from_numpy(c).float().unsqueeze(0).to(device)
    ptree_out = model.swap(pr_mat, pr_mat, c, chord, fix_rhy=True, fix_chd=False)
    pr_out, notes_out = model.decoder.grid_to_pr_and_notes(ptree_out.squeeze(0))
    out_midi = pretty_midi.PrettyMIDI()
    out_midi.instruments = [pretty_midi.Instrument(0)]
    out_midi.instruments[0].notes = notes_out
    midi_out = midi_in[:-4]+'out.mid'
    out_midi.write('static/'+midi_out)
    return render_template('index.html', midi=midi_in, midi_out=midi_out, chords=chord_in, new_chords=chord_out)

if __name__ == '__main__':
    app.run("127.0.0.1", 5000, debug = True)
    
