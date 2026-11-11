#!/usr/bin/env python3
"""
Score for ODE: an original orchestral cue that grows, section by section, into
Beethoven's "Ode to Joy" (Symphony No. 9, 1824 — public domain).

The cue is written here as notes, exported as a MIDI file and rendered with
FluidSynth and a General MIDI soundfont. Every section starts on the same
timestamps as the picture (audio/cues.json, written by `node render.mjs --cues`).

    python3 audio/score.py            # -> audio/build/score.mid, audio/build/score.wav

Requires: mido (pip), fluidsynth and a GM soundfont (apt: fluidsynth fluid-soundfont-gm).
Set SOUNDFONT=/path/to/font.sf2 to use another soundfont.
"""
import json, os, subprocess, sys
from pathlib import Path
import mido

HERE = Path(__file__).resolve().parent
BUILD = HERE / 'build'
BUILD.mkdir(exist_ok=True)
CUES = json.loads((HERE / 'cues.json').read_text())
SEC = {s['id']: s for s in CUES['sections']}
SHOT = {s['id']: s for s in CUES['shots']}
SOUNDFONT = os.environ.get('SOUNDFONT', '/usr/share/sounds/sf2/FluidR3_GM.sf2')

# ----------------------------------------------------------------------------- notes
NAMES = {'C': 0, 'D': 2, 'E': 4, 'F': 5, 'G': 7, 'A': 9, 'B': 11}
def n(name):
    """'F#4' -> MIDI number (C4 = 60)."""
    if isinstance(name, int): return name
    p = NAMES[name[0]]; i = 1
    while name[i] in '#b': p += 1 if name[i] == '#' else -1; i += 1
    return p + 12 * (int(name[i:]) + 1)

# channels and General MIDI programs
CH = dict(vln=0, low=1, bass=2, horn=3, trp=4, choir=5, harp=6, flute=7, reed=8, drums=9, timp=10, piano=11, bell=12, organ=13, pizz=14, tbn=15)
PROG = dict(vln=48, low=48, bass=43, horn=60, trp=56, choir=52, harp=46, flute=73, reed=68, timp=47, piano=0, bell=8, organ=19, pizz=45, tbn=57)
VOL = dict(vln=104, low=100, bass=104, horn=92, trp=88, choir=104, harp=96, flute=92, reed=86, drums=100, timp=104, piano=112, bell=92, organ=78, pizz=104, tbn=90)
PAN = dict(vln=44, low=78, bass=84, horn=50, trp=76, choir=64, harp=36, flute=58, reed=70, timp=64, piano=64, bell=40, organ=64, pizz=60, tbn=82)

events = []  # (seconds, order, mido.Message)
def ev(t, msg, order=1): events.append((max(0.0, t), order, msg))
def note(inst, pitch, t, dur, vel=80):
    ch = CH[inst]; p = n(pitch)
    ev(t, mido.Message('note_on', channel=ch, note=p, velocity=int(max(1, min(127, vel)))), 2)
    ev(t + max(0.03, dur), mido.Message('note_off', channel=ch, note=p, velocity=0), 0)
def chord(inst, pitches, t, dur, vel=70, strum=0.0):
    for i, p in enumerate(pitches): note(inst, p, t + i * strum, dur - i * strum, vel)
def program(inst, prog, t): ev(t, mido.Message('program_change', channel=CH[inst], program=prog), 1)
def cc(inst, ctrl, val, t): ev(t, mido.Message('control_change', channel=CH[inst], control=ctrl, value=int(max(0, min(127, val)))), 1)
def swell(inst, t0, t1, v0, v1, steps=24):
    """Expression (CC11) ramp."""
    for i in range(steps + 1): cc(inst, 11, v0 + (v1 - v0) * i / steps, t0 + (t1 - t0) * i / steps)

class Sect:
    """Beat grid of one tempo section."""
    def __init__(self, sid):
        s = SEC[sid]; self.t0 = s['start']; self.b = 60.0 / s['bpm']; self.end = s['end']
    def t(self, bar, beat=0.0): return self.t0 + (bar * 4 + beat) * self.b
    def line(self, inst, bar, beat, seq, vel=80, legato=0.96, tr=0):
        """seq: [(pitch | None, beats), ...] played from (bar, beat)."""
        t = self.t(bar, beat)
        for p, d in seq:
            if p is not None:
                for q in (p if isinstance(p, (list, tuple)) else [p]): note(inst, n(q) + tr, t, d * self.b * legato, vel)
            t += d * self.b
    def pad(self, inst, bar, chords, vel=64, beats=4, legato=1.0):
        for i, c in enumerate(chords): chord(inst, c, self.t(bar, i * beats), beats * self.b * legato, vel)
    def arp(self, inst, bar, pitches, vel=60, div=2, beats=4, beat=0.0, updown=True):
        seq = list(pitches) + (list(pitches[-2:0:-1]) if updown else [])
        steps = int(beats * div)
        for i in range(steps): note(inst, seq[i % len(seq)], self.t(bar, beat + i / div), self.b / div * 1.6, vel - (0 if i % div == 0 else 8))
    def roll(self, pitch, bar, beat, beats, v0, v1, inst='timp', rate=11.0):
        t0 = self.t(bar, beat); k = max(1, int(beats * self.b * rate))
        for i in range(k): note(inst, pitch, t0 + i / rate, 0.12, v0 + (v1 - v0) * i / k)
    def drum(self, key, bar, beat, vel=90): note('drums', key, self.t(bar, beat), 0.2, vel)

