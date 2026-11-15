import json, math, collections, pyarrow.parquet as pq, shapely
from shapely import from_wkb, ops
from shapely.geometry import box, Polygon, LineString, MultiPolygon
from shapely.ops import transform, substring, linemerge

LON0, LAT0 = -87.6298, 41.8789
KX = 111320*math.cos(math.radians(LAT0)); KY = 111132
W,S,E,N = -87.666,41.853,-87.5955,41.905
def P(lon,lat): return ((lon-LON0)*KX, (lat-LAT0)*KY)
def proj(g): return transform(lambda x,y,z=None:((x-LON0)*KX,(y-LAT0)*KY), g)
x0,y0 = P(W,S); x1,y1 = P(E,N)
BOX = box(x0,y0,x1,y1)
import os
D = os.environ.get("CHI_RAW", "../data/")
def load(n): return pq.read_table(D+n+".parquet").to_pylist()
def q(v): return int(round(v*10))
def enc(coords):
    out=[]; px=py=0
    for x,y in coords:
        X,Y=q(x),q(y)
        if out and X==px and Y==py: continue
        out+= [X-px, Y-py]; px,py=X,Y
    return out
def polys(g):
    if g.is_empty: return []
    if g.geom_type=="Polygon": return [g]
    if g.geom_type in("MultiPolygon","GeometryCollection"): return [p for x in g.geoms for p in polys(x)]
    return []
def lines(g):
    if g.is_empty: return []
    if g.geom_type=="LineString": return [g]
    if g.geom_type in("MultiLineString","GeometryCollection"): return [p for x in g.geoms for p in lines(x)]
    return []
def rings(p, tol):
    p = p.simplify(tol)
    if p.is_empty or p.geom_type!="Polygon" or p.area<1: return None
    p = shapely.geometry.polygon.orient(p, 1.0)
    rs=[enc(list(p.exterior.coords)[:-1])]
    for h in p.interiors:
        if Polygon(h).area>4: rs.append(enc(list(h.coords)[:-1]))
    if len(rs[0])<6: return None
    return rs

names=[]; nidx={}
def nm(r):
    n=(r.get("names") or {}).get("primary")
    if not n: return -1
    if n not in nidx: nidx[n]=len(names); names.append(n)
    return nidx[n]
def hexc(c):
    if c and c.startswith("#") and len(c)==7:
        try: return int(c[1:],16)
        except: pass
    return -1
KIND={"house":1,"terrace":1,"detached":1,"residential":2,"apartments":2,"office":3,"commercial":3,"retail":4,"industrial":5,
 "garage":5,"garages":5,"parking":5,"service":5,"university":6,"school":6,"church":6,"public":6,"college":6,"hospital":6,"train_station":6,"hotel":7,"roof":8,"shelter":8}
SUB={"residential":2,"commercial":3,"education":6,"civic":6,"religious":6,"industrial":5,"outbuilding":5,"medical":6,"entertainment":6,"transportation":6,"service":5}
def kind(r): return KIND.get(r.get("class")) or SUB.get(r.get("subtype")) or 0
ROOF={"pyramidal":1,"dome":1,"round":1,"hipped":0,"gabled":0}

B=[]; labels=[]
blds=load("building"); parts=load("building_part")
pb=collections.defaultdict(list)
for p in parts: pb[p["building_id"]].append(p)
def hsh(s): 
    h=0
    for ch in s: h=(h*31+ord(ch))&0xffff
    return h
