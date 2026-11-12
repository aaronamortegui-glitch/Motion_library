"""Encode a Motion Deck's media from media.json into assets/ (full) or assets_lite/ (email).

Usage: python media.py [--lite] [--force]
media.json lists films (with sound), loops (a muted cut of a time range) and stills (an image, or a frame of a video).
An existing VP9 WebM given as a film or loop without a time range is copied as is (full) or re-encoded (lite).
Every film and loop also gets a poster <name>.jpg. Needs ffmpeg on PATH and Pillow.
"""
import json, shutil, subprocess, sys
from pathlib import Path
from PIL import Image

HERE = Path(__file__).parent
LITE, FORCE = "--lite" in sys.argv, "--force" in sys.argv
OUT = HERE / ("assets_lite" if LITE else "assets")
OUT.mkdir(exist_ok=True)
spec = json.loads((HERE / "media.json").read_text(encoding="utf-8"))
#            film: width, crf, audio   loop: width, crf    still: side, quality
SET = {"film": (960, 43, "48k"), "loop": (854, 41), "still": (1100, 80)} if LITE else \
      {"film": (None, 32, "96k"), "loop": (1280, 34), "still": (1600, 90)}

def ffmpeg(*a):
    subprocess.run(["ffmpeg", "-v", "error", "-y", *map(str, a)], check=True)

def vp9(src, dst, width, crf, audio=None, ss=None, t=None):
    vf = f"scale='min({width},iw)':-2" if width else "scale=trunc(iw/2)*2:trunc(ih/2)*2"
    a = (["-ss", ss] if ss is not None else []) + ["-i", src] + (["-t", t] if t else [])
    a += ["-vf", vf, "-c:v", "libvpx-vp9", "-b:v", "0", "-crf", crf, "-row-mt", "1", "-deadline", "good", "-cpu-used", "2", "-pix_fmt", "yuv420p"]
    a += ["-c:a", "libopus", "-b:a", audio] if audio else ["-an"]
    ffmpeg(*a, dst)

def poster(video, dst, at=0):
    ffmpeg("-ss", at, "-i", video, "-frames:v", "1", "-vf", f"scale='min({SET['still'][0]},iw)':-2", "-q:v", "3", dst)

for f in spec.get("films", []):
    src, dst = Path(f["src"]), OUT / f"{f['name']}.webm"
    if dst.exists() and not FORCE:
        continue
    w, crf, audio = SET["film"]
    if src.suffix.lower() == ".webm" and not LITE:
        shutil.copy(src, dst)
    else:
        vp9(src, dst, f.get("width", w), f.get("crf", crf), audio)
    poster(src, OUT / f"{f['name']}.jpg", f.get("poster_at", 1))
for f in spec.get("loops", []):
    src, dst = Path(f["src"]), OUT / f"{f['name']}.webm"
    if dst.exists() and not FORCE:
        continue
    w, crf = SET["loop"]
    if src.suffix.lower() == ".webm" and "start" not in f and not LITE:
        shutil.copy(src, dst)
    else:
        vp9(src, dst, f.get("width", w), f.get("crf", crf), None, f.get("start"), f.get("dur", 7))
    poster(dst, OUT / f"{f['name']}.jpg", 0)
for f in spec.get("stills", []):
    src, side, q = Path(f["src"]), *SET["still"]
    ext = ".png" if f.get("png") else ".jpg"
    dst = OUT / f"{f['name']}{ext}"
    if dst.exists() and not FORCE:
        continue
    if src.suffix.lower() in (".mp4", ".mov", ".webm", ".mkv"):
        tmp = OUT / f"_{f['name']}.png"; ffmpeg("-ss", f.get("at", 1), "-i", src, "-frames:v", "1", tmp); src = tmp
    im = Image.open(src)
    if "crop" in f:   # [left, top, right, bottom] as shares of the image
        W, H = im.size; l, t, r, b = f["crop"]; im = im.crop((round(l * W), round(t * H), round(r * W), round(b * H)))
    im.thumbnail((side, side), Image.LANCZOS)
    if ext == ".png":
        im.save(dst, optimize=True)
    else:
        im.convert("RGB").save(dst, quality=q, optimize=True, progressive=True)
    if src.name.startswith("_"):
        src.unlink()

total = sum(p.stat().st_size for p in OUT.iterdir())
for p in sorted(OUT.iterdir()):
    print(f"{p.name:32} {p.stat().st_size / 1e6:6.2f} MB")
print(f"{OUT.name}: {total / 1e6:.1f} MB on disk, about {total * 4 / 3 / 1e6:.1f} MB once inlined")
