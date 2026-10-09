# ref18 PNC: per-shot camera truck (global x shift via phase correlation) + fit. Usage: python -I measure_ref18.py <video> <tools_dir>
import cv2, numpy as np, sys
sys.path.insert(0, sys.argv[2]); from fit_samples import fit, nearest_token
cap=cv2.VideoCapture(sys.argv[1]); fps=cap.get(cv2.CAP_PROP_FPS)
G=[]
while True:
    ok,f=cap.read()
    if not ok: break
    g=cv2.cvtColor(cv2.resize(f,(480,270)),cv2.COLOR_BGR2GRAY).astype(np.float32); G.append(g)
win=cv2.createHanningWindow((480,270),cv2.CV_32F)
dx=[0.0]; d=[0.0]
for i in range(1,len(G)):
    (sx,sy),r=cv2.phaseCorrelate(G[i-1],G[i],win); dx.append(sx); d.append(np.abs(G[i]-G[i-1]).mean())
dx=np.array(dx); d=np.array(d)
import json,os
E=json.load(open(os.path.join(os.path.dirname(os.path.abspath(__file__)),'energy.json')))['diff']
cuts=[i for i in range(1,len(E)) if E[i]>25]; print("cuts (f):",cuts, "s:",[round(c/fps,2) for c in cuts])
bounds=[0]+cuts+[len(G)]
for a,b in zip(bounds[:-1],bounds[1:]):
    seg=dx[a+1:b]; 
    if len(seg)<6: continue
    x=np.cumsum(seg); tot=x[-1]
    line=f"shot f{a}-f{b-1} ({(b-a)/fps:.2f}s): pan {tot*4:.0f}px@1920 ({tot/480*100/((b-a)/fps):.2f}% width/s) mean {np.mean(seg)*4:.2f}px/f sd {np.std(seg)*4:.2f}"
    if abs(tot)>5:
        p=x/tot; bz,r=fit(np.clip(p,-1,2)); line+=f" bez={bz} rmse={r:.3f} ~{nearest_token(bz)}"
    print(line)
