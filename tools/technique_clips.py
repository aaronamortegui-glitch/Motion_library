"""A moving example for every technique (library/techniques/<slug>.webm, 640 px, VP9; sound where the technique is
about sound or timing). Each one shows the technique doing its job, so it reads in a few seconds: cut from what we
already made when that shows it clearly (the teaser), otherwise composed here frame by frame from our footage and
drawn in the Motion DNA type and colours (a label tracked on a moving car, the roto breakdown in four steps, the freeze
and its slam, a speed ramp, a two-colour wipe, markers that retime a title, the voice cut, the robot built stroke by
stroke, the sound cues). The library guide plays them; the still (<slug>.png) stays as the poster.

Usage: python tools/technique_clips.py [slug ...]      (all when none is given)
"""
import json
import math
import pathlib
import re
import subprocess
import sys

import numpy as np
from PIL import Image, ImageDraw, ImageFont

ROOT = pathlib.Path(__file__).resolve().parent.parent
OUT = ROOT / "library" / "techniques"
V = "media/motion_dna_teaser/video/"
TEASER = V + "teaser_animatic_v12c.mp4"
W, H, FPS = 640, 360, 30
SPARK, INK, PINE, SEA, CLOUD, MINT = (216, 255, 133), (4, 18, 15), (10, 33, 31), (25, 84, 110), (247, 249, 242), (141, 253, 186)
FONT = ROOT / "assets/fonts/InterTight[wght].ttf"

# slug: (how, source, start s, length s, sound). "cut" is a plain cut; the others are made below.
JOBS = {
    "tracked-labels": ("tracked", V + "R4_car3_kling.mp4", 0, 5.0, False),
    "text-behind-people": ("behind", [V + "A_yes_k3_cut.mp4", V + "A_yes_k3_matte.mov"], 0, 2.2, False),
    "roto-breakdown": ("roto", [V + "A_yes_k3_cut.mp4", V + "A_yes_k3_matte.mov"], 0, 2.2, False),
    "hud-overlays": ("hud", V + "G5_robot_closeup.mp4", 0.3, 4.4, False),
    "speed-ramps": ("ramp", TEASER, 32.9, 2.9, False),
    "freeze-frame-kinetic-type": ("freeze", V + "G6_dana_curious.mp4", 0.4, 5.0, False),
    "shape-wipe-transitions": ("wipe", [V + "A1_00_kling.mp4", V + "R4_car3_kling.mp4"], 0.5, 3.2, False),
    "marker-timing": ("markers", None, 0, 5.0, False),
    "styles": ("grid", ["library/packs/calm-modern.mp4", "library/packs/dynamic.mp4", "library/packs/tech.mp4", "library/packs/playful.mp4"], 0, 3.5, False),
    "cut-on-the-voice": ("voice", TEASER, 17.35, 2.2, True),
    "stroke-build": ("stroke", None, 0, 3.4, False),
    "sound-pass": ("sound", TEASER, 32.9, 3.6, True),
}
HIDDEN = {"face-refinement"}   # not every machine can run it: no example, and the library guide leaves it out
DUPLICATES = {"styles", "shape-wipe-transitions"}   # the guide shows them in their own sections (Styles, Kit > Transitions)


# ---------------------------------------------------------------- helpers
def font(size, weight=700):
    f = ImageFont.truetype(str(FONT), size)
    try: f.set_variation_by_axes([weight])
    except (OSError, AttributeError): pass
    return f


def chip(d, x, y, text, size=20, fill=SPARK, ink=INK, anchor="lt"):
    f = font(size); tw = d.textlength(text, font=f); a, b = f.getbbox(text)[1], f.getbbox(text)[3]; w, h = tw + 24, (b - a) + 14
    if anchor == "rt": x -= w
    if anchor == "mt": x = min(max(x - w / 2, 8), W - w - 8)   # centred on x, kept inside the frame
    d.rounded_rectangle([x, y, x + w, y + h], radius=h / 2, fill=fill)
    d.text((x + 12, y + 7 - a), text, font=f, fill=ink)
    return w, h


def bez(x1, y1, x2, y2):
    def f(t):
        if t <= 0: return 0.0
        if t >= 1: return 1.0
        u = t
        for _ in range(8):
            x = 3 * x1 * u * (1 - u) ** 2 + 3 * x2 * u * u * (1 - u) + u ** 3 - t
            dx = 3 * x1 * (1 - u) ** 2 + 6 * (x2 - x1) * u * (1 - u) + 3 * (1 - x2) * u * u
            if abs(x) < 1e-5 or dx == 0: break
            u -= x / dx
        return 3 * y1 * u * (1 - u) ** 2 + 3 * y2 * u * u * (1 - u) + u ** 3
    return f


LAND, POP, SURGE, WHIP = bez(.12, .9, .28, 1), bez(.34, 1.45, .64, 1), bez(.7, 0, .3, 1), bez(.75, 0, .05, 1)


