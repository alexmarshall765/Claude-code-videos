import math, subprocess, os
W,S,E,N = -86.085,39.98,-85.91,40.115
Z=13
def t(lon,lat):
    n=2**Z; x=(lon+180)/360*n
    y=(1-math.asinh(math.tan(math.radians(lat)))/math.pi)/2*n
    return int(x),int(y)
x0,y0=t(W,N); x1,y1=t(E,S)
print(x0,x1,y0,y1)
for x in range(x0,x1+1):
    for y in range(y0,y1+1):
        p=f'/tmp/nb/tiles/{Z}_{x}_{y}.png'
        if not os.path.exists(p):
            subprocess.run(['curl','-sS','-m','60','-o',p,f'https://s3.amazonaws.com/elevation-tiles-prod/terrarium/{Z}/{x}/{y}.png'],check=True)
