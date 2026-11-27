#!/usr/bin/env python3
"""Find where the person is in a video, frame by frame, for reframing 16:9 footage to 9:16 (or any crop).

OpenCV only (Haar face detectors, frontal + profile, with the HOG person detector as a fallback), no GPU, no
downloads. The raw centres are smoothed with a critically damped spring (no overshoot, the camera "settles" on the
person the way the library's Settle curve does) and a dead zone, so the crop does not jitter with every head turn.

Usage: python track_subject.py video.mp4 [--fps 8] [--out track.json] [--deadzone 0.03]
Output: {"width", "height", "duration", "points": [[t_seconds, x_0_1, y_0_1, found], ...]} (x, y = subject centre).
"""
import argparse
import json
import math
import pathlib

import cv2


def detect(frame, faces, profiles, hog, prev=None):
    """The subject's centre (0-1). Among several candidates, the one nearest the previous centre wins (continuity);
    without a previous one, the biggest."""
    g = cv2.cvtColor(frame, cv2.COLOR_BGR2GRAY)
    g = cv2.equalizeHist(g)
    h, w = g.shape
    cands = []
    for det, flip in ((faces, False), (profiles, False), (profiles, True)):
        img = cv2.flip(g, 1) if flip else g
        found = det.detectMultiScale(img, scaleFactor=1.1, minNeighbors=7, minSize=(w // 12, w // 12))
        for (x, y, fw, fh) in found:
            if flip:
                x = w - x - fw
            cands.append((x + fw / 2, y + fh / 2, fw * fh))
        if cands:
            break
    best = None
    if cands:
        if prev:
            best = min(cands, key=lambda c: (c[0] / w - prev[0]) ** 2 + (c[1] / h - prev[1]) ** 2 - c[2] / (w * h))
        else:
            best = max(cands, key=lambda c: c[2])
    if best:   # a face: frame the head and shoulders, a little below the face centre
        return best[0] / w, min(1.0, (best[1] + math.sqrt(best[2]) * 0.6) / h), True
    rects, _ = hog.detectMultiScale(frame, winStride=(8, 8))
    if len(rects):
        x, y, fw, fh = max(rects, key=lambda r: r[2] * r[3])
        return (x + fw / 2) / w, (y + fh * 0.35) / h, True
    return None


def smooth(points, fps, deadzone=0.03, settle_s=0.6):
    """Critically damped spring towards the detections, holding still inside a dead zone."""
    if not points:
        return []
    omega = 2 * math.pi / settle_s
    dt = 1 / fps
    x, y = points[0][1], points[0][2]
    vx = vy = 0.0
    tx, ty = x, y
    out = []
    for t, px, py, ok in points:
        if ok:
            if abs(px - tx) > deadzone:
                tx = px
            if abs(py - ty) > deadzone:
                ty = py
        for _ in range(4):   # sub-steps for stability
            h = dt / 4
            ax = omega * omega * (tx - x) - 2 * omega * vx
            ay = omega * omega * (ty - y) - 2 * omega * vy
            vx += ax * h; vy += ay * h
            x += vx * h; y += vy * h
        out.append([round(t, 4), round(x, 4), round(y, 4), ok])
    return out


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("video")
    ap.add_argument("--fps", type=float, default=8)
    ap.add_argument("--out")
    ap.add_argument("--deadzone", type=float, default=0.03)
    ap.add_argument("--max-jump", dest="max_jump", type=float, default=0.12, help="largest move (0-1 of the width) accepted within 1 s")
    a = ap.parse_args()
    cap = cv2.VideoCapture(a.video)
    src_fps = cap.get(cv2.CAP_PROP_FPS) or 24
    n = int(cap.get(cv2.CAP_PROP_FRAME_COUNT))
    w, h = int(cap.get(cv2.CAP_PROP_FRAME_WIDTH)), int(cap.get(cv2.CAP_PROP_FRAME_HEIGHT))
    faces = cv2.CascadeClassifier(cv2.data.haarcascades + "haarcascade_frontalface_default.xml")
    profiles = cv2.CascadeClassifier(cv2.data.haarcascades + "haarcascade_profileface.xml")
    hog = cv2.HOGDescriptor()
    hog.setSVMDetector(cv2.HOGDescriptor_getDefaultPeopleDetector())
    step = max(1, round(src_fps / a.fps))
    # Every frame goes through a visual tracker (MIL) that follows the person's head-and-shoulders box, so a hand over
    # the face or a turned head does not lose them; every `step` frames a face detection near the tracked box re-anchors
    # it. A detection far from the person is ignored (lamps, mics, posters), unless the tracker has lost them.
    raw, last = [], None
    SW = 640
    tracker, tracking, box = None, False, None
    i = -1
    while True:
        ok, frame = cap.read()
        if not ok:
            break
        i += 1
        small = cv2.resize(frame, (SW, int(SW * h / w)))
        sh = small.shape[0]
        if tracking:
            tracking, b = tracker.update(small)
            if tracking:
                box = tuple(int(v) for v in b)
        if i % step:
            continue
        d = detect(small, faces, profiles, hog, last)
        if d:
            near = last is None or not tracking or abs(d[0] - last[0]) < a.max_jump
            if near:   # (re)anchor on the face: a head-and-shoulders box around it
                fw = SW * 0.16
                x0, y0 = int(max(0, d[0] * SW - fw)), int(max(0, d[1] * sh - fw * 1.2))
                bx = (x0, y0, int(min(fw * 2, SW - x0 - 1)), int(min(fw * 2.4, sh - y0 - 1)))   # inside the image
                tracker = cv2.TrackerMIL_create()
                tracker.init(small, bx)
                tracking, box = True, bx
        if tracking and box:
            cx, cy = (box[0] + box[2] / 2) / SW, (box[1] + box[3] / 2) / sh
            last = (cx, cy)
            raw.append([i / src_fps, cx, cy, True])
        else:   # keep the last known place
            raw.append([i / src_fps, *(last if last else (0.5, 0.45)), False])
    # rolling median over 5 samples kills one-off false detections before the spring
    med = []
    for k in range(len(raw)):
        win = [r for r in raw[max(0, k - 2):k + 3] if r[3]] or [raw[k]]
        med.append([raw[k][0], sorted(r[1] for r in win)[len(win) // 2], sorted(r[2] for r in win)[len(win) // 2], raw[k][3]])
    pts = smooth(med, src_fps / step, a.deadzone)
    res = {"video": str(a.video), "width": w, "height": h, "fps": src_fps, "duration": n / src_fps,
           "found": sum(1 for p in raw if p[3]), "samples": len(raw), "points": pts}
    out = pathlib.Path(a.out) if a.out else pathlib.Path(a.video).with_suffix(".track.json")
    out.write_text(json.dumps(res), encoding="utf-8")
    xs = [p[1] for p in pts]
    print(f"{out}: {res['found']}/{res['samples']} samples with a person, x {min(xs):.2f}..{max(xs):.2f}")


if __name__ == "__main__":
    main()
