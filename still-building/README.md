# STILL BUILDING — The United States of America

A 3:23 cinematic short about the United States, from a dawn on the Atlantic to a continent of light seen from orbit. Every frame is rendered from code and the orchestral score is written and synthesized in code too. There is no footage, photography or generated imagery.

**Watch:** [`still-building.mp4`](still-building.mp4) (1920×1080, 30 fps, H.264 + AAC stereo).

```
still-building/
├── still-building.mp4   the finished film
├── index.html           preview player (plays the film live in a browser, with the score if out/score.wav exists)
├── render.mjs           parallel offline renderer → MP4
├── src/
│   ├── timeline.js      the master timeline: tempo sections and shots, counted in bars
│   ├── film.js          engine: renderAt(t), transitions, type overlay, player
│   ├── gl.js            WebGL2: shader plates (sky, ocean, cloud deck, plume, flag, planet, lunar surface) and the post chain
│   ├── art.js           the silhouette kit: people, ships, wagons, locomotives, the Statue, flags, particles
│   ├── type.js          year stamps, statements, quotations
│   ├── data.js, geo.js  city positions and map geometry for the night-lights shots
│   └── scenes1-6.js     the 35 shots, one function each
├── score/score.py       the score: sampler, sound design, mix and master
├── tools/still.mjs      review stills and contact sheets
├── tools/geo.py         builds src/geo.js from Natural Earth / US Census data
└── fonts/               Cinzel, Cormorant Garamond, Inter, Pinyon Script, UnifrakturMaguntia, IM Fell (SIL OFL)
```

## How it is made

**Picture.** Each shot is a function of time that draws one frame. Skies, water, cloud decks, fire and smoke, the waving flags, the Earth and the Moon are fragment shaders. Everything else (people, ships, wagons, locomotives, the Statue of Liberty, the Saturn V, the boosters) is drawn as layered silhouettes on a 2D canvas with a parallax camera. Every frame then goes through one post chain: bright pass, a four-level bloom pyramid, light shafts cast from the sun through the silhouettes, an anamorphic streak, a filmic highlight roll-off, split-toned grade, vignette and grain. That shared chain is what keeps 35 very different shots looking like one film.

