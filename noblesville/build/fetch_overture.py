import os, sys, json, time
import pyarrow as pa, pyarrow.dataset as ds, pyarrow.compute as pc, pyarrow.fs as fs, pyarrow.parquet as pq
W,S,E,N = -86.08,39.985,-85.915,40.11
REL="2026-10-21.0"
theme={'building':'buildings','building_part':'buildings','segment':'transportation','water':'base','land_use':'base','land':'base','infrastructure':'base','place':'places','land_cover':'base'}
f = fs.S3FileSystem(anonymous=True, region='us-west-2', proxy_options=os.environ['HTTPS_PROXY'].replace('http://','http://'), request_timeout=120, connect_timeout=30)
for t in sys.argv[1:]:
    t0=time.time()
    path=f"overturemaps-us-west-2/release/{REL}/theme={theme[t]}/type={t}/"
    d=ds.dataset(path, filesystem=f, format='parquet')
    flt=(pc.field('bbox','xmin')<E)&(pc.field('bbox','xmax')>W)&(pc.field('bbox','ymin')<N)&(pc.field('bbox','ymax')>S)
    tbl=d.to_table(filter=flt)
    pq.write_table(tbl, f"/tmp/nb/data/{t}.parquet")
    print(t, tbl.num_rows, round(time.time()-t0), 's', flush=True)
