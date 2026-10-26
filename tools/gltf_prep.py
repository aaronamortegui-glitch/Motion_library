"""Prepare a 3D model for the web FX pages (helix3d's turntable, opts.model) with glTF-Transform (donmccurdy,
MIT, @gltf-transform/cli 4.5.1 via npx: needs Node 18+).

  inspect   meshes, materials, textures and sizes, to see why a model is heavy
  prep      weld + simplify + quantize, textures to WebP at most 2048 px: a product GLB that loads fast and renders the
            same in three.js (quantization is read natively by its GLTFLoader, no decoder needed)

Usage: python tools/gltf_prep.py inspect model.glb
       python tools/gltf_prep.py prep model.glb [out.glb]     (default: <name>_web.glb next to it)
"""
import os, subprocess, sys

CLI = ["npx", "-y", "@gltf-transform/cli@4.5.1"]


def gt(*args):
    cmd = (["cmd", "/c"] if os.name == "nt" else []) + CLI + list(args)
    return subprocess.run(cmd, check=True, text=True, capture_output=True, encoding="utf-8", errors="replace").stdout


if __name__ == "__main__":
    if len(sys.argv) < 3: sys.exit(__doc__)
    cmd, src = sys.argv[1], sys.argv[2]
    if cmd == "inspect": print(gt("inspect", src))
    elif cmd == "prep":
        out = sys.argv[3] if len(sys.argv) > 3 else os.path.splitext(src)[0] + "_web.glb"
        gt("optimize", src, out, "--compress", "quantize", "--texture-compress", "webp", "--texture-size", "2048", "--simplify", "true")
        print(f"{out}  ({os.path.getsize(src) / 1e6:.1f} MB -> {os.path.getsize(out) / 1e6:.1f} MB)")
    else: sys.exit(__doc__)
