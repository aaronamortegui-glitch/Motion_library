"""Splits a filled logo into the pieces that build it, each drawn on its own: the thick parts (strands, the arrow with
its stem) and the thin lines (rungs, side rails). A morphological opening keeps what is thicker than `--radius` px
(at 1024 px); the rest are the thin lines. Each piece gets its clean outline (fill paths) and one centre stroke (the
longest path of its skeleton) wide enough to cover it, so the end card draws it with Trim Paths under its own outline.

Usage: python tools/logo_parts.py [mark.json] [--radius 14]
  default mark: assets/brand/motion_dna_mark.json (needs <mark>_1024.png next to it, from tools/logo_to_shape.py)
Writes "parts" into the mark JSON, <mark>_parts.svg (one group per piece, for Figma) and a preview research/mcp/logo_parts.png.
"""
import collections
import json
import math
import pathlib
import sys

import cv2
import numpy as np

ROOT = pathlib.Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT / "tools"))
from logo_to_shape import clean  # noqa: E402


def thin(img):
    """Zhang-Suen thinning (vectorised): 1-pixel skeleton of a binary image."""
    I = (img > 0).astype(np.uint8)
    while True:
        changed = False
        for step in (0, 1):
            P = np.pad(I, 1)
            p2, p3, p4, p5 = P[:-2, 1:-1], P[:-2, 2:], P[1:-1, 2:], P[2:, 2:]
            p6, p7, p8, p9 = P[2:, 1:-1], P[2:, :-2], P[1:-1, :-2], P[:-2, :-2]
            seq = [p2, p3, p4, p5, p6, p7, p8, p9, p2]
            B = sum(seq[:8])
            A = sum(((seq[k] == 0) & (seq[k + 1] == 1)).astype(np.uint8) for k in range(8))
            c = (p2 * p4 * p6 == 0) & (p4 * p6 * p8 == 0) if step == 0 else (p2 * p4 * p8 == 0) & (p2 * p6 * p8 == 0)
            m = (I == 1) & (B >= 2) & (B <= 6) & (A == 1) & c
            if m.any(): I[m] = 0; changed = True
        if not changed: return I * 255


def longest_path(mask):
    """Longest path through a component's skeleton (two BFS passes), as pixel points."""
    sk = thin(mask)
    ys, xs = np.nonzero(sk); pts = set(zip(xs.tolist(), ys.tolist()))
    if not pts: return []
    def bfs(s):
        prev, dist, q = {s: None}, {s: 0}, collections.deque([s])
        while q:
            p = q.popleft()
            for dx in (-1, 0, 1):
                for dy in (-1, 0, 1):
                    n = (p[0] + dx, p[1] + dy)
                    if n in pts and n not in dist:
                        dist[n] = dist[p] + math.hypot(dx, dy); prev[n] = p; q.append(n)
        far = max(dist, key=dist.get); return far, prev
    a, _ = bfs(next(iter(pts)))
    b, prev = bfs(a)
    path, p = [], b
    while p is not None: path.append(p); p = prev[p]
    return path


def rdp(pts, eps):
    if len(pts) < 3: return pts
    a, b = np.array(pts[0], float), np.array(pts[-1], float); d = b - a; L = np.hypot(*d) or 1e-9
    dist = [abs(d[1] * x - d[0] * y + b[0] * a[1] - b[1] * a[0]) / L for x, y in pts[1:-1]]
    i = int(np.argmax(dist)) + 1
    return rdp(pts[:i + 1], eps)[:-1] + rdp(pts[i:], eps) if dist[i - 1] > eps else [pts[0], pts[-1]]


