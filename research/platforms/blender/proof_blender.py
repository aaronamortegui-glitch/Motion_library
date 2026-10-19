"""Motion DNA proof in Blender: rebuilds the Figma proof frame (out/proof/manifest.json) and plays the After Effects
choreography (out/proof/choreo.json, 12 steps at 30 fps) with the kit, renders PNGs and encodes proof_blender.mp4.
Compare with the After Effects render with compare_proof.py.

Usage: blender -b --factory-startup -P proof_blender.py -- [--frames 9,17,30] [--no-mp4] [--motion-blur]
"""
import json
import pathlib
import subprocess
import sys

import bpy

HERE = pathlib.Path(__file__).resolve().parent
sys.path.insert(0, str(HERE))
args = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else []
bpy.ops.wm.read_factory_settings(use_empty=True)
import mdna_figma as F   # noqa: E402
import mdna_blender as M   # noqa: E402

P = HERE.parent / "out/proof"
ch = json.load(open(P / "choreo.json", encoding="utf-8"))
sc = bpy.context.scene
sc.render.engine = "BLENDER_EEVEE"; sc.render.fps = 30; sc.frame_start, sc.frame_end = 0, ch["frames"] - 1
sc.render.use_motion_blur = "--motion-blur" in args   # the AE reference renders without motion blur
built = F.build(P)
by_id = {b["object"]["mdna_figma"]: b["object"] for b in built}
STRIPE = {18: "29:384", 21: "29:383", 24: "29:385"}   # the stripes in the order After Effects animated them
for st in ch["steps"]:
    ob = by_id[STRIPE[st["at"]]] if st["layer"] == "Rectangle" else next(b["object"] for b in built if b["name"] == st["layer"])
    if st.get("kit"):
        M.kit(st["kit"], [ob], "in", st["at"])
    else:
        M.apply(ob, st["preset"], "in", st["at"])
print("MDNA_STEPS", len(ch["steps"]))
sc.render.image_settings.file_format = "PNG"
out = P / "blender"; out.mkdir(exist_ok=True)
if "--frames" in args:
    for f in [int(x) for x in args[args.index("--frames") + 1].split(",")]:
        sc.frame_set(f); sc.render.filepath = str(out / f"f_{f:04d}.png")
        bpy.ops.render.render(write_still=True)
else:
    sc.render.filepath = str(out / "f_")
    bpy.ops.render.render(animation=True)
    if "--no-mp4" not in args:
        subprocess.run(["ffmpeg", "-v", "error", "-y", "-framerate", "30", "-i", str(out / "f_%04d.png"), "-c:v", "libx264",
                        "-pix_fmt", "yuv420p", "-crf", "16", str(P / "proof_blender.mp4")], check=True)
bpy.ops.wm.save_as_mainfile(filepath=str(P / "proof_blender.blend"))
