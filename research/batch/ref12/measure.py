# ref12 measurements: song-list scroll (phase correlation), on-twos check, ring growth
import cv2, numpy as np, sys
sys.path.insert(0, sys.argv[2]); from fit_samples import fit, nearest_token
cap=cv2.VideoCapture(sys.argv[1]); fps=cap.get(cv2.CAP_PROP_FPS)
def grab(f0,f1):
    cap.set(cv2.CAP_PROP_POS_FRAMES,f0); out=[]
    for i in range(f0,f1+1):
        ok,f=cap.read(); out.append(cv2.cvtColor(f,cv2.COLOR_BGR2GRAY).astype(np.float32))
    return out
def rep(name,v,f0):
    v=np.array(v,float); prog=(v-v[0])/(v[-1]-v[0]); n=len(v)-1
    p,r=fit(np.clip(prog,-1,2.5))
    print(f"{name}: f{f0}-{f0+n} {n}f = {n/fps*1000:.0f}ms bez={p} rmse={r:.3f} over={max(prog.max()-1,0):.3f} ~{nearest_token(p)}")
    print("  prog",np.round(prog,2).tolist())
# 1 song list scroll f244-262 cumulative dy
fr=grab(244,262); y=[0.0]
for a,b in zip(fr,fr[1:]):
    (dx,dy),_=cv2.phaseCorrelate(cv2.GaussianBlur(a,(5,5),0),cv2.GaussianBlur(b,(5,5),0)); y.append(y[-1]+dy)
print("scroll cum dy:",np.round(y,1).tolist()); rep("SONG scroll",y,244)
# 2 frame-to-frame diff (twos?) f262-300
fr=grab(262,300); print("diff 262-300:",[round(float(np.abs(a-b).mean()),1) for a,b in zip(fr,fr[1:])])
fr=grab(100,140); print("diff 100-140:",[round(float(np.abs(a-b).mean()),1) for a,b in zip(fr,fr[1:])])
# 3 bright ring radius f151-168: extent of bright pixels
cap.set(cv2.CAP_PROP_POS_FRAMES,149); r=[]
for i in range(149,168):
    ok,f=cap.read(); g=cv2.cvtColor(f,cv2.COLOR_BGR2GRAY); h,w=g.shape
    ys,xs=np.where(g>200); 
    r.append(float(np.percentile(np.hypot(xs-w/2,ys-h/2),95)) if len(xs)>50 else 0)
print("ring r95:",np.round(r,0).tolist())
