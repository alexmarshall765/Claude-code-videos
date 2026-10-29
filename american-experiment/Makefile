# THE AMERICAN EXPERIMENT
#   make audio    synthesize audio/score.wav and audio/stems/ from timeline.json + score.json
#   make preview  fast full-length encode     → out/preview.mp4
#   make video    master encode               → out/the_american_experiment_1080p60.mp4
#   make video4k  supersampled master (?scale=2, lanczos down to 1080p)
#   make slice    vertical slice: OBS 01–02 + OBS 14 → out/slice.mp4
#   make apollo   the 24-second Apollo preview (2:40–3:04) → out/apollo.mp4
#   make check    acceptance checks (add VIDEO=out/... to verify an encode)
#   make serve    live preview at http://localhost:8080/web/?preview
#   make stills   review PNGs: make stills FRAMES=0,480,10320
#   make cues     print the resolved cue sheet

NODE   ?= node
PYTHON ?= python3
PAGES  ?= 3
FRAMES ?= 0,480,960,9600,10320,10800,11000

.PHONY: audio preview video video4k slice apollo check serve stills cues

audio:
	$(PYTHON) audio/synth.py

preview: audio/score.wav
	$(NODE) render/capture.mjs --preset preview --pages $(PAGES) --out out/preview.mp4

video: audio/score.wav
	$(NODE) render/capture.mjs --preset master --pages $(PAGES) --out out/the_american_experiment_1080p60.mp4
	$(NODE) render/check.mjs --stride 60 --video out/the_american_experiment_1080p60.mp4

video4k: audio/score.wav
	$(NODE) render/capture.mjs --preset master --scale 2 --pages 2 --out out/the_american_experiment_1080p60_ss.mp4

slice: audio/score.wav
	$(NODE) render/capture.mjs --preset master --pages $(PAGES) --segments 0-960,9600-11040 --out out/slice.mp4

apollo: audio/score.wav
	$(NODE) render/capture.mjs --preset master --pages $(PAGES) --from 9600 --to 11040 --out out/apollo.mp4

check:
	$(NODE) render/check.mjs $(if $(VIDEO),--video $(VIDEO),)

serve:
	$(NODE) render/serve.mjs --port 8080

stills:
	$(NODE) render/capture.mjs --pages 1 --stills $(FRAMES)

cues:
	$(NODE) render/cues.mjs

audio/score.wav: timeline.json score.json audio/synth.py
	$(PYTHON) audio/synth.py
