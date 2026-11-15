"""Turn Overture Maps parquet extracts + terrain tiles into a compact data blob (data.json)."""
import pyarrow.parquet as pq, numpy as np, shapely, json, base64, math, sys, hashlib
from shapely import wkb, STRtree
from shapely.geometry import box, Polygon, LineString, Point
from PIL import Image
D = sys.argv[1] if len(sys.argv) > 1 else '/tmp/nb/data/'
T = sys.argv[2] if len(sys.argv) > 2 else '/tmp/nb/tiles/'
OUT = sys.argv[3] if len(sys.argv) > 3 else '/tmp/nb/work/data.json'
W, S, E, N = -86.08, 39.985, -85.915, 40.11
lat0, lon0 = (S + N) / 2, (W + E) / 2
p = math.radians(lat0)
KX = 111412.84 * math.cos(p) - 93.5 * math.cos(3 * p)
KY = 111132.92 - 559.82 * math.cos(2 * p)
HX, HY = (E - W) / 2 * KX, (N - S) / 2 * KY
CLIP = box(-HX, -HY, HX, HY)
Q = 4
rng = np.random.default_rng(7)

def proj(g):
    return shapely.transform(g, lambda a: np.c_[(a[:, 0] - lon0) * KX, (a[:, 1] - lat0) * KY])
def load(t):
    tb = pq.read_table(D + t + '.parquet').to_pylist()
    gs = proj(np.array([wkb.loads(r['geometry']) for r in tb]))
    for r, g in zip(tb, gs): r['g'] = g
    return tb
def b64(a): return base64.b64encode(np.ascontiguousarray(a).tobytes()).decode()
def q(c): return np.clip(np.round(np.asarray(c) * Q), -32767, 32767).astype('<i2')
def polys_of(g):
    if g is None or g.is_empty: return []
    if g.geom_type == 'Polygon': return [g]
    if g.geom_type in ('MultiPolygon', 'GeometryCollection'):
        return [x for s in g.geoms for x in polys_of(s)]
    return []
def lines_of(g):
    if g is None or g.is_empty: return []
    if g.geom_type == 'LineString': return [g]
    if g.geom_type in ('MultiLineString', 'GeometryCollection'):
        return [x for s in g.geoms for x in lines_of(s)]
    return []
def nm(r):
    n = r.get('names')
    return n['primary'] if n and n.get('primary') else None

class PolySet:
    def __init__(s): s.cls, s.rc, s.pc, s.co = [], [], [], []
    def add(s, g, cls, tol=0.7, min_area=4):
        g = shapely.make_valid(g) if not g.is_valid else g
        g = g.intersection(CLIP)
        for pg in polys_of(g):
            pg = pg.simplify(tol)
            for pg in polys_of(pg):
                if pg.area < min_area: continue
                pg = shapely.geometry.polygon.orient(pg)
                rings = [pg.exterior] + [h for h in pg.interiors if Polygon(h).area > 6]
                rings = rings[:255]
                s.cls.append(cls); s.rc.append(len(rings))
                for r in rings:
                    c = np.asarray(r.coords)[:-1]
                    s.pc.append(len(c)); s.co.append(q(c))
    def pack(s):
        return dict(n=len(s.cls), cls=b64(np.array(s.cls, 'u1')), rc=b64(np.array(s.rc, 'u1')),
                    pc=b64(np.array(s.pc, '<u4')), co=b64(np.concatenate(s.co) if s.co else np.zeros(0, '<i2')))

out = dict(hx=HX, hy=HY, q=Q, lat0=lat0, lon0=lon0, kx=KX, ky=KY)
landmark_cands = []

# ---------- land use / cover ----------
LC = dict(crop=1, forest=2, shrub=3, urban=4, barren=5, grass=6)
LU = dict(residential=10, farmland=11, farmyard=11, park=12, golf_course=13, rough=13, fairway=14, green=15, bunker=16,
          tee=17, pitch=18, cemetery=19, grave_yard=19, school=20, college=20, kindergarten=20, retail=21, commercial=21,
          industrial=22, construction=23, brownfield=23, greenfield=23, quarry=24, playground=25, track=31, hospital=32,
          religious=32, pedestrian=33, meadow=34, grass=34, garden=12, recreation_ground=12, nature_reserve=12,
          dog_park=12, water_park=21, lateral_water_hazard=0, water_hazard=0)
