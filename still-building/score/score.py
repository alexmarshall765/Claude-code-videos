#!/usr/bin/env python3
"""STILL BUILDING — the score.

An original orchestral cue written as code and rendered offline: a small sampler
plays the Sonatina Symphonic Orchestra samples (strings, brass, winds, choir,
harp, percussion), a few synthesized layers add sound design (sea, anvil, launch
rumble, sub hits), and everything goes through a hall reverb and a mastering chain.

Every time in this file comes from src/timeline.js, the same file the picture is
cut from, so a downbeat and a cut are literally the same number.

    python3 score/score.py                 # -> out/score.wav  (48 kHz / 24-bit stereo)
    SSO_DIR=/path/to/Samples python3 score/score.py

Samples: https://github.com/peastman/sso  (Creative Commons Sampling Plus 1.0).
The closing hymn is "Materna" (Samuel A. Ward, 1882), public domain.
"""
import glob
import json
import os
import re
import sys

import numpy as np
import soundfile as sf
from scipy import ndimage, signal

SR = 48000
HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)
SSO = os.environ.get('SSO_DIR') or next((p for p in [
    os.path.join(ROOT, 'sso', 'Sonatina Symphonic Orchestra', 'Samples'),
    os.path.expanduser('~/peastman/sso/Sonatina Symphonic Orchestra/Samples'),
    '/home/user/peastman/sso/Sonatina Symphonic Orchestra/Samples'] if os.path.isdir(p)), None)
if not SSO:
    sys.exit('Sonatina Symphonic Orchestra samples not found.\n'
             '  git clone --depth 1 https://github.com/peastman/sso\n'
             '  SSO_DIR="sso/Sonatina Symphonic Orchestra/Samples" python3 score/score.py')
RNG = np.random.default_rng(1776)

# --------------------------------------------------------------------------- timeline
_src = open(os.path.join(ROOT, 'src', 'timeline.js')).read()
_src = _src[_src.index('window.TIMELINE'):]
TL = json.loads(_src[_src.index('{'):_src.rindex('}') + 1])
SEC, SHOT = {}, {}
_t = 0.0
for sid, bpm, bars in TL['sections']:
    SEC[sid] = dict(t0=_t, bar=240.0 / bpm, beat=60.0 / bpm, bars=bars)
    _t += bars * 240.0 / bpm
TOTAL = _t
for sh in TL['shots']:
    s = SEC[sh[1]]
    SHOT[sh[0]] = (s['t0'] + sh[2] * s['bar'], sh[3] * s['bar'])


def T(sec, bar=0.0, beat=0.0):
    """Section + bar + beat -> seconds."""
    s = SEC[sec]
    return s['t0'] + bar * s['bar'] + beat * s['beat']


# --------------------------------------------------------------------------- pitch
PC = {'C': 0, 'D': 2, 'E': 4, 'F': 5, 'G': 7, 'A': 9, 'B': 11}


def pitch(name):
    m = re.match(r'^([A-Ga-g])([#b]?)(-?\d)$', name)
    return 12 * (int(m[3]) + 1) + PC[m[1].upper()] + {'#': 1, 'b': -1, '': 0}[m[2]]


QUAL = {'': [0, 4, 7], 'm': [0, 3, 7], '5': [0, 7], 'sus4': [0, 5, 7], 'sus2': [0, 2, 7], '7': [0, 4, 7, 10],
        'maj7': [0, 4, 7, 11], 'm7': [0, 3, 7, 10], 'add9': [0, 2, 4, 7], '7sus4': [0, 5, 7, 10], '6': [0, 4, 7, 9]}


def chord(sym):
    """'D/F#' -> (pitch classes, root pc, bass pc)."""
    top, _, bass = sym.partition('/')
    m = re.match(r'^([A-G][#b]?)(.*)$', top)
    root = (PC[m[1][0]] + {'#': 1, 'b': -1}.get(m[1][1:], 0)) % 12
    pcs = [(root + i) % 12 for i in QUAL[m[2]]]
    b = (PC[bass[0]] + {'#': 1, 'b': -1}.get(bass[1:], 0)) % 12 if bass else root
    return pcs, root, b


def nearest(pcs, centre, avoid=()):
    best = None
    for n in range(centre - 11, centre + 12):
        if n % 12 in pcs and n not in avoid and (best is None or abs(n - centre) < abs(best - centre)):
            best = n
    return best


# --------------------------------------------------------------------------- sampler
_cache = {}


def load(path):
    if path not in _cache:
        d, sr = sf.read(path, dtype='float32', always_2d=True)
        if d.shape[1] == 1:
            d = np.repeat(d, 2, axis=1)
        _cache[path] = (d, sr)
    return _cache[path]


def resample(d, ratio):
    n = int(len(d) / ratio)
    idx = np.arange(n) * ratio
    return np.stack([np.interp(idx, np.arange(len(d)), d[:, c]) for c in (0, 1)], axis=1).astype(np.float32)


class Inst:
    """A sampled instrument: the nearest sample is repitched to the note asked for."""

    def __init__(self, folder, patterns, octave=0, gain=1.0, att=0.0, rel=0.3, sustain=False):
        self.layers = []
        for pat in ([patterns] if isinstance(patterns, str) else patterns):
            m = []
            for f in sorted(glob.glob(os.path.join(SSO, folder, pat))):
                hit = re.findall(r'-([a-g]#?-?\d)(?=[-.])', os.path.basename(f).lower())
                if hit:
                    m.append((pitch(hit[-1][0].upper() + hit[-1][1:]) + 12 * octave, f))
            if not m:
                raise SystemExit(f'no samples for {folder}/{pat}')
            self.layers.append(sorted(m))
        self.gain, self.att, self.rel, self.sustain, self.rr, self.memo = gain, att, rel, sustain, 0, {}

    def note(self, midi, dur, vel=0.8, expr=None, att=None, rel=None):
        layer = self.layers[self.rr % len(self.layers)]
        self.rr += 1
        base, path = min(layer, key=lambda e: abs(e[0] - midi))
        key = (path, midi)
        if key not in self.memo:
            d, sr = load(path)
            self.memo[key] = resample(d, 2 ** ((midi - base) / 12) * sr / SR)
        x = self.memo[key]
        rel = self.rel if rel is None else rel
        att = self.att if att is None else att
        n = int((dur + rel) * SR)
        if self.sustain:
            x = extend(x, n)
        x = x[:n].copy()
        n = len(x)
        e = np.ones(n, dtype=np.float32)
        a = min(int(att * SR), n)
        if a > 1:
            e[:a] = 0.5 - 0.5 * np.cos(np.pi * np.arange(a) / a)
        r = min(int(rel * SR), n)
        if r > 1:
            e[-r:] *= 0.5 + 0.5 * np.cos(np.pi * np.arange(r) / r)
        if expr is not None:
            xs = np.linspace(0, 1, len(expr))
            e *= np.interp(np.linspace(0, 1, n), xs, expr).astype(np.float32)
        return x * e[:, None] * (self.gain * vel ** 1.6)


def extend(x, need):
    """Hold a sustained sample past its length by cross-fading a loop from its middle."""
    n = len(x)
    if need <= n - int(0.2 * SR):
        return x
    a = int(min(0.9 * SR, n * 0.3))
    b = n - int(min(1.2 * SR, n * 0.33))
    xf = int(min(0.45 * SR, (b - a) * 0.45))
    seg = x[a:b]
    fi = np.sqrt(np.linspace(0, 1, xf, dtype=np.float32))[:, None]
    fo = np.sqrt(np.linspace(1, 0, xf, dtype=np.float32))[:, None]
    parts, total = [x[:b - xf]], b - xf
    tail = x[b - xf:b]
    while total < need + xf:
        parts.append(tail * fo + seg[:xf] * fi)
        parts.append(seg[xf:-xf])
        tail = seg[-xf:]
        total += len(seg) - xf
    parts.append(tail)
    return np.concatenate(parts)


N = int((TOTAL + 4.0) * SR)
BUS = {k: np.zeros((N, 2), dtype=np.float32) for k in ('strings', 'brass', 'winds', 'choir', 'perc', 'keys', 'sfx', 'sub')}


def put(bus, t, x, gain=1.0, pan=0.0):
    i = int(round(t * SR))
    if i < 0:
        x, i = x[-i:], 0
    x = x[:max(0, N - i)]
    if not len(x):
        return
    if pan:
        x = x * np.array([min(1, 1 - pan), min(1, 1 + pan)], dtype=np.float32)
    BUS[bus][i:i + len(x)] += x * gain


