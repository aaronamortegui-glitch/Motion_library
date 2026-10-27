"""The social carousel library: every style of templates/t16_carousel.html rendered to library/carousels/<style>.webm
(+ .jpg poster), 4:5 like an Instagram or LinkedIn post. A temporary copy per style sets VARS.style.

Usage: python research/video_prompts/carousels.py snap [style ...]     # contact sheet per style (research/video_prompts/renders/)
       python research/video_prompts/carousels.py render [style ...]   # the WebMs for the library guide
"""
import os
import re
import subprocess
import sys

HERE = os.path.dirname(os.path.abspath(__file__)); ROOT = os.path.abspath(os.path.join(HERE, "..", ".."))
SRC = os.path.join(HERE, "templates", "t16_carousel.html"); OUT = os.path.join(ROOT, "library", "carousels")
STYLES = ["coverflow", "cube", "cylinder", "stack", "flip", "panorama", "orbit", "fan", "strip", "swipe", "depth"]


def copy(style):
    s = open(SRC, encoding="utf-8").read(); s = re.sub(r'style: "[a-z-]+"', f'style: "{style}"', s, count=1)
    p = os.path.join(HERE, "templates", f"_t16_{style}.html"); open(p, "w", encoding="utf-8").write(s); return p


def main():
    cmd, styles = sys.argv[1], sys.argv[2:] or STYLES
    os.makedirs(OUT, exist_ok=True)
    for st in styles:
        p = copy(st)
        try:
            if cmd == "snap":
                subprocess.run([sys.executable, os.path.join(HERE, "snap.py"), p, os.path.join(HERE, "renders", f"t16_{st}_sheet.jpg"), "0.4", "1.6", "2.6", "4.1", "6.8"], check=True)
            else:
                subprocess.run([sys.executable, os.path.join(HERE, "html_to_mp4.py"), p], check=True, capture_output=True)
                mp4 = os.path.join(HERE, "renders", f"_t16_{st}.mp4")
                subprocess.run(["ffmpeg", "-v", "error", "-y", "-i", mp4, "-vf", "scale=540:-2,format=yuv420p", "-c:v", "libvpx-vp9", "-b:v", "0", "-crf", "33", "-row-mt", "1", os.path.join(OUT, st + ".webm")], check=True)
                subprocess.run(["ffmpeg", "-v", "error", "-y", "-ss", "2.4", "-i", mp4, "-frames:v", "1", "-vf", "scale=432:-2", "-q:v", "4", os.path.join(OUT, st + ".jpg")], check=True)
                print(st, os.path.getsize(os.path.join(OUT, st + ".webm")) // 1024, "KB")
        finally:
            os.remove(p)


if __name__ == "__main__":
    main()
