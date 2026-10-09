import cv2, numpy as np, sys, json
sys.path.insert(0, sys.argv[2]); from fit_samples import fit, nearest_token
cap=cv2.VideoCapture(sys.argv[1]); frames=[]
while True:
    ok,f=cap.read()
    if not ok: break
    frames.append(cv2.cvtColor(f,cv2.COLOR_BGR2GRAY))
def series(f0,f1,mode,y0,y1,thr):
    xs=[];sh=[];rx=[]
    for i in range(f0,f1+1):
        g=frames[i][y0:y1,:].astype(np.float32)
        m=(g>thr) if mode=="light" else (g<thr)
        cols=np.where(m.sum(0)>3)[0]
        xs.append(float(cols.min()) if len(cols) else np.nan); rx.append(float(cols.max()) if len(cols) else np.nan)
        sh.append(float(cv2.Laplacian(frames[i][y0:y1,600:1320],cv2.CV_64F).var()))
    return np.array(xs),np.array(rx),np.array(sh)
def report(name,s,f0,fps=24):
    s=np.array(s); ok=~np.isnan(s); s=s[ok]; v0,v1=s[0],s[-1]; prog=(s-v0)/(v1-v0)
    p,r=fit(np.clip(prog,-1,2.5)); tok=nearest_token(p); over=max(prog.max()-1,0)
    print(f"{name}: f{f0} {len(s)}f ({len(s)/fps*1000:.0f}ms) {v0:.0f}->{v1:.0f}px bez={p} rmse={r:.3f} overshoot={over:.3f} nearest={tok}")
    print("  prog:",np.round(prog,2).tolist())
# intro: logo mark slides left (light on dark), measure left edge, mark appears ~f44
L,R,Sh=series(44,80,"light",420,660,170)
print("intro left edge:",np.round(L).tolist())
# find motion span
d=np.abs(np.diff(L)); mv=np.where(d>0.5)[0]; a,b=mv.min(),mv.max()+1
report("INTRO logo mark slide (left edge)",L[a:b+1],44+a)
# intro text reveal: rightmost bright px f2-24
L2,R2,_=series(2,26,"light",500,580,120)
print("intro text right edge:",np.round(R2).tolist())
report("INTRO 'Introducing' reveal (right edge)",R2,2)
# outro: dark on light
L3,R3,Sh3=series(560,600,"dark",440,640,110)
print("outro left edge:",np.round(L3).tolist()); print("outro sharpness:",np.round(Sh3,1).tolist())
d=np.abs(np.diff(L3)); mv=np.where(d>0.5)[0]; a,b=mv.min(),mv.max()+1
report("OUTRO logo mark slide (left edge)",L3[a:b+1],560+a)
sh=Sh3; 
i1=int(np.argmax(sh>0.95*sh.max())); report("OUTRO focus (sharpness)",sh[:i1+1],560)