**Score.** `score/score.py` is the composition. Melodies, harmony and orchestration are written as note strings and chord symbols; a small sampler plays them on the [Sonatina Symphonic Orchestra](https://github.com/peastman/sso) samples (strings, horns, trumpets, trombones, tuba, flutes, choir, harp, timpani, chimes, cymbals). Synthesized layers add the sea, an anvil, a steam whistle, bomber engines, the Saturn V, sonic booms and sub hits. The mix runs through a synthetic hall reverb, a slow compressor and a look-ahead limiter. The original theme is built on the rhythm of *America the Beautiful* (“Materna”, Samuel A. Ward, 1882, public domain), so that when the finale arrives at the hymn itself, “America! America! God shed His grace on thee”, it sounds like where the music was always going.

**Sync.** Picture and music read the same file, `src/timeline.js`. It lists tempo sections (bpm, bars) and shots (section, start bar, length in bars), so a cut and a downbeat are the same number. The last spike lands on a bar line with an anvil and a sub hit, the Saturn V ignites on the downbeat of bar 7 of its section, the booster touches down on a bar line, and the eight montage pictures in the finale change on beats 1 and 3 with a drum under each.

## Storyboard

| Time | Shot | Picture | Type on screen |
|------|------|---------|----------------|
| 0:00 | Dawn | Night ocean, stars, first light on the Atlantic | IT BEGAN AS AN IDEA |
| 0:08 | Ships | Three ships under sail, backlit by the sunrise | |
| 0:16 | Hall | Delegates silhouetted against tall windows, one bent over the table to sign | 1776 · PHILADELPHIA |
| 0:20 | Quill | A quill finishes “…Life, Liberty and the pursuit of Happiness.” by candlelight | |
| 0:24 | Bell, flag | The bell swings in its belfry; thirteen stars against the sun | |
| 0:28 | Statue | Tilt up from the harbor to the torch | *Life, Liberty, and the Pursuit of Happiness.* |
| 0:36 | Wagons | A wagon train crosses the plains at golden hour while a scout watches | THEN CAME THE BUILDERS |
| 0:44 | Hammer, spike | The maul swings and lands on the cut; two locomotives meet | 1869 · PROMONTORY SUMMIT, UTAH |
| 0:50 | Rails, growth | A train on a timber trestle; a town rises storey by storey behind a wheat field | |
| 0:58 | Bridge | The Brooklyn Bridge at dusk | 1883 · BROOKLYN BRIDGE, NEW YORK |
| 1:03 | Steel | Blast furnaces at night, a ladle pouring | THEY BUILT BIGGER |
| 1:10 | Oil | A gusher over a field of derricks | 1901 · SPINDLETOP, TEXAS |
| 1:15 | Light | A filament ignites; a skyline switches on window by window | 1879 · MENLO PARK, NEW JERSEY |
| 1:19 | Line | Model Ts gain a stage at every station under the factory skylights | 1913 · HIGHLAND PARK, MICHIGAN · FASTER |
| 1:26 | Skyline | Ironworkers on a beam as the camera cranes up past the towers | HIGHER |
| 1:31 | Doughboys | A column marches through morning mist | 1917 · WHEN FREEDOM CALLED |
| 1:38 | Arsenal, shipyard | Bombers on the line and a riveter at work; a Liberty ship slides down the ways | 1942 · WILLOW RUN · THEY ANSWERED |
| 1:44 | Fortresses | A B-17 formation over the cloud deck at sunrise | 1943 · THE EIGHTH AIR FORCE |
| 1:51 | Normandy | From inside a landing craft: helmets, the ramp, the coast ahead | JUNE 6, 1944 |
| 1:58 | Victory | Flags, a crowd, ticker tape | 1945 · VICTORY |
| 2:04 | Transistor | The first transistor; circuits spread from its point of contact | 1947 · THEN THEY REACHED FURTHER |
| 2:09 | Interstate | Headlights and taillights through the suburbs at dusk | 1956 |
| 2:13 | Launch | Saturn V on the pad, ignition on the downbeat, liftoff | 1969 · KENNEDY SPACE CENTER |
| 2:21 | Earthrise, Moon | The Earth over the lunar horizon; an astronaut salutes the flag | *“We came in peace for all mankind.”* |
| 2:29 | Digital | A home computer boots; a network lights up coast to coast | 1977 · AND CONNECTED THE WORLD |
| 2:34 | Boosters | Two boosters land side by side | 2018 · CAPE CANAVERAL, FLORIDA |
| 2:40 | Machine room | A data hall; a lattice of light gathers at the far end | 2020s · ARTIFICIAL INTELLIGENCE |
| 2:47 | Montage | Quill, wagons, spike, steel, fortresses, Saturn V, Moon, boosters: one per half bar | |
| 2:59 | Orbit | The country at night from orbit as the sun comes over the limb | THE WORK IS NOT FINISHED |
| 3:05 | Flag | The flag, and every generation of builders standing under it | |
| 3:12 | Title | The map lights up from the Atlantic westward | THE UNITED STATES OF AMERICA · STILL BUILDING |

## Rebuilding it

You need Node 18+, Playwright with Chromium, FFmpeg, and Python 3 with `numpy`, `scipy` and `soundfile`.

```bash
git clone --depth 1 https://github.com/peastman/sso
```

```bash
SSO_DIR="sso/Sonatina Symphonic Orchestra/Samples" python3 score/score.py
```

```bash
node render.mjs
```

The score takes about a minute. The picture is 6,087 frames; on a 4-core machine with software WebGL it takes roughly half an hour. Frames are cached in 6-second chunks under `out/parts/`, so after editing a shot you only redraw what changed:

```bash
node render.mjs --redo 36-64
```

Other useful commands:

```bash
node render.mjs --scale 0.5 --name preview.mp4
```

```bash
node tools/still.mjs --sheet act1 dawn+6 ships+4 statue+7
```

To preview live, open `index.html` in Chrome. Space plays and pauses, the arrow keys jump five seconds, and `?t=133` starts at 2:13.

**Re-timing.** Change a tempo or a bar count in `src/timeline.js`, then run the score and the render again. Both follow.

## Credits and licenses

- Orchestral samples: [Sonatina Symphonic Orchestra](https://github.com/peastman/sso) by Mattias Westlund and contributors, Creative Commons Sampling Plus 1.0. The samples are not redistributed here; only the music made with them is.
- Hymn tune in the finale: “Materna” by Samuel A. Ward (1882), public domain. Everything else in the score is original.
- Map geometry: Natural Earth via `world-atlas` and US Census Bureau via `us-atlas`, both public domain.
- Declaration of Independence text: public domain.
- Fonts: Cinzel, Cormorant Garamond, Inter, Pinyon Script, UnifrakturMaguntia and IM Fell English SC, all SIL Open Font License.

### Notes on history

The film is a highlight reel, not a textbook, and a few choices favor the image over the calendar. The Statue of Liberty (1886) closes the founding chapter because of what it stands for. Earthrise was photographed on Apollo 8 in December 1968; it sits between the Apollo 11 launch and the Moon landing here. The light bulb (1879) follows the oil boom (1901) because the edit moves from fire to light. The twin booster landing shown is February 2018; the first booster landing was December 2015.