KICK, SNARE, CRASH, RIDEBELL, TRI, TAMB, CRASH2 = 36, 38, 49, 53, 81, 54, 57

# ----------------------------------------------------------------------------- set-up
for inst, ch in CH.items():
    if inst != 'drums': program(inst, PROG[inst], 0)
    cc(inst, 7, VOL[inst], 0); cc(inst, 10, PAN.get(inst, 64), 0); cc(inst, 11, 100, 0); cc(inst, 91, 70, 0)

# The theme (D major). A, A', B as (pitch, beats).
ODE_A  = [('F#4', 1), ('F#4', 1), ('G4', 1), ('A4', 1), ('A4', 1), ('G4', 1), ('F#4', 1), ('E4', 1), ('D4', 1), ('D4', 1), ('E4', 1), ('F#4', 1), ('F#4', 1.5), ('E4', .5), ('E4', 2)]
ODE_A2 = ODE_A[:12] + [('E4', 1.5), ('D4', .5), ('D4', 2)]
ODE_B  = [('E4', 1), ('E4', 1), ('F#4', 1), ('D4', 1), ('E4', 1), ('F#4', .5), ('G4', .5), ('F#4', 1), ('D4', 1), ('E4', 1), ('F#4', .5), ('G4', .5), ('F#4', 1), ('E4', 1), ('D4', 1), ('E4', 1), ('A3', 1), ('F#4', 1)]
# harmony, two chords per bar: (bass, [chord tones])
D, A, G, Bm, Em, A7, E7 = ('D2', ['D3', 'F#3', 'A3', 'D4']), ('A2', ['E3', 'A3', 'C#4', 'E4']), ('G2', ['D3', 'G3', 'B3', 'D4']), ('B2', ['D3', 'F#3', 'B3', 'D4']), ('E2', ['E3', 'G3', 'B3', 'E4']), ('A2', ['E3', 'G3', 'A3', 'C#4']), ('E2', ['E3', 'G#3', 'B3', 'D4'])
Df = ('F#2', ['D3', 'F#3', 'A3', 'D4'])
H_A  = [D, Df, A, A, D, Df, D, A]
H_A2 = [D, Df, A, A, D, Df, A7, D]
H_B  = [A, D, A, D, A, E7, A, A7]

# ============================================================================= I · Greece — a question, over a held D
S = Sect('greece')
swell('vln', S.t(0), S.t(5), 34, 92); swell('low', S.t(0), S.t(5), 40, 96); swell('bass', S.t(0), S.t(5), 50, 100)
note('bass', 'D1', S.t(0), 20 * S.b, 62); note('bass', 'D2', S.t(0), 20 * S.b, 58)
note('low', 'A2', S.t(0, 2), 18 * S.b, 52)
G1 = [['A3', 'D4', 'E4', 'A4'], ['G3', 'B3', 'D4', 'G4'], ['F#3', 'B3', 'D4', 'F#4'], ['G3', 'B3', 'D4', 'G4']]
S.pad('vln', 0, G1, 54)
chord('vln', ['A3', 'D4', 'E4', 'A4'], S.t(4), 2 * S.b, 58); chord('vln', ['A3', 'C#4', 'E4', 'A4'], S.t(4, 2), 2 * S.b, 64)
for i, c in enumerate([['D3', 'A3', 'D4', 'F#4', 'A4'], ['G3', 'B3', 'D4', 'G4', 'B4'], ['B2', 'F#3', 'B3', 'D4', 'F#4'], ['G3', 'B3', 'D4', 'G4', 'B4'], ['A2', 'E3', 'A3', 'C#4', 'E4']]):
    S.arp('harp', i, c, 56)
# the question: three rising notes, left hanging
S.line('horn', 0, 2, [('F#4', 1), ('G4', 1), ('A4', 3)], 74)
S.line('reed', 2, 0, [('F#5', 1), ('G5', 1), ('A5', 2)], 64)
S.line('flute', 3, 1, [('D5', 1), ('E5', 1), ('F#5', 1), ('E5', 3.6)], 70)
S.line('horn', 4, 0, [('A3', 2), ('C#4', 2)], 62)
S.roll('A2', 4, 2, 2, 30, 74)

