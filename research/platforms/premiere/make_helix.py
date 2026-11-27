#!/usr/bin/env python3
"""Draw the Motion DNA panel helix as PNGs for the Premiere panel (UXP has no dependable <canvas>).

Same drawing as the After Effects panel (panel/js/app.js helixDraw): rungs in #9FD8C2, front strand #D8FF85, back
strand #9FD8C2, dots sized and faded by depth. Writes plugin/icons/helix_mark.png (the still header mark, 22 px at 2x,
tilted -0.72 rad like the AE header) and plugin/icons/helix/00..23.png (the spinning loading mark, 14 px at 2x).

Usage: python research/platforms/premiere/make_helix.py
"""
import math
import pathlib

from PIL import Image, ImageDraw

HERE = pathlib.Path(__file__).resolve().parent
SPARK, MINT = (0xD8, 0xFF, 0x85), (0x9F, 0xD8, 0xC2)


def draw(S, ph, tilt, scale=4):
    """One frame, S px (logical), supersampled then reduced; returns RGBA at S*2 px (for 2x screens)."""
    big = S * 2 * scale
    im = Image.new("RGBA", (big, big), (0, 0, 0, 0))
    g = ImageDraw.Draw(im, "RGBA")
    k = big / S   # logical px -> image px
    c, s = math.cos(tilt), math.sin(tilt)
    rot = lambda x, y: (big / 2 + (x * c - y * s) * k, big / 2 + (x * s + y * c) * k)
    n = 5 if S < 20 else 6
    pts = []
    for i in range(n):
        x = (-0.84 + 1.68 * i / (n - 1)) * S / 2
        a = ph + i * 0.75
        y, z = math.sin(a) * S * 0.2, math.cos(a)
        g.line([rot(x, y), rot(x, -y)], fill=MINT + (int(255 * 0.28),), width=max(1, int(0.8 * k)))
        pts += [(x, y, z, SPARK), (x, -y, -z, MINT)]
    r = S / 22
    for x, y, z, col in sorted(pts, key=lambda p: p[2]):
        alpha = 0.5 + 0.5 * (z + 1) / 2
        rad = (1.1 + 0.9 * (z + 1) / 2) * r * k
        cx, cy = rot(x, y)
        g.ellipse([cx - rad, cy - rad, cx + rad, cy + rad], fill=col + (int(255 * alpha),))
    return im.resize((S * 2, S * 2), Image.LANCZOS)


def main():
    icons = HERE / "plugin" / "icons"
    (icons / "helix").mkdir(parents=True, exist_ok=True)
    draw(22, 0.6, -0.72).save(icons / "helix_mark.png")
    for i in range(24):
        draw(14, i / 24 * math.pi * 2, 0).save(icons / "helix" / f"{i:02d}.png")
    print("helix_mark.png + 24 loading frames")


if __name__ == "__main__":
    main()
