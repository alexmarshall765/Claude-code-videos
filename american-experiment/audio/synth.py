#!/usr/bin/env python3
"""Synthesize the score of THE AMERICAN EXPERIMENT from timeline.json and score.json.

    python3 audio/synth.py                 # audio/score.wav + audio/stems/*.wav
    python3 audio/synth.py --from 160 --to 184 --out /tmp/apollo.wav   (render a window)

Everything is generated from the same bar grid the picture reads: scenes and cues from
timeline.json, patterns, chords and layers from score.json. No samples, no network.
Output: 48 kHz, 24-bit stereo, exactly the timeline's length, mastered to about
-14 LUFS integrated with true peaks at or below -1 dBTP. Deterministic: every noise
source is seeded, so two runs are bit-identical.
"""
import argparse
import json
import math
import time
import wave
from pathlib import Path

import numpy as np
import pyloudnorm as pyln
from scipy import ndimage, signal

ROOT = Path(__file__).resolve().parent.parent
SR = 48000
STEMS = ["drums", "bass", "arps", "pads", "lead", "fx"]
UNIT_BEATS = {"32nd": 0.125, "16th": 0.25, "8th": 0.5, "beat": 1, "half": 2, "bar": 4}


# =============================================================================
# Timeline: the same rules as web/src/timeline.js
# =============================================================================
class Timeline:
    def __init__(self, j):
        self.j = j
        self.bpm = j["bpm"]
        self.beat = 60.0 / self.bpm
        self.bar = self.beat * j["beatsPerBar"]
        bar = 1
        self.scenes = []
        for sc in j["scenes"]:
            s = dict(sc)
            s["startBar"] = bar
            s["start"] = (bar - 1) * self.bar
            s["dur"] = sc["bars"] * self.bar
            s["end"] = s["start"] + s["dur"]
            bar += sc["bars"]
            self.scenes.append(s)
        self.total_bars = bar - 1
        self.duration = self.total_bars * self.bar
        self.by_id = {s["id"]: s for s in self.scenes}

    def time(self, addr, scene=None):
        if isinstance(addr, (int, float)):
            return float(addr)
        if addr == "end":
            return scene["end"]
        if addr == "start":
            return scene["start"]
        sc, a = scene, addr
        if "@" in addr:
            sid, a = addr.split("@")
            sc = self.by_id[sid]
        parts = [float(x) for x in a.split(".")]
        bar, beat = parts[0], parts[1]
        six = parts[2] if len(parts) > 2 else 1
        return sc["start"] + (bar - 1) * self.bar + (beat - 1) * self.beat + (six - 1) * self.beat / 4

    def hits(self, cue, scene):
        ats = cue["at"] if isinstance(cue["at"], list) else [cue["at"]]
        starts = []
        for a in ats:
            t = self.time(a, scene)
            if "every" in cue:
                step = UNIT_BEATS[cue["every"]] * self.beat
                starts += [t + k * step for k in range(cue["count"])]
            else:
                starts.append(t)
        out = []
        for t0 in starts:
            t1 = self.time(cue["to"], scene) if "to" in cue else t0 + cue.get("beats", 1) * self.beat
            out.append((t0, t1))
        return out


# =============================================================================
# DSP
# =============================================================================
def mtof(m):
    return 440.0 * 2 ** ((np.asarray(m, dtype=np.float64) - 69) / 12)


def db(x):
    return 10 ** (x / 20.0)


def tvec(n):
    return np.arange(n) / SR


def phase_of(freq, n):
    """Phase (cycles) of an oscillator with constant or per-sample frequency."""
    if np.isscalar(freq):
        return (np.arange(n) * (freq / SR)) % 1.0
    return np.cumsum(np.asarray(freq) / SR) % 1.0


def _blep(ph, dt):
    out = np.zeros_like(ph)
    m = ph < dt
    x = ph[m] / dt[m] if not np.isscalar(dt) else ph[m] / dt
    out[m] = x + x - x * x - 1
    m2 = ph > 1 - (dt if np.isscalar(dt) else dt)
    if not np.isscalar(dt):
        x = (ph[m2] - 1) / dt[m2]
    else:
        x = (ph[m2] - 1) / dt
    out[m2] = x * x + x + x + 1
    return out


def saw(freq, n, phase0=0.0):
    """Band-limited (PolyBLEP) sawtooth in [-1, 1]."""
    ph = (phase_of(freq, n) + phase0) % 1.0
    dt = (freq / SR) if np.isscalar(freq) else np.asarray(freq) / SR
    return 2 * ph - 1 - _blep(ph, dt)


def square(freq, n, phase0=0.0):
    ph = (phase_of(freq, n) + phase0) % 1.0
    dt = (freq / SR) if np.isscalar(freq) else np.asarray(freq) / SR
    sq = np.where(ph < 0.5, 1.0, -1.0)
    return sq + _blep(ph, dt) - _blep((ph + 0.5) % 1.0, dt)


def sine(freq, n, phase0=0.0):
    return np.sin(2 * np.pi * (phase_of(freq, n) + phase0))


def biquad_coef(kind, f0, q):
    f0 = min(max(f0, 10.0), SR * 0.45)
    w = 2 * np.pi * f0 / SR
    cw, sw = np.cos(w), np.sin(w)
    alpha = sw / (2 * q)
    if kind == "lp":
        b = [(1 - cw) / 2, 1 - cw, (1 - cw) / 2]
    elif kind == "hp":
        b = [(1 + cw) / 2, -(1 + cw), (1 + cw) / 2]
    elif kind == "bp":
        b = [alpha, 0, -alpha]
    else:
        raise ValueError(kind)
    a = [1 + alpha, -2 * cw, 1 - alpha]
    return np.array(b) / a[0], np.array(a) / a[0]


def filt(kind, f0, q, x):
    b, a = biquad_coef(kind, f0, q)
    return signal.lfilter(b, a, x, axis=-1)


def tv_filter(kind, x, cutoff, q=0.707, block=128):
    """Time-varying biquad: cutoff is per sample (array) or (start, end) for an exponential sweep."""
    n = x.shape[-1]
    if isinstance(cutoff, tuple):
        cutoff = np.geomspace(max(cutoff[0], 10), max(cutoff[1], 10), n)
    out = np.empty_like(x)
    zi = None
    for i in range(0, n, block):
        j = min(n, i + block)
        b, a = biquad_coef(kind, float(cutoff[i]), q)
        if zi is None:
            zi = np.zeros(x.shape[:-1] + (2,))
        out[..., i:j], zi = signal.lfilter(b, a, x[..., i:j], axis=-1, zi=zi)
    return out


def env_adsr(n, a=0.005, d=0.1, s=0.7, r=0.1, gate=None):
    """ADSR over n samples; the release starts at `gate` seconds (default: n minus release)."""
    t = tvec(n)
    g = (n / SR - r) if gate is None else gate
    e = np.where(t < a, t / max(a, 1e-6), s + (1 - s) * np.exp(-(t - a) / max(d, 1e-6)))
    rel = t > g
    if rel.any():
        level = np.interp(g, t, e)
        e[rel] = level * np.exp(-(t[rel] - g) / max(r / 4, 1e-6))
    return e


def fade_edges(x, a=0.002, r=0.004):
    n = x.shape[-1]
    na, nr = int(a * SR), int(r * SR)
    if na:
        x[..., :na] *= np.linspace(0, 1, na)
    if nr:
        x[..., n - nr:] *= np.linspace(1, 0, nr)
    return x


