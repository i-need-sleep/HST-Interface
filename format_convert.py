import numpy as np
import warnings
import pretty_midi


"""
The MIDI string message convention in this project.
==========
There are altogether 5 types of event to describe each note:
    1. note pitch onset: 128 values.
    2. note pitch offset: 128 values
    3. time shifts: 32 values
    4. sos: 1 value
    5. eos: 1 value

Given 8 types of event their indexes:
    0 - 127: note pitch onset (sp)
    128: sos
    129: eos
    130 - 257: note pitch offset (ep)
    258 - 289: time shift (ts)

There are altogether 290 events.
"""
    

class MidiMessageConverter():
    
    def __init__(self, num_beat=8, num_quaver=4):
        self.keys = ['sp', 'sos', 'eos', 'ep', 'ts']
        self.vals = [128, 1, 1, 128, 32]
        start_inds = [sum(self.vals[0: i]) for i in range(len(self.vals))]
        self.event_list_dic = dict(zip(self.keys, zip(self.vals, start_inds)))
        index_list = []
        for key, val in zip(self.keys, self.vals):
            index_list += [(key, ind) for ind in range(val)]
        self.index_list = index_list
        self.index_range = sum(self.vals)

        self.num_beat = num_beat
        self.num_quaver = num_quaver
        self.max_time_unit = num_beat * num_quaver
        
    def event_to_index(self, event_key, event_val=0):
        assert event_key in self.event_list_dic.keys()
        
        assert 0 <= event_val <= self.event_list_dic[event_key][0] - 1 and \
            type(event_val) == int
        
        return self.event_list_dic[event_key][1] + event_val
    
    def index_to_event(self, ind):
        assert 0 <= ind <= self.index_range - 1 and type(ind) == int
        return self.index_list[ind]
    
    def nmat_to_events(self, nmat, start_index=0):
        assert (nmat[:, 2] == self.num_quaver).all() and \
            (nmat[:, 5] == self.num_quaver).all()
        assert (nmat[:, 0].max() - start_index) < self.num_beat
        assert (nmat[:, 2].max() - start_index) < self.num_beat
        assert (nmat[:, [1, 4]].max()) < self.num_quaver
        
        nmat = np.copy(nmat)
        nmat[:, [0, 3]] -= start_index
        event_in_units = [None] * self.max_time_unit
        
        for note in nmat:
            sb, sq, _, eb, eq, _, pi, vel = note
            start_pos = sb * self.num_quaver + sq
            # note this step "-1" is very important.
            end_pos = min(eb * self.num_quaver + eq, self.max_time_unit) - 1
            if event_in_units[start_pos] is None:
                event_in_units[start_pos] = []
            event_in_units[start_pos].append(('sp', int(pi)))
            if event_in_units[end_pos] is None:
                event_in_units[end_pos] = []
            event_in_units[end_pos].append(('ep', int(pi)))
        
        prev_ind = 0
        events = [('sos', 0)]
        for ind, unit_events in enumerate(event_in_units):
            if unit_events is None:
                continue
            ts = ind - prev_ind
            # if ts > 0:   # deleted useless
            events.append(('ts', int(ts)))
            prev_ind = ind
            events += unit_events
        events.append(('eos', 0))
        return events
    
    def events_to_midistr(self, events):
        midistr = np.zeros(len(events), dtype=int)
        for ind, event in enumerate(events):
            midistr[ind] = self.event_to_index(*event)
        return midistr
    
    def nmat_to_midistr(self, nmat, start_index=0):
        events = self.nmat_to_events(nmat, start_index)
        midistr = self.events_to_midistr(events)
        return midistr
    
    def midistr_to_events(self, midistr):
        events = []
        for midi_ind in midistr:
            events.append(self.index_to_event(int(midi_ind)))
        return events
    
    def events_to_nmat(self, events, start_index=0):
        assert events[0] == ('sos', 0)
        assert events[-1] == ('eos', 0)
        num_notes = len([event for event in events if event[0] == 'sp'])
        
        # initialize nmat
        nmat = np.full((num_notes, 8), np.nan)
        nmat[:, [2, 5]] = self.num_quaver
        nmat[:, 3] = self.num_beat - 1
        nmat[:, 4] = self.num_quaver - 1
        nmat[:, 7] = 100
        
        cur_ind = 0
        cur_row = 0
        last_pitch_row = None
        unfinished_rows = []
        for event in events:
            event_type, event_ind = event
            if event_type == 'sos':
                continue
            elif event_type == 'eos':
                break
            elif event_type == 'ts':
                cur_ind += event_ind
            elif event_type == 'sp':
                nmat[cur_row, 0] = cur_ind // self.num_quaver
                nmat[cur_row, 1] = cur_ind % self.num_quaver
                nmat[cur_row, 6] = event_ind
                last_pitch_row = cur_row
                unfinished_rows.append(cur_row)
                # add this new line
                nmat[cur_row, 7] = 100
                cur_row += 1

            elif event_type == 'ep':
                if len(unfinished_rows) != 0:
                    cands = np.where(nmat[unfinished_rows, 6] == event_ind)[0]
                    if len(cands) == 0:
                        continue
                    row = unfinished_rows[cands.argmax()]
                    nmat[row, 3] = (cur_ind + 1) // self.num_quaver
                    nmat[row, 4] = (cur_ind + 1) % self.num_quaver
                    unfinished_rows.remove(row)
        nmat = nmat[nmat[:, 0].argsort()]
        nmat = nmat[~np.isnan(nmat).any(axis=-1)].astype(int)
        nmat[:, [0, 3]] += start_index
        return nmat
    
    def midistr_to_nmat(self, midistr, start_index=0):
        events = self.midistr_to_events(midistr)
        nmat = self.events_to_nmat(events, start_index)
        return nmat
    
    def format_events(self, events):
        if events[0] != ('sos', 0):
            events.insert(0, ('sos', 0))
        if events[-1] != ('eos', 0):
            events.append(('eos', 0))
        return events
    
    def format_midistr(self, midistr):
        sos_ind = self.event_list_dic['sos'][1]
        eos_ind = self.event_list_dic['eos'][1]
        if midistr[0] != sos_ind:
            midistr = np.concatenate([np.array([sos_ind], dtype=int), midistr], 
                                      axis=-1)
        if midistr[-1] != eos_ind:
            midistr = np.concatenate([midistr, np.array([eos_ind], dtype=int)],
                                      axis=-1)
        return midistr
    
    def nmat_to_mat(self, nmat):
        if (nmat[:, 2] != self.num_quaver).any() or \
        (nmat[:, 5] != self.num_quaver).any():
            warnings.warn('num_quaver not consistent!')
                
        mat = np.zeros((nmat.shape[0], 4), dtype=float)
        mat[:, 0] = nmat[:, 0] + nmat[:, 1] / nmat[:, 2]
        mat[:, 1] = nmat[:, 3] + nmat[:, 4] / nmat[:, 5]
        mat[:, [2, 3]] = nmat[:, [6, 7]]
        return mat
    
    def mat_to_nmat(self, mat):
        nmat = np.zeros((mat.shape[0], 8), dtype=int)
        nmat[:, [0, 3]] = np.floor(mat[:, [0, 1]]).astype(int)
        nmat[:, [1, 4]] = np.round((mat[:, [0, 1]] - nmat[:, [0, 3]]) \
                                                * self.num_quaver).astype(int)
        nmat[:, [2, 5]] = self.num_quaver
        nmat[:, [6, 7]] = mat[:, [2, 3]]
        return nmat


