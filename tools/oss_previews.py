"""Previews for the kit pieces made with open-source engines (kinds webfx, spring, physics, gltransition in
library/kit.json), without After Effects: each one is drawn by the same engine its MCP tool uses. Writes
library/gifs/kit-<kind>/<slug>.gif (240x135, 80 ms a frame, like tools/kit_gifs.py) and <slug>_md.png (480x270).

Usage: python tools/oss_previews.py [kind ...]   (default: all four; NAMES="a,b" limits it to some pieces)
"""
import io, json, math, os, pathlib, re, subprocess, sys, tempfile
from PIL import Image, ImageDraw, ImageFont

ROOT = pathlib.Path(__file__).resolve().parent.parent; sys.path.insert(0, str(ROOT / "tools"))
PINE, SEA, SPARK, CLOUD, MINT, CORAL, INK = "#0A211F", "#174A46", "#D8FF85", "#F7F9F2", "#9FD8C2", "#FF8A6B", "#04120F"
W, H, N = 960, 540, 30
STILLS = ROOT / "library/packs/stills"


def still(name, dim=.45, blur=0):
    """A tutorial still as the ground of an effect (the effects are After Effects assets: they sit over footage)."""
    from PIL import ImageFilter
    im = Image.open(STILLS / name).convert("RGB").resize((W, H), Image.LANCZOS)
    if blur: im = im.filter(ImageFilter.GaussianBlur(blur))
    return Image.blend(im, Image.new("RGB", (W, H), PINE), dim)
FONT = str(ROOT / "assets/fonts/InterTight[wght].ttf")


def slug(s): return re.sub(r"^-|-$", "", re.sub(r"[^a-z0-9]+", "-", s.lower().replace("__", "-")))   # as panel/js/app.js
def font(px):
    f = ImageFont.truetype(FONT, px)
    try: f.set_variation_by_axes([760])
    except Exception: pass
    return f


