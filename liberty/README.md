# LIBERTY — The American Project

A 2:15 short film about 250 years of the United States, from 1776 into the near future. Every frame is drawn in code on an HTML Canvas: gold linework on black (or aged parchment), surveyor-plate framing, kinetic serif type and a timeline that advances along the bottom. There's no footage, no photography and no generated imagery.

```
liberty/
├── index.html     player shell, plus the vendored fonts
├── liberty.js     the animation: engine, reusable plates, 16 scenes, master timeline
├── render.mjs     headless renderer → PNG sequence or MP4 (with optional music)
└── fonts/         Cinzel, Cormorant Garamond, IBM Plex Mono (SIL OFL), latin subset
```

---

## 1. Storyboard

The film runs 135 s, with 16 scenes driven by one master timeline (`SCENES` in `liberty.js`). Every chapter except the prologue and the final card has a small-caps chapter marker in the top left and a plate number in the top right. The timeline bar at the bottom runs 1776 → **NOW** → 2076; the stretch after 2026 is dashed.

| # | Time | Chapter | Visual | Type on screen |
|---|------|---------|--------|----------------|
| 0 | 0:00–0:08 | *Prologue* | Compass seal (72 degree ticks, interlocked squares) draws itself. A wireframe torch assembles, the flame ignites at 0:03 and sun rays begin to turn. | **LIBERTY** · *A NATION CONCEIVED IN LIBERTY.* |
| 1 | 0:08–0:17 | I · FOUNDING | Declaration drafted line by line, then a looping signature flourish. A ring of 13 stars. | **WE HOLD / THESE TRUTHS** · quote · *LIFE · LIBERTY · THE PURSUIT OF HAPPINESS* |
| 2 | 0:17–0:26 | II · CONSTITUTION | Capitol elevation rises from the ground up: wings, portico, drum, dome ribs, statue, with a 288 FT dimension line. A checks-and-balances triangle with pulses travelling both ways. Bill of Rights I–X ticks in. | **LIMITED GOVERNMENT. / UNLIMITED AMBITION.** |
| 3 | 0:26–0:35 | III · EXPANSION | Conic-projection map with graticule. A frontier meridian sweeps from the Mississippi to the Pacific while the territory hatches in. Lewis & Clark's route in red. Acquisitions label themselves; a counter climbs from 888,685 to 3,022,387 sq. mi. | **WE CROSSED A CONTINENT.** |
| 4 | 0:35–0:43 | IV · INFRASTRUCTURE | Three blueprint plates: an Erie Canal lock with water rising, the *Clermont*'s turning paddlewheel, a B&O locomotive with smoke rings. | **WE BUILT THE ROADS.** |
| 5 | 0:43–0:52 | V · INDUSTRY | Brooklyn Bridge: towers with gothic arches, catenary cables, suspenders, the diagonal-stay web, a 1,595 FT dimension. A steel-output chart climbs. Milestones list. | **STEEL. RAIL. LIGHT.** |
| 6 | 0:52–0:59 | VI · FLIGHT | Wright Flyer in 3/4 view assembles on its launch rail: wings, struts, wire bracing, canard, rudders, spinning props. It lifts off along a dashed trajectory while streamlines rush past. | **WE TOOK TO THE AIR.** |
| 7 | 0:59–1:06 | VII · ABUNDANCE | Assembly line: Model Ts gain frame → axles → body → top as they pass four stations. Counters show assembly time 750 → 93 min, price $850 → $260, and 15,000,000 built. | **ABUNDANCE.** |
| 8 | 1:06–1:14 | VIII · ARSENAL | Three hard cuts with flashes: the Willow Run factory, a grid of aircraft filling as a red counter reaches 296,000, Liberty ships multiplying to 2,710. | **WE BUILT THE ARSENAL.** |
| 9 | 1:14–1:22 | IX · PROSPERITY | 13 interstate corridors draw across the map. Interstate miles count to 41,000; a real-median-family-income chart (×2, 1947–73) and life expectancy. | **PROSPERITY, AT SCALE.** |
| 10 | 1:22–1:32 | X · COSMOS | Saturn V builds stage by stage with labels and a 363 FT dimension. Countdown, ignition and liftoff. Cut to Earthrise over the lunar limb, with the LM *Eagle*. | **WE LEFT THE EARTH.** |
| 11 | 1:32–1:41 | XI · SILICON | A chip assembles (pins, die, four cores, routed traces) and signal pulses run along the traces. Moore's law on a log chart, 2,300 → 208 billion transistors. | **WE TAUGHT SAND TO THINK.** |
| 12 | 1:41–1:50 | XII · ACCELERATED INNOVATION | Booster descends on its plume, decelerates, and the tower arms close (13 Oct 2024). Then three plates: COMPUTE (racks with blinking LEDs), LIFE (double helix), ENERGY (atom). | **WE CAUGHT THE ROCKET.** · **THE TOOLS OF ABUNDANCE.** |
| 13 | 1:50–1:59 | XIII · FRONTIER | Heliocentric chart with an Earth→Mars transfer orbit and a moving ship. U.S. electricity chart: history solid, ambition dashed to 2076. A Kardashev counter K 0.728 → 0.800. A neural lattice for AI-augmented discovery. | **ABUNDANT ENERGY. → NEW WORLDS. → MINDS, AUGMENTED.** |
| 14 | 1:59–2:08 | XIV · TWO HUNDRED FIFTY YEARS | Rewind montage, about 1 s per symbol with flash cuts: booster 2024 → chip 1971 → Saturn V 1969 → Flyer 1903 → bridge 1883 → Capitol 1800. The timeline marker snaps back to 1776. | **250 YEARS.** inside the 13 stars |
| 15 | 2:08–2:15 | *Final card* | Seal and torch return larger, the flame flares and the timeline sweeps to 2076, then fade to black. | **ONWARD.** · *THE BEST IS STILL AHEAD.* |