# ============================================================================= II · Rome — the same notes, now a march
S = Sect('rome')
cc('vln', 11, 96, S.t(0)); cc('low', 11, 100, S.t(0)); cc('bass', 11, 104, S.t(0))
S.drum(CRASH, 0, 0, 62)
R_H = [('D2', ['A3', 'D4', 'F#4', 'A4']), ('C#2', ['A3', 'C#4', 'E4', 'A4']), ('B1', ['F#3', 'B3', 'D4', 'F#4']), ('G1', ['G3', 'B3', 'D4', 'G4'])]
for i, (b, c) in enumerate(R_H):
    dur = 4 if i < 3 else 2
    chord('vln', c, S.t(i), dur * S.b, 70); chord('horn', c[:3], S.t(i), dur * S.b * 0.97, 66, 0)
    chord('tbn', [n(c[0]) - 12, n(c[1]) - 12], S.t(i), dur * S.b * 0.97, 62)
    note('bass', b, S.t(i), dur * S.b, 84); note('low', n(b) + 12, S.t(i), dur * S.b, 76)
    for bt in (0, 2): note('timp', 'D2' if i % 2 == 0 else 'A2', S.t(i, bt), 0.4, 84 if bt == 0 else 66)
chord('vln', ['A3', 'C#4', 'E4', 'A4'], S.t(3, 2), 2 * S.b, 76); chord('horn', ['A3', 'C#4', 'E4'], S.t(3, 2), 2 * S.b, 72)
chord('tbn', ['A2', 'E3'], S.t(3, 2), 2 * S.b, 66); note('bass', 'A1', S.t(3, 2), 2 * S.b, 86); note('low', 'A2', S.t(3, 2), 2 * S.b, 78)
S.line('trp', 0, 0, [('D4', 1.5), ('D4', .5), ('F#4', 1), ('A4', 1), ('A4', 2), ('G4', 1), ('E4', 1), ('F#4', 1.5), ('F#4', .5), ('B4', 1), ('A4', 1), ('G4', 1), ('A4', 1), ('B4', 1), ('C#5', 1)], 82, 0.9)
S.roll('A2', 3, 2, 2, 50, 92)

# ============================================================================= III · Cathedral — voices and organ
S = Sect('faith')
F_H = [('B1', ['B2', 'F#3', 'B3', 'D4', 'F#4']), ('G1', ['G2', 'G3', 'B3', 'D4', 'G4']), ('F#1', ['F#2', 'A3', 'D4', 'F#4', 'A4']), ('E1', ['E2', 'G3', 'B3', 'E4', 'G4'])]
swell('choir', S.t(0), S.t(0, 2), 60, 104); swell('vln', S.t(0), S.t(0, 1), 60, 70)
for i, (b, c) in enumerate(F_H):
    dur = 4 if i < 3 else 2
    chord('choir', c, S.t(i), dur * S.b, 72); chord('organ', [b] + c[:3], S.t(i), dur * S.b, 58)
    note('bass', n(b) + 12, S.t(i), dur * S.b, 66)
    chord('vln', ['D5', 'F#5'] if i != 1 else ['D5', 'G5'], S.t(i), dur * S.b, 44)
chord('choir', ['A2', 'A3', 'C#4', 'E4', 'A4'], S.t(3, 2), 2 * S.b, 80); chord('organ', ['A1', 'A2', 'E3', 'A3', 'C#4'], S.t(3, 2), 2 * S.b, 64); note('bass', 'A1', S.t(3, 2), 2 * S.b, 74)
chord('vln', ['E5', 'A5'], S.t(3, 2), 2 * S.b, 52)
program('bell', 14, S.t(0) - 0.05)  # tubular bells
for bar, p in ((0, 'B3'), (1, 'D4'), (2, 'F#4'), (3, 'E4')): note('bell', p, S.t(bar), 3.0, 78)
S.line('flute', 0, 0, [('F#5', 2), ('E5', 1), ('F#5', 1), ('G5', 2), ('F#5', 1), ('D5', 1), ('A5', 2), ('F#5', 1), ('A5', 1), ('B5', 2), ('A5', 1), ('C#6', 1)], 52)
swell('choir', S.t(3), S.t(4), 104, 122); S.roll('A2', 3, 2, 2, 40, 86)

# ============================================================================= IV · Renaissance — the tune begins to form
S = Sect('renaissance')
program('bell', 8, S.t(0) - 0.05)  # celesta
cc('choir', 11, 100, S.t(0)); cc('vln', 11, 96, S.t(0))
S.drum(CRASH, 0, 0, 52)
RN = [('D2', ['D3', 'A3', 'D4', 'F#4', 'A4']), ('G2', ['G3', 'B3', 'D4', 'G4', 'B4']), ('E2', ['E3', 'G3', 'B3', 'E4', 'G4']), ('A2', ['A3', 'C#4', 'E4', 'G4', 'A4']), ('D2', ['D3', 'A3', 'D4', 'F#4', 'A4'])]
for i, (b, c) in enumerate(RN):
    S.arp('harp', i, c, 66, div=2)
    chord('low', c[:3], S.t(i), 4 * S.b, 54)
    for bt in (0, 2): note('pizz', b, S.t(i, bt), 0.5, 80); note('pizz', n(b) + 12, S.t(i, bt + 1), 0.5, 62)
    note('bass', b, S.t(i), 4 * S.b, 56)
