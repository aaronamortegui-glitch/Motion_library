"""Test 1 · Blur In of ONE object (AE: Gaussian Blur keyed on a layer).

A) Compositor + view layers: the blurred object lives in its own collection, rendered by its own view layer
   ("FG"); the rest renders in "BG" with that collection excluded. Compositor: RLayers(FG) -> Blur (Size keyed
   with the Land token curve, 40 px -> 0) -> Alpha Over on RLayers(BG) -> Alpha Over on a flat colour -> Group Output.
   Blender 5: scene.compositing_node_group (a CompositorNodeTree with a Group Output), no Composite node.
B) Depth of field on an orthographic camera: EEVEE blurs an object that is off the focus plane, so keying the
   object's depth (location Y) with a token curve gives a one-pass per-object Blur In (ortho: no size change).
Run: blender -b --factory-startup -P research/platforms/blender/tests/t01_blur_in.py
"""
import pathlib
import sys
sys.path.insert(0, str(pathlib.Path(__file__).resolve().parent))
import bpy  # noqa: E402
import common as C  # noqa: E402

sc = C.scene(frames=30)
font = C.bold_font()
blur_col = bpy.data.collections.new("BlurMe"); sc.collection.children.link(blur_col)
other = C.text("Static", 0.7, (0, 0, 1.4), (0.85, 0.92, 0.9), font)
title = C.text("Blur In", 1.4, (0, 0, -0.2), (0.75, 0.95, 0.35), font)
for c in title.users_collection:
    c.objects.unlink(title)
blur_col.objects.link(title)
C.M.apply(title, "Fade", "in", 0)   # opacity in parallel, as AE's Blur In does

# view layers
vl_bg = sc.view_layers[0]; vl_bg.name = "BG"
vl_fg = sc.view_layers.new("FG")
vl_bg.layer_collection.children["BlurMe"].exclude = True
for ch in vl_fg.layer_collection.children:
    ch.exclude = ch.name != "BlurMe"
# the scene master collection cannot be excluded per view layer: the other objects go in their own collection
rest = bpy.data.collections.new("Rest"); sc.collection.children.link(rest)
for c in other.users_collection:
    c.objects.unlink(other)
rest.objects.link(other)
vl_fg.layer_collection.children["Rest"].exclude = True
sc.render.film_transparent = True

ng = bpy.data.node_groups.new("comp", "CompositorNodeTree")
ng.interface.new_socket("Image", in_out="OUTPUT", socket_type="NodeSocketColor")
sc.compositing_node_group = ng
N = ng.nodes; L = ng.links
rl_bg = N.new("CompositorNodeRLayers"); rl_bg.layer = "BG"
rl_fg = N.new("CompositorNodeRLayers"); rl_fg.layer = "FG"
blur = N.new("CompositorNodeBlur"); blur.name = "Blur"
blur.inputs["Type"].default_value = "Gaussian"
blur.inputs["Extend Bounds"].default_value = True
over = N.new("CompositorNodeAlphaOver")
bgcol = N.new("CompositorNodeRGB"); bgcol.outputs[0].default_value = (0.012, 0.03, 0.026, 1)
over2 = N.new("CompositorNodeAlphaOver")
out = N.new("NodeGroupOutput")
L.new(rl_fg.outputs["Image"], blur.inputs["Image"])
L.new(rl_bg.outputs["Image"], over.inputs["Background"])
L.new(blur.outputs["Image"], over.inputs["Foreground"])
L.new(bgcol.outputs[0], over2.inputs["Background"])
L.new(over.outputs["Image"], over2.inputs["Foreground"])
L.new(over2.outputs["Image"], out.inputs[0])

# key the blur size (vector socket, both components) with the token curve
sock = blur.inputs["Size"]
for idx in (0, 1):
    for f, v in ((0, 40.0), (14, 0.0)):
        sock.default_value[idx] = v
        sock.keyframe_insert("default_value", index=idx, frame=f)
fcs = C.fcurves(ng)
for fc in fcs:
    k0, k1 = fc.keyframe_points[0], fc.keyframe_points[1]
    bz = C.M.EASE["Land"]; dt, dv = 14, -40
    k0.handle_right_type = "FREE"; k1.handle_left_type = "FREE"
    k0.handle_right = (bz[0] * dt, 40 + bz[1] * dv); k1.handle_left = (bz[2] * dt, 40 + bz[3] * dv)
print("T01 blur fcurves:", [(fc.data_path, fc.array_index) for fc in fcs],
      "size@0,3,7,14:", [round(fcs[0].evaluate(f), 2) for f in (0, 3, 7, 14)])
for f in (1, 3, 6, 14):
    C.render(sc, f, "t01_blur_comp")

# B) DOF on an ortho camera
sc2 = C.scene(frames=30)
sc2.render.film_transparent = False
a = C.text("In focus", 0.8, (0, 0, 1.0), (0.85, 0.92, 0.9), font)
b = C.text("Off focus", 0.8, (0, 3.0, -1.0), (0.75, 0.95, 0.35), font)   # 3 units further from the camera
cam = sc2.camera.data
cam.dof.use_dof = True; cam.dof.focus_distance = 10.0; cam.dof.aperture_fstop = 0.05
# C) per-object blur in ONE pass: animate the object's depth (location Y) through the focus plane; with an ortho
#    camera depth does not change its size, so this is a pure blur-in. Token curve Land, 3 units -> 0.
C.key_bezier(b, "location", 1, 0, 3.0, 14, 0.0, "Land")
for f in (0, 4, 14):
    C.render(sc2, f, "t01_blur_dof_ortho")
print("T01_DONE")