def frames(src, start, length, w=W, h=H, fps=FPS, extra=""):
    """Decoded RGB frames of a clip, scaled to cover w x h."""
    raw = subprocess.run(["ffmpeg", "-v", "error", "-ss", str(start), "-t", str(length), "-i", str(ROOT / src),
                          "-vf", f"fps={fps},scale={w}:{h}:force_original_aspect_ratio=increase,crop={w}:{h}{extra}", "-f", "rawvideo", "-pix_fmt", "rgb24", "-"],
                         capture_output=True, check=True).stdout
    return np.frombuffer(raw, np.uint8).reshape(-1, h, w, 3)


def alpha(src, length, w=W, h=H, fps=FPS):
    """The alpha channel of a clip with transparency (a matte), as grey frames."""
    raw = subprocess.run(["ffmpeg", "-v", "error", "-t", str(length), "-i", str(ROOT / src), "-vf", f"fps={fps},alphaextract,scale={w}:{h}",
                          "-f", "rawvideo", "-pix_fmt", "gray", "-"], capture_output=True, check=True).stdout
    return np.frombuffer(raw, np.uint8).reshape(-1, h, w)


def envelope(src, start, length, n):
    """The loudness of a clip's sound in n even steps (0-1)."""
    raw = subprocess.run(["ffmpeg", "-v", "error", "-ss", str(start), "-t", str(length), "-i", str(ROOT / src), "-ac", "1", "-ar", "8000",
                          "-f", "s16le", "-"], capture_output=True, check=True).stdout
    a = np.abs(np.frombuffer(raw, np.int16).astype(float)); k = max(1, len(a) // n)
    e = np.array([a[i * k:(i + 1) * k].mean() if a[i * k:(i + 1) * k].size else 0 for i in range(n)])
    return e / (e.max() or 1)


def waveform(d, env, t, y, h, label_times=(), top=False):
    """A waveform strip (at the bottom, or at the top when the shot has words at the bottom): what has played is
    Spark, the rest is faint; a playhead; marks with words."""
    d.rectangle([0, y - 8, W, y + h + 8] if top else [0, y - 8, W, H], fill=(4, 18, 15, 205))
    n = len(env); bw = W / n
    for i, v in enumerate(env):
        x = i * bw; hh = max(2, v * h); c = SPARK if i / n <= t else (247, 249, 242, 90)
        d.rectangle([x + 1, y + h / 2 - hh / 2, x + bw - 1, y + h / 2 + hh / 2], fill=c)
    d.line([(t * W, y - 8), (t * W, y + h + 8)], fill=CLOUD, width=2)
    for lt, word in label_times:
        if t >= lt - .02: chip(d, lt * W, (y + h + 14) if top else (y - 40), word, 16, anchor="mt")


def encode(arr, out, sound=None):
    """Frames (and optionally the source's sound for the same span) to a VP9 WebM."""
    hh, ww = np.asarray(arr[0]).shape[:2]
    cmd = ["ffmpeg", "-v", "error", "-y", "-f", "rawvideo", "-pix_fmt", "rgb24", "-s", f"{ww}x{hh}", "-r", str(FPS), "-i", "-"]
    if sound: cmd += ["-ss", str(sound[1]), "-t", str(sound[2]), "-i", str(ROOT / sound[0]), "-map", "0:v", "-map", "1:a", "-c:a", "libopus", "-b:a", "64k", "-shortest"]
    cmd += ["-c:v", "libvpx-vp9", "-b:v", "0", "-crf", "33", "-row-mt", "1", "-pix_fmt", "yuv420p", str(out)]
    subprocess.run(cmd, input=np.ascontiguousarray(np.stack(arr)).tobytes(), check=True)


def rgba(a):
    return Image.fromarray(a).convert("RGBA")


def flat(im):
    return np.asarray(im.convert("RGB"))


# ---------------------------------------------------------------- the examples
def track(f, box):
    """Follows a subject by multi-scale template matching (the template keeps 30 % of the first frame, so it never
    drifts off): the box on every frame."""
    import cv2
    x, y, w, h = box; g = [cv2.cvtColor(a, cv2.COLOR_RGB2GRAY) for a in f]
    tpl0 = g[0][y:y + h, x:x + w].astype(np.float32); tpl = tpl0.copy(); boxes = [tuple(box)]
    for i in range(1, len(g)):
        best = None
        for s in (.985, .993, 1.0, 1.006):
            nw, nh = max(12, round(w * s)), max(10, round(h * s)); t1, t0 = cv2.resize(tpl, (nw, nh)), cv2.resize(tpl0, (nw, nh))
            x0, y0 = max(0, x - 30), max(0, y - 30); x1, y1 = min(g[i].shape[1], x + w + 30), min(g[i].shape[0], y + h + 30)
            reg = g[i][y0:y1, x0:x1].astype(np.float32)
            if reg.shape[0] < nh or reg.shape[1] < nw: continue
            r = .7 * cv2.matchTemplate(reg, t1, cv2.TM_CCOEFF_NORMED) + .3 * cv2.matchTemplate(reg, t0, cv2.TM_CCOEFF_NORMED)
            _, mv, _, ml = cv2.minMaxLoc(r)
            if not best or mv > best[0]: best = (mv, x0 + ml[0], y0 + ml[1], nw, nh)
        _, x, y, w, h = best; tpl = .8 * cv2.resize(tpl, (w, h)) + .2 * g[i][y:y + h, x:x + w].astype(np.float32); boxes.append((x, y, w, h))
    return boxes


def tracked(src, start, length):
    """A label pinned to a moving car: the car is tracked, corner brackets and a leader line follow it."""
    f = frames(src, start, length); boxes = track(f, (314, 214, 92, 68)); out = []
    for i, fr in enumerate(f):
        im = rgba(fr); d = ImageDraw.Draw(im, "RGBA"); x, y, w, h = boxes[i]; t = i / FPS; k = LAND(min(1, max(0, (t - .25) / .5))); L = 12
        for (cx, cy, sx, sy) in ((x, y, 1, 1), (x + w, y, -1, 1), (x, y + h, 1, -1), (x + w, y + h, -1, -1)):   # corner brackets
            d.line([(cx, cy), (cx + sx * L, cy)], fill=SPARK, width=3); d.line([(cx, cy), (cx, cy + sy * L)], fill=SPARK, width=3)
        if k > 0:   # the leader goes up and to the left, into the sea, where the label never leaves the frame
            ax, ay = x + w * .3, y; lx, ly = ax - 80 * k, ay - 64 * k
            d.line([(ax, ay), (lx, ly)], fill=SPARK, width=2); d.ellipse([ax - 4, ay - 4, ax + 4, ay + 4], fill=SPARK)
            if k > .6: chip(d, lx, ly - 30, "CLASSIC 4 · 1974", 18, anchor="rt")
        chip(d, 16, 16, "TRACKED · 0 KEYFRAMES BY HAND", 15, fill=(4, 18, 15), ink=SPARK)
        out.append(flat(im))
    return out


def roto(srcs, start, length):
    """The roto breakdown in four steps that appear in turn: the plate, its AI matte, the contours, the composite."""
    plate, matte = frames(srcs[0], 0, length), alpha(srcs[1], length); n = min(len(plate), len(matte))
    import cv2
    qw, qh = W // 2, H // 2; out = []
    word = Image.new("RGBA", (W, H), (0, 0, 0, 0)); ImageDraw.Draw(word).text((W / 2, H * .42), "YES!", font=font(230, 900), fill=SPARK + (255,), anchor="mm")
    total = int(3.4 * FPS)
    for i in range(total):
        j = min(n - 1, int(i * n / total)); t = i / FPS   # the shot plays slower so the steps can be read
        p, m = plate[j], matte[j]
        q1 = rgba(p)
        q2 = Image.fromarray(np.dstack([m] * 3)).convert("RGBA")
        c = np.zeros((H, W, 3), np.uint8); c[:] = PINE
        cs, _ = cv2.findContours((m > 128).astype(np.uint8), cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
        c = c.copy(); cv2.drawContours(c, cs, -1, SPARK, 3); q3 = Image.fromarray(c).convert("RGBA")
        q4 = rgba(p); q4.alpha_composite(word); person = rgba(p); person.putalpha(Image.fromarray(m)); q4.alpha_composite(person)
        im = Image.new("RGBA", (W, H), PINE + (255,)); d = ImageDraw.Draw(im)
        for k, (q, lab) in enumerate(((q1, "1 · PLATE"), (q2, "2 · MATTE (AI)"), (q3, "3 · CONTOURS"), (q4, "4 · COMPOSITE"))):
            a = LAND(min(1, max(0, (t - .15 - k * .45) / .45)))
            if a <= 0: continue
            tile = q.resize((qw - 6, qh - 6)); x, y = (k % 2) * qw + 3, (k // 2) * qh + 3 + int((1 - a) * 24)
            tile.putalpha(int(255 * a)); im.alpha_composite(tile, (x, y)); chip(d, x + 10, y + 10, lab, 14)
        out.append(flat(im))
    return out


def ramp(src, start, length):
    """Speed ramp, the effect itself, on a clip generated in slow motion: it starts fast (4x), the speed eases down
    smoothly into a slower-than-shot slow motion (0.4x) for the splash, then eases back up to 4x. Speed changes
    continuously on the Ramp curve, frames are blended (motion blur when fast, smooth when slow), and the speed
    reads live on a gauge with its curve."""
    f = frames(src, start, length, fps=FPS * 2).astype(np.float32)   # 2x the frames: room to slow down
    n = len(f); RAMP = bez(.87, 0, .13, 1)
    hit = .55   # where the splash is in the source (0-1)

    def speed(p):   # speed in source-frames per output frame (2 = real time of the generated slow motion)
        lo, hi = .8, 8.0   # 0.4x and 4x
        d = abs(p - hit) / .35
        return lo + (hi - lo) * RAMP(min(1, d))

    out, pos, hist = [], 0.0, []
    while pos < n - 1:
        p = pos / n; sp = speed(p)
        taps = max(1, int(sp / 2))   # motion blur: average the source frames this output frame crosses
        acc = sum(f[min(n - 1, int(pos + k * sp / taps))] for k in range(taps)) / taps
        a, b = int(pos), min(n - 1, int(pos) + 1); k = pos - int(pos)
        if taps == 1: acc = (1 - k) * f[a] + k * f[b]
        im = Image.fromarray(acc.clip(0, 255).astype(np.uint8)).convert("RGBA"); d = ImageDraw.Draw(im, "RGBA")
        x = sp / 2; hist.append(x)
        chip(d, 16, 16, f"{x:.1f}x", 26)
        d.rectangle([0, H - 46, W, H], fill=(4, 18, 15, 205))   # the speed curve over the whole clip, the dot where we are
        pts = [(16 + (W - 32) * u / 100, H - 12 - 26 * (speed(u / 100) - .8) / 7.2) for u in range(101)]
        d.line(pts, fill=(247, 249, 242, 110), width=2)
        q = min(100, int(p * 100)); d.ellipse([pts[q][0] - 6, pts[q][1] - 6, pts[q][0] + 6, pts[q][1] + 6], fill=SPARK)
        d.text((16, H - 44), "SPEED", font=font(12, 700), fill=(247, 249, 242, 160))
        out.append(np.asarray(im.convert("RGB"))); pos += sp
    return out


def matte(rgb):
    """A soft matte of the main subject of a frame (U2-Net, the rembg model in ~/.u2net)."""
    import cv2
    net = cv2.dnn.readNetFromONNX(str(pathlib.Path.home() / ".u2net" / "u2net.onnx"))
    x = cv2.resize(rgb, (320, 320)).astype(np.float32) / 255; x = (x - [.485, .456, .406]) / [.229, .224, .225]
    net.setInput(x.transpose(2, 0, 1)[None].astype(np.float32)); m = net.forward()[0, 0]; m = (m - m.min()) / (m.max() - m.min() + 1e-6)
    m = cv2.resize(m, (rgb.shape[1], rgb.shape[0])); m = np.clip((m - .35) / .3, 0, 1)
    n, lab, st, _ = cv2.connectedComponentsWithStats((m > .5).astype(np.uint8))
    if n > 2: m = m * (lab == 1 + int(np.argmax(st[1:, 4])))   # only the largest piece: the subject, not a mug
    return (cv2.GaussianBlur(m.astype(np.float32), (5, 5), 0) * 255).astype(np.uint8)


def freeze(src, start, length):
    """Freeze frame, made like a title sequence (960 x 540): the shot plays with its play bar; it freezes on a
    two-frame flash, a punch-in with overshoot and a dying shake; the background sinks (desaturated, softened, toward
    Pine) while she comes forward with a soft shadow; EVERY. SINGLE. TIME. slam in with motion blur, a kick each, and
    TIME. gets the Spark block; it holds on a slow drift with parallax. A quiet step line shows where we are."""
    from PIL import ImageFilter
    w_, h_ = 960, 540; live = 1.3
    f = frames(src, start, live + .05, w_, h_); still = f[-1]; m = matte(still); out = []
    mimg = Image.fromarray(m)
    bg_soft = Image.fromarray(still).filter(ImageFilter.GaussianBlur(4))
    grey = np.asarray(bg_soft).mean(axis=2, keepdims=True)
    shadow = Image.new("RGBA", (w_, h_), PINE + (0,)); shadow.putalpha(mimg.filter(ImageFilter.GaussianBlur(18)).point(lambda v: int(v * .65)))
    subj = Image.fromarray(still).convert("RGBA"); subj.putalpha(mimg)
    fw, fsm, fbar = font(92, 900), font(17, 600), font(15, 600)
    words = [("EVERY.", 2.1), ("SINGLE.", 2.45), ("TIME.", 2.8)]; X, Y0, LH = 575, 118, 104
    ys, xs = np.nonzero(m > 128)
    cx, cy = (xs.min() + xs.max()) / 2, ys.min() + (ys.max() - ys.min()) * .38   # her face, the anchor of the punch-in
    tx, ty = 275, 255                                                        # where the punch-in takes her: the left third

    def zoom(im, z, k, ox=0, oy=0):
        """Scale by z around her, and slide her k of the way to the left third."""
        big = im.resize((int(w_ * z), int(h_ * z)), Image.BICUBIC)
        dx_, dy_ = cx + (tx - cx) * k, cy + (ty - cy) * k   # where her face lands
        x0, y0 = int(cx * z - dx_ - ox), int(cy * z - dy_ - oy)
        x0, y0 = max(0, min(big.width - w_, x0)), max(0, min(big.height - h_, y0))
        return big.crop((x0, y0, x0 + w_, y0 + h_))

    def word_layer(u):
        L = Image.new("RGBA", (w_, h_), (0, 0, 0, 0))
        for k, (w, t0) in enumerate(words):
            a = (u + live - t0) / .22
            if a <= 0: continue
            y = Y0 + k * LH
            if w == "TIME." and u + live > 3.1:   # the Spark block wipes in behind TIME.
                bw = fw.getlength(w) + 30; p = WHIP(min(1, (u + live - 3.1) / .35))
                ImageDraw.Draw(L).rectangle([X - 15, y + 10, X - 15 + bw * p, y + LH - 4], fill=SPARK)
            ink = PINE if (w == "TIME." and u + live > 3.25) else SPARK
            subs = 4 if a < 1 else 1   # motion blur while it slams: a few sub-frames averaged
            acc = None
            for sb in range(subs):
                aa = max(0, a - sb * .08); sc = 1 + .7 * (1 - POP(min(1, aa)))
                lay = Image.new("RGBA", (w_, h_), (0, 0, 0, 0)); ImageDraw.Draw(lay).text((X, y), w, font=fw, fill=ink + (255,))
                if sc != 1:
                    lay = lay.resize((int(w_ * sc), int(h_ * sc)), Image.BICUBIC); ox_, oy_ = int(X * sc - X), int((y + 50) * sc - (y + 50)); lay = lay.crop((ox_, oy_, ox_ + w_, oy_ + h_))
                arr = np.asarray(lay).astype(float); acc = arr if acc is None else acc + arr
            lay = Image.fromarray((acc / subs).astype(np.uint8)); lay.putalpha(Image.fromarray((np.asarray(lay.split()[3]) * min(1, a * 2.2)).astype(np.uint8)))
            L.alpha_composite(lay)
        return L

    def kick(t):   # a small shake that dies out after each hit (the freeze, then each word)
        dx = dy = 0.0
        for t0, amp in ((live, 9), (2.1, 4), (2.45, 4), (2.8, 5)):
            u = t - t0
            if 0 <= u < .2: e = (1 - u / .2) ** 2; dx += amp * e * math.sin(u * 95); dy += amp * e * math.cos(u * 80)
        return dx, dy

    for i in range(int(length * FPS)):
        t = i / FPS
        if t < live:   # live: the shot plays, the play bar runs
            im = Image.fromarray(f[min(i, len(f) - 1)]).convert("RGBA"); u = None
        else:
            u = t - live
            sep = LAND(min(1, max(0, (u - .25) / .55)))   # the background sinks
            base = np.asarray(Image.fromarray(still)).astype(float) * (1 - sep) + (np.asarray(bg_soft).astype(float) * .35 + grey * .3 + np.array(PINE) * .35) * sep
            im = Image.fromarray(base.clip(0, 255).astype(np.uint8)).convert("RGBA")
            if sep > 0:
                im.alpha_composite(shadow, (int(10 * sep), int(14 * sep)))
                fz = 1 + .035 * sep; sub = subj.resize((int(w_ * fz), int(h_ * fz)), Image.BICUBIC); im.alpha_composite(sub, (int(cx - cx * fz), int(cy - cy * fz)))
            z = 1 + .28 * POP(min(1, u / .4)) + .03 * (u / max(.01, length - live))   # punch-in with overshoot, then a slow drift
            dx, dy = kick(t); im = zoom(im, z, LAND(min(1, u / .5)), dx, dy)
            wl = word_layer(u)
            if u > 2.2: wl = wl.transform(wl.size, Image.AFFINE, (1, 0, (u - 2.2) * 2.5, 0, 1, 0))   # parallax: the words drift against the shot
            im.alpha_composite(wl)
            if u < 2 / FPS: im = Image.blend(im, Image.new("RGBA", (w_, h_), (255, 255, 255, 255)), .75 if u < 1 / FPS else .35)   # a two-frame flash
        d = ImageDraw.Draw(im, "RGBA")
        # the player: a play bar that runs live and stops on the frozen frame, and its time
        prog = min(t, live) / 4.0; d.rectangle([28, h_ - 34, w_ - 28, h_ - 31], fill=(247, 249, 242, 70)); d.rectangle([28, h_ - 34, 28 + (w_ - 56) * prog, h_ - 31], fill=SPARK)
        fr = int(min(t, live) * 24); tc = f"00:00:{fr // 24:02d}:{fr % 24:02d}"
        if u is None: d.ellipse([28, h_ - 56, 38, h_ - 46], fill=(255, 149, 149))   # live: a red dot; frozen: a pause sign
        else: d.rectangle([28, h_ - 57, 31, h_ - 45], fill=SPARK); d.rectangle([35, h_ - 57, 38, h_ - 45], fill=SPARK)
        d.text((48, h_ - 60), ("LIVE  " if u is None else "FROZEN  ") + tc, font=fbar, fill=SPARK if u is not None else CLOUD)
        # the steps, quietly: the current one lit
        steps = ["Freeze", "Cut out", "Type"]; cur = -1 if u is None else 0 if u < .5 else 1 if u < .8 else 2; x = w_ - 28
        for k in range(2, -1, -1):
            tw = d.textlength(steps[k], font=fsm); x -= tw; d.text((x, h_ - 62), steps[k], font=fsm, fill=SPARK if k == cur else (247, 249, 242, 110)); x -= 22
        out.append(np.asarray(im.convert("RGB")))
    return out


def hud(src, start, length):
    """HUD overlay on a tracked subject: brackets lock on the robot's screen, a scan sweeps it, then a meter fills and
    labels with leader lines attach to it, all following the shot."""
    f = frames(src, start, length); boxes = track(f, (110, 45, 400, 235)); out = []; fs = font(16, 600)
    for i, fr in enumerate(f):
        t = i / FPS; im = rgba(fr); d = ImageDraw.Draw(im, "RGBA"); x, y, w, h = boxes[i]
        k = LAND(min(1, t / .6)); pad = 40 * (1 - k); L = 22
        for (cx, cy, sx, sy) in ((x - pad, y - pad, 1, 1), (x + w + pad, y - pad, -1, 1), (x - pad, y + h + pad, 1, -1), (x + w + pad, y + h + pad, -1, -1)):
            d.line([(cx, cy), (cx + sx * L, cy)], fill=SPARK, width=3); d.line([(cx, cy), (cx, cy + sy * L)], fill=SPARK, width=3)
        if .7 < t < 2.0:   # the scan sweeps down the screen
            sy_ = y + h * ((t - .7) / 1.3); sc = Image.new("RGBA", (W, H), (0, 0, 0, 0)); ImageDraw.Draw(sc).rectangle([x, y, x + w, sy_], fill=(216, 255, 133, 45))
            im.alpha_composite(sc); d = ImageDraw.Draw(im, "RGBA"); d.line([(x, sy_), (x + w, sy_)], fill=SPARK, width=3)
        if t > 1.6:   # the meter fills, the labels attach
            mk = SURGE(min(1, (t - 1.6) / .9)); mx, my = min(x + w + 24, W - 190), y + 10
            d.rectangle([mx - 8, my - 6, mx + 175, my + 42], fill=(4, 18, 15, 190))
            d.text((mx, my), "SCAN", font=fs, fill=CLOUD); d.rectangle([mx, my + 24, mx + 120, my + 34], outline=(247, 249, 242, 120)); d.rectangle([mx, my + 24, mx + 120 * mk, my + 34], fill=SPARK)
            d.text((mx + 128, my + 20), f"{int(98 * mk)}%", font=fs, fill=SPARK)
            for j, (px, py, lab) in enumerate(((x + w * .3, y + h * .45, "EYE · L"), (x + w * .72, y + h * .45, "EYE · R"))):
                a = LAND(min(1, max(0, (t - 2.0 - j * .25) / .4)))
                if a <= 0: continue
                lx, ly = (max(150, x - 30 - 60 * a), y + h * .85) if j == 0 else (min(W - 120, x + w + 30 + 40 * a), y + h * .75)
                d.line([(px, py), (lx, ly)], fill=SPARK, width=2); d.ellipse([px - 5, py - 5, px + 5, py + 5], outline=SPARK, width=2)
                chip(d, lx, ly - 14, lab, 14, anchor="rt" if j == 0 else "lt")
        chip(d, 16, 16, "1 · LOCK ON" if t < .7 else "2 · SCAN" if t < 1.6 else "3 · DATA", 16)
        out.append(flat(im))
    return out


def behind(srcs, start, length):
    """Text behind people: on the clean plate, a giant YES! rises from below and passes behind the two people (their AI
    matte stays on top); halfway, a quick flash of the matte shows how it is done."""
    plate, m = frames(srcs[0], 0, length), alpha(srcs[1], length); n = min(len(plate), len(m)); out = []
    total = int(3.2 * FPS); fw = font(250, 900)
    for i in range(total):
        j = min(n - 1, int(i * n / total)); t = i / FPS   # the shot plays a little slower so the move reads
        im = rgba(plate[j]); k = LAND(min(1, max(0, (t - .3) / .9)))
        word = Image.new("RGBA", (W, H), (0, 0, 0, 0)); ImageDraw.Draw(word).text((W / 2, H * .42 + (1 - k) * 260), "YES!", font=fw, fill=SPARK + (255,), anchor="mm")
        im.alpha_composite(word)
        person = rgba(plate[j]); person.putalpha(Image.fromarray(m[j])); im.alpha_composite(person)
        d = ImageDraw.Draw(im, "RGBA")
        if 1.5 < t < 2.1:   # the matte, briefly: white people over Pine, so the trick is seen
            a = min(1, (t - 1.5) / .12, (2.1 - t) / .12); ov = Image.new("RGBA", (W, H), PINE + (int(200 * a),))
            wm = Image.new("RGBA", (W, H), CLOUD + (0,)); wm.putalpha(Image.fromarray((m[j] * .85 * a).astype(np.uint8)))
            im.alpha_composite(ov); im.alpha_composite(wm); d = ImageDraw.Draw(im, "RGBA")
        chip(d, 16, 16, "1 · TEXT IN" if t < 1.5 else "2 · AI MATTE" if t < 2.1 else "3 · TEXT BEHIND THEM", 16)
        out.append(flat(im))
    return out


def wipe(srcs, start, length):
    """Shape wipe: Spark and Sea bars cross the frame and carry the cut from the office to the car spot."""
    a, b = frames(srcs[0], start, length), frames(srcs[1], 0, length); out = []; mid = length / 2
    for i in range(int(length * FPS)):
        t = i / FPS; im = rgba(a[min(i, len(a) - 1)] if t < mid else b[min(i, len(b) - 1)]); d = ImageDraw.Draw(im)
        p = (t - (mid - .55)) / 1.1   # 0 -> 1 across the cut
        if 0 < p < 1:
            for k, col in enumerate((SEA, SPARK)):
                q = WHIP(min(1, max(0, p * 1.15 - k * .12))); x = -W * 1.4 + q * W * 2.8; sk = 160
                d.polygon([(x, 0), (x + W * .9, 0), (x + W * .9 - sk, H), (x - sk, H)], fill=col)
        out.append(flat(im))
    return out


def markers(_src, start, length):
    """Marker timing: the title plays between its SS in and SS out markers; drag SS out and the move takes longer."""
    out = []; ft = font(64, 800); fs = font(18, 600)
    for i in range(int(length * FPS)):
        t = i / FPS; im = Image.new("RGBA", (W, H), PINE + (255,)); d = ImageDraw.Draw(im)
        phase = 0 if t < 1.6 else 1 if t < 2.4 else 2   # play short, drag the marker, play long
        dur = .5 if phase == 0 else .5 + .9 * SURGE((t - 1.6) / .8) if phase == 1 else 1.4
        lt = t if phase == 0 else 0 if phase == 1 else t - 2.4
        k = SURGE(min(1, lt / dur)) if phase != 1 else 1
        layer = Image.new("RGBA", (W, H), (0, 0, 0, 0)); ImageDraw.Draw(layer).text((W / 2, 120 + 40 * (1 - k)), "Make it pop", font=ft, fill=CLOUD + (255,), anchor="mm")
        layer.putalpha(Image.fromarray((np.asarray(layer.split()[3]) * k).astype(np.uint8))); im.alpha_composite(layer)
        y0, x0, x1 = 250, 60, W - 60; sec = (x1 - x0) / 2.0   # the timeline: 2 s across
        d.rectangle([x0, y0, x1, y0 + 30], fill=(25, 84, 110)); d.text((x0 + 10, y0 + 6), "Title · Surge Rise", font=fs, fill=CLOUD)
        for name, tm in (("SS in", 0.0), ("SS out", dur)):
            x = x0 + tm * sec; d.polygon([(x - 8, y0 - 18), (x + 8, y0 - 18), (x, y0 - 4)], fill=SPARK); d.line([(x, y0 - 4), (x, y0 + 34)], fill=SPARK, width=2)
            d.text((x, y0 + 44), name, font=fs, fill=SPARK, anchor="mt")
        if phase == 1: d.ellipse([x0 + dur * sec - 10, y0 - 30, x0 + dur * sec + 10, y0 - 10], outline=CLOUD, width=2)
        chip(d, W - 16, 16, f"{dur:.1f} s", 18, anchor="rt")
        ph = x0 + min(lt, dur) * sec if phase != 1 else x0; d.line([(ph, y0 - 6), (ph, y0 + 36)], fill=(255, 149, 149), width=2)
        out.append(flat(im))
    return out


def voice(src, start, length):
    """Cut on the voice: the edit cuts on the spoken word; the waveform shows the word and the cut landing on it."""
    f = frames(src, start, length); n = len(f); env = envelope(src, start, length, 80)
    diff = [np.abs(f[i].astype(int) - f[i - 1].astype(int)).mean() for i in range(1, n)]; cut = (int(np.argmax(diff)) + 1) / n
    out = []
    for i in range(n):
        t = i / n; im = rgba(f[i]); d = ImageDraw.Draw(im, "RGBA")
        waveform(d, env, t, 14, 26, [(.06, "“moves”"), (cut, "cut on “guidelines”")], top=True)
        out.append(flat(im))
    return out


def robot_parts(d, cx, cy, hpx, frac, filled):
    """The robot head (assets/motion_dna/sample_robot.json): its line version drawn up to frac, or its filled version."""
    D = json.loads((ROOT / "assets/motion_dna/sample_robot.json").read_text(encoding="utf-8")); k = hpx / D["height"]
    pal = json.loads((ROOT / "assets/figma_essentials/palette.json").read_text(encoding="utf-8"))["colors"]
    col = lambda n: tuple(int(pal.get(n, "#D8FF85")[i:i + 2], 16) for i in (1, 3, 5))
    parts = D["vector" if filled else "line"]
    def poly(P):   # every part as points
        if "rect" in P:
            (x, y), (w, h), r = P["rect"]["center"], P["rect"]["size"], min(P["rect"]["round"], P["rect"]["size"][0] / 2, P["rect"]["size"][1] / 2); pts = []
            for qx, qy, a0 in ((w / 2 - r, -h / 2 + r, -90), (w / 2 - r, h / 2 - r, 0), (-w / 2 + r, h / 2 - r, 90), (-w / 2 + r, -h / 2 + r, 180)):
                pts += [(x + qx + r * math.cos(math.radians(a0 + j * 15)), y + qy + r * math.sin(math.radians(a0 + j * 15))) for j in range(7)]
            return pts + [pts[0]], True
        if "ellipse" in P:
            (x, y), (w, h) = P["ellipse"]["center"], P["ellipse"]["size"]; pts = [(x + w / 2 * math.cos(a / 24 * 2 * math.pi), y + h / 2 * math.sin(a / 24 * 2 * math.pi)) for a in range(25)]
            return pts, True
        v, o, i_ = P["path"]["v"], P["path"]["o"], P["path"]["i"]; pts = []
        for s in range(len(v) - 1):
            a0, a3 = v[s], v[s + 1]; a1 = (a0[0] + o[s][0], a0[1] + o[s][1]); a2 = (a3[0] + i_[s + 1][0], a3[1] + i_[s + 1][1])
            for u in range(13):
                tt = u / 12; m = 1 - tt
                pts.append((m ** 3 * a0[0] + 3 * m * m * tt * a1[0] + 3 * m * tt * tt * a2[0] + tt ** 3 * a3[0], m ** 3 * a0[1] + 3 * m * m * tt * a1[1] + 3 * m * tt * tt * a2[1] + tt ** 3 * a3[1]))
        return pts, False
    for j, P in enumerate(parts):
        pts, closed = poly(P); pts = [(cx + x * k, cy + y * k) for x, y in pts]
        if filled:
            if P.get("fill"): d.polygon(pts, fill=col(P["fill"]))
            if P.get("stroke"): d.line(pts, fill=col(P["stroke"]), width=max(2, int(P["width"] * k)), joint="curve")
        else:   # the draw-on: each part in turn, along its own outline
            a = min(1, max(0, frac * len(parts) - j))
            if a > 0: d.line(pts[:max(2, int(len(pts) * a))], fill=SPARK, width=max(2, int(P["width"] * k)), joint="curve")


def stroke(_src, start, length):
    """Stroke build, framed (960 x 540): the robot head, large and centred, draws itself part by part along its lines,
    then fills in with a small pop and settles; a quiet line at the bottom names the step."""
    w_, h_ = 960, 540; out = []; fsm = font(17, 600); RH = 330   # the robot is 330 px of 540: it fills the frame
    for i in range(int(length * FPS)):
        t = i / FPS; im = Image.new("RGBA", (w_, h_), PINE + (255,))
        line = Image.new("RGBA", (w_, h_), (0, 0, 0, 0)); robot_parts(ImageDraw.Draw(line), w_ / 2, h_ / 2 - 6, RH, SURGE(min(1, t / 1.8)), False)
        if t < 1.9: im.alpha_composite(line)
        else:
            k = min(1, (t - 1.9) / .35); s_ = .94 + .06 * POP(min(1, (t - 1.9) / .45))
            fill = Image.new("RGBA", (w_, h_), (0, 0, 0, 0)); robot_parts(ImageDraw.Draw(fill), w_ / 2, h_ / 2 - 6, RH * s_, 1, True)
            line.putalpha(Image.fromarray((np.asarray(line.split()[3]) * (1 - k)).astype(np.uint8))); im.alpha_composite(line)
            fill.putalpha(Image.fromarray((np.asarray(fill.split()[3]) * k).astype(np.uint8))); im.alpha_composite(fill)
        d = ImageDraw.Draw(im, "RGBA"); cur = 0 if t < 1.9 else 1; x = w_ / 2 - 80
        for k2, lab in enumerate(("Lines draw on", "Shape fills in")):
            d.text((x, h_ - 52), lab, font=fsm, fill=SPARK if k2 == cur else (247, 249, 242, 110)); x += d.textlength(lab, font=fsm) + 26
        out.append(np.asarray(im.convert("RGB")))
    return out


def sound(src, start, length):
    """Sound pass: the shot with the sounds it gets, each cue named where it lands on the waveform."""
    f = frames(src, start, length); n = len(f); env = envelope(src, start, length, 90)
    peaks = []
    for i in np.argsort(-env):   # the three loudest moments, apart from each other
        if all(abs(i - p) > 12 for p in peaks): peaks.append(int(i))
        if len(peaks) == 3: break
    names = iter(["whoosh", "splash", "hit"]); cues = [(p / len(env), next(names)) for p in sorted(peaks)]
    out = []
    for i in range(n):
        t = i / n; im = rgba(f[i]); d = ImageDraw.Draw(im, "RGBA")
        chip(d, 16, 16, "SOUND PASS · MADE IN CODE", 15, fill=(4, 18, 15), ink=SPARK)
        waveform(d, env, t, H - 34, 26, [(c, f"{w} · {c * length:.2f} s") for c, w in cues]); out.append(flat(im))
    return out


def grid(srcs, start, length):
    """Four style scenes playing together, 2 x 2."""
    fs = [frames(s, 0, length, W // 2, H // 2) for s in srcs]; n = min(len(x) for x in fs)
    return [np.vstack([np.hstack([fs[0][i], fs[1][i]]), np.hstack([fs[2][i], fs[3][i]])]) for i in range(n)]


def cut(src, start, length):
    return list(frames(src, start, length))


MAKERS = dict(cut=cut, behind=behind, hud=hud, tracked=tracked, roto=roto, ramp=ramp, freeze=freeze, wipe=wipe, markers=markers, voice=voice, stroke=stroke, sound=sound, grid=grid)


def make(slug):
    how, src, start, length, snd = JOBS[slug]; out = OUT / f"{slug}.webm"
    fr = MAKERS[how](src, start, length)
    encode(fr, out, (src, start, length) if snd else None)
    Image.fromarray(fr[int(len(fr) * .72)]).save(OUT / f"{slug}_clip.jpg", quality=84)   # its poster: a frame that shows the technique at work
    return out


if __name__ == "__main__":
    names = sys.argv[1:] or list(JOBS)
    techs = {re.sub(r"[^a-z0-9]+", "-", t["name"].lower()).strip("-") for t in json.loads((ROOT / "library/techniques.json").read_text(encoding="utf-8"))["techniques"]}
    for s in HIDDEN:
        (OUT / f"{s}.webm").unlink(missing_ok=True)
    for s in names:
        if s not in techs or s not in JOBS: print("no example for", s); continue
        o = make(s); print(o.relative_to(ROOT), o.stat().st_size // 1024, "KB")
