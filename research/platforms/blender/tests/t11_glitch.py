"""Test 11 · Glitch (AE kit: glitch transition / look).

Blender 5 compositor (scene.compositing_node_group), all procedural:
  bands:  Image Coordinates (Normalized) Y -> floor(y * 14) -> hash = fract(sin(band * 12.9898 + frame * 78.233)
          * 43758.5453) (frame from Scene Time) -> only bands whose hash > 0.6 move -> offset X = (hash - 0.5)
          * strength * 120 px -> Displace (Displacement vector, pixels).
  RGB split: Separate Color -> Red through Translate (+X px * strength), Blue through Translate (-X) -> Combine.
  strength: a Value node keyed 0 -> 1 -> 0 (a glitch burst) with token curves.
Run: blender -b --factory-startup -P research/platforms/blender/tests/t11_glitch.py
"""
import pathlib
import sys
sys.path.insert(0, str(pathlib.Path(__file__).resolve().parent))
import bpy  # noqa: E402
import common as C  # noqa: E402

sc = C.scene(frames=30)
font = C.bold_font()
C.text("GLITCH", 1.6, (0, 0, 0.4), (0.85, 0.92, 0.9), font)
C.plane("Bar", 7, 0.25, (0, 0, -1.0), (0.75, 0.95, 0.35), emit=1.0)

ng = bpy.data.node_groups.new("glitch", "CompositorNodeTree")
ng.interface.new_socket("Image", in_out="OUTPUT", socket_type="NodeSocketColor")
sc.compositing_node_group = ng
N, L = ng.nodes, ng.links
rl = N.new("CompositorNodeRLayers"); out = N.new("NodeGroupOutput")
strength = N.new("ShaderNodeValue"); strength.name = "Strength"


def math(op, a=None, b=None, va=None, vb=None):
    n = N.new("ShaderNodeMath"); n.operation = op
    if a is not None: L.new(a, n.inputs[0])
    if b is not None: L.new(b, n.inputs[1])
    if va is not None: n.inputs[0].default_value = va
    if vb is not None: n.inputs[1].default_value = vb
    return n.outputs[0]


ic = N.new("CompositorNodeImageCoordinates"); L.new(rl.outputs["Image"], ic.inputs["Image"])
sep = N.new("ShaderNodeSeparateXYZ"); L.new(ic.outputs["Normalized"], sep.inputs[0])
st = N.new("CompositorNodeSceneTime")
band = math("FLOOR", math("MULTIPLY", sep.outputs["Y"], vb=14))
seed = math("ADD", math("MULTIPLY", band, vb=12.9898), math("MULTIPLY", st.outputs["Frame"], vb=78.233))
h = math("FRACT", math("MULTIPLY", math("SINE", seed), vb=43758.5453))
on = math("GREATER_THAN", h, vb=0.6)
dx = math("MULTIPLY", math("MULTIPLY", math("SUBTRACT", h, vb=0.5), on), math("MULTIPLY", strength.outputs[0], vb=120))
vec = N.new("ShaderNodeCombineXYZ"); L.new(dx, vec.inputs["X"])
disp = N.new("CompositorNodeDisplace"); L.new(rl.outputs["Image"], disp.inputs["Image"]); L.new(vec.outputs[0], disp.inputs["Displacement"])
# RGB split
sc_ = N.new("CompositorNodeSeparateColor"); L.new(disp.outputs[0], sc_.inputs[0])
shift = math("MULTIPLY", strength.outputs[0], vb=10)
neg = math("MULTIPLY", strength.outputs[0], vb=-10)
tr = N.new("CompositorNodeTranslate"); L.new(sc_.outputs["Red"], tr.inputs["Image"]); L.new(shift, tr.inputs["X"])
tb = N.new("CompositorNodeTranslate"); L.new(sc_.outputs["Blue"], tb.inputs["Image"]); L.new(neg, tb.inputs["X"])
cc = N.new("CompositorNodeCombineColor")
L.new(tr.outputs[0], cc.inputs["Red"]); L.new(sc_.outputs["Green"], cc.inputs["Green"]); L.new(tb.outputs[0], cc.inputs["Blue"])
L.new(sc_.outputs["Alpha"], cc.inputs["Alpha"])
L.new(cc.outputs[0], out.inputs[0])

sock = strength.outputs[0]
for f, v in ((0, 0.0), (6, 1.0), (14, 0.0)):
    sock.default_value = v; sock.keyframe_insert("default_value", frame=f)
fc = C.fcurves(ng)[0]
print("T11 strength @0,6,10,14:", [round(fc.evaluate(f), 3) for f in (0, 6, 10, 14)])
for f in (0, 5, 6, 8):
    C.render(sc, f, "t11_glitch")
print("T11_DONE")
