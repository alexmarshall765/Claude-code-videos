# THE AMERICAN EXPERIMENT

*In 1776 a few million people staked everything on a hypothesis: that free people can govern themselves and build anything. This film is the lab log of that experiment. The results are still coming in.*

This is a 4:56 film, 1920×1080 at 60 fps, with an original electronic score. Every frame is drawn in code: gold line work on black, on a surveyor's plate. The score is synthesized from the same 120 BPM timeline as the picture, so every cut, card and impact lands on its bar.beat.

**Status: vertical slice.** The engine, the HUD, the full synthesized score, and OBS 01 (prologue), OBS 02 (title) and OBS 14 (Apollo) are finished. The other 19 observations play as storyboard slates. Each slate runs its real cards on their real cues, so the whole timeline can be previewed against the score. See [STORYBOARD.md](STORYBOARD.md) for the film and [NOTES.md](NOTES.md) for what comes next.

## Requirements

- Node 20+ and npm. `npm install` brings in Puppeteer, which drives headless Chrome. Set `CHROME_PATH` to use an installed Chrome or Chromium instead of Puppeteer's own download.
- Python 3.11+ with numpy, scipy and pyloudnorm: `pip install numpy scipy pyloudnorm`.
- FFmpeg 6+ on your PATH.

```bash
npm install
make audio     # synthesize audio/score.wav and audio/stems/ (about 90 s)
make slice     # the vertical slice: OBS 01–02 and OBS 14, with music → out/slice.mp4
make check     # acceptance checks
```

## Make targets

| Target | What it does |
|---|---|
| `make audio` | `audio/synth.py` renders `audio/score.wav` (48 kHz, 24-bit, exactly 296.000 s, about −14 LUFS, at most −1 dBTP) and stems: drums, bass, arps, pads, lead, fx. |
| `make preview` | Fast full-length encode, `out/preview.mp4` (x264 veryfast, CRF 20). |
| `make video` | Master, `out/the_american_experiment_1080p60.mp4` (x264 slow, CRF 14, tune animation, BT.709, AAC 320k). Runs `make check` on the result. |
| `make video4k` | Supersampled master: captures at `?scale=2` (3840×2160) and scales to 1080p with lanczos. |
| `make slice` | The vertical slice: frames 0–959 and 9600–11039, joined, with the matching score. |
| `make apollo` | The 24-second Apollo preview (2:40–3:04), the hardest sync moment. |
| `make check` | Checks timing, cards, facts, palette, fonts, audio format and length, text size and safe area on sampled frames, and that frame 9,000 renders byte-identically twice. `VIDEO=file` also checks an encode's frame count and duration. `node render/check.mjs --motion` also checks that nothing holds still for 1 s. |
| `make serve` | Live preview at `http://localhost:8080/web/?preview`. |
| `make stills FRAMES=0,480,10320` | PNG stills in `out/stills/`. |
| `make cues` | The resolved cue sheet with global bar numbers and timecodes. |

**Preview flags** for `web/index.html`, served over http:

- `?preview` plays `audio/score.wav` and derives the frame from `audio.currentTime × 60`.
- `?debug` adds bar.beat, scene id, live cues, safe-area guides and a metronome click.
- `?frame=N` draws one frame.
- `?scale=2` renders at 4K.
- `?t=SECONDS` starts at a time.
- Keys: space plays or pauses, ← and → jump 2 s, and Shift with an arrow steps one frame.

## How it fits together

