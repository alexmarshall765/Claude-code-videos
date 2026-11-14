# LIBERTY — The American Project

A 2:00 short film about 250 years of the United States, from 1776 into the near future, with an original hybrid epic score. Every frame is drawn in code on an HTML Canvas: gold linework on black (or aged parchment), surveyor-plate framing, kinetic serif type and a timeline that advances along the bottom. Every note of the score is synthesized in code as well. There's no footage, no photography, no samples and no generated imagery.

Picture and music read the same master timeline, so every cut lands on a downbeat and every headline lands on a beat. Of the 19 big hits, 17 measure within 2 ms of their cues; the other two are soft swells by design and rise within 9 ms.

```
liberty/
├── index.html       player shell (plays the score in sync), plus the vendored fonts
├── timeline.js      MASTER TIMELINE: 134 BPM grid, scene lengths in bars, sync cues in beats
├── liberty.js       the picture: engine, camera, reusable plates, 16 scenes
├── score.mjs        the music: composition, arrangement, mix and master
├── synth.mjs        the synthesizer: oscillators, strings, brass, choir, drums, FX, reverb, limiter
├── render.mjs       headless renderer → MP4 with the score muxed in, PNG sequence or stills
├── audio/           liberty-score.mp3, the score for the browser player
└── fonts/           Cinzel, Cormorant Garamond, IBM Plex Mono (SIL OFL), latin subset
```

Quick start:

```bash
cd liberty
node score.mjs     # compose and render the score (about 1 min) → out/liberty-score.wav
node render.mjs    # render the film with the score (about 13 min on 4 cores) → out/liberty.mp4
```

Or open `index.html` in Chrome, Edge, Safari or Firefox and press **▶ PLAY WITH SOUND**.

---

## 1. Storyboard

The film is exactly 120 s long: 67 bars of 4/4 at 134 BPM, so a beat is about 0.45 s and a bar about 1.8 s. It has 16 scenes. Every chapter except the prologue and the final card has a small-caps chapter marker in the top left and a plate number in the top right. The timeline bar at the bottom runs 1776 → **NOW** → 2076; the stretch after 2026 is dashed, and its marker pulses with the drums.

