# ref16 measurements: diagonal color wipes (coverage of the incoming color) and truck approach (bbox width)
# usage: python -I measure.py <video> <toolsdir>
import cv2, numpy as np, sys
sys.path.insert(0, sys.argv[2]); from fit_samples import fit, nearest_token
cap = cv2.VideoCapture(sys.argv[1]); fps = cap.get(cv2.CAP_PROP_FPS)

def grab(f0, f1):
    cap.set(cv2.CAP_PROP_POS_FRAMES, f0); out = []
    for i in range(f0, f1 + 1):
        ok, f = cap.read(); out.append(cv2.resize(f, (320, 180), interpolation=cv2.INTER_AREA).astype(np.int16))
    return out

def rep(name, v, f0, trim=True):
    v = np.array(v, float)
    if trim:  # keep only the moving part
        d = np.abs(np.diff(v)) > 0.01 * np.ptp(v)
        idx = np.nonzero(d)[0]; a, b = idx[0], idx[-1] + 1; v = v[a:b + 1]; f0 = f0 + a
    prog = (v - v[0]) / (v[-1] - v[0]); n = len(v) - 1
    p, r = fit(np.clip(prog, -1, 2.5))
    print(f"{name}: f{f0}-{f0+n} {n}f = {n/fps*1000:.0f}ms bez={p} rmse={r:.3f} over={max(prog.max()-1,0):.3f} ~{nearest_token(p)}")
    print("  prog", np.round(prog, 2).tolist())

def wipe(name, f0, f1):
    fr = grab(f0, f1); tgt = np.median(fr[-1].reshape(-1, 3), 0)  # incoming color = dominant color of last frame
    cov = [float((np.abs(f - tgt).sum(2) < 40).mean()) for f in fr]
    print(f"{name} target BGR {tgt.tolist()} cov", np.round(cov, 2).tolist()); rep(name, cov, f0)

wipe("wipe white->green", 34, 50)
wipe("wipe green->yellow", 150, 164)
wipe("wipe yellow->blue", 314, 326)
wipe("wipe green->blue", 1232, 1246)
wipe("wipe yellow->blue end", 1340, 1352)

def truck(name, f0, f1, bgref):
    fr = grab(f0, f1); bg = np.median(fr[bgref].reshape(-1, 3), 0); ws = []
    for f in fr:
        m = (np.abs(f - bg).sum(2) > 90).astype(np.uint8)
        m[:20] = 0  # ignore top strip (text/clouds)
        n, lab, st, _ = cv2.connectedComponentsWithStats(m)
        if n < 2: ws.append(np.nan); continue
        k = 1 + np.argmax(st[1:, cv2.CC_STAT_AREA]); ws.append(st[k, cv2.CC_STAT_WIDTH])
    print(f"{name} width", ws); rep(name, ws, f0)

truck("truck approach (blue)", 1240, 1268, 0)
truck("truck drive-up (yellow)", 160, 190, 0)
