# ref11: Helium asterisk spin-in (blue area on white, sqrt = linear scale) and zoom-through
import cv2, numpy as np, sys
sys.path.insert(0, sys.argv[2]); from fit_samples import fit, nearest_token
cap=cv2.VideoCapture(sys.argv[1]); fps=cap.get(cv2.CAP_PROP_FPS)
cap.set(cv2.CAP_PROP_POS_FRAMES,186); S=[]; W=[]
for i in range(186,256):
    ok,f=cap.read(); h=cv2.cvtColor(f,cv2.COLOR_BGR2HSV)
    blue=(h[...,0]>105)&(h[...,0]<135)&(h[...,1]>120); white=(h[...,1]<25)&(h[...,2]>230)
    S.append(np.sqrt(blue.sum())); W.append(white.mean())
print("sqrt blue area f186..:",np.round(S,0).astype(int).tolist())
print("white frac:",np.round(W,2).tolist())
def rep(name,a,b):
    s=np.array(S[a-186:b-186+1]); prog=(s-s[0])/(s[-1]-s[0]); p,r=fit(np.clip(prog,-1,2.5)); n=b-a
    print(f"{name}: f{a}-f{b} {n}f@{fps:.0f} = {n/fps*1000:.0f}ms bez={np.round(p,3).tolist()} rmse={r:.3f} over={max(prog.max()-1,0):.3f} under={max(-prog.min(),0):.3f} ~{nearest_token(p)}")
    print("   prog",np.round(prog,2).tolist())
if len(sys.argv)>3:
    for w in sys.argv[3:]:
        a,b=map(int,w.split('-')); rep("win",a,b)
