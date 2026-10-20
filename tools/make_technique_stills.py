"""Thumbnails for the Techniques category (panel and visualizer): the technique in action, taken from the Motion DNA
teaser (fictional characters: Dana, Rex, the robot, the chimp and the car) or built from its plates where the teaser
doesn't show it, in library/techniques/<slug>.png (480x270), <slug>_md.png (224x126, panel grid) and <slug>_sm.png
(112x63, favorites).
  python tools/make_technique_stills.py
Needs the latest teaser render at renders/MotionDNA_Teaser.mp4 (git-ignored: copy it from the teaser's RENDER folder)
and, for the built artworks, the teaser's plates, mattes and character sheets (MDNA_TEASER_DIR, default below).
A technique whose sources are missing keeps its current image.
"""
import json
import os
import pathlib
import re
import subprocess

ROOT = pathlib.Path(__file__).resolve().parent.parent
OUT = ROOT / "library" / "techniques"
FIT = "scale={w}:{h}:force_original_aspect_ratio=increase,crop={w}:{h}"
W, H = 480, 270
PINE, SEA, SPARK, CLOUD, CORAL = (10, 33, 31), (23, 74, 69), (216, 255, 133), (247, 249, 242), (255, 148, 148)

TEASER = "renders/MotionDNA_Teaser.mp4"
TDIR = pathlib.Path(os.environ.get("MDNA_TEASER_DIR", ROOT.parent / "Motion_DNA_Plugin_MCP"))   # the teaser project, next to this clone
PLATES = TDIR / "overlay/media/motion_dna_teaser/video"
SHEETS = TDIR / "handoff_v12_update_prompts/data/generation/flora_images"

# technique name -> (source file, time in s or None for stills, optional crop "w:h:x:y" in source pixels): a teaser frame
SOURCES = {
    "Tracked labels": (TEASER, 62.4, "844:475:460:78"),   # the agent-built spot in AE: AEROSPACE EXTERIOR riding on the car
    "Text behind people": (TEASER, 89.4, None),           # YES behind Dana and the animator
    "HUD overlays": (TEASER, 75.4, None),                 # command chips floating around the robot's screen
    "Freeze frame + kinetic type": (TEASER, 7.5, None),   # EVERY. SINGLE. TIME. over Dana's close-up
    "Styles": (TEASER, 86.0, None),                       # the "Make it pop" spot the agent built: the chimp at the wheel
    "Cut on the voice": (TEASER, 17.0, None),             # MOVES. on Rex's word
}


def slug(s):
    return re.sub(r"[^a-z0-9]+", "-", s.lower()).strip("-")


def frame(src, t, crop, out):
    vf = (f"crop={crop}," if crop else "") + FIT.format(w=480, h=270)
    args = ["ffmpeg", "-v", "error", "-y"] + (["-ss", str(t)] if t is not None else []) + ["-i", str(ROOT / src), "-frames:v", "1", "-vf", vf, str(out)]
    return subprocess.run(args, capture_output=True).returncode == 0


def grab(src, t, size=(W, H), crop=None):
    """One frame of a video as a PIL image (cover-fit to size)."""
    from PIL import Image
    import io
    vf = (f"crop={crop}," if crop else "") + FIT.format(w=size[0], h=size[1])
    r = subprocess.run(["ffmpeg", "-v", "error", "-ss", str(t), "-i", str(src), "-frames:v", "1", "-vf", vf, "-f", "image2pipe",
                        "-vcodec", "png", "-"], capture_output=True)
    return Image.open(io.BytesIO(r.stdout)).convert("RGB") if r.returncode == 0 and r.stdout else None


def font(px, weight="Bold"):
    from PIL import ImageFont
    return ImageFont.truetype(str(ROOT / f"assets/fonts/static/InterTight-{weight}.ttf"), px)


def chip(d, xy, text, fg=PINE, bg=SPARK, px=11):
    f = font(px); x, y = xy
    w = d.textlength(text, font=f)
    d.rounded_rectangle([x, y, x + w + 12, y + px + 9], radius=4, fill=bg)
    d.text((x + 6, y + 3), text, font=f, fill=fg)


