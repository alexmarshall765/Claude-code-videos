/* Master timeline, shared by the picture (src/film.js) and the score (score/score.py).
 * The body below is strict JSON so Python can parse it. Everything is counted in bars of
 * the section's tempo, so picture cuts and musical downbeats are the same numbers.
 *   sections: [id, bpm, bars]          4/4 throughout
 *   shots:    [id, section, startBar, lengthBars, options]
 *     options.src / options.at  replay another shot's scene from local time `at` (finale montage)
 *     options.in                "cut" (default) | "flash" | "dissolve" | "fade", with options.d seconds
 */
window.TIMELINE = {
  "fps": 30,
  "sections": [
    ["dawn", 60, 9],
    ["west", 88, 10],
    ["industry", 104, 12],
    ["war", 72, 10],
    ["reach", 112, 8],
    ["earthrise", 60, 2],
    ["future", 112, 8],
    ["finale", 76, 8],
    ["coda", 76, 3.5]
  ],
  "shots": [
    ["dawn", "dawn", 0, 2, {"in": "fade", "d": 2.5}],
    ["ships", "dawn", 2, 2, {"in": "dissolve", "d": 1.2}],
    ["hall", "dawn", 4, 1, {"in": "dissolve", "d": 0.8}],
    ["quill", "dawn", 5, 1],
    ["bell", "dawn", 6, 0.5, {"in": "flash", "d": 0.5}],
    ["flag13", "dawn", 6.5, 0.5],
    ["statue", "dawn", 7, 2, {"in": "flash", "d": 0.7}],

    ["wagons", "west", 0, 3, {"in": "dissolve", "d": 0.5}],
    ["hammer", "west", 3, 1],
    ["spike", "west", 4, 1, {"in": "flash", "d": 0.6}],
    ["rails", "west", 5, 1.5],
    ["growth", "west", 6.5, 1.5],
    ["bridge", "west", 8, 2],

    ["steel", "industry", 0, 3, {"in": "flash", "d": 0.4}],
    ["oil", "industry", 3, 2],
    ["bulb", "industry", 5, 1],
    ["citylight", "industry", 6, 1, {"in": "flash", "d": 0.4}],
    ["line", "industry", 7, 3],
    ["skyline", "industry", 10, 2],

    ["doughboys", "war", 0, 2, {"in": "dissolve", "d": 0.8}],
    ["arsenal", "war", 2, 1],
    ["shipyard", "war", 3, 1],
    ["fortress", "war", 4, 2],
    ["normandy", "war", 6, 2, {"in": "dissolve", "d": 0.8}],
    ["victory", "war", 8, 2, {"in": "flash", "d": 0.8}],

    ["transistor", "reach", 0, 2],
    ["interstate", "reach", 2, 2],
    ["launch", "reach", 4, 4],

    ["earthrise", "earthrise", 0, 1.125, {"in": "fade", "d": 1.2}],
    ["moon", "earthrise", 1.125, 0.875, {"in": "dissolve", "d": 0.8}],

    ["digital", "future", 0, 2],
    ["booster", "future", 2, 3],
    ["ai", "future", 5, 3],

    ["m1", "finale", 0, 0.5, {"src": "quill", "at": 1.6, "in": "flash", "d": 0.35}],
    ["m2", "finale", 0.5, 0.5, {"src": "wagons", "at": 3.0, "in": "flash", "d": 0.35}],
    ["m3", "finale", 1, 0.5, {"src": "spike", "at": 0.0, "in": "flash", "d": 0.35}],
    ["m4", "finale", 1.5, 0.5, {"src": "steel", "at": 2.4, "in": "flash", "d": 0.35}],
    ["m5", "finale", 2, 0.5, {"src": "fortress", "at": 3.0, "in": "flash", "d": 0.35}],
    ["m6", "finale", 2.5, 0.5, {"src": "launch", "at": 5.6, "in": "flash", "d": 0.35}],
    ["m7", "finale", 3, 0.5, {"src": "moon", "at": 1.2, "in": "flash", "d": 0.35}],
    ["m8", "finale", 3.5, 0.5, {"src": "booster", "at": 3.3, "in": "flash", "d": 0.35}],
    ["orbit", "finale", 4, 2, {"in": "flash", "d": 0.6}],
    ["flag", "finale", 6, 2, {"in": "dissolve", "d": 0.8}],
    ["title", "coda", 0, 3.5, {"in": "dissolve", "d": 1.4}]
  ]
};
