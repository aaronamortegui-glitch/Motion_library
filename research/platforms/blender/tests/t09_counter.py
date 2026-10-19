"""Test 9 · Counter (AE kit element: counter / number roll-up).

A) Geometry Nodes, no handler (persists in the .blend, renders anywhere): modifier input "Value" keyed 0 -> 2480
   with the Land token curve -> Value to String (decimals 0) -> Join Strings with prefix "$" -> String to Curves
   -> Fill Curve -> Set Material. The number is the keyed F-curve, so its easing is exactly the token curve.
B) Handler: object custom property ["count"] keyed with a token curve; frame_change_pre formats it into a text
   object's body with thousands separators ("{:,.0f}"), which GN Value to String cannot do.
Run: blender -b --factory-startup -P research/platforms/blender/tests/t09_counter.py
"""
import math
import pathlib
import sys
sys.path.insert(0, str(pathlib.Path(__file__).resolve().parent))
import bpy  # noqa: E402
import common as C  # noqa: E402

sc = C.scene(frames=40)
font = C.bold_font()

# A) GN counter
ng = bpy.data.node_groups.new("MDNA Counter", "GeometryNodeTree")
ng.interface.new_socket("Geometry", in_out="INPUT", socket_type="NodeSocketGeometry")
ng.interface.new_socket("Value", in_out="INPUT", socket_type="NodeSocketFloat")
ng.interface.new_socket("Geometry", in_out="OUTPUT", socket_type="NodeSocketGeometry")
N, L = ng.nodes, ng.links
gi = N.new("NodeGroupInput"); go = N.new("NodeGroupOutput")
v2s = N.new("FunctionNodeValueToString"); v2s.inputs["Decimals"].default_value = 0
join = N.new("GeometryNodeStringJoin")
pre = N.new("FunctionNodeInputString"); pre.string = "$"
s2c = N.new("GeometryNodeStringToCurves"); s2c.font = font; s2c.inputs["Size"].default_value = 1.4; s2c.align_x = "CENTER"
fill = N.new("GeometryNodeFillCurve")
sm = N.new("GeometryNodeSetMaterial"); sm.inputs["Material"].default_value = C.emit_mat("cnt_m", (0.75, 0.95, 0.35))
L.new(gi.outputs["Value"], v2s.inputs["Value"])
# multi-input socket: the LAST link made comes FIRST in the joined string (tested), so link the number first
L.new(v2s.outputs["String"], join.inputs["Strings"]); L.new(pre.outputs[0], join.inputs["Strings"])
L.new(join.outputs[0], s2c.inputs["String"]); L.new(s2c.outputs["Curve Instances"], fill.inputs["Curve"])
L.new(fill.outputs[0], sm.inputs[0]); L.new(sm.outputs[0], go.inputs[0])
host = bpy.data.objects.new("CounterGN", bpy.data.meshes.new("cnt")); sc.collection.objects.link(host)
host.rotation_euler = (math.pi / 2, 0, 0); host.location = (0, 0, 0.9)
md = host.modifiers.new("MDNA Counter", "NODES"); md.node_group = ng
sid = next(i.identifier for i in ng.interface.items_tree if getattr(i, "name", "") == "Value")
path = f'modifiers["MDNA Counter"]["{sid}"]'
for f, v in ((0, 0.0), (30, 2480.0)):
    md[sid] = v; host.keyframe_insert(path, frame=f)
fc = next(c for c in C.fcurves(host) if c.data_path == path)
k0, k1 = fc.keyframe_points; bz = C.M.EASE["Land"]
k0.handle_right_type = "FREE"; k1.handle_left_type = "FREE"
k0.handle_right = (bz[0] * 30, bz[1] * 2480); k1.handle_left = (bz[2] * 30, bz[3] * 2480)

# B) handler counter
tx = C.text("0", 0.9, (0, 0, -1.2), (0.85, 0.92, 0.9), font, name="CounterText")
fcb = C.key_bezier(tx, '["count"]', None, 0, 0.0, 30, 1250000.0, "Surge")


def mdna_counter(scene, *_):
    o = bpy.data.objects.get("CounterText")
    if o:
        o.data.body = "{:,.0f} views".format(o.get("count", 0.0))


bpy.app.handlers.frame_change_pre.clear(); bpy.app.handlers.frame_change_pre.append(mdna_counter)
print("T09 GN value @5,15,30:", [round(fc.evaluate(f)) for f in (5, 15, 30)],
      "handler count @5,15,30:", [round(fcb.evaluate(f)) for f in (5, 15, 30)])
for f in (5, 15, 30):
    C.render(sc, f, "t09_counter")
print("T09_DONE")
