"""Test 10 · Backgrounds: plexus/network (GN) and animated gradient mesh (shader) (AE kit backgrounds).

A) Plexus, all native Geometry Nodes (no handler, animates on render):
   Python builds a mesh with N random vertices and ALL N*(N-1)/2 edges once. GN: Set Position offset by a 4D
   Noise Texture whose W = Scene Time seconds * speed (drifting points) -> per edge length from Edge Vertices
   (Position 1, Position 2 -> Vector Math DISTANCE) -> Delete Geometry (domain EDGE, Selection = length > max)
   -> Mesh to Curve -> Curve to Mesh (circle profile) for lines + Instance on Points (Ico Sphere) for dots
   -> Join Geometry -> Set Material.
B) Gradient mesh: full-frame plane, Emission shader: Texture Coordinate (Generated) warped by a 4D Noise Texture
   (W keyed 0 -> 1 linear over 90 frames with CYCLES so it loops) -> bilinear mix of four token-ish colours.
Run: blender -b --factory-startup -P research/platforms/blender/tests/t10_backgrounds.py
"""
import math
import pathlib
import random
import sys
import time
sys.path.insert(0, str(pathlib.Path(__file__).resolve().parent))
import bpy  # noqa: E402
import common as C  # noqa: E402

# ---------- A) plexus ----------
sc = C.scene(frames=90)
W = sc.camera.data.ortho_scale; H = W * 9 / 16
rnd = random.Random(7); NPTS = 70
verts = [(rnd.uniform(-W / 2, W / 2), 0.5, rnd.uniform(-H / 2, H / 2)) for _ in range(NPTS)]
edges = [(i, j) for i in range(NPTS) for j in range(i + 1, NPTS)]
me = bpy.data.meshes.new("plexus"); me.from_pydata(verts, edges, []); me.update()
pl = bpy.data.objects.new("Plexus", me); sc.collection.objects.link(pl)

ng = bpy.data.node_groups.new("MDNA Plexus", "GeometryNodeTree")
ng.interface.new_socket("Geometry", in_out="INPUT", socket_type="NodeSocketGeometry")
ng.interface.new_socket("Geometry", in_out="OUTPUT", socket_type="NodeSocketGeometry")
N, L = ng.nodes, ng.links
gi = N.new("NodeGroupInput"); go = N.new("NodeGroupOutput")
t = N.new("GeometryNodeInputSceneTime")
spd = N.new("ShaderNodeMath"); spd.operation = "MULTIPLY"; spd.inputs[1].default_value = 0.15
pos = N.new("GeometryNodeInputPosition")
noise = N.new("ShaderNodeTexNoise"); noise.noise_dimensions = "4D"; noise.inputs["Scale"].default_value = 0.25
sub = N.new("ShaderNodeVectorMath"); sub.operation = "SUBTRACT"; sub.inputs[1].default_value = (0.5, 0.5, 0.5)
amp = N.new("ShaderNodeVectorMath"); amp.operation = "MULTIPLY"; amp.inputs[1].default_value = (2.5, 0, 2.5)
setp = N.new("GeometryNodeSetPosition")
L.new(t.outputs["Seconds"], spd.inputs[0]); L.new(spd.outputs[0], noise.inputs["W"]); L.new(pos.outputs[0], noise.inputs["Vector"])
L.new(noise.outputs["Color"], sub.inputs[0]); L.new(sub.outputs[0], amp.inputs[0]); L.new(amp.outputs[0], setp.inputs["Offset"])
L.new(gi.outputs[0], setp.inputs["Geometry"])
ev = N.new("GeometryNodeInputMeshEdgeVertices")
dist = N.new("ShaderNodeVectorMath"); dist.operation = "DISTANCE"
gt = N.new("FunctionNodeCompare"); gt.data_type = "FLOAT"; gt.operation = "GREATER_THAN"; gt.inputs["B"].default_value = 1.6
dele = N.new("GeometryNodeDeleteGeometry"); dele.domain = "EDGE"
L.new(ev.outputs["Position 1"], dist.inputs[0]); L.new(ev.outputs["Position 2"], dist.inputs[1])
L.new(dist.outputs["Value"], gt.inputs["A"]); L.new(gt.outputs[0], dele.inputs["Selection"])
L.new(setp.outputs[0], dele.inputs["Geometry"])
m2c = N.new("GeometryNodeMeshToCurve"); c2m = N.new("GeometryNodeCurveToMesh")
prof = N.new("GeometryNodeCurvePrimitiveCircle"); prof.inputs["Radius"].default_value = 0.008; prof.inputs["Resolution"].default_value = 4
L.new(dele.outputs[0], m2c.inputs["Mesh"]); L.new(m2c.outputs[0], c2m.inputs["Curve"]); L.new(prof.outputs[0], c2m.inputs["Profile Curve"])
m2p = N.new("GeometryNodeMeshToPoints"); ico = N.new("GeometryNodeMeshIcoSphere"); ico.inputs["Radius"].default_value = 0.05
iop = N.new("GeometryNodeInstanceOnPoints")
L.new(setp.outputs[0], m2p.inputs["Mesh"]); L.new(m2p.outputs[0], iop.inputs["Points"]); L.new(ico.outputs["Mesh"], iop.inputs["Instance"])
join = N.new("GeometryNodeJoinGeometry")
L.new(iop.outputs[0], join.inputs[0]); L.new(c2m.outputs[0], join.inputs[0])
sm = N.new("GeometryNodeSetMaterial"); sm.inputs["Material"].default_value = C.emit_mat("plex_m", (0.45, 0.85, 0.7), 1.0)
L.new(join.outputs[0], sm.inputs[0]); L.new(sm.outputs[0], go.inputs[0])
pl.modifiers.new("MDNA Plexus", "NODES").node_group = ng
t0 = time.time()
for f in (0, 45):
    C.render(sc, f, "t10_plexus")
