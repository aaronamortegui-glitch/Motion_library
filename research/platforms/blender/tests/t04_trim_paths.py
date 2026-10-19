"""Test 4 · Trim Paths / stroke draw (AE: Organic Draw, Line Draw, Organic Stroke, shape "line draw").

A) Bezier curve object with bevel_depth (stroke width) and curve.bevel_factor_end keyed 0 -> 1 with a token
   curve (bevel_factor_mapping_end = "SPLINE" so the factor follows the spline length, not segment count);
   bevel_factor_start keyed later for the "draw on, draw off" stroke. Cap: use_fill_caps.
B) Geometry Nodes on text outlines: String to Curves -> Trim Curve (End factor keyed through a group input) ->
   Curve to Mesh with a Curve Circle profile -> Set Material. Draws the glyph outlines of a string.
Run: blender -b --factory-startup -P research/platforms/blender/tests/t04_trim_paths.py
"""
import math
import pathlib
import sys
sys.path.insert(0, str(pathlib.Path(__file__).resolve().parent))
import bpy  # noqa: E402
import common as C  # noqa: E402

sc = C.scene(frames=40)

# A) organic stroke: a wavy bezier spline in the screen plane (X, Z)
cu = bpy.data.curves.new("Stroke", "CURVE"); cu.dimensions = "3D"
sp = cu.splines.new("BEZIER"); n = 6; sp.bezier_points.add(n - 1)
for i, bp in enumerate(sp.bezier_points):
    x = -4 + i * 1.6; z = 1.6 + 0.6 * math.sin(i * 1.3)
    bp.co = (x, 0, z); bp.handle_left_type = bp.handle_right_type = "AUTO"
cu.bevel_depth = 0.08; cu.use_fill_caps = True
cu.bevel_factor_mapping_start = "SPLINE"; cu.bevel_factor_mapping_end = "SPLINE"
stroke = bpy.data.objects.new("Stroke", cu); sc.collection.objects.link(stroke)
cu.materials.append(C.emit_mat("stroke_m", (0.75, 0.95, 0.35)))
fe = C.key_bezier(stroke, "data.bevel_factor_end", None, 0, 0.0, 21, 1.0, "Cruise")
fs = C.key_bezier(stroke, "data.bevel_factor_start", None, 24, 0.0, 38, 1.0, "Launch")

# B) GN glyph outline draw
ng = bpy.data.node_groups.new("MDNA Text Draw", "GeometryNodeTree")
ng.interface.new_socket("Geometry", in_out="INPUT", socket_type="NodeSocketGeometry")
ng.interface.new_socket("Draw", in_out="INPUT", socket_type="NodeSocketFloat")
ng.interface.new_socket("Geometry", in_out="OUTPUT", socket_type="NodeSocketGeometry")
N, L = ng.nodes, ng.links
gi = N.new("NodeGroupInput"); go = N.new("NodeGroupOutput")
s2c = N.new("GeometryNodeStringToCurves"); s2c.inputs["String"].default_value = "DRAW"; s2c.inputs["Size"].default_value = 1.6
font = C.bold_font()
if font:
    s2c.font = font
trim = N.new("GeometryNodeTrimCurve"); trim.mode = "FACTOR"
c2m = N.new("GeometryNodeCurveToMesh"); prof = N.new("GeometryNodeCurvePrimitiveCircle"); prof.inputs["Radius"].default_value = 0.025
setm = N.new("GeometryNodeSetMaterial"); setm.inputs["Material"].default_value = C.emit_mat("draw_m", (0.85, 0.92, 0.9))
real = N.new("GeometryNodeRealizeInstances")
L.new(s2c.outputs["Curve Instances"], real.inputs[0]); L.new(real.outputs[0], trim.inputs["Curve"])
end_sock = next(s for s in trim.inputs if s.name == "End" and s.type == "VALUE")
L.new(gi.outputs["Draw"], end_sock)
L.new(trim.outputs["Curve"], c2m.inputs["Curve"]); L.new(prof.outputs["Curve"], c2m.inputs["Profile Curve"])
L.new(c2m.outputs["Mesh"], setm.inputs["Geometry"]); L.new(setm.outputs["Geometry"], go.inputs["Geometry"])
me = bpy.data.meshes.new("drawhost"); host = bpy.data.objects.new("TextDraw", me); sc.collection.objects.link(host)
host.rotation_euler = (math.pi / 2, 0, 0); host.location = (-2.2, 0, -1.8)
md = host.modifiers.new("MDNA Text Draw", "NODES"); md.node_group = ng
sid = next(i.identifier for i in ng.interface.items_tree if getattr(i, "name", "") == "Draw" and i.in_out == "INPUT")
path = f'modifiers["MDNA Text Draw"]["{sid}"]'
for f, v in ((0, 0.0), (30, 1.0)):
    md[sid] = v; host.keyframe_insert(path, frame=f)
print("T04 bevel_factor_end @0,7,21:", [round(fe.evaluate(f), 3) for f in (0, 7, 21)],
      "start @24,31,38:", [round(fs.evaluate(f), 3) for f in (24, 31, 38)])
for f in (5, 12, 21, 31):
    C.render(sc, f, "t04_trim")
print("T04_DONE")
