# ref20 measurements: python -I measure_ref20.py <video> <tools_dir> <mode>
import cv2, numpy as np, sys
sys.path.insert(0, sys.argv[2]); from fit_samples import fit, nearest_token
cap=cv2.VideoCapture(sys.argv[1]); fps=cap.get(cv2.CAP_PROP_FPS)
def frames(f0,f1):
    cap.set(cv2.CAP_PROP_POS_FRAMES,f0)
    for i in range(f0,f1+1):
        ok,f=cap.read(); yield i,f,cv2.cvtColor(f,cv2.COLOR_BGR2HSV)
def largest(m):
    n,lab,st,cen=cv2.connectedComponentsWithStats(m.astype(np.uint8))
    if n<2: return None,None
    k=1+np.argmax(st[1:,4]); return st[k],(lab==k)
def report(name,v,f0,a=None,b=None):
    v=np.array(v,float)
    if a is None:
        d=np.abs(np.diff(v)); thr=0.01*np.ptp(v); mv=np.where(d>thr)[0]; a,b=mv.min(),mv.max()+1
    s=v[a:b+1]; prog=(s-s[0])/(s[-1]-s[0]); n=b-a
    p,r=fit(np.clip(prog,-1,2.5)); over=max(prog.max()-1,0); und=max(-prog.min(),0)
    print(f"{name}: f{f0+a}-{f0+b} {n}f@{fps:.0f} = {n/fps*1000:.0f}ms {s[0]:.1f}->{s[-1]:.1f} bez={p} rmse={r:.3f} over={over:.3f} antic={und:.3f} ~{nearest_token(p)}")
    print("   prog:",np.round(prog,2).tolist())
mode=sys.argv[3]
if mode=="planet":
    v=[]
    for i,f,h in frames(0,90):
        g=cv2.GaussianBlur(h[...,2],(9,9),0); st,m=largest(g>110)
        x,y,w,hh,_=st; yb=y+hh-1; row=np.where(m[yb])[0]; c=(row.max()-row.min())/2; d=hh
        r=(d*d+c*c)/(2*d) if d<2*c else max(w,hh)/2   # radius from cropped chord
        v.append(r)
    print("planet r:",np.round(v,0).tolist())
    report("PLANET push-in (radius)",np.log(v),0)
if mode=="power":
    v=[]
    for i,f,h in frames(3405,3445):
        m=(h[...,1]<30)&(h[...,2]>235); m[:, :1000]=0; st,_=largest(m); v.append(np.sqrt(st[4]) if st is not None else 0)
    print("bubble sqrt-area:",np.round(v,1).tolist())
    report("POWER bubble pop",v,3405)
if mode=="planet2":
    v=[]; F=list(range(0,72))
    for i,f,h in frames(0,71):
        g=cv2.GaussianBlur(cv2.cvtColor(f,cv2.COLOR_BGR2GRAY),(9,9),0); H,W=g.shape
        col=g[30:,W//2]; top=30+np.argmax(col>75)
        row=g[700,30:W-30]>68; idx=np.where(row)[0]
        c=(idx.max()-idx.min())/2 if len(idx) else 0; d=700-top
        v.append((d*d+c*c)/(2*d))
    print("planet r(px):",np.round(v,0).tolist())
    report("PLANET push-in (radius f0-71)",v,0,0,len(v)-1)
if mode=="power2":
    v=[]
    for i,f,h in frames(3412,3440):
        m=(h[...,1]<40)&(h[...,2]>225); m[:, :1350]=0; m[:, 1800:]=0; m[:150]=0; m[600:]=0
        st,_=largest(m); v.append(np.sqrt(st[4]) if st is not None else 0)
    print("bubble sqrt-area:",np.round(v,1).tolist())
if mode=="powerfill":
    v=[]
    for i,f,h in frames(3414,3428):
        r=h[400:540,1200:1300]; v.append(float(255-r[...,1].mean()))   # whiteness of the bubble interior (left of the icon)
    print("whiteness:",np.round(v,1).tolist())
    report("POWER bubble fill",v,3414)
if mode=="planet3":
    from scipy.signal import medfilt
    v=[]
    for i,f,h in frames(0,71):
        g=cv2.GaussianBlur(cv2.cvtColor(f,cv2.COLOR_BGR2GRAY),(9,9),0); H,W=g.shape
        col=g[30:,W//2]; top=30+np.argmax(col>75)
        row=g[700,30:W-30]>68; idx=np.where(row)[0]
        c=(idx.max()-idx.min())/2 if len(idx) else 0; d=700-top
        v.append((d*d+c*c)/(2*d))
    v=medfilt(np.array(v),7); v[:3]=v[3]; v[-3:]=np.linspace(v[-4],1067,4)[1:]
    report("PLANET push-in (radius, median-7, f0-71)",v,0,0,len(v)-1)
    print("growth px/f first10, last10:",round((v[10]-v[0])/10,1),round((v[-1]-v[-11])/10,1))
