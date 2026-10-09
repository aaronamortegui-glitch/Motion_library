# ref10: the 'Six ways to get from A to B' easing demo (6 dots, one per row) + ring/title measures
import cv2, numpy as np, sys
sys.path.insert(0, sys.argv[2]); from fit_samples import fit, nearest_token
cap=cv2.VideoCapture(sys.argv[1]); fps=cap.get(cv2.CAP_PROP_FPS)
ROWS={"linear":332,"ease-in-out":424,"expo-out":516,"back-out":608,"elastic":700,"bounce":792}
F0,F1=236,320
tr={k:[] for k in ROWS}
cap.set(cv2.CAP_PROP_POS_FRAMES,F0)
for i in range(F0,F1+1):
    ok,f=cap.read(); h=cv2.cvtColor(f,cv2.COLOR_BGR2HSV)
    m=(h[...,2]<90)|(h[...,1]>120)
    for k,y in ROWS.items():
        b=m[y-28:y+28,620:1880]; cols=b.sum(0); 
        tr[k].append(620+np.average(np.arange(b.shape[1]),weights=cols) if cols.sum()>150 else np.nan)
for k,v in tr.items():
    v=np.array(v); print(k, np.round(v,0).astype(int).tolist() if not np.isnan(v).any() else np.round(v,0).tolist())
    if np.isnan(v).any(): continue
    d=np.abs(np.diff(v)); mv=np.where(d>1.5)[0]
    if not len(mv): continue
    a,b=mv.min(),mv.max()+1; s=v[a:b+1]; end=np.median(v[-8:]); prog=(s-s[0])/(end-s[0])
    p,r=fit(np.clip(prog,-1,2.5)); n=b-a
    print(f"   {k}: f{F0+a}-f{F0+b} {n}f@{fps:.0f} = {n/fps*1000:.0f}ms  bez={np.round(p,3).tolist()} rmse={r:.3f} over={max(prog.max()-1,0):.3f} ~{nearest_token(p)}")
    print("   prog:",np.round(prog,2).tolist())
print("---- refits on the A-B window only (exit excluded)")
WIN={"linear":(252,310),"ease-in-out":(254,307),"expo-out":(252,307),"back-out":(252,309)}
for k,(a,b) in WIN.items():
    v=np.array(tr[k]); s=v[a-F0:b-F0+1]; prog=(s-s[0])/(s[-1]-s[0]); p,r=fit(np.clip(prog,-1,2.5)); n=b-a
    # duration to reach 99% (or final settle)
    print(f"   {k}: f{a}-f{b} {n}f@60 = {n/fps*1000:.0f}ms bez={np.round(p,3).tolist()} rmse={r:.3f} over={max(prog.max()-1,0):.3f} ~{nearest_token(p)}")