| # | Time | Bars | Chapter | Picture | Type on screen (sync point) | Music |
|---|------|------|---------|---------|-----------------------------|-------|
| 0 | 0:00–0:07 | 1–4 | *Prologue* | Compass seal draws itself. A wireframe torch assembles and its flame catches at 0:02.7; embers rise. | **LIBERTY** (0:03.6) · *A NATION CONCEIVED IN LIBERTY.* (0:04.5) | A distant drum and an organ drone. Horn and bell state the motif: D, E, **A on the flame**, **D′ on the title**, which lands with a braam, a tam-tam, taikos and choir. |
| 1 | 0:07–0:14 | 5–8 | I · FOUNDING | The Declaration is drafted line by line, then signed. A ring of 13 stars. | **WE HOLD** (0:09.0) / **THESE TRUTHS** (0:09.9) · *LIFE · LIBERTY · THE PURSUIT OF HAPPINESS*, one phrase per beat (0:12.1) | Heartbeat drum, a "quill" shaker, the string ostinato in eighths. Taikos, brass and a choir shout on each truth. The horns try the theme for the first time. |
| 2 | 0:14–0:21 | 9–12 | II · CONSTITUTION | The Capitol rises to its statue. A checks-and-balances triangle. The Bill of Rights ticks in I–X. | **LIMITED GOVERNMENT.** (0:16.1) / **UNLIMITED AMBITION.** (0:17.9) | The beat arrives from a distance. Half a beat of silence, then AMBITION opens the filter with a braam and a brass swell. |
| 3 | 0:21–0:29 | 13–16 | III · EXPANSION | Conic map. The frontier meridian sweeps to the Pacific; Lewis & Clark's route in red; a counter climbs to 3,022,387 sq. mi. | **WE CROSSED A CONTINENT.** (0:25.1) | A galloping bass, war drums on a 3-3-2 pattern, sixteenth-note strings. **The horns play the theme in full.** |
| 4 | 0:29–0:36 | 17–20 | IV · INFRASTRUCTURE | Three blueprint plates on consecutive beats: an Erie Canal lock, the *Clermont*, a B&O locomotive. | **WE BUILT THE ROADS.** (0:32.2) | Machinery ticks, a clank per plate panned left, centre, right, and a string line that climbs bar by bar. A telegraph taps "··– ···" (U S). |
| 5 | 0:36–0:43 | 21–24 | V · INDUSTRY | Brooklyn Bridge, whose last stays complete on LIGHT. A steel-output chart. | **STEEL.** (0:39.4) **RAIL.** (0:39.9) **LIGHT.** (0:40.3) | A snare roll winds up, then stop-time: anvil, taikos, brass and choir walk IV–V–I. LIGHT lands with a braam; the lead enters. |
| 6 | 0:43–0:50 | 25–28 | VI · FLIGHT | The Wright Flyer assembles on its rail and lifts off at 0:46.6. | **WE TOOK TO THE AIR.** (0:47.0) | Breakdown: drums out, choir and strings in. A lift on takeoff with the violins climbing, then timpani and snare roll back in. |
| 7 | 0:50–0:57 | 29–32 | VII · ABUNDANCE | The Model T line indexes forward once per beat and gains parts at each station. | **ABUNDANCE.** (0:51.9) | The groove returns: clockwork marimba, the theme on a square lead. The last bar darkens with a reversed braam. |
| 8 | 0:57–1:04 | 33–36 | VIII · ARSENAL | Three hard cuts on downbeats: Willow Run, then 296,000 aircraft, then 2,710 Liberty ships. | **WE BUILT THE ARSENAL.** (0:57.8) | B minor at full cry: a braam, taikos and a choir shout on every cut, military snare, trombones, strings in octaves. |
| 9 | 1:04–1:12 | 37–40 | IX · PROSPERITY | Interstate corridors draw, one per eighth note; income and life-expectancy charts. | **PROSPERITY, AT SCALE.** (1:08.1) | The sun comes out: F♯ major resolves up to G. Half-time drums, a horn chorale, and a broad string melody that arrives on high D with the headline. |
| 10 | 1:12–1:22 | 41–46 | X · COSMOS | The Saturn V builds; the count runs T−08 to T−01, one per beat. Ignition at 1:14.8, liftoff at 1:15.2 with the frame shaking, Earthrise at 1:18.8. | **WE LEFT THE EARTH.** (1:19.3) | The countdown builds with rolls and risers. **At ignition the music stops: one beat of engines alone.** Then the drop: the theme on the whole band. At Earthrise, a hard cut to vacuum. |
| 11 | 1:22–1:30 | 47–50 | XI · SILICON | A chip assembles. Moore's law on a log chart. | **WE TAUGHT SAND TO THINK.** (1:26.0) | A digital arpeggio whose filter opens along the on-screen curve. Half a beat of silence, then the beat drops in with a braam. |
| 12 | 1:30–1:39 | 51–55 | XII · ACCELERATED INNOVATION | The booster descends; the tower arms close on the catch at 1:33.1 in a burst of sparks. Then COMPUTE, LIFE and ENERGY plates, one per beat. | **WE CAUGHT THE ROCKET.** (1:33.1) · **THE TOOLS OF ABUNDANCE.** (1:35.8) | A tense half-time descent, silence as the arms swing, then the catch. In the last bar the whole band climbs A–B toward a new key. |
| 13 | 1:39–1:46 | 56–59 | XIII · FRONTIER | An Earth→Mars transfer orbit, U.S. electricity (history solid, ambition dashed), the Kardashev scale, a neural lattice. Stars streak past. | **ABUNDANT ENERGY.** (1:39.0) · **NEW WORLDS.** (1:41.2) · **MINDS, AUGMENTED.** (1:43.4) | **The key lifts a whole step to E major.** The peak: the theme on lead, horns, trumpets and strings, choir, war drums. Picture and sound slow to a halt together in a tape stop. |
| 14 | 1:46–1:53 | 60–63 | XIV · TWO HUNDRED FIFTY YEARS | The rewind accelerates: 2024, 1971, then 1969, 1903, 1883, 1800 on single beats. Stars run backward. | **250 YEARS.** (1:49.3) inside the 13 stars | The motif played backwards on bells over a falling bass. A warm swell at 250 YEARS, then timpani and snare build home. |
| 15 | 1:53–2:00 | 64–67 | *Final card* | The seal and torch return; rays leap, embers fly and the stars surge forward on the word. Fade to black. | **ONWARD.** (1:54.6) · *THE BEST IS STILL AHEAD.* (1:56.4) | Three unison blows climb the motif, half a beat of nothing, then it **resolves on ONWARD** with everything at once. The chord rings into the fade. |

On each of the 19 hits listed in `HITS` (`timeline.js`), the picture answers the score with a warm bloom of light and a camera punch. The biggest also get an anamorphic streak, a shockwave ring and frame shake.

---

