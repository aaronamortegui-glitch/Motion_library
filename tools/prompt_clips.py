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


def _env(path, start, length, n):
    """Peak envelope of a sound span in n columns (0..1), for the lanes."""
    import audio_markers as am
    y = am.load(ROOT / path)[int(start * am.SR):int((start + length) * am.SR)]
    col = np.abs(y[:len(y) // n * n]).reshape(n, -1).max(axis=1); return col / (col.max() + 1e-9)


def onbeat(music, sources, start, length):
    """Cuts on the beat: audio_markers finds the music's beats; the shot changes on every second one, the beat ticks
    light up under a playhead, and the clip plays the music it was cut to."""
    import audio_markers as am
    bpm, b = am.beats(am.load(ROOT / music)); b = [t - start for t in b if start <= t < start + length]
    cuts = b[::2]; clips = [T.frames(s, 0.4, length) for s in sources]; out = []; fs = T.font(13, 700)
    env = _env(music, start, length, 160); lane = (34, H - 62, W - 34, H - 22)
    for i in range(int(length * FPS)):
        t = i / FPS; shot = sum(1 for c in cuts if c <= t) - 1
        cl = clips[max(shot, 0) % len(clips)]; im = T.rgba(cl[i % len(cl)]); d = ImageDraw.Draw(im, "RGBA")
        since = min([t - c for c in cuts if c <= t] or [9])
        if since < .1: d.rectangle([0, 0, W, H], fill=(247, 249, 242, int(90 * (1 - since / .1))))
        d.rounded_rectangle([lane[0] - 12, lane[1] - 44, lane[2] + 12, lane[3] + 10], 12, fill=(10, 33, 31, 225))
        x0, x1, mid = lane[0], lane[2], (lane[1] + lane[3]) / 2
        for k, v in enumerate(env):
            x = x0 + (x1 - x0) * k / len(env); hh = max(1, v * (lane[3] - lane[1]) / 2)
            d.line([x, mid - hh, x, mid + hh], fill=(141, 253, 186, 150), width=2)
        for j, bt in enumerate(b):   # the markers as After Effects draws them, above the wave; the cut ones in Spark
            x = x0 + (x1 - x0) * bt / length; on = bt in cuts; lit = 0 <= t - bt < .3; r = 7 if on else 4
            col = (SPARK + (255,)) if on else (CLOUD + (120,))
            d.polygon([(x - r, lane[1] - 12), (x + r, lane[1] - 12), (x, lane[1] - 12 + r * 1.3)], fill=col)
            if lit and on: d.line([x, lane[1] - 4, x, lane[3] + 4], fill=SPARK + (255,), width=3)
        px = x0 + (x1 - x0) * t / length; d.line([px, lane[1] - 8, px, lane[3] + 6], fill=CORAL, width=2)
        d.text((x0, lane[1] - 40), f"MUSIC · {bpm:g} BPM · a cut on every second beat", font=fs, fill=CLOUD)
        T.chip(d, 16, 16, "audio_markers · beats", 14)
        out.append(np.asarray(im.convert("RGB")))
    return out


def duck(vo, music, length, vo_at=0.6, duck_db=-9):
    """The music ducks under the voice: two lanes, the phrases audio_markers found, the music dipping under each one
    and coming back, and the timing table; it plays the mix it shows."""
    import audio_markers as am
    v = am.load(ROOT / vo); m = am.load(ROOT / music)[:int(length * am.SR)]; ph = [[a + vo_at, e + vo_at] for a, e in am.phrases(v)]
    g = np.ones(len(m), np.float32)
    for a, e in ph:   # same shape as the AE keys: 0.12 s attack, hold, 0.35 s release
        t = np.arange(len(m)) / am.SR; low = 10 ** (duck_db / 20)
        k = np.clip(np.minimum((t - (a - .12)) / .12, 1 - (t - e) / .35), 0, 1); g = np.minimum(g, 1 - k * (1 - low))
    mix = m * .5 * g; s = int(vo_at * am.SR); mix[s:s + len(v)] += v[:len(mix) - s] * .9
    wav = ROOT / "research" / "mcp" / "_duck_mix.wav"; wav.parent.mkdir(parents=True, exist_ok=True)
    subprocess.run(["ffmpeg", "-v", "error", "-y", "-f", "f32le", "-ar", str(am.SR), "-ac", "1", "-i", "-", str(wav)], input=(mix / max(1e-9, np.abs(mix).max()) * .9).astype(np.float32).tobytes(), check=True)
    n = 150; venv = np.zeros(n); ve = _env(vo, 0, length, n); sh = int(vo_at / length * n); venv[sh:] = ve[:n - sh]
    menv = np.convolve(_env(music, 0, length, n), np.ones(5) / 5, mode="same"); menv = .35 + .65 * menv / menv.max()   # its level, not its spikes
    gm = g[np.linspace(0, len(g) - 1, n).astype(int)]
    out = []; fs, fb = T.font(13, 700), T.font(15, 600); x0, x1 = 34, W - 210
    lanes = [("VOICE", venv, (216, 255, 133), 96), ("MUSIC", menv * gm, (141, 253, 186), 196)]
    for i in range(int(length * FPS)):
        t = i / FPS; im = Image.new("RGBA", (W, H), PINE + (255,)); d = ImageDraw.Draw(im, "RGBA")
        T.chip(d, 16, 16, "audio_markers · phrases · duck", 14)
        for name, env, col, y in lanes:
            d.text((x0, y - 46), name, font=fs, fill=CLOUD)
            for k in range(n):
                x = x0 + (x1 - x0) * k / n; hh = max(1, env[k] * 34); a = 255 if k / n <= t / length else 70
                d.line([x, y - hh, x, y + hh], fill=col + (a,), width=2)
        lv = [(x0 + (x1 - x0) * k / n, 238 - 24 * (1 - (20 * np.log10(max(gm[k], 1e-4)) / duck_db))) for k in range(n)]   # the music's level line
        d.line(lv, fill=(161, 212, 255, 230), width=2); d.text((x1 + 8, 206), "0 dB", font=fs, fill=(161, 212, 255)); d.text((x1 + 8, 230), f"{duck_db} dB", font=fs, fill=(161, 212, 255))
        for j, (a, e) in enumerate(ph):   # phrase markers with their length, as on the layer
            xa, xe = x0 + (x1 - x0) * a / length, x0 + (x1 - x0) * e / length
            d.rounded_rectangle([xa, 136, xe, 146], 4, fill=(216, 255, 133, 220)); d.text((xa, 150), f"phrase {j + 1}", font=fs, fill=SPARK)
        d.text((x0, 292), f"Music {duck_db} dB under the voice, back in 0.35 s", font=fb, fill=CLOUD)
        px = x0 + (x1 - x0) * t / length; d.line([px, 40, px, 270], fill=CORAL, width=2)
        tx = W - 180; d.text((tx, 52), "TIMING TABLE", font=fs, fill=SPARK)
        for j, (a, e) in enumerate(ph):
            on = a <= t <= e; d.text((tx, 80 + j * 26), f"{j + 1}   {a:5.2f} – {e:5.2f} s", font=fb, fill=SPARK if on else CLOUD)
        out.append(np.asarray(im.convert("RGB")))
    return out, wav


JOBS = {
    "brand-curves": lambda: panel("docs/screens/cep-brand-share.gif", "Your brand, applied", ["Its curves, timings and rules", "on every move in this comp."], 4.4),
    "brand-note": lambda: panel("docs/screens/cep-brand-learns.gif", "A note becomes a rule", ["Say it once in review:", "every next project follows it."], 5.6),
    "figma-storyboard": lambda: cut("library/guide/agent-timeline.mp4", 0, 4.6),
    "figma-qa": lambda: qa("library/packs/modern.mp4", 3.4),
    "resize": lambda: resize("library/packs/playful.mp4", 3.4),
    "check": lambda: check("library/packs/dynamic.mp4", 3.4),
    "video-ref": lambda: video_ref("media/motion_dna_teaser/video/G1_rex_entrance.mp4", 4.2),
    "on-beat": lambda: (onbeat("media/motion_dna_teaser/audio/music_teaser_v1.mp3", ["media/motion_dna_teaser/video/G1_rex_entrance.mp4", "media/motion_dna_teaser/video/G5_robot_closeup.mp4", "media/motion_dna_teaser/video/G6_dana_curious.mp4", "media/motion_dna_teaser/video/G4_binder_desk.mp4"], 1.6, 4.4),
                        ("media/motion_dna_teaser/audio/music_teaser_v1.mp3", 1.6, 4.4)),
    "duck": lambda: duck("media/motion_dna_teaser/audio/vo_dana_every.mp3", "media/motion_dna_teaser/audio/music_teaser_v1.mp3", 4.2),
}

if __name__ == "__main__":
    OUT.mkdir(parents=True, exist_ok=True)
    for s in sys.argv[1:] or list(JOBS):
        fr = JOBS[s](); snd = None
        if isinstance(fr, tuple):   # (frames, sound): a (file, start, length) span, or a mixed file
            fr, snd = fr; snd = snd if isinstance(snd, tuple) else (str(snd), 0, len(fr) / FPS)
        T.encode(fr, OUT / f"{s}.webm", sound=snd); Image.fromarray(fr[int(len(fr) * .7)]).save(OUT / f"{s}.jpg", quality=84)
        print(f"library/prompts/{s}.webm", (OUT / f"{s}.webm").stat().st_size // 1024, "KB")
