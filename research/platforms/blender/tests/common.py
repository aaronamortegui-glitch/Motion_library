"""Shared scene setup for the Blender capability tests (research/platforms/blender/tests/t*.py).

Front orthographic camera looking along +Y (screen right = +X, screen up = +Z), EEVEE, 30 fps, emissive flat
materials, PNG output under research/platforms/blender/out/tests/ (git-ignored). Imports mdna_blender as M.
Every test is run headless: blender -b --factory-startup -P research/platforms/blender/tests/<test>.py
"""
import math
import pathlib
import subprocess
import sys

import bpy

HERE = pathlib.Path(__file__).resolve().parent
sys.path.insert(0, str(HERE.parent))
import mdna_blender as M   # noqa: E402,F401

OUT = HERE.parent / "out" / "tests"
OUT.mkdir(parents=True, exist_ok=True)
FONT_DIR = M.ROOT / "assets/fonts"


def bold_font():
    """Blender's built-in font. NOTE: the token font Inter Tight (static and variable) renders with holes and seams
    in Blender text objects and in GN Fill Curve (its glyphs have overlapping contours); Instrument Serif renders
    clean. Inter Tight needs its overlaps removed first (fontTools + skia-pathops removeOverlaps)."""
    return bpy.data.fonts.load("<builtin>")


def scene(w=960, h=540, frames=60, ortho=10.67, bg=(0.012, 0.03, 0.026)):
    bpy.ops.wm.read_factory_settings(use_empty=True)
    sc = bpy.context.scene
    sc.render.fps, sc.frame_start, sc.frame_end = 30, 0, frames
    sc.render.resolution_x, sc.render.resolution_y = w, h
    sc.render.engine = "BLENDER_EEVEE"
    sc.view_settings.view_transform = "Standard"
    sc.render.image_settings.file_format = "PNG"
    sc.world = bpy.data.worlds.new("bg"); sc.world.use_nodes = True
    sc.world.node_tree.nodes["Background"].inputs[0].default_value = (*bg, 1)
    cam = bpy.data.objects.new("cam", bpy.data.cameras.new("cam")); sc.collection.objects.link(cam)
    cam.data.type = "ORTHO"; cam.data.ortho_scale = ortho
    cam.location = (0, -10, 0); cam.rotation_euler = (math.pi / 2, 0, 0); sc.camera = cam
    return sc


def mat(name, rgb, emit=1.0, alpha=1.0):
    m = bpy.data.materials.new(name); m.use_nodes = True
    b = m.node_tree.nodes["Principled BSDF"]
    b.inputs["Base Color"].default_value = (*rgb, 1); b.inputs["Emission Color"].default_value = (*rgb, 1)
    b.inputs["Emission Strength"].default_value = emit
    b.inputs["Alpha"].default_value = alpha
    return m


def emit_mat(name, rgb, strength=1.0):
    """Pure emission material (exact flat colour under Standard view transform)."""
    m = bpy.data.materials.new(name); m.use_nodes = True
    nt = m.node_tree; nt.nodes.clear()
    out = nt.nodes.new("ShaderNodeOutputMaterial"); em = nt.nodes.new("ShaderNodeEmission")
    em.inputs["Color"].default_value = (*rgb, 1); em.inputs["Strength"].default_value = strength
    nt.links.new(em.outputs[0], out.inputs["Surface"])
    return m


def text(body, size, loc, rgb, font=None, name=None):
    c = bpy.data.curves.new(name or body, "FONT"); c.body = body; c.size = size
    c.align_x = "CENTER"; c.align_y = "CENTER"
    if font:
        c.font = font
    o = bpy.data.objects.new(name or body, c); bpy.context.scene.collection.objects.link(o)
    o.rotation_euler = (math.pi / 2, 0, 0); o.location = loc
    c.materials.append(mat((name or body) + "_m", rgb))
    return o


def plane(name, w, h, loc, rgb, emit=0.6):
    bpy.ops.mesh.primitive_plane_add(size=1); o = bpy.context.object; o.name = name
    o.rotation_euler = (math.pi / 2, 0, 0); o.location = loc; o.scale = (w, h, 1)
    o.data.materials.append(mat(name + "_m", rgb, emit))
    return o


def render(sc, frame, name):
    sc.frame_set(frame)
    sc.render.filepath = str(OUT / f"{name}_{frame:03d}.png")
    bpy.ops.render.render(write_still=True)
    return sc.render.filepath


def render_clip(sc, name, f0=None, f1=None):
    """Renders a PNG sequence then joins it with ffmpeg (Blender 5 has no video in image_settings)."""
    seq = OUT / f"{name}_seq"; seq.mkdir(exist_ok=True)
    if f0 is not None:
        sc.frame_start = f0
    if f1 is not None:
        sc.frame_end = f1
    sc.render.filepath = str(seq / "f_")
    bpy.ops.render.render(animation=True)
    mp4 = OUT / f"{name}.mp4"
    subprocess.run(["ffmpeg", "-y", "-loglevel", "error", "-framerate", "30", "-start_number", str(sc.frame_start),
                    "-i", str(seq / "f_%04d.png"), "-c:v", "libx264", "-pix_fmt", "yuv420p", str(mp4)], check=True)
    return mp4


def fcurves(id_data):
    """All F-curves of an ID's action (Blender 5 layered actions or legacy)."""
    ad = id_data.animation_data
    act = ad.action
    if hasattr(act, "fcurves"):
        return act.fcurves
    return act.layers[0].strips[0].channelbag(ad.action_slot).fcurves


def key_bezier(id_data, path, index, f0, v0, f1, v1, ease="Land"):
    """Keys a property with a token curve as free bezier handles. path: 'location' (with index), a nested path
    ('data.bevel_factor_end', index None) or a custom property ('["mdna_wipe"]', index None). Returns the F-curve."""
    bz = M.EASE[ease] if isinstance(ease, str) else ease
    owner, attr = id_data, path
    if path.startswith('["'):   # custom property
        for f, v in ((f0, v0), (f1, v1)):
            owner[path[2:-2]] = v
            owner.keyframe_insert(path, frame=f)
        fc = next(c for c in fcurves(owner) if c.data_path == path)
    else:
        if "." in path:
            parts = path.split(".")
            for p in parts[:-1]:
                owner = getattr(owner, p)
            attr = parts[-1]
        for f, v in ((f0, v0), (f1, v1)):
            if index is not None:
                getattr(owner, attr)[index] = v
            else:
                setattr(owner, attr, v)
            owner.keyframe_insert(attr, index=-1 if index is None else index, frame=f)
        fc = next(c for c in fcurves(owner) if c.data_path.endswith(attr) and c.array_index == (index or 0))
    pts = {round(k.co.x, 3): k for k in fc.keyframe_points}
    k0, k1 = pts[round(f0, 3)], pts[round(f1, 3)]
    dt, dv = f1 - f0, v1 - v0
    k0.interpolation = "BEZIER"
    k0.handle_right_type = "FREE"; k1.handle_left_type = "FREE"
    k0.handle_right = (f0 + bz[0] * dt, v0 + bz[1] * dv)
    k1.handle_left = (f0 + bz[2] * dt, v0 + bz[3] * dv)
    return fc