## 2. The score — "Conceived in Liberty"

An original hybrid epic cue: a progressive electronic track with an orchestra of synthesized strings, brass, choir and war drums on top. It runs exactly 2:00 at 134 BPM in 4/4, in D major, lifting to E major for the last third. It is composed in `score.mjs` and synthesized from scratch by `synth.mjs`. There are no samples and no external music model. The arrangement is generated from the same timeline as the picture, so the score is mixed and mastered to the cut.

**Sound palette, all synthesized.**
- **Strings:** a spiccato ostinato in sixteenths with 3-3-2 accents, legato violins and cellos with vibrato, and a tremolo section for the war.
- **Brass:** French horns and trumpets made from saws whose filter swells like breath, trombones, and overdriven low-brass **braams** on the big hits.
- **Choir:** a formant "aah" choir, sustained and in short shouts.
- **War drums:** a taiko ensemble (several players striking almost together), timpani strokes and rolls, a tam-tam, a military snare.
- **Synths:** JP-8000-style supersaw pads and leads (seven detuned polyBLEP saws per note) with a trance gate, plucked arpeggios, FM glass bells, a drawbar organ.
- **Low end and groove:** a sub-bass sine and a driven mid-bass; house kick, claps, 808-style hats, crashes.
- **Effects:** risers, Shepard tones, reversed cymbals and braams, a rocket roar, a NASA Quindar tone.
- **Space:** a hall, a plate, a 5.5-second cathedral for the hits and choir, and a dotted-eighth ping-pong delay.
- **Mix and master:** kick sidechain pump, mid/side widening, a tape stop, a true-peak lookahead limiter.

**Motif and theme.** The motif is D–E–A–D′ (1–2–5–8) in a dotted rhythm. Horn and bell state it under the title, with the A on the flame and the D′ on LIBERTY. The theme then "reaches" with it bar after bar without resolving: D–E–F♯ over Bm, D–E–G over G, D–E–A over D, E–F♯–A over A. It passes from quiet horns (Founding) to full horns (Expansion), a square lead (Abundance), and the whole band (liftoff, the catch, the frontier). It lands on the octave only at ONWARD, where the final bar's sus4 chord is the motif's own three notes. In the rewind it runs backwards.

**What makes it hit.**
- **Silence before the drops.** The music cuts dead for half a beat before UNLIMITED AMBITION, SAND, the catch, the frontier and ONWARD, and for a whole beat at ignition. Reverb tails and a reversed cymbal ring through; the hit lands about 10 to 19 dB above what precedes it.
- **The key change.** The last bar before the frontier climbs A–B in the bass (IV–V of E), and the frontier opens a whole step up. The film never comes back down.
- **Dynamics.** Loudness range is 8.7 LU: the quietest scene sits about 8 dB below the loudest.

Short-term loudness per scene, from `node score.mjs --report`:

| Scene | LUFS | | Scene | LUFS |
|---|---|---|---|---|
| Prologue | −15.9 | | Arsenal | −12.3 |
| Founding | −19.6 | | Prosperity | −13.7 |
| Constitution | −16.4 | | Cosmos (build → drop → vacuum) | −14.6 |
| Expansion | −14.7 | | Silicon | −16.2 |
| Infrastructure | −14.7 | | Innovation | −13.1 |
| Industry | −13.9 | | **Frontier (peak)** | **−11.2** |
| Flight (breakdown) | −16.3 | | Memory (quiet rewind) | −17.5 |
| Abundance | −13.4 | | **Final** | **−11.4** |

**Harmony.** Mostly vi–IV–I–V (Bm–G–D–A), so headlines tend to land on the tonic.
- Founding uses I–V–vi–IV.
- Industry's three hits walk IV–V–I.
- Arsenal turns to B minor (Bm–G–Em–F♯).
- Prosperity resolves F♯→G as a sunrise.
- Earthrise hangs on Gmaj7 → Asus4.
- Innovation ends A–B, the pivot into E major.
- Frontier is C♯m–A–E–B.
- The rewind falls C♯m–B–A–G♯m.
- The end is a IV–ii7–Vsus–I cadence in E: 250 YEARS on A, the build on F♯m7, the climb on Bsus4, ONWARD on E.

A per-chord chromagram of the finished master finds the composed chord dominant in 67 of 68 chords, key change included. The one exception is bell overtones in the first half-bar of the rewind.

**Delivery.** The master is a 48 kHz / 24-bit WAV of exactly 120.0 s, measured at −14.2 LUFS integrated, −1.2 dBTP true peak and 8.7 LU loudness range (EBU R128 via FFmpeg). `audio/liberty-score.mp3` (192 kbps) is the copy the browser player streams.

