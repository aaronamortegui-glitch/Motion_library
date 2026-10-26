"""Technique cards for the panel's Agent › Library and the library guide: each technique's own example still,
full-bleed, with its number and title on it (the design agreed on 26 Oct 2026, Figma motion-adn › 10 · Preview
proposals). The stills that are drawn rather than rendered are made here too:
  styles.png       four style scenes (library/packs/<slug>.png) in a 2×2 grid, each with its name
  stroke-build.png the robot head built stroke by stroke (neutral: our logo closes only Motion DNA's own videos)
  sound-pass.png   a tutorial still with its sound cues and a waveform
Usage: python tools/technique_cards.py   # library/techniques.json → library/techniques/<slug>.png (480x270, the still)
                                         #   and <slug>_card.png (640x360, the card)
"""
import json
import pathlib
import re

from PIL import Image, ImageDraw, ImageFilter, ImageFont

ROOT = pathlib.Path(__file__).resolve().parent.parent
TECH = ROOT / "library" / "techniques"
PINE, INK, SEA, SPARK, CLOUD, MINT, CORAL = (10, 33, 31), (4, 18, 15), (23, 74, 69), (216, 255, 133), (247, 249, 242), (159, 216, 194), (255, 149, 149)
W, H = 640, 360


def inter(size, weight):
    f = ImageFont.truetype(str(ROOT / "assets/fonts/InterTight[wght].ttf"), size)
    try:
        f.set_variation_by_axes([weight])
    except (OSError, AttributeError):
        pass
    return f


def serif(size):
    return ImageFont.truetype(str(ROOT / "assets/fonts/InstrumentSerif-Italic.ttf"), size)


def slug(s):
    return re.sub(r"[^a-z0-9]+", "-", s.lower()).strip("-")


def cover(im, w, h):
    im = im.convert("RGB"); k = max(w / im.width, h / im.height)
    im = im.resize((round(im.width * k), round(im.height * k)), Image.LANCZOS)
    x, y = (im.width - w) // 2, (im.height - h) // 2
    return im.crop((x, y, x + w, y + h))


def chip(d, xy, text, f, fg, bg, pad=(12, 6)):
    x, y = xy; tw = d.textlength(text, font=f); a, b = f.getbbox(text)[1], f.getbbox(text)[3]
    d.rounded_rectangle([x, y, x + tw + 2 * pad[0], y + (b - a) + 2 * pad[1]], radius=(b - a) / 2 + pad[1], fill=bg)
    d.text((x + pad[0], y + pad[1] - a), text, font=f, fill=fg)
    return x + tw + 2 * pad[0]


