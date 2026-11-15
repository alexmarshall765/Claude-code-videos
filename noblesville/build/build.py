"""Assemble the single-file offline HTML: template + data + three.js + app."""
import sys, os
here = os.path.dirname(os.path.abspath(__file__))
data = open(sys.argv[1]).read(); three = open(sys.argv[2]).read()
assert '</script' not in data.lower()
t = open(os.path.join(here, 'template.html')).read()
app = open(os.path.join(here, 'app.js')).read()
for k, v in (('/*DATA*/', data), ('/*THREE*/', three.replace('</script', '<\\/script')), ('/*APP*/', app)):
    a, b = t.split(k); t = a + v + b
out = os.path.join(here, '..', 'noblesville-3d.html')
open(out, 'w').write(t); print(os.path.getsize(out) / 1e6, 'MB')
