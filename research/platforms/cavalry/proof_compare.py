"""Both files are decoded with the same BT.709 matrix (the AE file is untagged, the Cavalry one is tagged BT.709: their
YUV is the same, so decoding by the tags alone would add a ~3-level colour offset that is not animation).
Compare the Cavalry proof render with the After Effects reference: frames at fixed times side by side + mean abs diff.
Usage: python proof_compare.py [tag]   (writes out/proof/cmp/<tag>_*.png and prints the per-frame MAD)"""
import os, subprocess, sys
from PIL import Image, ImageChops, ImageStat
HERE = os.path.dirname(os.path.abspath(__file__))
P = os.path.normpath(os.path.join(HERE, "..", "out", "proof"))
AE = "D:/motion category ai library/renders/mcp/MDNA_PROOF_SPROOF.mp4"
CAV = os.path.join(P, "proof_cavalry.mp4")
TIMES = [0.30, 0.55, 1.00, 1.90, 3.10]
tag = sys.argv[1] if len(sys.argv) > 1 else "now"
if len(sys.argv) > 2: CAV = sys.argv[2]   # another render to score
out = os.path.join(P, "cmp"); os.makedirs(out, exist_ok=True)
def grab(src, t, dst):
    # frame-accurate: select by frame index at 30 fps
    n = round(t * 30)
    subprocess.run(["ffmpeg", "-v", "error", "-y", "-i", src, "-vf", r"select=eq(n\,%d),scale=1920:1080:in_color_matrix=bt709:in_range=tv:out_range=pc,format=rgb24" % n, "-frames:v", "1", dst], check=True)
    return Image.open(dst).convert("RGB")
rows, res = [], []
for t in TIMES:
    a = grab(AE, t, os.path.join(out, f"ae_{t:.2f}.png")); cp = os.path.join(out, f"{tag}_cav_{t:.2f}.png")
    c = Image.open(cp).convert("RGB") if CAV == "saved" else grab(CAV, t, cp)
    d = sum(ImageStat.Stat(ImageChops.difference(a, c)).mean) / 3
    res.append((t, d)); rows.append((a, c))
W, H = 960, 540
sheet = Image.new("RGB", (W * 2, H * len(rows)))
for i, (a, c) in enumerate(rows):
    sheet.paste(a.resize((W, H)), (0, i * H)); sheet.paste(c.resize((W, H)), (W, i * H))
sheet.save(os.path.join(out, f"{tag}_sheet.png"))
for t, d in res: print(f"t={t:.2f}s  MAD={d:.2f}")
print("mean", sum(d for _, d in res) / len(res))