# ---------------------------------------------------------------- the drawn stills (960x540, saved at 480x270)
def still_styles():
    """Four style scenes from the library, each with its name, so the technique shows what a style does to a shot."""
    S = Image.new("RGB", (960, 540), INK); d = ImageDraw.Draw(S)
    for i, s in enumerate(("calm-modern", "dynamic", "tech", "playful")):
        p = ROOT / "library/packs" / f"{s}.png"
        if not p.exists(): continue
        x, y = (i % 2) * 482, (i // 2) * 272
        S.paste(cover(Image.open(p), 478, 268), (x, y))
    return S


def robot_lines(d, cx, cy, h, frac, color, width):
    """The robot's one-line version (assets/motion_dna/sample_robot.json), drawn up to frac of its parts."""
    D = json.loads((ROOT / "assets/motion_dna/sample_robot.json").read_text(encoding="utf-8")); k = h / D["height"]
    parts = D["line"]; n = max(1, round(len(parts) * frac))
    for P in parts[:n]:
        if "rect" in P:
            (x, y), (w, hh), r = P["rect"]["center"], P["rect"]["size"], P["rect"]["round"]
            d.rounded_rectangle([cx + (x - w / 2) * k, cy + (y - hh / 2) * k, cx + (x + w / 2) * k, cy + (y + hh / 2) * k], radius=r * k, outline=color, width=width)
        elif "ellipse" in P:
            (x, y), (w, hh) = P["ellipse"]["center"], P["ellipse"]["size"]
            d.ellipse([cx + (x - w / 2) * k, cy + (y - hh / 2) * k, cx + (x + w / 2) * k, cy + (y + hh / 2) * k], outline=color, width=width)
        else:
            v, o, i = P["path"]["v"], P["path"]["o"], P["path"]["i"]; pts = []
            for s in range(len(v) - 1):
                a0, a3 = v[s], v[s + 1]; a1 = [a0[0] + o[s][0], a0[1] + o[s][1]]; a2 = [a3[0] + i[s + 1][0], a3[1] + i[s + 1][1]]
                for u in range(13):
                    t = u / 12; m = 1 - t
                    pts.append((cx + k * (m ** 3 * a0[0] + 3 * m * m * t * a1[0] + 3 * m * t * t * a2[0] + t ** 3 * a3[0]),
                                cy + k * (m ** 3 * a0[1] + 3 * m * m * t * a1[1] + 3 * m * t * t * a2[1] + t ** 3 * a3[1])))
            d.line(pts, fill=color, width=width, joint="curve")
            for p in (pts[0], pts[-1]): d.ellipse([p[0] - width / 2, p[1] - width / 2, p[0] + width / 2, p[1] + width / 2], fill=color)


def still_stroke():
    """The robot head built stroke by stroke: three moments of the build, left to right."""
    S = Image.new("RGB", (960, 540), PINE); d = ImageDraw.Draw(S)
    for i, frac in enumerate((.3, .65, 1)):   # three moments of the build; the card's title sits below them
        robot_lines(d, 180 + i * 300, 215, 230, frac, SPARK if i == 2 else MINT, 9)
    return S


def still_sound():
    """A tutorial still, its sound cues as chips and a waveform: what the sound pass adds to a shot."""
    S = cover(Image.open(ROOT / "library/packs/stills/collage-b.jpg"), 960, 540); d = ImageDraw.Draw(S, "RGBA")
    import math
    for i in range(46):   # a waveform across the lower left
        a = 18 + 70 * abs(math.sin(i * .55) * math.cos(i * .21)); x = 60 + i * 9
        d.rounded_rectangle([x, 300 - a / 2, x + 5, 300 + a / 2], radius=2, fill=SPARK + (230,))
    f = inter(24, 700)
    for j, c in enumerate(("0.40 s · POP · DANA LAUGHS", "0.90 s · TICK · THE TITLE", "1.60 s · HIT")):
        w = d.textlength(c, font=f) + 30; chip(d, (900 - w, 60 + j * 62), c, f, SPARK, INK + (235,), (15, 10))
    return S


DRAWN = {"Styles": still_styles, "Stroke build": still_stroke, "Sound pass": still_sound}


# ---------------------------------------------------------------- the card
def card(t, i, src):
    """The example on top, whole; below it a solid band with the number and the title (nothing sits on the
    example: its own words and labels stay readable)."""
    BAND = 72; im = Image.new("RGB", (W, H), INK); src = Image.open(src).convert("RGB")
    back = cover(src, W, H - BAND).filter(ImageFilter.GaussianBlur(18)); back = Image.blend(back, Image.new("RGB", back.size, INK), .55)
    im.paste(back, (0, 0))   # the example whole (never cropped), its own blur filling the sides
    h = H - BAND; w = round(src.width * h / src.height); im.paste(src.resize((w, h), Image.LANCZOS), ((W - w) // 2, 0))
    d = ImageDraw.Draw(im)
    num = f"{i:02d}"; fn = serif(44); nw = d.textlength(num, font=fn) + 14
    size = 36
    while inter(size, 760).getlength(t["name"]) > W - 56 - nw and size > 22: size -= 2   # one line, shrunk to fit
    ft = inter(size, 760); a, b = ft.getbbox(t["name"])[1], ft.getbbox(t["name"])[3]; y = H - BAND / 2 - (a + b) / 2
    na, nb = fn.getbbox(num)[1], fn.getbbox(num)[3]
    d.text((28, H - BAND / 2 - (na + nb) / 2), num, font=fn, fill=SPARK)
    d.text((28 + nw, y), t["name"], font=ft, fill=CLOUD)
    return im


def main():
    techs = json.loads((ROOT / "library/techniques.json").read_text(encoding="utf-8"))["techniques"]
    for i, t in enumerate(techs, 1):
        s = slug(t["name"]); still = TECH / f"{s}.png"
        if t["name"] in DRAWN:
            DRAWN[t["name"]]().resize((480, 270), Image.LANCZOS).save(still, optimize=True)
        for suf, size in (("_md", (224, 126)), ("_sm", (112, 63))):   # the panel's grid and list stills
            cover(Image.open(still), *size).save(TECH / f"{s}{suf}.png", optimize=True)
        card(t, i, still).save(TECH / f"{s}_card.png", optimize=True)
        print(f"library/techniques/{s}_card.png")
    p = ROOT / "library/techniques.json"; txt = p.read_bytes().decode("utf-8")   # point drawn stills at their file, keeping the format
    txt2 = txt.replace('"image": "techniques/sound-pass_card.png"', '"image": "techniques/sound-pass.png"')
    if txt2 != txt: p.write_bytes(txt2.encode("utf-8"))


if __name__ == "__main__":
    main()
