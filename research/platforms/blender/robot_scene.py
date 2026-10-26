"""A Blender scene with The Agent's head (assets/models/the-agent_head.glb): a camera move and the head's entrance on
Motion DNA's token curves (Bezier handles set from the curve, like the add-on does), rendered with EEVEE. It shows
what "block out this scene with a camera move in Blender" gives, without opening Blender.

Usage: blender -b -P research/platforms/blender/robot_scene.py -- out_dir      (frames out_dir/f####.png, 960x540)
"""
import math
import pathlib
import sys

import bpy

ROOT = pathlib.Path(__file__).resolve().parents[3]
OUT = pathlib.Path(sys.argv[sys.argv.index("--") + 1] if "--" in sys.argv else ROOT / "renders/blender_robot")
LAND, POP = (.12, .9, .28, 1), (.34, 1.45, .64, 1)

bpy.ops.wm.read_factory_settings(use_empty=True)
sc = bpy.context.scene; sc.render.engine = "BLENDER_EEVEE_NEXT" if "BLENDER_EEVEE_NEXT" in {e.identifier for e in bpy.types.RenderSettings.bl_rna.properties["engine"].enum_items} else "BLENDER_EEVEE"
sc.render.resolution_x, sc.render.resolution_y, sc.render.fps = 960, 540, 30
sc.frame_start, sc.frame_end = 1, 90
sc.render.filepath = str(OUT / "f"); sc.render.image_settings.file_format = "PNG"
world = bpy.data.worlds.new("Pine"); sc.world = world; world.use_nodes = True
world.node_tree.nodes["Background"].inputs[0].default_value = (0.004, 0.015, 0.013, 1); world.node_tree.nodes["Background"].inputs[1].default_value = 1.0

bpy.ops.import_scene.gltf(filepath=str(ROOT / "assets/models/the-agent_head.glb"))
head = [o for o in bpy.context.selected_objects if o.parent is None][0]
bpy.ops.mesh.primitive_plane_add(size=40, location=(0, -1.15, 0)); floor = bpy.context.active_object
mat = bpy.data.materials.new("Floor"); mat.use_nodes = True; mat.node_tree.nodes["Principled BSDF"].inputs["Base Color"].default_value = (0.03, 0.09, 0.08, 1)
mat.node_tree.nodes["Principled BSDF"].inputs["Roughness"].default_value = .35; floor.data.materials.append(mat); floor.rotation_euler = (math.pi / 2, 0, 0); floor.location = (0, 0, -1.15)

def light(name, loc, power, color):
    d = bpy.data.lights.new(name, "AREA"); d.energy = power; d.color = color; d.size = 4
    o = bpy.data.objects.new(name, d); o.location = loc; sc.collection.objects.link(o)
    o.rotation_euler = (math.atan2(math.hypot(loc[0], loc[1]), loc[2]), 0, math.atan2(loc[1], loc[0]) + math.pi / 2)
light("Key", (4, -4, 5), 900, (1, .97, .9)); light("Rim", (-5, 3, 3), 600, (.55, 1, .7)); light("Fill", (-3, -5, 1), 200, (.85, .95, 1))

cam = bpy.data.objects.new("Camera", bpy.data.cameras.new("Camera")); sc.collection.objects.link(cam); sc.camera = cam; cam.data.lens = 50
target = bpy.data.objects.new("Target", None); sc.collection.objects.link(target); target.location = (0, 0, .45)
c = cam.constraints.new("TRACK_TO"); c.target = target; c.track_axis = "TRACK_NEGATIVE_Z"; c.up_axis = "UP_Y"


def key(obj, path, frames_values, curve):
    """Keys on frames, every segment eased by a token cubic-bezier (handles at 1/3 like After Effects' influence)."""
    for f, v in frames_values:
        setattr(obj, path, v) if not isinstance(v, tuple) else setattr(obj, path, v)
        obj.keyframe_insert(data_path=path, frame=f)
    act = obj.animation_data.action
    fcs = act.fcurves if hasattr(act, "fcurves") else [fc for layer in act.layers for strip in layer.strips for bag in strip.channelbags for fc in bag.fcurves]
    for fc in fcs:
        if fc.data_path != path: continue
        kps = fc.keyframe_points
        for i in range(len(kps) - 1):
            a, b = kps[i], kps[i + 1]; dx, dy = b.co.x - a.co.x, b.co.y - a.co.y
            a.interpolation = "BEZIER"; a.handle_right_type = b.handle_left_type = "FREE"
            a.handle_right = (a.co.x + curve[0] * dx, a.co.y + curve[1] * dy); b.handle_left = (a.co.x + curve[2] * dx, a.co.y + curve[3] * dy)


# the camera dollies in and arcs around on Land; the head drops in on Pop and turns to the camera
key(cam, "location", [(1, (6.5, -9.5, 3.4)), (90, (3.0, -8.4, 1.9))], LAND)
key(head, "location", [(1, (0, 0, 4.5)), (26, (0, 0, 0))], POP)
key(head, "rotation_euler", [(1, (0, 0, math.radians(-70))), (40, (0, 0, math.radians(8)))], LAND)
OUT.mkdir(parents=True, exist_ok=True)
bpy.ops.render.render(animation=True)