S = dict(sustain=True)
I = dict(
    v1=Inst('1st Violins', '1st-violins-sus-*', gain=0.5, att=0.07, rel=0.4, **S),
    v2=Inst('2nd Violins', '2nd-violins-sus-*', gain=0.45, att=0.07, rel=0.4, **S),
    va=Inst('Violas', 'violas-sus-*', gain=0.5, att=0.08, rel=0.4, **S),
    vc=Inst('Celli', 'celli-sus-*', gain=0.55, att=0.08, rel=0.45, **S),
    cb=Inst('Basses', 'basses-sus-*', gain=0.6, att=0.09, rel=0.5, **S),
    v1s=Inst('1st Violins', ['1st-violins-stc-rr1-*', '1st-violins-stc-rr2-*'], gain=0.55, rel=0.2),
    v2s=Inst('2nd Violins', ['2nd-violins-stc-rr1-*', '2nd-violins-stc-rr2-*'], gain=0.5, rel=0.2),
    vas=Inst('Violas', ['violas-stc-rr1-*', 'violas-stc-rr2-*'], gain=0.55, rel=0.2),
    vcs=Inst('Celli', ['celli-stc-rr1-*', 'celli-stc-rr2-*'], gain=0.62, rel=0.2),
    cbs=Inst('Basses', ['basses-stc-rr1-*', 'basses-stc-rr2-*'], gain=0.7, rel=0.2),
    v1t=Inst('1st Violins', '1st-violins-trm-*', gain=0.45, att=0.1, rel=0.4, **S),
    vat=Inst('Violas', 'violas-trm-*', gain=0.45, att=0.1, rel=0.4, **S),
    vcp=Inst('Celli', ['celli-piz-rr1-*', 'celli-piz-rr2-*'], gain=0.6, rel=0.3),
    cbp=Inst('Basses', ['basses-piz-rr1-*', 'basses-piz-rr2-*'], gain=0.7, rel=0.3),
    hn=Inst('Horns', 'horns-sus-ff-*', gain=0.5, att=0.05, rel=0.35, **S),
    hnp=Inst('Horns', 'horns-sus-mp-*', gain=0.6, att=0.07, rel=0.4, **S),
    hns=Inst('Horns', ['horns-stc-rr1-*', 'horns-stc-rr2-*'], gain=0.55, rel=0.2),
    tp=Inst('Trumpets', 'trumpets-sus-*', gain=0.4, att=0.04, rel=0.3, **S),
    tps=Inst('Trumpets', ['trumpets-stc-rr1-*', 'trumpets-stc-rr2-*'], gain=0.42, rel=0.2),
    tb=Inst('Trombones', 'trombones-sus-*', gain=0.5, att=0.05, rel=0.35, **S),
    tbs=Inst('Trombones', ['trombones-stc-rr1-*', 'trombones-stc-rr2-*'], gain=0.5, rel=0.2),
    tu=Inst('Tuba', 'tuba-sus-*', gain=0.55, att=0.05, rel=0.35, **S),
    fl=Inst('Flutes', 'flutes-sus-*', gain=0.4, att=0.05, rel=0.3, **S),
    chf=Inst('Chorus', 'chorus-female-*', gain=0.5, att=0.25, rel=0.9, **S),
    chm=Inst('Chorus', 'chorus-male-*', gain=0.5, att=0.25, rel=0.9, **S),
    harp=Inst('Harp', 'harp-*', gain=0.7, rel=1.2),
    glock=Inst('Percussion', 'glockenspiel-*', gain=0.3, rel=1.5),
    chimes=Inst('Percussion', 'chimes-*', gain=0.55, rel=3.0),
    timp=Inst('Percussion', ['timpani-f-rh-*', 'timpani-f-lh-*'], octave=1, gain=0.8, rel=1.5),
    timpp=Inst('Percussion', ['timpani-p-rh-*', 'timpani-p-lh-*'], octave=1, gain=0.8, rel=1.5),
    timpr=Inst('Percussion', 'timpani-roll-crsc-*', octave=1, gain=0.8, rel=0.3),
)
BUSOF = dict(v1='strings', v2='strings', va='strings', vc='strings', cb='strings', v1s='strings', v2s='strings', vas='strings',
             vcs='strings', cbs='strings', v1t='strings', vat='strings', vcp='strings', cbp='strings', hn='brass', hnp='brass',
             hns='brass', tp='brass', tps='brass', tb='brass', tbs='brass', tu='brass', fl='winds', chf='choir', chm='choir',
             harp='keys', glock='keys', chimes='perc', timp='perc', timpp='perc', timpr='perc')
RANGE = dict(v1=(55, 98), v2=(55, 91), va=(48, 84), vc=(36, 72), cb=(26, 55), hn=(41, 77), hnp=(41, 77), tp=(55, 84), tb=(40, 72),
             tu=(29, 58), fl=(60, 96), chf=(55, 84), chm=(43, 67))


def play(inst, midi, t, dur, vel=0.8, expr=None, gain=1.0, human=0.012, pan=0.0, **kw):
    lo, hi = RANGE.get(inst, (0, 127))
    while midi < lo:
        midi += 12
    while midi > hi:
        midi -= 12
    x = I[inst].note(midi, dur, vel * (1 + RNG.uniform(-0.06, 0.06)), expr, **kw)
    put(BUSOF[inst], t + RNG.uniform(-human, human), x, gain, pan)


MELODY, HARMONY = 1.1, 0.84          # balance: the tune sits forward of the chords under it


def seq(insts, sec, bar, notes, vel=0.8, octave=0, legato=1.0, beat=0.0, expr=None, cresc=None, **kw):
    """Melodic line. notes: 'D4:1.5 E4:.5 F#4+A4:2 r:1' (pitch:beats, + for dyads)."""
    insts = [insts] if isinstance(insts, str) else insts
    toks = [x for x in notes.split() if x != '|']
    total = sum(float(x.partition(':')[2] or 1) for x in toks)
    t, b, pos = T(sec, bar, beat), SEC[sec]['beat'], 0.0
    for tok in toks:
        name, _, d = tok.partition(':')
        d = float(d or 1)
        v = vel if cresc is None else vel + (cresc - vel) * pos / max(total, 1e-6)
        if name != 'r':
            for nm in name.split('+'):
                for k, inst in enumerate(insts):
                    o = octave[k] if isinstance(octave, (list, tuple)) else octave
                    play(inst, pitch(nm) + 12 * o, t, d * b * legato + 0.05, v * MELODY, expr, **kw)
        t += d * b
        pos += d


def pad(sec, bar, chords, voices, vel=0.6, expr=None, cresc=None, beat=0.0, **kw):
    """Sustained harmony. chords: [(beats, 'D/F#'), ...]; voices: [(inst, centre midi, role)], role = bass|any."""
    t, b = T(sec, bar, beat), SEC[sec]['beat']
    total, pos = sum(c[0] for c in chords), 0.0
    for beats, sym in chords:
        pcs, root, bass = chord(sym)
        used = []
        v = vel if cresc is None else vel + (cresc - vel) * pos / total
        for inst, centre, role in voices:
            n = nearest([bass], centre) if role == 'bass' else nearest(pcs, centre, used)
            used.append(n)
            play(inst, n, t, beats * b + 0.12, v * HARMONY, expr, **kw)
        t += beats * b
        pos += beats


def ost(inst, sec, bar, chords, pattern, centre, vel=0.7, div=2, degrees=None, cresc=None, **kw):
    """Staccato ostinato. pattern: accent per subdivision (0 = rest), repeated; degrees index chord tones."""
    t, b = T(sec, bar), SEC[sec]['beat']
    total, k, pos = sum(c[0] for c in chords), 0, 0.0
    for beats, sym in chords:
        pcs, root, bass = chord(sym)
        tones = sorted(n for n in range(centre - 7, centre + 13) if n % 12 in pcs)
        for i in range(int(round(beats * div))):
            acc = pattern[k % len(pattern)]
            if acc:
                d = degrees[k % len(degrees)] if degrees else 0
                v = vel if cresc is None else vel + (cresc - vel) * pos / total
                play(inst, tones[d % len(tones)], t + i * b / div, 0.12, v * acc, human=0.006, **kw)
            k += 1
            pos += 1.0 / div
        t += beats * b


