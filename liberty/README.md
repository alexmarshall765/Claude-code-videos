# LIBERTY — The American Project

A 2:15 short film about 250 years of the United States, from 1776 into the near future, with an original electronic score. Every frame is drawn in code on an HTML Canvas: gold linework on black (or aged parchment), surveyor-plate framing, kinetic serif type and a timeline that advances along the bottom. Every note of the score is synthesized in code as well. There's no footage, no photography, no samples and no generated imagery.

Picture and music read the same master timeline, so every cut lands on a downbeat and every headline lands on a beat. The result is sample-accurate: hard hits measure 0 ms from their cues.

```
liberty/
├── index.html       player shell (plays the score in sync), plus the vendored fonts
├── timeline.js      MASTER TIMELINE: 120 BPM grid, scene lengths in bars, sync cues in beats
├── liberty.js       the picture: engine, reusable plates, 16 scenes
├── score.mjs        the music: composition, arrangement, mix and master
├── synth.mjs        the synthesizer: oscillators, filters, drums, FX, reverb, limiter, loudness
├── render.mjs       headless renderer → MP4 with the score muxed in, PNG sequence or stills
├── audio/           liberty-score.mp3, the score for the browser player
└── fonts/           Cinzel, Cormorant Garamond, IBM Plex Mono (SIL OFL), latin subset
```

Quick start:

```bash
cd liberty
node score.mjs     # compose and render the score (about 1 min) → out/liberty-score.wav
node render.mjs    # render the film with the score (about 15 min on 4 cores) → out/liberty.mp4
```

Or open `index.html` in Chrome, Edge, Safari or Firefox and press **▶ PLAY WITH SOUND**.

---

## 1. Storyboard

The film is 135 s long: 67½ bars of 4/4 at 120 BPM, so a beat is 0.5 s and a bar is 2 s. It has 16 scenes. Every chapter except the prologue and the final card has a small-caps chapter marker in the top left and a plate number in the top right. The timeline bar at the bottom runs 1776 → **NOW** → 2076; the stretch after 2026 is dashed, and its marker pulses with the kick drum.

