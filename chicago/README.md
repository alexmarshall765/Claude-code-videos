# Chicago 3D — Downtown Explorer

An explorable 3D model of downtown Chicago in **one offline HTML file**: [`chicago-3d.html`](chicago-3d.html) (about 2.7 MB). Download it and double-click — no server, no internet.

- About 16,000 real building footprints at their real heights, from the Gold Coast to Soldier Field
- Streets with names, the Chicago River, Lake Michigan, harbors, parks with trees, the elevated "L" with moving trains
- Cast shadows that follow the sun, drifting clouds, detailed facades (blinds, shopfronts, rooftop plant), sidewalks, street lamps and traffic
- Fly or walk (with collisions — you can land on rooftops), a minimap, a full map with fast travel
- 23 landmarks to discover, marked by golden beacons
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

`build.mjs` bundles `src/main.js`, three.js and `data/city.json` into `chicago-3d.html`.
`tools/fetch.py` downloads the map layers from Overture Maps and `tools/prep.py` turns them into `data/city.json`.

Map data © OpenStreetMap contributors and Overture Maps Foundation, available under the ODbL.
