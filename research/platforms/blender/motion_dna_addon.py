"""Motion DNA for Blender (beta add-on): a "Motion DNA" tab in the 3D Viewport's sidebar (N), laid out like the After
Effects panel: Behaviors (pick a preset from its thumbnail, adjust, In / Out / Both, Create) and Curves (the token
curves, Apply to the selected keyframes).
Install: python research/platforms/blender/install.py  (a loader that runs this file from the clone)
"""
bl_info = {
    "name": "Motion DNA",
    "author": "Motion DNA",
    "version": (0, 2, 0),
    "blender": (4, 2, 0),
    "location": "3D Viewport › Sidebar (N) › Motion DNA",
    "description": "Motion DNA presets and token curves for selected objects",
    "category": "Animation",
}

import importlib
import pathlib
import re
import sys

import bpy
import bpy.utils.previews

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
PREVIEWS = {}


def _slug(n):
    return re.sub(r"[^a-z0-9]+", "-", n.lower()).strip("-")


def _icon(kind, name):
    pc = PREVIEWS.get("main")
    if pc is None:
        return 0
    key = f"{kind}:{name}"
    if key not in pc:
        path = (M.ROOT / "library/thumbs_sm/motion" / f"{_slug(name)}.png") if kind == "preset" else \
            (HERE.parent / "assets/curves" / f"{name.lower()}.png")
        if not path.exists():
            return 0
        pc.load(key, str(path), "IMAGE")
    return pc[key].icon_id


_ITEMS = {}   # Blender needs the enum item lists kept alive


def preset_items(self, context):
    out = []
    for i, n in enumerate(M.portable()):
        info = INFO.get(n, {})
        if self.energy != "ALL" and info.get("energy") != self.energy:
            continue
        out.append((n, n, f"{info.get('use', '')} · {info.get('channels', '')} · {info.get('energy', '')}", _icon("preset", n), i))
    _ITEMS["presets"] = out or [("NONE", "No preset", "", 0, 0)]
    return _ITEMS["presets"]


def curve_items(self, context):
    _ITEMS["curves"] = [(n, n, ", ".join(str(v) for v in M.EASE[n]), _icon("curve", n), i) for i, n in enumerate(M.EASE)]
    return _ITEMS["curves"]


def override_items(self, context):
    _ITEMS["override"] = [("OWN", "Preset's own curves", "", 0, 0)] + [(n, n, "", _icon("curve", n), i + 1) for i, n in enumerate(M.EASE)]
    return _ITEMS["override"]


class MDNA_Props(bpy.types.PropertyGroup):
    tab: bpy.props.EnumProperty(items=[("BEHAVIORS", "Behaviors", "", "ANIM", 0), ("CURVES", "Curves", "", "IPO_BEZIER", 1)])
    energy: bpy.props.EnumProperty(name="Energy", items=[("ALL", "All", ""), ("Soft", "Soft", ""), ("Medium", "Medium", ""), ("Dynamic", "Dynamic", "")])
    preset: bpy.props.EnumProperty(name="Preset", items=preset_items)
    phase: bpy.props.EnumProperty(name="Phase", items=[("in", "In", "Entrance"), ("out", "Out", "Exit"), ("both", "Both", "Entrance, and the exit at the end of the scene")])
    start: bpy.props.IntProperty(name="Start frame", default=0, min=0)
    stagger: bpy.props.IntProperty(name="Stagger", default=3, min=0, description="Frames between one object and the next")
    duration: bpy.props.FloatProperty(name="Duration ×", default=1.0, min=0.25, max=4.0, step=5)
    intensity: bpy.props.FloatProperty(name="Intensity ×", default=1.0, min=0.0, max=3.0, step=5)
    override: bpy.props.EnumProperty(name="Curve", items=override_items)
    curve: bpy.props.EnumProperty(name="Curve", items=curve_items)


