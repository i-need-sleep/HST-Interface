2-measure phrases selected from POP-909.

Each folder is named after the song index (e.g., "001" means the phrase is selected from the 1st song in POP-909)

Within each folder:
	"accompaniment.npy":	a 64*128 matrix with 64 time bins (quantized by 16th note) and 128 MIDI pitch bins;
	"mix.npy"			also a 64*128 matrix. It is a mixed track of accompaniment and melody;
	"chord.npy":		a 16*14 matrix with 16 time bins (quantized by quater note). 14 represents a 12D chroma with a root indicator and a bass indicator added on both sides;
	"melody_chord.npy":	a 64*142 matrix with 64 time bins (quantized by 16th note). 142 = 128 MIDI pitches + 2 onset-hold indicators + 12 chord Chroma.
	"accompaniment.mid":	midi version of "accompaniment.npy", tempo=80;
	"mix.mid":		midi version of "mix.npy", tempo=80;
	"melody_chord.mid":	midi version of "melody_chord.npy", tempo=80.

Tips: To run PolyDisentanglement VAE, just feed "accompaniment.npy" and "chord.npy" to the VAE model each two measure.