| # | Time | Bars | Chapter | Picture | Type on screen (sync point) | Music |
|---|------|------|---------|---------|-----------------------------|-------|
| 0 | 0:00–0:08 | 1–4 | *Prologue* | Compass seal draws itself. A wireframe torch assembles and its flame catches at 0:03. Sun rays begin to turn. | **LIBERTY** (0:04) · *A NATION CONCEIVED IN LIBERTY.* (0:05) | Organ pedal on D. Bell and horn state the motif: D (0:02), E, **A on the flame**, **D′ on the title**, with an impact and a choir bloom. |
| 1 | 0:08–0:16 | 5–8 | I · FOUNDING | The Declaration is drafted line by line, then signed with a looping flourish. A ring of 13 stars. | **WE HOLD** (0:10) / **THESE TRUTHS** (0:11) · *LIFE · LIBERTY · THE PURSUIT OF HAPPINESS*, one phrase per beat (0:13.5 / 0:14 / 0:14.5) | Heartbeat kick, a "quill" shaker and a plucked eighth-note arpeggio. Taiko and brass on each truth. Three rising chimes on the last line. |
| 2 | 0:16–0:24 | 9–12 | II · CONSTITUTION | The Capitol rises from the ground up to the statue, with a 288 FT dimension line. A checks-and-balances triangle. The Bill of Rights ticks in I–X. | **LIMITED GOVERNMENT.** (0:18) / **UNLIMITED AMBITION.** (0:20) | The beat arrives from a distance: a low-passed kick that opens fully on AMBITION, with a brass swell. The ten amendments are ten sixteenth notes up the scale. |
| 3 | 0:24–0:32 | 13–16 | III · EXPANSION | Conic map. The frontier meridian sweeps to the Pacific while the territory hatches in. Lewis & Clark's route in red. A counter climbs to 3,022,387 sq. mi. | **WE CROSSED A CONTINENT.** (0:28) | A "frontier gallop" bass of two sixteenths after every kick. Open-fifth brass and timpani on the headline. |
| 4 | 0:32–0:40 | 17–20 | IV · INFRASTRUCTURE | Three blueprint plates on consecutive beats: an Erie Canal lock, the *Clermont*, a B&O locomotive. | **WE BUILT THE ROADS.** (0:36) | Machinery ticks. Each plate gets a clank panned left, centre and right. A telegraph taps "··– ···" (U S) in the last bar. |
| 5 | 0:40–0:48 | 21–24 | V · INDUSTRY | Brooklyn Bridge, whose last stays complete on LIGHT. A steel-output chart. Milestones tick in one per beat. | **STEEL.** (0:44) **RAIL.** (0:44.5) **LIGHT.** (0:45) | A rolling bass, then stop-time: anvil, kick and brass hits walk IV–V–I. The groove and the lead return on LIGHT. |
| 6 | 0:48–0:56 | 25–28 | VI · FLIGHT | The Wright Flyer assembles on its rail and lifts off on the downbeat at 0:52. | **WE TOOK TO THE AIR.** (0:52.5) | Breakdown: drums out, choir in, the filter rising toward takeoff. A lift and the motif on takeoff, then a snare roll back into the groove. |
| 7 | 0:56–1:04 | 29–32 | VII · ABUNDANCE | The Model T line indexes forward once per beat, like clockwork, and gains parts at each station. | **ABUNDANCE.** (0:58) | The groove returns. Clockwork marimba sixteenths, a soft clack where the line stops, and the hook on a square lead. |
| 8 | 1:04–1:12 | 33–36 | VIII · ARSENAL | Three hard cuts on downbeats: Willow Run, then 296,000 aircraft, then 2,710 Liberty ships. | **WE BUILT THE ARSENAL.** (1:04.5) | B minor, war drums, driven bass and a string tremolo. An impact on every cut, with counter ticks while the red numbers climb. |
| 9 | 1:12–1:20 | 37–40 | IX · PROSPERITY | Interstate corridors draw, one per eighth note, alongside real-median-income and life-expectancy charts. | **PROSPERITY, AT SCALE.** (1:16) | The sun comes out: F♯ major resolves up to G. Half-time drums, a brass chorale and choir, and a bell ping for each corridor. |
| 10 | 1:20–1:32 | 41–46 | X · COSMOS | The Saturn V builds. The countdown ticks T−4.0 to T−0.5, one per beat. Ignition at 1:23.5, liftoff at 1:24, Earthrise at 1:28. | **WE LEFT THE EARTH.** (1:28.5) | Organ crescendo, countdown beeps, a snare roll and a riser lead to **the drop at liftoff**. At Earthrise there is a hard cut to vacuum: a Quindar tone, choir and a distant bell. |
| 11 | 1:32–1:40 | 47–50 | XI · SILICON | A chip assembles. Moore's law on a log chart. | **WE TAUGHT SAND TO THINK.** (1:36) | A digital arpeggio whose filter opens along the on-screen transistor curve, with data glitches. The beat drops in on the headline. |
| 12 | 1:40–1:50 | 51–55 | XII · ACCELERATED INNOVATION | The booster descends and the tower arms close on the catch at 1:44. Then COMPUTE, LIFE and ENERGY plates, one per beat. | **WE CAUGHT THE ROCKET.** (1:44) · **THE TOOLS OF ABUNDANCE.** (1:47) | Half-time descent with a falling engine tone that slows with the booster. Impact and steel-on-steel on the catch, then the full drive. |
| 13 | 1:50–1:58 | 56–59 | XIII · FRONTIER | An Earth→Mars transfer orbit, U.S. electricity (history solid, ambition dashed), the Kardashev scale and a neural lattice. | **ABUNDANT ENERGY.** (1:50.5) · **NEW WORLDS.** (1:53) · **MINDS, AUGMENTED.** (1:55.5) | The peak: gated supersaws, the full hook, a Shepard tone that rises forever, and a chime a step higher on each statement. A **tape stop** on the last beat. |
| 14 | 1:58–2:08 | 60–64 | XIV · TWO HUNDRED FIFTY YEARS | Rewind montage, one symbol every two beats: 2024 → 1971 → 1969 → 1903 → 1883 → 1800. | **250 YEARS.** (2:04) inside the 13 stars | A quiet rewind: the motif played backwards on bells, each note preceded by its reversed echo, with tick-tock and a heartbeat. A warm swell at 250 YEARS, then the build home. |
| 15 | 2:08–2:15 | 65–67½ | *Final card* | The seal and torch return and the flame flares. The timeline sweeps to 2076, then a fade to black. | **ONWARD.** (2:10) · *THE BEST IS STILL AHEAD.* (2:12) | The motif climbs D–E–A over its own Asus4 chord and **resolves to D′ on ONWARD**: everything hits at once. The chord rings into the fade under a rising shimmer. |

