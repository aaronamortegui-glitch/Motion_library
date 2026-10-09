# Measures the Vercel end logo in ref07. Usage: python -I measure_ref07.py <video> <tools_dir>
import cv2, numpy as np, sys
sys.path.insert(0, sys.argv[2]); from fit_samples import fit, nearest_token
cap=cv2.VideoCapture(sys.argv[1]); fps=cap.get(cv2.CAP_PROP_FPS); W=int(cap.get(3)); H=int(cap.get(4))
def frames(f0,f1):
    cap.set(cv2.CAP_PROP_POS_FRAMES,f0)
    for i in range(f0,f1+1):
        ok,f=cap.read(); yield i,cv2.cvtColor(f,cv2.COLOR_BGR2GRAY)
def report(name,v,f0,lo=None,hi=None):
    v=np.array(v,float); print(name,"raw:",np.round(v).astype(int).tolist())
    if lo is None:
        d=np.abs(np.diff(v)); mv=np.where(d>0.01*np.ptp(v))[0]; lo,hi=mv.min(),mv.max()+1
    s=v[lo:hi+1]; prog=(s-s[0])/(s[-1]-s[0]); n=hi-lo
    p,r=fit(np.clip(prog,-1,2.5)); over=max(prog.max()-1,0)
    print(f"{name}: f{f0+lo}-f{f0+hi} {n}f = {n/fps*1000:.0f}ms bez={p} rmse={r:.3f} over={over:.3f} ~{nearest_token(p)}")
    print("   prog:",np.round(prog,2).tolist())
# triangle: sqrt of white area while it is alone (before the wordmark appears)
tri=[];left=[];right=[]
for i,g in frames(1704,1760):
    m=g>200; tri.append(np.sqrt(m.sum()))
    cols=np.where(m.sum(0)>0)[0]; left.append(cols.min() if len(cols) else W/2); right.append(cols.max() if len(cols) else W/2)
report("TRIANGLE size (sqrt area)",tri,1704)
report("LOGO left edge (triangle shifts left)",left,1704)
report("LOGO right edge (wordmark build)",right,1704)
