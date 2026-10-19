"""Motion DNA for Blender (beta add-on): a "Motion DNA" tab in the 3D Viewport's sidebar (N) that applies the portable
presets to the selected objects with the token curves.
Install: python research/platforms/blender/install.py  (registers this file from the clone, so a git pull updates it)
"""
bl_info = {
    "name": "Motion DNA",
    "author": "Motion DNA",
    "version": (0, 1, 0),
    "blender": (4, 2, 0),
    "location": "3D Viewport › Sidebar (N) › Motion DNA",
    "description": "Motion DNA presets and token curves for selected objects",
    "category": "Animation",
}

import importlib
import pathlib
import sys

import bpy

HERE = pathlib.Path(__file__).resolve().parent
if str(HERE) not in sys.path:
    sys.path.insert(0, str(HERE))
import mdna_blender as M   # noqa: E402

ENERGY = {"s": "Soft", "m": "Medium", "d": "Dynamic"}
INFO = {}
for line in (M.ROOT / "library/INDEX.txt").read_text(encoding="utf-8").splitlines():
    f = line.split("|")
    if f[0] == "motion" and len(f) > 4:
        INFO[f[1]] = {"channels": f[2], "energy": ENERGY.get(f[3], f[3]), "use": f[4]}


def preset_items(self, context):
    want = self.energy
    out = []
    for n in M.portable():
        i = INFO.get(n, {})
        if want != "ALL" and i.get("energy") != want:
            continue
        out.append((n, n, f"{i.get('use', '')} · {i.get('channels', '')} · {i.get('energy', '')}"))
    return out or [("NONE", "No preset", "")]


class MDNA_Props(bpy.types.PropertyGroup):
    energy: bpy.props.EnumProperty(name="Energy", items=[("ALL", "All", ""), ("Soft", "Soft", ""), ("Medium", "Medium", ""), ("Dynamic", "Dynamic", "")])
    preset: bpy.props.EnumProperty(name="Preset", items=preset_items)
    phase: bpy.props.EnumProperty(name="Phase", items=[("in", "In", "Entrance"), ("out", "Out", "Exit"), ("both", "In + Out", "Entrance, and the exit at the end of the scene")])
    start: bpy.props.IntProperty(name="Start", default=0, min=0)
    stagger: bpy.props.IntProperty(name="Stagger", default=3, min=0, description="Frames between one object and the next")
    duration: bpy.props.FloatProperty(name="Duration ×", default=1.0, min=0.25, max=4.0, step=5)
    intensity: bpy.props.FloatProperty(name="Intensity ×", default=1.0, min=0.0, max=3.0, step=5)


class MDNA_OT_apply(bpy.types.Operator):
    bl_idname = "mdna.apply"
    bl_label = "Apply to selected"
    bl_description = "Animate the selected objects with the preset"
    bl_options = {"REGISTER", "UNDO"}

    def execute(self, context):
        p = context.scene.mdna
        objs = sorted(context.selected_objects, key=lambda o: o.name)
        if not objs or p.preset == "NONE":
            self.report({"WARNING"}, "Select objects and a preset"); return {"CANCELLED"}
        end_scene = context.scene.frame_end
        for i, ob in enumerate(objs):
            s = p.start + i * p.stagger
            if p.phase in ("in", "both"):
                M.apply(ob, p.preset, "in", s, duration=p.duration, intensity=p.intensity)
            if p.phase == "out":
                M.apply(ob, p.preset, "out", s, duration=p.duration, intensity=p.intensity)
            if p.phase == "both":
                M.apply(ob, p.preset, "out", max(s + 10, end_scene - round(21 * p.duration) - (len(objs) - 1 - i) * p.stagger), duration=p.duration, intensity=p.intensity)
        self.report({"INFO"}, f"{p.preset} on {len(objs)} object(s)")
        return {"FINISHED"}


class MDNA_OT_remove(bpy.types.Operator):
    bl_idname = "mdna.remove"
    bl_label = "Remove"
    bl_description = "Remove the animation from the selected objects"
    bl_options = {"REGISTER", "UNDO"}

    def execute(self, context):
        for ob in context.selected_objects:
            ob.animation_data_clear()
        return {"FINISHED"}


class MDNA_OT_playhead(bpy.types.Operator):
    bl_idname = "mdna.playhead"
    bl_label = "Playhead"
    bl_description = "Start at the current frame"

    def execute(self, context):
        context.scene.mdna.start = context.scene.frame_current
        return {"FINISHED"}


class MDNA_PT_panel(bpy.types.Panel):
    bl_label = "Motion DNA"
    bl_space_type = "VIEW_3D"
    bl_region_type = "UI"
    bl_category = "Motion DNA"

    def draw(self, context):
        p, lay = context.scene.mdna, self.layout
        lay.label(text=f"{len(M.portable())} presets on the token curves", icon="IPO_BEZIER")
        lay.prop(p, "energy", expand=True)
        lay.prop(p, "preset", text="")
        i = INFO.get(p.preset)
        if i:
            box = lay.box(); col = box.column(align=True)
            col.label(text=i["use"]); col.label(text=f"{i['channels']} · {i['energy']}")
        lay.prop(p, "phase", expand=True)
        row = lay.row(align=True); row.prop(p, "start"); row.operator("mdna.playhead", text="", icon="TIME")
        col = lay.column(align=True)
        col.prop(p, "stagger"); col.prop(p, "duration"); col.prop(p, "intensity")
        row = lay.row(align=True); row.scale_y = 1.4
        row.operator("mdna.apply", icon="PLAY"); row.operator("mdna.remove", text="", icon="X")


CLASSES = (MDNA_Props, MDNA_OT_apply, MDNA_OT_remove, MDNA_OT_playhead, MDNA_PT_panel)


def register():
    importlib.reload(M)
    for c in CLASSES:
        bpy.utils.register_class(c)
    bpy.types.Scene.mdna = bpy.props.PointerProperty(type=MDNA_Props)


def unregister():
    del bpy.types.Scene.mdna
    for c in reversed(CLASSES):
        bpy.utils.unregister_class(c)


if __name__ == "__main__":
    register()
