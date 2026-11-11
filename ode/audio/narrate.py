#!/usr/bin/env python3
"""
Narration for ODE, synthesised with Kokoro (Apache-2.0 open-weight TTS, run locally via ONNX).

    KOKORO_DIR=/path/with/kokoro-v1.0.onnx+voices-v1.0.bin  python3 audio/narrate.py

Writes one FLAC per line to audio/narration/ (these are committed, so the mix can be
rebuilt without the model). The voice is a blend of two stock male voices, slowed
slightly, for a deep and measured read. Lines and timings come from audio/cues.json.

Requires: pip install kokoro-onnx soundfile; the two model files from the kokoro-onnx project.
"""
import json, os
from pathlib import Path
import numpy as np, soundfile as sf
from kokoro_onnx import Kokoro

HERE = Path(__file__).resolve().parent
OUT = HERE / 'narration'; OUT.mkdir(exist_ok=True)
D = Path(os.environ.get('KOKORO_DIR', '.'))
k = Kokoro(str(D / 'kokoro-v1.0.onnx'), str(D / 'voices-v1.0.bin'))
voice = 0.6 * k.get_voice_style('am_onyx') + 0.4 * k.get_voice_style('am_michael')
SPEED = float(os.environ.get('SPEED', 0.8))

for line in json.loads((HERE / 'cues.json').read_text())['narration']:
    text = line['text'].replace('’', "'")
    audio, sr = k.create(text, voice=voice, speed=SPEED, lang='en-us')
    # trim leading/trailing silence, leave a short tail
    idx = np.where(np.abs(audio) > 0.01)[0]
    audio = audio[max(0, idx[0] - int(0.03 * sr)): idx[-1] + int(0.12 * sr)]
    sf.write(OUT / f"{line['id']}.flac", audio, sr)
    print(f"{line['id']:4s} {len(audio) / sr:5.2f}s  (subtitle hold {line['hold']:.1f}s)  {text}")
