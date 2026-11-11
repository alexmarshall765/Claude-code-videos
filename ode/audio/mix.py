#!/usr/bin/env python3
"""
Final mix for ODE: score + narration (+ three small effects) -> audio/soundtrack.m4a

    python3 audio/mix.py

  - the score (audio/build/score.wav, from score.py) is gently levelled so the quiet
    opening and the full chorus both sit well, and given a little extra hall;
  - each narration line (audio/narration/*.flac, from narrate.py) is placed at its cue
    from audio/cues.json, and the music ducks under it;
  - at the premiere of the Ninth the sound closes down to a dull, distant murmur —
    the ovation Beethoven could not hear — and snaps back with the steam engine.

Requires: numpy, soundfile, ffmpeg.
"""
import json, subprocess
from pathlib import Path
import numpy as np, soundfile as sf

HERE = Path(__file__).resolve().parent
BUILD = HERE / 'build'
CUES = json.loads((HERE / 'cues.json').read_text())
SHOT = {s['id']: s for s in CUES['shots']}
SEC = {s['id']: s for s in CUES['sections']}
SR = 48000
DUR = CUES['duration']
N = int(round(DUR * SR))
rng = np.random.default_rng(1824)
db = lambda x: 10 ** (x / 20)

def fit(x, n):
    return x[:n] if len(x) >= n else np.concatenate([x, np.zeros((n - len(x),) + x.shape[1:], x.dtype)])
def spectral(x, gain):
    """Zero-phase filter: gain(freqs) -> linear gain per frequency. Works on mono or stereo."""
    X = np.fft.rfft(x, axis=0); f = np.fft.rfftfreq(len(x), 1 / SR); g = gain(f)
    return np.fft.irfft(X * (g[:, None] if x.ndim == 2 else g), n=len(x), axis=0)
