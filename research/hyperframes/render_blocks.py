"""Renders a chosen set of HyperFrames registry blocks in Motion DNA's colours and curves (through hf.py's project
setup), one project each, and makes the library guide's previews: library/hyperframes/<block>.webm + .jpg.
Blocks that imitate a real product or brand (chat apps, social networks, an OS) are left out.

Usage: python research/hyperframes/render_blocks.py [block ...]
"""
import glob
import json
import os
import re
import subprocess
import sys

HERE = os.path.dirname(os.path.abspath(__file__)); ROOT = os.path.abspath(os.path.join(HERE, "..", ".."))
sys.path.insert(0, HERE); import hf  # noqa: E402

# kept after review: the others need their own footage (camcorder-hud, freeze-frame-dressing, rack-focus, the split
# transitions), keep colours of their own (aurora, cosmic-orb, flowing-gradient) or show a placeholder brand (extruded-logo)
BLOCKS = ["data-chart", "bar-chart-race", "mk-line-graph", "ai-answer-rank", "app-showcase", "hw-text-cloud"]
OUT = os.path.join(ROOT, "library", "hyperframes")


PAL = {"bg": "#0A211F", "fg": "#F7F9F2", "mid": "#9FD8C2", "line": "#174A46", "acc": ["#D8FF85", "#FF8A6B", "#7FB8FF", "#9FD8C2"]}


def restyle(path):
    """Blocks paint with their own hard-coded colours and fonts: map them onto Motion DNA's by role (light grounds to
    Pine, dark ink to Cloud, greys to Mint or Sea, each saturated hue to the next accent) and use our two faces."""
    import colorsys
    s = open(path, encoding="utf-8").read(); acc = {}
    def role(hx):
        h = hx.lstrip("#"); h = "".join(c * 2 for c in h) if len(h) == 3 else h[:6]
        r, g, b = (int(h[i:i + 2], 16) / 255 for i in (0, 2, 4)); hh, l, sat = colorsys.rgb_to_hls(r, g, b)
        if sat > .35 and .2 < l < .85:
            k = round(hh * 12) % 12; acc.setdefault(k, PAL["acc"][len(acc) % len(PAL["acc"])]); return acc[k]
        return PAL["bg"] if l > .82 else PAL["fg"] if l < .3 else PAL["mid"] if l < .6 else PAL["line"]
    s = re.sub(r"#[0-9a-fA-F]{6}|#[0-9a-fA-F]{3}", lambda m: role(m.group(0)), s)
    s = re.sub(r"(background(?:-color)?\s*:\s*)white", lambda m: m.group(1) + PAL["bg"], s)
    s = re.sub(r"font-family\s*:\s*([^;\"']+|'[^']*'[^;\"]*|\"[^\"]*\"[^;]*)", lambda m: "font-family: " + ("'Instrument Serif', serif" if "serif" in m.group(1).lower() and "sans" not in m.group(1).lower() else "'Inter Tight', sans-serif"), s)
    open(path, "w", encoding="utf-8").write(s)


def one(name):
    cat = json.load(open(os.path.join(HERE, "catalog.json"), encoding="utf-8")); items = cat["items"] if "items" in cat else cat
    meta = next(x for x in items if x["name"] == name); w, h = meta.get("dimensions", {}).get("width", 1920), meta.get("dimensions", {}).get("height", 1080)
    dur = min(float(meta.get("duration", 5)), 8.0); proj = "g_" + name.replace("-", "_"); pdir = os.path.join(hf.PROJECTS, proj)
    if not os.path.exists(pdir): hf.new(proj, "square" if w == h else "portrait" if h > w else "landscape")
    import shutil; shutil.rmtree(os.path.join(pdir, "compositions"), ignore_errors=True)   # a fresh copy of the block each run, then restyled
    hf.add(proj, name)
    src = next(iter(glob.glob(os.path.join(pdir, "compositions", "**", name + ".html"), recursive=True)), None)
    if not src: raise RuntimeError("block not installed: " + name)
    restyle(src); rel = os.path.relpath(src, pdir).replace(os.sep, "/")
    idx = os.path.join(pdir, "index.html"); hdoc = open(idx, encoding="utf-8").read()
    root = (f'<div id="root" data-composition-id="main" data-start="0" data-duration="{dur}" data-width="{w}" data-height="{h}">'
            f'<div id="b" data-composition-id="{name}" data-composition-src="{rel}" data-start="0" data-duration="{dur}" data-width="{w}" data-height="{h}" data-track-index="1"></div></div>'
            '<script>const tl = gsap.timeline({ paused: true }); window.__timelines["main"] = tl; tl.seek(0);</script>')
    hdoc = re.sub(r"<body>.*</body>", "<body>" + root + "</body>", hdoc, flags=re.S); open(idx, "w", encoding="utf-8").write(hdoc)
    hf.render(proj, draft=True)
    mp4 = os.path.join(pdir, "renders", proj + ".mp4"); os.makedirs(OUT, exist_ok=True)
    subprocess.run(["ffmpeg", "-v", "error", "-y", "-i", mp4, "-vf", "scale='min(960,iw)':-2,format=yuv420p", "-c:v", "libvpx-vp9", "-b:v", "0", "-crf", "34", "-an", os.path.join(OUT, name + ".webm")], check=True)
    subprocess.run(["ffmpeg", "-v", "error", "-y", "-ss", str(dur * .6), "-i", mp4, "-frames:v", "1", "-vf", "scale=640:-2", "-q:v", "4", os.path.join(OUT, name + ".jpg")], check=True)
    return name


if __name__ == "__main__":
    for b in sys.argv[1:] or BLOCKS:
        try: print("ok", one(b))
        except Exception as e: print("FAIL", b, str(e)[:200])
