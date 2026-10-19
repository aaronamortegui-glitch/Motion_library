"""Test 3 · Skew (AE: Transform Skew, used by Jello and Light Speed In).

A) Geometry Nodes modifier "MDNA Skew" on any object (also a TEXT object): Set Position with
   Offset = (local_y * tan(skew), 0, 0). The skew amount is a group input, keyed on the modifier
   (data path: modifiers["MDNA Skew"]["Socket_2"]) with token curves. Text stays a text object (editable body).
B) Shape key on a mesh plane (basis + "Skew" key with the top edge shifted), value keyed 0..1.
Light Speed In = position slide + skew 40 deg -> 0 (Whip). Jello = skew oscillation (stops with Settle).
Run: blender -b --factory-startup -P research/platforms/blender/tests/t03_skew.py
"""
import math
import pathlib
import sys
sys.path.insert(0, str(pathlib.Path(__file__).resolve().parent))
import bpy  # noqa: E402
import common as C  # noqa: E402


def skew_group():
    ng = bpy.data.node_groups.get("MDNA Skew")
    if ng:
        return ng
    ng = bpy.data.node_groups.new("MDNA Skew", "GeometryNodeTree")
    ng.interface.new_socket("Geometry", in_out="INPUT", socket_type="NodeSocketGeometry")
    s = ng.interface.new_socket("Skew", in_out="INPUT", socket_type="NodeSocketFloat")   # degrees
    s.min_value, s.max_value = -89, 89
    ng.interface.new_socket("Geometry", in_out="OUTPUT", socket_type="NodeSocketGeometry")
    N, L = ng.nodes, ng.links
    gi = N.new("NodeGroupInput"); go = N.new("NodeGroupOutput")
    sp = N.new("GeometryNodeSetPosition"); pos = N.new("GeometryNodeInputPosition")
    sep = N.new("ShaderNodeSeparateXYZ"); rad = N.new("ShaderNodeMath"); rad.operation = "RADIANS"
    tan = N.new("ShaderNodeMath"); tan.operation = "TANGENT"
    mul = N.new("ShaderNodeMath"); mul.operation = "MULTIPLY"
    comb = N.new("ShaderNodeCombineXYZ")
    L.new(gi.outputs["Geometry"], sp.inputs["Geometry"]); L.new(sp.outputs["Geometry"], go.inputs["Geometry"])
    L.new(pos.outputs[0], sep.inputs[0]); L.new(gi.outputs["Skew"], rad.inputs[0]); L.new(rad.outputs[0], tan.inputs[0])
    L.new(sep.outputs["Y"], mul.inputs[0]); L.new(tan.outputs[0], mul.inputs[1])
    L.new(mul.outputs[0], comb.inputs["X"]); L.new(comb.outputs[0], sp.inputs["Offset"])
    return ng


def add_skew(obj):
    md = obj.modifiers.new("MDNA Skew", "NODES"); md.node_group = skew_group()
    sid = next(i.identifier for i in md.node_group.interface.items_tree if getattr(i, "name", "") == "Skew")
    return md, sid


def key_skew(obj, md, sid, frames_vals, eases):
    path = f'modifiers["{md.name}"]["{sid}"]'
    for f, v in frames_vals:
        md[sid] = float(v); obj.keyframe_insert(path, frame=f)
    fc = next(c for c in C.fcurves(obj) if c.data_path == path)
    kp = sorted(fc.keyframe_points, key=lambda k: k.co.x)
    for (k0, k1), e in zip(zip(kp, kp[1:]), eases):
        bz = C.M.EASE[e]; dt = k1.co.x - k0.co.x; dv = k1.co.y - k0.co.y
        k0.interpolation = "BEZIER"; k0.handle_right_type = "FREE"; k1.handle_left_type = "FREE"
        k0.handle_right = (k0.co.x + bz[0] * dt, k0.co.y + bz[1] * dv)
        k1.handle_left = (k0.co.x + bz[2] * dt, k0.co.y + bz[3] * dv)
    return fc


sc = C.scene(frames=40)
font = C.bold_font()
# Light Speed In on a text object: slide from the left (Whip) + skew 40 -> 0
ls = C.text("Light Speed In", 0.9, (0, 0, 1.3), (0.75, 0.95, 0.35), font)
md, sid = add_skew(ls)
C.key_bezier(ls, "location", 0, 0, -9.0, 9, 0.0, "Whip")
fc_ls = key_skew(ls, md, sid, [(0, -40), (9, 0)], ["Whip"])
# Jello on a text object: skew oscillation 0, 18, -10, 5, 0
je = C.text("Jello", 1.0, (-2.4, 0, -1.2), (0.85, 0.92, 0.9), font)
md2, sid2 = add_skew(je)
fc_je = key_skew(je, md2, sid2, [(0, 0), (4, 18), (9, -10), (14, 5), (20, 0)], ["Launch", "Settle", "Settle", "Settle"])
# B) shape key on a mesh plane
pl = C.plane("SkewCard", 2.6, 1.6, (2.4, 0, -1.2), (0.25, 0.55, 0.9), emit=0.9)
pl.shape_key_add(name="Basis"); sk = pl.shape_key_add(name="Skew")
for v in sk.data:
    if v.co.y > 0:
        v.co.x += 0.35   # local units (plane scaled by 2.6): top edge shifted right
sk.value = 0; sk.keyframe_insert("value", frame=0)
sk.value = 1; sk.keyframe_insert("value", frame=10)
sk.value = 0; sk.keyframe_insert("value", frame=20)
print("T03 skew LS @0,3,9:", [round(fc_ls.evaluate(f), 2) for f in (0, 3, 9)],
      "jello @4,9,14:", [round(fc_je.evaluate(f), 2) for f in (4, 9, 14)])
for f in (3, 4, 9, 10):
    C.render(sc, f, "t03_skew")
print("T03_DONE")