```
american-experiment/
├── timeline.json      BPM, the 22 scenes (bars), HUD data, cards, and every cue at bar.beat with its sound
├── score.json         chords, the theme, drum and arp patterns, and the layers of each section
├── data/facts.json    every on-screen number, date, quote and coordinate, with its source
├── web/index.html     canvas host and preview UI
├── web/src/engine.js  frame clock, easing, seeded RNG, camera and parallax, layers, bloom, transitions
├── web/src/hud.js     act and chapter marker, OBS line, the 1776–2026 ruler
├── web/src/timeline.js  bar.beat addresses and cue hits (shared with render/check.mjs)
├── web/src/draw/      paths (dash reveal), type, motif circle, torch, wireframe 3D, particles
├── web/src/scenes/    01_prologue.js, 02_title.js, 14_apollo.js and the slate used for unbuilt scenes
├── web/fonts/         Cormorant Garamond, Jost and JetBrains Mono (SIL OFL 1.1)
├── audio/synth.py     the score, from timeline.json + score.json
├── render/capture.mjs Puppeteer frame capture piped into FFmpeg (parallel pages, --from/--to, --segments)
├── render/check.mjs   acceptance checks
├── render/encode.sh   re-encodes: swap the soundtrack, ProRes, web copy
└── tools/             font fetch and lining-figure scripts
```

**Picture.** A frame is a pure function of its number: `t = frame / 60`. Rendering never reads the clock or `Math.random`. Randomness comes from mulberry32, seeded per scene and per particle. Particles are closed-form, so any frame renders on its own.

Each scene exports `{ id, startBar, bars, draw(ctx, s) }`, with `startBar` and `bars` filled in from `timeline.json`. `s` carries:

- local time and 0–1 progress
- bar, beat and beat phase
- `s.cue(name)`, an eased 0–1 envelope of a named cue
- `s.at('7.1')` for addresses
- seeded `s.rng(seed)`

Lines draw on in three weights:

- construction: 1 px, GOLD_DIM
- structure: 2–3 px, GOLD
- hero: 4–6 px, GOLD_HOT

A quarter-resolution bloom (≈ 12 px) is added with `lighter`. Statements bloom; data text sits on an annotation layer that never blooms. Paper grain and a moving dither go on top so H.264 does not band the dark gradients.

**Sound.** `synth.py` resolves the same addresses as `web/src/timeline.js`. Sections in `score.json` are anchored to scenes (`"at": "14_apollo@7.1"`), so music follows any retiming. All sounds are synthesized; there are no samples:

- kick, snare, clap, hats
- sidechained saw bass
- 7-saw pads, drawbar organ, filtered arps
- FM bells, a 7-voice supersaw, brass stabs, a formant choir
- impacts, risers and swells

Reverb is a convolution with a generated noise impulse response. The master runs through a gentle bus compressor, then a 4×-oversampled lookahead limiter, and is loudness-normalised with pyloudnorm.

## Retiming a scene

1. In `timeline.json`, change the scene's `bars`. Keep it 4, 8 or 12 so the music phrases cleanly.
2. Cue addresses are local to their scene (`"7.1"` means the scene's 7th bar, beat 1), so cues move with the scene. Move any cue you want elsewhere. `make cues` prints the result with global bar numbers.
3. `make audio`, then `make video`. Score sections are anchored to scenes, so the music re-renders from the same timeline.

The total length changes with the bars; `make check` reports it against 296.000 s.

## Swapping in an external track

To use a song from an AI music service instead of the synthesized score:

1. Render it at exactly 4:56 at 120 BPM in D minor. The prompt is in the brief, and also in `NOTES.md`.
2. Save it as `audio/score_external.wav`.
3. Run:

   ```bash
   render/encode.sh mux out/the_american_experiment_1080p60.mp4 audio/score_external.wav out/the_american_experiment_external.mp4
   ```

   Or capture with it directly: `node render/capture.mjs --audio audio/score_external.wav --preset master`.

Check the service's licence terms before publishing. Beat-tracking verification of an external track (librosa) is listed in NOTES.md as the next step for that path.

## Sources and rights

- Every number on screen is in `data/facts.json` with its source, and `make check` fails if a built scene shows an unverified one.
- Quotes are public-domain words from the brief, each with a small-type attribution.
- No logos, wordmarks, product names or likenesses.
- Maps will use the public-domain us-atlas TopoJSON and are labelled SCHEMATIC.
- Fonts are under the SIL Open Font License; licences are in `web/fonts/`. The Cormorant Garamond files are subset by Google Fonts and remapped by `tools/lining_figures.py` so digits default to the font's own lining figures, because canvas cannot enable OpenType features.
