"""Turn the Overture metro-area layers into the compact streaming dataset used by chicago-3d.html.

Outputs (in OUT dir):
  metro.bin.gz     tiled buildings / roads / land use + global water and tall buildings (gzip)
  color.webp       ground colours for the whole area (4096 px)
  mask_{i}{j}.webp built-up mask, 2x2 quadrants (2048 px each)
  lights.webp      night-lights texture
Input: the Overture layers fetched with fetch_metro.py-style bbox queries into CHI_METRO_RAW.
"""
import os, sys, json, math, gzip, time, collections
import numpy as np, shapely, pyarrow.parquet as pq
from shapely import from_wkb
from shapely.geometry import box, Polygon, LineString
from shapely.ops import substring
from PIL import Image, ImageDraw, ImageFilter

RAW = os.environ.get("CHI_METRO_RAW", "../metro/")
OUT = os.environ.get("CHI_METRO_OUT", "../metro_out/")
os.makedirs(OUT, exist_ok=True)
LON0, LAT0 = -87.6298, 41.8789
KX = 111320 * math.cos(math.radians(LAT0)); KY = 111132
W, S, E, N = -88.35, 41.45, -87.25, 42.45
P = lambda lon, lat: ((lon - LON0) * KX, (lat - LAT0) * KY)
X0, Y0 = P(W, S); X1, Y1 = P(E, N)
T = 1000.0
NX, NY = math.ceil((X1 - X0) / T), math.ceil((Y1 - Y0) / T)
# downtown dataset bounds (kept from prep.py) - metro tiles skip what downtown already draws
DW, DS, DE, DN = -87.666, 41.853, -87.5955, 41.905
DX0, DY0 = P(DW, DS); DX1, DY1 = P(DE, DN)
DBOX = box(DX0, DY0, DX1, DY1)
# ground texture: 8192 px square at 13.6 m/px from (X0, Y0)
GPX = 13.6; GS = 8192; GEXT = GPX * GS
t0 = time.time()
def log(*a): print(f"[{time.time()-t0:6.1f}s]", *a, flush=True)

def proj_arr(geoms):
    return shapely.transform(geoms, lambda c: np.column_stack(((c[:, 0] - LON0) * KX, (c[:, 1] - LAT0) * KY)))

def zz(a): a = np.asarray(a, dtype=np.int64); return (a << 1) ^ (a >> 63)
def varint(vals):
    """vectorised LEB128 of non-negative ints -> (bytes, nbytes per value)"""
    v = np.asarray(vals, dtype=np.uint64)
    nb = np.ones(len(v), dtype=np.int64)
    for k in range(1, 5): nb += (v >= (np.uint64(1) << np.uint64(7 * k)))
    total = int(nb.sum()); out = np.empty(total, dtype=np.uint8)
    starts = np.concatenate(([0], np.cumsum(nb)[:-1]))
    for k in range(5):
        sel = nb > k
        b = ((v[sel] >> np.uint64(7 * k)) & np.uint64(127)).astype(np.uint8)
        b |= np.where(nb[sel] > k + 1, 128, 0).astype(np.uint8)
        out[starts[sel] + k] = b
    return out.tobytes(), nb

def ring_payload(coords_list, origins, unit):
    """coords_list: list of (n,2) arrays; returns flat int list per ring: n, zz(first rel origin), zz(deltas)"""
    flat = []
    for c, (ox, oy) in zip(coords_list, origins):
        q = np.round(np.column_stack((c[:, 0] - ox, c[:, 1] - oy)) / unit).astype(np.int64)
        d = q.copy(); d[1:] -= q[:-1]
        flat.append(np.concatenate(([len(q)], zz(d.ravel()))))
    return flat

def tile_of(x, y):
    i = np.floor((x - X0) / T).astype(np.int64); j = np.floor((y - Y0) / T).astype(np.int64)
    ok = (i >= 0) & (i < NX) & (j >= 0) & (j < NY)
    return np.where(ok, i * NY + j, -1)

names = []; nidx = {}
def nm(n):
    if not n: return -1
    if n not in nidx: nidx[n] = len(names); names.append(n)
    return nidx[n]

