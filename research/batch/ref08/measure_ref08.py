# ref08 measurements: text slide-ins (left edge / centroid of bright text pixels)
import cv2, numpy as np, sys
sys.path.insert(0, sys.argv[2]); from fit_samples import fit, nearest_token
cap=cv2.VideoCapture(sys.argv[1]); fps=cap.get(cv2.CAP_PROP_FPS)
def frames(f0,f1):
    cap.set(cv2.CAP_PROP_POS_FRAMES,f0)
    for i in range(f0,f1+1):
        ok,f=cap.read(); yield i,f,cv2.cvtColor(f,cv2.COLOR_BGR2HSV)
def report(name,v,f0,a=None,b=None):
    v=np.array(v,float)
    if a is None:
        d=np.abs(np.diff(v)); thr=0.01*np.ptp(v); mv=np.where(d>thr)[0]; a,b=mv.min(),mv.max()+1
    s=v[a:b+1]; prog=(s-s[0])/(s[-1]-s[0]); n=b-a
    p,r=fit(np.clip(prog,-1,2.5)); over=max(prog.max()-1,0)
    print(f"{name}: f{f0+a}-{f0+b} {n}f@{fps:.0f} = {n/fps*1000:.0f}ms {s[0]:.0f}->{s[-1]:.0f} bez={np.round(p,3).tolist()} rmse={r:.3f} over={over:.3f} ~{nearest_token(p)}")
    print("   raw:",np.round(v,0).astype(int).tolist())
def band(h,y0,y1,vmin=150):
    m=(h[...,2]>vmin); m[:y0]=0; m[y1:]=0; return m
# 1 "a skill for your agent." slide in from right: left edge
v=[]
for i,f,h in frames(270,300):
    cols=np.where(band(h,400,620).sum(0)>3)[0]; v.append(cols.min() if len(cols) else 1920)
report("SKILL slide-in (left edge x)",v,270)
# 2 "looksmaxxing" rise from bottom: vertical centroid of red pixels
v=[]
for i,f,h in frames(160,192):
    m=((h[...,0]<12)|(h[...,0]>170))&(h[...,1]>100)&(h[...,2]>140); ys=np.where(m.sum(1)>3)[0]
    v.append(np.average(np.arange(1080),weights=m.sum(1)) if m.sum()>200 else np.nan)
print("looks red centroid y:",np.round(v,0).tolist())
# 3 "for motion graphics." white subline rise
v=[]
for i,f,h in frames(170,195):
    m=(h[...,1]<60)&(h[...,2]>150); m[:500]=0
    v.append(np.average(np.arange(1080),weights=m.sum(1)) if m.sum()>200 else np.nan)
print("subline white centroid y:",np.round(v,0).tolist())
# 4 'motion.' red big word rise at 13.5s
v=[]
for i,f,h in frames(404,430):
    m=((h[...,0]<12)|(h[...,0]>170))&(h[...,1]>100)&(h[...,2]>140); m[:450]=0
    v.append(np.average(np.arange(1080),weights=m.sum(1)) if m.sum()>200 else np.nan)
print("motion. red centroid y:",np.round(v,0).tolist())
print("---- fits")
looks=[985,871,708,653,644,597,560,530,507,488,473,461,451,444,438,433,433]   # f166-f182 (from #2)
report("LOOKSMAXXING rise (red centroid y)",looks,166,0,15)
sub=[896,844,800,765,738,716,699,686,676,667,661,656,652,649,649]              # f175-f189
report("SUBLINE rise (white centroid y)",sub,175,0,13)
# skill slide, ignoring the left guide bracket
v=[]
for i,f,h in frames(270,300):
    m=band(h,400,620); m[:,:400]=0; cols=np.where(m.sum(0)>3)[0]; v.append(cols.min() if len(cols) else 1920)
report("SKILL slide-in (left edge x, x>400)",v,270)
# skill exit to the left at ~11.0s: right edge
v=[]
for i,f,h in frames(325,342):
    m=band(h,400,620); cols=np.where(m.sum(0)>3)[0]; v.append(cols.max() if len(cols) else 0)
print("skill exit right edge:",v)
ex=[1469,1466,1453,1423,1371,1295,1189,1051,878,666,413,277]  # f326-f337
report("SKILL exit left (right edge x)",ex,326,0,11)
sk=[1920,1306,1118,970,853,760,686,627,581,544,514,490,472,457,446,446]  # f273(=1920 virtual)..f288
report("SKILL slide-in full (to rest)",sk,273,0,14)