MEL = [('F#4', 1), ('G4', 1), ('A4', 2), ('B4', 1), ('A4', 1), ('G4', 2), ('G4', 1), ('F#4', 1), ('E4', 1), ('F#4', 1), ('E4', 2), ('A4', 1), ('C#5', 1), ('D5', 3.5)]
S.line('vln', 0, 0, MEL, 76, tr=12); S.line('flute', 0, 0, MEL, 62, tr=12); S.line('reed', 0, 0, MEL, 50)
S.line('horn', 2, 0, [('B3', 4), ('C#4', 4), ('D4', 4)], 54)

# ============================================================================= V · Storm, then starlight
S = Sect('science')
program('vln', 44, S.t(0) - 0.05)  # tremolo strings
S.drum(CRASH, 0, 0, 88); S.roll('B1', 0, 0, 5, 96, 40)
swell('vln', S.t(0), S.t(1, 3), 118, 60)
chord('vln', ['B3', 'D4', 'F#4', 'B4'], S.t(0), 4 * S.b, 92); chord('vln', ['G3', 'B3', 'D4', 'G4'], S.t(1), 3 * S.b, 84)
note('bass', 'B1', S.t(0), 4 * S.b, 96); note('bass', 'G1', S.t(1), 3 * S.b, 88); note('low', 'B2', S.t(0), 4 * S.b, 88); note('low', 'G2', S.t(1), 3 * S.b, 80)
S.line('horn', 0, 0, [(['B3', 'F#3'], 1.5), ('D4', .5), ('F#4', 2), (['G3', 'D4'], 1.5), ('B3', .5), ('D4', 1.5)], 90)
S.line('tbn', 0, 0, [(['B2', 'F#2'], 4), (['G2', 'D3'], 3)], 84)
program('vln', 48, S.t(1, 3) - 0.02); cc('vln', 11, 84, S.t(1, 3))
# Galileo (from beat 7), Newton: a clear night
SC = [('D2', ['A3', 'D4', 'F#4', 'A4'], 1, 3, 1), ('G2', ['B3', 'D4', 'G4', 'B4'], 2, 0, 4), ('E2', ['B3', 'E4', 'G4', 'B4'], 3, 0, 4), ('A2', ['A3', 'D4', 'E4', 'A4'], 4, 0, 2), ('A2', ['A3', 'C#4', 'E4', 'G4'], 4, 2, 2)]
for b, c, bar, bt, dur in SC:
    chord('vln', c, S.t(bar, bt), dur * S.b, 58); note('bass', b, S.t(bar, bt), dur * S.b, 60); note('low', n(b) + 12, S.t(bar, bt), dur * S.b, 54)
for bar, c in ((2, ['D5', 'G5', 'B5', 'D6']), (3, ['E5', 'G5', 'B5', 'E6']), (4, ['E5', 'A5', 'C#6', 'E6'])):
    S.arp('bell', bar, c, 70, div=2)
S.arp('bell', 1, ['A5', 'D6', 'F#6'], 66, div=2, beats=1, beat=3, updown=False)
S.line('flute', 2, 0, [('B5', 2), ('A5', 1), ('G5', 1), ('G5', 2), ('F#5', 1), ('E5', 1), ('E5', 2), ('G5', 1.9)], 62)
S.line('reed', 3, 0, [('B4', 4), ('A4', 2), ('C#5', 2)], 52)
swell('vln', S.t(4), S.t(5), 84, 112)

# ============================================================================= VI · Liberty — drums and trumpets
S = Sect('liberty')
cc('vln', 11, 104, S.t(0)); S.drum(CRASH, 0, 0, 84)
LB = [('D2', ['D3', 'A3', 'D4', 'F#4', 'A4']), ('G2', ['G3', 'B3', 'D4', 'G4', 'B4']), ('A2', ['A3', 'C#4', 'E4', 'G4', 'A4'])]
for i, (b, c) in enumerate(LB):
    chord('vln', c, S.t(i), 4 * S.b, 80); chord('horn', c[1:4], S.t(i), 4 * S.b * 0.97, 72); chord('tbn', [c[0], c[1]], S.t(i), 4 * S.b * 0.97, 70)
    note('bass', b, S.t(i), 4 * S.b, 92); note('low', n(b) + 12, S.t(i), 4 * S.b, 84)
    for bt in (0, 1, 2, 3): note('timp', 'D2' if i == 0 else ('G2' if i == 1 else 'A2'), S.t(i, bt), 0.4, 92 if bt == 0 else 68)
    for k in range(16):  # field drum
        if k % 4 in (0, 3) or k >= 12: S.drum(SNARE, i, k / 4, 58 + (22 if k % 4 == 0 else 0) + (k - 12) * 5 * (k >= 12))