# ───────────────────────────── buildings ─────────────────────────────
KIND = {"house": 0, "detached": 0, "semidetached_house": 0, "bungalow": 0, "terrace": 2, "residential": 2, "apartments": 2, "dormitory": 2,
        "garage": 1, "garages": 1, "shed": 1, "carport": 1, "hut": 1, "barn": 4, "farm_auxiliary": 1, "greenhouse": 1,
        "commercial": 3, "retail": 3, "office": 3, "hotel": 3, "supermarket": 3, "kiosk": 3,
        "industrial": 4, "warehouse": 4, "manufacture": 4, "service": 4, "storage_tank": 4, "hangar": 4, "parking": 4,
        "school": 5, "university": 5, "college": 5, "church": 5, "public": 5, "civic": 5, "hospital": 5, "government": 5,
        "train_station": 5, "fire_station": 5, "religious": 5, "chapel": 5, "mosque": 5, "synagogue": 5, "temple": 5, "stadium": 5}
SUBK = {"residential": 0, "outbuilding": 1, "commercial": 3, "industrial": 4, "service": 4, "agricultural": 4, "transportation": 5,
        "civic": 5, "education": 5, "religious": 5, "medical": 5, "entertainment": 5, "military": 4}

def h32(a):
    a = np.asarray(a, dtype=np.uint64)
    a = (a ^ (a >> np.uint64(16))) * np.uint64(0x45d9f3b) & np.uint64(0xffffffff)
    a = (a ^ (a >> np.uint64(16))) * np.uint64(0x45d9f3b) & np.uint64(0xffffffff)
    return (a ^ (a >> np.uint64(16))) & np.uint64(0xffffffff)

