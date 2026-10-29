"""Fetch subsetted woff2 fonts from the Google Fonts CSS API (text= parameter).

Usage: python3 -I fetch_fonts.py OUT_DIR
"""
import re
import sys
import urllib.parse
import urllib.request
from pathlib import Path

from fontTools.ttLib import TTFont

OUT = Path(sys.argv[1])
OUT.mkdir(parents=True, exist_ok=True)
UA = ("Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
      "(KHTML, like Gecko) Chrome/120.0 Safari/537.36")

chars = [chr(c) for c in range(0x20, 0x7F)] + [chr(c) for c in range(0xA0, 0x100)]
chars += list("–—‘’“”•…′″−→←↑↓≈∞≥≤±×÷°§·⁰¹²³⁴⁵⁶⁷⁸⁹⁺⁻½¼¾√Δπµ∑✦★◆●○□■▲▼►◄‖†‡№™©ⅠⅡⅢⅣⅤ")
TEXT = "".join(dict.fromkeys(chars))

FACES = [
    ("Cormorant Garamond", 600, "CormorantGaramond-600"),
    ("Cormorant Garamond", 700, "CormorantGaramond-700"),
    ("Jost", 500, "Jost-500"),
    ("JetBrains Mono", 400, "JetBrainsMono-400"),
    ("JetBrains Mono", 600, "JetBrainsMono-600"),
]

for family, weight, name in FACES:
    q = urllib.parse.urlencode({"family": f"{family}:wght@{weight}", "text": TEXT})
    req = urllib.request.Request(f"https://fonts.googleapis.com/css2?{q}", headers={"User-Agent": UA})
    css = urllib.request.urlopen(req).read().decode()
    urls = re.findall(r"url\((https://[^)]+)\)", css)
    assert len(urls) == 1, (name, css)
    data = urllib.request.urlopen(urllib.request.Request(urls[0], headers={"User-Agent": UA})).read()
    path = OUT / f"{name}.woff2"
    path.write_bytes(data)
    font = TTFont(path)
    cmap = font.getBestCmap()
    missing = [c for c in TEXT if ord(c) not in cmap]
    print(f"{name}: {len(data)} bytes, {len(cmap)} glyphs mapped, missing: {''.join(missing)!r}")
