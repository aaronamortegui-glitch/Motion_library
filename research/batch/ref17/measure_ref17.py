# ref17 measurements: python -I measure_ref17.py <video> <tools_dir>
import cv2, numpy as np, sys
sys.path.insert(0, sys.argv[2]); from fit_samples import fit, nearest_token
cap=cv2.VideoCapture(sys.argv[1]); fps=cap.get(cv2.CAP_PROP_FPS)
def frames(f0,f1):
    cap.set(cv2.CAP_PROP_POS_FRAMES,f0)
    for i in range(f0,f1+1):
        ok,f=cap.read(); yield i,f,cv2.cvtColor(f,cv2.COLOR_BGR2HSV)
def largest(m):
    n,lab,st,cen=cv2.connectedComponentsWithStats(m.astype(np.uint8))
    if n<2: return None
    k=1+np.argmax(st[1:,4]); return st[k],cen[k]
def report(name,v,f0,a=None,b=None):
    v=np.array(v,float)
    if a is None:
        d=np.abs(np.diff(v)); thr=0.01*np.ptp(v); mv=np.where(d>thr)[0]; a,b=mv.min(),mv.max()+1
    s=v[a:b+1]; prog=(s-s[0])/(s[-1]-s[0]); n=b-a
    p,r=fit(np.clip(prog,-1,2.5)); over=max(prog.max()-1,0); und=max(-prog.min(),0)
    print(f"{name}: f{f0+a}-{f0+b} {n}f@{fps:.2f} = {n/fps*1000:.0f}ms {s[0]:.1f}->{s[-1]:.1f} bez={p} rmse={r:.3f} over={over:.3f} antic={und:.3f} ~{nearest_token(p)}")
    print("   prog:",np.round(prog,2).tolist())
mode=sys.argv[3]
if mode=="globe":
    v=[]
    for i,f,h in frames(0,275):
        m=(h[...,0]>15)&(h[...,0]<32)&(h[...,1]>120)&(h[...,2]>150)
        L=largest(m); v.append(np.sqrt(L[0][4]) if L else 0)
    print("brazil sqrt-area:",np.round(v,1).tolist())
    report("GLOBE push-in (Brazil scale)",v,0)
if mode=="lens":
    v=[]
    for i,f,h in frames(1855,1885):
        m=h[...,2]<45; v.append(np.sqrt(m.sum()))
    print("dark area:",np.round(v,1).tolist())
if mode=="bulb":
    v=[]
    for i,f,h in frames(2905,2960):
        m=(h[...,0]>15)&(h[...,0]<35)&(h[...,1]>120)&(h[...,2]>150)
        L=largest(m); v.append(L[0][3] if L else 0)
    print("bulb yellow h:",v)
if mode=="globe2":
    v=[]
    for i,f,h in frames(142,270):
        m=(h[...,0]>15)&(h[...,0]<32)&(h[...,1]>120)&(h[...,2]>150)
        L=largest(m); v.append(np.sqrt(L[0][4]) if L else 0)
    report("GLOBE push-in f142-270 (Brazil scale, rotation-confounded)",v,142,0,len(v)-1)
if mode=="letters":
    # "16 BILLION" build: count bright cream pixels (title letters) in center band
    v=[]
    for i,f,h in frames(960,1030):
        m=(h[...,1]<60)&(h[...,2]>200); m[:200]=0; m[520:]=0; v.append(int(m.sum()))
    print("cream px:",v)