print(f"T10 plexus: {NPTS} points, {len(edges)} candidate edges, 2 frames in {time.time() - t0:.1f}s")

# ---------- B) gradient mesh ----------
sc = C.scene(frames=90)
bpy.ops.mesh.primitive_plane_add(size=1); bg = bpy.context.object; bg.name = "Gradient"
bg.rotation_euler = (math.pi / 2, 0, 0); bg.scale = (W * 1.02, H * 1.02, 1); bg.location = (0, 1, 0)
m = bpy.data.materials.new("grad"); m.use_nodes = True; nt = m.node_tree; nt.nodes.clear(); Nn, Ln = nt.nodes, nt.links
out = Nn.new("ShaderNodeOutputMaterial"); em = Nn.new("ShaderNodeEmission")
tc = Nn.new("ShaderNodeTexCoord"); nz = Nn.new("ShaderNodeTexNoise"); nz.noise_dimensions = "4D"
nz.inputs["Scale"].default_value = 1.2; nz.inputs["Detail"].default_value = 1.0
mixv = Nn.new("ShaderNodeMix"); mixv.data_type = "VECTOR"; mixv.inputs["Factor"].default_value = 0.35
Ln.new(tc.outputs["Generated"], nz.inputs["Vector"]); Ln.new(tc.outputs["Generated"], mixv.inputs["A"]); Ln.new(nz.outputs["Color"], mixv.inputs["B"])
sep = Nn.new("ShaderNodeSeparateXYZ"); Ln.new(mixv.outputs["Result"], sep.inputs[0])
cols = [(0.02, 0.10, 0.09), (0.35, 0.75, 0.25), (0.05, 0.35, 0.45), (0.85, 0.55, 0.20)]
top = Nn.new("ShaderNodeMix"); top.data_type = "RGBA"; bot = Nn.new("ShaderNodeMix"); bot.data_type = "RGBA"
fin = Nn.new("ShaderNodeMix"); fin.data_type = "RGBA"
top.inputs["A"].default_value = (*cols[0], 1); top.inputs["B"].default_value = (*cols[1], 1)
bot.inputs["A"].default_value = (*cols[2], 1); bot.inputs["B"].default_value = (*cols[3], 1)
Ln.new(sep.outputs["X"], top.inputs["Factor"]); Ln.new(sep.outputs["X"], bot.inputs["Factor"])
Ln.new(bot.outputs["Result"], fin.inputs["A"]); Ln.new(top.outputs["Result"], fin.inputs["B"]); Ln.new(sep.outputs["Y"], fin.inputs["Factor"])
Ln.new(fin.outputs["Result"], em.inputs["Color"]); Ln.new(em.outputs[0], out.inputs["Surface"])
bg.data.materials.append(m)
wsock = nz.inputs["W"]
for f, v in ((0, 0.0), (90, 1.0)):
    wsock.default_value = v; wsock.keyframe_insert("default_value", frame=f)
fcw = C.fcurves(nt)[0]
for kp in fcw.keyframe_points:
    kp.interpolation = "LINEAR"
fcw.modifiers.new("CYCLES")
for f in (0, 45):
    C.render(sc, f, "t10_gradient")
print("T10 gradient W @0,45,135:", [round(fcw.evaluate(f), 3) for f in (0, 45, 135)])
print("T10_DONE")
