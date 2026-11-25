import os, sys, time, pyarrow.dataset as ds, pyarrow.compute as pc, pyarrow.fs as fs, pyarrow.parquet as pq
W,S,E,N = -88.35, 41.45, -87.25, 42.45
REL = sys.argv[1]
s3 = fs.S3FileSystem(anonymous=True, region="us-west-2",
    proxy_options={'scheme':'http','host':'127.0.0.1','port':int(__import__('os').environ['HTTPS_PROXY'].rsplit(':',1)[1])}, tls_ca_file_path="/root/.ccr/ca-bundle.crt")
jobs={
 "building":("theme=buildings/type=building",["geometry","names","height","num_floors","class","subtype","bbox"]),
 "segment":("theme=transportation/type=segment",["geometry","names","subtype","class","level_rules","bbox"]),
 "water":("theme=base/type=water",["geometry","names","subtype","class","bbox"]),
 "land_use":("theme=base/type=land_use",["geometry","subtype","class","bbox"]),
 "division":("theme=divisions/type=division",["geometry","names","subtype","class","population","bbox"]),
 "infrastructure":("theme=base/type=infrastructure",["geometry","names","subtype","class","bbox"]),
 "land_cover":("theme=base/type=land_cover",["geometry","subtype","bbox"]),
}
name=sys.argv[2]; path,cols=jobs[name]
t=time.time()
d=ds.dataset(f"overturemaps-us-west-2/release/{REL}/{path}", filesystem=s3, format="parquet")
cols=[c for c in cols if c in d.schema.names]
f=(pc.field("bbox","xmin")<E)&(pc.field("bbox","xmax")>W)&(pc.field("bbox","ymin")<N)&(pc.field("bbox","ymax")>S)
w=None; n=0
for b in d.to_batches(columns=cols, filter=f, batch_size=200000):
    if b.num_rows==0: continue
    if w is None: w=pq.ParquetWriter(os.environ.get("CHI_METRO_RAW", "../metro/") + f"{name}.parquet", b.schema)
    w.write_batch(b); n+=b.num_rows
    print(name, n, round(time.time()-t), flush=True)
w.close(); print("DONE", name, n, round(time.time()-t), flush=True)