R = collections.defaultdict(list)   # rect columns
Pl = collections.defaultdict(list)  # poly columns
TALL = []
mask_polys = []                     # for the raster: (coords array)
bf = pq.ParquetFile(RAW + "building.parquet")
done = 0
for batch in bf.iter_batches(batch_size=250000, columns=["geometry", "names", "height", "num_floors", "class", "subtype"]):
    g = proj_arr(from_wkb(batch.column("geometry").to_numpy(zero_copy_only=False)))
    poly = shapely.get_type_id(g) == 3
    multi = shapely.get_type_id(g) == 6
    if multi.any():   # keep the largest part of multipolygons
        for k in np.where(multi)[0]:
            parts = list(g[k].geoms); g[k] = max(parts, key=lambda p: p.area)
        poly |= multi
    g = shapely.make_valid(g)
    g = np.array([x if x.geom_type == "Polygon" else (max((p for p in getattr(x, "geoms", []) if p.geom_type == "Polygon"), key=lambda p: p.area, default=None)) for x in g], dtype=object)
    ok = np.array([x is not None and not x.is_empty for x in g])
    g = np.where(ok, g, shapely.Point(0, 0))
    area = shapely.area(g); cen = shapely.centroid(g); cx = shapely.get_x(cen); cy = shapely.get_y(cen)
    hgt = batch.column("height").to_numpy(zero_copy_only=False).astype(float)
    nfl = batch.column("num_floors").to_numpy(zero_copy_only=False).astype(float)
    cls = batch.column("class").to_pylist(); sub = batch.column("subtype").to_pylist()
    nms = batch.column("names").to_pylist()
    keep = ok & (area >= 14) & ~((cx > DX0) & (cx < DX1) & (cy > DY0) & (cy < DY1)) & np.array([c != "roof" for c in cls])
    tile = tile_of(cx, cy); keep &= tile >= 0
    idx = np.where(keep)[0]
    g, area, cx, cy, tile, hgt, nfl = g[idx], area[idx], cx[idx], cy[idx], tile[idx], hgt[idx], nfl[idx]
    cls = [cls[i] for i in idx]; sub = [sub[i] for i in idx]; nms = [nms[i] for i in idx]
    rid = h32(np.arange(done, done + len(idx)) * 2654435761 + 12345).astype(np.int64)
    # kind
    kind = np.array([KIND.get(c, SUBK.get(s, -1)) if (c or s) else -1 for c, s in zip(cls, sub)])
    unk = kind < 0
    est = np.where(np.isnan(hgt), np.where(np.isnan(nfl), np.nan, nfl * 3.2 + 1.0), hgt)
    kind = np.where(unk & (area < 55), 1, kind)
    kind = np.where((kind < 0) & (area < 380) & ~(est > 14), 0, kind)
    kind = np.where((kind < 0) & (area > 2500) & ~(est > 16), 4, kind)
    kind = np.where(kind < 0, np.where(rid % 3 == 0, 3, 2), kind)
    # height
    dflt = np.select([kind == 1, kind == 0, kind == 4, area > 2000], [3.0 + (rid % 7) * 0.12, 6.5 + (rid % 23) * 0.12, 8.5 + (rid % 9) * 0.4, 10.0], 9.0 + (rid % 11) * 0.5)
    h = np.where(np.isnan(est), dflt, est); h = np.clip(h, 2.6, 600)
    # oriented rectangles
    mrr = shapely.minimum_rotated_rectangle(g)
    rect_area = shapely.area(mrr)
    mc = shapely.get_coordinates(mrr, return_index=True)
    # each mrr is a polygon of 5 coords (degenerate cases skipped below)
    cnt = np.bincount(mc[1], minlength=len(g))
    rq = area / np.maximum(rect_area, 1e-6)
    isrect = (cnt == 5) & ((rq > 0.9) | ((rq > 0.8) & (area < 450)))
    co = mc[0]
    first = np.concatenate(([0], np.cumsum(cnt)[:-1]))
    p0 = co[np.minimum(first, len(co) - 1)]; p1 = co[np.minimum(first + 1, len(co) - 1)]; p2 = co[np.minimum(first + 2, len(co) - 1)]
    e0 = p1 - p0; e1 = p2 - p1
    L0 = np.hypot(e0[:, 0], e0[:, 1]); L1 = np.hypot(e1[:, 0], e1[:, 1])
    ang = np.degrees(np.arctan2(e0[:, 1], e0[:, 0])) % 180
    sw = ang >= 90; ang = np.where(sw, ang - 90, ang); WL = np.where(sw, L1, L0); LL = np.where(sw, L0, L1)
    mcx = (p0[:, 0] + p2[:, 0]) / 2; mcy = (p0[:, 1] + p2[:, 1]) / 2
    isrect &= (WL < 63.7) & (LL < 63.7) & (WL > 1) & (LL > 1)
    tall = h >= 35
    isrect &= ~tall
    # roofs: 0 flat, 1 gable, 2 hip
    short = np.minimum(WL, LL)
    resi = isrect & (h < 16) & (short < 22)
    r = rid % 100
    roof = np.zeros(len(g), dtype=np.int64)
    roof = np.where(resi & (kind == 0) & (r < 55), 1, roof)
    roof = np.where(resi & (kind == 0) & (r >= 55) & (r < 92), 2, roof)
    roof = np.where(resi & (kind == 1) & (r < 45) & (area > 18), 1, roof)
    roof = np.where(resi & (kind == 2) & (area < 500) & (r < 35), 1 + (r % 2), roof)
    flags = roof | (kind << 2)
    tx = X0 + (tile // NY) * T; ty = Y0 + (tile % NY) * T
    # rects
    sel = np.where(isrect)[0]
    R["tile"].append(tile[sel])
    R["cx"].append(mcx[sel] - tx[sel]); R["cy"].append(mcy[sel] - ty[sel])
    R["w"].append(np.round(WL[sel] / 0.25).astype(np.uint8)); R["l"].append(np.round(LL[sel] / 0.25).astype(np.uint8))
    R["a"].append((np.round(ang[sel] / 90 * 256).astype(np.int64) % 256).astype(np.uint8))
    R["h"].append(np.clip(np.round(h[sel] * 4), 0, 255).astype(np.uint8)); R["f"].append(flags[sel].astype(np.uint8))
    # polygons
    sel = np.where(~isrect & ~tall)[0]
    gs = shapely.orient_polygons(shapely.simplify(g[sel], 0.9)) if hasattr(shapely, "orient_polygons") else np.array([shapely.geometry.polygon.orient(x, 1.0) for x in shapely.simplify(g[sel], 0.35)], dtype=object)
    for k, gg in zip(sel, gs):
        if gg.is_empty or gg.geom_type != "Polygon": continue
        c = np.asarray(gg.exterior.coords)[:-1]
        if len(c) < 3: continue
        Pl["tile"].append(tile[k]); Pl["h"].append(int(round(h[k] * 10))); Pl["f"].append(int(kind[k] << 2))
        Pl["coords"].append(c); Pl["org"].append((tx[k], ty[k]))
    for k in np.where(tall)[0]:
        gg = shapely.geometry.polygon.orient(g[k].simplify(0.3), 1.0)
        if gg.is_empty or gg.geom_type != "Polygon": continue
        n = (nms[k] or {}).get("primary")
        TALL.append((np.asarray(gg.exterior.coords)[:-1], float(h[k]), nm(n), int(kind[k])))
    mask_polys.append(shapely.get_coordinates(shapely.simplify(g, 2.0), return_index=True))
    done += len(batch)
    log("buildings", done, "rects", sum(len(a) for a in R["tile"]), "polys", len(Pl["tile"]), "tall", len(TALL))

# ───────────────────────────── roads ─────────────────────────────
RC = {"motorway": 0, "trunk": 0, "primary": 1, "secondary": 1, "tertiary": 2, "residential": 3, "unclassified": 3, "living_street": 3, "service": 4}
RAILC = {"standard_gauge": 6, "subway": 6, "light_rail": 6, "unknown": 6, "narrow_gauge": 6}
roads = []  # (tile, cls, nameidx, coords)
seg = pq.read_table(RAW + "segment.parquet", columns=["geometry", "names", "subtype", "class", "level_rules"]).to_pylist()
log("segments loaded", len(seg))
for r in seg:
    if r["subtype"] == "road": c = RC.get(r["class"])
    elif r["subtype"] == "rail": c = RAILC.get(r["class"])
    else: c = None
    if c is None: continue
    g = from_wkb(r["geometry"])
    g = shapely.transform(g, lambda a: np.column_stack(((a[:, 0] - LON0) * KX, (a[:, 1] - LAT0) * KY)))
    pieces = [g]
    rules = r["level_rules"]
    if rules:
        cuts = {0.0, 1.0}
        for q in rules: b = q.get("between") or [0, 1]; cuts |= {b[0], b[1]}
        cuts = sorted(cuts); pieces = []
        for a, b in zip(cuts, cuts[1:]):
            if b - a < 1e-9: continue
            mid = (a + b) / 2; lvl = 0
            for q in rules:
                bb = q.get("between") or [0, 1]
                if bb[0] <= mid <= bb[1]: lvl = q.get("value") or 0
            if lvl >= 0: pieces.append(substring(g, a, b, normalized=True))
    ni = nm((r["names"] or {}).get("primary")) if c <= 3 else -1
    for pc in pieces:
        if pc.geom_type != "LineString" or pc.length < (35 if c == 4 else 3): continue
        if DBOX.contains(pc): continue
        pc = pc.simplify(0.8)
        mp = pc.interpolate(0.5, normalized=True)
        t = int(tile_of(np.array([mp.x]), np.array([mp.y]))[0])
        if t < 0: continue
        roads.append((t, c, ni, np.asarray(pc.coords)))
# runways / taxiways as wide roads
inf = pq.read_table(RAW + "infrastructure.parquet", columns=["geometry", "subtype", "class"]).to_pylist()
aprons = []
for r in inf:
    if r["subtype"] != "airport": continue
    g = from_wkb(r["geometry"])
    g = shapely.transform(g, lambda a: np.column_stack(((a[:, 0] - LON0) * KX, (a[:, 1] - LAT0) * KY)))
    if r["class"] in ("runway", "taxiway", "taxilane", "stopway") and g.geom_type == "LineString":
        mp = g.interpolate(0.5, normalized=True); t = int(tile_of(np.array([mp.x]), np.array([mp.y]))[0])
        if t >= 0: roads.append((t, 7 if r["class"] in ("runway", "stopway") else 8, -1, np.asarray(g.simplify(0.6).coords)))
    elif r["class"] == "apron" and g.geom_type == "Polygon":
        aprons.append(g)
log("roads", len(roads), collections.Counter(x[1] for x in roads))
del seg, inf

# ───────────────────────────── land use / cover ─────────────────────────────
# near-ground classes: 0 park 1 grass 2 pitch 3 plaza 4 rail yard 5 garden 6 forest 7 golf 8 cemetery 9 farmland 10 apron 11 residential (trees only) 12 wetland
LU = {("park", "park"): 0, ("recreation", "recreation_ground"): 0, ("protected", "nature_reserve"): 6, ("managed", "grass"): 1, ("agriculture", "meadow"): 1,
      ("recreation", "pitch"): 2, ("recreation", "track"): 2, ("pedestrian", "pedestrian"): 3, ("transportation", "railway"): 4,
      ("horticulture", "garden"): 5, ("golf", "fairway"): 7, ("golf", "green"): 7, ("golf", "tee"): 7, ("golf", "rough"): 1, ("golf", "golf_course"): 1,
      ("cemetery", "cemetery"): 8, ("cemetery", "grave_yard"): 8, ("agriculture", "farmland"): 9, ("residential", "residential"): 11, ("recreation", "playground"): 1}
land = []  # (cls, polygon)
for r in pq.read_table(RAW + "land_use.parquet", columns=["geometry", "subtype", "class"]).to_pylist():
    c = LU.get((r["subtype"], r["class"]))
    if c is None and r["subtype"] == "park": c = 0
    if c is None and r["subtype"] == "golf" and r["class"] not in ("bunker", "water_hazard", "lateral_water_hazard"): c = 1
    if c is None: continue
    land.append((c, from_wkb(r["geometry"])))
LC = {"forest": 6, "wetland": 12, "grass": 1}
cover = []  # coarse land cover for the raster only
for r in pq.read_table(RAW + "land_cover.parquet", columns=["geometry", "subtype"]).to_pylist():
    cover.append((r["subtype"], from_wkb(r["geometry"])))
    if r["subtype"] in LC: land.append((LC[r["subtype"]], from_wkb(r["geometry"])))
for g in aprons: land.append((10, shapely.transform(g, lambda a: np.column_stack((a[:, 0] / KX + LON0, a[:, 1] / KY + LAT0)))))
log("land", len(land), "cover", len(cover))

def polys(g):
    if g.is_empty: return []
    if g.geom_type == "Polygon": return [g]
    if g.geom_type in ("MultiPolygon", "GeometryCollection"): return [p for x in g.geoms for p in polys(x)]
    return []

LAND = []  # (tile, cls, coords)
RASTER_ONLY = []
for c, g in land:
    g = proj_arr(np.array([g]))[0]
    if not g.is_valid: g = g.buffer(0)
    if c in (9, 11): RASTER_ONLY.append((c, g)); continue
    if DBOX.intersects(g): g = g.difference(DBOX)
    if g.is_empty: continue
    b = g.bounds
    if b[2] < X0 or b[0] > X1 or b[3] < Y0 or b[1] > Y1: continue
    i0, i1 = max(0, int((b[0] - X0) // T)), min(NX - 1, int((b[2] - X0) // T))
    j0, j1 = max(0, int((b[1] - Y0) // T)), min(NY - 1, int((b[3] - Y0) // T))
    for i in range(i0, i1 + 1):
        for j in range(j0, j1 + 1):
            cell = box(X0 + i * T, Y0 + j * T, X0 + (i + 1) * T, Y0 + (j + 1) * T)
            piece = g.intersection(cell) if not cell.contains(g) else g
            for p in polys(piece):
                if p.area < 150: continue
                p = shapely.geometry.polygon.orient(p.simplify(2.0), 1.0)
                if p.is_empty or p.geom_type != "Polygon": continue
                LAND.append((i * NY + j, c, np.asarray(p.exterior.coords)[:-1]))
log("land pieces", len(LAND))

# ───────────────────────────── water (global) ─────────────────────────────
WPOLY = []; WLINE = []
wt = pq.read_table(RAW + "water.parquet", columns=["geometry", "subtype", "class"]).to_pylist()
LAKE_BOX = box(-88.5, 41.30, -86.20, 43.25)
for r in wt:
    g = from_wkb(r["geometry"])
    if r["class"] == "swimming_pool": continue
    if g.geom_type in ("LineString", "MultiLineString"):
        if r["class"] in ("stream", "drain", "ditch"):
            g = proj_arr(np.array([g]))[0].simplify(1.0)
            for l in (g.geoms if hasattr(g, "geoms") else [g]):
                if l.length > 20: WLINE.append((3.5 if r["class"] == "stream" else 2.2, np.asarray(l.coords)))
        continue
    if g.geom_type not in ("Polygon", "MultiPolygon"): continue
    lake = r["class"] == "lake" and g.area > 1
    if lake: g = g.intersection(LAKE_BOX)
    g = proj_arr(np.array([g]))[0]
    if not g.is_valid: g = g.buffer(0)
    if g.is_empty or g.area < 120: continue
    tol = 1.2
    if lake: g = g.simplify(4.0); tol = 0
    b = g.bounds; TT = 4000.0
    for i in range(int(b[0] // TT), int(b[2] // TT) + 1):
        for j in range(int(b[1] // TT), int(b[3] // TT) + 1):
            cell = box(i * TT, j * TT, (i + 1) * TT, (j + 1) * TT)
            if not cell.intersects(g): continue
            piece = g.intersection(cell)
            for p in polys(piece):
                if p.area < 120: continue
                if tol: p = p.simplify(tol)
                p = shapely.geometry.polygon.orient(p, 1.0)
                if p.is_empty or p.geom_type != "Polygon": continue
                rings = [np.asarray(p.exterior.coords)[:-1]] + [np.asarray(h.coords)[:-1] for h in p.interiors if Polygon(h).area > 120]
                WPOLY.append(rings)
log("water polys", len(WPOLY), "stream lines", len(WLINE))

# ───────────────────────────── encode ─────────────────────────────
def cat(k, d): return np.concatenate(d[k]) if d[k] else np.zeros(0)
rt = cat("tile", R).astype(np.int64)
rcx = cat("cx", R); rcy = cat("cy", R)
band = np.floor(rcy / 40).astype(np.int64)
order = np.lexsort((np.where(band % 2 == 0, rcx, -rcx), band, rt))      # serpentine rows inside each tile
rt = rt[order]
rect_cols = {k: cat(k, R)[order] for k in ("w", "l", "a", "h", "f")}
qx = np.round(rcx[order] / 0.25).astype(np.int64); qy = np.round(rcy[order] / 0.25).astype(np.int64)
first = np.r_[True, rt[1:] != rt[:-1]]
dx = qx - np.r_[0, qx[:-1]]; dy = qy - np.r_[0, qy[:-1]]
dx[first] = qx[first]; dy[first] = qy[first]
rc_b, nb = varint(np.column_stack((zz(dx), zz(dy))).ravel())
rcBytes = np.bincount(rt, weights=nb.reshape(-1, 2).sum(1), minlength=NX * NY).astype(np.int64)
nRect = np.bincount(rt, minlength=NX * NY)
pt = np.array(Pl["tile"], dtype=np.int64); po = np.argsort(pt, kind="stable")
nPoly = np.bincount(pt, minlength=NX * NY)
poly_h = np.array(Pl["h"], dtype=np.uint16)[po]; poly_f = np.array(Pl["f"], dtype=np.uint8)[po]
pay = ring_payload([Pl["coords"][k] for k in po], [Pl["org"][k] for k in po], 0.25)
flat = np.concatenate(pay) if pay else np.zeros(0, dtype=np.int64)
pbytes, nb = varint(flat)
per = np.add.reduceat(nb, np.concatenate(([0], np.cumsum([len(a) for a in pay])[:-1]))) if pay else np.zeros(0)
polyBytes = np.bincount(pt[po], weights=per, minlength=NX * NY).astype(np.int64)
log("poly bytes", len(pbytes))

def stream(items, key_tile, unit, head):
    """items sorted by tile -> (bytes, count per tile, bytes per tile). head(item) -> list of ints before coords"""
    items = sorted(items, key=key_tile)
    pay = []
    for it in items:
        tl = it[0]; ox, oy = X0 + (tl // NY) * T, Y0 + (tl % NY) * T
        c = it[-1]; q = np.round(np.column_stack((c[:, 0] - ox, c[:, 1] - oy)) / unit).astype(np.int64)
        d = q.copy(); d[1:] -= q[:-1]
        pay.append(np.concatenate((head(it), [len(q)], zz(d.ravel()))))
    flat = np.concatenate(pay) if pay else np.zeros(0, dtype=np.int64)
    by, nb = varint(flat)
    per = np.add.reduceat(nb, np.concatenate(([0], np.cumsum([len(a) for a in pay])[:-1]))) if pay else np.zeros(0)
    tl = np.array([it[0] for it in items], dtype=np.int64)
    return by, np.bincount(tl, minlength=NX * NY), np.bincount(tl, weights=per, minlength=NX * NY).astype(np.int64)

road_b, nRoad, roadBytes = stream(roads, lambda r: (r[0], -r[1]), 0.5, lambda r: [r[1], r[2] + 1])
land_b, nLand, landBytes = stream(LAND, lambda r: (r[0], r[1]), 0.5, lambda r: [r[1]])
log("road bytes", len(road_b), "land bytes", len(land_b))
idx_flat = np.column_stack((nRect, rcBytes, nPoly, polyBytes, nRoad, roadBytes, nLand, landBytes)).ravel()
idx_b, _ = varint(idx_flat)
# globals: water and tall buildings, absolute coords in 0.5 m (water) / 0.1 m (tall) units
def glob(rings_list, unit, head=lambda k: []):
    pay = []
    for k, rings in enumerate(rings_list):
        parts = [head(k), [len(rings)]]
        for c in rings:
            q = np.round(c / unit).astype(np.int64); d = q.copy(); d[1:] -= q[:-1]
            parts += [[len(q)], zz(d.ravel())]
        pay.append(np.concatenate([np.asarray(p, dtype=np.int64) for p in parts]))
    return varint(np.concatenate(pay))[0] if pay else b""
water_b = glob(WPOLY, 0.5)
wline_b = glob([[c] for _, c in WLINE], 0.5, lambda k: [int(WLINE[k][0] * 10)])
tall_b = glob([[t[0]] for t in TALL], 0.1, lambda k: [int(TALL[k][1] * 10), TALL[k][2] + 1, TALL[k][3]])

# places (HUD + labels)
places = []
for r in pq.read_table(RAW + "division.parquet").to_pylist():
    if r["subtype"] not in ("locality", "neighborhood", "macrohood"): continue
    g = from_wkb(r["geometry"]);
    if g.geom_type != "Point": g = g.representative_point()
    x, y = P(g.x, g.y)
    places.append([r["names"]["primary"], round(x), round(y), {"locality": 0, "macrohood": 1, "neighborhood": 2}[r["subtype"]], int(r["population"] or 0)])

sections = [("idx", idx_b), ("rc", rc_b),
            ("rw", rect_cols["w"].astype(np.uint8).tobytes()), ("rl", rect_cols["l"].astype(np.uint8).tobytes()), ("ra", rect_cols["a"].astype(np.uint8).tobytes()),
            ("rh", rect_cols["h"].astype(np.uint8).tobytes()), ("rf", rect_cols["f"].astype(np.uint8).tobytes()),
            ("ph", poly_h.astype("<u2").tobytes()), ("pf", poly_f.tobytes()), ("pv", pbytes), ("road", road_b), ("land", land_b),
            ("water", water_b), ("wline", wline_b), ("tall", tall_b)]
offs = {}; blob = bytearray();
for k, b in sections:
    while len(blob) % 4: blob.append(0)
    offs[k] = [len(blob), len(b)]; blob += b
head = dict(v=1, origin=[LON0, LAT0], k=[KX, KY], tile=T, nx=NX, ny=NY, x0=X0, y0=Y0, x1=X1, y1=Y1, nRect=int(nRect.sum()), nPoly=int(nPoly.sum()),
            ground=dict(x0=X0, y0=Y0, ext=GEXT, n=2), offs=offs, names=names, places=places, nTall=len(TALL))
open(OUT + "metro.json", "w").write(json.dumps(head, separators=(",", ":"), ensure_ascii=False))
open(OUT + "metro.bin.gz", "wb").write(gzip.compress(bytes(blob), 9))
log("blob raw", len(blob), "gz", os.path.getsize(OUT + "metro.bin.gz"), {k: v[1] for k, v in offs.items()})

# ───────────────────────────── rasters ─────────────────────────────
SS = 2  # supersample
GW = GS * SS
def gx(x): return (x - X0) / GPX * SS
def gy(y): return (GEXT - (y - Y0)) / GPX * SS
def pts(c): return list(zip(gx(c[:, 0]).tolist(), gy(c[:, 1]).tolist()))
rgb = Image.new("RGB", (GW, GW), (150, 148, 132)); dr = ImageDraw.Draw(rgb)
COVER = {"crop": (176, 168, 116), "forest": (74, 100, 62), "shrub": (128, 138, 96), "wetland": (104, 124, 102), "barren": (168, 162, 146), "urban": (152, 150, 140), "grass": (126, 150, 96)}
for sub, g in cover:
    c = COVER.get(sub); g = proj_arr(np.array([g]))[0]
    for p in polys(g): dr.polygon(pts(np.asarray(p.exterior.coords)), fill=c)
LUC = {0: (104, 148, 86), 1: (122, 156, 94), 2: (112, 160, 100), 3: (192, 186, 172), 4: (132, 126, 118), 5: (98, 140, 86), 6: (70, 98, 60),
       7: (118, 170, 94), 8: (112, 140, 94), 9: (178, 170, 118), 10: (174, 174, 168), 11: (132, 144, 110), 12: (100, 122, 100)}
for c, g in RASTER_ONLY:
    for p in polys(g): dr.polygon(pts(np.asarray(p.exterior.coords)), fill=LUC[c])
for c in sorted(LUC, key=lambda c: (c != 6, c)):
    for t, cc, co in LAND:
        if cc == c: dr.polygon(pts(co), fill=LUC[c])
log("raster land")
for rings in WPOLY:
    dr.polygon(pts(rings[0]), fill=(44, 92, 124))
for wdt, c in WLINE: dr.line(pts(c), fill=(52, 98, 128), width=max(1, int(wdt / GPX * SS)))
mask = Image.new("L", (GW, GW), 0); dm = ImageDraw.Draw(mask)
lights = Image.new("L", (GW // 2, GW // 2), 0); dl = ImageDraw.Draw(lights)
RW = {0: 28, 1: 16, 2: 12, 3: 9, 4: 5, 6: 4, 7: 55, 8: 24}
RV = {0: 255, 1: 235, 2: 220, 3: 200, 4: 150, 6: 120, 7: 245, 8: 220}
LV = {0: 255, 1: 210, 2: 170, 3: 120, 4: 50, 6: 0, 7: 120, 8: 60}
for t, c, ni, co in roads:
    p = pts(co); dm.line(p, fill=RV[c], width=max(1, round(RW[c] / GPX * SS)))
    if LV[c]: dl.line([(a / 2, b / 2) for a, b in p], fill=LV[c], width=max(1, round(RW[c] / GPX * SS / 2)))
log("raster roads")
for co, ix in mask_polys:
    splits = np.flatnonzero(np.diff(ix)) + 1
    for part in np.split(co, splits):
        if len(part) >= 3: dm.polygon(pts(part), fill=255)
for c, h, n, k in TALL: dm.polygon(pts(c), fill=255)
log("raster buildings")
rgb = rgb.resize((GS, GS), Image.BOX); mask = mask.resize((GS, GS), Image.BOX)
lights = lights.resize((GS // 4, GS // 4), Image.BOX)  # 2048 px
mk = np.asarray(mask).astype(np.float32) / 255
lights = Image.fromarray(np.clip(np.asarray(lights).astype(np.float32) + np.asarray(mask.resize((GS // 4, GS // 4), Image.BOX)).astype(np.float32) * 0.25, 0, 255).astype(np.uint8)).point(lambda v: 0 if v < 40 else int(min(255, (v - 40) * 1.15)))
lights = lights.filter(ImageFilter.GaussianBlur(0.8))
rgb.resize((4096, 4096), Image.BOX).save(OUT + "color.webp", quality=80, method=6)
mk = np.asarray(mask)
for i in range(2):
    for j in range(2):   # i = column (west to east), j = row (north to south)
        Image.fromarray(mk[j * 4096:(j + 1) * 4096, i * 4096:(i + 1) * 4096]).resize((2048, 2048), Image.BOX).save(OUT + f"mask_{i}{j}.webp", quality=70, method=6)
lights.save(OUT + "lights.webp", quality=80, method=6)
for f in sorted(os.listdir(OUT)): log(f, os.path.getsize(OUT + f))
