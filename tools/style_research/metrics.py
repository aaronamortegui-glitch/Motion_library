"""Objective pace/energy/color metrics for a reference video.
Uso: python -I metrics.py <video> <energy.json from energy.py>  -> prints JSON
"""
import cv2, numpy as np, sys, json, math
vid, ej = sys.argv[1], sys.argv[2]
E = json.load(open(ej)); fps = E["fps"]
d = np.array(E["diff"]); h = np.array(E["hist"]); fl = np.array(E["flow"])[:, 0]
n = len(d); dur = n / fps
# cuts / hard changes: one-frame spikes in pixel diff or histogram
med = np.median(d) + 1e-6
cand = [i for i in range(1, n - 1) if (h[i] > 0.3) or (d[i] > max(20, 8 * med) and d[i] > 2 * max(d[i - 1], d[i + 1]))]
cuts = [c for k, c in enumerate(cand) if k == 0 or c - cand[k - 1] > 2]
moving = (fl > 0.2) | (d > 3)
still = ~moving
# hold lengths (s)
holds, run = [], 0
for s in still:
    if s: run += 1
    else:
        if run: holds.append(run / fps)
        run = 0
if run: holds.append(run / fps)
holds = [x for x in holds if x >= 0.5]
speed = fl[moving].mean() * fps / 480 * 100 if moving.any() else 0  # % of frame width per second while moving
# colorfulness (Hasler & Suesstrunk), 2 samples/s
cap = cv2.VideoCapture(vid); cols = []; step = max(1, int(fps / 2)); i = 0
while True:
    ok, f = cap.read()
    if not ok: break
    if i % step == 0:
        f = cv2.resize(f, (320, 180)).astype(np.float32); B, G, R = f[..., 0], f[..., 1], f[..., 2]
        rg = R - G; yb = 0.5 * (R + G) - B
        cols.append(math.sqrt(rg.std() ** 2 + yb.std() ** 2) + 0.3 * math.sqrt(rg.mean() ** 2 + yb.mean() ** 2))
    i += 1
cpm = len(cuts) / dur * 60
clamp = lambda v: max(0.0, min(10.0, v))
s_cuts = clamp(10 * math.log1p(cpm) / math.log1p(120))   # 120 cuts/min -> 10
s_motion = clamp(moving.mean() * 10)                      # 100% of time moving -> 10
s_speed = clamp(speed / 6)                                # 60% width/s -> 10
out = {
    "duration_s": round(dur, 1), "fps": round(fps, 2),
    "cuts": len(cuts), "cuts_per_min": round(cpm, 1),
    "avg_shot_s": round(dur / (len(cuts) + 1), 2),
    "motion_pct": round(moving.mean() * 100, 1),
    "speed_pct_width_per_s": round(float(speed), 1),
    "holds_count": len(holds), "hold_median_s": round(float(np.median(holds)), 2) if holds else 0,
    "hold_max_s": round(max(holds), 2) if holds else 0,
    "colorfulness": round(float(np.mean(cols)), 1),
    "energy_score": round((s_cuts + s_motion + s_speed) / 3, 1),
    "energy_parts": {"cuts": round(s_cuts, 1), "motion": round(s_motion, 1), "speed": round(s_speed, 1)},
}
print(json.dumps(out))
