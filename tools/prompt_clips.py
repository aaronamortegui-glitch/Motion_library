"""Examples for the prompts that are not a library piece (brand, other apps, checks), so every prompt in the library
guide shows what it does, none the same clip: library/prompts/<slug>.webm + <slug>.jpg (poster).
Made from what we have: the panel recordings (docs/screens/cep-*.gif), the agent's Figma-to-AE clip, the style scenes.
Usage: python tools/prompt_clips.py [slug ...]
"""
import pathlib
import subprocess
import sys

import numpy as np
from PIL import Image, ImageDraw

ROOT = pathlib.Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT / "tools"))
import technique_clips as T  # noqa: E402

OUT = ROOT / "library" / "prompts"
W, H, FPS = T.W, T.H, T.FPS
PINE, SPARK, CLOUD, CORAL = T.PINE, T.SPARK, T.CLOUD, (255, 149, 149)


def panel(gif, title, sub, length):
    """A panel recording on the left, what it shows on the right, in the guide's language."""
    raw = subprocess.run(["ffmpeg", "-v", "error", "-t", str(length), "-i", str(ROOT / gif), "-vf", f"fps={FPS},scale=-2:{H - 36}",
                          "-f", "rawvideo", "-pix_fmt", "rgb24", "-"], capture_output=True, check=True).stdout
    pw = round((H - 36) * 340 / 646 / 2) * 2; f = np.frombuffer(raw, np.uint8).reshape(-1, H - 36, pw, 3); out = []
    ft, fs = T.font(34, 800), T.font(18, 500)
    for i in range(int(length * FPS)):
        im = Image.new("RGBA", (W, H), PINE + (255,)); im.paste(Image.fromarray(f[i % len(f)]), (34, 18))
        d = ImageDraw.Draw(im); x = 34 + pw + 34
        d.text((x, 120), title, font=ft, fill=SPARK)
        y = 172
        for line in sub: d.text((x, y), line, font=fs, fill=CLOUD); y += 26
        out.append(np.asarray(im.convert("RGB")))
    return out


def resize(src, length):
    """One comp, every social format: 16:9, 1:1, 9:16 and 4:5 play together, cropped around the subject."""
    f = T.frames(src, 0, length, 1280, 720); out = []; fs = T.font(15, 700)
    boxes = [("16:9", 240, 135), ("1:1", 130, 130), ("9:16", 90, 160), ("4:5", 120, 150)]
    for i in range(len(f)):
        im = Image.new("RGBA", (W, H), PINE + (255,)); d = ImageDraw.Draw(im); x = 22; src_im = Image.fromarray(f[i])
        for k, (lab, bw, bh) in enumerate(boxes):
            a = T.LAND(min(1, max(0, (i / FPS - .2 - k * .25) / .5)))
            if a <= 0: x += bw + 16; continue
            r = bw / bh; cw = min(1280, int(720 * r)); cx = 1280 - cw if lab != "16:9" else 0   # the vertical crops keep the right side, where the people are
            crop = src_im.crop((cx, 0, cx + cw, 720)).resize((bw, bh), Image.LANCZOS); y = int(H / 2 - bh / 2 + (1 - a) * 30)
            crop.putalpha(int(255 * a)); im.alpha_composite(crop, (x, y)); T.chip(d, x, y + bh + 10, lab, 15); x += bw + 16
        out.append(np.asarray(im.convert("RGB")))
    return out


def qa(src, length):
    """QA against the Figma layout: the layout's boxes land over the comp, one is off (coral), then it snaps into place."""
    f = T.frames(src, 0, length); out = []; fs = T.font(15, 700)
    for i in range(len(f)):
        t = i / FPS; im = T.rgba(f[i]); d = ImageDraw.Draw(im, "RGBA"); k = T.LAND(min(1, max(0, (t - .4) / .5)))
        if k > 0:
            for (x, y, w, h) in ((16, 244, 266, 40),):   # the Figma frames (the pills)
                d.rectangle([x, y, x + w, y + h], outline=(161, 212, 255, int(255 * k)), width=2)
            off = 14 * (1 - T.SURGE(min(1, max(0, (t - 1.6) / .5))))
            col = CORAL if t < 1.6 else PINE   # matched: the frame in Pine, it reads on any ground
            d.rectangle([16 + off, 162 - off, 216 + off, 216 - off], outline=col, width=3)   # the title's frame
            T.chip(d, W - 16, 16, "TITLE 14 PX OFF" if t < 1.6 else "MATCHES FIGMA", 15, fill=CORAL if t < 1.6 else SPARK, anchor="rt")
        T.chip(d, 16, H - 40, "FIGMA LAYOUT", 14, fill=(161, 212, 255))
        out.append(np.asarray(im.convert("RGB")))
    return out


