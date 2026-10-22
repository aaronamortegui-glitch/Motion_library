"""Builds the README / catalog previews of the code-rendered templates from their full renders: animated WebP (full
colour, small; GitHub shows it like a GIF), 480 px wide at 15 fps, looping. Alpha renders (.mov) are laid over the
Motion DNA pine. A card in templates/catalog.json may set "preview": [start_s, end_s] to show its best stretch, and "preview_quality"
(default 62) when a busy one (particles, fast cuts) needs to come under 500 KB.

Usage: python research/video_prompts/make_previews.py [t01_showreel t08_data_story ...]   (default: every template with a render)
Renders come from html_to_mp4.py (renders/<id>.mp4 or .mov, git-ignored); previews go to previews/<id>.webp.
"""
import json
import os
import subprocess
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
PINE = "0x0A211F"


def render_of(tid):
    for ext in (".mp4", ".mov"):
        p = os.path.join(HERE, "renders", tid + ext)
        if os.path.exists(p):
            return p
    return None


def make(card, width=480, fps=15, quality=62):
    src = render_of(card["id"])
    if not src:
        return None, "no render (python html_to_mp4.py templates/" + card["file"] + ")"
    out = os.path.join(HERE, "previews", card["id"] + ".webp")
    win = card.get("preview")
    cut = ["-ss", str(win[0]), "-to", str(win[1])] if win else []
    scale = f"fps={fps},scale={width}:-2:flags=lanczos"
    if src.endswith(".mov"):   # alpha: lay it over the pine background
        vf = f"color=c={PINE}:s=1920x1080:r={fps}[bg];[0:v]format=rgba[fg];[bg][fg]overlay=shortest=1,{scale}"
        args = ["-filter_complex", vf]
    else:
        args = ["-vf", scale]
    cmd = ["ffmpeg", "-v", "error", "-y", *cut, "-i", src, *args, "-c:v", "libwebp_anim", "-lossless", "0",
           "-q:v", str(quality), "-compression_level", "6", "-loop", "0", "-an", out]
    r = subprocess.run(cmd, capture_output=True, text=True)
    if r.returncode != 0:
        return None, r.stderr.strip()[-300:]
    return out, f"{os.path.getsize(out) // 1024} KB"


def main():
    cat = json.load(open(os.path.join(HERE, "templates", "catalog.json"), encoding="utf-8"))["templates"]
    want = set(sys.argv[1:])
    for card in cat:
        if want and card["id"] not in want:
            continue
        out, msg = make(card, quality=card.get("preview_quality", 62))
        print(f"{card['id']:28} {msg}")


if __name__ == "__main__":
    main()
