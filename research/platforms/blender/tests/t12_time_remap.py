"""Test 12 · Time remap / Speed Ramp of a video texture (AE: Time Remap, preset Speed Ramp).

A plane with an Image Texture of a movie (image.source = "MOVIE"; node.image_user: frame_duration, frame_start = 0,
use_auto_refresh = True). The source frame shown is frame_current + frame_offset (+1), so a remap S(t) is driven:
  object custom property ["src_frame"] keyed with a token curve (e.g. Ramp: slow -> fast -> slow), and a driver on
  image_user.frame_offset with the SIMPLE expression "src - frame" (no Python needed: driver.is_simple_expression).
Input: research/platforms/blender/out/tests/src_counter.mp4 (generated locally with ffmpeg: "SRC <n>", 120 frames,
  ffmpeg -f lavfi -i color=...:d=4 -vf drawtext=text='SRC %{frame_num}':start_number=1 ...).
Run: blender -b --factory-startup -P research/platforms/blender/tests/t12_time_remap.py
"""
import math
import pathlib
import sys
sys.path.insert(0, str(pathlib.Path(__file__).resolve().parent))
import bpy  # noqa: E402
import common as C  # noqa: E402

SRC = C.OUT / "src_counter.mp4"
sc = C.scene(frames=40)
bpy.ops.mesh.primitive_plane_add(size=1); pl = bpy.context.object; pl.name = "Video"
pl.rotation_euler = (math.pi / 2, 0, 0); pl.scale = (8, 4.5, 1)
img = bpy.data.images.load(str(SRC)); img.source = "MOVIE"
m = bpy.data.materials.new("video"); m.use_nodes = True; nt = m.node_tree; nt.nodes.clear()
out = nt.nodes.new("ShaderNodeOutputMaterial"); em = nt.nodes.new("ShaderNodeEmission")
tex = nt.nodes.new("ShaderNodeTexImage"); tex.image = img
iu = tex.image_user; iu.frame_duration = img.frame_duration; iu.frame_start = 0; iu.use_auto_refresh = True
nt.links.new(tex.outputs["Color"], em.inputs["Color"]); nt.links.new(em.outputs[0], out.inputs["Surface"])
pl.data.materials.append(m)

# S(t): source frame 1 at t=0 -> 100 at t=30 with Ramp (slow-fast-slow) = speed ramp
fc = C.key_bezier(pl, '["src_frame"]', None, 0, 1.0, 30, 100.0, "Ramp")
drv_fc = iu.driver_add("frame_offset"); drv = drv_fc.driver
drv.type = "SCRIPTED"
v = drv.variables.new(); v.name = "src"; v.type = "SINGLE_PROP"
v.targets[0].id_type = "OBJECT"; v.targets[0].id = pl; v.targets[0].data_path = '["src_frame"]'
drv.expression = "src - frame - 1"
print("T12 simple expression:", drv.is_simple_expression, "src_frame @0,8,15,22,30:", [round(fc.evaluate(f), 1) for f in (0, 8, 15, 22, 30)])
for f in (0, 8, 15, 22, 30):
    C.render(sc, f, "t12_remap")
print("T12_DONE")
