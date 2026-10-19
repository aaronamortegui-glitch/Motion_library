"""Motion DNA for Blender (beta add-on): a "Motion DNA" tab in the 3D Viewport's sidebar (N), laid out like the After
Effects panel: Behaviors (choose a type: Moves, Effects, Text, Loops, Elements; pick a preset or a kit piece from its
thumbnail, adjust, In / Out / Both, Create) and Curves (the token curves, Apply to the selected keyframes).
Kit pieces come from research/platforms/kit_portable.json (mdna_blender.kit), the same catalog as Cavalry.
Install: python research/platforms/blender/install.py  (a loader that runs this file from the clone)
"""
bl_info = {
    "name": "Motion DNA",
    "author": "Motion DNA",
    "version": (0, 3, 0),
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

# kit pieces: thumbnails from library/thumbs_sm/<folder>/<slug>.png when present
KIT_THUMBS = {"Effects": "motion", "Text": "text", "Loops": "fx", "Elements": "text"}
KIT_ALIAS = {"wiggle": "wiggle-rotate", "counter": "count-up"}
PHASE_LABEL = {"emphasis": "Emphasis (plays once)", "loop": "Loop (repeats)", "transition": "Transition (whole frame)"}
NO_INTENSITY = ("typewriter", "counter", "bars_transition", "wipe_reveal", "iris_reveal", "line_draw")


def _kit_icon(it):
    pc = PREVIEWS.get("main")
    if pc is None:
        return 0
    key = f"kit:{it['id']}"
    if key not in pc:
        slug = KIT_ALIAS.get(it["id"], _slug(it["name"]))
        path = M.ROOT / "library/thumbs_sm" / KIT_THUMBS.get(it["type"], "motion") / f"{slug}.png"
        if not path.exists():
            return 0
        pc.load(key, str(path), "IMAGE")
    return pc[key].icon_id


def piece_items(self, context):
    its = M.kit_list(self.kind) if self.kind != "MOVES" else []
    _ITEMS["pieces"] = [(it["id"], it["name"], it["use"], _kit_icon(it), i) for i, it in enumerate(its)] or [("NONE", "No piece", "", 0, 0)]
    return _ITEMS["pieces"]


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
    kind: bpy.props.EnumProperty(name="Type", items=[
        ("MOVES", "Moves", "The portable presets"), ("Effects", "Effects", "Blur, wipes, skew, line draw"),
        ("Text", "Text", "Per letter, per word, typewriter"), ("Loops", "Loops", "Float, pulse, wiggle"),
        ("Elements", "Elements", "New objects: counter, bars transition")])
    piece: bpy.props.EnumProperty(name="Piece", items=piece_items)
    counter_from: bpy.props.FloatProperty(name="From", default=0.0)
    counter_to: bpy.props.FloatProperty(name="To", default=1250.0)
    counter_decimals: bpy.props.IntProperty(name="Decimals", default=0, min=0, max=4)
    counter_prefix: bpy.props.StringProperty(name="Prefix", default="")
    counter_suffix: bpy.props.StringProperty(name="Suffix", default="")
    bars_count: bpy.props.IntProperty(name="Bars", default=6, min=1, max=24)
    bars_direction: bpy.props.EnumProperty(name="Direction", items=[
        ("left_to_right", "Left to right", ""), ("right_to_left", "Right to left", ""),
        ("top_to_bottom", "Top to bottom", ""), ("bottom_to_top", "Bottom to top", "")])
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
        if p.kind != "MOVES":
            return self.kit(context, p)
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

    def kit(self, context, p):
        it = M.KIT_BY_ID.get(p.piece)
        if not it:
            self.report({"WARNING"}, "Pick a piece"); return {"CANCELLED"}
        objs = sorted(context.selected_objects, key=lambda o: o.name)
        if not objs and not it.get("creates"):
            self.report({"WARNING"}, "Select objects first"); return {"CANCELLED"}
        params = {}
        if it["id"] == "counter":
            params = {"from": p.counter_from, "to": p.counter_to, "decimals": p.counter_decimals,
                      "prefix": p.counter_prefix, "suffix": p.counter_suffix}
        elif it["id"] == "bars_transition":
            params = {"count": p.bars_count, "direction": p.bars_direction}
        ease = None if p.override == "OWN" else p.override
        kw = dict(duration=p.duration, intensity=p.intensity, stagger=p.stagger, ease=ease, params=params)
        phases = it["phase"]
        try:
            if "in" in phases and "out" in phases:
                r = None
                if p.phase in ("in", "both"):
                    r = M.kit(it["id"], objs, "in", p.start, **kw)
                if p.phase == "out":
                    r = M.kit(it["id"], objs, "out", p.start, **kw)
                elif p.phase == "both":   # the exit ends with the scene
                    span = r["end"] - p.start
                    r = M.kit(it["id"], objs, "out", max(r["end"] + 10, context.scene.frame_end - span), **kw)
            else:
                r = M.kit(it["id"], objs, phases[0], p.start, **kw)
        except Exception as e:   # noqa: BLE001  (shown in the UI)
            self.report({"ERROR"}, str(e)); return {"CANCELLED"}
        extra = f", covered at frame {r['cut']:g}" if "cut" in r else ""
        self.report({"INFO"}, f"{it['name']} on {len(r['objects'])} object(s){extra}")
        return {"FINISHED"}


class MDNA_OT_remove(bpy.types.Operator):
    bl_idname = "mdna.remove"
    bl_label = "Remove"
    bl_description = "Remove the animation from the selected objects"
    bl_options = {"REGISTER", "UNDO"}

    def execute(self, context):
        for ob in context.selected_objects:
            if ob.get("mdna_piece") is not None and ob.parent:
                ob = ob.parent
            if ob.get("mdna_split"):
                M._unsplit(ob)   # the per-letter / per-word pieces go, the text comes back
            ob.animation_data_clear()   # keys and drivers (blur)
            if getattr(ob.data, "animation_data", None):
                ob.data.animation_data_clear()   # Line Draw keys live on the curve
            ob.delta_location = (0, 0, 0); ob.delta_rotation_euler = (0, 0, 0); ob.delta_scale = (1, 1, 1)
            ob.color[3] = 1.0
            for k in [k for k in ob.keys() if k.startswith("mdna_") and k != "mdna_counter_path"]:
                del ob[k]
            md = ob.modifiers.get("MDNA Skew")
            if md:
                ob.modifiers.remove(md)
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
        lay.label(text="1  Choose a type")
        col = lay.column(align=True)
        col.row(align=True).prop_enum(p, "kind", "MOVES")
        for pair in (("Effects", "Text"), ("Loops", "Elements")):
            r = col.row(align=True)
            for k in pair:
                r.prop_enum(p, "kind", k)
        lay.separator()
        if p.kind != "MOVES":
            return self.kit(p, lay)
        lay.label(text="2  Pick a preset")
        lay.prop(p, "energy", expand=True)
        lay.template_icon_view(p, "preset", show_labels=True, scale=7.0, scale_popup=5.0)
        i = INFO.get(p.preset)
        box = lay.box(); col = box.column(align=True)
        col.label(text=f"{p.preset}  ·  {i['energy'].lower() if i else ''}", icon="DOT")
        if i:
            col.label(text=i["use"]); col.label(text=i["channels"])
        lay.separator()
        lay.label(text="3  Adjust, then Create")
        col = lay.column(align=True)
        col.prop(p, "duration"); col.prop(p, "intensity")
        lay.prop(p, "override", text="Curve")
        col = lay.column(align=True)
        col.prop(p, "stagger")
        row = col.row(align=True); row.prop(p, "start"); row.operator("mdna.playhead", text="", icon="TIME")
        lay.prop(p, "phase", expand=True)
        row = lay.row(align=True); row.scale_y = 1.5
        row.operator("mdna.apply", icon="PLAY"); row.operator("mdna.remove", icon="X")

    def kit(self, p, lay):
        lay.label(text="2  Pick an element" if p.kind == "Elements" else "2  Pick a piece")
        its = M.kit_list(p.kind)
        if its and all(_kit_icon(it) for it in its):
            lay.template_icon_view(p, "piece", show_labels=True, scale=7.0, scale_popup=5.0)
        else:
            lay.prop(p, "piece", expand=True)
        it = M.KIT_BY_ID.get(p.piece)
        box = lay.box(); col = box.column(align=True)
        if it:
            col.label(text=it["name"], icon="DOT")
            line = ""
            for w in it["use"].split():   # wrap the 'use' text
                if len(line) + len(w) > 40:
                    col.label(text=line); line = ""
                line += w + " "
            col.label(text=line)
            if it.get("creates"):
                line = "Creates"
                for w in it["creates"].split():
                    if len(line) + len(w) > 38:
                        col.label(text=line, icon="ADD" if line.startswith("Creates") else "NONE"); line = ""
                    line += " " + w
                col.label(text=line.strip())
        lay.separator()
        lay.label(text="3  Adjust, then Create")
        if it and it["id"] == "counter":
            col = lay.column(align=True)
            row = col.row(align=True); row.prop(p, "counter_from"); row.prop(p, "counter_to")
            col.prop(p, "counter_decimals")
            row = col.row(align=True); row.prop(p, "counter_prefix"); row.prop(p, "counter_suffix")
        elif it and it["id"] == "bars_transition":
            col = lay.column(align=True); col.prop(p, "bars_count"); col.prop(p, "bars_direction", text="")
        col = lay.column(align=True)
        col.prop(p, "duration")
        if it and it["id"] not in NO_INTENSITY:
            col.prop(p, "intensity")
        if it and it["id"] not in ("wiggle", "typewriter"):
            lay.prop(p, "override", text="Curve")
        col = lay.column(align=True)
        if it and not it.get("creates"):
            col.prop(p, "stagger")
        row = col.row(align=True); row.prop(p, "start"); row.operator("mdna.playhead", text="", icon="TIME")
        phases = it["phase"] if it else ["in"]
        if "in" in phases and "out" in phases:
            row = lay.row(align=True)
            for ph in ("in", "out", "both"):
                row.prop_enum(p, "phase", ph)
        elif phases == ["in"]:
            lay.label(text="In (entrance only)", icon="FORWARD")
        else:
            lay.label(text=PHASE_LABEL.get(phases[0], phases[0]), icon="FILE_REFRESH" if phases[0] == "loop" else "FORWARD")
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
