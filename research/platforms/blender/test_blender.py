"""Smoke test and demo for Motion DNA in Blender: every portable preset applies in and out without errors, the token
curves match their cubic-bezier, and a short demo renders to research/platforms/blender/out/.
Run: blender -b --factory-startup -P research/platforms/blender/test_blender.py
"""
import math
import pathlib
import sys

import bpy

HERE = pathlib.Path(__file__).resolve().parent
sys.path.insert(0, str(HERE))
import mdna_blender as M   # noqa: E402

OUT = HERE / "out"; OUT.mkdir(exist_ok=True)


def scene():
    bpy.ops.wm.read_factory_settings(use_empty=True)
    sc = bpy.context.scene
    sc.render.fps, sc.frame_start, sc.frame_end = 30, 0, 75
    sc.render.resolution_x, sc.render.resolution_y = 960, 540
    sc.render.engine = "BLENDER_EEVEE" if "BLENDER_EEVEE" in bpy.types.RenderSettings.bl_rna.properties["engine"].enum_items.keys() else "BLENDER_EEVEE_NEXT"
    sc.view_settings.view_transform = "Standard"
    sc.world = bpy.data.worlds.new("bg"); sc.world.use_nodes = True
    sc.world.node_tree.nodes["Background"].inputs[0].default_value = (0.012, 0.03, 0.026, 1)
    cam = bpy.data.objects.new("cam", bpy.data.cameras.new("cam")); sc.collection.objects.link(cam)
    cam.data.type = "ORTHO"; cam.data.ortho_scale = 10.67
    cam.location = (0, -10, 0); cam.rotation_euler = (math.pi / 2, 0, 0); sc.camera = cam
    return sc


def mat(name, rgb, emit=1.0):
    m = bpy.data.materials.new(name); m.use_nodes = True
    b = m.node_tree.nodes["Principled BSDF"]
    b.inputs["Base Color"].default_value = (*rgb, 1); b.inputs["Emission Color"].default_value = (*rgb, 1)
    b.inputs["Emission Strength"].default_value = emit
    return m


def text(body, size, loc, rgb, font=None):
    c = bpy.data.curves.new(body, "FONT"); c.body = body; c.size = size; c.align_x = "CENTER"; c.align_y = "CENTER"
    if font:
        c.font = bpy.data.fonts.load(str(font))
    o = bpy.data.objects.new(body, c); bpy.context.scene.collection.objects.link(o)
    o.rotation_euler = (math.pi / 2, 0, 0); o.location = loc
    c.materials.append(mat(body + "_m", rgb))
    return o


def plane(name, w, h, loc, rgb):
    bpy.ops.mesh.primitive_plane_add(size=1); o = bpy.context.object; o.name = name
    o.rotation_euler = (math.pi / 2, 0, 0); o.location = loc; o.scale = (w, h, 1)
    o.data.materials.append(mat(name + "_m", rgb, 0.6))
    return o


# 1. every portable preset, in and out
fails = []
for name in M.portable():
    sc = scene()
    ob = plane("probe", 2, 2, (0, 0, 0), (0.4, 0.8, 0.6))
    for ph, st in (("in", 0), ("out", 40)):
        try:
            M.apply(ob, name, ph, st)
        except Exception as e:
            fails.append(f"{name} {ph}: {e}")
print(f"MDNA_TEST {len(M.portable()) - len({f.split(' ')[0] for f in fails})}/{len(M.portable())} presets applied in and out", "· failures:", fails or "none")

# 2. the curve check: Land on a position channel against the CSS cubic-bezier
def css(x1, y1, x2, y2, x):
    lo, hi = 0.0, 1.0
    for _ in range(60):
        t = (lo + hi) / 2; bx = 3 * (1 - t) ** 2 * t * x1 + 3 * (1 - t) * t * t * x2 + t ** 3
        lo, hi = (t, hi) if bx < x else (lo, t)
    t = (lo + hi) / 2; return 3 * (1 - t) ** 2 * t * y1 + 3 * (1 - t) * t * t * y2 + t ** 3
sc = scene(); ob = plane("probe", 2, 2, (0, 0, 0), (0.4, 0.8, 0.6))
M.apply(ob, "Fade Up", "in", 0)
fc = M._fcurve(ob, "location", 2)
v0, v1 = fc.evaluate(0), fc.evaluate(14)
err = max(abs(fc.evaluate(14 * i / 20) - (v0 + (v1 - v0) * css(*M.EASE["Land"], i / 20))) / abs(v1 - v0) for i in range(21))
print(f"MDNA_CURVE Fade Up position (Land) max error vs token: {err * 100:.3f}%")

# 3. demo: a title, a card and three chips with three presets
sc = scene()
fonts = sorted((M.ROOT / "assets/fonts").glob("*.ttf"))
bold = next((f for f in fonts if "Bold" in f.name or "SemiBold" in f.name), None)
card = plane("Card", 7.2, 2.2, (0, 0.2, 0.3), (0.02, 0.16, 0.13))
title = text("Motion DNA", 0.95, (0, 0, 0.5), (0.75, 0.95, 0.35), bold)
sub = text("Blender · token curves", 0.32, (0, 0, -0.35), (0.85, 0.92, 0.9), bold)
chips = [plane(f"Chip{i}", 0.5, 0.5, (-1.2 + i * 1.2, 0.1, -1.9), (0.75, 0.95, 0.35)) for i in range(3)]
M.apply(card, "Scale Pop", "in", 0)
M.apply(title, "Surge Rise", "in", 6)
M.apply(sub, "Fade Up", "in", 14)
for i, c in enumerate(chips):
    M.apply(c, "Bounce In", "in", 22 + i * 4)
for f in (8, 16, 24, 40, 70):
    sc.frame_set(f); sc.render.filepath = str(OUT / f"demo_{f:02d}.png"); bpy.ops.render.render(write_still=True)
sc.render.image_settings.file_format = "PNG"   # Blender 5 moved video out of file_format: PNGs, then ffmpeg
sc.render.filepath = str(OUT / "seq" / "f_"); bpy.ops.render.render(animation=True)
bpy.ops.wm.save_as_mainfile(filepath=str(OUT / "demo.blend"))
print("MDNA_DONE", OUT)