def roto_breakdown(out):
    """Plate · matte · contour · composite of the YES shot, as a 2x2 grid."""
    from PIL import Image, ImageDraw, ImageFilter
    import numpy as np
    import cv2
    plate, matte = PLATES / "A_yes_k3_v14b_cut.mp4", PLATES / "A_yes_k3_v14b_matte.mov"
    if not (plate.exists() and matte.exists()):
        return False
    t, cw, ch = 1.2, W // 2, H // 2
    pl = grab(plate, t, (cw, ch))
    r = subprocess.run(["ffmpeg", "-v", "error", "-ss", str(t), "-i", str(matte), "-frames:v", "1", "-vf",
                        f"scale={cw}:{ch},format=yuva444p,alphaextract", "-f", "rawvideo", "-pix_fmt", "gray", "-"], capture_output=True)
    if pl is None or len(r.stdout) != cw * ch:
        return False
    a = np.frombuffer(r.stdout, np.uint8).reshape(ch, cw)
    alpha = Image.fromarray(a)
    contour = Image.new("RGB", (cw, ch), PINE)
    cs, _ = cv2.findContours((a > 127).astype(np.uint8), cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_NONE)
    dc = ImageDraw.Draw(contour)
    for c in sorted(cs, key=cv2.contourArea, reverse=True)[:2]:
        dc.line([tuple(p[0]) for p in c] + [tuple(c[0][0])], fill=SPARK, width=2)
    comp = pl.copy(); dcomp = ImageDraw.Draw(comp)
    word = "YES!"; f = font(70, "ExtraBold"); tw = dcomp.textlength(word, font=f)
    dcomp.text(((cw - tw) / 2, 20), word, font=f, fill=SPARK)
    comp.paste(pl, (0, 0), alpha.filter(ImageFilter.GaussianBlur(0.6)))   # the people back in front of the word
    sheet = Image.new("RGB", (W, H), PINE)
    for i, (im, label) in enumerate([(pl, "PLATE"), (alpha.convert("RGB"), "MATTE"), (contour, "CONTOUR"), (comp, "COMPOSITE")]):
        x, y = (i % 2) * cw, (i // 2) * ch
        sheet.paste(im, (x, y)); chip(ImageDraw.Draw(sheet), (x + 6, y + 6), label, px=9)
    d = ImageDraw.Draw(sheet)
    d.line([(cw, 0), (cw, H)], fill=PINE, width=2); d.line([(0, ch), (W, ch)], fill=PINE, width=2)
    sheet.save(out); return True


def speed_ramp(out):
    """The car's lift-off at three speeds, with the ramp drawn under it."""
    from PIL import Image, ImageDraw
    src = ROOT / TEASER
    if not src.exists():
        return False
    im = Image.new("RGB", (W, H), PINE); d = ImageDraw.Draw(im)
    for i, (t, sp) in enumerate([(81.1, "1×"), (81.8, "0.25×"), (82.8, "2×")]):
        fr = grab(src, t, (156, 176))
        if fr is None:
            return False
        x = 6 + i * 158
        im.paste(fr, (x, 6)); chip(d, (x + 6, 12), sp, px=12)
    # the ramp: speed over time, slow in the middle (the slow-mo), fast out of it
    pts, x0, x1, top, bot = [], 14, W - 14, 196, 258
    for k in range(101):
        u = k / 100
        v = 0.55 if u < 0.3 else (0.12 if u < 0.62 else 0.95) if not (0.25 < u < 0.35 or 0.57 < u < 0.67) else None
        if v is None:   # ease between the plateaus
            if u <= 0.35:
                s = (u - 0.25) / 0.10; v = 0.55 + (0.12 - 0.55) * (3 * s * s - 2 * s ** 3)
            else:
                s = (u - 0.57) / 0.10; v = 0.12 + (0.95 - 0.12) * (3 * s * s - 2 * s ** 3)
        pts.append((x0 + u * (x1 - x0), bot - v * (bot - top)))
    d.line([(x0, bot), (x1, bot)], fill=SEA, width=1)
    d.line(pts, fill=SPARK, width=3)
    d.text((x0, top - 8), "SPEED", font=font(9), fill=CLOUD)
    im.save(out); return True


def marker_timing(out):
    """Rex's shot over a timeline: the layer bar with its SS in / SS out markers and the playhead."""
    from PIL import Image, ImageDraw
    src = ROOT / TEASER
    fr = grab(src, 72.6, (W, 170)) if src.exists() else None
    if fr is None:
        return False
    im = Image.new("RGB", (W, H), (30, 32, 31)); im.paste(fr, (0, 0)); d = ImageDraw.Draw(im)
    f = font(9, "Medium")
    for i in range(0, 9):   # time ruler
        x = 20 + i * 55; d.line([(x, 176), (x, 182)], fill=(110, 118, 114)); d.text((x + 2, 174), f"{i}s", font=f, fill=(140, 148, 144))
    d.rounded_rectangle([20, 200, 440, 220], radius=3, fill=SEA)          # the layer
    d.text((26, 204), "Rex · Make it pop", font=f, fill=CLOUD)
    for x, label in [(130, "SS in"), (360, "SS out")]:                  # the markers Motion DNA adds
        d.polygon([(x - 5, 226), (x + 5, 226), (x, 234)], fill=SPARK)
        d.line([(x, 196), (x, 226)], fill=SPARK, width=2)
        chip(d, (x - 18, 240), label, px=10)
    d.line([(250, 172), (250, 262)], fill=CORAL, width=2)                 # playhead
    d.polygon([(245, 172), (255, 172), (250, 179)], fill=CORAL)
    im.save(out); return True


def face_refine(out):
    """Face refinement: the character's reference sheet next to the same face in the clip."""
    from PIL import Image, ImageDraw
    sheet, src = SHEETS / "n21_Expression_Sheet.png", ROOT / TEASER
    if not (sheet.exists() and src.exists()):
        return False
    ref = Image.open(sheet).convert("RGB").crop((2300, 140, 3200, 1152)).resize((240, 270))
    clip = grab(src, 21.3, (240, 270), crop="600:675:600:50")
    if clip is None:
        return False
    im = Image.new("RGB", (W, H), PINE); im.paste(ref, (0, 0)); im.paste(clip, (240, 0)); d = ImageDraw.Draw(im)
    d.line([(240, 0), (240, H)], fill=SPARK, width=2)
    chip(d, (8, 248), "REFERENCE", px=10); chip(d, (248, 248), "IN THE CLIP", px=10)
    im.save(out); return True


def shape_wipe(out):
    """Mid-wipe: Dana's office leaves under diagonal Spark and Sea bars, the car spot arrives."""
    from PIL import Image, ImageDraw
    src = ROOT / TEASER
    a, b = (grab(src, 3.0), grab(src, 81.4)) if src.exists() else (None, None)
    if a is None or b is None:
        return False
    mask = Image.new("L", (W, H), 0); dm = ImageDraw.Draw(mask)
    dm.polygon([(250, 0), (W, 0), (W, H), (150, H)], fill=255)          # the new shot behind the bars
    im = Image.composite(b, a, mask); d = ImageDraw.Draw(im)
    for off, col in [(0, SEA), (34, SPARK), (62, PINE)]:                  # the bars travelling with the cut
        x = 214 + off
        d.polygon([(x, 0), (x + 30, 0), (x - 70, H), (x - 100, H)], fill=col)
    im.save(out); return True


def stroke_build(out):
    """The Motion DNA mark building itself, stroke by stroke (docs/examples/logo_end_card.jpg)."""
    from PIL import Image
    src = ROOT / "docs/examples/logo_end_card.jpg"
    if not src.exists():
        return False
    strip = Image.open(src).convert("RGB")                               # 1400x250: six stages of the build
    im = Image.new("RGB", (W, H), PINE)
    for i, k in enumerate([1, 3, 5]):                                    # three stages: first strokes → mark → lockup
        st = strip.crop((k * 200, 0, k * 200 + 200, 250)).resize((150, 188))
        im.paste(st, (15 + i * 152, 41))
    im.save(out); return True


ART = {"Roto breakdown": roto_breakdown, "Speed ramps": speed_ramp, "Marker timing": marker_timing,
       "Face refinement": face_refine, "Shape-wipe transitions": shape_wipe, "Stroke build": stroke_build}


def main():
    OUT.mkdir(parents=True, exist_ok=True)
    techs = json.load(open(ROOT / "library/techniques.json", encoding="utf-8"))
    made = []
    for t in techs["techniques"]:
        out = OUT / f"{slug(t['name'])}.png"
        if t["name"] in SOURCES:
            ok = (ROOT / SOURCES[t["name"]][0]).exists() and frame(*SOURCES[t["name"]], out)
        elif t["name"] in ART:
            ok = ART[t["name"]](out)
        else:
            ok = False
        if ok:
            subprocess.run(["ffmpeg", "-v", "error", "-y", "-i", str(out), "-vf", "scale=224:126", str(OUT / f"{slug(t['name'])}_md.png")])
            subprocess.run(["ffmpeg", "-v", "error", "-y", "-i", str(out), "-vf", "scale=112:63", str(OUT / f"{slug(t['name'])}_sm.png")])
            t["image"] = f"techniques/{slug(t['name'])}.png"
            made.append(t["name"])
    (ROOT / "library/techniques.json").write_text(json.dumps(techs, indent=1, ensure_ascii=False) + "\n", encoding="utf-8")
    print(f"technique stills: {len(made)}/{len(techs['techniques'])} ->", ", ".join(made))


if __name__ == "__main__":
    main()
