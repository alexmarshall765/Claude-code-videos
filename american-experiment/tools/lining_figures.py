"""Make lining figures the default digits of the bundled Cormorant Garamond files.

Canvas 2D cannot switch on OpenType features, and Cormorant's default figures are
old-style (the 9 descends), which reads oddly in a countdown. This remaps the cmap
entries for 0-9 to the glyphs the font's own `lnum` feature substitutes.

Usage: python3 -I tools/lining_figures.py web/fonts/CormorantGaramond-600.woff2 [...]
"""
import os
import sys

from fontTools.ttLib import TTFont

NAMES = ["zero", "one", "two", "three", "four", "five", "six", "seven", "eight", "nine"]

for path in sys.argv[1:]:
    font = TTFont(path, lazy=False)
    gsub = font["GSUB"].table
    lnum = {}
    for rec in gsub.FeatureList.FeatureRecord:
        if rec.FeatureTag != "lnum":
            continue
        for index in rec.Feature.LookupListIndex:
            for sub in gsub.LookupList.Lookup[index].SubTable:
                lnum.update(getattr(sub, "mapping", {}) or {})
    remapped = 0
    for table in font["cmap"].tables:
        for digit, name in enumerate(NAMES):
            code = ord("0") + digit
            if table.cmap.get(code) == name and name in lnum:
                table.cmap[code] = lnum[name]
                remapped += 1
    font.flavor = "woff2"
    font.save(path + ".tmp")
    os.replace(path + ".tmp", path)
    print(f"{path}: {remapped} cmap entries now point at lining figures")
