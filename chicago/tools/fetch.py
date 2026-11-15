import sys, pyarrow.dataset as ds, pyarrow.compute as pc, pyarrow.fs as fs, pyarrow.parquet as pq
W,S,E,N = -87.668,41.852,-87.594,41.906
s3 = fs.S3FileSystem(anonymous=True, region="us-west-2",
    proxy_options={'scheme':'http','host':'127.0.0.1','port':46001},
    tls_ca_file_path="/root/.ccr/ca-bundle.crt")
REL="overturemaps-us-west-2/release/2026-10-21.0/"
jobs={
 "building":("theme=buildings/type=building",["id","geometry","names","height","num_floors","min_height","class","subtype","has_parts","roof_shape","roof_height","facade_color","roof_color","facade_material"]),
 "building_part":("theme=buildings/type=building_part",["id","geometry","names","height","num_floors","min_height","building_id","roof_shape","roof_height","facade_color","roof_color","facade_material"]),
 "segment":("theme=transportation/type=segment",["id","geometry","names","subtype","class","subclass","road_flags","rail_flags","level_rules"]),
 "water":("theme=base/type=water",["id","geometry","names","subtype","class"]),
 "land_use":("theme=base/type=land_use",["id","geometry","names","subtype","class"]),
 "infrastructure":("theme=base/type=infrastructure",["id","geometry","names","subtype","class"]),
}
for name in sys.argv[1:]:
    path,cols=jobs[name]
    d=ds.dataset(REL+path, filesystem=s3, format="parquet")
    cols=[c for c in cols if c in d.schema.names]
    f=(pc.field("bbox","xmin")<E)&(pc.field("bbox","xmax")>W)&(pc.field("bbox","ymin")<N)&(pc.field("bbox","ymax")>S)
    t=d.to_table(columns=cols, filter=f)
    pq.write_table(t, f"../data/{name}.parquet")
    print(name, t.num_rows, flush=True)