class MDNA_OT_apply(bpy.types.Operator):
    bl_idname = "mdna.apply"
    bl_label = "Create"
    bl_description = "Animate the selected objects with the preset"
    bl_options = {"REGISTER", "UNDO"}

    def execute(self, context):
        p = context.scene.mdna
        objs = sorted(context.selected_objects, key=lambda o: o.name)
        if not objs or p.preset == "NONE":
            self.report({"WARNING"}, "Select objects and a preset"); return {"CANCELLED"}
        ease = None if p.override == "OWN" else p.override
        kw = dict(duration=p.duration, intensity=p.intensity, ease=ease)
        end_scene = context.scene.frame_end
        for i, ob in enumerate(objs):
            s = p.start + i * p.stagger
            if p.phase in ("in", "both"):
                M.apply(ob, p.preset, "in", s, **kw)
            if p.phase == "out":
                M.apply(ob, p.preset, "out", s, **kw)
            if p.phase == "both":
                M.apply(ob, p.preset, "out", max(s + 10, end_scene - round(21 * p.duration) - (len(objs) - 1 - i) * p.stagger), **kw)
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


class MDNA_OT_ease_keys(bpy.types.Operator):
    bl_idname = "mdna.ease_keys"
    bl_label = "Apply to selected keyframes"
    bl_description = "Every pair of selected keyframes on the selected objects gets this curve"
    bl_options = {"REGISTER", "UNDO"}

    def execute(self, context):
        c = context.scene.mdna.curve
        n = sum(M.ease_selected_keys(ob, c) for ob in context.selected_objects)
        self.report({"INFO"} if n else {"WARNING"}, f"{c} on {n} segment(s)" if n else "Select at least two keyframes on one curve")
        return {"FINISHED"}


class MDNA_PT_panel(bpy.types.Panel):
    bl_label = "Motion DNA"
    bl_space_type = "VIEW_3D"
    bl_region_type = "UI"
    bl_category = "Motion DNA"

    def draw(self, context):
        p, lay = context.scene.mdna, self.layout
        lay.prop(p, "tab", expand=True)
        (self.behaviors if p.tab == "BEHAVIORS" else self.curves)(p, lay)

    def behaviors(self, p, lay):
        lay.label(text="1  Pick a preset")
        lay.prop(p, "energy", expand=True)
        lay.template_icon_view(p, "preset", show_labels=True, scale=7.0, scale_popup=5.0)
        i = INFO.get(p.preset)
        box = lay.box(); col = box.column(align=True)
        col.label(text=f"{p.preset}  ·  {i['energy'].lower() if i else ''}", icon="DOT")
        if i:
            col.label(text=i["use"]); col.label(text=i["channels"])
        lay.separator()
        lay.label(text="2  Adjust, then Create")
        col = lay.column(align=True)
        col.prop(p, "duration"); col.prop(p, "intensity")
        lay.prop(p, "override", text="Curve")
        col = lay.column(align=True)
        col.prop(p, "stagger")
        row = col.row(align=True); row.prop(p, "start"); row.operator("mdna.playhead", text="", icon="TIME")
        lay.prop(p, "phase", expand=True)
        row = lay.row(align=True); row.scale_y = 1.5
        row.operator("mdna.apply", icon="PLAY"); row.operator("mdna.remove", icon="X")

    def curves(self, p, lay):
        lay.label(text="1  Pick a token curve")
        lay.template_icon_view(p, "curve", show_labels=True, scale=7.0, scale_popup=4.0)
        b = M.EASE.get(p.curve, [0, 0, 1, 1])
        lay.label(text=f"{p.curve}   cubic-bezier({', '.join(str(v) for v in b)})")
        lay.separator()
        lay.label(text="2  Select keyframes, then Apply")
        row = lay.row(); row.scale_y = 1.5
        row.operator("mdna.ease_keys", icon="IPO_BEZIER")


CLASSES = (MDNA_Props, MDNA_OT_apply, MDNA_OT_remove, MDNA_OT_playhead, MDNA_OT_ease_keys, MDNA_PT_panel)


def register():
    importlib.reload(M)
    PREVIEWS["main"] = bpy.utils.previews.new()
    for c in CLASSES:
        bpy.utils.register_class(c)
    bpy.types.Scene.mdna = bpy.props.PointerProperty(type=MDNA_Props)


def unregister():
    del bpy.types.Scene.mdna
    for c in reversed(CLASSES):
        bpy.utils.unregister_class(c)
    for pc in PREVIEWS.values():
        bpy.utils.previews.remove(pc)
    PREVIEWS.clear()


if __name__ == "__main__":
    register()
