# ODE — From the Agora to AI

A 3:27 short film about the story of Western civilization, from a sunrise over the Parthenon to a child asking an AI why the stars shine. It ends on Beethoven's "Ode to Joy".

Like the other films in this repository it is drawn entirely in code. Every frame is HTML Canvas: layered silhouettes, gradient skies, shafts of light with dust in them, film grain, a 2.39:1 letterbox, 24 fps. There is no footage, photography or generated imagery. The score is written as notes in a Python file and played by a software orchestra. The narration is a locally run open-weight text-to-speech voice.

```
ode/
├── index.html      player shell (plays picture and soundtrack together)
├── timing.js       master timing: tempo and beats for every shot
├── engine.js       drawing engine: light, atmosphere, figures, camera, type
├── scenes-1.js     I–III    Greece, Rome, the cathedral
├── scenes-2.js     IV–VI    Renaissance, science, liberty, Beethoven
├── scenes-3.js     VII–IX   industry, acceleration, the connected world
├── scenes-4.js     X + finale
├── film.js         timeline, dissolves, finishing pass, captions, subtitles, player
├── land.js         Natural Earth coastlines (for the maps and globes)
├── render.mjs      headless renderer → MP4
├── audio/
│   ├── score.py        the score, as notes → MIDI → FluidSynth
│   ├── narrate.py      narration → audio/narration/*.flac
│   ├── mix.py          score + narration + effects → soundtrack.m4a
│   ├── cues.json       timings shared by picture and sound
│   ├── narration/      the eleven narration lines
│   └── soundtrack.m4a  the finished mix
└── fonts/          vendored typefaces (SIL OFL)
```

---

## 1. Storyboard

Picture and music share one clock. `timing.js` gives each chapter a tempo and each shot a length in beats, so every cut lands on a beat and the pace of the cutting follows the tempo: slow and stately at 66 BPM, fastest at 132 BPM, calm again for the last two chapters.

| Time | Chapter | BPM | Shots |
|------|---------|-----|-------|
| 0:00 | **I · Dawn of reason** | 66 | Sunrise through the columns of the Parthenon. Socrates questions students in a sunlit stoa. Aristotle bends to a plant. A hand writes Greek on papyrus. |
| 0:18 | **II · Rome and law** | 66 | Senators in white togas in the Forum. A two-tier aqueduct across green hills and a stone road to the horizon. Light falls through the Pantheon's oculus. |
| 0:33 | **III · Faith and the cathedral** | 66 | A monk copies an illuminated page by candlelight. Masons raise Gothic arches with a wheel crane. Coloured light streams from a rose window. |
| 0:47 | **IV · Renaissance** | 76 | The Duomo at dusk as windows light up. A hand sketches a Vitruvian figure by lamplight. Gutenberg's press comes down; the first page multiplies and flies out across a map of Europe. |
| 1:03 | **V · Exploration and science** | 76 | A carrack on a storm sea. Galileo at the telescope, and the four moons of Jupiter through the glass. Newton's laws glow above a brass orrery. |
| 1:19 | **VI · Liberty and genius** | 76 | A quill signs. "We the People" in close-up. A crowd fills the square. |
| 1:28 | *Vienna, 1824* | 80 | Beethoven lays his ear on the piano to feel it. He scrawls the first bars of the theme. At the premiere he is turned around to see the ovation, and the sound closes down to a dull murmur. |
| 1:46 | **VII · Industry and invention** | 96 | A flywheel turns; a locomotive crosses an iron bridge. Edison's lamp stutters on. Morse runs down telegraph wires. The Wright Flyer lifts off. |
| 2:01 | **VIII · Acceleration** | 120 | Fast cuts: radio masts, penicillin under a microscope, a rocket launch, a bootprint on the Moon. A machine room shrinks into a microchip. A glowing timeline is squeezed from centuries to decades to years. |
| 2:15 | **IX · The connected world** | 132 | Light races through an undersea cable. The first web page loads. A farmer, a student and four strangers with phones. A web of links spreads over the night side of the Earth. |
| 2:30 | **X · The next frontier** | 96 | A researcher and an AI watch a protein fold. A doctor reviews a scan the model has flagged. A child asks why the stars shine. Code lets go of the page and settles into a new horizon. |
| 2:50 | **Finale** | 120 | One pull-back: from the child, through a library where scrolls sit beside glowing screens, over a city at night, past the Earth, into golden light. |