The strongest hits also add a brief warm bloom of light to the picture: LIBERTY, UNLIMITED AMBITION, LIGHT, takeoff, liftoff, the catch, 250 YEARS and ONWARD. The `HITS` list in `timeline.js` drives these blooms.

---

## 2. The score — "Conceived in Liberty"

An original progressive electronic track, about 2:15 long, at 120 BPM in 4/4 and D major. It is composed in `score.mjs` and synthesized from scratch by `synth.mjs`. There are no samples and no external music model. The arrangement is generated from the same timeline as the picture, so the score is mixed and mastered to the cut.

**Sound palette, all synthesized.**
- **Synths:** JP-8000-style supersaw pads and leads (seven detuned polyBLEP saws per note), plucked arpeggios, FM glass bells and a drawbar organ.
- **Choir and brass:** a formant "aah" choir, and brass made from saws whose filter swells like breath.
- **Bass:** a sub-bass sine and a driven mid-bass.
- **Drums:** house kick, claps, 808-style hats, crash and reverse crash, taiko and toms, anvils.
- **Effects:** risers, Shepard tones, a rocket roar and a NASA Quindar tone.
- **Space:** an 8-line FDN hall, a plate and a dotted-eighth ping-pong delay.
- **Mix and master:** kick sidechain pump, mid/side widening, a tape stop, and a true-peak lookahead limiter.

**Motif.** The motif is D–E–A–D′ (1–2–5–8) in a dotted rhythm. The bell and horn state it under the title, with the A on the flame and the D′ on LIBERTY. Every drop then "reaches" with it without resolving: D–E–F♯ over Bm, D–E–G over G, D–E–A over D, E–F♯–A over A. It lands on D′ only at ONWARD, where the final bar's Asus4 chord is the motif's own three notes. In the rewind it runs backwards.

**Form and energy.** The song builds progressively, with three deliberate breaths. Short-term loudness per scene, from `node score.mjs --report`:

| Scene | LUFS | | Scene | LUFS |
|---|---|---|---|---|
| Prologue | −16.1 | | Arsenal | −12.7 |
| Founding | −16.0 | | Prosperity | −13.6 |
| Constitution | −15.8 | | Cosmos (build → drop → vacuum) | −14.1 |
| Expansion | −14.8 | | Silicon | −15.1 |
| Infrastructure | −14.6 | | Innovation | −13.2 |
| Industry | −13.8 | | **Frontier (peak)** | **−11.6** |
| Flight (breakdown) | −15.1 | | Memory (quiet rewind) | −16.4 |
| Abundance | −13.2 | | Final | −12.1 |

**Harmony.** Mostly vi–IV–I–V (Bm–G–D–A), so headlines tend to land on the tonic.
- Founding uses I–V–vi–IV.
- Industry's three hits walk IV–V–I.
- Arsenal turns to B minor (Bm–G–Em–F♯).
- Prosperity resolves F♯→G as a sunrise.
- Earthrise hangs on Gmaj7 → Asus4.
- The end is a IV–ii7–Vsus–I cadence: 250 YEARS on G, the build on Em7, the climb on Asus4, ONWARD on D.

A per-bar chromagram confirms the composed chord is dominant in 65 of 66 bars. The one exception is the organ pedal under the prologue's G.

**Delivery.** The master is a 48 kHz / 24-bit WAV of exactly 135.0 s, measured at −14.1 LUFS integrated, −1.2 dBTP true peak and 5.1 LU loudness range (EBU R128 via FFmpeg). `audio/liberty-score.mp3` (192 kbps) is the copy the browser player streams.

```bash
node score.mjs             # out/liberty-score.wav and audio/liberty-score.mp3
node score.mjs --stems     # also out/stems/{kick,drums,perc,sub,bass,pad,choir,organ,arp,lead,brass,bell,fx,hits}.wav
node score.mjs --report    # loudness per scene and the sync hit list
```

Everything is seeded, so the same timeline always renders the identical file.

**Using a different track.** To use a song from a music model or a composer instead, give them this brief, then run `node render.mjs --audio your-track.wav`. An external track is trimmed to picture and faded over its last 3 s. It won't be cut-accurate the way the generated score is.

