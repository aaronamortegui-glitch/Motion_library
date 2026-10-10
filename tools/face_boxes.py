"""Face boxes per frame (OpenCV Haar cascade, ships with opencv-python) → JSON that tools/check_layout.jsx uses to flag
graphics placed on faces (layout rule: no HUD dot, line end or text on a face). Boxes are padded and held between
detections so a missed frame does not open a hole.
  python tools/face_boxes.py plate.mp4 faces.json [--size 1920x1080] [--pad 0.25] [--hold 12]
Output: {"fps", "size", "frames", "faces": [[[x, y, w, h], ...] per frame]}
"""
import argparse
import json

import cv2


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("video"); ap.add_argument("out")
    ap.add_argument("--size", default="1920x1080"); ap.add_argument("--pad", type=float, default=0.25); ap.add_argument("--hold", type=int, default=12)
    a = ap.parse_args()
    w, h = map(int, a.size.split("x"))
    det = cv2.CascadeClassifier(cv2.data.haarcascades + "haarcascade_frontalface_default.xml")
    cap = cv2.VideoCapture(a.video); fps = cap.get(cv2.CAP_PROP_FPS) or 24
    frames, last, age = [], [], 0
    while True:
        ok, f = cap.read()
        if not ok:
            break
        g = cv2.equalizeHist(cv2.cvtColor(cv2.resize(f, (w, h)), cv2.COLOR_BGR2GRAY))
        found = det.detectMultiScale(g, scaleFactor=1.1, minNeighbors=8, minSize=(int(h * 0.05), int(h * 0.05)))
        boxes = []
        for x, y, bw, bh in found:
            p = a.pad
            boxes.append([int(x - bw * p), int(y - bh * p), int(bw * (1 + 2 * p)), int(bh * (1 + 2 * p))])
        if boxes:
            last, age = boxes, 0
        elif age < a.hold:
            boxes, age = last, age + 1
        frames.append(boxes)
    json.dump({"fps": fps, "size": [w, h], "frames": len(frames), "faces": frames}, open(a.out, "w"))
    hit = sum(1 for b in frames if b)
    print(f"faces: {len(frames)} frames, {hit} with a face -> {a.out}")


if __name__ == "__main__":
    main()
