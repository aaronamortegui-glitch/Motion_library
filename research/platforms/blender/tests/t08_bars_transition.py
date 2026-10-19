"""Test 8 · Solid transition "bars" over the full frame (AE kit: solid_transition bars / blinds).

N horizontal planes (mesh origin on the left edge, so scale X grows from the left) cover the frame height; each bar
keys scale X 0 -> full with Surge (in, staggered top to bottom) then moves its origin side: the "out" is a
location X slide off to the right with Launch, same stagger. A scene title underneath is swapped at the covered frame (17).
The frame size in world units comes from the ortho camera: width = ortho_scale, height = ortho_scale * h / w.
Run: blender -b --factory-startup -P research/platforms/blender/tests/t08_bars_transition.py
"""
import pathlib
import sys
sys.path.insert(0, str(pathlib.Path(__file__).resolve().parent))
import bpy  # noqa: E402
import common as C  # noqa: E402

sc = C.scene(frames=50)
cam = sc.camera.data
W = cam.ortho_scale; H = W * sc.render.resolution_y / sc.render.resolution_x
font = C.bold_font()
a = C.text("Scene A", 1.2, (0, 0.5, 0), (0.85, 0.92, 0.9), font)
b = C.text("Scene B", 1.2, (0, 0.5, 0), (0.75, 0.95, 0.35), font)
# swap A/B while covered (frame 17): constant visibility keys
for o, vis in ((a, [(0, False), (17, True)]), (b, [(0, True), (17, False)])):
    for f, hide in vis:
        o.hide_render = hide; o.keyframe_insert("hide_render", frame=f)

NB = 6; bh = H / NB; colors = [(0.75, 0.95, 0.35), (0.02, 0.16, 0.13)]
bars = []
for i in range(NB):
    bpy.ops.mesh.primitive_plane_add(size=1); o = bpy.context.object; o.name = f"Bar{i}"
    for v in o.data.vertices:
        v.co.x += 0.5
    o.rotation_euler = (1.5708, 0, 0)
    o.location = (-W / 2, -0.5, H / 2 - bh * (i + 0.5)); o.scale = (0, bh * 1.02, 1)
    o.data.materials.append(C.emit_mat(f"bar{i}_m", colors[i % 2]))
    s = i * 1.5
    C.key_bezier(o, "scale", 0, s, 0.0, s + 9, W, "Surge")              # in: grow from the left edge
    C.key_bezier(o, "location", 0, 18 + s, -W / 2, 18 + s + 9, W / 2, "Launch")   # out: slide off right
    # keep the out shrinking so the bar trail leaves the frame cleanly
    C.key_bezier(o, "scale", 0, 18 + s, W, 18 + s + 9, 0.0, "Launch")
    bars.append(o)
for f in (5, 12, 17, 24, 36):
    C.render(sc, f, "t08_bars")
print("T08 frame W,H:", round(W, 3), round(H, 3), "bars:", NB)
print("T08_DONE")