def pan2(mono, pan=0.0):
    """Constant-power pan, pan in [-1, 1]."""
    a = (pan + 1) * np.pi / 4
    return np.vstack([mono * np.cos(a), mono * np.sin(a)])


def stereo(x, width=0.0, pan=0.0):
    return x if x.ndim == 2 else pan2(x, pan)


def bitcrush(x, bits=6, hold=4):
    q = 2 ** (bits - 1)
    y = np.round(x * q) / q
    if hold > 1:
        y = np.repeat(y[::hold], hold)[: len(x)]
    return y


class Noise:
    """Seeded noise so every render is identical."""

    def __init__(self, seed):
        self.rng = np.random.default_rng(seed)

    def white(self, n):
        return self.rng.uniform(-1, 1, n)


def reverb_ir(seconds=3.2, seed=7, predelay=0.018):
    """Stereo exponential-decay noise impulse response; highs die faster than lows."""
    rng = np.random.default_rng(seed)
    n = int(seconds * SR)
    t = tvec(n)
    ir = np.zeros((2, n))
    for ch in range(2):
        nz = rng.standard_normal(n)
        lo = filt("lp", 2500, 0.7, nz) * np.exp(-t / (seconds / 6.9))
        hi = filt("hp", 2500, 0.7, nz) * np.exp(-t / (seconds / 13.0))
        ir[ch] = lo + 0.6 * hi
    pd = int(predelay * SR)
    ir = np.concatenate([np.zeros((2, pd)), ir[:, : n - pd]], axis=1)
    # A few early reflections
    for k, (dt, g) in enumerate([(0.011, 0.5), (0.019, 0.35), (0.027, 0.3), (0.041, 0.22)]):
        i = int(dt * SR)
        ir[k % 2, i] += g
    ir /= np.sqrt((ir ** 2).sum(axis=1, keepdims=True))
    return ir


