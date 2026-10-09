"""Screenshots of the visualizer (library/index.html) for the README: docs/screens/visualizer.png,
visualizer-dynamic.png (?energy=dynamic) and the animated visualizer.gif.
Headless Edge captures GIFs at their first (empty) frame, so the stills use the posters, and the GIF is composed from
the still plus the preset MP4s overlaid on the first 12 cards. Windows (Edge) — run from the repo root:
  python tools/make_visualizer_screens.py
"""
import os
import pathlib
import re
import shutil
import subprocess
import tempfile
import time

ROOT = pathlib.Path(__file__).resolve().parent.parent
EDGE = next((p for p in [r"C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe",
                         r"C:\Program Files\Microsoft\Edge\Application\msedge.exe"] if os.path.exists(p)), None)
SCREENS = ROOT / "docs" / "screens"


def shot(url, out):
    prof = tempfile.mkdtemp(prefix="edge_")   # a fresh profile per call, or later calls fail silently
    subprocess.run([EDGE, "--headless=new", "--disable-gpu", f"--user-data-dir={prof}", "--window-size=1440,1000",
                    "--hide-scrollbars", "--virtual-time-budget=4000", f"--screenshot={out}", url], capture_output=True)
    for _ in range(30):                        # Edge writes the file a few seconds after returning
        if out.exists() and out.stat().st_mtime > time.time() - 60:
            break
        time.sleep(1)
    shutil.rmtree(prof, ignore_errors=True)


def main():
    html = (ROOT / "library" / "index.html").read_text(encoding="utf-8")
    tmp = ROOT / "library" / "_shot.html"
    tmp.write_text(re.sub(r'"gif": "gifs/([a-z]+)/([a-z0-9-]+)\.gif"', r'"gif": "posters/\1/\2.png"', html), encoding="utf-8")
    url = "file:///" + tmp.as_posix()
    try:
        shot(url, SCREENS / "visualizer.png")
        shot(url + "?energy=dynamic", SCREENS / "visualizer-dynamic.png")
    finally:
        tmp.unlink(missing_ok=True)
    slugs = [p["slug"] for p in __import__("json").loads(re.search(r"const DATA = (\{.*?\});\n", html).group(1))["presets"]][:12]
    xs, ys = [117, 320, 524, 727, 930, 1134], [342, 660]   # thumbnail boxes of the first two card rows at 1440 px
    args = ["ffmpeg", "-v", "error", "-y", "-loop", "1", "-framerate", "12", "-t", "2.4", "-i", str(SCREENS / "visualizer.png")]
    for s in slugs:
        args += ["-t", "2.4", "-i", str(ROOT / "library" / "mp4" / "motion" / f"{s}.mp4")]
    f, last = [], "0:v"
    for i in range(len(slugs)):
        f.append(f"[{i + 1}:v]fps=12,scale=190:107[t{i}]")
        f.append(f"[{last}][t{i}]overlay={xs[i % 6]}:{ys[i // 6] + 14}:shortest=1[o{i}]")
        last = f"o{i}"
    f.append(f"[{last}]scale=720:-1:flags=lanczos,split[a][b];[a]palettegen=max_colors=64:stats_mode=diff[p];[b][p]paletteuse=dither=none:diff_mode=rectangle")
    subprocess.run(args + ["-filter_complex", ";".join(f), str(SCREENS / "visualizer.gif")], check=True)
    print("visualizer screens:", ", ".join(p.name for p in sorted(SCREENS.glob("visualizer*"))))


if __name__ == "__main__":
    main()
