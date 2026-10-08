"""Region tracking with OpenCV (KLT) → JSON with per-frame position/scale/rotation for AE.

Usage: python track_points.py <video> <output.json> [--debug video_debug.mp4] [--regions regions.json]
Regions are in video pixels (center x, y, radius). Default regions below are for the 70s interview clip;
pass --regions with {"name": [x, y, r], ...} for any other clip.
"""
import argparse
import json
import math

import cv2
import numpy as np

REGIONS = {
    "wallpaper": (160, 240, 70),
    "lamp": (1244, 470, 80),
    "mic_head": (1370, 590, 60),
    "face": (940, 380, 90),
    "lapel": (800, 760, 90),
    "mic_joint": (1660, 620, 60),
}
LK = dict(winSize=(31, 31), maxLevel=4, criteria=(cv2.TERM_CRITERIA_EPS | cv2.TERM_CRITERIA_COUNT, 30, 0.01))


def seed(gray, cx, cy, r):
    mask = np.zeros_like(gray)
    cv2.circle(mask, (cx, cy), r, 255, -1)
    pts = cv2.goodFeaturesToTrack(gray, maxCorners=60, qualityLevel=0.01, minDistance=5, mask=mask)
    return pts


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("video")
    ap.add_argument("out")
    ap.add_argument("--debug")
    ap.add_argument("--regions", help="JSON file {name: [x, y, radius]} in video pixels")
    a = ap.parse_args()
    regions = json.load(open(a.regions, encoding="utf-8")) if a.regions else REGIONS

    cap = cv2.VideoCapture(a.video)
    fps = cap.get(cv2.CAP_PROP_FPS)
    frames = []
    while True:
        ok, f = cap.read()
        if not ok:
            break
        frames.append(f)
    h, w = frames[0].shape[:2]
    grays = [cv2.cvtColor(f, cv2.COLOR_BGR2GRAY) for f in frames]

    tracks = {}
    for name, (cx, cy, r) in regions.items():
        pts = seed(grays[0], cx, cy, r)
        anchor = np.array([cx, cy], dtype=np.float64)
        pos, scale, rot, conf = [anchor.tolist()], [1.0], [0.0], [1.0]
        s_acc, r_acc = 1.0, 0.0
        n0 = len(pts)
        for i in range(1, len(grays)):
            if pts is None or len(pts) < 4:  # re-seed if points were lost
                pts = seed(grays[i - 1], int(anchor[0]), int(anchor[1]), r)
                if pts is None:
                    pos.append(anchor.tolist()); scale.append(s_acc); rot.append(r_acc); conf.append(0.0)
                    continue
            nxt, st, _ = cv2.calcOpticalFlowPyrLK(grays[i - 1], grays[i], pts, None, **LK)
            back, st2, _ = cv2.calcOpticalFlowPyrLK(grays[i], grays[i - 1], nxt, None, **LK)
            good = (st.ravel() == 1) & (st2.ravel() == 1) & (np.linalg.norm((back - pts).reshape(-1, 2), axis=1) < 0.8)
            p0, p1 = pts[good].reshape(-1, 2), nxt[good].reshape(-1, 2)
            if len(p0) >= 3:
                M, inl = cv2.estimateAffinePartial2D(p0, p1, ransacReprojThreshold=1.5)
            else:
                M = None
            if M is not None:
                anchor = M @ np.array([anchor[0], anchor[1], 1.0])
                s_acc *= math.hypot(M[0, 0], M[1, 0])
                r_acc += math.degrees(math.atan2(M[1, 0], M[0, 0]))
                pts = p1[inl.ravel() == 1].reshape(-1, 1, 2)
            else:
                pts = p1.reshape(-1, 1, 2)
            pos.append([float(anchor[0]), float(anchor[1])]); scale.append(s_acc); rot.append(r_acc)
            conf.append(round(len(pts) / max(n0, 1), 3))
        tracks[name] = {"pos": [[round(x, 2), round(y, 2)] for x, y in pos], "scale": [round(s, 4) for s in scale],
                        "rot": [round(v, 3) for v in rot], "confidence": conf, "radius": r}
        print(f"{name:10s} drift_end=({pos[-1][0]-cx:+.1f},{pos[-1][1]-cy:+.1f}) scale={scale[-1]:.3f} rot={rot[-1]:+.2f} conf_min={min(conf):.2f}")

    json.dump({"fps": fps, "size": [w, h], "frames": len(frames), "tracks": tracks}, open(a.out, "w"))

    if a.debug:
        vw = cv2.VideoWriter(a.debug, cv2.VideoWriter_fourcc(*"mp4v"), fps, (w // 2, h // 2))
        for i, f in enumerate(frames):
            g = f.copy()
            for name, t in tracks.items():
                x, y = map(int, t["pos"][i])
                cv2.circle(g, (x, y), 14, (133, 255, 216), 3)
                cv2.putText(g, name, (x + 18, y - 10), cv2.FONT_HERSHEY_SIMPLEX, 1, (133, 255, 216), 2)
            vw.write(cv2.resize(g, (w // 2, h // 2)))
        vw.release()


if __name__ == "__main__":
    main()
