# ref15 (Payy): lime app-icon square scale-down, icon slide-left, MENU pill, beat grid vs key events
import cv2, numpy as np, sys, librosa
sys.path.insert(0, sys.argv[2]); from fit_samples import fit, nearest_token
cap=cv2.VideoCapture(sys.argv[1]); fps=cap.get(cv2.CAP_PROP_FPS)
def lime_box(f0,f1,roi=None):
    cap.set(cv2.CAP_PROP_POS_FRAMES,f0); out=[]
    for i in range(f0,f1+1):
        ok,f=cap.read(); h=cv2.cvtColor(f,cv2.COLOR_BGR2HSV)
        m=(h[...,0]>25)&(h[...,0]<45)&(h[...,1]>120)&(h[...,2]>150)
        ys,xs=np.where(m); out.append((xs.min(),xs.max(),ys.min(),ys.max()) if len(xs)>200 else None)
    return out
def rep(name,v,f0):
    v=np.array(v,float); d=np.abs(np.diff(v)); mv=np.where(d>0.01*np.ptp(v))[0]; a,b=mv.min(),mv.max()+1
    s=v[a:b+1]; prog=(s-s[0])/(s[-1]-s[0]); n=b-a; p,r=fit(np.clip(prog,-1,2.5))
    print(f"{name}: f{f0+a}-{f0+b}@60 {n}f@60 = {n/fps*1000:.0f}ms (={n/2:.1f}f@30) {s[0]:.0f}->{s[-1]:.0f} bez={p} rmse={r:.3f} over={max(prog.max()-1,0):.3f} under={max(-prog.min(),0):.3f} ~{nearest_token(p)}")
    print("  prog",np.round(prog,2).tolist())
bx=lime_box(176,236)
w=[b[1]-b[0] if b else np.nan for b in bx]; cx=[(b[0]+b[1])/2 if b else np.nan for b in bx]
print("width",w); print("cx",np.round(cx).tolist())
w=np.array(w); i1=int(np.nanargmin(w[:45])) if True else 0
rep("ICON square scale-down (width)",w[:40],176)
rep("ICON slide-left (center x)",cx[30:],206)
y,sr=librosa.load(sys.argv[3],sr=22050); tempo,beats=librosa.beat.beat_track(y=y,sr=sr,units='time')
on=librosa.onset.onset_strength(y=y,sr=sr); tt=librosa.times_like(on,sr=sr)
print("tempo",tempo,"first beats",np.round(beats[:12],2).tolist())
rms=librosa.feature.rms(y=y)[0]; tr=librosa.times_like(rms,sr=sr)
for a in np.arange(0,38,1.0): print(f"rms {a:4.0f}s {rms[(tr>=a)&(tr<a+1)].mean():.3f}", end=" |")
print()
bp=np.median(np.diff(beats))
for name,x in [("logo smear->icon",2.47),("icon solid",2.93),("cut UI pills",4.9),("PRIVATE TRANSACTIONS",7.3),("phone",9.2),("pills->card",11.45),("cards",15.1),("token/avatar",16.87),("tweet",19.47),("brand cards",23.5),("card fly",24.37),("phone hand",26.47),("payy logo",27.7),("peel 1",29.85),("Private by default",32.15)]:
    k=np.argmin(np.abs(beats-x)); print(f"{name:22s} {x:6.2f} nearest beat {beats[k]:.2f} off {(x-beats[k])/bp:+.2f} beat")
# two-phase refit of the icon width (phase 1 hero shrink, phase 2 shrink+slide)
w=np.array([b[1]-b[0] for b in lime_box(176,236)],float)
for nm,a,b in [("ICON shrink phase 1",0,34),("ICON shrink phase 2 (with slide)",34,58)]:
    s=w[a:b+1]; prog=(s-s[0])/(s[-1]-s[0]); p,r=fit(prog)
    print(f"{nm}: f{176+a}-{176+b}@60 {b-a}f@60 = {(b-a)/fps*1000:.0f}ms {s[0]:.0f}->{s[-1]:.0f} bez={p} rmse={r:.3f} ~{nearest_token(p)}")
