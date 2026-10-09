# ref13: zoom-through scale (ORB affine, cumulative) and red-square wipe (area)
import cv2, numpy as np, sys
sys.path.insert(0, sys.argv[2]); from fit_samples import fit, nearest_token
cap=cv2.VideoCapture(sys.argv[1]); fps=cap.get(cv2.CAP_PROP_FPS)
def grab(f0,f1):
    cap.set(cv2.CAP_PROP_POS_FRAMES,f0); return [cap.read()[1] for _ in range(f0,f1+1)]
def rep(name,v,f0,trim=True):
    v=np.array(v,float)
    if trim:
        d=np.abs(np.diff(v)); mv=np.where(d>0.01*np.ptp(v))[0]; a,b=mv.min(),mv.max()+1
    else: a,b=0,len(v)-1
    s=v[a:b+1]; prog=(s-s[0])/(s[-1]-s[0]); n=b-a
    p,r=fit(np.clip(prog,-1,2.5))
    print(f"{name}: f{f0+a}-{f0+b} {n}f@24 = {n/fps*1000:.0f}ms {s[0]:.2f}->{s[-1]:.2f} bez={p} rmse={r:.3f} over={max(prog.max()-1,0):.3f} ~{nearest_token(p)}")
    print("  prog",np.round(prog,2).tolist())
orb=cv2.ORB_create(3000); bf=cv2.BFMatcher(cv2.NORM_HAMMING,crossCheck=True)
def zoom(f0,f1):
    fr=[cv2.cvtColor(f,cv2.COLOR_BGR2GRAY) for f in grab(f0,f1)]; s=[1.0]
    for a,b in zip(fr,fr[1:]):
        ka,da=orb.detectAndCompute(a,None); kb,db=orb.detectAndCompute(b,None)
        try:
            m=bf.match(da,db); pa=np.float32([ka[x.queryIdx].pt for x in m]); pb=np.float32([kb[x.trainIdx].pt for x in m])
            M,_=cv2.estimateAffinePartial2D(pa,pb,method=cv2.RANSAC); sc=float(np.hypot(M[0,0],M[1,0]))
        except Exception: sc=np.nan
        s.append(s[-1]*sc if np.isfinite(sc) else np.nan)
    return s
for name,(a,b) in {"1984 zoom-through":(18,34),"rewriten zoom-through":(64,84),"watched zoom-through":(116,132)}.items():
    s=zoom(a,b); print(name,"cum scale:",np.round(s,2).tolist())
    s=np.array(s); good=np.isfinite(s)
    if good.all(): rep(name+" (log scale)",np.log(s),a)
# red square wipe: area of saturated red
v=[]
for i,f in enumerate(grab(168,182)):
    h=cv2.cvtColor(f,cv2.COLOR_BGR2HSV); m=((h[...,0]<8)|(h[...,0]>172))&(h[...,1]>150)&(h[...,2]>60)
    ys,xs=np.where(m); v.append((xs.max()-xs.min()) if len(xs)>100 else 0)
print("red width px:",v)
