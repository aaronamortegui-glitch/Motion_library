# blob.py video toolsdir name:f0:f1 ...  -> per-frame bbox of non-white pixels, fitted phases
import cv2, numpy as np, sys
sys.path.insert(0, sys.argv[2]); from fit_samples import fit, nearest_token, phases
cap=cv2.VideoCapture(sys.argv[1]); fps=cap.get(cv2.CAP_PROP_FPS)
for spec in sys.argv[3:]:
    name,f0,f1=spec.split(":"); f0,f1=int(f0),int(f1)
    cap.set(cv2.CAP_PROP_POS_FRAMES,f0); rows=[]
    for i in range(f0,f1+1):
        ok,f=cap.read(); f=f[60:1020,60:1860].astype(np.int16)  # ignore corner UI marks
        m=(np.abs(f-255).sum(2)>90).astype(np.uint8)
        ys,xs=np.nonzero(m)
        if len(xs)<20: rows.append([np.nan]*4); continue
        rows.append([xs.mean()+60, (xs.max()-xs.min()), (ys.max()-ys.min()), m.sum()**0.5])
    R=np.array(rows); print(f"\n== {name} f{f0}-{f1}")
    print("  cx  :",np.round(R[:,0]).tolist()); print("  w   :",np.round(R[:,1]).tolist()); print("  sqrtA:",np.round(R[:,3]).tolist())
    for col,lab in ((0,"cx"),(1,"width"),(3,"sqrtArea")):
        v=R[:,col]; 
        if np.isnan(v).any(): v=np.where(np.isnan(v),np.nanmin(v) if lab!="cx" else np.nanmean(v),v)
        for ph in phases(v,thr=0.004):
            n=ph["end"]-ph["start"]
            if n<3 or abs(ph["to"]-ph["from"])<8: continue
            p,r=fit(np.clip(ph["prog"],-1,2.5)); over=max(ph["prog"].max()-1,0)
            print(f"  {lab:8s} f{f0+ph['start']}-{f0+ph['end']} {n}f {n/fps*1000:.0f}ms {ph['from']:.0f}->{ph['to']:.0f} bez={p} rmse={r:.3f} over={over:.3f} ~{nearest_token(p)}")
