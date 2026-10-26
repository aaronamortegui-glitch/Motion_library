"""Previews for the kit pieces made with open-source engines (kinds webfx, spring, physics, gltransition in
library/kit.json), without After Effects: each one is drawn by the same engine its MCP tool uses. Writes
library/gifs/kit-<kind>/<slug>.gif (240x135, 80 ms a frame, like tools/kit_gifs.py) and <slug>_md.png (480x270).

Usage: python tools/oss_previews.py [kind ...]   (default: all four; NAMES="a,b" limits it to some pieces)
"""
import io, json, math, os, pathlib, re, subprocess, sys, tempfile
from PIL import Image, ImageDraw, ImageFont

ROOT = pathlib.Path(__file__).resolve().parent.parent; sys.path.insert(0, str(ROOT / "tools"))
PINE, SEA, SPARK, CLOUD, MINT, CORAL, INK = "#0A211F", "#174A46", "#D8FF85", "#F7F9F2", "#9FD8C2", "#FF8A6B", "#04120F"
W, H, N = 480, 270, 30
FONT = str(ROOT / "assets/fonts/InterTight[wght].ttf")


def slug(s): return re.sub(r"^-|-$", "", re.sub(r"[^a-z0-9]+", "-", s.lower().replace("__", "-")))   # as panel/js/app.js
def font(px):
    f = ImageFont.truetype(FONT, px)
    try: f.set_variation_by_axes([760])
    except Exception: pass
    return f


def save(kind, name, frames, key=None, colors=64):
    out = ROOT / "library/gifs" / f"kit-{kind}"; out.mkdir(parents=True, exist_ok=True); s = slug(name)
    (frames[key if key is not None else len(frames) * 2 // 3]).save(out / f"{s}_md.png")
    small = [f.resize((240, 135), Image.LANCZOS).convert("P", palette=Image.ADAPTIVE, colors=colors) for f in frames]
    small[0].save(out / f"{s}.gif", save_all=True, append_images=small[1:], duration=80, loop=0, optimize=True, disposal=1)
    print(f"kit-{kind}/{s}.gif ({len(frames)} frames)")


def card(text, bg, fg, size=(W, H), px=46):
    im = Image.new("RGB", size, bg); d = ImageDraw.Draw(im); f = font(px)
    d.text((size[0] / 2, size[1] / 2), text, font=f, fill=fg, anchor="mm"); return im


# ---------------------------------------------------------------- fx: the web FX pages, over pine
def fx_frames(page, opts, dur):
    import web_capture
    mov = web_capture.capture(page, opts, 960, 540, 12.5, dur, page != "gradient", warmup={"fireworks": 0.8, "flowfield": 2.0}.get(page, 0))
    with tempfile.TemporaryDirectory() as tmp:
        subprocess.run(["ffmpeg", "-v", "error", "-i", mov, "-vf", f"scale={W}:{H}", os.path.join(tmp, "f%03d.png")], check=True)
        out = []
        for f in sorted(os.listdir(tmp)):
            im = Image.open(os.path.join(tmp, f)).convert("RGBA"); bg = Image.new("RGBA", (W, H), PINE); bg.alpha_composite(im); out.append(bg.convert("RGB"))
    return out


def scribble_frames():   # the annotation around a word, as it is used
    base = card("Motion DNA", PINE, CLOUD, (960, 540), 92)
    import web_capture
    x0, y0, x1, y1 = ImageDraw.Draw(base).textbbox((480, 270), "Motion DNA", font=font(92), anchor="mm")   # around the word, measured
    mov = web_capture.capture("scribble", {"box": [x0, y0, x1 - x0, y1 - y0], "width": 10}, 960, 540, 12.5, 2.4)
    with tempfile.TemporaryDirectory() as tmp:
        subprocess.run(["ffmpeg", "-v", "error", "-i", mov, os.path.join(tmp, "f%03d.png")], check=True)
        out = []
        for f in sorted(os.listdir(tmp)):
            im = base.convert("RGBA"); im.alpha_composite(Image.open(os.path.join(tmp, f)).convert("RGBA")); out.append(im.convert("RGB").resize((W, H), Image.LANCZOS))
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
    layers = [{"id": str(i), "cx": 560 + i * 160, "cy": 430 + (i % 2) * 60, "w": 140 if i % 3 else 200, "h": 110, "circle": i == 4} for i in range(6)]
    cols = [SPARK, MINT, CORAL, CLOUD, SPARK, MINT]
    for name, mode in (("fall", "fall"), ("drop in", "drop_in"), ("burst", "burst")):
        if not pick(name): continue
        paths = physics_bake.simulate(physics_bake.spec_for(layers, {"w": 1920, "h": 1080, "fps": 12.5}, mode, 2.4))
        frames = []
        for f in range(N):
            im = Image.new("RGB", (W, H), PINE); d = ImageDraw.Draw(im); k = W / 1920
            for l, col in zip(layers, cols):
                x, y, a = paths[l["id"]][min(f, len(paths[l["id"]]) - 1)]
                if l["circle"]: r = l["w"] / 2 * k; d.ellipse([x * k - r, y * k - r, x * k + r, y * k + r], fill=col); continue
                hw, hh = l["w"] / 2 * k, l["h"] / 2 * k; ca, sa = math.cos(a), math.sin(a)
                d.polygon([(x * k + dx * ca - dy * sa, y * k + dx * sa + dy * ca) for dx, dy in ((-hw, -hh), (hw, -hh), (hw, hh), (-hw, hh))], fill=col)
            frames.append(im)
        save("physics", name, frames, {"fall": 24, "drop in": 26, "burst": 9}[name])


# ---------------------------------------------------------------- gltransition: shot A to shot B through the matte
def do_gl(pick):
    import base64, gl_matte
    from playwright.sync_api import sync_playwright
    names = [i["name"] for i in json.loads((ROOT / "library/kit.json").read_text(encoding="utf-8"))["items"] if i["kind"] == "gltransition" and pick(i["name"])]
    if not names: return
    A, B = card("Shot A", SEA, CLOUD), card("Shot B", SPARK, PINE); ease = gl_matte._ease("Cruise")
    prog = [0] * 5 + [ease(i / 19) for i in range(20)] + [1] * 5
    with sync_playwright() as p:
        b, pg = gl_matte._page(p)
        for n in names:
            urls = pg.evaluate("a => MATTE(a[0], a[1], a[2], a[3])", [n, W, H, prog])
            frames = [Image.composite(B, A, Image.open(io.BytesIO(base64.b64decode(u.split(",", 1)[1]))).convert("L")) for u in urls]
            save("gltransition", n, frames, 14)
        b.close()


if __name__ == "__main__":
    only = {x.strip() for x in os.environ.get("NAMES", "").split(",") if x.strip()}
    pick = (lambda n: n in only) if only else (lambda n: True)
    kinds = sys.argv[1:] or ["webfx", "spring", "physics", "gltransition"]
    for k in kinds: {"webfx": do_fx, "spring": do_spring, "physics": do_physics, "gltransition": do_gl}[k](pick)