stats=collections.Counter()
for r in blds:
    g=proj(from_wkb(r["geometry"]))
    if not BOX.contains(g.centroid): continue
    if (r.get("names") or {}).get("primary")=="Cloud Gate": continue   # drawn as a sculpture instead
    k=kind(r); ni=nm(r)
    h=r["height"]
    if not h:
        if r["num_floors"]: h=r["num_floors"]*3.3+1
        else: h={1:7,5:4,8:4}.get(k, 6+ (hsh(r["id"])%7))
    ps=pb.get(r["id"]) if r["has_parts"] else None
    top=h
    if ps:
        pg=[proj(from_wkb(p["geometry"])) for p in ps]
        cov=ops.unary_union(pg).area/max(g.area,1)
        if cov<0.6:
            stats["lowcov"]+=1
            rest=g.difference(ops.unary_union(pg).buffer(0.3))
            # uncovered remainder: podium at modest height
            ph=min(h, min([ (p["height"] or h) for p in ps]+[h]))
            for pp in polys(rest):
                if pp.area>30:
                    rs=rings(pp,0.4)
                    if rs: B.append([q(ph),0,hexc(r.get("facade_color")),k,ni,0,0]+rs)
        top=0
        for p,gg in zip(ps,pg):
            ph=p["height"] or ((p["num_floors"]*3.9+2) if p["num_floors"] else h)
            mh=p["min_height"] or 0
            if mh>=ph: continue
            top=max(top,ph)
            rt=ROOF.get(p.get("roof_shape"),0); rh=p.get("roof_height") or 0
            if rt and not rh: rh=min(ph-mh, 0.5*math.sqrt(gg.area))
            if rt and rh>=ph-mh: rh=ph-mh
            c=hexc(p.get("facade_color"))
            if c<0: c=hexc(r.get("facade_color"))
            for pp in polys(gg):
                rs=rings(pp,0.3)
                if rs: B.append([q(ph),q(mh),c,k,ni,rt,q(rh)]+rs); stats["part"]+=1
    else:
        rt=ROOF.get(r.get("roof_shape"),0); rh=r.get("roof_height") or 0
        if rt and not rh: rh=min(h*0.3, 0.5*math.sqrt(g.area))
        mh=r.get("min_height") or 0
        for pp in polys(g):
            rs=rings(pp,0.4)
            if rs: B.append([q(h),q(mh),hexc(r.get("facade_color")),k,ni,rt,q(rh)]+rs); stats["bld"]+=1
    if ni>=0 and top>=45:
        c=g.centroid; labels.append([ni,q(c.x),q(c.y),q(top)])
print(stats, len(B), "labels",len(labels))

# Towers are often mapped as a part standing inside its podium, both starting at the ground. Their walls then
# coincide and flicker, so lift each tower to the roof of the podium that contains it and drop fully hidden shapes.
from shapely import STRtree
def _poly(b):
    pts=[]; x=y=0; a=b[7]
    for i in range(0,len(a),2):
        x+=a[i]; y+=a[i+1]; pts.append((x*.1,y*.1))
    pg=Polygon(pts)
    return pg if pg.is_valid else pg.buffer(0)
PG=[_poly(b) for b in B]; tree=STRtree(PG); drop=set(); lift={}
for i,pg in enumerate(PG):
    if pg.is_empty: continue
    for j in tree.query(pg):
        if j==i or PG[j].is_empty: continue
        a,bb=B[i],B[j]                      # a = candidate container (lower), bb = inner (taller)
        if not (a[0]<bb[0] or (a[0]==bb[0] and i<j)): continue
        if a[1]>bb[1]+5 or a[0]<=bb[1]: continue
        inter=pg.intersection(PG[j]).area
        if inter<20: continue
        if inter>0.8*PG[j].area and a[0]<bb[0]: lift[j]=max(lift.get(j,bb[1]),a[0])      # tower inside podium
        elif inter>0.9*pg.area: drop.add(i)                                              # hidden inside a taller shape
for j,m in lift.items():
    if B[j][0]-m>20: B[j][1]=m
    else: drop.add(j) if B[j][0]<=m else None
B=[b for i,b in enumerate(B) if i not in drop]
print("lifted",len(lift),"dropped",len(drop),"buildings",len(B))

# roads
RC={"motorway":0,"trunk":0,"primary":1,"secondary":1,"tertiary":2,"residential":3,"unclassified":3,"living_street":3,
    "service":4,"track":4,"pedestrian":5,"footway":5,"path":5,"cycleway":5}
def split_levels(g, rules):
    """yield (piece, level)"""
    if not rules: yield g,0; return
    cuts={0.0,1.0}
    for r in rules:
        b=r.get("between") or [0,1]; cuts.add(b[0]); cuts.add(b[1])
    cuts=sorted(cuts)
    for a,b in zip(cuts,cuts[1:]):
        if b-a<1e-9: continue
        mid=(a+b)/2; lvl=0
        for r in rules:
            bb=r.get("between") or [0,1]
            if bb[0]<=mid<=bb[1]: lvl=r["value"] or 0
        yield substring(g,a,b,normalized=True), lvl
R=[]; RAIL=[]; elev=[]
for r in load("segment"):
    g=proj(from_wkb(r["geometry"]))
    if r["subtype"]=="road":
        c=RC.get(r["class"])
        if c is None: continue
        ni=nm(r) if c<4 else -1
        for piece,lvl in split_levels(g, r["level_rules"]):
            if lvl<0: continue
            for l in lines(piece.intersection(BOX)):
                l=l.simplify(0.4)
                if l.length<(6 if c==5 else 2): continue
                R.append([c,ni]+enc(l.coords))
    elif r["subtype"]=="rail":
        sub = r["class"] in ("subway","light_rail")
        for piece,lvl in split_levels(g, r["level_rules"]):
            if lvl<0: continue
            for l in lines(piece.intersection(BOX)):
                l=l.simplify(0.4)
                if l.length<3: continue
                if sub and lvl>=1: elev.append(l)
                else: RAIL.append(enc(l.coords))