S.line('trp', 0, 0, [('D4', .75), ('D4', .25), ('D4', 1), ('F#4', 1), ('A4', 1), ('B4', 1.5), ('A4', .5), ('G4', 1), ('B4', 1), ('A4', 1), ('C#5', 1), ('E5', 1.9)], 96, 0.9)
S.line('trp', 0, 0, [('A3', .75), ('A3', .25), ('A3', 1), ('D4', 1), ('F#4', 1), ('G4', 1.5), ('G4', .5), ('D4', 1), ('G4', 1), ('E4', 1), ('A4', 1), ('C#5', 1.9)], 82, 0.9)
swell('vln', S.t(2), S.t(3), 104, 124); S.roll('A2', 2, 2, 2, 70, 112)
S.drum(CRASH, 2, 3.5, 70)

# ============================================================================= Beethoven — a piano no one else can hear, then the hall
S = Sect('beethoven')
for inst in ('vln', 'low', 'bass', 'horn', 'trp', 'choir', 'tbn'): cc(inst, 11, 104, S.t(0))
chord('piano', ['D1', 'D2'], S.t(0), 5 * S.b, 104); chord('piano', ['A2', 'D3'], S.t(0, 2), 3 * S.b, 62)
S.line('piano', 1, 0, ODE_A[:8], 82, 1.0)
S.line('piano', 1, 0, [(['D2', 'A2'], 2), (['F#2', 'D3'], 2), (['A2', 'E3'], 2), (['A1', 'A2'], 2)], 56, 1.0)
swell('low', S.t(2), S.t(3), 30, 110); chord('low', ['A2', 'E3', 'A3'], S.t(2), 4 * S.b, 60)  # the orchestra, imagined, rising
S.roll('A2', 2, 2, 2, 30, 104)
# the premiere: bars 3–4 of the phrase, tutti
S.drum(CRASH, 3, 0, 110); S.drum(KICK, 3, 0, 110)
PH = ODE_A[8:]
S.line('vln', 3, 0, PH, 112, tr=12); S.line('vln', 3, 0, PH, 104); S.line('trp', 3, 0, PH, 104); S.line('flute', 3, 0, PH, 90, tr=12); S.line('choir', 3, 0, PH, 110); S.line('choir', 3, 0, PH, 100, tr=12)
for k, (b, c) in enumerate([D, Df, D, A]):
    t0 = S.t(3, k * 2)
    chord('horn', c[1:], t0, 2 * S.b * 0.97, 96); chord('tbn', c[:2], t0, 2 * S.b * 0.97, 96); chord('choir', c, t0, 2 * S.b, 96); chord('organ', [b] + c, t0, 2 * S.b, 80)
    note('bass', b, t0, 2 * S.b, 112); note('bass', n(b) - 12, t0, 2 * S.b, 104); note('low', n(b) + 12, t0, 2 * S.b, 100)
    for j in range(4): note('timp', 'D2' if k != 3 else 'A2', t0 + j * S.b / 2, 0.3, 104 - 10 * (j % 2))
# ...and the chord he cannot hear rings on (the mix muffles this bar)
chord('vln', ['A3', 'C#4', 'E4', 'A4', 'E5'], S.t(5), 3.6 * S.b, 96); chord('choir', ['A2', 'E3', 'A3', 'C#4', 'E4'], S.t(5), 3.6 * S.b, 96); chord('horn', ['E3', 'A3', 'C#4'], S.t(5), 3.6 * S.b, 90)
note('bass', 'A1', S.t(5), 3.6 * S.b, 104); S.roll('A2', 5, 0, 3.4, 96, 60); S.drum(CRASH, 5, 0, 100)

# ============================================================================= VII · Industry — iron rhythm
S = Sect('industry')
for inst in ('vln', 'low', 'bass', 'horn', 'trp', 'choir', 'tbn'): cc(inst, 11, 108, S.t(0))
S.drum(CRASH, 0, 0, 104); S.drum(KICK, 0, 0, 116)
IN = [('D2', ['D3', 'A3', 'D4', 'F#4']), ('D2', ['D3', 'A3', 'D4', 'F#4']), ('G2', ['D3', 'G3', 'B3', 'D4']), ('G2', ['D3', 'G3', 'B3', 'D4']), ('B1', ['D3', 'F#3', 'B3', 'D4']), ('A1', ['E3', 'A3', 'C#4', 'E4'])]
for i, (b, c) in enumerate(IN):
    pat = [b, b, n(b) + 7, b, n(b) + 12, b, n(b) + 7, b]
    for k, p in enumerate(pat):
        note('low', p, S.t(i, k / 2), S.b * 0.3, 96 if k % 2 == 0 else 78); note('pizz', n(p) + 12, S.t(i, k / 2), 0.3, 84 if k % 2 == 0 else 66)
        note('bass', b, S.t(i, k / 2), S.b * 0.3, 92 if k % 4 == 0 else 70)
    chord('vln', c, S.t(i), 4 * S.b, 78)
    for bt in (0, 2): S.drum(KICK, i, bt, 104)
    for bt in (1, 3): S.drum(RIDEBELL, i, bt, 100); S.drum(SNARE, i, bt, 70)   # the anvil
    for k in range(8): S.drum(42, i, k / 2, 46)
    note('timp', b if n(b) >= n('D2') else n(b) + 12, S.t(i), 0.4, 96)
