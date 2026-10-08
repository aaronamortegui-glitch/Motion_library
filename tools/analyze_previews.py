"""Analyzes Animation Composer .webm previews and reconstructs the motion curves.

Per frame it measures the element (black background): visibility (opacity/area), X/Y centroid,
scale (sqrt of the bbox area) and rotation (moments). Then it detects the animated phases,
normalizes the progress of the dominant channel and compares it with the Superside curves.

Usage: python -I analyze_previews.py <webm|folder> [--limit N] [--out file.json] [--plot folder]
"""
import argparse
import json
import math
import sys
from pathlib import Path

import cv2
import numpy as np

TOKENS = json.loads((Path(__file__).resolve().parent.parent / "tokens" / "superside_motion_tokens.json").read_text(encoding="utf-8"))
# Generic families to describe the reference curve, independent of our tokens
FAMILIES = {
    "linear": (0, 0, 1, 1),
    "ease-in": (0.5, 0, 1, 1),
    "ease-out": (0, 0, 0.3, 1),
    "ease-in-out": (0.6, 0, 0.3, 1),
    "expo-out": (0.05, 0.9, 0.2, 1),
    "expo-in": (0.7, 0, 0.95, 0.2),
}
# Our tokens (without Pop: overshoot is detected separately)
CURVES = {e["name"]: tuple(e["bezier"]) for e in TOKENS["easings"] if e["name"] != "Pop"}
DURATIONS = [(d["name"], d["frames"]) for d in TOKENS["durations"]]


def bezier_curve(p, n=200):
    x1, y1, x2, y2 = p
    t = np.linspace(0, 1, 2000)
    bx = 3 * (1 - t) ** 2 * t * x1 + 3 * (1 - t) * t ** 2 * x2 + t ** 3
    by = 3 * (1 - t) ** 2 * t * y1 + 3 * (1 - t) * t ** 2 * y2 + t ** 3
    xs = np.linspace(0, 1, n)
    return np.interp(xs, bx, by)


CURVE_SAMPLES = {k: bezier_curve(v) for k, v in CURVES.items()}
FAMILY_SAMPLES = {k: bezier_curve(v) for k, v in FAMILIES.items()}


def read_frames(path):
    cap = cv2.VideoCapture(str(path))
    fps = cap.get(cv2.CAP_PROP_FPS) or 29.97
    frames = []
    while True:
        ok, f = cap.read()
        if not ok:
            break
        frames.append(cv2.cvtColor(f, cv2.COLOR_BGR2GRAY).astype(np.float32) / 255.0)
    cap.release()
    return frames, fps


def measure(frame, thr=0.08):
    mask = frame > thr
    vis = float((frame * mask).sum())
    if mask.sum() < 4:
        return dict(vis=vis, x=np.nan, y=np.nan, scale=np.nan, rot=np.nan, sharp=np.nan, aspect=np.nan)
    lap = cv2.Laplacian(frame, cv2.CV_32F)
    sharp = float(np.abs(lap[mask]).mean() / (frame[mask].mean() or 1))  # sharpness independent of opacity
    ys, xs = np.nonzero(mask)
    w = xs.max() - xs.min() + 1
    h = ys.max() - ys.min() + 1
    m = cv2.moments(mask.astype(np.uint8))
    rot = 0.5 * math.degrees(math.atan2(2 * m["mu11"], (m["mu20"] - m["mu02"]) or 1e-9))
    return dict(vis=vis, x=float(xs.mean()), y=float(ys.mean()), scale=float(math.sqrt(w * h)), rot=rot,
                sharp=sharp, aspect=float(w / h))


_ORB = cv2.ORB_create(nfeatures=800, fastThreshold=5)


def register(frames, vis):
    """Affine of each frame relative to the most visible frame (settled state): tx, ty, scale, rotation, aspect."""
    ref_i = int(np.argmax(vis))
    up = lambda f: cv2.resize((f * 255).astype(np.uint8), None, fx=2, fy=2, interpolation=cv2.INTER_CUBIC)
    kr, dr = _ORB.detectAndCompute(up(frames[ref_i]), None)
    out = np.full((len(frames), 5), np.nan)
    if dr is None or len(kr) < 8:
        return out
    bf = cv2.BFMatcher(cv2.NORM_HAMMING, crossCheck=True)
    for i, f in enumerate(frames):
        k, d = _ORB.detectAndCompute(up(f), None)
        if d is None or len(k) < 8:
            continue
        m = bf.match(d, dr)
        if len(m) < 8:
            continue
        src = np.float32([k[x.queryIdx].pt for x in m])
        dst = np.float32([kr[x.trainIdx].pt for x in m])
        A, inl = cv2.estimateAffine2D(src, dst, ransacReprojThreshold=3)
        if A is None or inl.sum() < 6:
            continue
        a, b, c, dd = A[0, 0], A[0, 1], A[1, 0], A[1, 1]
        sx, sy = math.hypot(a, c), math.hypot(b, dd)
        # frame→ref; invert signs to get ref→frame in frame units
        out[i] = [-A[0, 2] / 2, -A[1, 2] / 2, 1 / max((sx + sy) / 2, 1e-6), -math.degrees(math.atan2(c, a)), sx / max(sy, 1e-6)]
    return out