print("roads",len(R),"rail",len(RAIL),"elev",len(elev))
# elevated: snap and merge
m=linemerge(shapely.set_precision(shapely.MultiLineString(elev),0.5))
EL=[enc(l.coords) for l in lines(m)]
# train routes: de-duplicate parallel tracks by keeping long lines not close to an already kept one
long=sorted([l for l in lines(m) if l.length>350], key=lambda l:-l.length)
kept=[]
for l in long:
    if any(l.hausdorff_distance(k)<12 or (l.buffer(8).intersection(k).length>0.6*l.length) for k in kept): continue
    kept.append(l)
TR=[enc(l.simplify(0.8).coords) for l in kept[:14]]
print("elev merged",len(EL),"train routes",len(TR),[round(l.length) for l in kept[:14]])

# land use
LC={"park":0,"recreation_ground":0,"green":0,"nature_reserve":0,"dog_park":0,"playground":0,"grass":1,"meadow":1,"pitch":2,"track":2,
    "pedestrian":3,"railway":4,"garden":5,"flowerbed":5,"allotments":5}
L=[]
for r in load("land_use"):
    c=LC.get(r["class"])
    if c is None and r["subtype"]=="park": c=0
    if c is None and r["subtype"]=="golf": c=1
    if c is None: continue
    g=proj(from_wkb(r["geometry"]))
    if g.geom_type not in("Polygon","MultiPolygon"): continue
    if not g.is_valid: g=g.buffer(0)
    for pp in polys(g.intersection(BOX)):
        if pp.area<25: continue
        rs=rings(pp,0.6)
        if rs: L.append([c]+rs)
L.sort(key=lambda a:(a[0] not in (0,), a[0]))
print("landuse",len(L), collections.Counter(a[0] for a in L))

# water
WT=[]
lx0,ly0=P(W-0.02,S-0.25); lx1,ly1=P(E+0.5,N+0.25)
LBOX=box(lx0,ly0,lx1,ly1); WBOX=box(*P(W-0.01,S-0.01),*P(E+0.01,N+0.01))
for r in load("water"):
    g=from_wkb(r["geometry"])
    if g.geom_type not in("Polygon","MultiPolygon"): continue
    lake = r["class"]=="lake"
    if lake: g=g.intersection(box(W-0.03,S-0.26,E+0.51,N+0.26))
    g=proj(g)
    if not g.is_valid: g=g.buffer(0)
    if lake:
        # cut the lake into 4 km tiles so no triangle is enormous (huge triangles clip badly near the camera)
        g=g.intersection(LBOX).simplify(1.5)
        bx0,by0,bx1,by1=g.bounds; T=4000.0
        ix=math.floor(bx0/T)
        while ix*T<bx1:
            iy=math.floor(by0/T)
            while iy*T<by1:
                for pp in polys(g.intersection(box(ix*T,iy*T,(ix+1)*T,(iy+1)*T))):
                    rs=rings(pp,0.01) if pp.area>=20 else None
                    if rs: WT.append(rs)
                iy+=1
            ix+=1
        continue
    for pp in polys(g.intersection(WBOX)):
        if pp.area<20: continue
        rs=rings(pp,0.5)
        if rs: WT.append(rs)
print("water",len(WT), sum(len(x) for w in WT for x in w)//2)

# piers / bridges
PV=[]; PL=[]
for r in load("infrastructure"):
    st=r["subtype"]; 
    if st not in("pier","bridge","quay"): continue
    if r["class"] in ("bridge_support",): continue
    g=proj(from_wkb(r["geometry"]))
    if g.geom_type in("Polygon","MultiPolygon"):
        if not g.is_valid: g=g.buffer(0)
        for pp in polys(g.intersection(BOX)):
            if pp.area<15: continue
            rs=rings(pp,0.5)
            if rs: PV.append([0 if st=="bridge" else 1]+rs)
    elif g.geom_type=="LineString" and st=="pier":
        for l in lines(g.intersection(BOX)):
            if l.length>4: PL.append(enc(l.simplify(0.4).coords))
print("paved polys",len(PV),"pier lines",len(PL))

out=dict(origin=[LON0,LAT0],k=[KX,KY],bounds=[x0,y0,x1,y1],names=names,b=B,labels=labels,r=R,rail=RAIL,el=EL,tr=TR,l=L,w=WT,pv=PV,pl=PL)
s=json.dumps(out,separators=(",",":"),ensure_ascii=False)
open(os.environ.get("CHI_OUT","../data/city.json"),"w").write(s); print("bytes",len(s), "names",len(names))
for k,v in out.items(): print(k, len(json.dumps(v,separators=(",",":"))))