TH = [('D4', 1.5), ('E4', .5), ('F#4', 2), ('A4', 2), ('F#4', 1), ('D4', 1), ('G4', 1.5), ('A4', .5), ('B4', 2), ('D5', 2), ('B4', 2), ('F#4', 1), ('B4', 1), ('D5', 2), ('C#5', 1), ('E5', 1), ('A5', 1.9)]
S.line('horn', 0, 0, TH, 96, 0.92); S.line('tbn', 0, 0, TH, 92, 0.92, tr=-12); S.line('trp', 2, 0, TH[6:], 92, 0.92)
swell('vln', S.t(5), S.t(6), 108, 126); S.roll('A2', 5, 2, 2, 70, 116)

# ============================================================================= VIII · Acceleration — every bar a step higher, every cut a blow
S = Sect('acceleration')
AC = [('D', 'maj'), ('E', 'min'), ('F#', 'min'), ('G', 'maj'), ('A', 'maj'), ('Bb', 'maj'), ('C', 'maj')]
cuts, acc = [], 0
for s_ in [x for x in CUES['shots'] if x['section'] == 'acceleration']: cuts.append(round((s_['start'] - S.t0) / S.b, 3))
program('bell', 12, S.t(0) - 0.05)  # marimba
for i, (root, q) in enumerate(AC):
    r = n(root + '3'); third = r + (4 if q == 'maj' else 3); tri = [r, third, r + 7, r + 12]
    for k in range(16):
        p = tri[[0, 2, 1, 2, 3, 2, 1, 2][k % 8]]
        note('bell', p + 12, S.t(i, k / 4), S.b * 0.2, 86 if k % 4 == 0 else 66); note('pizz', p, S.t(i, k / 4), 0.2, 80 if k % 4 == 0 else 58)
    for k in range(8): note('low', r - 12 + (7 if k % 2 else 0), S.t(i, k / 2), S.b * 0.3, 96); note('bass', r - 24, S.t(i, k / 2), S.b * 0.3, 96)
    chord('vln', [p + 12 for p in tri], S.t(i), 4 * S.b, 84 + i * 4); chord('horn', tri[:3], S.t(i), 4 * S.b * 0.97, 78 + i * 3)
    for bt in range(4): S.drum(KICK, i, bt, 100); S.drum(SNARE, i, bt + 0.5, 66 + i * 4)
    for k in range(16): S.drum(42, i, k / 4, 40 + (k % 4 == 0) * 14)
    if i >= 5:
        for k in range(16): S.drum(SNARE, i, k / 4, 50 + (i - 5) * 20 + k * 2)