LD = dict(wood=26, forest=26, scrub=27, grass=34, grassland=34, beach=28, sand=28, wetland=35)
ps = PolySet()
lcov = load('land_cover'); luse = load('land_use'); land = load('land'); infra = load('infrastructure')
for r in lcov:
    c = LC.get(r['subtype'])
    if c: ps.add(r['g'], c, tol=4, min_area=400)
lu_items = []
for r in luse:
    c = LU.get(r['class'])
    if c and r['g'].geom_type in ('Polygon', 'MultiPolygon'):
        lu_items.append((r['g'].area, r['g'], c))
        if nm(r): landmark_cands.append((nm(r), r['class'], r['g'].centroid.x, r['g'].centroid.y, r['g'].area))
lu_items.sort(key=lambda t: -t[0])
for a, g, c in lu_items: ps.add(g, c)
for r in land:
    c = LD.get(r['class'])
    if c and r['g'].geom_type in ('Polygon', 'MultiPolygon'): ps.add(r['g'], c, tol=1.2)
air = dict(runway=12, taxiway=5, apron=0)
for r in infra:
    g = r['g']
    if r['class'] == 'parking' and g.geom_type in ('Polygon', 'MultiPolygon'): ps.add(g, 29, tol=0.5)
    elif r['class'] in air:
        if g.geom_type == 'LineString': g = g.buffer(air[r['class']] or 6, cap_style='flat')
        if g.geom_type in ('Polygon', 'MultiPolygon'): ps.add(g, 30)
    if nm(r) and r['class'] not in ('stop',): landmark_cands.append((nm(r), 'infra:' + r['class'], g.centroid.x, g.centroid.y, 0))
out['land'] = ps.pack()
print('land polys', len(ps.cls))

# ---------- water ----------
water = load('water')
wp = PolySet(); streams = []; wpolys = []
for r in water:
    g = r['g']
    if g.geom_type in ('Polygon', 'MultiPolygon'):
        pool = r['class'] == 'swimming_pool'
        wp.add(g, 1 if pool else 0, tol=0.3 if pool else 0.8, min_area=3)
        if not pool: wpolys.append(g if g.is_valid else shapely.make_valid(g))
        if nm(r): landmark_cands.append((nm(r), 'water', g.centroid.x, g.centroid.y, g.area))
    elif g.geom_type in ('LineString', 'MultiLineString'):
        w = dict(river=0, stream=3, canal=3, ditch=1.5, drain=1.5).get(r['class'], 0)
        if w:
            for l in lines_of(g.intersection(CLIP)):
                l = l.simplify(1.0); streams.append((w, q(np.asarray(l.coords))))
out['water'] = wp.pack()
out['streams'] = dict(w=[s[0] for s in streams], pc=[len(s[1]) for s in streams], co=b64(np.concatenate([s[1] for s in streams])))
water_u = shapely.unary_union(wpolys)
print('water polys', len(wp.cls), 'streams', len(streams))

# ---------- roads ----------
RC = dict(motorway=0, trunk=1, primary=2, secondary=3, tertiary=4, residential=5, unclassified=5, living_street=5,
          service=6, unknown=6, footway=7, path=7, pedestrian=7, steps=7, cycleway=7, track=7)
RW = [13, 11, 10, 8.5, 7.5, 6.5, 4, 2.2, 3]
seg = load('segment')
names = ['']; nidx = {}
rcls, rname, rpc, rco, road_buf = [], [], [], [], []
for r in seg:
    if r['subtype'] == 'rail': c = 8
    elif r['subtype'] == 'road': c = RC.get(r['class'], 6)
    else: continue
    n = nm(r)
    if not n and r.get('routes'):
        rt = r['routes'][0]; n = rt.get('ref') and ((rt.get('network') or '').replace('US:IN', 'SR').replace('US:US', 'US').replace('US:I', 'I-').split(':')[0] + ' ' + rt['ref']).replace('- ', '-').strip()
    if n and c == 0 and r.get('routes') and r['routes'][0].get('ref'):
        pass
    ni = 0
    if n:
        if n not in nidx: nidx[n] = len(names); names.append(n)
        ni = nidx[n]
    for l in lines_of(r['g'].intersection(CLIP)):
        l = l.simplify(0.4)
        if l.length < 1: continue
        c2 = q(np.asarray(l.coords))
        rcls.append(c); rname.append(ni); rpc.append(len(c2)); rco.append(c2)
        if c != 7: road_buf.append(l.buffer(RW[c] / 2 + 2.5))
