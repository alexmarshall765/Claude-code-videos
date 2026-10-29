# Notes

## Where the slice stands

The slice includes:

- **Engine.** Frame clock, camera with parallax, layers, bloom, transitions (cut, dissolve, wipe), the text log for checks, and seeded randomness.
- **HUD.** Marker, OBS line, and the ruler with its damped cursor, rolling counter and event constellation.
- **Score.** The full 4:56 synthesized track, with stems.
- **Pipeline.** Capture, encode and checks.
- **Scenes.** OBS 01, 02 and 14, drawn in full.

The other 19 observations play as slates on the real timeline, so the film can be watched end to end against the music.

## Next: the remaining 19 observations

Build order, chosen so that shared drawing tools arrive first:

1. **Map module** (`draw/map.js`): us-atlas states, simplified, grouped into the historical acquisitions, labelled SCHEMATIC. Shared by OBS 05, 09, 13 and 17.
2. **Charts** (`draw/charts.js`): progressive curves, log axes and tips that stay in sync with counters. Shared by OBS 08, 13, 15, 19 and 21.
3. **Gears and catenaries** (`draw/gears.js`, `draw/catenary.js`) for OBS 06, 08, 11 and 17. The motif circle also needs its gear and wheel forms.
4. Then the scenes in film order. Before each one is drawn, verify its rows in `data/facts.json`; `make check` refuses a built scene whose facts are unverified.

## What I would improve next

- **Audio sync verification for an external track.** The brief's optional path asks for beat tracking with librosa and per-section drift reports. Add `audio/verify_external.py` once there is a track to test.
- **Motion blur on the fast moves.** Render the launch and the hand-off at 240 fps and blend groups of four frames.
- **The hand-off from climb to diagram.** It reads, but the moment when the pad has gone and the globe is only starting to draw is a little empty. A true line morph would close that gap: the ground line curling up into the globe.
- **Score mixing.** The synth is balanced by numbers: section loudness tracks the energy map, impacts land within a millisecond, and the keys check out. It has not been tuned by ear. A listening pass should set the supersaw brightness, the snare-roll build in OBS 10, and the choir level in the finale.
- **Vertical social cut.** `?aspect=9x16` camera presets and the 60-second edit from OBS 02, 08, 10, 14, 17, 19, 21 and 22, once those scenes exist.
- **Render speed.** Capture streams raw RGBA to FFmpeg instead of PNGs, because the grain and dither layers make PNG compression the bottleneck. A WebGL bloom pass would cut frame time further.

## External-track prompt (from the brief)

> Instrumental, 120 BPM, D minor, exactly 4:56. Cinematic progressive electronic with orchestral color, no vocals. Low drone and heartbeat kick; a glittering arpeggio builds; four-on-the-floor at 0:32; first full drop at 1:28; a 12-second accelerating build from 1:54; soaring supersaw anthem at 2:16; hushed breakdown with a countdown, then a massive half-time rocket-launch drop at 2:52; sudden quiet at 3:00; glitchy digital section rebuilding from 3:04; second anthem peak at 4:00; brief breakdown at 4:16; key change up a whole step with choir at 4:24; one huge major chord at 4:48 fading to silence. Inspiring, proud, upbeat.