```bash
node score.mjs             # out/liberty-score.wav and audio/liberty-score.mp3
node score.mjs --stems     # also out/stems/{kick,drums,taiko,perc,sub,bass,pad,strings,choir,organ,arp,lead,brass,braam,bell,fx,hits}.wav
node score.mjs --report    # loudness per scene, limiter activity and the sync hit list
```

Everything is seeded, so the same timeline always renders the identical file.

**Using a different track.** To use a song from a music model or a composer instead, give them this brief, then run `node render.mjs --audio your-track.wav`. An external track is trimmed to picture and faded over its last 3 s. It won't be cut-accurate the way the generated score is.

> Hybrid epic trailer music with a progressive electronic core, 134 BPM, D major modulating up to E major at 1:38, exactly 2:00. Opens with a distant drum, organ drone and a solo horn stating a rising four-note motif (D–E–A–D); huge braam, tam-tam and choir hit at 0:03.6. Staccato string ostinato and heartbeat from 0:07 with taiko hits at 0:09.0 and 0:09.9. Kick fades in at 0:14; half-beat silence then a hit at 0:17.9. Galloping bass, war drums and heroic horn theme 0:21–0:29. Machinery percussion 0:29. Stop-time hits at 0:39.4, 0:39.9 and 0:40.3. Breakdown with choir and strings 0:43–0:50, lift at 0:46.6. Groove returns 0:50. Dark B-minor war section 0:57–1:04 with braams at 0:57.3, 0:59.1 and 1:00.9. Warm major release with horn chorale and string melody 1:04. Countdown build 1:12, total silence except rocket rumble at 1:14.8, massive drop at 1:15.2, sudden vacuum with soft choir at 1:18.8. Digital arpeggio 1:22, drop at 1:26.0. Tension 1:30, huge impact at 1:33.1, band climbs to a key change. Euphoric full-orchestra-and-supersaw peak 1:38.5–1:45, ending in a tape stop. Quiet reversed bells 1:46, swell at 1:49.3, build, three unison hits from 1:52.8, half-beat silence, final full hit at 1:54.6 ringing out to 2:00.

---

## 3. Previewing and editing

To preview, open `index.html`. Files load over `file://`, so no server is needed.

- **Controls:** **▶ PLAY WITH SOUND** starts the film. Space plays or pauses, ←/→ jump 5 s, and there's a scrub bar, a chapter menu and SOUND ON/OFF.
- **Sync:** while playing, the audio is the clock, so picture and music stay locked.
- **No score:** if `audio/liberty-score.mp3` is missing, the film plays silently.
- **URL parameters:**
  - `?t=75` starts at 1:15.
  - `?theme=parchment` uses sepia ink on aged paper.
  - `?final=ACCELERATE.` swaps the last word.
  - `?noglow` speeds up preview on weak GPUs.
  - `?scale=2` renders a 4K canvas.

**Pacing lives in `timeline.js`.** Each scene has a length in **bars** and named **cues** in beats from its downbeat. For example, `{ id: 'industry', bars: 4, cues: { steel: 8, rail: 9, light: 10 } }` puts STEEL. on bar 3, beat 1.

- `liberty.js` draws to these cues, using `Q.industry.steel` in seconds.
- `score.mjs` composes to them, using `cue('industry', 'steel')`.
- After changing a number, or `BPM` itself, run `node score.mjs` and both picture and music move together. The film's length is bars × 240 / BPM seconds.
- `kick` ranges say where the groove plays and in which pattern: four-on-the-floor, half time, heartbeat or 3-3-2 war drums. The score builds its drums from them, and the picture pulses the timeline marker on the same hits.
- `HITS` lists the strongest moments with a strength from 0 to 1. Each gets an impact in the score, and light and camera movement in the picture.

**How the picture is built.** `renderAt(t)` is a pure function of time. All randomness comes from seeded PRNGs, so scrubbing, preview and offline render produce identical frames.

- Each drawing is a *plate* function: `torch`, `capitol`, `bridge`, `flyer`, `saturnV`, `chip`, `catchTower`, `modelT` and others. They take `(position, scale, progress 0→1)`, so the same drawing assembles in its own scene and reappears in the montage.
- A **camera** moves the scene layer only: a slow push-in on every scene, a punch on every hit, and shake on the biggest (`CAM` and `SHAKE`). The plate border and the timeline stay still.
- The **stars** sit in depth and drift toward the lens. They surge on liftoff, streak as the frontier accelerates, run backward through the rewind and forward again from ONWARD (`STAR_KEYS`).
- Headline letters land white-hot and cool to gold.

