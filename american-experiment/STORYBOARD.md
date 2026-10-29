# THE AMERICAN EXPERIMENT · Storyboard

4:56 · 148 bars at 120 BPM · 1920×1080 at 60 fps · 17,760 frames.

The film is laid out on a strict musical grid: one bar is 2.0 s and one beat is 0.5 s. Bar *n* starts at (n − 1) × 2 s. `timeline.json` holds all timing. Scene lengths live there, and every cue is a `bar.beat` address local to its scene. Both renderers, `web/` and `audio/synth.py`, read that one file. Run `make cues` to print the resolved cue sheet with global bar numbers and timecodes.

**Status:** this is the vertical slice. OBS 01, 02 and 14 are finished. The other 19 observations run as storyboard slates. Each slate plays its real cards on their real cues over a circle that ticks on every cue hit, so the whole film can already be watched against the full score.

## Framing

The film is the field notebook of an experiment, drawn on a surveyor's plate:

- The top left carries the act and chapter in letter-spaced small caps, set in Jost.
- The top right carries the observation line in mono: `OBS. 14 · 1969 · 28.61° N 80.60° W`.
- A 1776–2026 ruler runs along the bottom. Its cursor is critically damped and carries a rolling year counter. Every major event leaves a gold dot on the ruler.

One shape recurs throughout: the circle. It appears as the compass circle, the sun disc, a gear, a wheel, a globe, Earthrise and the torch halo. Crosshairs appear only in OBS 05 (the survey), OBS 14 (the landing site) and OBS 18 (the landing pad).

## Observations