> Progressive house / cinematic electronic, 120 BPM, D major, exactly 2:15. Opens with a cathedral organ pedal and glass bells stating a rising four-note motif (D–E–A–D) with an impact at 0:04. A heartbeat pulse and plucked arpeggio at 0:08; the kick fades in from a distance at 0:16 and opens fully at 0:20; galloping bass at 0:24; machinery percussion at 0:32; stop-time hits at 0:44, 0:44.5 and 0:45, then the lead enters. Breakdown with choir 0:48–0:56, lift at 0:52. Clockwork marimba groove 0:56. Dark B-minor war drums 1:04–1:12 with hits at 1:04, 1:06 and 1:08. Warm major release with brass chorale 1:12. Countdown build 1:20–1:24 into a big supersaw drop at 1:24; total silence with a soft choir at 1:28. Digital arpeggio 1:32 with the beat dropping in at 1:36. Half-time tension 1:40, huge impact at 1:44, full drive. Euphoric peak 1:50–1:58 ending in a tape stop. Quiet reversed bells and a ticking clock 1:58–2:04, swell at 2:04, building to a final full-band hit at 2:10 that rings out to silence at 2:15.

---

## 3. Previewing and editing

To preview, open `index.html`. Files load over `file://`, so no server is needed.

- **Controls:** **▶ PLAY WITH SOUND** starts the film. Space plays or pauses, ←/→ jump 5 s, and there's a scrub bar, a chapter menu and SOUND ON/OFF.
- **Sync:** while playing, the audio is the clock, so picture and music stay locked (measured drift is under 6 ms).
- **No score:** if `audio/liberty-score.mp3` is missing, the film plays silently.
- **URL parameters:**
  - `?t=82` starts at 1:22.
  - `?theme=parchment` uses sepia ink on aged paper.
  - `?final=ACCELERATE.` swaps the last word.
  - `?noglow` speeds up preview on weak GPUs.
  - `?scale=2` renders a 4K canvas.

**Pacing lives in `timeline.js`.** Each scene has a length in **bars** and named **cues** in beats from its downbeat. For example, `{ id: 'industry', bars: 4, cues: { steel: 8, rail: 9, light: 10 } }` puts STEEL. on bar 3, beat 1.

- `liberty.js` draws to these cues, using `Q.industry.steel` in seconds.
- `score.mjs` composes to them, using `cue('industry', 'steel')`.
- After changing a number, run `node score.mjs` and both picture and music move together.
- `kick` ranges say where the groove plays: four-on-the-floor, half time or heartbeat. The score builds its drums from them, and the picture pulses the timeline marker on the same beats.
- `HITS` lists the strongest moments. Each gets an impact in the score and a bloom in the picture.

**How it is built.** `renderAt(t)` is a pure function of time. All randomness comes from seeded PRNGs, so scrubbing, preview and offline render produce identical frames.

Each drawing is a *plate* function: `torch`, `capitol`, `bridge`, `flyer`, `saturnV`, `chip`, `catchTower`, `modelT` and others. They take `(position, scale, progress 0→1)`, so the same drawing assembles in its own scene and reappears in the montage.

On the music side, each scene has a `score<Scene>()` function built from a few helpers: `pads`, `subs`, `bassline`, `arp`, `hook`, `hats`, `claps` and `snareRoll`. They follow the `HARMONY` table, so changing a chord changes every part that plays over it.

---

## 4. Rendering and exporting

You need Node 18+, Playwright (`npm i playwright && npx playwright install chromium`, or an existing install) and FFmpeg on your PATH. Neither the score nor the picture needs any other dependency.

```bash
cd liberty
node score.mjs                           # 1. the score (about 1 min)

# 2. Full film → out/liberty.mp4 (1920×1080, 30 fps, H.264 CRF 14, BT.709, AAC 320k)
node render.mjs                          #    the generated score is muxed in automatically

# Other masters
node render.mjs --workers 6              # more parallel browser pages (default: CPU count, max 6)
node render.mjs --fps 60                 # 60 fps
node render.mjs --scale 2                # 3840×2160 4K UHD
node render.mjs --theme parchment        # parchment variant
node render.mjs --start 80 --end 92      # just the Apollo scene, with its music
node render.mjs --stills 4,22,48,131     # review stills (PNG)
node render.mjs --frames                 # PNG sequence in out/frames/ (no encode)
node render.mjs --no-audio               # picture only
node render.mjs --audio other.wav        # a different track (trimmed and faded to picture)
```

