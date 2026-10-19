"""Motion DNA for Blender (beta): applies the portable presets (research/platforms/portable_presets.json) to objects,
with the token curves as exact bezier handles (Blender's F-curves are the same cubic bezier as the tokens).

Screen conventions: the camera looks along +Y, so screen right is +X and screen up is +Z. A preset's pixel offsets
become Blender units through `px` (default 1/180: 1080 px ≈ 6 units, the frame height of the demo camera).

Inside Blender:   import mdna_blender as M; M.apply(obj, "Fade Up", "in", start=0)
Headless:         blender -b scene.blend -P mdna_blender.py -- apply "Fade Up" --objects Title,Card --phase in --start 0
                  blender -b scene.blend -P mdna_blender.py -- list
"""
import json
import math
import pathlib
import sys

import bpy

ROOT = pathlib.Path(__file__).resolve().parents[3]
TOKENS = json.load(open(ROOT / "tokens/superside_motion_tokens.json", encoding="utf-8"))
RECIPES = json.load(open(ROOT / "research/platforms/portable_presets.json", encoding="utf-8"))
EASE = {e["name"]: e["bezier"] for e in TOKENS["easings"]}
DUR = {d["name"]: d["frames"] for d in TOKENS["durations"]}


def portable():
    return list(RECIPES["portable"])


def _bezier_of(seg):
    if seg.get("ease"):
        return EASE.get(seg["ease"], [0, 0, 1, 1])
    if seg.get("bezier"):
        return seg["bezier"]
    ae = seg.get("ae") or {}
    if ae.get("out") == "linear" or not ae:
        return [0, 0, 1, 1]
    o, i = ae["out"], ae["in"]   # After Effects influence (%) and speed relative to the average
    x1, x2 = o["influence"] / 100, 1 - i["influence"] / 100
    return [x1, x1 * o.get("speed_x_avg", 0), x2, 1 - (1 - x2) * i.get("speed_x_avg", 0)]


def _fcurve(obj, path, index):
    ad = obj.animation_data
    act = ad.action
    if hasattr(act, "fcurves"):
        curves = act.fcurves
    else:   # Blender 5: layered actions keep their curves in the slot's channelbag
        curves = act.layers[0].strips[0].channelbag(ad.action_slot).fcurves
    return next(c for c in curves if c.data_path == path and c.array_index == index)


def _key(obj, path, index, f0, v0, f1, v1, bz):
    """Keys path[index] from v0 at f0 to v1 at f1 with the cubic-bezier bz as free handles."""
    target = getattr(obj, path)   # location, scale, rotation_euler, color: all vectors
    for f, v in ((f0, v0), (f1, v1)):
        target[index] = v
        obj.keyframe_insert(path, index=index, frame=f)
    fc = _fcurve(obj, path, index)
    pts = {round(k.co.x, 3): k for k in fc.keyframe_points}
    k0, k1 = pts[round(f0, 3)], pts[round(f1, 3)]
    dt, dv = f1 - f0, v1 - v0
    k0.interpolation = "BEZIER"
    k0.handle_right_type = "FREE"; k1.handle_left_type = "FREE"
    k0.handle_right = (f0 + bz[0] * dt, v0 + bz[1] * dv)
    k1.handle_left = (f0 + bz[2] * dt, v0 + bz[3] * dv)


def _fade_material(obj):
    """Opacity: every material multiplies its alpha by the object's color alpha (obj.color[3], keyable)."""
    for slot in obj.material_slots:
        m = slot.material
        if not m or m.get("mdna_fade"):
            continue
        m.use_nodes = True
        nt = m.node_tree
        bsdf = next((n for n in nt.nodes if n.type == "BSDF_PRINCIPLED"), None)
        if not bsdf:
            continue
        info = nt.nodes.new("ShaderNodeObjectInfo")
        mul = nt.nodes.new("ShaderNodeMath"); mul.operation = "MULTIPLY"
        mul.inputs[0].default_value = bsdf.inputs["Alpha"].default_value
        nt.links.new(info.outputs["Alpha"], mul.inputs[1])
        nt.links.new(mul.outputs[0], bsdf.inputs["Alpha"])
        if hasattr(m, "surface_render_method"):
            m.surface_render_method = "DITHERED"
        elif hasattr(m, "blend_method"):
            m.blend_method = "BLEND"
        m["mdna_fade"] = True


