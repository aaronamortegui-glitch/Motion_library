"""Per-frame subject contours from an alpha matte → JSON for animated shape paths in AE.

Usage: python tools/matte_contours.py <matte.webm|mov> <out.json> [--subjects 2] [--size 1920x1080] [--points 160]
         [--fps 24] [--smooth 0.6] [--preview preview.mp4]

- Decodes the matte's alpha (VP9 alpha needs libvpx-vp9, handled via ffmpeg), resizes to the comp size.
- Keeps the N biggest external contours per frame (one per person), ordered left → right so ids stay stable.
- Resamples each contour to a fixed number of points starting at its top-most point, and smooths it over time,
  so the AE path interpolates cleanly and the line feels hand-drawn instead of jittery.
Output: {"fps": 24, "size": [w, h], "frames": n, "contours": {"c0": [[[x, y], ...] per frame], "c1": ...}}
"""
import argparse
import json
import subprocess

import cv2
import numpy as np


def read_alpha(path, w, h, fps):
    is_vp9 = path.lower().endswith(".webm")
    cmd = ["ffmpeg", "-loglevel", "error"] + (["-c:v", "libvpx-vp9"] if is_vp9 else []) + [
        "-i", path, "-vf", f"fps={fps},scale={w}:{h}:flags=bilinear,format=rgba", "-f", "rawvideo", "-"]
    raw = subprocess.run(cmd, capture_output=True, check=True).stdout
    frames = np.frombuffer(raw, np.uint8).reshape(-1, h, w, 4)
    return frames[..., 3]


def resample(cnt, n):
    pts = cnt.reshape(-1, 2).astype(np.float64)
    start = int(np.argmin(pts[:, 1]))                       # start at the top-most point (stable across frames)
    pts = np.roll(pts, -start, axis=0)
    closed = np.vstack([pts, pts[:1]])
    seg = np.linalg.norm(np.diff(closed, axis=0), axis=1)
    s = np.concatenate([[0], np.cumsum(seg)])
    t = np.linspace(0, s[-1], n, endpoint=False)
    return np.stack([np.interp(t, s, closed[:, 0]), np.interp(t, s, closed[:, 1])], axis=1)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("matte"); ap.add_argument("out")
    ap.add_argument("--subjects", type=int, default=1)
    ap.add_argument("--size", default="1920x1080")
    ap.add_argument("--points", type=int, default=160)
    ap.add_argument("--fps", type=float, default=24)
    ap.add_argument("--smooth", type=float, default=0.6, help="temporal smoothing 0..1 (higher = calmer)")
    ap.add_argument("--preview")
    ap.add_argument("--split-x", type=int, default=0,
                    help="cut the mask with a vertical line at this x (comp px) so touching subjects stay separate contours")
    a = ap.parse_args()
    w, h = map(int, a.size.split("x"))
    alpha = read_alpha(a.matte, w, h, a.fps)
    k = cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (9, 9))
    tracks = [[] for _ in range(a.subjects)]
    prev = [None] * a.subjects
    for al in alpha:
        m = cv2.morphologyEx((al > 128).astype(np.uint8) * 255, cv2.MORPH_CLOSE, k)
        if a.split_x:
            m[:, a.split_x - 3:a.split_x + 3] = 0
        cnts, _ = cv2.findContours(m, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_NONE)
        cnts = sorted(cnts, key=cv2.contourArea, reverse=True)[:a.subjects]
        cnts = [c for c in cnts if cv2.contourArea(c) > 0.01 * w * h]
        cnts = sorted(cnts, key=lambda c: c.reshape(-1, 2)[:, 0].mean())   # left → right
        for i in range(a.subjects):
            if i < len(cnts):
                p = resample(cnts[i], a.points)
                if prev[i] is not None:
                    p = a.smooth * prev[i] + (1 - a.smooth) * p
            else:
                p = prev[i] if prev[i] is not None else np.zeros((a.points, 2))
            prev[i] = p
            tracks[i].append([[round(float(x), 1), round(float(y), 1)] for x, y in p])
    out = {"fps": a.fps, "size": [w, h], "frames": len(alpha), "contours": {f"c{i}": t for i, t in enumerate(tracks)}}
    json.dump(out, open(a.out, "w"), separators=(",", ":"))
    print(f"{len(alpha)} frames | {a.subjects} contour(s) | {a.points} points -> {a.out}")

    if a.preview:
        vw = cv2.VideoWriter(a.preview, cv2.VideoWriter_fourcc(*"mp4v"), a.fps, (w // 2, h // 2))
        for f in range(len(alpha)):
            img = cv2.cvtColor(alpha[f], cv2.COLOR_GRAY2BGR) // 4
            for t in tracks:
                cv2.polylines(img, [np.array(t[f], np.int32)], True, (133, 255, 216), 3)
            vw.write(cv2.resize(img, (w // 2, h // 2)))
        vw.release()


if __name__ == "__main__":
    main()