---

## 2. Previewing and editing

To preview, open `index.html` in Chrome or Edge. Files load over `file://`, so no server is needed.

- **Controls:** Space plays or pauses, ←/→ jump 5 s, and there's a scrub bar and a chapter menu.
- **URL parameters:**
  - `?t=82` starts at 1:22.
  - `?theme=parchment` uses sepia ink on aged paper.
  - `?final=ACCELERATE.` swaps the last word.
  - `?noglow` speeds up preview on weak GPUs.
  - `?scale=2` renders a 4K canvas.

**Pacing.** Edit `dur` in the `SCENES` array at the bottom of `liberty.js`. Start times recompute automatically. Within a scene, beats are written as `seg(t, start, end)` windows in local seconds, so each line of type or each drawing can be retimed on its own.

**How it is built.** `renderAt(t)` is a pure function of time. All randomness comes from seeded PRNGs, so scrubbing, preview and offline render produce identical frames.

Each drawing is a *plate* function: `torch`, `capitol`, `bridge`, `flyer`, `saturnV`, `chip`, `catchTower`, `modelT` and others. They take `(position, scale, progress 0→1)`, so the same drawing assembles in its own scene and reappears in the montage.

---

## 3. Rendering and exporting

You need Node 18+, Playwright (`npm i playwright && npx playwright install chromium`, or an existing install) and FFmpeg on your PATH.

```bash
cd liberty

# Full film → out/liberty.mp4 (1920×1080, 30 fps, H.264 CRF 14, yuv420p)
node render.mjs

# With music: muxed, fade-in 0.5 s, fade-out over the last 3 s, trimmed to picture
node render.mjs --audio path/to/score.wav

# Other masters
node render.mjs --fps 60                 # 60 fps
node render.mjs --scale 2                # 3840×2160 4K UHD
node render.mjs --theme parchment        # parchment variant
node render.mjs --start 82 --end 92      # just the Apollo scene
node render.mjs --stills 4,22,48,131     # review stills (PNG)
node render.mjs --frames                 # PNG sequence in out/frames/ (no encode)
```

