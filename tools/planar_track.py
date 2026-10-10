"""Planar (2.5D) track: follows a flat surface in a clip (a wall, a floor, a screen, a table) and outputs, per frame, the
four corners of a quad you place on it, so a text or graphic sits ON the surface with the right perspective while the
camera moves (Mocha-style corner pin). KLT features inside the region → RANSAC homography to frame 0 → the quad.
  python tools/planar_track.py clip.mp4 out.json --region x0,y0,x1,y1 --quad name:x0,y0,x1,y1 [--quad ...] [--size 1920x1080]
Quads are axis-aligned boxes in frame-0 pixels (the surface must be roughly facing the camera in frame 0; for a surface
in perspective, give its four corners with --corners name:ulx,uly,urx,ury,llx,lly,lrx,lry).
Output: {"fps", "size", "frames", "quads": {name: [[UL, UR, LL, LR] per frame]}} → "planar" items in build_scene.jsx.
"""
import argparse
import json

import cv2
import numpy as np


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("video"); ap.add_argument("out")
    ap.add_argument("--region", required=True); ap.add_argument("--quad", action="append", default=[])
    ap.add_argument("--corners", action="append", default=[]); ap.add_argument("--size", default="1920x1080")
    a = ap.parse_args()
    w, h = map(int, a.size.split("x"))
    x0, y0, x1, y1 = map(float, a.region.split(","))
    quads = {}
    for q in a.quad:
        n, v = q.split(":"); qx0, qy0, qx1, qy1 = map(float, v.split(","))
        quads[n] = np.float32([[qx0, qy0], [qx1, qy0], [qx0, qy1], [qx1, qy1]])
    for q in a.corners:
        n, v = q.split(":"); quads[n] = np.float32(list(map(float, v.split(",")))).reshape(4, 2)
    cap = cv2.VideoCapture(a.video); fps = cap.get(cv2.CAP_PROP_FPS) or 24
    ok, f0 = cap.read(); f0 = cv2.resize(f0, (w, h)); g0 = cv2.cvtColor(f0, cv2.COLOR_BGR2GRAY)
    mask = np.zeros_like(g0); mask[int(y0):int(y1), int(x0):int(x1)] = 255
    p0 = cv2.goodFeaturesToTrack(g0, maxCorners=400, qualityLevel=0.005, minDistance=7, mask=mask)
    ref, prev, pts = p0.copy(), g0, p0.copy()
    H = np.eye(3, dtype=np.float32); out = {n: [] for n in quads}; frames = 0
    lk = dict(winSize=(31, 31), maxLevel=4, criteria=(cv2.TERM_CRITERIA_EPS | cv2.TERM_CRITERIA_COUNT, 30, 0.01))
    while ok:
        if frames:
            g = cv2.cvtColor(cv2.resize(f, (w, h)), cv2.COLOR_BGR2GRAY)
            nxt, st, _ = cv2.calcOpticalFlowPyrLK(prev, g, pts, None, **lk)
            keep = st.reshape(-1) == 1
            ref, pts = ref[keep], nxt[keep]
            if len(pts) >= 8:
                Hn, _ = cv2.findHomography(ref, pts, cv2.RANSAC, 3.0)
                if Hn is not None:
                    H = Hn
            prev = g
        for n, q in quads.items():
            c = cv2.perspectiveTransform(q.reshape(-1, 1, 2), H).reshape(4, 2)
            out[n].append([[round(float(x), 2), round(float(y), 2)] for x, y in c])
        frames += 1
        ok, f = cap.read()
    json.dump({"fps": fps, "size": [w, h], "frames": frames, "quads": out}, open(a.out, "w"))
    for n in out:
        print(f"planar {n}: {frames} frames, UL {out[n][0][0]} -> {out[n][-1][0]}, features left {len(pts)}")


if __name__ == "__main__":
    main()