### Match cuts

Three objects recur in the same place in the frame, each dissolving out of its ancestor:

- **Scroll → printed page → screen.** The papyrus of chapter I ghosts into Gutenberg's first page, which ghosts into the first web page. The flock of pages over Europe returns as messages flying along the links of the networked globe.
- **Candle → light bulb → network node.** The monk's candle becomes Edison's lamp, and the lamp becomes the first lit node on the globe (placed at Geneva, where the web began).
- **Column → skyscraper.** The city shot opens on a marble column that turns into a tower of lit windows as the camera pulls back.

### Narration

| Time | Line |
|------|------|
| 0:02 | It began with a question. |
| 0:07 · 0:11 · 0:19 | What is true? · What is good? · What is just? |
| 0:50 | From those questions came reason, law, art, and science. |
| 1:33 | A deaf man wrote a symphony of joy. |
| 2:02 | Ideas once carried by ship now cross the world in an instant, |
| 2:11 | and progress that took centuries now takes years. |
| 2:32 | Now we're building minds to think alongside our own. |
| 2:52 | The story isn't finished. |
| 2:57 | It's yours to continue. |

The lines also appear as subtitles in the lower letterbox bar, and the last two return as the end card.

---

## 2. Previewing

Open `index.html` in Chrome or Edge. Files load over `file://`, so no server is needed.

- **Controls:** Space plays or pauses, ←/→ jump 5 s, and there is a scrub bar and a shot menu. The soundtrack plays in sync.
- **URL parameters:**
  - `?t=88` starts at 1:28.
  - `?scale=0.5` draws a half-size canvas for slow machines.
  - `?nosubs` hides the narration subtitles; `?nocaps` hides the chapter captions.
  - `?nograin` and `?nobloom` switch off parts of the finishing pass.

`renderAt(t)` is a pure function of time and all randomness is seeded, so scrubbing, preview and offline render produce identical frames.

## 3. Rendering

You need Node 18+, Playwright with Chromium, and FFmpeg on your PATH.

```bash
cd ode
node render.mjs                      # → out/ode.mp4 (1920×1080, 24 fps, H.264 + AAC)
```

Other outputs:

```bash
node render.mjs --jobs 4             # number of parallel browser pages
node render.mjs --crf 18             # higher quality, larger file (default 23)
node render.mjs --scale 2            # 3840×2160 master
node render.mjs --start 88 --end 106 # one stretch of the film
node render.mjs --nosubs             # without narration subtitles
node render.mjs --no-audio           # picture only
node render.mjs --stills 4,95,180    # single PNG frames
node render.mjs --sheet              # one still per shot, tiled into contact sheets
```

The full film is 4,977 frames. On a 4-core cloud container it renders in about 25 minutes. Frames are piped straight into FFmpeg in parallel chunks, so nothing but the MP4 touches the disk.

Film grain is expensive to encode. At the default settings the file is roughly 100–150 MB; `--nograin` cuts that by more than half.

## 4. Rebuilding the soundtrack

`audio/soundtrack.m4a` is committed, so you only need this if you change the timing, the music or the words.

```bash
node render.mjs --cues               # 1. timings → audio/cues.json
python3 audio/score.py               # 2. notes → MIDI → audio/build/score.wav
KOKORO_DIR=/path/to/model python3 audio/narrate.py   # 3. only if the words changed
python3 audio/mix.py                 # 4. → audio/soundtrack.m4a
```

Requirements:

- **Score:** `pip install mido`, plus FluidSynth and a General MIDI soundfont (`apt install fluidsynth fluid-soundfont-gm`). Set `SOUNDFONT=` to use a better orchestral soundfont; nothing else needs to change.
- **Narration:** `pip install kokoro-onnx soundfile`, plus `kokoro-v1.0.onnx` and `voices-v1.0.bin` from the kokoro-onnx project. The voice is a blend of two stock male voices at 0.8× speed, which measures around 100 Hz.
- **Mix:** `numpy`, `soundfile`, FFmpeg.

