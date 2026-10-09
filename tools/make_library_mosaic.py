"""The whole library in one video: every preset preview (library/mp4/<kind>/<slug>.mp4) playing at once in a grid, each
cell labelled with its name, energy range and tones from library/tags.json. Doubles as a visual test (does every preset
move?) and as a tag review sheet (does the label match what you see?).
  python tools/make_library_mosaic.py   ->  docs/examples/library-mosaic.mp4 + .gif, research/tests/library-mosaic.png
"""
import json
import pathlib
import shutil
import subprocess
import tempfile

ROOT = pathlib.Path(__file__).resolve().parent.parent
COLS, CW, CH, LH, DUR = 8, 236, 133, 40, 2.4
lib = json.load(open(ROOT / "library/library.json", encoding="utf-8"))["presets"]
tags = {t["name"]: t for t in json.load(open(ROOT / "library/tags.json", encoding="utf-8"))["presets"]}
order = {"motion": 0, "text": 1, "fx": 2}
items = sorted([p for p in lib if p["kind"] in order], key=lambda p: (order[p["kind"]], p.get("family") == "classic"))
tmp = pathlib.Path(tempfile.mkdtemp())
font = tmp / "inter.ttf"
shutil.copy(ROOT / "assets/fonts/InterTight[wght].ttf", font)   # no brackets in the filter path
fpath = font.as_posix().replace(":", "\\:")


def esc(s):
    return s.replace("\\", "/").replace(":", "\\:").replace("'", "").replace("%", "\\%").replace(",", "\\,")


args, f = ["ffmpeg", "-v", "error", "-y"], []
for i, p in enumerate(items):
    args += ["-stream_loop", "-1", "-t", str(DUR), "-i", str(ROOT / "library/mp4" / p["kind"] / f'{p["slug"]}.mp4')]
    t = tags.get(p["name"], {})
    line2 = (f'{t["energy"][0]}-{t["energy"][1]} · ' + "/".join(t["tones"])) if t else p["energy"]
    f.append(f"[{i}:v]fps=12,scale={CW}:{CH},pad={CW}:{CH + LH}:0:0:color=0x0A211F,"
             f"drawtext=fontfile='{fpath}':text='{esc(p['name'])}':fontcolor=0xF7F9F2:fontsize=15:x=8:y={CH + 4},"
             f"drawtext=fontfile='{fpath}':text='{esc(line2)}':fontcolor=0xD8FF85:fontsize=12:x=8:y={CH + 22}[c{i}]")
rows = (len(items) + COLS - 1) // COLS
for k in range(len(items), rows * COLS):   # pad the last row
    f.append(f"color=c=0x0A211F:s={CW}x{CH + LH}:d={DUR}:r=12[c{k}]")
layout = "|".join(f"{(k % COLS) * CW}_{(k // COLS) * (CH + LH)}" for k in range(rows * COLS))
f.append("".join(f"[c{k}]" for k in range(rows * COLS)) + f"xstack=inputs={rows * COLS}:layout={layout}[g]")
out = ROOT / "docs/examples/library-mosaic.mp4"
subprocess.run(args + ["-filter_complex", ";".join(f), "-map", "[g]", "-t", str(DUR), "-c:v", "libx264", "-crf", "24", "-pix_fmt", "yuv420p", str(out)], check=True)
subprocess.run(["ffmpeg", "-v", "error", "-y", "-i", str(out), "-vf", "fps=8,scale=960:-1:flags=lanczos,split[a][b];[a]palettegen=max_colors=48:stats_mode=diff[p];[b][p]paletteuse=dither=none:diff_mode=rectangle",
                str(ROOT / "docs/examples/library-mosaic.gif")], check=True)
(ROOT / "research/tests").mkdir(parents=True, exist_ok=True)
subprocess.run(["ffmpeg", "-v", "error", "-y", "-ss", "1.1", "-i", str(out), "-frames:v", "1", str(ROOT / "research/tests/library-mosaic.png")], check=True)
shutil.rmtree(tmp, ignore_errors=True)
print(f"library mosaic: {len(items)} presets, {COLS}x{rows} -> {out}")
