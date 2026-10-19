"""Compares the Blender proof render with the After Effects reference: frames at fixed times, side by side, and the
mean absolute pixel difference per frame (0-255, RGB). Usage: python compare_proof.py [tag] [blender.mp4]"""
import json
import pathlib
import subprocess
import sys

from PIL import Image, ImageChops, ImageDraw, ImageStat

AE = r"D:/motion category ai library/renders/mcp/MDNA_PROOF_SPROOF.mp4"
OUT = pathlib.Path(__file__).resolve().parents[1] / "out/proof"
TIMES = [0.30, 0.55, 1.00, 1.90, 3.10]


def frame(video, t, path):
    subprocess.run(["ffmpeg", "-v", "error", "-y", "-ss", f"{t:.3f}", "-i", video, "-frames:v", "1", str(path)], check=True)
    return Image.open(path).convert("RGB")


def main():
    tag = sys.argv[1] if len(sys.argv) > 1 else "now"
    bl = sys.argv[2] if len(sys.argv) > 2 else str(OUT / "proof_blender.mp4")
    d = OUT / "compare"; d.mkdir(exist_ok=True)
    rows, res = [], {}
    for t in TIMES:
        a = frame(AE, t, d / f"ae_{t:.2f}.png"); b = frame(bl, t, d / f"{tag}_{t:.2f}.png")
        diff = ImageChops.difference(a, b)
        res[f"{t:.2f}"] = round(sum(ImageStat.Stat(diff).mean) / 3, 3)
        w, h = 960, 540
        row = Image.new("RGB", (w * 3, h)); row.paste(a.resize((w, h)), (0, 0)); row.paste(b.resize((w, h)), (w, 0))
        row.paste(ImageChops.multiply(diff, Image.new("RGB", diff.size, (4, 4, 4))).resize((w, h)) if False else diff.point(lambda v: min(255, v * 3)).resize((w, h)), (2 * w, 0))
        ImageDraw.Draw(row).text((10, 10), f"t={t:.2f}s  AE | Blender | diff x3   MAD={res[f'{t:.2f}']}", fill=(255, 255, 0))
        rows.append(row)
    sheet = Image.new("RGB", (rows[0].width, sum(r.height for r in rows)))
    y = 0
    for r in rows:
        sheet.paste(r, (0, y)); y += r.height
    sheet.save(d / f"sheet_{tag}.jpg", quality=88)
    print(json.dumps(res), "mean", round(sum(res.values()) / len(res), 3))


if __name__ == "__main__":
    main()