def one(name, t, gain=1.0, rate=1.0, reverse=False, bus='perc', fade=None, pan=0.0, end=False):
    d, sr = load(os.path.join(SSO, 'Percussion', name))
    x = resample(d, rate * sr / SR)
    if reverse:
        x = x[::-1]
    if fade:
        n = min(len(x), int(fade * SR))
        x = x[:n] * np.linspace(1, 0, n, dtype=np.float32)[:, None] ** 2 if not reverse else x[-n:] * np.linspace(0, 1, n, dtype=np.float32)[:, None] ** 1.5
    put(bus, t - (len(x) / SR if (reverse or end) else 0), x, gain, pan)


# --------------------------------------------------------------------------- synthesis
def env_ad(n, a, d):
    t = np.arange(n) / SR
    return (np.minimum(1, t / max(a, 1e-4)) * np.exp(-np.maximum(0, t - a) / d)).astype(np.float32)


def noise(dur, lo=None, hi=None, order=2):
    x = RNG.standard_normal((int(dur * SR), 2)).astype(np.float32)
    if lo and hi:
        sos = signal.butter(order, [lo, hi], 'bandpass', fs=SR, output='sos')
    elif hi:
        sos = signal.butter(order, hi, 'lowpass', fs=SR, output='sos')
    elif lo:
        sos = signal.butter(order, lo, 'highpass', fs=SR, output='sos')
    else:
        return x
    return signal.sosfilt(sos, x, axis=0).astype(np.float32)


def boom(t, gain=1.0, f0=74, f1=34, dur=1.8):
    """Sub hit: a falling sine with a soft clip, plus the concert bass drum."""
    n = int(dur * SR)
    tt = np.arange(n) / SR
    f = f1 + (f0 - f1) * np.exp(-tt * 5)
    x = np.tanh(np.sin(2 * np.pi * np.cumsum(f) / SR) * 1.8) * np.exp(-tt * 2.6)
    put('sub', t, np.stack([x, x], 1).astype(np.float32), 0.5 * gain)
    one('bass_drum-f.wav', t, 0.9 * gain)


def riser(t_end, dur=2.2, gain=1.0):
    """Reverse cymbal and a rising band of noise that end exactly on the cut."""
    one('piatti.wav', t_end, 0.5 * gain, reverse=True, fade=dur)
    n = int(dur * SR)
    x = noise(dur, 400, 9000)
    u = np.linspace(0, 1, n, dtype=np.float32)
    k = signal.sosfilt(signal.butter(2, 2500, 'highpass', fs=SR, output='sos'), x, axis=0)
    y = (x * (1 - u[:, None]) + k * u[:, None]) * (u[:, None] ** 2.6)
    put('sfx', t_end - dur, y.astype(np.float32), 0.07 * gain)


def whoosh(t, gain=1.0, dur=0.5):
    n = int(dur * SR)
    u = np.linspace(0, 1, n, dtype=np.float32)
    x = noise(dur, 300, 7000) * (np.sin(np.pi * u) ** 2)[:, None]
    put('sfx', t - dur * 0.55, x, 0.09 * gain)


def anvil(t, gain=1.0, f0=830.0):
    n = int(0.9 * SR)
    tt = np.arange(n) / SR
    x = sum(a * np.sin(2 * np.pi * f0 * r * tt + p) * np.exp(-tt / d) for r, a, d, p in
            [(1, 1, 0.22, 0), (2.76, 0.7, 0.16, 1), (5.4, 0.5, 0.1, 2), (8.93, 0.35, 0.06, 3), (1.51, 0.4, 0.2, 4)])
    x = x + RNG.standard_normal(n) * np.exp(-tt / 0.006) * 1.5
    put('sfx', t, np.stack([x, x * 0.9], 1).astype(np.float32), 0.085 * gain, pan=RNG.uniform(-0.3, 0.3))


def bed(t0, dur, x, gain, fi=1.0, fo=1.0):
    n = len(x)
    e = np.ones(n, dtype=np.float32)
    a, b = min(n, int(fi * SR)), min(n, int(fo * SR))
    e[:a] = np.linspace(0, 1, a) ** 1.5
    e[-b:] *= np.linspace(1, 0, b) ** 1.5
    put('sfx', t0, x * e[:, None], gain)


def sea(t0, dur, gain=1.0, fi=2.0, fo=2.0):
    n = int(dur * SR)
    tt = np.arange(n) / SR
    x = noise(dur, 180, 2600)
    swell = 0.55 + 0.45 * np.sin(2 * np.pi * tt / 5.3 + 1) * np.sin(2 * np.pi * tt / 3.1)
    bed(t0, dur, x * swell[:, None].astype(np.float32), 0.05 * gain, fi, fo)


def rumble(t0, dur, gain=1.0, fi=0.4, fo=0.8, crackle=True):
    n = int(dur * SR)
    x = noise(dur, 22, 170, 3) * 5.0
    if crackle:
        g = (RNG.random(n) > 0.9992).astype(np.float32)
        gate = signal.lfilter([1], [1, -0.9985], g)[:, None]
        x = x + noise(dur, 700, 5200) * np.minimum(gate, 2.5) * 0.5 + noise(dur, 250, 1800) * 0.35
    bed(t0, dur, x.astype(np.float32), 0.085 * gain, fi, fo)


def drone(t0, dur, gain=1.0):
    n = int(dur * SR)
    tt = np.arange(n) / SR
    x = np.zeros(n)
    for f in (84.0, 85.1, 86.6, 127.2, 169.0, 171.3):
        x += signal.sawtooth(2 * np.pi * f * tt + RNG.uniform(0, 6))
    x = signal.sosfilt(signal.butter(2, 520, 'lowpass', fs=SR, output='sos'), x)
    bed(t0, dur, np.stack([x, np.roll(x, 211)], 1).astype(np.float32), 0.014 * gain, 2.2, 1.6)


def crowd(t0, dur, gain=1.0, fi=0.6, fo=1.5):
    n = int(dur * SR)
    tt = np.arange(n) / SR
    x = np.zeros((n, 2), dtype=np.float32)
    for f in (520, 760, 1100, 1500, 2100, 2900):
        m = 0.6 + 0.4 * np.sin(2 * np.pi * tt * RNG.uniform(0.2, 0.7) + RNG.uniform(0, 6))
        x += noise(dur, f * 0.82, f * 1.2) * m[:, None].astype(np.float32)
    bed(t0, dur, x, 0.02 * gain, fi, fo)


def tone(t, f, dur, gain, a=0.01, bus='sfx', pan=0.0):
    n = int(dur * SR)
    tt = np.arange(n) / SR
    e = np.minimum(1, tt / a) * np.minimum(1, (dur - tt) / 0.02)
    x = (np.sin(2 * np.pi * f * tt) * e).astype(np.float32)
    put(bus, t, np.stack([x, x], 1), gain, pan)


# --------------------------------------------------------------------------- voicings
STR = [('cb', 38, 'bass'), ('vc', 50, 'bass'), ('va', 57, 'any'), ('v2', 64, 'any'), ('v1', 71, 'any')]
STR_HI = [('cb', 38, 'bass'), ('vc', 50, 'any'), ('va', 60, 'any'), ('v2', 69, 'any'), ('v1', 76, 'any')]
LOW = [('cb', 38, 'bass'), ('vc', 45, 'bass')]
BRASS = [('tu', 38, 'bass'), ('tb', 50, 'bass'), ('tb', 57, 'any'), ('hn', 60, 'any'), ('hn', 64, 'any')]
CHOIR = [('chm', 50, 'bass'), ('chm', 57, 'any'), ('chf', 64, 'any'), ('chf', 69, 'any')]
SWELL = [0.35, 0.7, 1.0, 0.85]
ARCH = [0.5, 0.9, 1.0, 0.8, 0.55]


def timp(sec, bar, beat, note, vel=0.8, soft=False):
    play('timpp' if soft else 'timp', pitch(note), T(sec, bar, beat), 1.2, vel, human=0.004)


def timp_roll(t_end, note, gain=1.0):
    """Crescendo roll that peaks on t_end."""
    x = I['timpr'].note(pitch(note), 4.4, 0.9, rel=0.25)
    put('perc', t_end - len(x) / SR + 0.2, x, gain)


