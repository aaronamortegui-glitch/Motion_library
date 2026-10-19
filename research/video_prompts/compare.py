"""Side-by-side test: our template render (left) next to the Skillry remake of the prompt it was inspired by (right),
the remake recoloured with a gradient map in the Motion DNA palette (dark → light: ink, pine, sea, mint, spark, cloud),
so form, density and detail are compared without the colour getting in the way.
Writes renders/compare_reel.mp4 (local only: the remakes are third-party, see source/remakes).
Usage: python research/video_prompts/compare.py [seconds per pair, default 10]   (run fetch_sources.py first)
"""
import os, subprocess, sys
import numpy as np
from PIL import Image

HERE = os.path.dirname(os.path.abspath(__file__)); R = os.path.join(HERE, "renders"); RM = os.path.join(HERE, "source", "remakes")
ROOT = os.path.abspath(os.path.join(HERE, "..", ".."))
FONT = os.path.join(ROOT, "assets", "fonts", "static", "InterTight-SemiBold.ttf").replace("\\", "/").replace(":", "\\:")
SEC = float(sys.argv[1]) if len(sys.argv) > 1 else 10
STOPS = [(0.0, "04120F"), (0.25, "0A211F"), (0.45, "174A46"), (0.65, "9FD8C2"), (0.85, "D8FF85"), (1.0, "F7F9F2")]

def hald(path, level=8):   # Hald CLUT (level 8 = 512 x 512) mapping each colour by its luminance onto the gradient
    n = level * level; idx = np.arange(n ** 3); r, g, b = idx % n, (idx // n) % n, idx // (n * n)
    lum = (0.2126 * r + 0.7152 * g + 0.0722 * b) / (n - 1)
    xs = [s[0] for s in STOPS]; cols = np.array([[int(c[i:i + 2], 16) for i in (0, 2, 4)] for _, c in STOPS], dtype=float)
    out = np.stack([np.interp(lum, xs, cols[:, ch]) for ch in range(3)], axis=1).astype(np.uint8)
    side = level ** 3; Image.fromarray(out.reshape(side, side, 3), "RGB").save(path)

def main():
    PAIRS = [("t01_showreel", "t01"), ("t03_morph_ui", "t03"), ("t06_storybook_explainer", "t06"), ("t07_timeline", "t07"), ("t09_particle_world", "t09"), ("t02_saas_launch", "t02"), ("t04_infinite_zoom", "t04"), ("t10_shader_hero", "t10")]
    lut = os.path.join(R, "_mdna_gradient_hald.png"); hald(lut)
    parts = []
    for ours, tag in PAIRS:
        rm = next((os.path.join(RM, f) for f in os.listdir(RM) if f.startswith(tag + "_")), None)
        o = next((os.path.join(R, ours + e) for e in (".mp4", ".mov") if os.path.exists(os.path.join(R, ours + e))), None)
        if not rm or not o: continue
        out = os.path.join(R, f"_cmp_{tag}.mp4"); parts.append(out)
        fc = (f"[0:v]trim=0:{SEC},setpts=PTS-STARTPTS,scale=960:540,fps=30,setsar=1,drawtext=fontfile='{FONT}':text='OURS · {ours}':x=24:y=20:fontsize=22:fontcolor=0xF7F9F2:box=1:boxcolor=0x0A211Fcc:boxborderw=8[a];"
              f"[1:v]trim=0:{SEC},setpts=PTS-STARTPTS,scale=960:540:force_original_aspect_ratio=decrease,pad=960:540:(ow-iw)/2:(oh-ih)/2:color=0x04120F,fps=30,setsar=1[r0];"
              f"[r0][2:v]haldclut,drawtext=fontfile='{FONT}':text='REMAKE (gradient-mapped) · {os.path.basename(rm)[4:-4]}':x=24:y=20:fontsize=22:fontcolor=0xF7F9F2:box=1:boxcolor=0x0A211Fcc:boxborderw=8[b];"
              f"[a][b]hstack=2,pad=1920:1080:0:270:color=0x04120F,format=yuv420p")
        subprocess.run(["ffmpeg", "-v", "error", "-y", "-i", o, "-i", rm, "-loop", "1", "-i", lut, "-filter_complex", fc, "-t", str(SEC), "-an", "-c:v", "libx264", "-crf", "20", "-preset", "fast", out], check=True)
    lst = os.path.join(R, "_cmp.txt"); open(lst, "w").write("".join(f"file '{p.replace(os.sep, '/')}'\n" for p in parts))
    subprocess.run(["ffmpeg", "-v", "error", "-y", "-f", "concat", "-safe", "0", "-i", lst, "-c", "copy", os.path.join(R, "compare_reel.mp4")], check=True)
    for p in parts: os.remove(p)
    os.remove(lst); print("renders/compare_reel.mp4 ·", len(parts), "pairs")


if __name__ == "__main__":
    main()
