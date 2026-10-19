"""Test 5 · Per-character / per-word text animation with stagger (AE text animators: Chars Rise, Blur Words...).

Split a string into one text object per character in reading order, with Blender's own layout (kerning, font):
1) a temporary object with a Geometry Nodes "String to Curves" modifier lays the string out; each glyph is an
   instance. obj.evaluated_get(dg).evaluated_geometry().instances_pointcloud() holds the "instance_transform"
   (FLOAT4X4) and ".reference_index" attributes in string order; spaces point to an empty (None) reference.
   String to Curves needs node.font set (None gives no instances when built from Python).
2) one text object per non-space character is created at that matrix (align_x LEFT, baseline origin = same origin
   as String to Curves), then M.apply(obj, preset, "in", start + i * stagger) staggers any portable preset.
Words = consecutive characters between spaces (parent each word's chars to an empty to animate per word).
Run: blender -b --factory-startup -P research/platforms/blender/tests/t05_per_char.py
"""
import math
import pathlib
import sys
sys.path.insert(0, str(pathlib.Path(__file__).resolve().parent))
import bpy  # noqa: E402
from mathutils import Matrix  # noqa: E402
import common as C  # noqa: E402


def split_chars(body, size, loc, rgb, font, name="Chars"):
    ng = bpy.data.node_groups.new("layout", "GeometryNodeTree")
    ng.interface.new_socket("Geometry", in_out="INPUT", socket_type="NodeSocketGeometry")
    ng.interface.new_socket("Geometry", in_out="OUTPUT", socket_type="NodeSocketGeometry")
    s2c = ng.nodes.new("GeometryNodeStringToCurves"); s2c.inputs["String"].default_value = body
    s2c.inputs["Size"].default_value = size; s2c.font = font
    s2c.align_x = "CENTER"
    go = ng.nodes.new("NodeGroupOutput"); ng.links.new(s2c.outputs["Curve Instances"], go.inputs[0])
    tmp = bpy.data.objects.new("tmp_layout", bpy.data.meshes.new("tmp")); bpy.context.scene.collection.objects.link(tmp)
    tmp.rotation_euler = (math.pi / 2, 0, 0); tmp.location = loc
    tmp.modifiers.new("l", "NODES").node_group = ng
    dg = bpy.context.evaluated_depsgraph_get()
    gs = tmp.evaluated_get(dg).evaluated_geometry()          # Blender 4.5+/5: GeometrySet of the evaluated object
    pc, refs = gs.instances_pointcloud(), gs.instance_references()
    ref_idx = [d.value for d in pc.attributes[".reference_index"].data]
    tr = [Matrix([list(r) for r in d.value]) for d in pc.attributes["instance_transform"].data]
    mats = [tmp.matrix_world @ t for t, ri in zip(tr, ref_idx) if refs[ri] is not None]   # spaces: empty reference
    bpy.data.objects.remove(tmp)
    chars = [c for c in body if not c.isspace()]
    assert len(mats) == len(chars), (len(mats), len(chars))
    m = C.mat(name + "_m", rgb)
    objs, words, w = [], [], 0
    ci = 0
    for c in body:
        if c.isspace():
            w += 1; continue
        cu = bpy.data.curves.new(f"{name}_{ci}", "FONT"); cu.body = c; cu.size = size; cu.font = font
        cu.align_x = "LEFT"; cu.align_y = "TOP_BASELINE"; cu.materials.append(m)
        o = bpy.data.objects.new(f"{name}_{ci:02d}_{c}", cu); bpy.context.scene.collection.objects.link(o)
        o.matrix_world = mats[ci]
        objs.append(o); words.append(w); ci += 1
    return objs, words


def main():
    sc = C.scene(frames=45)
    font = C.bold_font()
    chars, words = split_chars("Chars Rise per letter", 0.8, (0, 0, 1.2), (0.75, 0.95, 0.35), font)
    for i, o in enumerate(chars):
        C.M.apply(o, "Fade Up", "in", 2 + i * 1.5)
    # per word on a second line: same split, stagger by word index
    wchars, wwords = split_chars("Words pop one by one", 0.6, (0, 0, -1.0), (0.85, 0.92, 0.9), font, "W")
    for o, w in zip(wchars, wwords):
        C.M.apply(o, "Scale Pop", "in", 4 + w * 5)
    print("T05 chars:", len(chars), [o.name for o in chars[:6]], "words:", max(wwords) + 1)
    for f in (8, 16, 24, 44):
        C.render(sc, f, "t05_chars")
    print("T05_DONE")


if __name__ == "__main__":
    main()