def pr_to_mat(pr, num_quaver=4):
    pr = piano_roll_to_prmat(pr)
    mat = []
    for t, p in zip(*np.where(pr > 0)):
        note = np.array([t / num_quaver, (t + pr[t, p]) / num_quaver, p, 100])
        mat.append(note)
    mat = np.array(mat)
    return mat


def piano_roll_to_prmat(pr):
    #  pr: (32, 128, 3), dtype=bool
    # Assume that "not (first_layer or second layer) = third_layer"
    pr[:, :, 1] = np.logical_not(np.logical_or(pr[:, :, 0], pr[:, :, 2]))
    # To int dtype can make addition work
    pr = pr.astype(int)
    # Initialize a matrix to store the duration of a note on the (32, 128) grid
    pr_matrix = np.zeros((32, 128))

    for i in range(31, -1, -1):
        # At each iteration
        # 1. Assure that the second layer accumulates the note duration
        # 2. collect the onset notes in time step i, and mark it on the matrix.

        # collect
        onset_idx = np.where(pr[i, :, 0] == 1)[0]
        pr_matrix[i, onset_idx] = pr[i, onset_idx, 1] + 1
        if i == 0:
            break
        # Accumulate
        # pr[i - 1, :, 1] += pr[i, :, 1]
        # pr[i - 1, onset_idx, 1] = 0  # the onset note should be set 0.
        pr[i, onset_idx, 1] = 0  # the onset note should be set 0.
        pr[i - 1, :, 1] += pr[i, :, 1]
    return pr_matrix