def apply(obj, name, phase="in", start=0, px=1 / 180, duration=1.0, intensity=1.0):
    """Applies preset `name` (phase in|out) to obj from frame `start`. Returns the end frame."""
    rec = RECIPES["presets"].get(name)
    if not rec:
        raise KeyError(f"preset not found: {name}")
    segs = rec.get(phase)
    if not isinstance(segs, list) or not segs:
        raise ValueError(f"{name} has no portable {phase} phase")
    if name not in RECIPES["portable"]:
        print(f"[mdna] {name}: only part of it is portable (After Effects only: {', '.join(rec['ae_only'])})")
    fps = bpy.context.scene.render.fps / bpy.context.scene.render.fps_base
    k = fps / RECIPES["fps"] * duration
    rest_loc, rest_scale, rest_rot = obj.location.copy(), obj.scale.copy(), obj.rotation_euler.copy()
    end = start
    for s in segs:
        ch = s.get("channel")
        if not ch:
            continue
        f0 = start + s["start_f"] * k
        pieces = [(s["from"], s["to"], s["frames"], _bezier_of(s))]
        if s["kind"] == "stops":   # several token segments in a row
            pieces, v = [], s["from"]
            for st in s["stops"]:
                pieces.append((v, st["v"], st["frames"], EASE.get(st["ease"], [0, 0, 1, 1]))); v = st["v"]
        for a, b, frames, bz in pieces:
            f1 = f0 + frames * k
            if ch == "position":
                for idx, (va, vb) in ((0, (a[0], b[0])), (2, (-a[1], -b[1]))):   # AE y down → Blender z up
                    _key(obj, "location", idx, f0, rest_loc[idx] + va * px * intensity, f1, rest_loc[idx] + vb * px * intensity, bz)
            elif ch == "scale":
                for idx in (0, 1):
                    fa = 1 + (a[idx] - 1) * intensity; fb = 1 + (b[idx] - 1) * intensity
                    _key(obj, "scale", idx, f0, rest_scale[idx] * fa, f1, rest_scale[idx] * fb, bz)
            elif ch == "opacity":
                _fade_material(obj)
                _key(obj, "color", 3, f0, a, f1, b, bz)
            elif ch in ("rotation", "rotationX", "rotationY"):
                idx = {"rotation": 1, "rotationX": 0, "rotationY": 2}[ch]   # screen plane = world Y for a front camera
                _key(obj, "rotation_euler", idx, f0, rest_rot[idx] + math.radians(a * intensity), f1, rest_rot[idx] + math.radians(b * intensity), bz)
            f0 = f1
            end = max(end, f1)
    obj["mdna_preset"] = f"{name} ({phase})"
    return end


def _cli(argv):
    import argparse
    ap = argparse.ArgumentParser(prog="mdna_blender")
    sub = ap.add_subparsers(dest="cmd", required=True)
    sub.add_parser("list")
    a = sub.add_parser("apply")
    a.add_argument("preset"); a.add_argument("--objects", default=""); a.add_argument("--phase", default="in")
    a.add_argument("--start", type=float, default=0); a.add_argument("--stagger", type=float, default=4)
    a.add_argument("--save", default="")
    o = ap.parse_args(argv)
    if o.cmd == "list":
        print("\n".join(portable())); return
    objs = [bpy.data.objects[n] for n in o.objects.split(",") if n] or list(bpy.context.selected_objects)
    for i, ob in enumerate(objs):
        print(ob.name, "→", apply(ob, o.preset, o.phase, o.start + i * o.stagger))
    if o.save:
        bpy.ops.wm.save_as_mainfile(filepath=o.save)


if __name__ == "__main__" and "--" in sys.argv:
    _cli(sys.argv[sys.argv.index("--") + 1:])
