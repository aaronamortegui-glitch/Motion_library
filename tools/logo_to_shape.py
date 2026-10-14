"""Cleans a traced, straight-segment SVG logo (one path, M/L/Z) into smooth vector curves without changing its design:
each outline is resampled evenly, smoothed along the contour (real corners such as arrow tips and flat cuts are pinned),
simplified (Ramer-Douglas-Peucker) and fitted with Catmull-Rom tangents.

Writes: <out>.json (AE shape: paths of vertices + in/out tangents, centred), <out>.svg (clean cubic beziers, even-odd)
and <out>_1024.png (preview).
Usage: python tools/logo_to_shape.py <traced.svg> <out basename> [smoothing=7] [epsilon=0.8]
  Motion DNA mark: python tools/logo_to_shape.py assets/brand/motion_dna_mark_traced.svg assets/brand/motion_dna_mark 11 0.6
  e.g. python tools/logo_to_shape.py research/mcp/mark_original.svg assets/brand/motion_dna_mark
"""
import json
import math
import pathlib
import re
import sys


def resample(pts, step):
    out, n = [], len(pts)
    for i in range(n):
        a, b = pts[i], pts[(i + 1) % n]
        L = math.hypot(b[0] - a[0], b[1] - a[1]); k = max(1, int(L / step))
        out += [(a[0] + (b[0] - a[0]) * j / k, a[1] + (b[1] - a[1]) * j / k) for j in range(k)]
    return out


def turn(pts, i, w):
    n = len(pts); a, p, b = pts[(i - w) % n], pts[i], pts[(i + w) % n]
    t = math.degrees(math.atan2(b[1] - p[1], b[0] - p[0]) - math.atan2(p[1] - a[1], p[0] - a[0]))
    return abs((t + 180) % 360 - 180)


def smooth(pts, sigma, corners):
    n, r = len(pts), int(sigma * 2.5)
    wts = [math.exp(-(k * k) / (2 * sigma * sigma)) for k in range(-r, r + 1)]
    out = []
    for i in range(n):
        # near a corner the window shrinks so the corner stays sharp
        d = min([min((i - c) % n, (c - i) % n) for c in corners] or [n])
        rr = min(r, d)
        if rr == 0: out.append(pts[i]); continue
        sx = sy = sw = 0.0
        for k in range(-rr, rr + 1):
            w = wts[k + r]; q = pts[(i + k) % n]; sx += q[0] * w; sy += q[1] * w; sw += w
        out.append((sx / sw, sy / sw))
    return out


def rdp(pts, eps):
    if len(pts) < 3: return pts
    a, b = pts[0], pts[-1]; dx, dy = b[0] - a[0], b[1] - a[1]; L = math.hypot(dx, dy) or 1e-9
    d = [abs(dy * p[0] - dx * p[1] + b[0] * a[1] - b[1] * a[0]) / L for p in pts[1:-1]]
    i = max(range(len(d)), key=d.__getitem__) + 1
    return rdp(pts[:i + 1], eps)[:-1] + rdp(pts[i:], eps) if d[i - 1] > eps else [a, b]


def fit(pts, cornerset):
    n, ti, to = len(pts), [], []
    for i in range(n):
        if i in cornerset: ti.append((0.0, 0.0)); to.append((0.0, 0.0)); continue
        a, p, b = pts[i - 1], pts[i], pts[(i + 1) % n]
        tx, ty = b[0] - a[0], b[1] - a[1]; tl = math.hypot(tx, ty) or 1
        la, lb = math.hypot(p[0] - a[0], p[1] - a[1]), math.hypot(b[0] - p[0], b[1] - p[1])
        ti.append((-tx / tl * la / 3, -ty / tl * la / 3)); to.append((tx / tl * lb / 3, ty / tl * lb / 3))
    return ti, to