# =============================================================================
# Instruments (mono unless noted). Durations in seconds.
# =============================================================================
class Kit:
    def __init__(self):
        self.nz = Noise(1776)

    # --- drums ---------------------------------------------------------------
    def kick(self, soft=False):
        n = int(0.65 * SR)
        t = tvec(n)
        f = 45 + 105 * np.exp(-t / (0.03 if not soft else 0.05))
        body = np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-t / (0.42 if not soft else 0.32))
        click = filt("hp", 1800, 0.7, self.nz.white(n)) * np.exp(-t / 0.004)
        x = body + (0.35 if not soft else 0.06) * click
        if soft:
            x = filt("lp", 160, 0.7, x) * 1.6
        x = np.tanh(1.6 * x) / np.tanh(1.6)
        return fade_edges(x, 0.0005, 0.02)

    def snare(self):
        n = int(0.45 * SR)
        t = tvec(n)
        tone = (np.sin(2 * np.pi * 174.6 * t) + 0.5 * np.sin(2 * np.pi * 293.7 * t)) * np.exp(-t / 0.07)
        nz = filt("bp", 3800, 0.6, self.nz.white(n)) * np.exp(-t / 0.15)
        return fade_edges(0.55 * tone + 0.9 * nz, 0.0005, 0.02)

    def clap(self):
        n = int(0.4 * SR)
        t = tvec(n)
        e = np.zeros(n)
        for k in range(3):
            i = int(k * 0.011 * SR)
            e[i:] += np.exp(-(t[: n - i]) / 0.006)
        e += 0.7 * np.exp(-t / 0.16) * (t > 0.022)
        x = filt("bp", 1500, 0.9, self.nz.white(n)) * e
        return fade_edges(x * 1.4, 0.0005, 0.02)

    def hat(self, open_=False):
        n = int((0.45 if open_ else 0.1) * SR)
        t = tvec(n)
        x = filt("hp", 7500, 0.7, self.nz.white(n))
        metal = sum(square(f, n) for f in (5100, 6800, 8300)) / 3
        x = (x + 0.25 * filt("hp", 6000, 0.7, metal)) * np.exp(-t / (0.22 if open_ else 0.032))
        return fade_edges(x, 0.0003, 0.01)

    def rim(self):
        n = int(0.08 * SR)
        t = tvec(n)
        x = filt("bp", 2600, 3.0, self.nz.white(n)) * np.exp(-t / 0.012) + 0.4 * np.sin(2 * np.pi * 1760 * t) * np.exp(-t / 0.018)
        return fade_edges(x, 0.0003, 0.005)

    def crash(self):
        n = int(2.6 * SR)
        t = tvec(n)
        out = []
        for _ in range(2):
            x = filt("hp", 4200, 0.6, self.nz.white(n)) * np.exp(-t / 1.0)
            out.append(x)
        metal = sum(np.sin(2 * np.pi * f * t + 3 * np.sin(2 * np.pi * f * 1.41 * t)) for f in (420, 597, 761)) / 3
        x = np.vstack(out) + 0.12 * metal * np.exp(-t / 0.7)
        return fade_edges(x * 0.8, 0.0005, 0.2)

    def thud(self):
        n = int(0.6 * SR)
        t = tvec(n)
        f = 55 + 45 * np.exp(-t / 0.06)
        x = np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-t / 0.22) + 0.15 * filt("lp", 900, 0.7, self.nz.white(n)) * np.exp(-t / 0.03)
        return fade_edges(x, 0.0005, 0.05)

    def tick(self):
        n = int(0.05 * SR)
        t = tvec(n)
        x = filt("hp", 3000, 0.7, self.nz.white(n)) * np.exp(-t / 0.002) + 0.5 * np.sin(2 * np.pi * 3100 * t) * np.exp(-t / 0.008)
        return fade_edges(x, 0.0002, 0.005)

    def clock(self):
        n = int(0.09 * SR)
        t = tvec(n)
        x = np.sin(2 * np.pi * 1760 * t) * np.exp(-t / 0.015) + 0.5 * np.sin(2 * np.pi * 2637 * t) * np.exp(-t / 0.01)
        x += 0.3 * filt("bp", 4000, 2, self.nz.white(n)) * np.exp(-t / 0.003)
        return fade_edges(x, 0.0002, 0.01)

    def fm_perc(self, pitch=880):
        n = int(0.18 * SR)
        t = tvec(n)
        idx = 5 * np.exp(-t / 0.02)
        x = np.sin(2 * np.pi * pitch * t + idx * np.sin(2 * np.pi * pitch * 1.414 * t)) * np.exp(-t / 0.05)
        return fade_edges(x, 0.0003, 0.01)

    def robot(self):
        n = int(0.16 * SR)
        t = tvec(n)
        f = 220 * np.exp(-t / 0.05) + 80
        x = square(f, n) * np.exp(-t / 0.04)
        return fade_edges(filt("lp", 2500, 1.2, x), 0.0003, 0.01)

    def zap(self):
        n = int(0.22 * SR)
        t = tvec(n)
        f = 120 + 2300 * np.exp(-t / 0.035)
        ph = np.cumsum(f) / SR
        x = np.sin(2 * np.pi * ph + 2.5 * np.sin(2 * np.pi * ph * 2.01)) * np.exp(-t / 0.07)
        return fade_edges(x, 0.0003, 0.01)

    # --- tonal voices -----------------------------------------------------------
    def bass(self, midi, dur, cutoff=800, accent=1.0):
        n = int((dur + 0.06) * SR)
        f = float(mtof(midi))
        t = tvec(n)
        x = 0.8 * saw(f, n) + 0.55 * sine(f / 2, n)
        cut = cutoff * (1 + 2.2 * accent * np.exp(-t / 0.07))
        x = tv_filter("lp", x, cut, q=1.1, block=64)
        x = np.tanh(1.4 * x) * env_adsr(n, 0.003, 0.12, 0.75, 0.05, gate=dur)
        return fade_edges(x, 0.001, 0.01)

    def pad(self, notes, dur, cutoff=1200, attack=0.6, release=1.2, wide=False, seed=0):
        n = int((dur + release) * SR)
        t = tvec(n)
        L = np.zeros(n)
        R = np.zeros(n)
        detunes = [-0.12, -0.07, -0.03, 0, 0.03, 0.07, 0.12]
        rng = np.random.default_rng(seed)
        for note in notes:
            for k, dtn in enumerate(detunes):
                v = saw(float(mtof(note + dtn)), n, phase0=rng.uniform())
                pan = (k / (len(detunes) - 1) * 2 - 1) * (0.9 if wide else 0.6)
                a = (pan + 1) * np.pi / 4
                L += v * np.cos(a)
                R += v * np.sin(a)
        x = np.vstack([L, R]) / (len(notes) * len(detunes)) * 2.2
        x = filt("lp", cutoff, 0.8, x)
        x = filt("lp", cutoff * 1.6, 0.6, x)
        e = env_adsr(n, attack, 0.6, 0.85, release, gate=dur)
        return fade_edges(x * e, 0.002, 0.05)

    def organ(self, notes, dur, release=0.4):
        n = int((dur + release) * SR)
        t = tvec(n)
        x = np.zeros(n)
        ratios = [(0.5, 0.55), (1, 1.0), (1.5, 0.45), (2, 0.6), (3, 0.3), (4, 0.25), (6, 0.1)]
        for note in notes:
            f = float(mtof(note))
            for r, w in ratios:
                x += w * np.sin(2 * np.pi * f * r * t + 0.002 * np.sin(2 * np.pi * 5.8 * t))
        x /= len(notes) * 2.6
        trem = 1 + 0.08 * np.sin(2 * np.pi * 5.8 * t)
        e = env_adsr(n, 0.06, 0.3, 0.9, release, gate=dur)
        L, R = x * trem * e, x * (2 - trem) * e
        return fade_edges(np.vstack([L, R]), 0.002, 0.05)

    def arp(self, midi, dur, wave_="square", cutoff=1200, crush=0):
        n = int((dur + 0.08) * SR)
        f = float(mtof(midi))
        t = tvec(n)
        x = square(f, n) if wave_ == "square" else saw(f, n)
        cut = cutoff * (1 + 3.0 * np.exp(-t / 0.04))
        x = tv_filter("lp", x, cut, q=1.4, block=96) * np.exp(-t / 0.16) * env_adsr(n, 0.002, 0.05, 1.0, 0.05, gate=dur)
        if crush:
            x = bitcrush(x, crush, 4)
        return fade_edges(x, 0.001, 0.008)

    def bell(self, midi, dur=3.0, bright=1.0):
        n = int(dur * SR)
        f = float(mtof(midi))
        t = tvec(n)
        idx = (5.5 * bright) * np.exp(-t / 0.35) + 0.6
        x = np.sin(2 * np.pi * f * t + idx * np.sin(2 * np.pi * 3.5 * f * t)) * np.exp(-t / 1.6)
        x += 0.25 * np.sin(2 * np.pi * 2.76 * f * t) * np.exp(-t / 0.5)
        return fade_edges(x * 0.7, 0.0005, 0.1)

    def pluck(self, midi, dur=0.5):
        n = int(dur * SR)
        f = float(mtof(midi))
        t = tvec(n)
        x = saw(f, n)
        x = tv_filter("lp", x, 300 + 4200 * np.exp(-t / 0.06), q=0.9, block=64) * np.exp(-t / 0.22)
        return fade_edges(x, 0.0005, 0.02)

    def supersaw(self, midi, dur, cutoff=5200):
        n = int((dur + 0.3) * SR)
        f0 = float(mtof(midi))
        t = tvec(n)
        vib = 1 + 0.004 * np.sin(2 * np.pi * 5.2 * t) * np.clip((t - 0.25) / 0.3, 0, 1)
        cents = [-15, -9.5, -4.5, 0, 4.5, 9.5, 15]
        L = np.zeros(n)
        R = np.zeros(n)
        for k, c in enumerate(cents):
            v = saw(f0 * 2 ** (c / 1200) * vib, n, phase0=(k * 0.137) % 1)
            a = ((k / 6) * 2 - 1) * 0.85
            a = (a + 1) * np.pi / 4
            L += v * np.cos(a)
            R += v * np.sin(a)
        sub = 0.35 * saw(f0 / 2, n)
        x = np.vstack([L + sub, R + sub]) / 5.0
        x = filt("lp", cutoff, 0.7, x)
        e = env_adsr(n, 0.012, 0.25, 0.8, 0.25, gate=dur)
        return fade_edges(x * e, 0.001, 0.03)

    def brass(self, notes, dur=0.35):
        n = int((dur + 0.2) * SR)
        t = tvec(n)
        x = np.zeros(n)
        for note in notes:
            f = float(mtof(note))
            for c in (-6, 0, 6):
                x += saw(f * 2 ** (c / 1200), n)
        x /= len(notes) * 3
        cut = 300 + 3200 * np.exp(-t / 0.09) * (1 - np.exp(-t / 0.012))
        x = tv_filter("lp", x, cut, q=1.2, block=64) * env_adsr(n, 0.006, 0.18, 0.0, 0.1, gate=dur)
        return fade_edges(np.tanh(2 * x), 0.001, 0.03)

    def choir(self, notes, dur, attack=0.5, release=1.0, seed=3):
        n = int((dur + release) * SR)
        t = tvec(n)
        src = np.zeros(n)
        rng = np.random.default_rng(seed)
        for note in notes:
            for c in (-8, 0, 7):
                f = float(mtof(note)) * 2 ** (c / 1200) * (1 + 0.006 * np.sin(2 * np.pi * (4.8 + rng.uniform()) * t + rng.uniform() * 6))
                src += saw(f, n, phase0=rng.uniform())
        src /= len(notes) * 3
        src += 0.04 * rng.uniform(-1, 1, n)
        x = sum(g * filt("bp", fc, q, src) for fc, q, g in ((700, 5, 1.0), (1220, 7, 0.55), (2600, 8, 0.3)))
        e = env_adsr(n, attack, 0.5, 0.9, release, gate=dur)
        y = x * e * 3.0
        return fade_edges(np.vstack([y, np.roll(y, int(0.011 * SR))]), 0.002, 0.05)

    # --- effects -----------------------------------------------------------------
    def impact(self, size="big"):
        k = {"small": 0.45, "medium": 0.7, "big": 0.9, "huge": 1.0}[size]
        n = int((2.4 + 1.6 * k) * SR)
        t = tvec(n)
        f = 30 + 32 * np.exp(-t / 0.28)
        sub = np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-t / (0.9 + 1.0 * k))
        boom = np.sin(2 * np.pi * 52 * t) * np.exp(-t / 0.35)
        nz = filt("lp", 3000 + 3000 * k, 0.6, self.nz.white(n)) * np.exp(-t / (0.12 + 0.25 * k))
        x = 1.0 * sub + 0.5 * boom + 0.55 * k * nz
        x = np.tanh(1.3 * x)
        st = np.vstack([x, x])
        st[1] = 0.85 * x + 0.15 * filt("lp", 3000, 0.6, self.nz.white(n)) * np.exp(-t / 0.2) * k
        return fade_edges(st, 0.0005, 0.3)

    def riser(self, dur):
        n = int(dur * SR)
        t = tvec(n)
        u = t / dur
        nz = np.vstack([self.nz.white(n), self.nz.white(n)])
        x = tv_filter("bp", nz, (300.0, 9000.0), q=1.6, block=256)
        tone = np.sin(2 * np.pi * np.cumsum(np.geomspace(180, 1300, n)) / SR) * 0.25
        x = (x * 0.9 + tone) * (u ** 2.2)
        x[:, -int(0.01 * SR):] *= np.linspace(1, 0, int(0.01 * SR))
        return x

    def reverse_swell(self, dur):
        n = int(dur * SR)
        t = tvec(n)
        x = filt("lp", 5000, 0.6, np.vstack([self.nz.white(n), self.nz.white(n)]))
        chord = sum(np.sin(2 * np.pi * float(mtof(m)) * t) for m in (50, 57, 62, 65)) / 4
        e = np.exp((t - dur) / (dur / 4.5))
        y = (0.55 * x + 0.5 * chord) * e
        y[:, -int(0.008 * SR):] *= np.linspace(1, 0, int(0.008 * SR))
        return y

    def whoosh(self, dur=0.8):
        n = int(dur * SR)
        t = tvec(n)
        sweep = 500 * (8 ** np.sin(np.pi * t / dur))
        x = tv_filter("bp", np.vstack([self.nz.white(n), self.nz.white(n)]), sweep, q=1.2, block=128)
        return fade_edges(x * np.sin(np.pi * t / dur) ** 2, 0.001, 0.01)

    def pen(self):
        n = int(0.03 * SR)
        t = tvec(n)
        x = filt("bp", 2400, 6, filt("hp", 2500, 0.7, self.nz.white(n)) * np.exp(-t / 0.0025))
        return fade_edges(x * 3, 0.0002, 0.004)

    def glint(self, midi=96):
        n = int(0.5 * SR)
        f = float(mtof(midi))
        t = tvec(n)
        x = np.sin(2 * np.pi * f * t + 1.2 * np.exp(-t / 0.05) * np.sin(2 * np.pi * 2 * f * t)) * np.exp(-t / 0.12)
        return fade_edges(x, 0.0005, 0.01)

    def beep(self, f=1000, dur=0.14):
        n = int(dur * SR)
        t = tvec(n)
        x = np.sin(2 * np.pi * f * t) + 0.18 * np.sin(2 * np.pi * 3 * f * t)
        return fade_edges(x * 0.8, 0.004, 0.01)

    def morse(self, text, unit, dur, f=1000):
        code = {"U": "..-", "S": "...", "A": ".-"}
        seq = []
        for ch in text:
            for k, sym in enumerate(code[ch]):
                seq.append((1 if sym == "." else 3, True))
                seq.append((1, False))
            seq.append((2, False))
        seq.append((4, False))
        out = np.zeros(int(dur * SR))
        pos = 0.0
        while pos < dur:
            for units, on in seq:
                d = units * unit
                if on and pos < dur:
                    b = self.beep(f, d * 0.92)
                    i = int(pos * SR)
                    j = min(len(out), i + len(b))
                    out[i:j] += b[: j - i]
                pos += d
        return out

    def anvil(self):
        n = int(2.8 * SR)
        t = tvec(n)
        x = np.zeros(n)
        for r, d, g in ((1.0, 1.2, 1.0), (2.76, 0.7, 0.6), (5.4, 0.4, 0.35), (8.9, 0.2, 0.2)):
            f = 587.33 * r
            x += g * np.sin(2 * np.pi * f * t + 2.0 * np.exp(-t / 0.03) * np.sin(2 * np.pi * f * 1.41 * t)) * np.exp(-t / d)
        x += 0.6 * filt("hp", 2000, 0.7, self.nz.white(n)) * np.exp(-t / 0.01)
        return fade_edges(x * 0.55, 0.0003, 0.2)

    def clank(self):
        n = int(0.9 * SR)
        t = tvec(n)
        x = np.sin(2 * np.pi * 110 * t + 4 * np.exp(-t / 0.05) * np.sin(2 * np.pi * 187 * t)) * np.exp(-t / 0.18)
        x += 0.35 * np.sin(2 * np.pi * 740 * t) * np.exp(-t / 0.12) + 0.3 * filt("bp", 1800, 1.5, self.nz.white(n)) * np.exp(-t / 0.01)
        return fade_edges(x, 0.0003, 0.05)

    def lock(self):
        out = np.zeros(int(0.3 * SR))
        for k, f in enumerate((1396.9, 1864.7)):
            b = self.beep(f, 0.06)
            i = int(k * 0.08 * SR)
            out[i:i + len(b)] += b
        return out

    def blip(self, midi):
        n = int(0.07 * SR)
        f = float(mtof(midi))
        t = tvec(n)
        x = (0.6 * square(f, n) + 0.4 * np.sin(2 * np.pi * f * t)) * np.exp(-t / 0.018)
        return fade_edges(filt("lp", 6000, 0.7, x), 0.0005, 0.005)

    def whine(self, dur):
        n = int(dur * SR)
        t = tvec(n)
        f = np.geomspace(140, 1900, n) * (1 + 0.004 * np.sin(2 * np.pi * 7 * t))
        ph = np.cumsum(f) / SR
        x = np.sin(2 * np.pi * ph) + 0.35 * np.sin(2 * np.pi * 2 * ph) + 0.18 * saw(f * 3, n)
        x = filt("lp", 5000, 0.7, x) * (t / dur) ** 1.8
        x[-int(0.01 * SR):] *= np.linspace(1, 0, int(0.01 * SR))
        return x

    def tape_rewind(self, dur):
        n = int(dur * SR)
        t = tvec(n)
        sweep = 600 + 2400 * (0.5 + 0.5 * np.sin(2 * np.pi * (1.5 + 4 * t / dur) * t))
        x = tv_filter("bp", np.vstack([self.nz.white(n), self.nz.white(n)]), sweep, q=2.5, block=128)
        chirp = np.sin(2 * np.pi * np.cumsum(sweep * 0.5) / SR) * 0.3
        y = (x + chirp) * np.minimum(1, t / 0.2) * (0.7 + 0.3 * np.sin(2 * np.pi * 8 * t) ** 2)
        y[:, -int(0.01 * SR):] *= np.linspace(1, 0, int(0.01 * SR))
        return y

    def reverse_hit(self, dur=0.5):
        h = self.impact("small")[:, : int(dur * SR)]
        return h[:, ::-1] * np.linspace(0.2, 1, h.shape[1])

    def sub_hit(self, midi):
        n = int(0.6 * SR)
        t = tvec(n)
        f = float(mtof(midi))
        x = np.sin(2 * np.pi * f * t) * np.exp(-t / 0.3) * np.minimum(1, t / 0.006)
        return fade_edges(x, 0.0005, 0.05)