for cb in cuts:  # brass stabs on the picture cuts
    bar = int(cb // 4); root, q = AC[min(bar, 6)]; r = n(root + '4'); t0 = S.t0 + cb * S.b
    chord('trp', [r, r + (4 if q == 'maj' else 3), r + 7], t0, S.b * 0.8, 108); chord('tbn', [r - 24, r - 12], t0, S.b * 0.8, 108)
    note('timp', 'D2', t0, 0.4, 110); note('drums', CRASH if cb in (0, 9) else CRASH2, t0, 0.3, 100)
S.line('vln', 5, 0, [(p, .5) for p in ['Bb4', 'C5', 'D5', 'Eb5', 'F5', 'G5', 'A5', 'Bb5', 'C5', 'D5', 'E5', 'F5', 'G5', 'A5', 'B5', 'C6']], 104, 0.9, tr=0)
swell('vln', S.t(5), S.t(7), 100, 127); S.roll('C2', 6, 0, 4, 80, 124)

# ============================================================================= IX · The connected world — arrival, widening
S = Sect('connected')
program('bell', 9, S.t(0) - 0.05)  # glockenspiel
cc('vln', 11, 118, S.t(0)); S.drum(CRASH, 0, 0, 116); S.drum(KICK, 0, 0, 120)
CN = [('D2', ['D4', 'F#4', 'A4', 'D5']), ('C#2', ['C#4', 'E4', 'A4', 'C#5']), ('B1', ['B3', 'D4', 'F#4', 'B4']), ('G1', ['B3', 'D4', 'G4', 'B4']), ('F#1', ['D4', 'F#4', 'A4', 'D5']), ('G1', ['D4', 'G4', 'B4', 'D5']), ('A1', ['D4', 'E4', 'A4', 'D5']), ('A1', ['C#4', 'E4', 'A4', 'C#5'])]
for i, (b, c) in enumerate(CN):
    for k in range(16):
        p = c[[0, 1, 2, 3, 2, 1, 2, 3][k % 8]]
        note('harp', p, S.t(i, k / 4), S.b * 0.3, 80 if k % 4 == 0 else 62); note('bell', n(p) + 12, S.t(i, k / 4), 0.3, 64 if k % 2 == 0 else 0.1)
    chord('low', [n(p) - 12 for p in c[:3]], S.t(i), 4 * S.b, 84); chord('horn', [n(p) - 12 for p in c[:3]], S.t(i), 4 * S.b * 0.97, 78)
    for k in range(8): note('bass', b, S.t(i, k / 2), S.b * 0.4, 100 if k % 2 == 0 else 80); note('pizz', n(b) + 12, S.t(i, k / 2), 0.2, 74)
    S.drum(KICK, i, 0, 110); S.drum(KICK, i, 2, 96); note('timp', b if n(b) >= n('D2') else n(b) + 12, S.t(i), 0.4, 100)
    for k in range(8): S.drum(42, i, k / 2, 50)
S.line('vln', 0, 0, [('F#5', 4), ('E5', 4), ('D5', 4), ('B4', 2), ('D5', 2), ('A5', 4), ('B5', 4), ('A5', 4), ('A5', 2), ('C#6', 1.9)], 104)
S.line('vln', 0, 0, [('A4', 4), ('A4', 4), ('F#4', 4), ('G4', 4), ('D5', 4), ('D5', 4), ('D5', 4), ('E5', 3.9)], 90)
S.line('trp', 4, 0, [('A4', 3), ('D5', 1), ('B4', 3), ('D5', 1), ('E5', 4), ('E5', 2), ('A5', 1.9)], 94)
S.drum(CRASH, 4, 0, 104); swell('vln', S.t(6), S.t(8), 118, 127); S.roll('A2', 6, 0, 8, 60, 124)
for k in range(16): S.drum(SNARE, 7, k / 4, 50 + k * 4)

# ============================================================================= X · The next frontier — the tune at last, very quietly
S = Sect('ai')
program('bell', 8, S.t(0) - 0.05)  # celesta
program('reed', 71, S.t(0) - 0.05)  # clarinet
program('vln', 49, S.t(0) - 0.05)  # slow strings
for inst in ('vln', 'low', 'bass'): cc(inst, 11, 70, S.t(0))
swell('vln', S.t(0), S.t(8), 62, 96); swell('low', S.t(0), S.t(8), 62, 96)
note('bass', 'D2', S.t(0, 1), 31 * S.b, 54)
for k, (b, c) in enumerate(H_A + H_A2):
    t0 = S.t(0, k * 2 + (1 if k == 0 else 0)); dur = (2 if k else 1) * S.b
    chord('vln', [n(p) + 12 for p in c], t0, dur, 46); chord('harp', [b] + c, t0, dur, 54, strum=0.05)
    if k >= 8: note('low', b, t0, dur, 52)
S.line('bell', 0, 0, ODE_A, 78, 1.0, tr=12)
S.line('flute', 4, 0, ODE_A2, 70, 1.0, tr=12); S.line('reed', 4, 0, ODE_A2, 60, 1.0); S.line('bell', 4, 0, ODE_A2, 56, 1.0, tr=24)
S.roll('A2', 7, 2, 2, 24, 70)

# ============================================================================= FINALE · Ode to Joy
S = Sect('finale')
program('vln', 48, S.t(0) - 0.05); program('bell', 9, S.t(0) - 0.05)
THEME = [(ODE_A, H_A), (ODE_A2, H_A2), (ODE_B, H_B), (ODE_A2, H_A2)]
LEVEL = [0.62, 0.78, 0.9, 1.0]
for ph, (mel, harm) in enumerate(THEME):
    L, bar = LEVEL[ph], ph * 4
    v = lambda x: x * L
    for inst in ('vln', 'low', 'bass', 'horn', 'trp', 'choir', 'tbn'): cc(inst, 11, 127 * (0.72 + 0.28 * L), S.t(bar))
    # melody
    S.line('vln', bar, 0, mel, v(112), tr=12); S.line('vln', bar, 0, mel, v(100)); S.line('flute', bar, 0, mel, v(92), tr=12); S.line('reed', bar, 0, mel, v(78))
    S.line('choir', bar, 0, mel, v(104), 1.0)
    if ph >= 1: S.line('trp', bar, 0, mel, v(100), 0.94); S.line('choir', bar, 0, mel, v(104), 1.0, tr=12)
    if ph == 3: S.line('bell', bar, 0, mel, 96, tr=24); S.line('vln', bar, 0, mel, 108, tr=24)
    # harmony and bass
    for k, (b, c) in enumerate(harm):
        t0 = S.t(bar, k * 2); dur = 2 * S.b
        chord('low', c, t0, dur, v(84)); chord('horn', c[1:], t0, dur * 0.97, v(84)); chord('choir', c, t0, dur, v(86))
        if ph >= 2: chord('tbn', c[:2], t0, dur * 0.97, v(96)); chord('organ', [b] + c, t0, dur, v(84))
        note('bass', b, t0, dur, v(104)); note('bass', n(b) - 12, t0, dur, v(92))
        if ph == 0: note('pizz', b, t0, 0.4, 70); note('pizz', n(b) + 12, t0 + S.b, 0.4, 56)
        else:
            for j in range(2): note('timp', 'A2' if b in ('A2', 'E2') else 'D2', t0 + j * S.b, 0.4, v(108) - 14 * j)
        if ph == 3:
            for j in range(4): note('timp', 'A2' if b in ('A2', 'E2') else 'D2', t0 + j * S.b / 2 + S.b / 4, 0.3, 84)
            S.arp('harp', bar + k // 2, [b] + c + [n(c[-1]) + 12], 84, div=4, beats=2, beat=(k % 2) * 2, updown=False)
    if ph >= 1: S.drum(CRASH, bar, 0, v(112)); S.drum(KICK, bar, 0, v(112))
    if ph == 3: S.drum(CRASH2, bar + 2, 0, 104)
# the pick-up into the last statement, and a crescendo roll
S.roll('A2', 11, 2, 2, 70, 124); swell('vln', S.t(11, 2), S.t(12), 114, 127)
S.roll('A2', 15, 2, 2, 90, 127)
# coda: IV — I, the whole orchestra and chorus on D major, left to ring
t0 = S.t(16); b = S.b
for inst in ('vln', 'low', 'bass', 'horn', 'trp', 'choir', 'tbn'): cc(inst, 11, 127, t0)
def tutti(t, dur, tones, bass_, top, vel=118):
    chord('vln', top, t, dur, vel); chord('low', tones, t, dur, vel - 10); chord('horn', tones[1:], t, dur, vel - 12); chord('tbn', tones[:2], t, dur, vel - 6)
    chord('trp', top[:3], t, dur, vel - 6); chord('choir', tones + top[:2], t, dur, vel); chord('organ', [bass_] + tones, t, dur, vel - 24)
    note('bass', bass_, t, dur, vel); note('bass', n(bass_) - 12, t, dur, vel)
tutti(t0, 3 * b, ['G3', 'B3', 'D4', 'G4'], 'G2', ['B4', 'D5', 'G5', 'B5']); S.drum(CRASH, 16, 0, 118); S.drum(KICK, 16, 0, 118); S.roll('G2', 16, 0, 3, 100, 118)
t1 = t0 + 3 * b; hold = 3.3
tutti(t1, hold, ['D3', 'F#3', 'A3', 'D4'], 'D2', ['F#4', 'A4', 'D5', 'F#5', 'A5', 'D6'], 124)
note('drums', CRASH, t1, 0.4, 124); note('drums', CRASH2, t1, 0.4, 110); note('drums', KICK, t1, 0.3, 124)
k = int(hold * 12)
for i in range(k): note('timp', 'D2', t1 + i / 12, 0.12, 120 - 40 * (i / k) ** 2)
note('bell', 'D6', t1, 2.5, 100); note('bell', 'A5', t1, 2.5, 90)
chord('harp', ['D2', 'A2', 'D3', 'F#3', 'A3', 'D4', 'F#4', 'A4', 'D5', 'F#5', 'A5', 'D6'], t1, 3.0, 100, strum=0.035)
for inst in ('vln', 'low', 'horn', 'choir', 'organ', 'bass', 'trp', 'tbn'): swell(inst, t1 + hold - 1.4, t1 + hold, 127, 70)

# ----------------------------------------------------------------------------- write + render
TPQ = 960  # at 60 BPM a quarter note is one second: ticks = seconds * TPQ
mid = mido.MidiFile(ticks_per_beat=TPQ); tr = mido.MidiTrack(); mid.tracks.append(tr)
tr.append(mido.MetaMessage('set_tempo', tempo=1_000_000, time=0))
tr.append(mido.MetaMessage('track_name', name='ODE - score', time=0))
last = 0
for t, _, msg in sorted(events, key=lambda e: (round(e[0] * TPQ), e[1])):
    tick = round(t * TPQ); tr.append(msg.copy(time=tick - last)); last = tick
tr.append(mido.MetaMessage('end_of_track', time=TPQ * 4))
mid.save(BUILD / 'score.mid')
print(f'score.mid: {len(events)} events, {last / TPQ:.1f} s (picture: {CUES["duration"]:.1f} s)')

if '--midi-only' not in sys.argv:
    wav = BUILD / 'score.wav'
    cmd = ['fluidsynth', '-ni', '-F', str(wav), '-r', '48000', '-g', '0.3',
           '-o', 'synth.polyphony=512', '-o', 'synth.reverb.active=1', '-o', 'synth.reverb.room-size=0.82', '-o', 'synth.reverb.level=0.75',
           '-o', 'synth.reverb.damp=0.25', '-o', 'synth.reverb.width=1.0', '-o', 'synth.chorus.active=0', SOUNDFONT, str(BUILD / 'score.mid')]
    subprocess.run(cmd, check=True, stdout=subprocess.DEVNULL)
    print('rendered', wav)
