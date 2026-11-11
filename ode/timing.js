/* Master timing for ODE. Shared by the picture (film.js) and the score (audio/score.py),
 * so cuts always land on beats. Each section has a tempo; each shot lasts a number of beats.
 * Keep the right-hand side strict JSON: score.py parses it. */
window.ODE_TIMING = {
  "fps": 24,
  "coda": 5.5,
  "sections": [
    {"id": "greece",       "bpm": 66,  "shots": [["parthenon", 6], ["agora", 5], ["aristotle", 4], ["scroll", 5]]},
    {"id": "rome",         "bpm": 66,  "shots": [["forum", 5.5], ["aqueduct", 5.5], ["pantheon", 5]]},
    {"id": "faith",        "bpm": 66,  "shots": [["monk", 5.5], ["masons", 5], ["rose", 5.5]]},
    {"id": "renaissance",  "bpm": 76,  "shots": [["duomo", 6], ["anatomy", 6], ["press", 8]]},
    {"id": "science",      "bpm": 76,  "shots": [["ships", 7], ["galileo", 6.5], ["newton", 6.5]]},
    {"id": "liberty",      "bpm": 76,  "shots": [["quill", 6.5], ["crowds", 5.5]]},
    {"id": "beethoven",    "bpm": 80,  "shots": [["vienna", 5], ["scrawl", 7], ["premiere", 12]]},
    {"id": "industry",     "bpm": 96,  "shots": [["steam", 7], ["bulb", 6], ["telegraph", 5], ["flyer", 6]]},
    {"id": "acceleration", "bpm": 120, "shots": [["radio", 5], ["penicillin", 4], ["rocket", 4], ["footprint", 3], ["computer", 5], ["timeline", 7]]},
    {"id": "connected",    "bpm": 132, "shots": [["fiber", 8], ["webpage", 6], ["phones", 9], ["earthweb", 9]]},
    {"id": "ai",           "bpm": 96,  "shots": [["protein", 10], ["doctor", 7], ["child", 8], ["horizon", 7]]},
    {"id": "finale",       "bpm": 120, "shots": [["pullback", 12], ["library", 16], ["city", 16], ["orbit", 16], ["gold", 4]]}
  ]
};