A full 1080p30 render is 4,050 frames and takes about 18 minutes on a 4-core cloud container (about 0.27 s/frame). The renderer pipes PNGs straight into FFmpeg, so no intermediate frames touch the disk. Set `CHROMIUM_PATH=/path/to/chrome` to use a specific browser binary.

### Manual FFmpeg steps (from a PNG sequence)

```bash
# 1. Frames → video
ffmpeg -framerate 30 -i out/frames/f_%05d.png \
  -c:v libx264 -preset slow -crf 14 -tune animation -pix_fmt yuv420p \
  -color_primaries bt709 -color_trc bt709 -colorspace bt709 \
  -movflags +faststart out/liberty.mp4

# 2. Add the music track (picture is 135 s; fade audio out over the final 3 s)
ffmpeg -i out/liberty.mp4 -i score.wav -map 0:v -map 1:a \
  -c:v copy -c:a aac -b:a 320k \
  -af "afade=t=in:d=0.5,afade=t=out:st=132:d=3" -shortest \
  out/liberty_scored.mp4

# Editing master (ProRes 422 HQ) instead of H.264
ffmpeg -framerate 30 -i out/frames/f_%05d.png -c:v prores_ks -profile:v 3 \
  -pix_fmt yuv422p10le out/liberty_master.mov
```

Fine gold lines on black are hard on encoders. Keep CRF at 18 or lower; 14 is the default. For YouTube, upload the 4K master (`--scale 2`) even if your audience watches at 1080p: YouTube gives 4K uploads a higher bitrate, which keeps the hairlines crisp.

---

## 4. Score

The score is called *"Conceived in Liberty"* and runs 2:15, in D major moving toward A major. It builds from 60 BPM to 92 BPM.

**Palette:**
- Low strings and divisi violins.
- Cathedral pipe organ (16′ and 32′ pedal).
- French horns and trumpets, with trombones held back for the Arsenal and the finale.
- Timpani, taiko and anvil.
- A restrained electronic layer: analog-synth arpeggios, sub-bass pulses and granular shimmer.
- Wordless choir, used only twice.

**Motif:** a four-note rising "Liberty" figure (D–E–A–D′) that is stated, developed and fully resolved only at the last card.

| Time | Scene | Music |
|------|-------|-------|
| 0:00 | Prologue | Organ pedal D and high string harmonics. A single struck bell plus a reversed-cymbal bloom at the **0:03 flame ignition**. Solo horn states the motif under **LIBERTY** (0:03.7). |
| 0:08 | Founding | Quiet quill-scratch foley texture. Cellos take the motif; pizzicato basses walk. A soft snare roll enters at **WE HOLD** (0:09.8). |
| 0:17 | Constitution | Strings move into three-part counterpoint (three branches). Horns swell on **UNLIMITED AMBITION** (0:21.4). |
| 0:26 | Expansion | 6/8 string ostinato, the "frontier gallop", building with the map sweep. Open-fifth brass at **WE CROSSED A CONTINENT** (0:30.6). |
| 0:35 | Infrastructure | Mechanical col-legno rhythm and low timpani. Timpani + brass hit on **WE BUILT THE ROADS** (0:39). |
| 0:43 | Industry | Anvil strikes land on each word: **STEEL** (0:46.6), **RAIL** (0:47.1), **LIGHT** (0:47.6). On LIGHT the trumpets enter. |
| 0:52 | Flight | Percussion drops out. Woodwinds and high violins lift at **takeoff (0:55)**: a held breath. |
| 0:59 | Abundance | Clockwork ostinato (marimba plus a ticking synth), major key and warm. |
| 1:06 | Arsenal | Full brass and taiko, minor mode. Hard hits on the **cuts at 1:08.6 and 1:11.2**. The red counters ride a string tremolo. |
| 1:14 | Prosperity | Release into a broad Americana chorale in the horns, with the motif in augmentation. |
| 1:22 | Cosmos | An organ cluster crescendos through the countdown. **Ignition at 1:25.9** brings in the full orchestra and 32′ organ. Hard cut to silence plus choir at the **Earthrise (1:28.4)**. |
| 1:32 | Silicon | Analog arpeggio at 1/16ths. The filter opens along the Moore's-law curve, with strings layered in. |
| 1:41 | Innovation | Sub-bass pulse descends with the booster. Impact plus a brass stab at the **catch (~1:45)**, then a hybrid string-and-synth drive. |
| 1:50 | Frontier | A rising Shepard-tone build under a brass chorale. Each statement (1:50.8 / 1:54 / 1:56.4) lifts a step. |
| 1:59 | Memory | Reversed-cymbal swell into every montage cut (one every ~1.05 s). Motif fragments play in reverse order, and the tempo seems to rewind. Breath at **250 YEARS** (2:05.7). |
| 2:08 | Final | Full statement and resolution of the motif: organ, brass, choir, timpani. Arrival chord on **ONWARD** (2:10). Hold, then cut on the fade to black (2:14–2:15). |