To use a human narrator or a different voice, replace the files in `audio/narration/` (mono, 24 kHz, one per line, named as in `cues.json`) and run `mix.py`. To use a recorded score, save it as `audio/build/score.wav` at 48 kHz and run `mix.py`; `timing.js` lists the tempo of every section.

### The score

The cue is in D major throughout, the key of the Ninth's finale.

| Time | Music |
|------|-------|
| 0:00 | A held low D. Horn, then oboe, then flute play three rising notes (F♯–G–A, the first step of the theme) and leave them hanging, as a question. |
| 0:18 | The same harmony as a march: horns, trombones, timpani, a trumpet line. |
| 0:33 | Choir, organ and tubular bells, in a modal turn through B minor. |
| 0:47 | Harp and pizzicato; violins and flute stretch the three notes into a melody. |
| 1:03 | Tremolo strings and timpani for the storm, then celesta and flute for the night sky. |
| 1:19 | Field drum and trumpets. |
| 1:28 | A single low D on the piano. Then the theme's first phrase, alone on the piano. At the premiere the full orchestra and chorus take over its second half, and one bar later the mix drops to a muffled, low-passed murmur with a slow pulse. |
| 1:46 | The sound snaps back. An eighth-note string ostinato, an "anvil" on the off-beats, a brass theme. |
| 2:01 | Sixteenth-note marimba and pizzicato. The harmony climbs a step every bar and brass stabs mark each picture cut. |
| 2:15 | Arrival in D major: glockenspiel and harp figures, long string lines, trumpets. |
| 2:30 | The theme in full for the first time, very quietly: celesta, then flute and clarinet over slow strings. |
| 2:50 | "Ode to Joy" four times through its phrases (A, A′, B, A′), each louder: strings and soft choir; then trumpets; then trombones and organ; then everything, with the melody three octaves deep. A plagal cadence and a held D major chord. |

`mix.py` evens out the loudness between the quietest and loudest sections, ducks the music under each narration line, and adds three small effects (steam, the rocket's rumble, the muffled ovation). The finished mix is 48 kHz stereo at about −16.5 LUFS.

---

## 5. Notes and limits

- **It is illustration, not live action.** The brief describes photographic images. This film answers it in the house style of this repository: stylised, back-lit figures and painted light. People are silhouettes, so faces and fine gesture are suggested rather than shown.
- **The orchestra is a General MIDI soundfont.** The writing is real, but the sound is that of a good sample set from the 2000s, not a recorded orchestra. The chorus sings "ah" rather than Schiller's words.
- **The narrator is synthetic.** It is clear and deep, but it does not act the lines the way a person would.
- **Dates on screen** are the usual ones: Gutenberg's Bible about 1455, Galileo's first observation of Jupiter's moons on 7 January 1610, Morse's line 1844, Edison's lamp 1879, Marconi's transatlantic signal 1901, the Wright brothers 1903, penicillin 1928, ENIAC 1946, Apollo 11 1969, the first microprocessor 1971, the first public web page 1991. The text on the monitor is the wording of that first page as shown by CERN's line-mode browser.
- **The Greek on the scroll** reads ΓΝΩΘΙ ΣΕΑΥΤΟΝ ("know thyself") and Ο ΔΕ ΑΝΕΞΕΤΑΣΤΟΣ ΒΙΟΣ ΟΥ ΒΙΩΤΟΣ ΑΝΘΡΩΠΩΙ ("the unexamined life is not worth living", from Plato's *Apology*).
- **The child's question** and its answer are original lines for this film.

## 6. Credits and licences

- Music: original cue incorporating the "Ode to Joy" theme from Beethoven's Symphony No. 9 (1824, public domain). Played by FluidSynth with the FluidR3 GM soundfont (MIT licence).
- Voice: Kokoro v1.0 (Apache-2.0), run locally.
- Fonts: Cinzel, Cormorant Garamond, IBM Plex Mono, GFS Didot, UnifrakturMaguntia, Pinyon Script (all SIL Open Font License).
- Coastlines: Natural Earth 1:110m land (public domain).
- Opening words of the United States Constitution; text of the first web page (CERN, public domain).