def check(src, length):
    """Check before render: safe area and a face box over the comp, then the key frames come out as a strip."""
    f = T.frames(src, 0, length); out = []; keys = [f[int(len(f) * q)] for q in (.2, .45, .7, .95)]
    for i in range(len(f)):
        t = i / FPS; im = T.rgba(f[i]); d = ImageDraw.Draw(im, "RGBA")
        if t < 1.8:
            k = T.LAND(min(1, t / .5)); m = int(26 * k)
            d.rectangle([m, m, W - m, H - m], outline=(247, 249, 242, 200), width=2)
            T.chip(d, 16, 16, "SAFE AREA · OK", 14); T.chip(d, W - 16, 16, "NOTHING ON A FACE · OK", 14, anchor="rt")
        else:
            d.rectangle([0, 0, W, H], fill=(10, 33, 31, 215)); T.chip(d, 16, 16, "KEY FRAMES · render_frame", 14)
            for j, kf in enumerate(keys):
                a = T.LAND(min(1, max(0, (t - 1.85 - j * .18) / .4)))
                if a <= 0: continue
                th = Image.fromarray(kf).resize((140, 79)).convert("RGBA"); th.putalpha(int(255 * a))
                im.alpha_composite(th, (40 + j * 146, int(140 + (1 - a) * 30)))
        out.append(np.asarray(im.convert("RGB")))
    return out


def video_ref(src, length):
    """A video as reference: the clip plays, then the 8 frames the panel sends to Claude lift out of it with their
    times, with what Claude also gets (length, size, frame rate)."""
    import json as _j
    info = _j.loads(subprocess.run(["ffprobe", "-v", "error", "-show_entries", "format=duration:stream=width,height,r_frame_rate", "-of", "json", str(ROOT / src)],
                                   capture_output=True, text=True).stdout)
    dur = float(info["format"]["duration"]); st = info["streams"][0]; fps = round(eval(st["r_frame_rate"]))
    f = T.frames(src, 0, dur, W, H, fps=FPS); n = len(f); picks = [int(n * (k + .5) / 8) for k in range(8)]; out = []; fs = T.font(14, 700)
    for i in range(int(length * FPS)):
        t = i / FPS; im = T.rgba(f[min(n - 1, int(i * n / (1.6 * FPS)))]) if t < 1.6 else T.rgba(f[-1])
        d = ImageDraw.Draw(im, "RGBA")
        if t < 1.6: T.chip(d, 16, 16, "YOUR VIDEO · REFERENCE", 14)
        else:
            d.rectangle([0, 0, W, H], fill=(10, 33, 31, 225)); T.chip(d, 16, 16, "WHAT CLAUDE GETS · 8 FRAMES", 14)
            for k, p in enumerate(picks):
                a = T.LAND(min(1, max(0, (t - 1.7 - k * .08) / .35)))
                if a <= 0: continue
                th = Image.fromarray(f[p]).resize((140, 79)).convert("RGBA"); th.putalpha(int(255 * a))
                x, y = 34 + (k % 4) * 146, 90 + (k // 4) * 112 + int((1 - a) * 20); im.alpha_composite(th, (x, y))
                ImageDraw.Draw(im).text((x, y + 84), f"{p / FPS:.1f} s", font=fs, fill=SPARK)
            if t > 2.6: T.chip(d, 34, 320, f"{dur:.1f} s · {st['width']}x{st['height']} · {fps} fps", 15, fill=CLOUD)
        out.append(np.asarray(im.convert("RGB")))
    return out


def cut(src, start, length):
    return list(T.frames(src, start, length))


JOBS = {
    "brand-curves": lambda: panel("docs/screens/cep-brand-share.gif", "Your brand, applied", ["Its curves, timings and rules", "on every move in this comp."], 4.4),
    "brand-note": lambda: panel("docs/screens/cep-brand-learns.gif", "A note becomes a rule", ["Say it once in review:", "every next project follows it."], 5.6),
    "figma-storyboard": lambda: cut("library/guide/agent-timeline.mp4", 0, 4.6),
    "figma-qa": lambda: qa("library/packs/modern.mp4", 3.4),
    "resize": lambda: resize("library/packs/playful.mp4", 3.4),
    "check": lambda: check("library/packs/dynamic.mp4", 3.4),
    "video-ref": lambda: video_ref("media/motion_dna_teaser/video/G1_rex_entrance.mp4", 4.2),
}

if __name__ == "__main__":
    OUT.mkdir(parents=True, exist_ok=True)
    for s in sys.argv[1:] or list(JOBS):
        fr = JOBS[s](); T.encode(fr, OUT / f"{s}.webm"); Image.fromarray(fr[int(len(fr) * .7)]).save(OUT / f"{s}.jpg", quality=84)
        print(f"library/prompts/{s}.webm", (OUT / f"{s}.webm").stat().st_size // 1024, "KB")