out['roads'] = dict(n=len(rcls), cls=b64(np.array(rcls, 'u1')), name=b64(np.array(rname, '<u2')), pc=b64(np.array(rpc, '<u2')),
                    co=b64(np.concatenate(rco)), names=names)
print('roads', len(rcls), 'names', len(names))

# ---------- buildings ----------
bld = load('building')
lu_tree_g = [g for a, g, c in lu_items]; lu_tree_c = [c for a, g, c in lu_items]
lut = STRtree(lu_tree_g)
bn, bco, bh, bt, bnames, bpolys = [], [], [], [], {}, []
def hsh(s): return int(hashlib.md5(s.encode()).hexdigest()[:6], 16) / 0xffffff
for r in bld:
    g = r['g']
    pg = max(polys_of(g), key=lambda x: x.area, default=None)
    if pg is None: continue
    c0 = pg.centroid
    if not CLIP.contains(c0): continue
    pg = Polygon(pg.exterior).simplify(0.35)
    if pg.geom_type != 'Polygon' or pg.area < 6: continue
    if len(pg.exterior.coords) > 200: pg = pg.simplify(1.5)
    pg = shapely.geometry.polygon.orient(pg)
    a = pg.area; st, cl = r['subtype'], r['class']
    if cl in ('garage', 'shed', 'garages', 'farm_auxiliary', 'static_caravan') or st == 'outbuilding': t = 1
    elif cl in ('roof', 'carport', 'shelter'): t = 8
    elif cl == 'apartments': t = 2
    elif st == 'residential': t = 0
    elif st in ('commercial', 'entertainment', 'service', 'transportation'): t = 3
    elif st == 'industrial' or cl in ('warehouse', 'storage_tank', 'silo'): t = 4
    elif st in ('civic', 'education', 'medical'): t = 5
    elif st == 'religious': t = 6
    elif st == 'agricultural': t = 7
    else:
        lc = [lu_tree_c[i] for i in lut.query(c0, predicate='intersects')]
        if a < 45: t = 1
        elif a < 520: t = 3 if (21 in lc and a > 250 and 10 not in lc) else 0
        elif 22 in lc: t = 4
        elif 20 in lc or 32 in lc: t = 5
        elif 10 in lc and 21 not in lc: t = 2
        elif 11 in lc: t = 7
        else: t = 3
    h = r['height']; u = hsh(r['id'])
    if not h:
        nf = r['num_floors']
        h = nf * 3.3 + 1 if nf else [5.2 + 2.2 * u, 3, 10, 6 + (3 if a > 5000 else 0), 9, 9, 10, 7, 4.5][t]
    c = np.asarray(pg.exterior.coords)[:-1]
    bn.append(len(c)); bco.append(q(c)); bh.append(min(255, round(h * 4))); bt.append(t); bpolys.append(pg)
    if nm(r):
        bnames[len(bn) - 1] = nm(r); landmark_cands.append((nm(r), 'bld', c0.x, c0.y, a))
out['bld'] = dict(n=len(bn), pc=b64(np.array(bn, 'u1')), co=b64(np.concatenate(bco)), h=b64(np.array(bh, 'u1')),
                  t=b64(np.array(bt, 'u1')), names=bnames)
print('buildings', len(bn), 'verts', sum(bn), np.bincount(bt))

# ---------- infrastructure points ----------
pts = dict(tower=[], pole=[], comm=[], wtower=[], signal=[], stop=[])
PM = dict(power_tower='tower', power_pole='pole', utility_pole='pole', mobile_phone_tower='comm', communication_tower='comm',
          water_tower='wtower', traffic_signals='signal', stop='stop')
plines = []
for r in infra:
    k = PM.get(r['class']); g = r['g']
    if k:
        c = g.centroid
        if CLIP.contains(c): pts[k] += [round(c.x * Q), round(c.y * Q)]
    elif r['class'] == 'power_line' and g.geom_type == 'LineString':
        for l in lines_of(g.intersection(CLIP)): plines.append(q(np.asarray(l.coords)).ravel().tolist())