def main(path, radius=14):
    D = json.loads(pathlib.Path(path).read_text(encoding="utf-8"))
    png = pathlib.Path(str(pathlib.Path(path).with_suffix("")) + "_1024.png")
    a = cv2.imread(str(png), cv2.IMREAD_UNCHANGED)[:, :, 3]
    _, sil = cv2.threshold(a, 127, 255, cv2.THRESH_BINARY)
    R = sil.shape[0]; sc = R / max(D["width"], D["height"]) * 0.94
    def mk(p): return [round((p[0] - R / 2) / sc, 2), round((p[1] - R / 2) / sc, 2)]
    k = cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (2 * radius + 1, 2 * radius + 1))
    thick = cv2.morphologyEx(sil, cv2.MORPH_OPEN, k)
    thinp = cv2.subtract(sil, thick)
    labels = np.zeros(sil.shape, np.int32); kinds = {}; nid = 0
    for src, kind, min_area in ((thick, "strand", 1500), (thinp, "line", 350)):
        n, lab, stats, _ = cv2.connectedComponentsWithStats(src)
        for i in range(1, n):
            if stats[i, cv2.CC_STAT_AREA] < min_area: continue
            nid += 1; labels[lab == i] = nid; kinds[nid] = kind
    # leftover specks join the nearest piece
    rest = (sil > 0) & (labels == 0)
    if rest.any():
        dist, idx = cv2.distanceTransformWithLabels((labels == 0).astype(np.uint8), cv2.DIST_L2, 5, labelType=cv2.DIST_LABEL_PIXEL)
        ys, xs = np.nonzero(labels > 0); seeds = labels[ys, xs]
        # map each Voronoi label (pixel index) to the piece it starts from
        lut = np.zeros(idx.max() + 1, np.int32)
        zy, zx = np.nonzero(labels == 0)
        nz = np.nonzero(labels > 0)
        lut_vals = labels[nz]; lut_ids = idx[nz]
        lut[lut_ids] = lut_vals
        labels[rest] = lut[idx[rest]]
    # the arrow: the thick piece that reaches furthest towards the top-right
    tip = None; best = -1e9
    for pid, kind in kinds.items():
        if kind != "strand": continue
        ys, xs = np.nonzero(labels == pid); v = (xs - ys).max()
        if v > best: best, tip = v, pid
    kinds[tip] = "arrow"
    parts = []
    for pid, kind in kinds.items():
        m = (labels == pid).astype(np.uint8) * 255
        cs, hier = cv2.findContours(m, cv2.RETR_CCOMP, cv2.CHAIN_APPROX_NONE)
        paths = []
        for c in cs:
            pts = [(float(x), float(y)) for x, y in c[:, 0, :]]
            if len(pts) < 8: continue
            v, ti, to = clean(pts, 3.0, 0.5, step=1.5)
            paths.append({"v": [mk(p) for p in v], "i": [[round(x / sc, 2), round(y / sc, 2)] for x, y in ti],
                          "o": [[round(x / sc, 2), round(y / sc, 2)] for x, y in to], "closed": True})
        lp = longest_path(m)
        if len(lp) < 2: continue
        dt = cv2.distanceTransform(m, cv2.DIST_L2, 5); r = float(dt.max())
        simp = rdp([(float(x), float(y)) for x, y in lp], 1.0)
        # extend both ends so round caps cover the piece's tips
        ext = []
        for end in (0, -1):
            p0 = np.array(simp[end]); p1 = np.array(simp[1 if end == 0 else -2]); d = p0 - p1; d /= (np.hypot(*d) or 1)
            ext.append(tuple(p0 + d * r * 1.3))
        simp = [ext[0]] + simp + [ext[1]]
        st = [mk(p) for p in simp]
        # draw up the helix: from bottom-left towards the top-right
        if (st[0][0] - st[0][1]) > (st[-1][0] - st[-1][1]): st = st[::-1]
        ti, to = [], []
        for i, p in enumerate(st):
            q0 = st[max(i - 1, 0)]; q1 = st[min(i + 1, len(st) - 1)]
            tx, ty = (q1[0] - q0[0]) / 6, (q1[1] - q0[1]) / 6
            ti.append([round(-tx, 2), round(-ty, 2)]); to.append([round(tx, 2), round(ty, 2)])
        ti[0] = [0, 0]; to[-1] = [0, 0]
        L = sum(math.dist(st[i], st[i + 1]) for i in range(len(st) - 1))
        ys, xs = np.nonzero(m)
        at = float(((xs - ys).mean() + R) / (2 * R))   # position along the helix, 0 bottom-left .. 1 top-right
        parts.append({"kind": kind, "at": round(at, 3), "paths": paths,
                      "stroke": {"v": st, "i": ti, "o": to, "width": round(r * 2 * 1.3 / sc, 1), "length": round(L, 1)}})
    parts.sort(key=lambda p: (p["kind"] == "arrow", p["kind"] == "line", p["at"]))
    for i, p in enumerate(parts):
        p["name"] = {"strand": "strand", "line": "line", "arrow": "arrow"}[p["kind"]] + f" {i + 1}"
    D["parts"] = parts
    pathlib.Path(path).write_text(json.dumps(D) + "\n", encoding="utf-8")
    # layered SVG (one group per piece) for Figma and the logo manual
    def d(pp):
        v, i, o = pp["v"], pp["i"], pp["o"]; n = len(v); out = f"M{v[0][0]},{v[0][1]}"
        for kk in range(1, n + 1):
            a_, b_ = v[kk - 1], v[kk % n]
            out += f" C{round(a_[0] + o[kk - 1][0], 2)},{round(a_[1] + o[kk - 1][1], 2)} {round(b_[0] + i[kk % n][0], 2)},{round(b_[1] + i[kk % n][1], 2)} {b_[0]},{b_[1]}"
        return out + "Z"
    w, h = D["width"], D["height"]
    svg = f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="{-w / 2} {-h / 2} {w} {h}" width="{w:.0f}" height="{h:.0f}">\n'
    svg += "\n".join(f'<g id="{pt["name"]}"><path fill="{D.get("fill", "#D8FF85")}" fill-rule="evenodd" d="{" ".join(d(pp) for pp in pt["paths"])}"/></g>' for pt in parts)
    pathlib.Path(str(pathlib.Path(path).with_suffix("")) + "_parts.svg").write_text(svg + "\n</svg>\n", encoding="utf-8", newline="\n")
    # preview: each piece in its colour, its stroke on top
    vis = np.zeros((R, R, 3), np.uint8)
    for i, p in enumerate(parts):
        col = tuple(int(c) for c in cv2.cvtColor(np.uint8([[[i * 170 // len(parts), 190, 255]]]), cv2.COLOR_HSV2BGR)[0, 0])
        for pp in p["paths"]:
            cv2.fillPoly(vis, [np.array([[R / 2 + x * sc, R / 2 + y * sc] for x, y in pp["v"]], np.int32)], col)
        cv2.polylines(vis, [np.array([[R / 2 + x * sc, R / 2 + y * sc] for x, y in p["stroke"]["v"]], np.int32)], False, (255, 255, 255), 2)
        c0 = p["stroke"]["v"][0]; cv2.putText(vis, str(i + 1), (int(R / 2 + c0[0] * sc), int(R / 2 + c0[1] * sc)), 0, 0.6, (255, 255, 255), 2)
    cv2.imwrite(str(ROOT / "research/mcp/logo_parts.png"), vis)
    print(f"{len(parts)} parts: " + ", ".join(collections.Counter(p['kind'] for p in parts).__repr__()[8:-1].split(", ")))


if __name__ == "__main__":
    args = [a for a in sys.argv[1:] if not a.startswith("--")]
    rad = int(sys.argv[sys.argv.index("--radius") + 1]) if "--radius" in sys.argv else 14
    main(args[0] if args else str(ROOT / "assets/brand/motion_dna_mark.json"), rad)
