# Chicago 3D — Chicagoland Explorer

An explorable 3D model of the Chicago metro area in **one offline HTML file**: [`chicago-3d.html`](chicago-3d.html) (about 50 MB). Download it and double-click — no server, no internet.

- The whole metro area, roughly Waukegan to Joliet and Elgin to Gary: about 3 million real buildings, mostly at their measured heights
- Downtown in full detail (about 16,000 buildings, real tower shapes); everywhere else streams in 1 km tiles around you, with gabled and hipped roofs on houses, sidewalks, parkways and street trees
- From the air, the rest of the metro is a ground texture with roads, parks, water and night lights
- Streets with names, the Chicago River, Lake Michigan, harbors, parks with trees, the elevated "L" with moving trains
- Cast shadows that follow the sun, drifting clouds, detailed facades (blinds, shopfronts, rooftop plant), sidewalks, street lamps and traffic
- Fly or walk (with collisions — you can land on rooftops), a minimap, a full map with fast travel
- 40 landmarks to discover, from Wrigley Field and O'Hare to the Bahá'í Temple and Six Flags, marked by golden beacons
- Day, golden hour and night (windows light up)
- A simple first-person shooter mode: fight waves of bots on the streets

## Controls

| Key | Action |
| --- | --- |
| `W` `A` `S` `D` + mouse | Move and look (click the view to capture the mouse) |
| `Space` / `Q` | Fly up / down; jump when walking |
| `Shift` | Boost / sprint (mouse wheel changes flying speed) |
| `F` | Switch between flying and walking |
| `M` | Map and fast travel |
| `G` | Start / quit shooter mode (click to fire, right-click to aim, `R` to reload) |
| `T` / `L` / `H` | Time of day / labels / help |

On a phone or tablet there is an on-screen stick and buttons.

## Rebuilding

```bash
npm install
npm run build
```

`build.mjs` bundles `src/main.js`, three.js, the tile worker (`src/worker.js`, `src/metro-core.js`) and the data in `data/` into `chicago-3d.html`.
`tools/fetch.py` and `tools/prep.py` produce the downtown data (`data/city.json`); `tools/prep_metro.py` turns the Overture Maps metro layers into `data/metro/` (tiled, gzip-compressed buildings, roads and land use, plus ground textures).

Map data © OpenStreetMap contributors and Overture Maps Foundation, available under the ODbL.
