"""Technique cards for the panel's Agent › Library: a clean card per technique (title + what it does), in the Motion DNA
colours and fonts, until each technique gets its own example clip.

  python tools/technique_cards.py        # library/techniques.json → library/techniques/<slug>_card.png (640x360)
"""
import json
import pathlib
import re

from PIL import Image, ImageDraw, ImageFont

ROOT = pathlib.Path(__file__).resolve().parent.parent
PINE, SEA, SPARK, CLOUD, MUTED = (10, 33, 31), (23, 74, 69), (216, 255, 133), (247, 249, 242), (140, 158, 150)
W, H, PAD = 640, 360, 44


def font(size, weight):
    f = ImageFont.truetype(str(ROOT / "assets/fonts/InterTight[wght].ttf"), size)
    try:
        f.set_variation_by_axes([weight])
    except (OSError, AttributeError):
        pass
    return f


def wrap(draw, text, f, width):
    words, lines, cur = text.split(), [], ""
    for w in words:
        t = (cur + " " + w).strip()
        if draw.textlength(t, font=f) <= width:
            cur = t
        else:
            lines.append(cur); cur = w
    return lines + ([cur] if cur else [])


def slug(s):
    return re.sub(r"[^a-z0-9]+", "-", s.lower()).strip("-")


def card(t, i, out):
    im = Image.new("RGB", (W, H), PINE)
    d = ImageDraw.Draw(im)
    # a quiet motif: the Coast curve in the corner, so every card reads as Motion DNA
    pts = [(W - 210 + 180 * x, H - 40 - 150 * y) for x, y in
           [(u, 3 * u * (1 - u) ** 2 * 0.28 + 3 * u * u * (1 - u) * 0.9 + u ** 3) for u in [k / 120 for k in range(121)]]]
    d.line(pts, fill=SEA, width=6, joint="curve")
    d.ellipse([pts[-1][0] - 7, pts[-1][1] - 7, pts[-1][0] + 7, pts[-1][1] + 7], fill=SPARK)
    d.text((PAD, PAD), f"TECHNIQUE {i:02d}", font=font(17, 700), fill=SPARK)
    y = PAD + 34
    for line in wrap(d, t["name"], font(50, 760), W - 2 * PAD)[:2]:
        d.text((PAD, y), line, font=font(50, 760), fill=CLOUD); y += 58
    y += 10
    what = re.sub(r"\s+", " ", t["what"]).strip()
    if len(wrap(d, what, font(23, 420), W - 2 * PAD - 120)) > 4:   # too long for the card: its first clause, never a cut sentence
        what = re.split(r"(?<=[a-z])[.:;]\s", what)[0].rstrip(".") + "."
    for line in wrap(d, what, font(23, 420), W - 2 * PAD - 120)[:4]:
        d.text((PAD, y), line, font=font(23, 420), fill=MUTED); y += 31
    im.save(out, optimize=True)


def main():
    techs = json.loads((ROOT / "library/techniques.json").read_text(encoding="utf-8"))["techniques"]
    for i, t in enumerate(techs, 1):
        out = ROOT / "library/techniques" / f"{slug(t['name'])}_card.png"
        card(t, i, out)
        print(out.relative_to(ROOT))


if __name__ == "__main__":
    main()