def save(kind, name, frames, key=None, colors=64):
    out = ROOT / "library/gifs" / f"kit-{kind}"; out.mkdir(parents=True, exist_ok=True); s = slug(name)
    (frames[key if key is not None else len(frames) * 2 // 3]).resize((480, 270), Image.LANCZOS).save(out / f"{s}_md.png")
    poster = ROOT / "library/posters" / f"kit-{kind}"; poster.mkdir(parents=True, exist_ok=True)
    (frames[key if key is not None else len(frames) * 2 // 3]).resize((480, 270), Image.LANCZOS).save(poster / f"{s}.jpg", quality=84)
    webm = ROOT / "library/webm" / f"kit-{kind}"; webm.mkdir(parents=True, exist_ok=True)   # the guide plays this one
    raw = b"".join(f.convert("RGB").resize((W, H)).tobytes() for f in frames)
    subprocess.run(["ffmpeg", "-v", "error", "-y", "-f", "rawvideo", "-pix_fmt", "rgb24", "-s", f"{W}x{H}", "-r", "12.5", "-i", "-",
                    "-vf", "scale=640:-2", "-c:v", "libvpx-vp9", "-b:v", "0", "-crf", "34", "-pix_fmt", "yuv420p", str(webm / f"{s}.webm")], input=raw, check=True)
    small = [f.resize((240, 135), Image.LANCZOS).convert("P", palette=Image.ADAPTIVE, colors=colors) for f in frames]
    small[0].save(out / f"{s}.gif", save_all=True, append_images=small[1:], duration=80, loop=0, optimize=True, disposal=1)
    print(f"kit-{kind}/{s}.gif ({len(frames)} frames)")


def card(text, bg, fg, size=(W, H), px=46):
    im = Image.new("RGB", size, bg); d = ImageDraw.Draw(im); f = font(px)
    d.text((size[0] / 2, size[1] / 2), text, font=f, fill=fg, anchor="mm"); return im


# ---------------------------------------------------------------- fx: the web FX pages, over pine
GROUND = {"confetti": "playful.jpg", "fireworks": "elegant.jpg", "sparks": "dynamic.jpg", "helix3d": None, "drop3d": None, "flowfield": None, "gradient": None}


def fx_frames(page, opts, dur):
    import web_capture
    mov = web_capture.capture(page, opts, 960, 540, 12.5, dur, page != "gradient", warmup={"fireworks": 0.8, "flowfield": 2.0}.get(page, 0))
    with tempfile.TemporaryDirectory() as tmp:
        subprocess.run(["ffmpeg", "-v", "error", "-i", mov, "-vf", f"scale={W}:{H}", os.path.join(tmp, "f%03d.png")], check=True)
        out = []
        for f in sorted(os.listdir(tmp)):
            g = GROUND.get(page); bg = (still(g, .5) if g else Image.new("RGB", (W, H), PINE)).convert("RGBA")
            im = Image.open(os.path.join(tmp, f)).convert("RGBA"); bg.alpha_composite(im); out.append(bg.convert("RGB"))
    return out


def scribble_frames():   # the annotation around a word, as it is used
    base = still("modern.jpg", .55, 3); ImageDraw.Draw(base).text((480, 270), "Motion DNA", font=font(92), fill=CLOUD, anchor="mm")
    import web_capture
    x0, y0, x1, y1 = ImageDraw.Draw(base).textbbox((480, 270), "Motion DNA", font=font(92), anchor="mm")   # around the word, measured
    mov = web_capture.capture("scribble", {"box": [x0, y0, x1 - x0, y1 - y0], "width": 10}, 960, 540, 12.5, 2.4)
    with tempfile.TemporaryDirectory() as tmp:
        subprocess.run(["ffmpeg", "-v", "error", "-i", mov, os.path.join(tmp, "f%03d.png")], check=True)
        out = []
        for f in sorted(os.listdir(tmp)):
            im = base.convert("RGBA"); im.alpha_composite(Image.open(os.path.join(tmp, f)).convert("RGBA").resize((W, H))); out.append(im.convert("RGB"))
    return out


def do_fx(pick):
    for f in json.loads((ROOT / "library/web_fx.json").read_text(encoding="utf-8"))["fx"]:
        if pick(f["name"]):
            frames = scribble_frames() if f["page"] == "scribble" else fx_frames(f["page"], {}, 2.4)
            save("webfx", f["name"], frames, {"confetti cannons": 8, "sparks": 6, "particle fireworks": 22}.get(f["name"]),
                 24 if f["page"] in ("flowfield", "gradient") else 64)   # grainy pictures: fewer colours keep the GIF light


# ---------------------------------------------------------------- spring: a card moving on the curve
def do_spring(pick):
    for c in json.loads((ROOT / "library/springs.json").read_text(encoding="utf-8"))["curves"]:
        if not pick(c["name"]): continue
        s = c["samples"]; n = len(s) - 1; frames = []
        for i in range(N):
            p = min(1, max(0, (i - 3) / 22)); v = s[round(p * n)]
            im = Image.new("RGB", (W, H), PINE); d = ImageDraw.Draw(im)
            d.line([(60, 205), (420, 205)], fill=SEA, width=2); d.ellipse([414, 199, 426, 211], outline=MINT, width=2)   # rest point
            for k in range(0, n + 1, 3):   # the curve itself, faint, as it unfolds
                x = 60 + 360 * k / n; y = 150 - 95 * s[k]
                if k / n <= p: d.ellipse([x - 1.5, y - 1.5, x + 1.5, y + 1.5], fill=SEA)
            x = 60 + 360 * v; d.rounded_rectangle([x - 46, 180, x + 46, 230], 12, fill=SPARK)
            d.text((x, 205), "move", font=font(20), fill=PINE, anchor="mm")
            d.text((24, 22), c["name"], font=font(18), fill=MINT)
            frames.append(im)
        save("spring", c["name"], frames, 14)


# ---------------------------------------------------------------- physics: six cards, baked by matter.js
def do_physics(pick):
    import physics_bake
    layers = [{"id": str(i), "cx": 420 + i * 220, "cy": 380 + (i % 2) * 90, "w": 300 if i % 3 else 380, "h": 210, "circle": False} for i in range(6)]
    tiles = ["calm-modern.jpg", "dynamic.jpg", "playful.jpg", "editorial.jpg", "storybook.jpg", "tech.jpg"]
    for name, mode in (("fall", "fall"), ("drop in", "drop_in"), ("burst", "burst")):
        if not pick(name): continue
        paths = physics_bake.simulate(physics_bake.spec_for(layers, {"w": 1920, "h": 1080, "fps": 12.5}, mode, 2.4))
        frames = []; ground = still("modern.jpg", .62, 6); k = W / 1920
        def tile(t, l):
            w, h = int(l["w"] * k), int(l["h"] * k); im = Image.open(STILLS / t).convert("RGBA").resize((w, h), Image.LANCZOS)
            m = Image.new("L", (w, h), 0); ImageDraw.Draw(m).rounded_rectangle([0, 0, w - 1, h - 1], 10 if not l["circle"] else w // 2, fill=255); im.putalpha(m); return im
        T = [tile(t, l) for t, l in zip(tiles, layers)]
        for f in range(N):
            im = ground.convert("RGBA")
            for l, tl in zip(layers, T):
                x, y, a = paths[l["id"]][min(f, len(paths[l["id"]]) - 1)]
                r = tl.rotate(-math.degrees(a), expand=True, resample=Image.BICUBIC); im.alpha_composite(r, (int(x * k - r.width / 2), int(y * k - r.height / 2)))
            frames.append(im.convert("RGB"))
        save("physics", name, frames, {"fall": 24, "drop in": 26, "burst": 9}[name])


# ---------------------------------------------------------------- gltransition: shot A to shot B through the matte
def do_gl(pick):
    import base64, gl_matte
    from playwright.sync_api import sync_playwright
    # every clean matte (kind wipe or soft) the MCP tool gl_transition can play: the 73 of library/gl_transitions.json
    names = [t["name"] for t in json.loads((ROOT / "library/gl_transitions.json").read_text(encoding="utf-8"))["transitions"] if t["kind"] in ("wipe", "soft") and pick(t["name"])]
    if not names: return
    def scene(st, word, col):
        im = still(st, .35); ImageDraw.Draw(im).text((W / 2, H / 2), word, font=font(140), fill=col, anchor="mm"); return im
    A, B = scene("tech.jpg", "MOTION", CLOUD), scene("elegant.jpg", "DNA", SPARK); ease = gl_matte._ease("Cruise")
    prog = [0] * 5 + [ease(i / 19) for i in range(20)] + [1] * 5
    with sync_playwright() as p:
        b, pg = gl_matte._page(p)
        for n in names:
            urls = pg.evaluate("a => MATTE(a[0], a[1], a[2], a[3])", [n, W, H, prog])
            frames = [Image.composite(B, A, Image.open(io.BytesIO(base64.b64decode(u.split(",", 1)[1]))).convert("L")) for u in urls]
            save("gltransition", n, frames, 11)   # the poster mid-transition: both rooms show
        b.close()


if __name__ == "__main__":
    only = {x.strip() for x in os.environ.get("NAMES", "").split(",") if x.strip()}
    pick = (lambda n: n in only) if only else (lambda n: True)
    kinds = sys.argv[1:] or ["webfx", "spring", "physics", "gltransition"]
    for k in kinds: {"webfx": do_fx, "spring": do_spring, "physics": do_physics, "gltransition": do_gl}[k](pick)