def prmat_to_pgrid(pr_mat, max_note_count=11, max_pitch=107, min_pitch=22,
                   pitch_pad_ind=88, dur_pad_ind=2,
                   pitch_sos_ind=86, pitch_eos_ind=87):
    """
    :param pr_mat: (32, 128) matrix. pr_mat[t, p] indicates a note of pitch p,
    started at time step t, has a duration of pr_mat[t, p] time steps.
    :param max_note_count: the maximum number of notes in a time step,
    including <sos> and <eos> tokens.
    :param max_pitch: the highest pitch in the dataset.
    :param min_pitch: the lowest pitch in the dataset.
    :param pitch_pad_ind: see return value.
    :param dur_pad_ind: see return value.
    :param pitch_sos_ind: sos token.
    :param pitch_eos_ind: eos token.
    :return: pr_mat3d is a (32, max_note_count, 6) matrix. In the last dim,
    the 0th column is for pitch, 1: 6 is for duration in binary repr. Output is
    padded with <sos> and <eos> tokens in the pitch column, but with pad token
    for dur columns.
    """
    pitch_range = max_pitch - min_pitch + 1  # including pad
    pr_mat3d = np.ones((32, max_note_count, 6), dtype=int) * dur_pad_ind
    pr_mat3d[:, :, 0] = pitch_pad_ind
    pr_mat3d[:, 0, 0] = pitch_sos_ind
    cur_idx = np.ones(32, dtype=int)
    for t, p in zip(*np.where(pr_mat != 0)):
        pr_mat3d[t, cur_idx[t], 0] = p - min_pitch
        binary = np.binary_repr(int(pr_mat[t, p]) - 1, width=5)
        pr_mat3d[t, cur_idx[t], 1: 6] = \
            np.fromstring(' '.join(list(binary)), dtype=int, sep=' ')
        cur_idx[t] += 1
    pr_mat3d[np.arange(0, 32), cur_idx, 0] = pitch_eos_ind
    return pr_mat3d


def pgrid_to_pr_and_notes(grid,  model, bpm=60., start=0.):
    if grid.shape[1] == model.max_simu_note:
        grid = grid[:, 1:]
    pr = np.zeros((32, 128), dtype=int)
    alpha = 0.25 * 60 / bpm
    notes = []
    for t in range(32):
        for n in range(10):
            note = grid[t, n]
            if note[0] == model.pitch_eos:
                break
            pitch = note[0] + model.min_pitch
            dur = int(''.join([str(_) for _ in note[1:]]), 2) + 1
            pr[t, pitch] = dur
            notes.append(pretty_midi.Note(100, int(pitch) ,start + t * alpha,
                                          start + (t + dur) * alpha))
    return pr, notes


def mat_to_notes(mat, bpm=60., start=0.):
    # mat: (start, end, pitch, velocity)
    alpha = 60 / bpm
    notes = []
    for n in mat:
        s, e, p, v = n
        notes.append(pretty_midi.Note(v, int(p),
                                      start + s * alpha, start + e * alpha))
    return notes


def notes_to_mat(notes, bpm=60, start=0.):
    mat = np.zeros((len(notes), 4))
    for i, note in enumerate(notes):
        mat[i] = np.array([note.start, note.end, note.pitch, note.velocity])
    mat = mat[mat[:, 0].argsort()]
    return mat


if __name__ == '__main__':
    # some test cases
    import dirs, os
    converter = MidiMessageConverter()
    for i in range(0, 909):
        song_id = str(i + 1).zfill(3)
        data = np.load(os.path.join(dirs.POP909_PR4, song_id + '.npz'))
        melody = data['melody']
        bridge = data['bridge']
        piano = data['piano']
        cond1 = melody[:, 0] >= 19
        cond2 = melody[:, 0] <= 26
        cond = cond1 & cond2
        # print(melody[cond])
        nmat1 = melody[cond]
       
        # print(nmat1)
        cond1 = piano[:, 0] >= 19
        cond2 = piano[:, 0] <= 26
        cond = cond1 & cond2
        nmat2 = piano[cond]
        # print(nmat2)
        
        print(nmat2)
        events = converter.nmat_to_events(nmat2, 19)
        # print(events)
        midistr = converter.events_to_midistr(events)
        # print(midistr)
        # import matplotlib.pyplot as plt
        # plt.plot(midistr)
        # plt.show()
        events1 = converter.midistr_to_events(midistr)
        nmat22 = converter.events_to_nmat(events1, start_index=19)
        print(np.concatenate([nmat22, nmat2], axis=-1))
        break


# def get_onehot(m, c, sb):
#     # hard-coded. convert to (32, 130) and (32, 12)
#     m = np.copy(m)
#     m[:, [0, 3]] -= sb
#     melody = np.zeros((32, 130), dtype=int)
#     melody[:, 129] = 1
#     chord = np.zeros((32, 12), dtype=int)
#     for n in m:
#         s = n[0] * 4 + n[1]
#         e = n[3] * 4 + n[5]
#         p = n[6]
#         melody[s, p] = 1
#         melody[s + 1: e, 128] = 1
#         melody[s: e, 129] = 0
#     for i, row in enumerate(c):
#         chord[4 * i: 4 * (i + 1)] = row[1: 13]
#     return melody, chord


# def pad_batch_midistr(abatch, pad_ind):
#     # abatch: (B, (length)) length: not equal
#     max_length = int(max([len(midistr) for midistr in abatch]))
#     padded_batch = np.zeros((abatch.shape[0], max_length))
#     for i, midistr in enumerate(abatch):
#         padded_batch[i] = np.pad(midistr, (0, max_length - len(midistr)),
#                                  'constant', constant_values=pad_ind)
#     return padded_batch