out['pts'] = pts; out['plines'] = plines
print({k: len(v) // 2 for k, v in pts.items()}, 'plines', len(plines))

# ---------- trees ----------
blockers = [g.buffer(1.5) for g in bpolys] + road_buf + wpolys
for r in luse:
    if r['class'] in ('pitch', 'green', 'fairway', 'bunker', 'tee', 'track') and r['g'].geom_type == 'Polygon': blockers.append(r['g'])
for r in infra:
    if r['class'] in ('parking', 'apron') and r['g'].geom_type == 'Polygon': blockers.append(r['g'])
    if r['class'] in ('runway', 'taxiway') and r['g'].geom_type == 'LineString': blockers.append(r['g'].buffer(25))
bt_tree = STRtree(blockers)
def scatter(g, dens, cap=None):
    g = g.intersection(CLIP)
    if g.is_empty: return np.zeros((0, 2))
    x0, y0, x1, y1 = g.bounds
    n = int((x1 - x0) * (y1 - y0) * dens)
    if n < 1: n = 1 if rng.random() < (x1 - x0) * (y1 - y0) * dens else 0
    if n == 0: return np.zeros((0, 2))
    P = np.c_[rng.uniform(x0, x1, n), rng.uniform(y0, y1, n)]
    return P[shapely.contains_xy(g, P[:, 0], P[:, 1])]
tp = []
wood = [r['g'] for r in land if r['class'] in ('wood', 'forest') and r['g'].geom_type in ('Polygon', 'MultiPolygon')]
wood = [g if g.is_valid else shapely.make_valid(g) for g in wood]
wood_u = shapely.unary_union(wood)
for g in wood: tp.append(scatter(g, 1 / 330))
for r in lcov:
    if r['subtype'] == 'forest':
        g = r['g'] if r['g'].is_valid else shapely.make_valid(r['g'])
        tp.append(scatter(g.difference(wood_u), 1 / 700))
    elif r['subtype'] == 'shrub':
        g = r['g'] if r['g'].is_valid else shapely.make_valid(r['g'])
        tp.append(scatter(g.difference(wood_u), 1 / 5000))
DENS = {10: 1 / 800, 12: 1 / 420, 19: 1 / 500, 13: 1 / 700, 20: 1 / 2500, 32: 1 / 1500, 21: 1 / 5000}
for a, g, c in lu_items:
    if c in DENS:
        g = g if g.is_valid else shapely.make_valid(g)
        tp.append(scatter(g, DENS[c]))
for r in land:
    g = r['g']
    if r['class'] == 'tree' and g.geom_type == 'Point': tp.append(np.array([[g.x, g.y]]))
    elif r['class'] == 'tree_row' and g.geom_type == 'LineString':
        tp.append(np.array([[*g.interpolate(d).coords[0]] for d in np.arange(0, g.length, 8)]).reshape(-1, 2))
P = np.concatenate(tp)
P = P[(abs(P[:, 0]) < HX - 2) & (abs(P[:, 1]) < HY - 2)]
hit = bt_tree.query(shapely.points(P), predicate='intersects')[0]
keep = np.ones(len(P), bool); keep[hit] = False
P = P[keep]
# thin out trees that are too close to each other (grid hash, 3 m)
key = np.floor(P / 3.0).astype(np.int64); _, ui = np.unique(key[:, 0] * 100000 + key[:, 1], return_index=True)
P = P[np.sort(ui)]
if len(P) > 150000: P = P[np.sort(rng.choice(len(P), 150000, replace=False))]
attr = (rng.integers(0, 16, len(P)) | ((rng.random(len(P)) < 0.13) << 4)).astype('u1')
out['trees'] = dict(n=len(P), co=b64(q(P)), a=b64(attr))
print('trees', len(P))

# ---------- terrain ----------
Z = 13; tx0, tx1, ty0, ty1 = 2137, 2141, 3097, 3101
mos = np.zeros(((ty1 - ty0 + 1) * 256, (tx1 - tx0 + 1) * 256))
for x in range(tx0, tx1 + 1):
    for y in range(ty0, ty1 + 1):
        im = np.asarray(Image.open(f'{T}{Z}_{x}_{y}.png').convert('RGB')).astype(float)
        mos[(y - ty0) * 256:(y - ty0 + 1) * 256, (x - tx0) * 256:(x - tx0 + 1) * 256] = im[:, :, 0] * 256 + im[:, :, 1] + im[:, :, 2] / 256 - 32768
NG = 321
gx = np.linspace(-HX, HX, NG); gy = np.linspace(-HY, HY, NG)
GX, GY = np.meshgrid(gx, gy)
lon = GX / KX + lon0; lat = GY / KY + lat0
n = 2 ** Z * 256
px = (lon + 180) / 360 * n - tx0 * 256 - 0.5
py = (1 - np.arcsinh(np.tan(np.radians(lat))) / np.pi) / 2 * n - ty0 * 256 - 0.5
ix = np.floor(px).astype(int); iy = np.floor(py).astype(int); fx = px - ix; fy = py - iy
Hh = (mos[iy, ix] * (1 - fx) * (1 - fy) + mos[iy, ix + 1] * fx * (1 - fy) + mos[iy + 1, ix] * (1 - fx) * fy + mos[iy + 1, ix + 1] * fx * fy)
k = np.array([1, 2, 1]) / 4
Hp = np.pad(Hh, 1, mode='edge')
Hh = sum(k[i] * k[j] * Hp[i:i + NG, j:j + NG] for i in range(3) for j in range(3))
inw = shapely.contains_xy(water_u, GX.ravel(), GY.ravel()).reshape(NG, NG)
Hh = Hh - 1.6 * inw
hmin = float(Hh.min())
out['terrain'] = dict(n=NG, hmin=hmin, h=b64(np.round((Hh - hmin) * 20).astype('<u2')))
print('terrain', hmin, Hh.max(), 'water cells', inw.sum())

# ---------- places ----------
pl = load('place'); places = []; cats = []; ci = {}
for r in pl:
    g = r['g']; n_ = nm(r)
    if not n_ or not CLIP.contains(g) or (r['confidence'] or 0) < 0.55: continue
    if r.get('operating_status') and 'closed' in r['operating_status']: continue
    c = r.get('basic_category') or (r.get('taxonomy') or {}).get('primary') or ''
    if c not in ci: ci[c] = len(cats); cats.append(c)
    places.append([round(g.x), round(g.y), n_[:48], ci[c]])
    landmark_cands.append((n_, 'place:' + c, g.x, g.y, r['confidence']))
out['places'] = places; out['pcats'] = cats
print('places', len(places))

# ---------- named areas, landmarks, specials ----------
areas = []
for r in luse + water:
    g = r['g']
    if nm(r) and g.geom_type in ('Polygon', 'MultiPolygon') and g.area > 3000:
        c = g.intersection(CLIP).representative_point() if r in water else g.centroid
        if CLIP.contains(c): areas.append([round(c.x), round(c.y), nm(r), round(math.sqrt(g.area / math.pi)), r['class']])
out['areas'] = areas
out['landmarks'] = [
    ['Courthouse Square', -1408, -110], ['Forest Park', -1773, 908], ["Potter's Covered Bridge", -251, 2760],
    ['Ruoff Music Center', 5718, -4771], ['Hamilton Town Center', 5586, -6128], ['Noblesville High School', -64, 820],
    ['Riverview Health', -2191, -245], ['Federal Hill Commons', -1860, -30], ['Morse Park & Beach', -3920, 2965],
    ['Morse Reservoir', -3700, 4600], ['Dillon Park', -5525, -4935], ['Finch Creek Park', 4783, -2596],
    ['Hamilton County Fairgrounds', -219, -1161], ['Noblesville Airport', 2648, -4881], ['Stony Creek Quarry', 5030, -467],
    ['Indiana Transportation Museum', -2485, 1956], ['Fox Prairie Golf Course', -2438, 2105], ['Conner Prairie', -2700, -6700],
    ['Ivy Tech Noblesville', -468, 104], ['Stony Creek Marketplace', 410, -1217], ['Pebble Brook Golf Club', -6600, 848],
    ['Purgatory Golf Club', 3950, 6518]]
for r in infra:
    if nm(r) == "Potter's Covered Bridge" and r['g'].geom_type != 'Point':
        c = np.asarray(r['g'].minimum_rotated_rectangle.exterior.coords) if r['g'].geom_type != 'LineString' else None
        if c is None: c = np.asarray(r['g'].coords); pp = [c[0], c[-1]]
        else:
            m = [(c[i] + c[i + 1]) / 2 for i in range(4)]
            pp = [m[0], m[2]] if np.hypot(*(m[0] - m[2])) > np.hypot(*(m[1] - m[3])) else [m[1], m[3]]
        out['potter'] = [float(pp[0][0]), float(pp[0][1]), float(pp[1][0]), float(pp[1][1])]
print('areas', len(areas), 'potter', out.get('potter'))

json.dump(out, open(OUT, 'w'), separators=(',', ':'))
json.dump(landmark_cands, open(OUT.replace('data.json', 'cands.json'), 'w'))
import os; print('size MB', os.path.getsize(OUT) / 1e6)