# =========================================================================== THE CUE
# ---- I. DAWN  (60 bpm, D major) ----------------------------------------------------
sea(0, T('dawn', 4) + 1.5, 1.0, fi=3.0, fo=3.0)
pad('dawn', 0, [(8, 'D5')], LOW, 0.34, expr=[0.2, 0.7, 1, 1])
pad('dawn', 0.5, [(6, 'D5')], [('v1', 81, 'any'), ('v2', 74, 'any')], 0.24, expr=[0.0, 0.6, 1, 0.8], att=1.8)
seq('harp', 'dawn', 0, 'r:2 D3:1 A3:1 | D4:1 F#4:1 A4:1 D5:1', 0.5)
seq('hnp', 'dawn', 1, 'D4:1.5 E4:.5 F#4:1 A4:1 | B4:2 A4:1 F#4:1', 0.62, expr=ARCH)                 # the theme, far off
pad('dawn', 2, [(2, 'G'), (2, 'D/F#'), (2, 'Em7'), (2, 'G')], STR, 0.42, cresc=0.6, expr=ARCH)       # ships
seq(['v1', 'hnp'], 'dawn', 3, 'G4:1.5 A4:.5 B4:1 D5:1', 0.6, octave=[0, -1], expr=ARCH)
seq('harp', 'dawn', 2, 'G2:1 D3:1 G3:1 B3:1 | E3:1 B3:1 E4:1 G4:1', 0.5)
riser(T('dawn', 4), 2.4, 0.5)
pad('dawn', 4, [(2, 'Asus4'), (2, 'A')], STR_HI, 0.66, expr=[0.7, 1, 1, 0.75])                        # 1776
pad('dawn', 4, [(2, 'Asus4'), (2, 'A')], BRASS[1:], 0.45, expr=[0.5, 1, 0.9, 0.6])
seq(['v1', 'hn'], 'dawn', 4, 'A4:4', 0.66, octave=[1, 0], expr=[0.7, 1, 0.9, 0.7])
timp('dawn', 4, 0, 'A2', 0.6)
boom(T('dawn', 4), 0.45)
pad('dawn', 5, [(2, 'Bm'), (2, 'G')], STR[:4], 0.42, expr=ARCH)                                       # the quill
seq(['vc', 'va'], 'dawn', 5, 'D4:1.5 C#4:.5 B3:1 A3:1', 0.6, octave=[0, 0], expr=ARCH)
seq('harp', 'dawn', 5, 'B2:.5 F#3:.5 B3:.5 D4:.5 F#4:.5 D4:.5 B3:.5 F#3:.5 | G2:.5 D3:.5 G3:.5 B3:.5', 0.5)
timp_roll(T('dawn', 6), 'D3', 0.5)
for b, v in ((0, 1.0), (2, 0.8)):                                                                     # the bell, then the flag
    play('chimes', pitch('D4'), T('dawn', 6, b), 3.5, 0.9 * v)
    play('chimes', pitch('A3'), T('dawn', 6, b), 3.5, 0.7 * v)
    one('tamtam-a.wav', T('dawn', 6, b), 0.12 * v, rate=1.5)
pad('dawn', 6, [(2, 'G'), (1, 'Em7'), (1, 'A7sus4')], STR_HI, 0.56, cresc=0.8)
seq(['v1', 'v2'], 'dawn', 6, 'B4:2 G4:1 E4:1', 0.62, octave=[1, 0], cresc=0.8)
pad('dawn', 6, [(4, 'A5')], [('v1t', 76, 'any'), ('vat', 64, 'any')], 0.4, expr=[0.2, 0.5, 1])
timp_roll(T('dawn', 7), 'A2', 0.9)
riser(T('dawn', 7), 2.8, 0.9)
# Liberty: the theme, full
boom(T('dawn', 7), 0.8)
one('piatti.wav', T('dawn', 7), 0.55)
timp('dawn', 7, 0, 'D3', 0.9)
pad('dawn', 7, [(4, 'D'), (2, 'G'), (2, 'Asus4')], STR_HI, 0.82, expr=[1, 0.9, 0.95, 1])
pad('dawn', 7, [(4, 'D'), (2, 'G'), (2, 'Asus4')], BRASS, 0.62, expr=[1, 0.8, 0.9, 1])
seq(['v1', 'hn', 'tp'], 'dawn', 7, 'D5:1.5 E5:.5 F#5:1 A5:1 | B5:2 A5:1 F#5:1', 0.84, octave=[0, -1, -1])
pad('dawn', 7, [(4, 'D'), (2, 'G'), (2, 'A')], CHOIR, 0.5, expr=[0.6, 1, 1, 0.9])
timp('dawn', 8, 0, 'G2', 0.7)
timp('dawn', 8, 2, 'A2', 0.8)
riser(T('west', 0), 2.0, 0.7)

