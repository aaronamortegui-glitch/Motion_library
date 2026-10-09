# ref09: mandala ring growth (red ring bbox height) + beat/onset timing of montage cuts
import cv2, numpy as np, sys, json
sys.path.insert(0, sys.argv[2]); from fit_samples import fit, nearest_token
cap=cv2.VideoCapture(sys.argv[1]); fps=cap.get(cv2.CAP_PROP_FPS)
cap.set(cv2.CAP_PROP_POS_FRAMES,50); v=[]
for i in range(50,160):
    ok,f=cap.read(); h=cv2.cvtColor(f,cv2.COLOR_BGR2HSV)
    m=((h[...,0]<12)|(h[...,0]>170))&(h[...,1]>150)&(h[...,2]>150); m[:250]=0; m[1650:]=0
    rows=np.where(m.sum(1)>4)[0]; v.append(int(rows.max()-rows.min()) if len(rows) else 0)
print("ring height px f50..:",v)
def rep(name,s,f0):
    s=np.array(s,float); prog=(s-s[0])/(s[-1]-s[0]); p,r=fit(prog)
    print(f"{name}: f{f0}-{f0+len(s)-1} {len(s)-1}f = {(len(s)-1)/fps*1000:.0f}ms bez={np.round(p,3).tolist()} rmse={r:.3f} over={max(prog.max()-1,0):.3f} ~{nearest_token(p)}")
v=np.array(v); 
import itertools
a=int(sys.argv[3]) if len(sys.argv)>3 else None
if a is not None:
    b=int(sys.argv[4]); rep("RING grow",v[a-50:b-50+1],a)
