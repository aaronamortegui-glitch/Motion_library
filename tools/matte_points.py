"""Track points from a people matte: per frame, the head (top of the biggest silhouette) and its centre of mass → the
same tracks JSON as tools/track_points.py, so build_scene.jsx makes TRK nulls from it. Use it when KLT cannot hold a
moving person (a walk-in, a jump): the matte follows the whole body, so rays, halos or labels stay on them.
  python tools/matte_points.py matte.mov tracks.json [--size 1920x1080] [--fps 24] [--smooth 0.6] [--merge other_tracks.json]
Tracks written: "head" (x = middle of the top 6 % of the silhouette, y = its top + 4 %) and "body" (centroid).
--merge adds the tracks of another JSON (e.g. KLT points of the same plate) into the output.
"""
import argparse
import json
import subprocess

import cv2
import numpy as np


def read_alpha(path, w, h, fps):
    vp9 = ["-c:v", "libvpx-vp9"] if path.lower().endswith(".webm") else []
    raw = subprocess.run(["ffmpeg", "-loglevel", "error"] + vp9 + ["-i", path, "-vf", f"fps={fps},scale={w}:{h},format=rgba",
                          "-f", "rawvideo", "-"], capture_output=True, check=True).stdout
    return np.frombuffer(raw, np.uint8).reshape(-1, h, w, 4)[..., 3]


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("matte"); ap.add_argument("out")
    ap.add_argument("--size", default="1920x1080"); ap.add_argument("--fps", type=float, default=24)
    ap.add_argument("--smooth", type=float, default=0.6); ap.add_argument("--merge")
    a = ap.parse_args()
    w, h = map(int, a.size.split("x"))
    head, body, last = [], [], None
    for al in read_alpha(a.matte, w, h, a.fps):
        n, lab, st, cen = cv2.connectedComponentsWithStats((al > 128).astype(np.uint8))
        if n < 2:
            hp, bp = last if last else ((w / 2, h / 2), (w / 2, h / 2))
        else:
            k = 1 + int(np.argmax(st[1:, cv2.CC_STAT_AREA]))
            top, hh = st[k, cv2.CC_STAT_TOP], st[k, cv2.CC_STAT_HEIGHT]
            band = lab[top:top + max(2, int(hh * 0.06))] == k
            xs = np.nonzero(band)[1]
            hp = (float(xs.mean()), float(top + hh * 0.04))
            bp = (float(cen[k][0]), float(cen[k][1]))
        if last and a.smooth:   # exponential smoothing: a matte edge flickers, a halo should not
            s = a.smooth
            hp = (last[0][0] * s + hp[0] * (1 - s), last[0][1] * s + hp[1] * (1 - s))
            bp = (last[1][0] * s + bp[0] * (1 - s), last[1][1] * s + bp[1] * (1 - s))
        last = (hp, bp)
        head.append([round(hp[0], 2), round(hp[1], 2)]); body.append([round(bp[0], 2), round(bp[1], 2)])
    n = len(head)
    tracks = {"head": {"pos": head, "scale": [1.0] * n, "rot": [0.0] * n},
              "body": {"pos": body, "scale": [1.0] * n, "rot": [0.0] * n}}
    if a.merge:
        tracks.update(json.load(open(a.merge, encoding="utf-8"))["tracks"])
    json.dump({"fps": a.fps, "size": [w, h], "frames": n, "tracks": tracks}, open(a.out, "w"))
    print(f"matte points: {n} frames, head {head[0]} -> {head[-1]}")


if __name__ == "__main__":
    main()
