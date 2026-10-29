#!/usr/bin/env bash
# Re-encodes that do not need a fresh capture.
#
#   render/encode.sh mux VIDEO.mp4 AUDIO.wav OUT.mp4   swap the soundtrack (e.g. audio/score_external.wav)
#   render/encode.sh prores VIDEO.mp4 OUT.mov          ProRes 422 HQ editing master from an encode
#   render/encode.sh web VIDEO.mp4 OUT.mp4             smaller web copy (CRF 20, AAC 256k)
#
# Fresh encodes go through render/capture.mjs, which pipes frames straight into FFmpeg:
#   preview: -c:v libx264 -preset veryfast -crf 20 -pix_fmt yuv420p -c:a aac -b:a 256k
#   master:  -c:v libx264 -preset slow -crf 14 -tune animation -pix_fmt yuv420p, BT.709 tags,
#            -movflags +faststart -c:a aac -b:a 320k
set -euo pipefail
cmd=${1:-}
case "$cmd" in
  mux)
    ffmpeg -y -i "$2" -i "$3" -map 0:v -map 1:a -c:v copy -c:a aac -b:a 320k -shortest -movflags +faststart "$4" ;;
  prores)
    ffmpeg -y -i "$2" -c:v prores_ks -profile:v 3 -pix_fmt yuv422p10le -c:a pcm_s24le "$3" ;;
  web)
    ffmpeg -y -i "$2" -c:v libx264 -preset slow -crf 20 -tune animation -pix_fmt yuv420p \
      -colorspace bt709 -color_primaries bt709 -color_trc bt709 -c:a aac -b:a 256k -movflags +faststart "$3" ;;
  *)
    sed -n '2,12p' "$0"; exit 1 ;;
esac