def segments(active, min_len=2):
    segs, start = [], None
    for i, a in enumerate(active):
        if a and start is None:
            start = i
        elif not a and start is not None:
            if i - start >= min_len:
                segs.append((start, i))
            start = None
    if start is not None and len(active) - start >= min_len:
        segs.append((start, len(active)))
    return segs


def fit_curve(prog, samples=None):
    """Compares a 0→1 progress with a set of curves; returns the closest one and the overshoot."""
    samples = samples or CURVE_SAMPLES
    xs = np.linspace(0, 1, len(prog))
    resampled = np.interp(np.linspace(0, 1, 200), xs, prog)
    scores = {k: float(np.sqrt(np.mean((resampled - v) ** 2))) for k, v in samples.items()}
    best = min(scores, key=scores.get)
    overshoot = float(max(resampled.max() - 1, -resampled.min(), 0))
    return best, scores, overshoot


# Minimum total change in a phase to consider the channel animated
CHANNEL_MIN = {"opacity": 0.3, "position": 0.03, "scale": 0.08, "rotation": 0.1, "blur": 0.3, "warp": 0.12}


def nearest_duration(frames):
    return min(DURATIONS, key=lambda d: abs(d[1] - frames))[0]


def analyze(path):
    frames, fps = read_frames(path)
    if len(frames) < 3:
        return {"file": path.name, "error": "too few frames"}
    ms = [measure(f) for f in frames]
    ch = {k: np.array([m[k] for m in ms], dtype=float) for k in ("vis", "x", "y", "scale", "rot", "sharp", "aspect")}
    for k in ch:  # fill NaN (invisible element) with neighbors
        a = ch[k]
        if np.isnan(a).all():
            a[:] = 0
        else:
            idx = np.arange(len(a))
            good = ~np.isnan(a)
            a[~good] = np.interp(idx[~good], idx[good], a[good])
    reg = register(frames, ch["vis"])
    ok = ~np.isnan(reg[:, 0])
    if ok.sum() >= 3:  # affine registration wins; moments remain as fallback
        idx = np.arange(len(frames))
        # position = centroid (invariant to centered scale); the affine provides scale/rotation/aspect
        for j, k in ((2, "scale"), (3, "rot"), (4, "aspect")):
            v = np.interp(idx, idx[ok], reg[ok, j])
            ch[k] = v * ch["scale"].max() if k == "scale" else v
    else:
        rot = np.degrees(np.unwrap(np.radians(ch["rot"]) * 2) / 2)
        drot = np.diff(rot)
        drot[np.abs(drot) > 40] = 0
        ch["rot"] = np.concatenate([[rot[0]], rot[0] + np.cumsum(drot)])
    h, w = frames[0].shape
    norm = {  # per-frame changes normalized to frame size
        "opacity": np.abs(np.diff(ch["vis"])) / (ch["vis"].max() or 1),
        "position": np.hypot(np.diff(ch["x"]), np.diff(ch["y"])) / w,
        "scale": np.abs(np.diff(ch["scale"])) / (ch["scale"].max() or 1),
        "rotation": np.abs(np.diff(ch["rot"])) / 90.0,
        "blur": np.abs(np.diff(ch["sharp"])) / (ch["sharp"].max() or 1),
        "warp": np.abs(np.diff(np.log(np.clip(ch["aspect"], 1e-3, None)))),
    }
    # warp only counts if the aspect ratio changes without rotation to explain it
    norm["warp"] = np.where(norm["rotation"] > 0.01, 0, norm["warp"])
    # with low visibility the mask is noise: ignore geometry/blur/warp there
    valid = ch["vis"] > 0.35 * (ch["vis"].max() or 1)
    pair = valid[1:] & valid[:-1]
    for k in ("position", "scale", "rotation", "blur", "warp"):
        norm[k] = np.where(pair, norm[k], 0)
    total = sum(norm.values())
    active = total > 0.004
    phases = []
    for s, e in segments(active):
        # dominant channel in this phase
        dom = max(norm, key=lambda k: norm[k][s:e].sum())
        src = {"opacity": ch["vis"], "position": np.hypot(ch["x"] - ch["x"][e], ch["y"] - ch["y"][e]),
               "scale": ch["scale"], "rotation": ch["rot"], "blur": ch["sharp"], "warp": ch["aspect"]}[dom][s:e + 1]
        a, b = src[0], src[-1]
        if dom == "position":  # distance to end point → progress
            prog = 1 - src / (src[0] or 1)
        else:
            prog = (src - a) / ((b - a) or 1)
        best, scores, overshoot = fit_curve(prog)
        family = fit_curve(prog, FAMILY_SAMPLES)[0]
        n = e - s
        peak = float(total[s:e].max())
        phases.append({
            "start_f": int(s), "end_f": int(e), "frames": int(n), "ms": round(n / fps * 1000),
            "duration_token": nearest_duration(n), "channel": dom,
            "channels_used": [k for k in norm if norm[k][s:e].sum() > CHANNEL_MIN[k]],
            "family": family if overshoot < 0.05 else "overshoot", "token": best if overshoot < 0.05 else "Pop",
            "fit_rmse": round(scores[best], 3), "overshoot": round(overshoot, 3),
            "peak_speed": round(peak, 4), "progress": [round(float(p), 3) for p in prog],
        })
    order = [("blur", "Blur"), ("opacity", "Fade"), ("position", "Position"), ("rotation", "Rotate"), ("scale", "Scale"), ("warp", "Warp")]
    used = set(c for p in phases for c in p["channels_used"])
    category = " & ".join(n for k, n in order if k in used) or "Static"
    energy = max((p["peak_speed"] for p in phases), default=0)
    return {
        "file": path.name, "fps": round(fps, 2), "frames": len(frames), "size": [w, h],
        "category": category, "phases": phases, "energy": round(energy, 4),
        "energy_class": "dynamic" if energy > 0.08 else "medium" if energy > 0.03 else "soft",
        "has_bounce": any(p["overshoot"] >= 0.05 for p in phases),
    }


