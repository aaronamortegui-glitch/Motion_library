"""Subject matte with InSPyReNet (MIT, github.com/plemeri/InSPyReNet) on the local GPU. A video gives a ProRes 4444 .mov
with alpha, ready for "matte" in a build_scene.jsx spec (text behind people) and for tools/matte_contours.py (strokes);
a still (.jpg/.png/.webp) gives a PNG with alpha (a product or person cut out). The MCP tool `matte` runs this.

Runs in ComfyUI's embedded Python, which has transparent-background + CUDA; the checkpoint comes from the ComfyUI RMBG
models folder (models/RMBG/INSPYRENET/inspyrenet.safetensors), converted once to .pth next to it. No downloads, no cost.
  "<ComfyUI portable>/python_embeded/python.exe" tools/video_matte.py plate.mp4 matte.mov [--size 1920x1080] [--fps 24]
  "<ComfyUI portable>/python_embeded/python.exe" tools/video_matte.py photo.jpg photo_cutout.png
Set SS_COMFY_PORTABLE if ComfyUI is not at the default path (same variable as tools/faceswap_refine.py).
"""
import argparse
import os
import subprocess

import numpy as np
import torch
from PIL import Image

PORTABLE = os.environ.get("SS_COMFY_PORTABLE", r"D:\ComfyUI_windows_portable_nvidia\ComfyUI_windows_portable")
CKPT = os.path.join(PORTABLE, "ComfyUI", "models", "RMBG", "INSPYRENET", "inspyrenet.safetensors")


def remover():
    import safetensors.torch as st
    import transparent_background as tb
    pth = CKPT.replace(".safetensors", ".pth")
    if not os.path.exists(pth):
        torch.save(st.load_file(CKPT), pth)
    return tb.Remover(mode="base", ckpt=pth, device="cuda:0" if torch.cuda.is_available() else "cpu")


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("video"); ap.add_argument("out")
    ap.add_argument("--size", default="1920x1080"); ap.add_argument("--fps", type=float, default=24)
    a = ap.parse_args()
    if os.path.splitext(a.video)[1].lower() in (".jpg", ".jpeg", ".png", ".webp", ".tif", ".tiff"):   # a still: PNG with alpha
        remover().process(Image.open(a.video).convert("RGB"), type="rgba").save(a.out)
        print(f"matte: still -> {a.out}")
        return
    w, h = map(int, a.size.split("x"))
    raw = subprocess.run(["ffmpeg", "-loglevel", "error", "-i", a.video, "-vf", f"fps={a.fps},scale={w}:{h}", "-f", "rawvideo",
                          "-pix_fmt", "rgb24", "-"], capture_output=True, check=True).stdout
    frames = np.frombuffer(raw, np.uint8).reshape(-1, h, w, 3)
    r = remover()
    enc = subprocess.Popen(["ffmpeg", "-loglevel", "error", "-y", "-f", "rawvideo", "-pix_fmt", "rgba", "-s", f"{w}x{h}", "-r", str(a.fps),
                            "-i", "-", "-c:v", "prores_ks", "-profile:v", "4444", "-pix_fmt", "yuva444p10le", a.out], stdin=subprocess.PIPE)
    for i, f in enumerate(frames):
        rgba = np.array(r.process(Image.fromarray(f), type="rgba"))
        enc.stdin.write(rgba.tobytes())
        if i % 24 == 0:
            print(f"  {i}/{len(frames)}", flush=True)
    enc.stdin.close(); enc.wait()
    print(f"matte: {len(frames)} frames -> {a.out}")


if __name__ == "__main__":
    main()