Delivery spec: 48 kHz / 24-bit WAV, exactly 135.0 s, peaking around −1 dBTP and about −14 LUFS integrated for web.

**Generation prompt.** For a music model, or as a brief for a composer:

> Cinematic orchestral score, 2 min 15 s, inspiring and proud. Starts with a solemn pipe-organ pedal and a solo French horn playing a rising four-note theme. Then strings build a steady galloping ostinato, timpani and anvil hits, and brass grows heroic. A sudden quiet lift with woodwinds, then mechanical clockwork rhythm, then a massive brass-and-taiko war section. Then a warm Americana chorale. An organ crescendo explodes into full orchestra (rocket launch), then a choir hush. Then an analog-synth arpeggio drive accelerating. Then a hybrid strings + electronic climax with rising Shepard tones, a reverse-cymbal montage, and a final triumphant full statement of the theme with organ, choir and brass, ending on a sustained major chord.

---

## 5. Refinements for stronger impact

1. **Cut to the music.** Once the score exists, nudge the `seg()` start times so each headline lands on a downbeat. Every beat in the cue sheet above is a single number in `liberty.js`.
2. **Camera moves.** Add a slow global push-in, 1.00 → 1.04 per scene, applied in `renderAt` as a scale around the frame centre. A tiny parallax between the grid and the drawings gives a lot of depth for very little code.
3. **Motion blur.** Render at 120 fps and blend groups of 4 frames (`ffmpeg -vf tmix=frames=4,fps=30`). Fast moves like the liftoff, the booster descent and the montage flashes will feel filmic.
4. **Light leaks on the strongest beats.** Add a brief warm radial bloom on ignition, liftoff, LIGHT and ONWARD. This is just a large radial gradient with `globalCompositeOperation = 'lighter'`.
5. **Sound design under the score.** Quill scratch, telegraph clicks, rivet guns, a Saturn V rumble, a data-centre hum. Each one sells the scene in under a second.
6. **Grade.** Lift black to a very slightly warm `#07060a` and add a subtle halation (blurred copy of the gold channel, screen at 15 %). Both are one-liners in `chrome()` / `grain()`.
7. **Vertical cut.** For 9:16 social, the plates are position-parametric. Duplicate `SCENES` with re-anchored coordinates rather than cropping.
8. **Alternate endings.** `?final=ACCELERATE.` gives a sharper, more tech-forward close. *ONWARD.* plays warmer and more universal. Test both against the music's last chord.

### Fact notes
The figures on screen are rounded, commonly cited values, chosen for a highlight reel rather than a textbook. They include territorial area by acquisition, ~296,000 U.S. military aircraft and 2,710 Liberty ships (1940–45), the Model T's 12.5 h → 93 min chassis assembly and $850 → $260 price, Interstate authorization of 41,000 miles, and transistor counts from the Intel 4004 to the 208 B-transistor Blackwell.

The 2026–2076 electricity curve and the Kardashev value are labelled **PROJECTED / AMBITION**. They are aspirational, not forecasts.