**How the music is built.** Each scene has a `score<Scene>()` function made from a few helpers that follow the `HARMONY` table: `pads`, `strs`, `ost` (the string ostinato), `subs`, `bassline`, `arp`, `theme`, `taikos`, `hats`, `claps`, `snareRoll`. `slam(t, k)` is the big hit, scaled by strength. `gap(t, beats)` cuts the silence before a drop. `KEY` sets which scenes play a whole step up.

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
node render.mjs --start 71.6 --end 82.4  # just the Apollo scene, with its music
node render.mjs --stills 4,22,48,115     # review stills (PNG)
node render.mjs --frames                 # PNG sequence in out/frames/ (no encode)
node render.mjs --no-audio               # picture only
node render.mjs --audio other.wav        # a different track (trimmed and faded to picture)
```

A full 1080p30 render is 3,600 frames. It takes about 13 minutes on a 4-core cloud container, rendering four pages in parallel. Each page pipes PNGs straight into its own FFmpeg segment, and the segments are joined without re-encoding. Canvas RGB is converted with the BT.709 matrix that the stream is tagged with, so the gold stays the same hue in every player. Set `CHROMIUM_PATH=/path/to/chrome` to use a specific browser binary.

To change only the music, you don't need to re-render the picture. Re-mux it instead:

```bash
ffmpeg -i out/liberty.mp4 -i out/liberty-score.wav -map 0:v -map 1:a \
  -c:v copy -c:a aac -b:a 320k -t 120 -movflags +faststart out/liberty_rescored.mp4
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
  -c:v copy -c:a aac -b:a 320k -t 120 -movflags +faststart out/liberty.mp4

# Editing master (ProRes 422 HQ + PCM) instead of H.264
ffmpeg -framerate 30 -i out/frames/f_%05d.png -i out/liberty-score.wav \
  -c:v prores_ks -profile:v 3 -pix_fmt yuv422p10le -c:a pcm_s24le out/liberty_master.mov
```

Fine gold lines on black are hard on encoders. Keep CRF at 18 or lower; 14 is the default. For YouTube, upload the 4K master (`--scale 2`) even if your audience watches at 1080p: YouTube gives 4K uploads a higher bitrate, which keeps the hairlines crisp. The −14 LUFS master already matches YouTube and streaming loudness targets.

---

## 5. Refinements for stronger impact

These are already done: the picture is cut to the music on one shared grid; the camera pushes, punches and shakes with the score; hits bloom and ring; the score has silences before its drops and a key change at the peak.

1. **Real players.** Export `--stems` and hand the cue sheet above to a session brass section, a string quartet and a choir. Replacing the synthesized horns, strings and "aah" with recordings, over the same grid, is the single biggest upgrade in warmth and scale.
2. **Motion blur.** Render at 120 fps and blend groups of 4 frames (`ffmpeg -vf tmix=frames=4,fps=30`). The liftoff, the star streaks and the montage flashes will feel filmic.
3. **A longer cut.** The grid makes this cheap: give Cosmos and the final card two more bars each in `timeline.js` for a 2:07 version with more room to breathe at the two biggest moments.
4. **Alternate masters.** Set `TARGET_LUFS` in `score.mjs` to −10 for a louder trailer cut or −23 for broadcast. The `MACRO` table reshapes the energy arc.
5. **Grade.** Lift black to a very slightly warm `#07060a` and add a subtle halation (a blurred copy of the gold channel, screened at 15 %).
6. **Vertical cut.** For 9:16 social, the plates are position-parametric. Duplicate `SCENES` with re-anchored coordinates rather than cropping. The score needs no changes.
7. **Alternate endings.** `?final=ACCELERATE.` gives a sharper, more tech-forward close. *ONWARD.* plays warmer and more universal. Both land on the same chord.

### Fact notes
The figures on screen are rounded, commonly cited values, chosen for a highlight reel rather than a textbook. They include territorial area by acquisition, ~296,000 U.S. military aircraft and 2,710 Liberty ships (1940–45), the Model T's 12.5 h → 93 min chassis assembly and $850 → $260 price, Interstate authorization of 41,000 miles, and transistor counts from the Intel 4004 to the 208 B-transistor Blackwell.

The launch count on screen (T−08 to T−01) ticks once per beat of the score, not once per second.

The 2026–2076 electricity curve and the Kardashev value are labelled **PROJECTED / AMBITION**. They are aspirational, not forecasts.
