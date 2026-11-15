# Noblesville 3D

An explorable 3D map of Noblesville, Indiana in a single offline HTML file.

**Open `noblesville-3d.html` in any modern desktop browser** (double-click it — no server or internet needed).

- ~14 × 14 km around Noblesville: 41,000 buildings, 15,000 road/trail/rail segments with real street names,
  the White River, Morse Reservoir, ponds, parks, golf courses, 150,000 trees, power lines, ~3,900 named places.
- Walk, drive or fly; minimap, full map with click-to-teleport and landmark fast travel; time of day with lit windows at night.

| Key | Action |
| --- | --- |
| `W A S D` / arrows, mouse | Move / look (click the view to capture the mouse) |
| `1` `2` `3` (or `Tab`) | Walk / Drive / Fly |
| `Shift`, `Space`, `C` | Run or boost, jump / handbrake / climb, descend |
| `M`, `T`, `L`, `H` | Map & fast travel, time of day, labels, help |

## Rebuilding

Sources live in `build/`: `fetch_overture.py` and `fetch_terrain.py` download the data, `prep.py` packs it,
`build.py` inlines data + three.js (r160 `three.min.js`) + `app.js` into `template.html`.

Map data © OpenStreetMap contributors and Overture Maps Foundation (ODbL / CDLA). Terrain: USGS 3DEP via Mapzen terrain tiles.
three.js is MIT licensed.
