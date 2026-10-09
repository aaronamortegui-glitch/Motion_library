# Measures clean single-element moves in ref06 (AchX). Usage: python -I measure_ref06.py <video> <tools_dir>
import cv2, numpy as np, sys
sys.path.insert(0, sys.argv[2]); from fit_samples import fit, nearest_token
cap=cv2.VideoCapture(sys.argv[1]); fps=cap.get(cv2.CAP_PROP_FPS)
W=int(cap.get(3)); H=int(cap.get(4)); print("size",W,H,"fps",fps)
def frames(f0,f1):
    cap.set(cv2.CAP_PROP_POS_FRAMES,f0)
    for i in range(f0,f1+1):
        ok,f=cap.read(); yield i,cv2.cvtColor(f,cv2.COLOR_BGR2GRAY)
def report(name,v,f0):
    v=np.array(v,float); print(name,"raw:",np.round(v).astype(int).tolist())
    d=np.abs(np.diff(v)); thr=0.01*np.ptp(v); mv=np.where(d>thr)[0]
    if not len(mv): print(name,"no motion"); return
    a,b=mv.min(),mv.max()+1; s=v[a:b+1]; prog=(s-s[0])/(s[-1]-s[0]); n=b-a
    p,r=fit(np.clip(prog,-1,2.5)); over=max(prog.max()-1,0)
    print(f"{name}: f{f0+a}-f{f0+b} {n}f = {n/fps*1000:.0f}ms bez={p} rmse={r:.3f} over={over:.3f} ~{nearest_token(p)}")
    print("   prog:",np.round(prog,2).tolist())
# 1 first chat bubble grows to the right (dark pixels on white), top half
v=[]
for i,g in frames(522,560):
    m=g[:H//2]<90; cols=np.where(m.sum(0)>3)[0]; v.append(cols.max() if len(cols) else 0)
report("BUBBLE1 right edge",v,522)
# 2 'Got it' bubble from right: leftmost dark col in lower-right quadrant
v=[]
for i,g in frames(620,660):
    m=g[H//2:,W//2:]<90; cols=np.where(m.sum(0)>3)[0]; v.append(cols.min() if len(cols) else W//2)
report("GOT-IT bubble left edge",v,620)
# 3 logo transition: white arch rising (top of white in center column)
v=[]
for i,g in frames(1440,1475):
    c=g[:,W//2-40:W//2+40]>200; rows=np.where(c.mean(1)>0.9)[0]; v.append(rows.min() if len(rows) else H)
report("WHITE ARCH top y",v,1440)
# 4 bubble 1: area of solid dark pixels (blur resolves into the pill)
v=[np.sqrt((g[:H//2]<40).sum()) for i,g in frames(522,560)]; report("BUBBLE1 solid area",v,522)
# 5 white arch rise, second phase only
v=[]
for i,g in frames(1447,1460):
    c=g[:,W//2-40:W//2+40]>200; rows=np.where(c.mean(1)>0.9)[0]; v.append(rows.min() if len(rows) else H)
report("WHITE ARCH rise",v,1447)
# 6 pill stack: topmost bright row (pill outline/text) over center column
v=[]
for i,g in frames(1360,1420):
    c=g[:,W//2-300:W//2+300]>110; rows=np.where(c.sum(1)>4)[0]; v.append(rows.min() if len(rows) else H)
report("PILL stack top y",v,1360)
