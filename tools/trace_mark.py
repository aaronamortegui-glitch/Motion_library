"""Trace a flat-colour mark (a logo printed on a prop, a sketch) from an image into a clean vector: colour key → mask →
smoothed contours (holes kept) → SVG path + transparent PNG renders. Used to turn the helix-arrow printed on the Motion DNA
box (media/motion_dna_promo/sheets/props.png) into the project's logo.
  python tools/trace_mark.py image.png out_basename --crop x,y,w,h [--key "#7CE36A"] [--tol 70] [--color "#D8FF85"]
         [--scale 4] [--smooth 2.5] [--png 1024]
Writes out_basename.svg (one path, fill --color) and out_basename_<png>.png.
"""
import argparse

import cv2
import numpy as np


def hex_bgr(h):
    h = h.lstrip("#"); return np.array([int(h[4:6], 16), int(h[2:4], 16), int(h[0:2], 16)], np.float32)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("image"); ap.add_argument("out")
    ap.add_argument("--crop", required=True); ap.add_argument("--key", default="#7CE36A"); ap.add_argument("--tol", type=float, default=70)
    ap.add_argument("--color", default="#D8FF85"); ap.add_argument("--scale", type=int, default=4)
    ap.add_argument("--smooth", type=float, default=2.5); ap.add_argument("--png", type=int, default=1024)
    a = ap.parse_args()
    x, y, w, h = map(int, a.crop.split(","))
    img = cv2.imread(a.image)[y:y + h, x:x + w]
    img = cv2.resize(img, (w * a.scale, h * a.scale), interpolation=cv2.INTER_CUBIC)
    dist = np.linalg.norm(img.astype(np.float32) - hex_bgr(a.key), axis=2)
    mask = (dist < a.tol).astype(np.uint8) * 255
    mask = cv2.GaussianBlur(mask, (0, 0), a.smooth * a.scale)            # soften print grain and jpeg edges
    mask = (mask > 127).astype(np.uint8) * 255
    mask = cv2.morphologyEx(mask, cv2.MORPH_OPEN, np.ones((3 * a.scale, 3 * a.scale), np.uint8))
    n, lab, st, _ = cv2.connectedComponentsWithStats(mask)               # drop specks (stray green pixels)
    keep = np.zeros_like(mask)
    for i in range(1, n):
        if st[i, cv2.CC_STAT_AREA] > 0.002 * mask.size:
            keep[lab == i] = 255
    cnts, hier = cv2.findContours(keep, cv2.RETR_CCOMP, cv2.CHAIN_APPROX_NONE)
    ys, xs = np.nonzero(keep); x0, y0, x1, y1 = xs.min(), ys.min(), xs.max(), ys.max()
    pad = int(0.04 * max(x1 - x0, y1 - y0)); vw, vh = x1 - x0 + 2 * pad, y1 - y0 + 2 * pad
    d = []
    for c in cnts:
        c = cv2.approxPolyDP(c, 0.6 * a.scale, True).reshape(-1, 2)
        if len(c) < 3:
            continue
        pts = [(px - x0 + pad, py - y0 + pad) for px, py in c]
        d.append("M" + " L".join(f"{px:.1f},{py:.1f}" for px, py in pts) + " Z")
    svg = (f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {vw} {vh}" width="{vw}" height="{vh}">'
           f'<path fill="{a.color}" fill-rule="evenodd" d="{" ".join(d)}"/></svg>\n')
    open(a.out + ".svg", "w", encoding="utf-8").write(svg)
    crop = keep[y0 - pad:y1 + pad, x0 - pad:x1 + pad] if y0 >= pad and x0 >= pad else keep[y0:y1, x0:x1]
    k = a.png / max(crop.shape); sz = (int(crop.shape[1] * k), int(crop.shape[0] * k))
    alpha = cv2.resize(crop, sz, interpolation=cv2.INTER_AREA)
    col = hex_bgr(a.color).astype(np.uint8)
    rgba = np.dstack([np.full(alpha.shape, col[0]), np.full(alpha.shape, col[1]), np.full(alpha.shape, col[2]), alpha]).astype(np.uint8)
    cv2.imwrite(f"{a.out}_{a.png}.png", rgba)
    print(f"mark: {len(d)} paths, viewBox {vw}x{vh} -> {a.out}.svg, {a.out}_{a.png}.png")


if __name__ == "__main__":
    main()
