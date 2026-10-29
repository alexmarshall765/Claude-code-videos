# Notes

## Where the film stands

All 22 observations are drawn, each in its own module in `web/src/scenes/`. The shared drawing modules arrived first, so later scenes could reuse them:

- **Map** (`draw/map.js`): us-atlas states baked by `tools/build_map.mjs` into one Albers frame and grouped into the historical acquisitions. Labelled SCHEMATIC. Used by OBS 05, 08, 09, 12, 13, 16, 17 and 22.
- **Charts** (`draw/charts.js`): axes that draw on, and curves that grow from their first point with a tip that readouts can ride. Used by OBS 08, 13, 15, 19 and 21.
- **Gears, wheels and catenaries** (`draw/gears.js`). Used by OBS 06, 08, 09, 11, 17 and 19.
- **Icons and machines**: the quill, seal, lamp and transistor (`draw/icons.js`), the 1903 Flyer (`draw/flyer.js`) and the assembly line (`draw/conveyor.js`).

The coda replays the film's sixteen symbols through the same drawing code their observations used.

`make check` covers:

- timing, card rules and sourcing
- the palette, including the four-scene CRIMSON limit
- fonts
- the score's format, length and loudness
- text size, safe area and the 2 s hold on sampled frames
- byte-identical determinism

## What I would improve next

- **Audio sync verification for an external track.** The brief's optional path asks for beat tracking with librosa and per-section drift reports. Add `audio/verify_external.py` once there is a track to test.
- **Motion blur on the fast moves.** Render the launch, the hand-off and the coda's rewind at 240 fps and blend groups of four frames.
- **The hand-off from climb to diagram.** It reads, but the moment when the pad has gone and the globe is only starting to draw is a little empty. A true line morph would close that gap: the ground line curling up into the globe.
- **Hidden lines in the hand-built 3D.** OBS 21's cutaway reactor and the domes and habitats on the Moon and Mars use depth-dimmed lines, not true hidden-line removal. A per-segment depth test would clean up the places where far lines cross near ones.
- **A viewing test for the fast passages.** OBS 12's slams and OBS 22's rewind give each symbol half a beat. Every frame is legible as a still. A test with fresh eyes should confirm that each symbol also reads in motion.
- **Score mixing.** The synth is balanced by numbers: section loudness tracks the energy map, impacts land within a millisecond, and the keys check out. It has not been tuned by ear. A listening pass should set the supersaw brightness, the snare-roll build in OBS 10, and the choir level in the finale.
- **Vertical social cut.** `?aspect=9x16` camera presets and the 60-second edit from OBS 02, 08, 10, 14, 17, 19, 21 and 22.
- **Render speed.** Capture pulls PNG bytes from the canvas into FFmpeg's image2pipe at about 6 fps with three pages on a 4-core machine, so the full film takes about 52 minutes. This master was captured in four `--from`/`--to` ranges, silent, then joined by stream copy with the score muxed on, so an interrupted render can resume by range. `make video` could do the same. Posting raw RGBA from the page was measured and was four times slower. The remaining cost is PNG compression of the grain and dither layers, so the next speed-up is to add the dither in FFmpeg and keep the canvas output compressible.
- **Text-hold resolution.** The 2 s hold check samples every 15th frame, so it only fails runs that must be shorter than 2 s (span plus two samples). Sampling every frame around each card's exit would make the bound exact.

## External-track prompt (from the brief)

> Instrumental, 120 BPM, D minor, exactly 4:56. Cinematic progressive electronic with orchestral color, no vocals. Low drone and heartbeat kick; a glittering arpeggio builds; four-on-the-floor at 0:32; first full drop at 1:28; a 12-second accelerating build from 1:54; soaring supersaw anthem at 2:16; hushed breakdown with a countdown, then a massive half-time rocket-launch drop at 2:52; sudden quiet at 3:00; glitchy digital section rebuilding from 3:04; second anthem peak at 4:00; brief breakdown at 4:16; key change up a whole step with choir at 4:24; one huge major chord at 4:48 fading to silence. Inspiring, proud, upbeat.