def plot(result, outdir):
    import matplotlib
    matplotlib.use("Agg")
    import matplotlib.pyplot as plt
    fig, ax = plt.subplots(figsize=(5, 3.2))
    for ph in result.get("phases", []):
        p = ph["progress"]
        ax.plot(np.linspace(0, 1, len(p)), p, lw=2, label=f'{ph["channel"]} f{ph["start_f"]}-{ph["end_f"]} → {ph["family"]}/{ph["token"]}')
    for k, v in CURVE_SAMPLES.items():
        ax.plot(np.linspace(0, 1, len(v)), v, lw=0.8, ls="--", alpha=0.5, label=k)
    ax.set_title(f'{result["file"][:28]} · {result["energy_class"]}', fontsize=9)
    ax.legend(fontsize=6)
    fig.tight_layout()
    fig.savefig(Path(outdir) / (Path(result["file"]).stem + ".png"), dpi=110)
    plt.close(fig)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("src")
    ap.add_argument("--limit", type=int, default=0)
    ap.add_argument("--out")
    ap.add_argument("--plot")
    args = ap.parse_args()
    src = Path(args.src)
    files = sorted(src.glob("*.webm")) if src.is_dir() else [src]
    if args.limit:
        files = files[:args.limit]
    results = []
    for i, f in enumerate(files):
        try:
            r = analyze(f)
        except Exception as e:  # a broken preview must not stop the batch
            r = {"file": f.name, "error": str(e)}
        results.append(r)
        if args.plot and "error" not in r:
            Path(args.plot).mkdir(parents=True, exist_ok=True)
            plot(r, args.plot)
        if len(files) > 20 and i % 100 == 0:
            print(f"{i}/{len(files)}", file=sys.stderr)
    if args.out:
        Path(args.out).write_text(json.dumps(results, ensure_ascii=False, indent=1), encoding="utf-8")
    else:
        for r in results:
            print(json.dumps({k: v for k, v in r.items() if k != "phases"}, ensure_ascii=False))
            for p in r.get("phases", []):
                print("   ", {k: v for k, v in p.items() if k != "progress"})


if __name__ == "__main__":
    main()