# =============================================================================
# Mixer
# =============================================================================
class Mix:
    def __init__(self, n):
        self.n = n
        self.stems = {s: np.zeros((2, n), np.float32) for s in STEMS}
        self.sends = {s: np.zeros((2, n), np.float32) for s in STEMS}
        self.kicks = []

    def add(self, stem, t, x, gain_db=0.0, pan=0.0, send=0.0):
        x = x if x.ndim == 2 else pan2(x, pan)
        i = int(round(t * SR))
        if i >= self.n:
            return
        j0 = max(0, -i)
        i0 = max(0, i)
        m = min(self.n - i0, x.shape[1] - j0)
        if m <= 0:
            return
        g = db(gain_db)
        seg = x[:, j0:j0 + m] * g
        self.stems[stem][:, i0:i0 + m] += seg
        if send > 0:
            self.sends[stem][:, i0:i0 + m] += seg * send


# =============================================================================
# The score
# =============================================================================
class Score:
    def __init__(self, tl, sc):
        self.tl, self.sc = tl, sc
        self.kit = Kit()
        self.n = int(round(tl.duration * SR))
        self.mix = Mix(self.n)
        self.chords = sc["chords"]
        self.theme = sc["theme"]
        self.patterns = sc["patterns"]
        self.arps = sc["arps"]
        secs = sc["sections"]
        self.sections = []
        for i, s in enumerate(secs):
            t0 = tl.time(s["at"])
            t1 = tl.time(secs[i + 1]["at"]) if i + 1 < len(secs) else tl.duration
            self.sections.append({**s, "t0": t0, "t1": t1, "bars": int(round((t1 - t0) / tl.bar))})

    # --- helpers ---------------------------------------------------------------
    def chord_at(self, sec, bar_index):
        names = sec["chords"]
        return self.chords[names[(bar_index // sec["chordBars"]) % len(names)]], names[(bar_index // sec["chordBars"]) % len(names)]

    def bars_of(self, sec, layer):
        a = layer.get("from", 1)
        b = layer.get("to", sec["bars"])
        return range(a - 1, min(b, sec["bars"]))

    def fade(self, sec, layer, t):
        fi = layer.get("fadeIn", 0)
        return 1.0 if fi <= 0 else min(1.0, max(0.0, (t - sec["t0"]) / fi)) ** 1.5

    # --- sections ----------------------------------------------------------------
    def render_sections(self):
        for sec in self.sections:
            for name, layer in sec["layers"].items():
                getattr(self, f"layer_{name}")(sec, layer)

    def layer_drone(self, sec, L):
        ch, _ = self.chord_at(sec, 0)
        root = ch["bass"]
        dur = sec["t1"] - sec["t0"]
        if "decayTo" in L:
            dur = self.tl.time(L["decayTo"]) - sec["t0"]
        n = int((dur + 0.5) * SR)
        t = tvec(n)
        x = 0.8 * np.sin(2 * np.pi * float(mtof(root - 12)) * t) + 0.5 * np.sin(2 * np.pi * float(mtof(root)) * t) + 0.2 * np.sin(2 * np.pi * float(mtof(root + 7)) * t)
        e = np.minimum(1, t / max(0.05, L.get("fadeIn", 1.0))) * np.minimum(1, np.maximum(0, (dur + 0.5 - t) / 0.5))
        if "decayTo" in L:
            e *= np.exp(-t / (dur / 3))
        self.mix.add("pads", sec["t0"], x * e, L["gain"], send=0.2)

    def layer_pad(self, sec, L):
        cb = sec["chordBars"]
        nb = sec["bars"]
        for b0 in range(0, nb, cb):
            ch, name = self.chord_at(sec, b0)
            t = sec["t0"] + b0 * self.tl.bar
            dur = min(cb, nb - b0) * self.tl.bar
            u = (b0 + cb / 2) / max(1, nb)
            cut = L["cutoff"][0] + (L["cutoff"][1] - L["cutoff"][0]) * u
            notes = ch["pad"] + [ch["low"]]
            attack = L.get("attack", 0.5 if b0 else 0.9)
            release = L.get("release", 1.2)
            if "decayTo" in L:
                dur = self.tl.time(L["decayTo"]) - t
                x = self.kit.pad(notes, dur, cut, attack, release, L.get("wide", False), seed=b0)
                tt = tvec(x.shape[1])
                x = x * np.exp(-tt / (dur / 2.6))
            else:
                x = self.kit.pad(notes, dur, cut, attack, release, L.get("wide", False), seed=b0)
            if L.get("swell"):
                tt = tvec(x.shape[1])
                x = x * np.minimum(1, (0.25 + tt / dur) ** 1.5)
            x = x * self.fade(sec, L, t)
            self.mix.add("pads", t, x, L["gain"], send=0.35)

    def layer_organ(self, sec, L):
        cb = sec["chordBars"]
        for b0 in range(0, sec["bars"], cb):
            ch, _ = self.chord_at(sec, b0)
            t = sec["t0"] + b0 * self.tl.bar
            dur = min(cb, sec["bars"] - b0) * self.tl.bar
            if "decayTo" in L:
                dur = self.tl.time(L["decayTo"]) - t
            x = self.kit.organ([n - 12 for n in ch["pad"]] + [ch["low"] - 12], dur)
            if "decayTo" in L:
                x = x * np.exp(-tvec(x.shape[1]) / (dur / 2.5))
            self.mix.add("pads", t, x * self.fade(sec, L, t), L["gain"], send=0.3)

    def layer_choir(self, sec, L):
        if "phrases" in L:
            for t, dur, m in self.phrase_notes(sec, L):
                x = self.kit.choir([m + L.get("octave", 0) * 12], dur * 0.98, attack=0.12, release=0.5, seed=int(t * 10))
                self.mix.add("lead", t, x, L["gain"], send=0.45)
            return
        cb = sec["chordBars"]
        for b0 in range(0, sec["bars"], cb):
            ch, _ = self.chord_at(sec, b0)
            t = sec["t0"] + b0 * self.tl.bar
            dur = min(cb, sec["bars"] - b0) * self.tl.bar
            if "decayTo" in L:
                dur = self.tl.time(L["decayTo"]) - t
            x = self.kit.choir(ch["pad"], dur, attack=0.35, release=1.5, seed=b0)
            if "decayTo" in L:
                x = x * np.exp(-tvec(x.shape[1]) / (dur / 2.4))
            self.mix.add("pads", t, x, L["gain"], send=0.5)

    def tone_pool(self, ch, octave=0):
        base = sorted(ch["pad"])
        pool = base + [n + 12 for n in base] + [n + 24 for n in base]
        return [n + 12 * octave for n in pool]

    def layer_arp(self, sec, L):
        pat = self.arps[L["pattern"]]
        q = self.tl.beat / 4
        nb = sec["bars"]
        for b in self.bars_of(sec, L):
            ch, _ = self.chord_at(sec, b)
            step_up = b // L["stepUp"] if L.get("stepUp") else 0
            pool = self.tone_pool(ch, L.get("octave", 0))
            for k in range(16):
                t = sec["t0"] + b * self.tl.bar + k * q
                u = (b * 16 + k) / (nb * 16)
                cut = L["cutoff"][0] * (L["cutoff"][1] / L["cutoff"][0]) ** u
                idx = min(len(pool) - 1, pat[k] + step_up)
                x = self.kit.arp(pool[idx], q * 0.9, L.get("wave", "square"), cut, L.get("crush", 0))
                acc = 1.0 if k % 4 == 0 else 0.8
                pan = 0.35 * math.sin(k * 0.9 + b)
                self.mix.add("arps", t, x * acc * self.fade(sec, L, t), L["gain"], pan=pan, send=0.28)

    def layer_bass(self, sec, L):
        q = self.tl.beat / 4
        style = L.get("style", "offbeat8")
        for b in self.bars_of(sec, L):
            ch, _ = self.chord_at(sec, b)
            root = ch["bass"]
            t0 = sec["t0"] + b * self.tl.bar
            if style == "long":
                x = self.kit.bass(root, self.tl.bar * 0.98, L["cutoff"], 0.6)
                self.mix.add("bass", t0, x, L["gain"], send=0.03)
                continue
            for k in range(16):
                if style == "offbeat8" and k % 4 != 2:
                    continue
                if style == "roll16" and k % 4 == 0:
                    continue
                note = root + (12 if (style == "roll16" and k % 4 == 3) else 0)
                dur = q * (0.9 if style == "roll16" else 1.8)
                x = self.kit.bass(note, dur, L["cutoff"], 1.0 if k % 4 == 2 else 0.6)
                self.mix.add("bass", t0 + k * q, x, L["gain"], send=0.03)

    def drum_layer(self, sec, L, stem, voice, base_gain_db=0.0, pan=0.0, send=0.08, record_kick=False):
        pat = self.patterns[L["pattern"]]
        q = self.tl.beat / 4
        for b in self.bars_of(sec, L):
            for k, ch in enumerate(pat):
                if ch == ".":
                    continue
                t = sec["t0"] + b * self.tl.bar + k * q
                g = L["gain"] + base_gain_db + (2.0 if ch == "X" else -6.0 if ch == "o" else 0.0)
                self.mix.add(stem, t, voice(), g, pan=pan, send=send)
                if record_kick:
                    self.mix.kicks.append(t)

    def layer_kick(self, sec, L):
        soft = L.get("soft", False)
        self.drum_layer(sec, L, "drums", lambda: self.kit.kick(soft), send=0.04 if not soft else 0.15, record_kick=not soft)

    def layer_snare(self, sec, L):
        self.drum_layer(sec, L, "drums", self.kit.snare, send=0.18)

    def layer_clap(self, sec, L):
        self.drum_layer(sec, L, "drums", self.kit.clap, send=0.2)

    def layer_hat(self, sec, L):
        self.drum_layer(sec, L, "drums", lambda: self.kit.hat(False), pan=0.25, send=0.05)

    def layer_openhat(self, sec, L):
        self.drum_layer(sec, L, "drums", lambda: self.kit.hat(True), pan=-0.25, send=0.08)

    def layer_rim(self, sec, L):
        self.drum_layer(sec, L, "drums", self.kit.rim, pan=-0.3, send=0.25)

    def layer_fm_perc(self, sec, L):
        self.drum_layer(sec, L, "drums", lambda: self.kit.fm_perc(880), pan=0.4, send=0.15)

    def layer_robot(self, sec, L):
        self.drum_layer(sec, L, "drums", self.kit.robot, pan=-0.35, send=0.1)

    def layer_zaps(self, sec, L):
        self.drum_layer(sec, L, "fx", self.kit.zap, pan=0.3, send=0.2)

    def layer_clock(self, sec, L):
        self.drum_layer(sec, L, "fx", self.kit.clock, pan=0.15, send=0.25)

    def layer_sequencer(self, sec, L):
        pat = self.arps[L["pattern"]]
        q = self.tl.beat / 4
        for b in self.bars_of(sec, L):
            ch, _ = self.chord_at(sec, b)
            pool = self.tone_pool(ch, -1)
            for k in range(16):
                x = self.kit.arp(pool[pat[k]], q * 0.7, "saw", 1400, 0)
                self.mix.add("arps", sec["t0"] + b * self.tl.bar + k * q, x, L["gain"], pan=0.2 if k % 2 else -0.2, send=0.1)

    def layer_crash(self, sec, L):
        for b in range(0, sec["bars"], L["every"]):
            self.mix.add("drums", sec["t0"] + b * self.tl.bar, self.kit.crash(), L["gain"], send=0.2)

    def phrase_notes(self, sec, L):
        """(time, duration, midi) of the theme phrases laid end to end from the section start."""
        out = []
        beat = self.tl.beat
        t = sec["t0"]
        tr = L.get("transpose", 0)
        while t < sec["t1"] - 1e-6:
            for ph in L["phrases"]:
                for b0, d, m in self.theme[ph]:
                    tt = t + b0 * beat
                    if tt < sec["t1"] - 1e-6:
                        out.append((tt, min(d * beat, sec["t1"] - tt), m + tr))
                t += 16 * beat
                if t >= sec["t1"] - 1e-6:
                    break
        return out

    def layer_lead(self, sec, L):
        for t, d, m in self.phrase_notes(sec, L):
            x = self.kit.supersaw(m + 12 * L.get("octave", 0), d * 0.96)
            self.mix.add("lead", t, x, L["gain"], send=0.3)

    def layer_counter(self, sec, L):
        beat = self.tl.beat
        t = sec["t0"]
        while t < sec["t1"] - 1e-6:
            for b0, d, m in self.theme["counter"]:
                tt = t + b0 * beat
                if tt < sec["t1"]:
                    self.mix.add("arps", tt, self.kit.bell(m + L.get("transpose", 0) + 12, 2.2, 0.7), L["gain"], pan=0.3, send=0.35)
            t += 16 * beat

    def layer_snare_roll(self, sec, L):
        a = sec["t0"] + (L.get("from", 1) - 1) * self.tl.bar
        b = sec["t0"] + L.get("to", sec["bars"]) * self.tl.bar
        t = a
        while t < b - 1e-6:
            u = (t - a) / (b - a)
            div = 2 ** (1 + 2 * u)  # 8ths → 32nds per beat
            step = self.tl.beat / (round(div * 2) / 2)
            g = L["gain"] - 14 * (1 - u)
            self.mix.add("drums", t, self.kit.snare(), g, pan=0.1 * math.sin(t * 9), send=0.15)
            t += step

    def layer_noise_riser(self, sec, L):
        a = sec["t0"] + (L.get("from", 1) - 1) * self.tl.bar
        b = sec["t0"] + L.get("to", sec["bars"]) * self.tl.bar
        self.mix.add("fx", a, self.kit.riser(b - a), L["gain"], send=0.2)

    def layer_sub_pulse(self, sec, L):
        for b in range(sec["bars"]):
            ch, _ = self.chord_at(sec, b)
            for k in range(4):
                t = sec["t0"] + b * self.tl.bar + k * self.tl.beat
                self.mix.add("bass", t, self.kit.sub_hit(ch["bass"] - 12), L["gain"] + (0 if k == 0 else -4), send=0.05)

    def layer_sub_roar(self, sec, L):
        dur = sec["t1"] - sec["t0"]
        n = int(dur * SR)
        t = tvec(n)
        nz = np.random.default_rng(87).uniform(-1, 1, n)
        x = filt("lp", 140, 0.9, nz) * 6
        x = np.tanh(2.5 * x) * np.exp(-t / (dur * 0.7)) * np.minimum(1, t / 0.03)
        x = filt("lp", 400, 0.7, x)
        self.mix.add("fx", sec["t0"], x, L["gain"], send=0.1)

    # --- cues ----------------------------------------------------------------------
    def render_cues(self):
        kit = self.kit
        for sc in self.tl.scenes:
            for cue in sc.get("cues", []):
                a = cue.get("audio")
                if not a:
                    continue
                hits = self.tl.hits(cue, sc)
                for k, (t0, t1) in enumerate(hits):
                    self.cue_sound(a, sc, k, t0, t1)

    def chord_now(self, t):
        for sec in self.sections:
            if sec["t0"] <= t < sec["t1"]:
                b = int((t - sec["t0"]) / self.tl.bar)
                return self.chord_at(sec, b)[0]
        return self.chords["Dm"]

    def cue_sound(self, a, sc, k, t0, t1):
        kit, mix, g = self.kit, self.mix, a.get("gain", -12)
        typ = a["type"]
        if typ == "impact":
            mix.add("fx", t0, kit.impact(a.get("size", "big")), g, send=0.6)
        elif typ == "reverse_swell":
            mix.add("fx", t0, kit.reverse_swell(t1 - t0), g, send=0.3)
        elif typ == "riser":
            mix.add("fx", t0, kit.riser(t1 - t0), g, send=0.25)
        elif typ == "whoosh":
            mix.add("fx", t0, kit.whoosh(0.9), g, send=0.3)
        elif typ == "pen":
            mix.add("fx", t0, kit.pen(), g, pan=0.3 * math.sin(k * 2.1), send=0.2)
        elif typ == "glint":
            mix.add("fx", t0, kit.glint([93, 96, 98, 100, 103][k % 5]), g, pan=0.5 * math.sin(k * 1.3), send=0.4)
        elif typ == "star":
            mix.add("arps", t0, kit.bell([74, 77, 81, 84, 86, 89, 93][k % 7], 1.2, 0.5), g, pan=0.6 * math.sin(k * 0.9), send=0.4)
        elif typ == "pluck":
            ch = self.chord_now(t0)
            pool = self.tone_pool(ch, 1)
            mix.add("arps", t0, kit.pluck(pool[k % len(pool)], 0.6), g, pan=0.4 * math.sin(k), send=0.3)
        elif typ == "bell":
            for m in a.get("notes", [74]):
                mix.add("arps", t0, kit.bell(m, 3.5), g, send=0.5)
        elif typ == "thud":
            mix.add("drums", t0, kit.thud(), g, send=0.2)
        elif typ == "tick":
            mix.add("fx", t0, kit.tick(), g, pan=0.5 * math.sin(k * 1.7), send=0.1)
        elif typ == "morse":
            mix.add("fx", t0, kit.morse(a["text"], self.tl.beat / 4, t1 - t0, a.get("freq", 1000)), g, pan=0.15, send=0.1)
        elif typ == "ring":
            motif = self.theme["motif"]
            m = motif[k % len(motif)][2]
            mix.add("arps", t0, kit.bell(m, 3.8, 0.8), g, send=0.55)
            mix.add("drums", t0, kit.thud(), g - 8, send=0.4)
        elif typ == "anvil":
            mix.add("fx", t0, kit.anvil(), g, send=0.5)
            mix.add("fx", t0, kit.impact("medium"), g - 6, send=0.4)
        elif typ == "zap":
            mix.add("fx", t0, kit.zap(), g, send=0.3)
            mix.add("fx", t0, kit.impact("small"), g - 4, send=0.3)
        elif typ == "blip":
            n_ = a.get("count", 1)
            for j in range(n_):
                mix.add("fx", t0 + j * self.tl.beat, kit.blip([84, 88, 91, 93, 96, 98][(k * 3 + j) % 6]), g, pan=0.5 * math.sin(k * 0.77 + j), send=0.15)
        elif typ == "whine":
            mix.add("fx", t0, kit.whine(t1 - t0), g, send=0.2)
        elif typ == "beep":
            # Countdown beeps sit in the key: A5, and C6 on the last beat before ignition.
            mix.add("fx", t0, kit.beep(880 if k < 9 else 1046.5, 0.14 if k < 9 else 0.3), g, send=0.15)
        elif typ == "clank":
            mix.add("fx", t0, kit.clank(), g, pan=-0.2, send=0.4)
        elif typ == "lock":
            mix.add("fx", t0, kit.lock(), g, send=0.1)
        elif typ == "stab":
            ch = self.chord_now(t0)
            mix.add("lead", t0, kit.brass(ch["pad"] + [ch["low"]], 0.3), g, send=0.3)
        elif typ == "catch":
            mix.add("fx", t0, kit.impact("big"), g, send=0.5)
            mix.add("fx", t0, kit.anvil(), g - 8, send=0.4)
        elif typ == "starburst":
            ch = self.chord_now(t0)
            pool = self.tone_pool(ch, 1)
            for j in range(8):
                mix.add("arps", t0 + j * self.tl.beat / 8, kit.pluck(pool[j % len(pool)], 0.7), g - j * 0.5, pan=-0.8 + j * 0.22, send=0.45)
        elif typ == "reverse_hit":
            x = kit.reverse_hit(0.45)
            mix.add("fx", t0 - x.shape[1] / SR + 0.02, x, g, send=0.3)
        elif typ == "tape_rewind":
            mix.add("fx", t0, kit.tape_rewind(t1 - t0), g, send=0.2)
        elif typ == "swell":
            ch = self.chords["D"]
            x = kit.pad(ch["pad"] + [ch["low"], ch["pad"][-1] + 12], t1 - t0, 3200, attack=t1 - t0 - 0.1, release=0.4, wide=True, seed=92)
            mix.add("pads", t0, x, g, send=0.5)
        elif typ == "stutter":
            self.stutters.append((t0, a.get("rate", "32nd")))
        else:
            raise ValueError(f"unknown audio cue type {typ}")

    # --- gates, stutter, sidechain -----------------------------------------------------
    def apply_sidechain(self):
        n = self.n
        env = np.ones(n, np.float32)
        att, rel = int(0.004 * SR), 0.13
        shape = 1 - np.exp(-np.arange(int(0.5 * SR)) / (rel * SR))
        for t in self.mix.kicks:
            i = int(round(t * SR))
            m = min(len(shape), n - i)
            if m <= 0:
                continue
            seg = env[i:i + m]
            np.minimum(seg, shape[:m] * 0.999 + 0.001, out=seg)
            if i - att > 0:
                env[i - att:i] = np.minimum(env[i - att:i], np.linspace(1, 0.001, att))
        duck = {"bass": 0.65, "pads": 0.4, "arps": 0.2}
        for stem, depth in duck.items():
            g = 1 - depth * (1 - env)
            self.mix.stems[stem] *= g
            self.mix.sends[stem] *= g

    def apply_stutters(self):
        for t0, rate in self.stutters:
            sl = int(UNIT_BEATS[rate] * self.tl.beat * SR)
            i = int(round(t0 * SR))
            span = int(self.tl.beat * SR)
            for stem in ("drums", "arps", "bass", "lead"):
                x = self.mix.stems[stem]
                piece = x[:, i:i + sl].copy()
                piece = fade_edges(piece, 0.001, 0.002)
                for r in range(span // sl):
                    x[:, i + r * sl:i + (r + 1) * sl] = piece * (1 - 0.05 * r)

    def apply_gates(self, stems):
        for gt in self.sc.get("gates", []):
            a, b = self.tl.time(gt["from"]), self.tl.time(gt["to"])
            names = STEMS if gt["stems"] == ["all"] else gt["stems"]
            i, j = int(round(a * SR)), int(round(b * SR))
            f = int(0.006 * SR)
            for s in names:
                x = stems[s]
                x[:, max(0, i - f):i] *= np.linspace(1, 0, min(f, i))
                x[:, i:j] = 0
                k = min(f, x.shape[1] - j)
                if k > 0:
                    x[:, j:j + k] *= np.linspace(0, 1, k)

    # --- render ----------------------------------------------------------------------------
    def render(self):
        self.stutters = []
        t = time.time()
        self.render_sections()
        print(f"  sections  {time.time() - t:5.1f} s")
        t = time.time()
        self.render_cues()
        print(f"  cues      {time.time() - t:5.1f} s")
        self.apply_sidechain()
        self.apply_stutters()
        t = time.time()
        ir = reverb_ir(3.4, seed=7)
        stems = {}
        for s in STEMS:
            wet = np.vstack([signal.oaconvolve(self.mix.sends[s][c], ir[c])[: self.n] for c in range(2)])
            stems[s] = self.mix.stems[s] + 0.42 * wet.astype(np.float32)
        print(f"  reverb    {time.time() - t:5.1f} s")
        self.apply_gates(stems)
        # Energy contrast: every section is trimmed by its distance from the peak (E10),
        # so the summits stand out after the limiter.
        g = np.ones(self.n, np.float32)
        for sec in self.sections:
            i, j = int(round(sec["t0"] * SR)), int(round(sec["t1"] * SR))
            g[i:j] = db(0.65 * (min(sec["energy"], 10) - 10)) if sec["energy"] >= 7 else 1.0
        g = signal.lfilter([1 - math.exp(-1 / (0.04 * SR))], [1, -math.exp(-1 / (0.04 * SR))], g).astype(np.float32)
        for s in STEMS:
            stems[s] *= g
        # The finale decays to silence by its cue; nothing after.
        end = self.tl.time("22_coda@8.3")
        i = int(round(end * SR))
        for s in STEMS:
            stems[s][:, i:] = 0
            f = int(0.2 * SR)
            stems[s][:, i - f:i] *= np.linspace(1, 0, f) ** 2
        return stems


# =============================================================================
# Mastering
# =============================================================================
def true_peak_db(x):
    up = signal.resample_poly(x, 4, 1, axis=-1)
    return 20 * np.log10(np.max(np.abs(up)) + 1e-12)


def compress(x, thresh_db=-16.0, ratio=2.0, attack=0.01, release=0.15):
    mono = np.sqrt(np.mean(x.astype(np.float64) ** 2, axis=0))
    # RMS follower
    a = np.exp(-1 / (0.03 * SR))
    rms = np.sqrt(signal.lfilter([1 - a], [1, -a], mono ** 2) + 1e-12)
    level = 20 * np.log10(rms + 1e-12)
    over = np.maximum(0, level - thresh_db)
    gr = -over * (1 - 1 / ratio)
    # Smooth the gain: fast down, slow up.
    g = np.empty_like(gr)
    aa, ar = np.exp(-1 / (attack * SR)), np.exp(-1 / (release * SR))
    # Vectorised approximation: separate attack and release smoothing passes.
    g_att = signal.lfilter([1 - aa], [1, -aa], gr)
    g_rel = signal.lfilter([1 - ar], [1, -ar], gr)
    g = np.minimum(g_att, g_rel)
    return x * db(g)


def limit(x, ceiling_db=-1.3, lookahead=0.004, release=0.08):
    """Lookahead peak limiter measured on a 4x oversampled signal."""
    up = np.max(np.abs(signal.resample_poly(x, 4, 1, axis=-1)), axis=0)
    peak = up.reshape(-1, 4).max(axis=1)[: x.shape[1]]
    ceil = db(ceiling_db)
    need = np.minimum(1.0, ceil / np.maximum(peak, 1e-9))
    la = int(lookahead * SR)
    need = ndimage.minimum_filter1d(need, size=2 * la + 1, origin=0)
    ar = np.exp(-1 / (release * SR))
    # Release smoothing that never rises faster than the release allows.
    g = signal.lfilter([1 - ar], [1, -ar], need - 1) + 1
    g = np.minimum(g, need)
    return x * g


def master(stems, target_lufs=-14.0, tp_db=-1.0):
    mixd = sum(stems.values()).astype(np.float64)
    mixd = filt("hp", 18, 0.7, mixd)  # DC blocker
    mixd = compress(mixd)
    meter = pyln.Meter(SR)
    gain = 0.0
    out = mixd
    for _ in range(4):
        lufs = meter.integrated_loudness(out.T)
        gain += target_lufs - lufs
        out = limit(mixd * db(gain), tp_db - 0.3)
        if abs(meter.integrated_loudness(out.T) - target_lufs) < 0.15:
            break
    tp = true_peak_db(out)
    if tp > tp_db:
        out *= db(tp_db - tp - 0.05)
    return out, gain


def write_wav24(path, x, seed=24):
    """24-bit PCM with TPDF dither."""
    path.parent.mkdir(parents=True, exist_ok=True)
    rng = np.random.default_rng(seed)
    scale = 2 ** 23 - 1
    d = (rng.uniform(-0.5, 0.5, x.shape) + rng.uniform(-0.5, 0.5, x.shape))
    q = np.clip(np.round(x * scale + d), -scale - 1, scale).astype(np.int32)
    inter = q.T.reshape(-1)
    b = inter.astype("<i4").view(np.uint8).reshape(-1, 4)[:, :3].tobytes()
    with wave.open(str(path), "wb") as w:
        w.setnchannels(2)
        w.setsampwidth(3)
        w.setframerate(SR)
        w.writeframes(b)


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--out", default=str(ROOT / "audio/score.wav"))
    ap.add_argument("--stems", default=str(ROOT / "audio/stems"))
    ap.add_argument("--no-stems", action="store_true")
    ap.add_argument("--from", dest="t0", type=float, default=None, help="write only this window (seconds)")
    ap.add_argument("--to", dest="t1", type=float, default=None)
    args = ap.parse_args()
    tl = Timeline(json.loads((ROOT / "timeline.json").read_text()))
    sc = json.loads((ROOT / "score.json").read_text())
    print(f"THE AMERICAN EXPERIMENT · {tl.total_bars} bars at {tl.bpm} BPM = {tl.duration:.3f} s")
    t = time.time()
    score = Score(tl, sc)
    stems = score.render()
    out, gain = master(stems, sc.get("targetLufs", -14.0), sc.get("truePeakDb", -1.0))
    n = int(round(tl.duration * SR))
    assert out.shape[1] == n, (out.shape, n)
    meter = pyln.Meter(SR)
    print(f"  master    {meter.integrated_loudness(out.T):6.2f} LUFS  true peak {true_peak_db(out):5.2f} dBTP  length {out.shape[1] / SR:.3f} s")
    a = int(round((args.t0 or 0) * SR))
    b = int(round((args.t1 or tl.duration) * SR))
    write_wav24(Path(args.out), out[:, a:b])
    print(f"  wrote {args.out}")
    if not args.no_stems and args.t0 is None:
        for s in STEMS:
            write_wav24(Path(args.stems) / f"{s}.wav", np.clip(stems[s] * db(gain), -1, 1))
        print(f"  wrote stems to {args.stems}/ ({', '.join(STEMS)})")
    print(f"done in {time.time() - t:.0f} s")


if __name__ == "__main__":
    main()
