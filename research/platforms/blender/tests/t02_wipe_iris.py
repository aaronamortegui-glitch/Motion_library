"""Test 2 · Linear Wipe / Iris (mask) reveal (AE: Linear Wipe, Wipe Reveal, Wordmark Reveal, Iris Reveal, Color Wipe).

Shader-driven mask: every material of the object multiplies its alpha by a mask computed from the Generated texture
coordinates (0..1 over the object's bounding box) and an object custom property ("mdna_wipe" / "mdna_iris") read by
an Attribute node (attribute_type = "OBJECT", attribute_name = '["mdna_wipe"]'). The property is keyed on the object
with a token curve, so the animation lives with the object like any preset.
  linear wipe: alpha = clamp((p - x) / feather), p: 0 -> 1 + feather   (x = Generated.x; angle = rotate the coords)
  iris:        alpha = clamp((r - |uv - 0.5| * aspect) / feather), r: 0 -> 0.75
Color Wipe (a solid block sweeping across) is a plane whose origin sits on its left edge, scale X keyed 0 -> 1.
Run: blender -b --factory-startup -P research/platforms/blender/tests/t02_wipe_iris.py
"""
import pathlib
import sys
sys.path.insert(0, str(pathlib.Path(__file__).resolve().parent))
import bpy  # noqa: E402
import common as C  # noqa: E402


def add_mask(obj, kind="wipe", feather=0.08, aspect=1.0):
    prop = "mdna_" + kind
    obj[prop] = 0.0
    for slot in obj.material_slots:
        m = slot.material; nt = m.node_tree; N = nt.nodes
        bsdf = next(n for n in N if n.type == "BSDF_PRINCIPLED")
        tc = N.new("ShaderNodeTexCoord")
        attr = N.new("ShaderNodeAttribute"); attr.attribute_type = "OBJECT"; attr.attribute_name = f'["{prop}"]'
        sep = N.new("ShaderNodeSeparateXYZ"); nt.links.new(tc.outputs["Generated"], sep.inputs[0])
        if kind == "wipe":
            d = N.new("ShaderNodeMath"); d.operation = "SUBTRACT"
            nt.links.new(attr.outputs["Fac"], d.inputs[0]); nt.links.new(sep.outputs["X"], d.inputs[1])
        else:   # iris: r - distance(uv, centre) with aspect correction on X
            cx = N.new("ShaderNodeMath"); cx.operation = "SUBTRACT"; cx.inputs[1].default_value = 0.5
            nt.links.new(sep.outputs["X"], cx.inputs[0])
            ax = N.new("ShaderNodeMath"); ax.operation = "MULTIPLY"; ax.inputs[1].default_value = aspect
            nt.links.new(cx.outputs[0], ax.inputs[0])
            cy = N.new("ShaderNodeMath"); cy.operation = "SUBTRACT"; cy.inputs[1].default_value = 0.5
            nt.links.new(sep.outputs["Y"], cy.inputs[0])
            comb = N.new("ShaderNodeCombineXYZ")
            nt.links.new(ax.outputs[0], comb.inputs[0]); nt.links.new(cy.outputs[0], comb.inputs[1])
            ln = N.new("ShaderNodeVectorMath"); ln.operation = "LENGTH"; nt.links.new(comb.outputs[0], ln.inputs[0])
            d = N.new("ShaderNodeMath"); d.operation = "SUBTRACT"
            nt.links.new(attr.outputs["Fac"], d.inputs[0]); nt.links.new(ln.outputs["Value"], d.inputs[1])
        div = N.new("ShaderNodeMath"); div.operation = "DIVIDE"; div.use_clamp = True; div.inputs[1].default_value = feather
        nt.links.new(d.outputs[0], div.inputs[0])
        mul = N.new("ShaderNodeMath"); mul.operation = "MULTIPLY"
        mul.inputs[0].default_value = bsdf.inputs["Alpha"].default_value
        nt.links.new(div.outputs[0], mul.inputs[1]); nt.links.new(mul.outputs[0], bsdf.inputs["Alpha"])
        m.surface_render_method = "DITHERED"
    return prop


sc = C.scene(frames=40)
font = C.bold_font()
word = C.text("Wordmark Reveal", 0.9, (0, 0, 1.3), (0.75, 0.95, 0.35), font)
p = add_mask(word, "wipe", feather=0.06)
C.key_bezier(word, f'["{p}"]', None, 0, 0.0, 21, 1.06, "Cruise")

card = C.plane("IrisCard", 3.2, 2.0, (-2.2, 0, -1.2), (0.85, 0.45, 0.25), emit=0.9)
p2 = add_mask(card, "iris", feather=0.02, aspect=3.2 / 2.0)
C.key_bezier(card, f'["{p2}"]', None, 4, 0.0, 25, 0.95, "Surge")

# Color Wipe: origin on the left edge (mesh shifted +0.5 so the object origin is at x = -0.5 of the unit plane)
bpy.ops.mesh.primitive_plane_add(size=1); cw = bpy.context.object; cw.name = "ColorWipe"
for v in cw.data.vertices:
    v.co.x += 0.5
cw.rotation_euler = (1.5708, 0, 0); cw.location = (0.6, 0, -1.2); cw.scale = (3.2, 2.0, 1)
cw.data.materials.append(C.mat("cw_m", (0.25, 0.55, 0.9), 0.9))
C.key_bezier(cw, "scale", 0, 0, 0.0, 14, 3.2, "Surge")

for f in (0, 7, 12, 21, 30):
    C.render(sc, f, "t02_wipe")
print("T02 wipe prop @0,7,21:", [round(C.fcurves(word)[0].evaluate(f), 3) for f in (0, 7, 21)])
print("T02_DONE")
