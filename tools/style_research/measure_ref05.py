import cv2, numpy as np, sys
sys.path.insert(0, sys.argv[2]); from fit_samples import fit, nearest_token
cap=cv2.VideoCapture(sys.argv[1]); fps=cap.get(cv2.CAP_PROP_FPS)
def frames(f0,f1):
    cap.set(cv2.CAP_PROP_POS_FRAMES,f0)
    for i in range(f0,f1+1):
        ok,f=cap.read(); yield i,f,cv2.cvtColor(f,cv2.COLOR_BGR2HSV)
def report(name,v,f0,trim=True):
    v=np.array(v,float)
    if trim:
        d=np.abs(np.diff(v)); thr=0.01*np.ptp(v); mv=np.where(d>thr)[0]
        if not len(mv): print(name,"no motion"); return
        a,b=mv.min(),mv.max()+1
    else: a,b=0,len(v)-1
    s=v[a:b+1]; prog=(s-s[0])/(s[-1]-s[0]); n=b-a
    p,r=fit(np.clip(prog,-1,2.5)); over=max(prog.max()-1,0); und=max(-prog.min(),0)
    print(f"{name}: f{f0+a}-{f0+b} {n}f@24 = {n/fps*1000:.0f}ms (={n*30/24:.0f}f@30) {s[0]:.0f}->{s[-1]:.0f} bez={p} rmse={r:.3f} over={over:.3f} antic={und:.3f} ~{nearest_token(p)}")
    print("   prog:",np.round(prog,2).tolist())
# 1 opening iris from black: non-black area
v=[np.sqrt((h[...,2]>40).sum()) for i,f,h in frames(6,24)]; report("IRIS open (from black)",v,6)
# 2 closing iris: white area
v=[np.sqrt(((h[...,1]<25)&(h[...,2]>235)).sum()) for i,f,h in frames(2458,2482)]; report("IRIS close (white)",v,2458)
# 3 wordmark: rightmost red pixel
v=[]
for i,f,h in frames(2470,2495):
    m=((h[...,0]<10)|(h[...,0]>170))&(h[...,1]>120)&(h[...,2]>120); m[:,:900]=0; cols=np.where(m.sum(0)>2)[0]; v.append(cols.max() if len(cols) else 900)
report("WORDMARK reveal (right edge)",v,2470)
# 4 phone enter: top of white phone body in right half
v=[]
for i,f,h in frames(1476,1500):
    m=(h[...,1]<40)&(h[...,2]>200); m[:, :1000]=0; rows=np.where(m.sum(1)>40)[0]; v.append(rows.min() if len(rows) else 1080)
report("PHONE enter (top y)",v,1476)
# 5 rocket launch: top of rocket (white) in center column
v=[]
for i,f,h in frames(2290,2330):
    m=(h[...,1]<40)&(h[...,2]>210); m=m[:,880:1080]; rows=np.where(m.sum(1)>8)[0]; v.append(rows.min() if len(rows) else 0)
print("rocket top y:",v)
# 6 first end icon: size of leftmost colored blob in icon row
v=[]
for i,f,h in frames(2484,2512):
    m=((h[...,1]>80)&(h[...,2]>80)).astype(np.uint8); m[:560]=0; m[760:]=0
    n,lab,st,cen=cv2.connectedComponentsWithStats(m)
    comps=[s for s in st[1:] if s[4]>200]
    if comps: c=min(comps,key=lambda s:s[0]); v.append(c[3])
    else: v.append(0)
print("icon1 height:",v); 