def clean(sub, sigma, eps, step=2.0, corner_deg=38):
    pts = resample(sub, step)
    w = max(2, int(6 / step))
    # corners: local turning peaks above the threshold (measured on the raw outline, before smoothing)
    tv = [turn(pts, i, w) for i in range(len(pts))]
    corners = [i for i in range(len(pts)) if tv[i] > corner_deg and tv[i] >= max(tv[(i + k) % len(pts)] for k in range(-w * 2, w * 2 + 1))]
    sm = smooth(pts, sigma, corners)
    # simplify between corners (or the whole loop split in two), keeping corners as vertices
    anchors = sorted(set(corners)) or [0, len(sm) // 2]
    keep = []
    for j, c in enumerate(anchors):
        nx = anchors[(j + 1) % len(anchors)]
        seg = [sm[k % len(sm)] for k in range(c, (nx if nx > c else nx + len(sm)) + 1)]
        keep += rdp(seg, eps)[:-1]
    cornerpts = {sm[c] for c in corners}
    cs = {i for i, p in enumerate(keep) if p in cornerpts}
    ti, to = fit(keep, cs)
    return keep, ti, to


def main(src, dst, sigma=7.0, eps=0.8):
    s = pathlib.Path(src).read_text(encoding="utf-8")
    vb = [float(x) for x in re.search(r'viewBox="([^"]+)"', s).group(1).split()]
    d = re.search(r' d="([^"]+)"', s).group(1)
    cx, cy = vb[2] / 2, vb[3] / 2
    paths = []
    for sub in re.findall(r"M[^M]+", d):
        pts = [(float(a), float(b)) for a, b in re.findall(r"(-?[\d.]+),(-?[\d.]+)", sub)]
        if len(pts) > 1 and pts[0] == pts[-1]: pts = pts[:-1]
        v, ti, to = clean(pts, sigma, eps)
        paths.append({"v": [[round(x - cx, 2), round(y - cy, 2)] for x, y in v], "i": [[round(a, 2), round(b, 2)] for a, b in ti],
                      "o": [[round(a, 2), round(b, 2)] for a, b in to], "closed": True})
    base = pathlib.Path(dst)
    base.with_suffix(".json").write_text(json.dumps({"name": "Motion DNA mark", "note": "Cleaned from the traced mark by tools/logo_to_shape.py; centred; fill even-odd.",
                                                     "fill": "#D8FF85", "width": vb[2], "height": vb[3], "paths": paths}) + "\n", encoding="utf-8")

    def path_d(p):
        v, i, o = p["v"], p["i"], p["o"]; n = len(v); out = f"M{v[0][0]},{v[0][1]}"
        for k in range(1, n + 1):
            a, b = v[k - 1], v[k % n]
            out += f" C{round(a[0] + o[k - 1][0], 2)},{round(a[1] + o[k - 1][1], 2)} {round(b[0] + i[k % n][0], 2)},{round(b[1] + i[k % n][1], 2)} {b[0]},{b[1]}"
        return out + "Z"
    svg = (f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="{-cx} {-cy} {vb[2]} {vb[3]}" width="{vb[2]:.0f}" height="{vb[3]:.0f}">\n'
           f'<title>Motion DNA mark</title>\n<path fill="#D8FF85" fill-rule="evenodd" d="{" ".join(path_d(p) for p in paths)}"/>\n</svg>\n')
    base.with_suffix(".svg").write_text(svg, encoding="utf-8")
    from PIL import Image, ImageDraw
    S = 4096 / max(vb[2], vb[3]) * 0.94
    img = Image.new("L", (4096, 4096), 0); dr = ImageDraw.Draw(img)
    for idx, p in enumerate(paths):
        v, i, o = p["v"], p["i"], p["o"]; n = len(v); poly = []
        for k in range(n):
            a, b = v[k], v[(k + 1) % n]; p1 = (a[0] + o[k][0], a[1] + o[k][1]); p2 = (b[0] + i[(k + 1) % n][0], b[1] + i[(k + 1) % n][1])
            for st in range(10):
                u = st / 10; m = 1 - u
                poly.append((2048 + S * (m ** 3 * a[0] + 3 * m * m * u * p1[0] + 3 * m * u * u * p2[0] + u ** 3 * b[0]),
                             2048 + S * (m ** 3 * a[1] + 3 * m * m * u * p1[1] + 3 * m * u * u * p2[1] + u ** 3 * b[1])))
        layer = Image.new("L", img.size, 0); ImageDraw.Draw(layer).polygon(poly, fill=255)
        from PIL import ImageChops
        img = ImageChops.logical_xor(img.convert("1"), layer.convert("1")).convert("L")   # even-odd
    rgba = Image.new("RGBA", img.size, (216, 255, 133, 0)); rgba.putalpha(img)
    rgba.resize((1024, 1024), Image.LANCZOS).save(str(base) + "_1024.png")
    print(dst, [len(p["v"]) for p in paths])


if __name__ == "__main__":
    a = sys.argv
    main(a[1], a[2], float(a[3]) if len(a) > 3 else 7.0, float(a[4]) if len(a) > 4 else 0.8)
