"""Where the people are in a still, and where text can go without covering or cutting them.

  faces   OpenCV Haar cascades (frontal + profile), padded 20 %
  bodies  U2-Net saliency (~/.u2net/u2net.onnx, the rembg model) thresholded, one box per large blob
  KEEP    boxes added by hand for what the detectors miss; DROP the false faces (a mug, a hand); check them on the overlay

Boxes are fractions of the image (x, y, w, h), cached in library/packs/stills/subjects.json (committed, so nobody
needs the model unless they add a still). frame_people() picks the text column or band that hides nobody.
Usage: python tools/subjects.py [still ...] [--overlay DIR]   (default: every still in library/packs/stills)
"""
import json, sys, pathlib

ROOT = pathlib.Path(__file__).resolve().parent.parent
OUT = ROOT / "library" / "packs" / "stills" / "subjects.json"
KEEP = {}   # {still: {"faces": [...], "bodies": [...]}} in fractions, by eye
DROP = {"calm-modern.jpg": [1], "dynamic.jpg": [1]}   # false faces by index in the cached list (a mug, a hand)


def faces(img):
    import cv2
    g = cv2.equalizeHist(cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)); H, W = g.shape; out = []
    for name in ("haarcascade_frontalface_default.xml", "haarcascade_profileface.xml"):
        det = cv2.CascadeClassifier(cv2.data.haarcascades + name)
        for flip in (False, True) if "profile" in name else (False,):
            gg = cv2.flip(g, 1) if flip else g
            for x, y, w, h in det.detectMultiScale(gg, 1.1, 8, minSize=(int(H * .06), int(H * .06))):
                if flip: x = W - x - w
                p = .2; out.append([(x - w * p) / W, (y - h * p) / H, w * (1 + 2 * p) / W, h * (1 + 2 * p) / H])
    keep = []   # merge overlaps
    for b in sorted(out, key=lambda b: -b[2]):
        if all(cover(b, k) < .3 for k in keep): keep.append([round(v, 4) for v in b])
    return keep


def bodies(img):
    import cv2, numpy as np
    net = cv2.dnn.readNetFromONNX(str(pathlib.Path.home() / ".u2net" / "u2net.onnx"))
    x = cv2.resize(cv2.cvtColor(img, cv2.COLOR_BGR2RGB), (320, 320)).astype(np.float32) / 255
    x = (x - [.485, .456, .406]) / [.229, .224, .225]
    net.setInput(x.transpose(2, 0, 1)[None].astype(np.float32)); m = net.forward()[0, 0]
    m = (m - m.min()) / (m.max() - m.min() + 1e-6)
    n, lab, st, _ = cv2.connectedComponentsWithStats((m > .5).astype(np.uint8))
    return [[round(s[0] / 320, 4), round(s[1] / 320, 4), round(s[2] / 320, 4), round(s[3] / 320, 4)] for s in st[1:] if s[4] > 320 * 320 * .02]


def cover(box, rect):
    """The share of box that rect covers."""
    x = max(0, min(box[0] + box[2], rect[0] + rect[2]) - max(box[0], rect[0])); y = max(0, min(box[1] + box[3], rect[1] + rect[3]) - max(box[1], rect[1]))
    return x * y / (box[2] * box[3] + 1e-9)


def subjects(path):
    """The boxes of one still (detected once, then read from the cache)."""
    path = pathlib.Path(path); db = json.loads(OUT.read_text()) if OUT.exists() else {}
    k = path.name
    if k not in db:
        import cv2
        img = cv2.imread(str(path)); db[k] = {"faces": faces(img), "bodies": bodies(img)}
        OUT.write_text(json.dumps(db, indent=1) + "\n")
    d = db[k]; e = KEEP.get(k, {}); f = [b for i, b in enumerate(d["faces"]) if i not in DROP.get(k, [])]
    return {"faces": f + e.get("faces", []), "bodies": d["bodies"] + e.get("bodies", [])}


AREA = {"left": lambda w: [0, 0, w, 1], "right": lambda w: [1 - w, 0, w, 1], "bottom": lambda h: [0, 1 - h, 1, h]}


def frame_people(subj, col=.44, band=.42):
    """Where the text goes so nobody is covered or cut: a column on the left or right, or a band at the bottom. The
    still may grow (up to 1.5x) and slide so the people move away from it. Every option is scored by what it hides
    (a face counts most, then the upper half of a body, then the rest). Returns (side, size, scale, dx, dy, faces,
    bodies) in fractions of the frame, the boxes already moved."""
    best = None
    for sc in (1, 1.12, 1.25, 1.38, 1.5):
        for k in range(0, 11):
            dx = -(sc - 1) * k / 10
            fy = min([f[1] for f in subj["faces"]] or [0]); dy = -min(sc - 1, max(0, fy * sc - .05))   # keep the heads in
            mv = lambda b: [b[0] * sc + dx, b[1] * sc + dy, b[2] * sc, b[3] * sc]
            F = [mv(f) for f in subj["faces"]]; B = [mv(x) for x in subj["bodies"]]
            if any(f[0] < 0 or f[1] < 0 or f[0] + f[2] > 1 or f[1] + f[3] > 1 for f in F): continue   # a face cut by the frame
            for side, size in (("left", col), ("right", col), ("bottom", band)):
                r = AREA[side](size)
                pen = (sum(100 * cover(f, r) for f in F) + sum(10 * cover([x[0], x[1], x[2], x[3] / 2], r) + cover(x, r) for x in B)
                       + (sc - 1) * .8 + (.15 if side == "bottom" else 0))   # rather a column, rather not zoomed
                if not best or pen < best[0]: best = (pen, side, size, sc, dx, dy, F, B)
    return best[1:]


if __name__ == "__main__":
    args = [a for a in sys.argv[1:] if not a.startswith("--")]
    ov = pathlib.Path(sys.argv[sys.argv.index("--overlay") + 1]) if "--overlay" in sys.argv else None
    if ov: args = [a for a in args if pathlib.Path(a) != ov]
    for p in [pathlib.Path(a) for a in args] or sorted(OUT.parent.glob("*.jpg")):
        s = subjects(p); print(p.name, len(s["faces"]), "faces", len(s["bodies"]), "bodies")
        if ov:
            import cv2
            img = cv2.imread(str(p)); H, W = img.shape[:2]
            for col, key in (((0, 0, 255), "faces"), ((0, 255, 0), "bodies")):
                for x, y, w, h in s[key]: cv2.rectangle(img, (int(x * W), int(y * H)), (int((x + w) * W), int((y + h) * H)), col, 4)
            cv2.imwrite(str(ov / p.name), cv2.resize(img, (800, 450)))
