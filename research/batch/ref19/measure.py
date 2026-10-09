# ref19 measurements: sun rise (orange disc centroid y), emblem slide-left at logo lockup (saturated ring centroid x)
# usage: python -I measure.py <video> <toolsdir>
import cv2, numpy as np, sys
sys.path.insert(0, sys.argv[2]); from fit_samples import fit, nearest_token
cap = cv2.VideoCapture(sys.argv[1]); fps = cap.get(cv2.CAP_PROP_FPS)

def track(f0, f1, maskfn):
    cap.set(cv2.CAP_PROP_POS_FRAMES, f0); cx, cy, area = [], [], []
    for i in range(f0, f1 + 1):
        ok, f = cap.read(); m = maskfn(f); ys, xs = np.nonzero(m)
        if len(xs) < 50: cx.append(np.nan); cy.append(np.nan); area.append(0); continue
        cx.append(xs.mean()); cy.append(ys.mean()); area.append(len(xs))
    return np.array(cx), np.array(cy), np.array(area)

def rep(name, v, f0):
    v = np.array(v, float); ok = ~np.isnan(v); idx = np.nonzero(ok)[0]; v = v[idx[0]:idx[-1] + 1]; f0 += idx[0]
    d = np.abs(np.diff(v)) > 0.01 * np.nanmax(np.abs(np.diff(v)) * 5)
    mv = np.nonzero(d)[0]; a, b = mv[0], mv[-1] + 1; v = v[a:b + 1]; f0 += a
    prog = (v - v[0]) / (v[-1] - v[0]); n = len(v) - 1
    p, r = fit(np.clip(prog, -1, 2.5))
    print(f"{name}: f{f0}-{f0+n} {n}f = {n/fps*1000:.0f}ms {v[0]:.0f}->{v[-1]:.0f}px bez={p} rmse={r:.3f} over={max(prog.max()-1,0):.3f} ~{nearest_token(p)}")
    print("  prog", np.round(prog, 2).tolist())

def orange(f):
    h = cv2.cvtColor(f, cv2.COLOR_BGR2HSV)
    return (h[..., 0] > 10) & (h[..., 0] < 28) & (h[..., 1] > 150) & (h[..., 2] > 180)

cx, cy, a = track(615, 670, orange)
print("sun cy", np.round(cy).tolist()); print("sun area", a.tolist())
rep("sun rise (cy)", cy, 615)

def sat(f):
    h = cv2.cvtColor(f, cv2.COLOR_BGR2HSV); m = (h[..., 1] > 110) & (h[..., 2] > 120)
    m[:, 1100:] = False  # emblem only (text on the right is unsaturated)
    return m

cx, cy, a = track(1985, 2030, sat)
print("emblem cx", np.round(cx).tolist())
rep("emblem slide-left (cx)", cx, 1985)
