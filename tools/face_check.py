"""Likeness QA for AI shots of real people: crops every face found in the generated images (or video frames)
and lays them next to the real reference photo, so drift (younger, slimmer, different beard...) is caught
before spending on video. Review the sheet; regenerate any shot that does not read as the person.

Usage:
  python tools/face_check.py --ref aaron.png --ref collaborator.png --out research/face_check.png media/cypher/*.png
  python tools/face_check.py --ref aaron.png --out research/face_check_clip.png media/cypher/clip03.mp4   (samples 4 frames)

Lessons (docs/LEARNINGS.md): use ONLY real photos as identity references (never earlier AI shots: drift compounds),
describe the person's key traits in the prompt, keep glasses lenses clear so the eyes read.
"""
import argparse
import pathlib

import cv2
import numpy as np

CASCADES = [cv2.CascadeClassifier(cv2.data.haarcascades + n) for n in
            ("haarcascade_frontalface_alt2.xml", "haarcascade_frontalface_default.xml", "haarcascade_profileface.xml")]
TILE = 220


def frames(path, n=4):
    p = str(path)
    if p.lower().endswith((".mp4", ".mov", ".webm")):
        cap = cv2.VideoCapture(p)
        total = int(cap.get(cv2.CAP_PROP_FRAME_COUNT)) or 1
        out = []
        for i in range(n):
            cap.set(cv2.CAP_PROP_POS_FRAMES, int((i + 0.5) * total / n))
            ok, f = cap.read()
            if ok:
                out.append((f"{path.name}@{i}", f))
        return out
    img = cv2.imread(p)
    return [(path.name, img)] if img is not None else []


def skin_ratio(crop):
    ycc = cv2.cvtColor(crop, cv2.COLOR_BGR2YCrCb)
    m = cv2.inRange(ycc, (0, 135, 85), (255, 180, 135))
    return m.mean() / 255.0


def faces(img, max_faces=3):
    g = cv2.equalizeHist(cv2.cvtColor(img, cv2.COLOR_BGR2GRAY))
    scale = min(1.0, 1400 / max(g.shape))
    small = cv2.resize(g, None, fx=scale, fy=scale) if scale < 1 else g
    gray_ref = len(img.shape) == 2 or float(np.std(img[..., 0].astype(int) - img[..., 2].astype(int))) < 4
    found = []
    for c in CASCADES:
        for r in c.detectMultiScale(small, 1.08, 7, minSize=(36, 36)):
            x, y, w, h = [int(v / scale) for v in r]
            crop = img[y:y + h, x:x + w]
            if crop.size and (gray_ref or skin_ratio(crop) > 0.18):      # rejects bricks, walls, fabric
                if all(abs(x - fx) > w * 0.5 or abs(y - fy) > h * 0.5 for fx, fy, fw, fh in found):
                    found.append((x, y, w, h))
        if found:
            break
    found = sorted(found, key=lambda r: -r[2] * r[3])[:max_faces]
    out = []
    for (x, y, w, h) in found:
        pad = int(0.35 * w)
        x0, y0 = max(0, x - pad), max(0, y - pad)
        x1, y1 = min(img.shape[1], x + w + pad), min(img.shape[0], y + h + pad)
        out.append(cv2.resize(img[y0:y1, x0:x1], (TILE, TILE)))
    return out


def label(tile, text):
    t = tile.copy()
    cv2.rectangle(t, (0, TILE - 22), (TILE, TILE), (10, 33, 31), -1)
    cv2.putText(t, text[:30], (6, TILE - 7), cv2.FONT_HERSHEY_SIMPLEX, 0.42, (216, 255, 133), 1, cv2.LINE_AA)
    return t


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--ref", action="append", required=True, help="real photo of a person (repeat per person)")
    ap.add_argument("--out", required=True)
    ap.add_argument("shots", nargs="+")
    a = ap.parse_args()
    refs = []
    for r in a.ref:
        img = cv2.imread(r)
        f = faces(img, 1) if img is not None else []
        refs.append(label(f[0] if f else cv2.resize(img, (TILE, TILE)), "REF " + pathlib.Path(r).stem))
    rows = []
    for s in a.shots:
        for name, img in frames(pathlib.Path(s)):
            fs = faces(img)
            if not fs:
                continue
            rows.append(np.hstack(refs + [label(f, name) for f in fs] + [np.zeros((TILE, TILE, 3), np.uint8)] * (3 - len(fs))))
    if not rows:
        raise SystemExit("no faces found")
    sheet = np.vstack(rows)
    pathlib.Path(a.out).parent.mkdir(parents=True, exist_ok=True)
    cv2.imwrite(a.out, sheet)
    print(f"{a.out}: {len(rows)} rows (refs on the left, detected faces on the right)")


if __name__ == "__main__":
    main()
