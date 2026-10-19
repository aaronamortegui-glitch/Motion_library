"""The proof: the same Figma frame animated with the same choreography in After Effects, Cavalry and Blender, side by
side (2×2: the Figma frame, AE, Cavalry, Blender), plus a sheet of key frames and the mean pixel difference to AE.
Usage: python research/platforms/proof_compare.py <proof folder> <AE render.mp4>
       (the folder holds reference.png (Figma), proof_cavalry.mp4 and proof_blender.mp4; writes proof_compare.mp4,
        proof_sheet.png and prints the differences)
"""
import pathlib
import subprocess
import sys

P, AE = pathlib.Path(sys.argv[1]), pathlib.Path(sys.argv[2])
FONT = (pathlib.Path(__file__).resolve().parents[2] / "assets/fonts/static/InterTight-SemiBold.ttf").as_posix().replace(":", "\\:")
inputs = [("Figma frame", P / "reference.png"), ("After Effects", AE), ("Cavalry", P / "proof_cavalry.mp4"), ("Blender", P / "proof_blender.mp4")]
args = ["ffmpeg", "-v", "error", "-y"]
for i, (_, f) in enumerate(inputs):
    args += (["-loop", "1", "-t", "3.2"] if f.suffix == ".png" else []) + ["-i", str(f)]
lab = lambda i, t: (f"[{i}]scale=960:540,fps=30,trim=duration=3.2,setpts=PTS-STARTPTS,"
                    f"drawbox=x=0:y=0:w=iw:h=44:color=black@0.55:t=fill,"
                    f"drawtext=fontfile='{FONT}':text='{t}':x=18:y=11:fontsize=24:fontcolor=white[v{i}]")
fc = ";".join(lab(i, t) for i, (t, _) in enumerate(inputs)) + ";[v0][v1][v2][v3]xstack=inputs=4:layout=0_0|w0_0|0_h0|w0_h0[out]"
subprocess.run(args + ["-filter_complex", fc, "-map", "[out]", "-c:v", "libx264", "-pix_fmt", "yuv420p", "-crf", "17", str(P / "proof_compare.mp4")], check=True)

# key frames AE | Cavalry | Blender, and the difference to AE
from PIL import Image, ImageChops, ImageStat
rows, report = [], []
for t in (0.30, 0.55, 1.00, 1.90, 3.10):
    ims = []
    for _, f in inputs[1:]:
        out = P / f"_k_{f.stem}_{t:.2f}.png"
        subprocess.run(["ffmpeg", "-v", "error", "-y", "-ss", f"{t}", "-i", str(f), "-frames:v", "1", str(out)], check=True)
        ims.append(Image.open(out).convert("RGB"))
    d = [sum(ImageStat.Stat(ImageChops.difference(ims[0], im)).mean) / 3 for im in ims[1:]]
    report.append(f"t={t:.2f}s  mean |diff| to AE: Cavalry {d[0]:.2f}  Blender {d[1]:.2f}  (0-255)")
    row = Image.new("RGB", (3 * 640, 360))
    for i, im in enumerate(ims):
        row.paste(im.resize((640, 360)), (i * 640, 0))
    rows.append(row)
sheet = Image.new("RGB", (1920, 360 * len(rows)))
for i, r in enumerate(rows):
    sheet.paste(r, (0, i * 360))
sheet.save(P / "proof_sheet.png")
for f in P.glob("_k_*.png"):
    f.unlink()
print("\n".join(report))
print("wrote", P / "proof_compare.mp4", "and", P / "proof_sheet.png")
