"""Cuts a region out of a master frame and upscales it on the local GPU, so close-ups of a set are the same set
(same objects, same screens, same desks) instead of a new generation that drifts. Runs in ComfyUI's Python (spandrel,
the 4x-ClearRealityV1 model from ComfyUI/models/upscale_models); no cost.
  "<ComfyUI portable>/python_embeded/python.exe" tools/upscale_crop.py master.jpg out.jpg --box x0 y0 x1 y1 [--size 3840x2143]
The box is in master pixels; keep its aspect equal to --size so nothing is stretched.
"""
import argparse
import os

import numpy as np
import torch
from PIL import Image

PORTABLE = os.environ.get("SS_COMFY_PORTABLE", r"D:\ComfyUI_windows_portable_nvidia\ComfyUI_windows_portable")
MODEL = os.path.join(PORTABLE, "ComfyUI", "models", "upscale_models", "4x-ClearRealityV1.pth")


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("src"); ap.add_argument("out")
    ap.add_argument("--box", type=int, nargs=4, required=True); ap.add_argument("--size", default="3840x2143")
    a = ap.parse_args()
    import spandrel
    w, h = map(int, a.size.split("x"))
    crop = Image.open(a.src).convert("RGB").crop(tuple(a.box))
    dev = "cuda" if torch.cuda.is_available() else "cpu"
    model = spandrel.ModelLoader().load_from_file(MODEL).to(dev).eval()
    x = torch.from_numpy(np.asarray(crop, dtype=np.float32) / 255).permute(2, 0, 1)[None].to(dev)
    tile, out = 512, None
    with torch.no_grad():   # tiles keep VRAM low on big crops
        _, _, H, W = x.shape; s = model.scale; out = torch.zeros(1, 3, H * s, W * s, device=dev)
        for ty in range(0, H, tile):
            for tx in range(0, W, tile):
                y1, x1 = min(ty + tile, H), min(tx + tile, W)
                pad = 16; py0, px0 = max(ty - pad, 0), max(tx - pad, 0); py1, px1 = min(y1 + pad, H), min(x1 + pad, W)
                o = model(x[:, :, py0:py1, px0:px1])
                out[:, :, ty * s:y1 * s, tx * s:x1 * s] = o[:, :, (ty - py0) * s:(ty - py0 + y1 - ty) * s, (tx - px0) * s:(tx - px0 + x1 - tx) * s]
    img = Image.fromarray((out[0].clamp(0, 1).permute(1, 2, 0).cpu().numpy() * 255).round().astype(np.uint8))
    img.resize((w, h), Image.LANCZOS).save(a.out, quality=92)
    print(a.out, crop.size, "->", (w, h))


if __name__ == "__main__":
    main()