# ---- II. WESTWARD  (88 bpm) --------------------------------------------------------
W1 = [(4, 'D'), (2, 'G'), (2, 'D/F#'), (2, 'Em7'), (2, 'G'), (2, 'Asus4'), (2, 'A')]
W2 = [(4, 'D'), (2, 'G'), (2, 'D/F#'), (2, 'Em7'), (2, 'A'), (2, 'Bm'), (2, 'F#m/A'), (2, 'G'), (2, 'Em7'), (2, 'D/A'), (2, 'A')]
GALLOP = [1, 0, 0.6, 0.8]
one('piatti.wav', T('west', 0), 0.35)
timp('west', 0, 0, 'D3', 0.7)
ost('vas', 'west', 0, W1, GALLOP, 57, 0.62, degrees=[0, 0, 1, 2], cresc=0.8)
ost('vcs', 'west', 0, W1, GALLOP, 45, 0.66, degrees=[0, 0, 2, 1], cresc=0.85)
for bar in range(4):
    for bt in (0, 2):
        pcs, root, bass = chord([c for c in (['D', 'D'], ['G', 'D/F#'], ['Em7', 'G'], ['Asus4', 'A'])][bar][bt // 2])
        play('cbp', nearest([bass], 38), T('west', bar, bt), 0.4, 0.75)
pad('west', 0, W1, [('hnp', 57, 'any'), ('hnp', 62, 'any')], 0.4, cresc=0.62)
seq(['v1', 'fl'], 'west', 0, 'D4:1.5 E4:.5 F#4:1 A4:1 | B4:2 A4:1 F#4:1 | G4:1.5 A4:.5 B4:1 D5:1 | A4:4', 0.66, octave=[1, 1], cresc=0.85)
seq('v2', 'west', 0, 'D4:1.5 E4:.5 F#4:1 A4:1 | B4:2 A4:1 F#4:1 | G4:1.5 A4:.5 B4:1 D5:1 | A4:4', 0.55, cresc=0.75)
pad('west', 3, [(4, 'A5')], [('v1t', 81, 'any'), ('vat', 69, 'any')], 0.4, expr=[0.3, 0.6, 1])        # the swing
timp_roll(T('west', 4), 'A2', 1.0)
riser(T('west', 4), 2.2, 1.0)
# the last spike
anvil(T('west', 4), 2.4, 640)
anvil(T('west', 4) + 0.012, 1.4, 1270)
boom(T('west', 4), 1.0)
one('piatti.wav', T('west', 4), 0.6)
timp('west', 4, 0, 'D3', 1.0)
crowd(T('west', 4) + 0.2, 2.6, 0.8)
ost('vas', 'west', 4, W2, GALLOP, 57, 0.8, degrees=[0, 0, 1, 2])
ost('vcs', 'west', 4, W2, GALLOP, 45, 0.85, degrees=[0, 0, 2, 1])
ost('cbs', 'west', 4, W2, [1, 0, 0, 0], 38, 0.8)
pad('west', 4, W2, BRASS, 0.56, expr=[0.9, 1])
pad('west', 4, W2, [('v2', 66, 'any')], 0.55)
seq(['v1', 'tp', 'hn'], 'west', 4, 'D5:1.5 E5:.5 F#5:1 A5:1 | B5:2 A5:1 F#5:1 | G5:1.5 A5:.5 B5:1 D6:1 | D6:1.5 C#6:.5 B5:1 A5:1 | B5:2 G5:1 E5:1 | F#5:1.5 G5:.5 A5:2',
    0.84, octave=[0, -1, -1])
seq('fl', 'west', 4, 'D5:1.5 E5:.5 F#5:1 A5:1 | B5:2 A5:1 F#5:1 | G5:1.5 A5:.5 B5:1 D6:1 | D6:1.5 C#6:.5 B5:1 A5:1 | B5:2 G5:1 E5:1 | F#5:1.5 G5:.5 A5:2', 0.6, octave=1)
for bar, n in ((5, 'G2'), (6, 'E3'), (7, 'B2'), (8, 'G2'), (9, 'A2')):
    timp('west', bar, 0, n, 0.75)
# the train: whistle and exhaust
ts = SHOT['rails'][0]
def whistle(t, dur, gain, pan=0.0):
    """Three-chime steam whistle: a slight scoop up to pitch, breath noise riding on top."""
    n = int(dur * SR)
    tt = np.arange(n) / SR
    glide = 1 - 0.05 * np.exp(-tt / 0.07)
    x = np.zeros(n)
    for f in (311.1, 370.0, 466.2):
        ph = 2 * np.pi * np.cumsum(f * glide) / SR
        x += np.sin(ph) + 0.35 * np.sin(2 * ph) + 0.18 * np.sin(3 * ph)
    e = np.minimum(1, tt / 0.07) * np.minimum(1, (dur - tt) / 0.22) * (1 + 0.06 * np.sin(2 * np.pi * 9 * tt))
    y = np.stack([x, x], 1) * 0.3 + noise(dur, 900, 3600) * 0.5
    put('sfx', t, (y * e[:, None]).astype(np.float32), gain, pan)


whistle(ts + 0.25, 1.0, 0.03, -0.3)
whistle(ts + 1.45, 0.55, 0.026, -0.2)
for i in range(22):
    x = noise(0.16, 500, 2400) * env_ad(int(0.16 * SR), 0.004, 0.05)[:, None]
    put('sfx', ts + i * SEC['west']['beat'] / 2, x, 0.035 * (1 if i % 4 == 0 else 0.6), pan=-0.6 + i * 0.05)
timp_roll(T('industry', 0), 'A2', 0.9)
riser(T('industry', 0), 2.4, 1.0)

# ---- III. INDUSTRY  (104 bpm, B minor) ---------------------------------------------
IND = [(4, 'Bm'), (4, 'Bm'), (4, 'G'), (4, 'Em'), (4, 'F#m')]
MACH = [1, 0.55, 0.7, 0.55]
boom(T('industry', 0), 1.0)
one('tamtam-a.wav', T('industry', 0), 0.4)
ost('vcs', 'industry', 0, IND, MACH, 47, 0.82)
ost('cbs', 'industry', 0, IND, [1, 0, 0.7, 0], 35, 0.85)
ost('vas', 'industry', 0, IND, [0.9, 0.6, 0.9, 0.6], 59, 0.66, div=4, degrees=[0, 1, 2, 1])
pad('industry', 0, IND, [('tu', 35, 'bass'), ('tb', 47, 'bass'), ('tb', 54, 'any')], 0.6)
seq(['hn', 'tb'], 'industry', 0, 'B3:1.5 C#4:.5 D4:1 F#4:1 | E4:2 D4:1 B3:1 | G3:1.5 A3:.5 B3:1 D4:1 | E4:1.5 F#4:.5 G4:1 B4:1 | A4:2 F#4:2', 0.8, octave=[0, -1])
seq('v1', 'industry', 3, 'E5:1.5 F#5:.5 G5:1 B5:1 | A5:2 F#5:2', 0.7)
for bar in range(5):
    for bt in (1, 3):
        anvil(T('industry', bar, bt), 1.0 if bt == 1 else 0.8, 830 if bt == 1 else 990)
    timp('industry', bar, 0, ['B2', 'B2', 'G2', 'E3', 'F#2'][bar], 0.8)
    one('bass_drum-p.wav', T('industry', bar, 2), 0.7)
rumble(T('industry', 0), T('industry', 5) - T('industry', 0), 0.35, fi=0.2, fo=0.5, crackle=False)
# light: everything stops for one bar
for k, n in enumerate(('F#5', 'A5', 'D6', 'F#6', 'A6')):
    play('glock', pitch(n), T('industry', 5, 0.75 + k * 0.5), 1.5, 0.6)
    play('harp', pitch(n) - 12, T('industry', 5, 0.75 + k * 0.5), 1.5, 0.5)
pad('industry', 5, [(4, 'D')], [('v1t', 86, 'any'), ('v1t', 78, 'any'), ('vat', 69, 'any')], 0.36, expr=[0.1, 0.5, 1])
tone(T('industry', 5) + 0.3, 120, 2.0, 0.006, a=1.6)
riser(T('industry', 6), 1.6, 0.6)
one('piatti.wav', T('industry', 6), 0.35)
pad('industry', 6, [(2, 'D'), (2, 'A/C#')], STR_HI, 0.6, cresc=0.85)
pad('industry', 6, [(2, 'D'), (2, 'A/C#')], CHOIR, 0.42, expr=[0.5, 1])
seq(['hn', 'tp'], 'industry', 6, 'D4:1 E4:1 F#4:1 A4:1', 0.62, cresc=0.85)
for k in range(8):
    play('glock', pitch(['D6', 'A5', 'F#6', 'D6', 'E6', 'C#6', 'A6', 'E6'][k]), T('industry', 6, k * 0.5), 1.0, 0.5)
timp_roll(T('industry', 7), 'B2', 0.8)
# the line: faster
LINE = [(4, 'Bm'), (4, 'G'), (4, 'A'), (4, 'G'), (4, 'A')]
boom(T('industry', 7), 0.8)
ost('vcs', 'industry', 7, LINE, MACH, 47, 0.85, cresc=0.95)
ost('cbs', 'industry', 7, LINE, [1, 0, 0.7, 0], 35, 0.85)
ost('vas', 'industry', 7, LINE, [0.9, 0.6, 0.8, 0.6], 59, 0.7, div=4, degrees=[0, 1, 2, 1], cresc=0.85)
ost('v2s', 'industry', 7, LINE, [0.9, 0.6, 0.8, 0.6], 66, 0.66, div=4, degrees=[2, 1, 0, 1], cresc=0.85)
pad('industry', 7, LINE, BRASS, 0.6, cresc=0.8)
seq(['tp', 'v1'], 'industry', 7, 'B4:1.5 C#5:.5 D5:1 F#5:1 | E5:2 D5:1 B4:1 | C#5:1.5 D5:.5 E5:2 | D5:1.5 E5:.5 G5:1 B5:1 | A5:4', 0.82, octave=[0, 1], cresc=0.95)
seq('hn', 'industry', 7, 'B3:1.5 C#4:.5 D4:1 F#4:1 | E4:2 D4:1 B3:1 | C#4:1.5 D4:.5 E4:2 | D4:1.5 E4:.5 G4:1 B4:1 | A4:4', 0.8)
for bar in range(7, 12):
    for bt in (1, 3):
        anvil(T('industry', bar, bt), 0.9, 830 if bt == 1 else 990)
    for bt in (0, 2):
        timp('industry', bar, bt, ['B2', 'G2', 'A2', 'G2', 'A2'][bar - 7], 0.8)
one('piatti.wav', T('industry', 10), 0.45)
pad('industry', 10, [(4, 'G'), (4, 'A')], CHOIR, 0.5, cresc=0.75)
timp_roll(T('war', 0), 'A2', 1.0)
riser(T('war', 0), 2.6, 1.0)

# ---- IV. DEFENDING FREEDOM  (72 bpm) ------------------------------------------------
boom(T('war', 0), 0.9)
one('tamtam-a.wav', T('war', 0), 0.5, rate=0.8)
pad('war', 0, [(4, 'Bm'), (4, 'G')], STR, 0.5, expr=[0.9, 0.7, 0.8])
seq('tp', 'war', 0, 'F#4:3 B4:1 | A4:2 F#4:2', 0.5, expr=ARCH)                                        # a lone trumpet
for bar in (0, 1):
    for bt in (0, 1, 2, 3):
        one('bass_drum-p.wav', T('war', bar, bt), 0.5 if bt % 2 == 0 else 0.3)
    timp('war', bar, 0, ['B2', 'G2'][bar], 0.5, soft=True)
# the home front answers
ARS = [(4, 'D'), (4, 'A')]
ost('vcs', 'war', 2, ARS, MACH, 50, 0.7, cresc=0.85)
ost('vas', 'war', 2, ARS, [0.9, 0.6, 0.8, 0.6], 62, 0.6, div=4, degrees=[0, 1, 2, 1], cresc=0.8)
ost('cbs', 'war', 2, ARS, [1, 0, 0.7, 0], 38, 0.75)
pad('war', 2, ARS, BRASS, 0.5, cresc=0.72)
seq(['hn', 'v1'], 'war', 2, 'D4:1.5 E4:.5 F#4:1 A4:1 | C#5:2 B4:1 A4:1', 0.7, octave=[0, 1], cresc=0.85)
for bar in (2, 3):
    for bt in (1, 3):
        anvil(T('war', bar, bt), 0.7, 990)
    timp('war', bar, 0, ['D3', 'A2'][bar - 2], 0.7)
riser(T('war', 4), 1.8, 0.8)
# the fortresses
FOR = [(4, 'Em'), (4, 'G')]
boom(T('war', 4), 0.8)
drone(T('war', 4) - 0.5, SEC['war']['bar'] * 2 + 1.2, 1.0)
ost('vcs', 'war', 4, FOR, MACH, 52, 0.78)
ost('cbs', 'war', 4, FOR, [1, 0, 0.7, 0], 40, 0.8)
ost('vas', 'war', 4, FOR, [0.9, 0.6, 0.8, 0.6], 64, 0.62, div=4, degrees=[0, 1, 2, 1])
pad('war', 4, FOR, BRASS, 0.6)
pad('war', 4, FOR, [('v2', 67, 'any'), ('v1', 76, 'any')], 0.6)
seq(['hn', 'tp'], 'war', 4, 'E4:1.5 F#4:.5 G4:1 B4:1 | D5:3 B4:1', 0.84, octave=[0, 0])
for bar in (4, 5):
    for bt in (0, 2):
        timp('war', bar, bt, ['E3', 'G2'][bar - 4], 0.8)
# Normandy: hold the breath
sea(T('war', 6) - 0.6, SEC['war']['bar'] * 2 + 0.8, 1.5, fi=1.0, fo=1.2)
pad('war', 6, [(4, 'Bm'), (2, 'Em7/A'), (2, 'A7')], [('cb', 35, 'bass'), ('vc', 47, 'bass')], 0.42, expr=[0.8, 0.7, 1])
pad('war', 6, [(4, 'Bm'), (4, 'A')], [('v1', 90, 'any'), ('v2', 78, 'any')], 0.3, expr=[0.4, 0.8, 0.8, 1], att=1.0)
seq('hnp', 'war', 6, 'F#4:2 B4:2 | A4:1.5 G4:.5 E4:2', 0.6, expr=ARCH)
for bar in (6, 7):
    for bt in (0, 2):
        one('bass_drum-p.wav', T('war', bar, bt), 0.75)
        one('bass_drum-p.wav', T('war', bar, bt) + 0.26, 0.4)
pad('war', 7, [(4, 'A7')], [('v1t', 81, 'any'), ('vat', 67, 'any')], 0.42, expr=[0.1, 0.4, 1], beat=0)
timp_roll(T('war', 8), 'A2', 1.0)
riser(T('war', 8), 2.6, 1.1)
# victory
VIC = [(4, 'D'), (2, 'G'), (2, 'A')]
boom(T('war', 8), 1.0)
one('piatti.wav', T('war', 8), 0.7)
crowd(T('war', 8), SEC['war']['bar'] * 2, 1.3, fo=1.0)
pad('war', 8, VIC, STR_HI, 0.9)
pad('war', 8, VIC, BRASS, 0.72)
pad('war', 8, VIC, CHOIR, 0.6)
seq(['v1', 'tp', 'hn'], 'war', 8, 'D5:1.5 E5:.5 F#5:1 A5:1 | B5:2 A5:1 C#6:1', 0.9, octave=[0, -1, -1])
for bt, n in ((0, 'D4'), (2, 'A3'), (4, 'D4'), (6, 'F#4')):
    play('chimes', pitch(n), T('war', 8, bt), 3.0, 0.8)
for bar, bt, n in ((8, 0, 'D3'), (8, 2, 'D3'), (9, 0, 'G2'), (9, 2, 'A2'), (9, 3, 'A2')):
    timp('war', bar, bt, n, 0.85)
one('piatti.wav', T('war', 9, 2), 0.4)
riser(T('reach', 0), 1.6, 0.7)

# ---- V. REACH  (112 bpm) ------------------------------------------------------------
RCH = [(4, 'D'), (4, 'D/F#'), (4, 'G'), (4, 'A')]
PULSE = [1, 0.5, 0.7, 0.5]


def pulse_bass(sec, bar, chords, gain=1.0):
    """A soft synthetic pulse under the modern sections."""
    t, b = T(sec, bar), SEC[sec]['beat']
    for beats, sym in chords:
        f = 440 * 2 ** ((nearest([chord(sym)[2]], 38) - 69) / 12)
        for i in range(int(beats * 2)):
            n = int(b / 2 * SR)
            tt = np.arange(n) / SR
            x = (np.sin(2 * np.pi * f * tt) + 0.35 * np.sin(4 * np.pi * f * tt)) * np.exp(-tt * 7) * np.minimum(1, tt / 0.004)
            put('sub', t + i * b / 2, np.stack([x, x], 1).astype(np.float32), 0.11 * gain * (1 if i % 2 == 0 else 0.6))
        t += beats * b


def sparkle(sec, bar, chords, vel=0.5, centre=86):
    t, b, k = T(sec, bar), SEC[sec]['beat'], 0
    for beats, sym in chords:
        tones = sorted(n for n in range(centre - 8, centre + 9) if n % 12 in chord(sym)[0])
        for i in range(int(beats * 2)):
            play('glock', tones[[0, 2, 1, 3, 2, 1][k % 6] % len(tones)], t + i * b / 2, 0.8, vel * (1 if i % 2 == 0 else 0.7), human=0.004)
            play('harp', tones[[0, 2, 1, 3, 2, 1][k % 6] % len(tones)] - 12, t + i * b / 2, 0.8, vel, human=0.004)
            k += 1
        t += beats * b


boom(T('reach', 0), 0.7)
pulse_bass('reach', 0, RCH)
sparkle('reach', 0, RCH[:2], 0.5)
ost('vas', 'reach', 0, RCH, PULSE, 62, 0.62, div=4, degrees=[0, 1, 2, 1], cresc=0.78)
ost('v2s', 'reach', 0, RCH, PULSE, 69, 0.58, div=4, degrees=[2, 1, 0, 1], cresc=0.75)
ost('vcs', 'reach', 0, RCH, [1, 0, 0.6, 0.6], 50, 0.7, cresc=0.82)
pad('reach', 0, RCH, [('cb', 38, 'bass'), ('vc', 50, 'bass'), ('hnp', 62, 'any')], 0.5, cresc=0.66)
seq(['hn', 'v1'], 'reach', 0, 'F#4:3 A4:1 | D5:2 A4:2 | B4:1.5 A4:.5 G4:1 D5:1 | E5:4', 0.7, octave=[0, 1], cresc=0.85)
timp('reach', 2, 0, 'G2', 0.7)
timp('reach', 3, 0, 'A2', 0.75)
# the count
CNT = [(4, 'Bm'), (4, 'A/C#')]
pulse_bass('reach', 4, CNT, 1.2)
pad('reach', 4, CNT, STR, 0.5, cresc=0.9)
pad('reach', 4, [(8, 'Bm')], [('v1t', 83, 'any'), ('vat', 71, 'any')], 0.45, expr=[0.2, 0.5, 1])
pad('reach', 4, CNT, BRASS[:3], 0.4, cresc=0.8)
ost('vcs', 'reach', 4, CNT, [1, 0.6, 0.8, 0.6], 47, 0.7, div=4, cresc=1.0)
for i in range(8):                                                # a clock in the room
    one('wood_block-hi.wav', T('reach', 4, i), 0.3)
timp_roll(T('reach', 6), 'G2', 1.3)
riser(T('reach', 6), 3.2, 1.3)
one('snare-roll.wav', T('reach', 6), 0.18, end=True)
# ignition
IGN = [(4, 'G'), (4, 'A')]
ti = T('reach', 6)
boom(ti, 1.5, 90, 28, 2.6)
boom(ti + 0.02, 0.8, 60, 24, 3.2)
one('piatti.wav', ti, 0.85)
one('tamtam-a.wav', ti, 0.7, rate=0.7)
rumble(ti, T('earthrise', 0) - ti + 0.5, 1.5, fi=0.25, fo=1.1)
pad('reach', 6, IGN, STR_HI, 1.0)
pad('reach', 6, IGN, BRASS, 0.88)
pad('reach', 6, IGN, CHOIR, 0.7)
seq(['tp', 'v1', 'hn'], 'reach', 6, 'G4:1.5 A4:.5 B4:1 D5:1 | E5:1 F#5:1 A5:2', 0.95, octave=[0, 1, 0])
for bar in (6, 7):
    for bt in (0, 1, 2, 3):
        timp('reach', bar, bt, ['G2', 'A2'][bar - 6], 0.9 if bt % 2 == 0 else 0.6)
one('piatti.wav', T('reach', 7), 0.5)

# ---- EARTHRISE  (60 bpm): silence, then voices ---------------------------------------
te = T('earthrise', 0)
pad('earthrise', 0, [(4.5, 'Dadd9'), (1.5, 'G/B'), (2, 'Asus4')], [('chm', 50, 'bass'), ('chf', 62, 'any'), ('chf', 66, 'any'), ('chf', 69, 'any')], 0.52,
    expr=[0.0, 0.7, 1, 0.9, 0.7], att=1.2, beat=0.25)
pad('earthrise', 0, [(4.5, 'Dadd9'), (1.5, 'G/B'), (2, 'Asus4')], [('v1', 86, 'any'), ('v2', 78, 'any'), ('va', 66, 'any'), ('vc', 50, 'bass')], 0.34,
    expr=[0.0, 0.6, 1, 0.9, 0.8], att=1.5, beat=0.25)
seq('hnp', 'earthrise', 0, 'r:1 D4:1.5 E4:.5 F#4:1 | A4:1.5 B4:.5 A4:2', 0.6, expr=ARCH)                # the opening horn, answered
seq('harp', 'earthrise', 0, 'r:.5 D3:.5 A3:.5 D4:.5 F#4:.5 A4:.5 E5:1', 0.45)
tone(te + 0.35, 2525, 0.25, 0.012)
tone(SHOT['moon'][0] + 0.25, 2475, 0.25, 0.012)
bed(te + 0.2, 7.6, noise(7.6, 1800, 6000), 0.004, 0.5, 1.0)
riser(T('future', 0), 1.8, 0.6)

# ---- VI. THE FUTURE  (112 bpm) -------------------------------------------------------
FUT = [(4, 'Bm7'), (4, 'G'), (4, 'Em'), (2, 'G'), (2, 'A')]
pulse_bass('future', 0, FUT)
sparkle('future', 0, FUT[:2], 0.52)
ost('vas', 'future', 0, FUT, PULSE, 62, 0.62, div=4, degrees=[0, 1, 2, 1], cresc=0.85)
ost('v2s', 'future', 0, FUT, PULSE, 69, 0.58, div=4, degrees=[2, 1, 0, 1], cresc=0.82)
ost('vcs', 'future', 0, FUT, [1, 0, 0.6, 0.6], 47, 0.7, cresc=0.9)
pad('future', 0, FUT, [('cb', 35, 'bass'), ('vc', 47, 'bass'), ('hnp', 62, 'any')], 0.5, cresc=0.8)
seq(['hn', 'v1'], 'future', 0, 'D4:3 F#4:1 | B4:2 G4:2 | E4:1.5 F#4:.5 G4:1 B4:1 | D5:2 E5:2', 0.68, octave=[0, 1], cresc=0.9)
for i in range(32):                                               # machine chatter
    if RNG.random() < 0.7:
        tone(T('future', 0, i * 0.25), [1318, 1568, 1976, 2349, 2637][int(RNG.integers(5))], 0.05, 0.006, a=0.003, pan=RNG.uniform(-0.6, 0.6))
tb_ = SHOT['booster'][0]
for dt in (0.5, 0.64):                                            # the double sonic boom
    boom(tb_ + dt, 0.5, 110, 40, 0.5)
rumble(tb_ + 0.8, T('future', 4) - tb_ - 0.6, 0.8, fi=1.6, fo=0.25)
pad('future', 2, [(8, 'Em')], [('v1t', 83, 'any'), ('vat', 71, 'any')], 0.4, expr=[0.2, 0.5, 1])
timp_roll(T('future', 4), 'A2', 1.1)
riser(T('future', 4), 2.6, 1.1)
# touchdown
HOME = [(4, 'D'), (4, 'Bm'), (4, 'G'), (2, 'Asus4'), (2, 'A')]
boom(T('future', 4), 1.2)
one('piatti.wav', T('future', 4), 0.6)
crowd(T('future', 4) + 0.1, 3.0, 0.9)
pulse_bass('future', 4, HOME, 1.1)
sparkle('future', 5, HOME[1:3], 0.5)
ost('vas', 'future', 4, HOME, PULSE, 62, 0.72, div=4, degrees=[0, 1, 2, 1], cresc=0.9)
ost('v2s', 'future', 4, HOME, PULSE, 69, 0.68, div=4, degrees=[2, 1, 0, 1], cresc=0.9)
ost('vcs', 'future', 4, HOME, [1, 0.6, 0.8, 0.6], 50, 0.8, div=4, cresc=0.95)
pad('future', 4, HOME, BRASS, 0.62, cresc=0.9)
pad('future', 6, HOME[2:], CHOIR, 0.5, cresc=0.8)
seq(['v1', 'hn', 'tp'], 'future', 4, 'D5:1.5 E5:.5 F#5:1 A5:1 | B5:2 A5:1 F#5:1 | G5:1.5 A5:.5 B5:1 D6:1 | E6:2 C#6:1', 0.84, octave=[0, -1, -1], cresc=0.95)
for bar, n in ((4, 'D3'), (5, 'B2'), (6, 'G2'), (7, 'A2')):
    timp('future', bar, 0, n, 0.85)
    timp('future', bar, 2, n, 0.6)
timp_roll(T('finale', 0), 'A2', 1.2)
riser(T('finale', 0), 3.0, 1.2)

# ---- VII. FINALE  (76 bpm): "America! America!" — Materna, second half ----------------
FIN = [(2, 'D'), (1, 'A/C#'), (1, 'Bm'), (2, 'G'), (1, 'A'), (1, 'D/F#'), (1, 'Em7'), (1, 'A7'), (1, 'G'), (1, 'A7sus4'), (3, 'D'), (1, 'D/F#'),
       (2, 'G'), (1, 'G/B'), (1, 'E7/G#'), (2, 'D/A'), (2, 'A7'), (1, 'G'), (1, 'D/F#'), (1, 'D/A'), (1, 'A7'), (4, 'D')]
HYMN_A = 'F#5:1.5 F#5:.5 E5:1 D5:1 | D5:1.5 C#5:.5 C#5:1 D5:1 | E5:1 C#5:1 B4:1 A4:1 | D5:3'
HYMN_B = 'D5:1.5 B4:.5 B4:1 D5:1 | D5:1.5 A4:.5 A4:1 A4:1 | B4:1 D5:1 A4:1 E5:1 | D5:4'
tf = T('finale', 0)
pick = tf - SEC['future']['beat']                                 # pickup on the last beat before the bar line
for inst, o in (('v1', 0), ('hn', -1), ('tp', -1)):
    play(inst, pitch('A4') + 12 * o, pick, SEC['future']['beat'], 0.8)
boom(tf, 1.3)
one('piatti.wav', tf, 0.8)
pad('finale', 0, FIN, STR_HI, 0.92)
pad('finale', 0, FIN, BRASS, 0.74, expr=[0.85, 1])
pad('finale', 0, FIN, CHOIR, 0.66)
seq(['v1', 'hn'], 'finale', 0, HYMN_A, 0.92, octave=[0, -1])
seq('v2', 'finale', 0, HYMN_A, 0.8, octave=0)
seq('tp', 'finale', 2, 'E5:1 C#5:1 B4:1 A4:1 | D5:3', 0.8, octave=-1)
seq(['v1', 'hn', 'tp'], 'finale', 3, 'D5:1', 0.9, octave=[0, -1, -1], beat=3)
for bar in range(4):                                              # one hit per picture in the montage
    for bt in (0, 2):
        t = T('finale', bar, bt)
        whoosh(t, 1.0)
        if not (bar == 0 and bt == 0):
            boom(t, 0.55 if bt == 2 else 0.75)
        root = nearest([chord({0: 'D', 1: 'G', 2: 'Em7', 3: 'D'}[bar] if bt == 0 else {0: 'A', 1: 'A', 2: 'G', 3: 'D'}[bar])[1]], 45)
        play('timp', root, t, 1.2, 0.9)
one('piatti.wav', T('finale', 2), 0.45)
timp_roll(T('finale', 4), 'G2', 1.2)
riser(T('finale', 4), 2.2, 1.0)
# last phrase: everyone
boom(T('finale', 4), 1.2)
one('piatti.wav', T('finale', 4), 0.85)
one('tamtam-a.wav', T('finale', 4), 0.5)
seq(['v1', 'tp', 'hn', 'fl'], 'finale', 4, HYMN_B, 1.0, octave=[1, 0, -1, 1])
seq('v2', 'finale', 4, HYMN_B, 0.9)
seq('tb', 'finale', 4, 'G3:2 B3:1 G#3:1 | A3:2 A3:2 | G3:1 F#3:1 A3:1 A3:1 | D3:4', 0.85)
for bar, bt, n in ((4, 0, 'G2'), (4, 2, 'G2'), (5, 0, 'A2'), (5, 2, 'A2'), (6, 0, 'G2'), (6, 1, 'F#2'), (6, 2, 'A2'), (6, 3, 'A2'), (7, 0, 'D3'), (7, 2, 'D3')):
    timp('finale', bar, bt, n, 0.95)
for bar, n in ((4, 'D4'), (5, 'A3'), (6, 'D4'), (7, 'D4')):
    play('chimes', pitch(n), T('finale', bar), 3.0, 0.85)
timp_roll(T('finale', 7), 'A2', 1.2)
boom(T('finale', 7), 1.2)
one('piatti.wav', T('finale', 7), 0.9)

# ---- CODA: amen, a breath, the title ---------------------------------------------------
pad('coda', 0, [(2, 'G/D'), (2, 'D')], STR_HI, 0.85, expr=[1, 0.9, 0.7])
pad('coda', 0, [(2, 'G/D'), (2, 'D')], BRASS, 0.66, expr=[1, 0.85, 0.6])
pad('coda', 0, [(2, 'G/D'), (2, 'D')], CHOIR, 0.62, expr=[1, 0.9, 0.7])
seq(['v1', 'hn'], 'coda', 0, 'D5:2 D5:2', 0.85, octave=[0, -1])
timp('coda', 0, 0, 'D3', 0.8)
timp('coda', 0, 2, 'D3', 0.7)
pad('coda', 1, [(2, 'D5')], [('cb', 38, 'bass'), ('vc', 50, 'bass'), ('va', 57, 'any')], 0.4, expr=[0.8, 0.5, 0.6])
seq('hnp', 'coda', 1, 'D4:1 A4:1', 0.55)
timp_roll(T('coda', 1, 2), 'D3', 1.0)
riser(T('coda', 1, 2), 1.8, 0.9)
tz = T('coda', 1, 2)                                                 # STILL BUILDING
boom(tz, 1.5, 80, 30, 3.0)
one('piatti.wav', tz, 0.9)
one('tamtam-a.wav', tz, 0.6, rate=0.75)
END = [(8, 'D')]
FADE = [1, 0.95, 0.8, 0.6, 0.4, 0.22, 0.0]
pad('coda', 1, END, STR_HI, 1.0, expr=FADE, beat=2)
pad('coda', 1, END, BRASS, 0.85, expr=FADE, beat=2)
pad('coda', 1, END, CHOIR, 0.75, expr=FADE, beat=2)
pad('coda', 1, END, [('tp', 62, 'any'), ('tp', 69, 'any'), ('tp', 74, 'any'), ('v1', 86, 'any')], 0.85, expr=FADE, beat=2)
timp('coda', 1, 2, 'D3', 1.0)
timp('coda', 1, 2, 'D2', 0.9)
for n in ('D4', 'A4', 'D5'):
    play('chimes', pitch(n), tz, 5.0, 0.8)

# =========================================================================== MIX
def hall(seconds=2.9, seed=7):
    """Synthetic concert-hall impulse: decorrelated noise with a faster-decaying top end."""
    r = np.random.default_rng(seed)
    n = int(seconds * SR)
    t = np.arange(n) / SR
    ir = np.zeros((n, 2), dtype=np.float32)
    for lo, hi, rt in ((60, 400, 3.0), (400, 2000, 2.5), (2000, 6000, 1.7), (6000, 12000, 0.9)):
        x = r.standard_normal((n, 2))
        x = signal.sosfilt(signal.butter(2, [lo, hi], 'bandpass', fs=SR, output='sos'), x, axis=0)
        ir += (x * np.exp(-6.91 * t / rt)[:, None]).astype(np.float32)
    ir *= (1 - np.exp(-t / 0.018))[:, None]                        # soft onset: pre-delay
    for d, g in ((0.011, 0.5), (0.019, 0.4), (0.031, 0.32), (0.047, 0.25)):
        ir[int(d * SR), :] += g * np.array([1, r.uniform(0.6, 1)])
    return ir / np.sqrt((ir ** 2).sum())


print('mixing…', flush=True)
GAIN = dict(strings=1.0, brass=0.9, winds=0.8, choir=0.85, perc=0.95, keys=0.9, sfx=1.0, sub=0.7)
SEND = dict(strings=0.42, brass=0.5, winds=0.45, choir=0.6, perc=0.36, keys=0.45, sfx=0.22, sub=0.0)
dry = sum(BUS[k] * GAIN[k] for k in BUS)
wet_in = sum(BUS[k] * GAIN[k] * SEND[k] for k in BUS)
ir = hall()
wet = np.stack([signal.fftconvolve(wet_in[:, c], ir[:, c])[:N] for c in (0, 1)], 1).astype(np.float32)
mix = dry + wet * 1.25
mix = signal.sosfilt(signal.butter(2, 26, 'highpass', fs=SR, output='sos'), mix, axis=0)
mix = signal.sosfilt(signal.butter(1, 15000, 'lowpass', fs=SR, output='sos'), mix, axis=0)
# gentle air and warmth
hi = signal.sosfilt(signal.butter(1, 6500, 'highpass', fs=SR, output='sos'), mix, axis=0)
pres = signal.sosfilt(signal.butter(1, 2600, 'highpass', fs=SR, output='sos'), mix, axis=0)
mix = mix + pres * 0.4 + hi * 0.6

# glue: slow RMS compressor (2:1 above the knee), then a look-ahead limiter
mono = np.abs(mix).max(axis=1)
rms = np.sqrt(ndimage.uniform_filter1d(mix.mean(axis=1) ** 2, int(0.35 * SR)) + 1e-12)
ref = np.percentile(rms[rms > 1e-4], 88)
gr = np.where(rms > ref * 0.5, (rms / (ref * 0.5)) ** -0.42, 1.0)
gr = ndimage.uniform_filter1d(gr, int(0.25 * SR))
mix = mix * gr[:, None]
mix = mix / np.percentile(np.abs(mix).max(axis=1), 99.95) * 0.7
peak = ndimage.maximum_filter1d(np.abs(mix).max(axis=1), int(0.006 * SR))
lim = np.minimum(1.0, 0.89 / np.maximum(peak, 1e-9))
lim = ndimage.uniform_filter1d(ndimage.minimum_filter1d(lim, int(0.006 * SR)), int(0.004 * SR))
mix = mix * lim[:, None]

n_out = int(TOTAL * SR)
out = mix[:n_out].astype(np.float32)
fade = int(2.4 * SR)
out[-fade:] *= (np.linspace(1, 0, fade, dtype=np.float32) ** 1.6)[:, None]
out[:int(0.02 * SR)] *= np.linspace(0, 1, int(0.02 * SR), dtype=np.float32)[:, None]
os.makedirs(os.path.join(ROOT, 'out'), exist_ok=True)
dst = os.path.join(ROOT, 'out', 'score.wav')
sf.write(dst, out, SR, subtype='PCM_24')
print(f'wrote {dst}  {TOTAL:.2f}s  peak {np.abs(out).max():.3f}  rms {20 * np.log10(np.sqrt((out ** 2).mean())):.1f} dBFS')
