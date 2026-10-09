import cv2, numpy as np, sys
sys.path.insert(0, sys.argv[2]); from fit_samples import fit, nearest_token
cap=cv2.VideoCapture(sys.argv[1]); fps=cap.get(cv2.CAP_PROP_FPS)
def frames(f0,f1):
    cap.set(cv2.CAP_PROP_POS_FRAMES,f0)
    for i in range(f0,f1+1):
        ok,f=cap.read(); yield i,f,cv2.cvtColor(f,cv2.COLOR_BGR2HSV)
def report(name,v,f0):
    v=np.array(v,float); d=np.abs(np.diff(v)); thr=0.01*np.ptp(v)
    mv=np.where(d>thr)[0]
    if not len(mv): print(name,"no motion"); return
    a,b=mv.min(),mv.max()+1; s=v[a:b+1]; prog=(s-s[0])/(s[-1]-s[0]); n=b-a
    p,r=fit(np.clip(prog,-1,2.5)); over=max(prog.max()-1,0)
    print(f"{name}: f{f0+a}-{f0+b} {n}f@60 = {n/fps*1000:.0f}ms (= {n/2:.0f}f@30) {s[0]:.0f}->{s[-1]:.0f} bez={p} rmse={r:.3f} over={over:.3f} ~{nearest_token(p)}")
    print("   prog:",np.round(prog[::max(1,len(prog)//24)],2).tolist())
# 1 iris: cream area (low sat, high val) on coral bg
v=[];  
for i,f,h in frames(850,900): v.append(np.sqrt(((h[...,1]<50)&(h[...,2]>200)).sum()))
report("IRIS reveal (sqrt cream area)",v,850)
# 2 coral bar height in left column band
v=[]
for i,f,h in frames(2535,2600):
    m=((h[...,0]<15)|(h[...,0]>170))&(h[...,1]>90)&(h[...,2]>150); m=m[150:700,130:240]
    rows=np.where(m.sum(1)>20)[0]; v.append(550-rows.min() if len(rows) else 0)
report("BAR grow (height px)",v,2535)
# 3 terminal card: top edge of dark region in center band
v=[]
for i,f,h in frames(1750,1800):
    m=(h[...,2]<90)[:,700:1100]; rows=np.where(m.sum(1)>200)[0]; v.append(rows.min() if len(rows) else 720)
report("TERMINAL enter (top y)",v,1750)
# 4 node: blue node distance from center coral node
v=[]; c=None
for i,f,h in frames(2195,2250):
    co=((h[...,0]<15)|(h[...,0]>170))&(h[...,1]>90)&(h[...,2]>150); bl=(h[...,0]>95)&(h[...,0]<115)&(h[...,1]>80)&(h[...,2]>120)
    co[:, :640]=0; bl[:, :640]=0
    if co.sum()<50 or bl.sum()<20: v.append(np.nan); continue
    cy,cx=np.argwhere(co).mean(0); by,bx=np.argwhere(bl).mean(0); v.append(np.hypot(by-cy,bx-cx))
v=np.array(v); v[np.isnan(v)]=0; report("NODE fly-out (dist px)",v,2195)
# 5 pink wipe: magenta coverage fraction
v=[]
for i,f,h in frames(3000,3070):
    m=(h[...,0]>150)&(h[...,0]<172)&(h[...,1]>80)&(h[...,2]>100); v.append(m.mean()*100)
print("PINK coverage %:",np.round(v[::3],0).tolist())
# 6 kicker: 'Once upon a time,' text bbox height (dark ink) shrinking/moving
v=[];y=[]
for i,f,h in frames(286,312):
    m=(h[...,2]<120); ys,xs=np.nonzero(m[:,:]); 
    v.append(xs.max()-xs.min() if len(xs) else np.nan); y.append(ys.mean() if len(ys) else np.nan)
report("KICKER shrink (text width)",v,286); report("KICKER move (y)",y,286)