A full 1080p30 render is 4,050 frames. It takes about 15 minutes on a 4-core cloud container, rendering four pages in parallel. Each page pipes PNGs straight into its own FFmpeg segment, and the segments are joined without re-encoding. Canvas RGB is converted with the BT.709 matrix that the stream is tagged with, so the gold stays the same hue in every player. Set `CHROMIUM_PATH=/path/to/chrome` to use a specific browser binary.

To change only the music, you don't need to re-render the picture. Re-mux it instead:

```bash
ffmpeg -i out/liberty.mp4 -i out/liberty-score.wav -map 0:v -map 1:a \
  -c:v copy -c:a aac -b:a 320k -t 135 -movflags +faststart out/liberty_rescored.mp4
```

### Manual FFmpeg steps (from a PNG sequence)

```bash
# 1. Frames → video (BT.709 conversion and tags)
ffmpeg -framerate 30 -i out/frames/f_%05d.png \
  -vf "scale=out_color_matrix=bt709:out_range=tv,format=yuv420p" \
  -c:v libx264 -preset slow -crf 14 -tune animation \
  -color_primaries bt709 -color_trc bt709 -colorspace bt709 \
  -movflags +faststart out/liberty_silent.mp4

# 2. Add the score (already mastered and faded to the picture: no extra fades)
ffmpeg -i out/liberty_silent.mp4 -i out/liberty-score.wav -map 0:v -map 1:a \
  -c:v copy -c:a aac -b:a 320k -t 135 -movflags +faststart out/liberty.mp4

# Editing master (ProRes 422 HQ + PCM) instead of H.264
ffmpeg -framerate 30 -i out/frames/f_%05d.png -i out/liberty-score.wav \
  -c:v prores_ks -profile:v 3 -pix_fmt yuv422p10le -c:a pcm_s24le out/liberty_master.mov
```

Fine gold lines on black are hard on encoders. Keep CRF at 18 or lower; 14 is the default. For YouTube, upload the 4K master (`--scale 2`) even if your audience watches at 1080p: YouTube gives 4K uploads a higher bitrate, which keeps the hairlines crisp. The −14 LUFS master already matches YouTube and streaming loudness targets.

---

## 5. Refinements for stronger impact

These are already done: the picture is cut to the music on one shared grid, with light blooms on the strongest beats and sound design woven into the score.

1. **Camera moves.** Add a slow push-in on the scene layer only, 1.00 → 1.03 per scene, with a 0.5 % "punch" on each `HITS` entry. Leave the chrome and the timeline still so the hairlines don't crawl.
2. **Motion blur.** Render at 120 fps and blend groups of 4 frames (`ffmpeg -vf tmix=frames=4,fps=30`). The liftoff, booster descent and montage flashes will feel filmic.
3. **Literal acceleration.** `timeline.js` could carry a tempo per scene. Stepping from 120 to 128 BPM in the silent Earthrise bar would make ACCELERATED INNOVATION literally faster, and nobody would hear the seam.
4. **Real players.** Export `--stems` and hand the cue sheet above to a session brass section and a choir. Replacing the synth brass and "aah" with recordings, over the same grid, is the single biggest upgrade in warmth.
5. **Alternate masters.** Set `TARGET_LUFS` in `score.mjs` to −10 for a louder trailer cut or −23 for broadcast. The per-scene `MACRO` gains reshape the energy arc.
6. **Grade.** Lift black to a very slightly warm `#07060a` and add a subtle halation (a blurred copy of the gold channel, screened at 15 %).
7. **Vertical cut.** For 9:16 social, the plates are position-parametric. Duplicate `SCENES` with re-anchored coordinates rather than cropping. The score needs no changes.
8. **Alternate endings.** `?final=ACCELERATE.` gives a sharper, more tech-forward close. *ONWARD.* plays warmer and more universal. Both land on the same D′.

### Fact notes
The figures on screen are rounded, commonly cited values, chosen for a highlight reel rather than a textbook. They include territorial area by acquisition, ~296,000 U.S. military aircraft and 2,710 Liberty ships (1940–45), the Model T's 12.5 h → 93 min chassis assembly and $850 → $260 price, Interstate authorization of 41,000 miles, and transistor counts from the Intel 4004 to the 208 B-transistor Blackwell.

The 2026–2076 electricity curve and the Kardashev value are labelled **PROJECTED / AMBITION**. They are aspirational, not forecasts.