def smooth(x, seconds):
    k = max(1, int(seconds * SR)); c = np.cumsum(np.concatenate([[0.0], x]))
    out = (c[k:] - c[:-k]) / k
    return np.concatenate([np.full(k // 2, out[0]), out, np.full(len(x) - len(out) - k // 2, out[-1])])
def ramp(t0, t1, n=N):
    """0 before t0, 1 after t1 (seconds), smooth in between."""
    t = np.arange(n) / SR; u = np.clip((t - t0) / max(1e-6, t1 - t0), 0, 1)
    return u * u * (3 - 2 * u)
def resample2x(x):
    X = np.fft.rfft(x); Y = np.zeros(len(x) + 1, complex); Y[:len(X)] = X
    return np.fft.irfft(Y, n=len(x) * 2) * 2
def hall(seconds=2.6, predelay=0.03):
    n = int(seconds * SR); t = np.arange(n) / SR
    ir = rng.standard_normal((n, 2)) * np.exp(-6.9 * t / seconds)[:, None]
    ir = spectral(ir, lambda f: 1 / (1 + (f / 5200) ** 2) * (f > 110))
    return np.concatenate([np.zeros((int(predelay * SR), 2)), ir / np.sqrt((ir ** 2).sum())])
def convolve(x, ir):
    n = len(x) + len(ir) - 1; m = 1 << (n - 1).bit_length()
    y = np.fft.irfft(np.fft.rfft(x, m, axis=0) * np.fft.rfft(ir, m, axis=0), m, axis=0)
    return y[:len(x)]

IR = hall()

# ----------------------------------------------------------------------------- music
music, sr = sf.read(BUILD / 'score.wav', dtype='float64'); assert sr == SR
music = fit(music, N)
# levelling: roughly 2:1 towards a common loudness, over several seconds
env = np.sqrt(np.maximum(smooth(music.mean(axis=1) ** 2, 4.0), 1e-9))
gain_db = np.clip((-22.0 - 20 * np.log10(env)) * 0.36, -3.0, 6.5)
gain_db[20 * np.log10(env) < -50] = 0.0
a0, a1 = SEC['acceleration']['start'], SEC['acceleration']['end']
gain_db -= 2.0 * ramp(a0 - 0.2, a0 + 0.5) * (1 - ramp(a1 - 0.5, a1 + 0.2))   # keep the fast cuts below the finale
gain_db += 1.5 * ramp(SEC['finale']['start'] + 14, SEC['finale']['start'] + 26)  # and let the last chorus open up
music *= db(smooth(gain_db, 2.5))[:, None]
music += 0.5 * convolve(music, IR)

# the ovation he could not hear
p0 = SHOT['premiere']['start']; i0 = SEC['industry']['start']
deaf = ramp(p0 + 5.0, p0 + 6.3) * (np.arange(N) / SR < i0)
muffled = spectral(music, lambda f: 1 / (1 + (f / 260) ** 4)) * db(-5)
music = music * (1 - deaf)[:, None] + muffled * deaf[:, None]

# ----------------------------------------------------------------------------- effects
fx = np.zeros((N, 2))
def place(sig, t, gain=1.0):
    a = int(t * SR); b = min(N, a + len(sig))
    if b > a: fx[a:b] += sig[:b - a] * gain
def noise(seconds, colour):
    n = int(seconds * SR); x = rng.standard_normal((n, 2))
    return spectral(x, colour)
# applause, heard as if through a wall, and a slow pulse
ap_len = i0 - (p0 + 5.2); t = np.arange(int(ap_len * SR)) / SR
ap = noise(ap_len, lambda f: 1 / (1 + (f / 320) ** 4) * (f > 40))
ap *= (0.6 + 0.4 * smooth(np.abs(rng.standard_normal(len(ap))), 0.08) / 0.8)[:, None]
ap *= (np.clip(t / 1.2, 0, 1) * np.clip((ap_len - t) / 0.05, 0, 1))[:, None]
place(ap / np.abs(ap).max(), p0 + 5.2, db(-17))
for k in range(4):
    tt = np.arange(int(0.5 * SR)) / SR; th = np.sin(2 * np.pi * 46 * tt) * np.exp(-tt * 13)
    for off, g in ((0, 1.0), (0.3, 0.6)):
        if p0 + 6.4 + k * 0.95 + off + 0.5 < i0: place(np.stack([th, th], 1), p0 + 6.4 + k * 0.95 + off, db(-15) * g)
# steam: a hiss as the engine starts
st = noise(1.6, lambda f: (f / (f + 2500.0)) ** 2 * 1 / (1 + (f / 9000) ** 2)); tt = np.arange(len(st)) / SR
place(st / np.abs(st).max() * (np.exp(-tt * 2.6) * np.clip(tt / 0.02, 0, 1))[:, None], i0 + 0.02, db(-20))
# rocket: the ground shaking
rk = noise(2.6, lambda f: 1 / (1 + (f / 90) ** 2) * (f > 22)); tt = np.arange(len(rk)) / SR
place(rk / np.abs(rk).max() * (np.clip(tt / 1.6, 0, 1) ** 1.5 * np.clip((2.6 - tt) / 0.5, 0, 1))[:, None], SHOT['rocket']['start'], db(-13))

# ----------------------------------------------------------------------------- narration
voice = np.zeros(N); duck = np.zeros(N)
for line in CUES['narration']:
    x, sr0 = sf.read(HERE / 'narration' / f"{line['id']}.flac", dtype='float64'); assert sr0 == 24000
    x = resample2x(x)
    x = spectral(x, lambda f: (1 + 0.5 / (1 + (f / 170) ** 2)) * (1 + 0.3 * (f / (f + 6000.0))) * (f > 55))  # a little chest, a little air
    x *= db(-19) / np.sqrt((x ** 2).mean())
    x = np.tanh(x * 1.6) / 1.6  # soft peak control
    a = int(line['start'] * SR); b = min(N, a + len(x)); voice[a:b] += x[:b - a]
    duck = np.maximum(duck, ramp(line['start'] - 0.35, line['start'] - 0.05) * (1 - ramp(b / SR + 0.1, b / SR + 0.9)))
    print(f"{line['id']:4s} {line['start']:7.2f} -> {b / SR:7.2f}  {line['text']}")
voice_st = np.stack([voice, voice], 1)
voice_st = voice_st + 0.16 * convolve(voice_st, IR)
music *= db(-7.5 * duck)[:, None]
fx *= db(-4 * duck)[:, None]

# ----------------------------------------------------------------------------- master
mix = music * db(-1.5) + fx + voice_st * db(4.5)
mix = np.tanh(mix * 1.15) / np.tanh(1.15)          # gentle saturation instead of hard clipping
mix *= db(-1.0) / np.abs(mix).max()
t = np.arange(N) / SR
mix *= (np.clip(t / 0.4, 0, 1) * (1 - ramp(DUR - 2.4, DUR - 0.15)))[:, None]
sf.write(BUILD / 'soundtrack.wav', mix, SR, subtype='PCM_24')
subprocess.run(['ffmpeg', '-y', '-hide_banner', '-loglevel', 'error', '-i', str(BUILD / 'soundtrack.wav'), '-c:a', 'aac', '-b:a', '256k', '-movflags', '+faststart', str(HERE / 'soundtrack.m4a')], check=True)
rms = lambda a, b: 20 * np.log10(np.sqrt((mix[int(a * SR):int(b * SR)] ** 2).mean()) + 1e-9)
print('\nsection loudness (dB RMS):  ' + '  '.join(f"{s['id']} {rms(s['start'], s['end']):.1f}" for s in CUES['sections']))
print(f'wrote {HERE / "soundtrack.m4a"}  ({DUR:.2f} s, peak {20 * np.log10(np.abs(mix).max()):.1f} dBFS, overall {rms(0, DUR):.1f} dB RMS)')