| OBS | Bars · time | Chapter | What happens | Cards | Sound |
|---|---|---|---|---|---|
| 01 ✅ | 1–4 · 0:00 | PROLOGUE — FIELD LOG | Black. A gold point ignites on 1.3. A drafting compass opens out of it, then sweeps the film's first construction line, a perfect circle, between 2.2 and 3.2. Thirteen construction ticks divide it, and 13 faint stars resolve on its rim, one per eighth note from 3.2. | STAKED ON THE EXPERIMENT · *ENTRUSTED TO THE HANDS OF THE AMERICAN PEOPLE* · *— WASHINGTON, FIRST INAUGURAL, 1789* | Sub drone, a heartbeat kick from bar 3, pen ticks, glints, and a reverse swell into 5.1. |
| 02 ✅ | 5–8 · 0:08 | PROLOGUE — TITLE | On 5.1 the circle flares into a sun disc: hero ring, degree ticks, and 13 rays turning slowly from the stars' positions. A torch draws inside it, construction first. Its flame, layered Bézier tongues on seeded noise, lights on 6.3. The ruler draws on from 1776 under the dates. | THE AMERICAN / EXPERIMENT (5.1) → A NATION CONCEIVED / IN LIBERTY. (7.1) → *1776 — ∞* (7.3) | Title impact on 5.1 (sub drop, noise burst, long reverb). The arpeggio fades in. |
| 03 | 9–16 · 0:16 | ACT I · THE HYPOTHESIS — FOUNDING | Parchment at 13 % under the ink. A quill engraves inside a golden-ratio page grid. Fifty-six signature dots link into a constellation, and 13 stars form a ring on quarter notes from 13.1. The page carries POP. ≈ 2.5 MILLION and, small at its foot, ALL MEN ARE CREATED EQUAL. | WE HOLD THESE TRUTHS TO BE SELF-EVIDENT → THE HYPOTHESIS: → FREE PEOPLE CAN GOVERN THEMSELVES. | 16th arp opening from 300 Hz, organ pad, rim clicks, pen ticks, a star ping per quarter note. |
| 04 | 17–24 · 0:32 | ACT I — CONSTITUTION | WE THE PEOPLE in engraved caps. A three-branch diagram traces checks and balances. The ten amendments light on quarter notes from 20.3. Pull back: a wireframe Capitol dome rises from the triangle. Art. I §8 lights on 23.1, and a seal stamps PATENT ACT · 1790. | WE THE PEOPLE → LIMITED GOVERNMENT. UNLIMITED AMBITION. → TO PROMOTE THE PROGRESS OF SCIENCE AND USEFUL ARTS | Four-on-the-floor from 17.1, a pluck per amendment, a bell on 23.1, a stamp on 23.3. |
| 05 | 25–32 · 0:48 | ACT II · THE FRONTIER — EXPANSION | The continent draws (us-atlas, schematic). The 13 states fill on 26.1. A survey crosshair leads the 1785 township grid west. Then Louisiana (29.1), Florida (30.1), Texas (31.1), Oregon (31.3) and the 1848 cession (32.1) fill in turn. Lewis & Clark's route draws as a dotted line with a day counter. Contours rise over the Rockies. | A CONTINENT, SURVEYED. → *1803 · ≈ 828,000 SQ MI* · THE NATION DOUBLES. | Bass enters on 25.1, a thud on each fill, hats from 29.1. |
| 06 | 33–36 · 1:04 | ACT II — ROADS, CANALS, WIRES | The National Road. An Erie Canal lock in cross-section, its water rising on 34.1. A paddlewheel gear. Morse pulses race along a wire from Washington to Baltimore. | WE BUILT THE ROADS. → THEN THE CANALS. THEN THE WIRES. → WHAT HATH GOD WROUGHT (runs a beat into OBS 07's dissolve) | Lock-rise hit on 34.1. Morse "USA" at 1 kHz from 35.3. |
| 07 | 37–44 · 1:12 | ACT II — LIBERTY EXTENDED | ALL MEN ARE CREATED EQUAL returns from OBS 03, centred. Rings ripple out, one per downbeat from 38.1 to 43.1: 1865 · XIII, 1868 · XIV, 1870 · XV, 1920 · XIX, 1964 · CIVIL RIGHTS ACT, 1965 · VOTING RIGHTS ACT. The cursor sweeps ahead to 1965 and springs back to 1869 on 44.3. | A NEW BIRTH OF FREEDOM. → THE EXPERIMENT CORRECTS ITSELF. → THE PROMISE, WIDENED. | Breakdown with the drums out. Each ring rings the next note of the theme on a bell (A D E F G A), the hint of what the Arsenal states in full. Riser 43–44. |
| 08 | 45–52 · 1:28 | ACT III · THE APPARATUS — STEEL & RAILS | Two rail lines race from east and west and meet. The golden spike strikes on 47.1 in a spark burst. The Brooklyn Bridge in elevation: towers, catenary cables, suspenders falling on 16ths, stays, and MAIN SPAN 1,595.5 FT. A Bessemer converter and a steel-output curve. | *MAY 10, 1869 · PROMONTORY SUMMIT* · ONE CONTINENT, ONE LINE. → STEEL. → WE JOINED A CONTINENT. | First full drop on 45.1. Anvil on 47.1. Ticks on the suspenders. |
| 09 | 53–56 · 1:44 | ACT III — LIGHT & INVENTION | An exploded-view filament bulb ignites on 53.1. A power grid spreads node by node until the cities glow, one per 16th. A telephone schematic. The patent odometer spins up to the brief's figure. | WE LIT THE NIGHT. → *U.S. PATENT NO. 640,167 · 1900* | FM zap on the bulb, a blip per city. |
| 10 | 57–64 · 1:52 | ACT III — FLIGHT | The Flyer assembles as a three-view blueprint on 16ths, then lifts off on 58.1. The flight plays in real time: a 0–120 ft ruler and a stopwatch run 12 s, exactly six bars, and touch down on 64.1. The path then stretches into a great-circle arc. | *DEC 17, 1903 · 12 SECONDS · 120 FEET* → WE TOOK TO THE AIR. | Sparse bar 57, an accelerating snare roll and a filter sweep, touchdown on 64.1, and the drop held for 65.1. |
| 11 | 65–68 · 2:08 | ACT III — THE ASSEMBLY LINE | Match cut: the Flyer's propeller becomes a drive gear. A side-elevation conveyor. Stations add parts on 16ths, moving strictly linearly. Chassis multiply into a dot field. | *12 H 30 M → 1 H 33 M PER CAR* · ABUNDANCE, BY DESIGN. · *≈ 15 MILLION* | Drop on 65.1. Mechanical 16th sequencer, robotic percussion. |
| 12 | 69–76 · 2:16 | ACT IV · THE PROOF — ARSENAL OF DEMOCRACY | A beat-locked wireframe montage with CRIMSON accents: Liberty ship hull blocks, a bomber rolling off a line, sawtooth roofs multiplying. A new wireframe slams in every 2 beats. Production only: no combat. | THE GREAT ARSENAL OF DEMOCRACY. → *2,710 LIBERTY SHIPS* · *≈ 300,000 AIRCRAFT* → WE BUILT IT. | Supersaw lead states the theme in full. Brass-like stabs on every slam, a crash every 4 bars. |
| 13 | 77–80 · 2:32 | ACT IV — THE POSTWAR BOOM | The Interstate draws across the map. A suburb grid. Three charts grow on downbeats. A tiny 1947 transistor is seeded in a corner. | *1956 · 41,000 MI PLANNED* · PROSPERITY, AT SCALE. · *LIFE EXPECTANCY ≈ 47 → ≈ 70* | Lighter, major-key lift (F and C add9), open hats. |
| 14 ✅ | 81–92 · 2:40 | ACT IV — APOLLO | See the shot list below. | WE CHOOSE TO GO / TO THE MOON → *363 FT* → *T-MINUS 10…1* → WE LEFT / THE EARTH. → *ALT ≈ 50,000 FT* → THE EAGLE HAS LANDED. · *JULY 20, 1969 · 20:17 UTC* | Breakdown 81–86, countdown beeps tuned to A5. The biggest drop of the film on 87.1. Touchdown on 91.1 cuts everything but a held D-major pad. Swell on 92. |
| 15 | 93–100 · 3:04 | ACT V · THE ACCELERATION — SILICON | The transistor from OBS 13 enlarges to fill the frame, tiles into an integrated circuit, then a 1971 die of 2,300 transistors. A log curve climbs past 100 billion transistors as the die pulls back to a wafer, then a personal computer. | *1947* · THE TRANSISTOR → *1971 · 2,300 TRANSISTORS* → WE TAUGHT SAND TO COUNT. | Bit-crushed arps that step up every 2 bars. A 32nd-note stutter on 99.3. |
| 16 | 101–108 · 3:20 | ACT V — THE INTERNET | A packet labelled LO crosses between two nodes. The network grows, doubling on downbeats. Packet switching. A four-layer protocol stack locks (1983). A 1993 browser draws open. The globe lands on 107.1, wrapped in cables. | *OCT 29, 1969 · "LO"* · THE OTHER LAUNCH. → *JAN 1, 1983 · TCP/IP* · ONE LANGUAGE FOR EVERY NETWORK → *≈ 6 BILLION ONLINE* · WE CONNECTED THE WORLD. | Packet blips on 16ths, driving bass, wide pads. |
| 17 | 109–112 · 3:36 | ACT V — THE CAR, REINVENTED | Match cut to OBS 11's conveyor a century later: the chassis morphs into a battery platform. Cells light in waves. A motor cross-section spins up. Chargers spread along OBS 13's Interstate map. | THE CAR, REINVENTED. → ELECTRIC, AT MASS SCALE. · *2025 · 1 IN 4 NEW CARS SOLD WORLDWIDE WAS ELECTRIC* | Motor-whine riser, cell blips, impact on 111.1. |
| 18 | 113–120 · 3:44 | ACT V — THE ROCKETS COME BACK | A booster descends onto a pad marked by a landing crosshair (114.1). A giant booster is caught by tower arms on 116.1, all generic and unbranded. A DNA helix unzips beside an mRNA strand. | THE ROCKETS COME BACK. · *DEC 2015 · LANDED   OCT 2024 · CAUGHT* → WE READ THE CODE OF LIFE. · *GENOME 2003 · mRNA VACCINES 2020* | Full stack. Catch impact on 116.1. Helix ticks on 16ths. |
| 19 | 121–128 · 4:00 | ACT V — GENERATIVE AI | An isometric data hall. Tokens as gold tiles with attention arcs. Layers stack. New tokens arrive one per 16th, and the outputs become drawings (a molecule, a circuit, a blueprint, a line of code, and once, the film's own torch). The training-compute curve rises steeper than the chip curve. | *2017* · ATTENTION. → MACHINES THAT WRITE, DRAW AND CODE. → THEN WE TAUGHT IT TO THINK. (125.1, 4:08) | The theme an octave up on supersaw, token arps, impact on 125.1. |
| 20 | 129–132 · 4:16 | ACT V — 250 | The ruler rises to centre screen. The cursor hits 2026 and every dot lights at once. The numerals 250 draw from the ruler's own ticks. Artemis II's free-return loop, with a ticker passing Apollo 13's record and stopping at 252,756 MI. | 250 YEARS. → *APRIL 2026 · 252,756 MI* · FARTHER THAN ANY HUMANS, EVER. | Drums drop, a chord swell, plucked starbursts, a riser into 133. |
| 21 | 133–140 · 4:24 | ACT V — THE OPEN FUTURE | The ruler extends past 2026 as a dashed NEXT. Four 2-bar plates: fusion with an energy curve; the scientific method as a loop that speeds up; a lunar base, then a Mars grid on a CRIMSON limb; a Kardashev gauge. | ABUNDANT ENERGY. → DISCOVERY AT MACHINE SPEED. → A SECOND WORLD. → THE CURVE BENDS UP. · *KARDASHEV TARGET · 0.73 → 1.0* | Key change to E minor on 133.1. The choir sings the theme, with an ascending counter-melody. Riser 139–140. |
| 22 | 141–148 · 4:40 | CODA · THE EXPERIMENT CONTINUES | Rewind: 15 symbols on 15 beats in reverse, each snapping into the centre circle, while the cursor races back to 1776. **The beat of black on 144.4.** On 145.1 everything collapses into the torch, the circle becomes its halo, and the ruler runs off the right edge. Black for the last second. | THE EXPERIMENT CONTINUES. → **ONWARD.** (the only white type in the film; `?final=ACCELERATE.` swaps it) · *THE AMERICAN EXPERIMENT · 1776 — ∞* | Tape-rewind sweep, a reversed hit per beat, a ticking clock. Silence on 144.4. The final E-major chord with choir on 145.1, decaying to silence by 148.3. |

Italic entries are data cards set in monospace. The rest are statements set in Cormorant Garamond caps.

## OBS 14 · Apollo, shot by shot (the slice's summit)

| Bar.beat | Time | Shot |
|---|---|---|
| 81.1 | 2:40.0 | **Pad.** Ground, mobile launcher, flame trench, and the umbilical tower with nine swing arms. The vehicle's axis draws as a construction line. |
| 81.1–83.3 | 2:40–2:45 | **Stacking.** The hand-built wireframe Saturn V stacks in six groups, each lowered onto its seat and landing on its cue with a clank: S-IC with F-1s and fins, S-II, S-IVB, IU and SLA, CSM, escape tower. Its station line flashes as each group seats. Front lines are bright and back lines dim. The engraved roll pattern turns with the vehicle. |
| 81.3 | 2:41.0 | WE CHOOSE TO GO / TO THE MOON, attributed *KENNEDY, RICE UNIVERSITY, 1962*. The cursor glides to 1962. |
| 84.1 | 2:46.0 | **Callouts.** Leader lines and stage names, plus a 363 FT dimension set clear of the tower with dashed extension lines. |
| 84.3–86.4 | 2:47.0–2:51.5 | **Countdown.** 10 → 1 in lining serif figures, one per beat, under a T-MINUS readout. The cursor moves to 1969. The swing arms retract on 86.1. |
| 87.1 | 2:52.0 | **Ignition.** A flash and a short camera shake. Five white-cored, gold-edged flame cones plus particles go down the trench, and a scalloped cloud bank races out both ways under sparks. Hold-down releases a sixteenth later. |
| 87.1–88.3 | 2:52–2:55 | **Climb.** The camera tilts with the vehicle as the pad drops away and the stars come out. WE LEFT / THE EARTH. on 87.3. |
| 88.1 | 2:54.0 | **Staging.** The S-IC drops away tumbling, its flames guttering, with a separation ring. The S-II's five flames light. |
| 88.2–88.4 | 2:54.6–2:55.0 | **Hand-off.** The camera pulls far back and carries the vehicle, now a point of light, onto the top of a globe drawing itself (the motif circle). |
| 88.3–89.4 | 2:55–2:58 | **Diagram.** Ascent into Earth orbit and one orbit. Translunar injection on 89.1 with a flare. The coast arcs across to the Moon, then lunar orbit. |
| 90.1 | 2:58.0 | The coordinates roll to *0.67° N 23.47° E*. The camera pushes 6× into the landing site, and *ALT ≈ 50,000 FT* starts counting down. |
| 90.3 | 2:59.0 | **Lock.** The landing-site crosshair converges and locks on TRANQUILITY BASE. The lunar module rides its descent arc in. |
| 91.1 | 3:00.0 | **Touchdown, hard cut.** Stillness. The lander on the horizon, dust rings settling. THE EAGLE HAS LANDED. |
| 92.1 | 3:02.0 | **Earthrise.** The motif circle as Earth, night side engraved, rising over the lunar limb. |

## Retiming and decisions recorded in timeline.json

- **The beat of black.** The brief asks both for 16 rewind symbols on 16 beats (141–144) and for a protected beat of black before the final chord. Those can't both fit. The rewind runs 15 symbols on 15 beats, two of them sharing an eighth, so 144.4 stays black and silent.
- **Card holds.** Every card enters on a beat and holds at least 2 s. Non-quotes also hold at least 1.2 s + 0.25 s per word. To make that true, a few entrances moved by one beat:
  - Washington's attribution enters on 3.2.
  - OBS 06's quote and attribution run one beat into OBS 07's dissolve (allowed overlap ≤ 1 beat).
  - OBS 17's EV data card now enters with its statement.
  - OBS 19's ATTENTION card exits on 123.1.
- **The countdown is one readout.** T-MINUS holds 5 s, and its digits change inside it. The 2 s hold applies to the readout, not to each digit.
- **OBS 14 opens on a hard cut.** It was a wipe, but the cut on 81.1 makes the drums dropping out land on the image.
- **OBS 02 tagline.** It stays a statement in the film's own voice. Lincoln's text reads "a new nation, conceived in Liberty", so it is not presented as a quote.
- **HUD coordinates.** The brief leaves several scenes without coordinates. Those were added with sources in `data/facts.json`:
  - Federal Hall for OBS 01.
  - Independence Hall for OBS 02–04, 20 and 22.
  - The Capitol for the 1844 telegraph.
  - Levittown, Murray Hill, Detroit and San Francisco.
  - Unmeasured dashes for the open future.
- **Countdown beeps and the anvil are tuned to the key.** The beeps are A5, with C6 on the last beep before ignition, and the anvil is on D. The Morse stays at 1 kHz, as the brief specifies.
