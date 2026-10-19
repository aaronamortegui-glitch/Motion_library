"""Motion DNA for Blender (beta): applies the portable presets (research/platforms/portable_presets.json) to objects,
with the token curves as exact bezier handles (Blender's F-curves are the same cubic bezier as the tokens).

Screen conventions: the camera looks along +Y, so screen right is +X and screen up is +Z. A preset's pixel offsets
become Blender units through `px` (default 1/180: 1080 px ≈ 6 units, the frame height of the demo camera).

Kit pieces (research/platforms/kit_portable.json: Effects, Text, Loops, Elements): M.kit_list(), and
M.kit("blur_in", [obj], "in", start=0, duration=1, intensity=1, stagger=3, ease=None, params=None) -> {"end", "objects"}.
How each piece is built (all saved in the .blend, no frame handlers): Blur In / Slam In = camera depth of field, the
object moved toward the camera by drivers from a keyed obj["mdna_blur"] (px at 1080p); Wipe / Iris = a material mask
reading keyed object properties; Jello / Light Speed In = a Geometry Nodes skew modifier with its input keyed; Line Draw
= curve bevel_factor_end/start; Chars Rise / Words Fade Up / Typewriter = the text split into one object per letter or
word (String to Curves layout), keyed per piece (typewriter: keyed visibility); Float / Pulse / Wiggle = delta
transforms with CYCLES / NOISE modifiers; Counter = Geometry Nodes (Value to String + string nodes for the thousands
separator), the value keyed; Bars Transition = planes parented to the camera. Notes: text pieces keep the object's
font (Blender's built-in one by default): Inter Tight renders broken in Blender (overlapping contours); the counter
runs in 32-bit floats, exact to about 7 significant digits (1234567.89 shows 1,234,567.80).

Inside Blender:   import mdna_blender as M; M.apply(obj, "Fade Up", "in", start=0)
Kit headless:     blender -b scene.blend -P mdna_blender.py -- kit blur_in --objects Photo --phase in --save out.blend
Headless:         blender -b scene.blend -P mdna_blender.py -- apply "Fade Up" --objects Title,Card --phase in --start 0
                  blender -b scene.blend -P mdna_blender.py -- list
"""
import json
import math
import pathlib
import sys
import zlib

import bpy
from mathutils import Matrix, Vector

ROOT = pathlib.Path(__file__).resolve().parents[3]
TOKENS = json.load(open(ROOT / "tokens/superside_motion_tokens.json", encoding="utf-8"))
RECIPES = json.load(open(ROOT / "research/platforms/portable_presets.json", encoding="utf-8"))
EASE = {e["name"]: e["bezier"] for e in TOKENS["easings"]}
DUR = {d["name"]: d["frames"] for d in TOKENS["durations"]}


def portable():
    return list(RECIPES["portable"])


def _bezier_of(seg):
    if seg.get("ease"):
        return EASE.get(seg["ease"], [0, 0, 1, 1])
    if seg.get("bezier"):
        return seg["bezier"]
    ae = seg.get("ae") or {}
    if ae.get("out") == "linear" or not ae:
        return [0, 0, 1, 1]
    o, i = ae["out"], ae["in"]   # After Effects influence (%) and speed relative to the average
    x1, x2 = o["influence"] / 100, 1 - i["influence"] / 100
    return [x1, x1 * o.get("speed_x_avg", 0), x2, 1 - (1 - x2) * i.get("speed_x_avg", 0)]


def _fcurve(obj, path, index):
    ad = obj.animation_data
    act = ad.action
    if hasattr(act, "fcurves"):
        curves = act.fcurves
    else:   # Blender 5: layered actions keep their curves in the slot's channelbag
        curves = act.layers[0].strips[0].channelbag(ad.action_slot).fcurves
    return next(c for c in curves if c.data_path == path and c.array_index == index)


def _key(obj, path, index, f0, v0, f1, v1, bz):
    """Keys path[index] from v0 at f0 to v1 at f1 with the cubic-bezier bz as free handles."""
    target = getattr(obj, path)   # location, scale, rotation_euler, color: all vectors
    for f, v in ((f0, v0), (f1, v1)):
        target[index] = v
        obj.keyframe_insert(path, index=index, frame=f)
    fc = _fcurve(obj, path, index)
    pts = {round(k.co.x, 3): k for k in fc.keyframe_points}
    k0, k1 = pts[round(f0, 3)], pts[round(f1, 3)]
    dt, dv = f1 - f0, v1 - v0
    k0.interpolation = "BEZIER"
    k0.handle_right_type = "FREE"; k1.handle_left_type = "FREE"
    k0.handle_right = (f0 + bz[0] * dt, v0 + bz[1] * dv)
    k1.handle_left = (f0 + bz[2] * dt, v0 + bz[3] * dv)


def _ensure_material(obj):
    """Objects without a material get a plain one (the default grey), so opacity and masks have a shader to drive."""
    if obj.type not in ("MESH", "CURVE", "FONT", "SURFACE", "META") or obj.material_slots:
        return
    m = bpy.data.materials.get("MDNA Default") or bpy.data.materials.new("MDNA Default")
    m.use_nodes = True
    obj.data.materials.append(m)


def _alpha_node(m):
    """The node whose output is the material's opacity (object alpha x masks): a Mix Shader with a Transparent BSDF is
    put in front of the Material Output, so it works with any shader (Principled, Emission, Toon...). Made once."""
    if not m:
        return None
    if not m.node_tree:
        m.use_nodes = True
    nt = m.node_tree
    n = nt.nodes.get("MDNA Alpha")
    if n:
        return n
    outs = [o for o in nt.nodes if o.type == "OUTPUT_MATERIAL"]
    out = next((o for o in outs if o.is_active_output), outs[0] if outs else None)
    if not out or not out.inputs["Surface"].is_linked:
        return None
    src = out.inputs["Surface"].links[0].from_socket
    tr = nt.nodes.new("ShaderNodeBsdfTransparent")
    mix = nt.nodes.new("ShaderNodeMixShader"); mix.name = "MDNA Mix"
    mul = nt.nodes.new("ShaderNodeMath"); mul.operation = "MULTIPLY"; mul.name = mul.label = "MDNA Alpha"
    mul.inputs[0].default_value = 1.0; mul.inputs[1].default_value = 1.0
    if not m.get("mdna_fade"):   # materials faded by older versions already multiply the BSDF alpha by the object alpha
        info = nt.nodes.new("ShaderNodeObjectInfo")
        nt.links.new(info.outputs["Alpha"], mul.inputs[0])
    nt.links.new(mul.outputs[0], mix.inputs["Fac"])
    nt.links.new(tr.outputs[0], mix.inputs[1]); nt.links.new(src, mix.inputs[2])
    nt.links.new(mix.outputs[0], out.inputs["Surface"])
    for node, dx in ((tr, -200), (mix, 0), (mul, -200)):
        node.location = (out.location.x - 200 + dx, out.location.y - (160 if node is mul else 0))
    out.location.x += 200
    if hasattr(m, "surface_render_method"):
        m.surface_render_method = "DITHERED"
    elif hasattr(m, "blend_method"):
        m.blend_method = "BLEND"
    return mul


def _alpha_mul(m, socket):
    """Multiplies the material's opacity by `socket` (a mask)."""
    a = _alpha_node(m)
    if a is None:
        return
    nt = m.node_tree
    if not a.inputs[1].is_linked:
        nt.links.new(socket, a.inputs[1]); return
    prev = a.inputs[1].links[0].from_socket
    mm = nt.nodes.new("ShaderNodeMath"); mm.operation = "MULTIPLY"
    nt.links.new(prev, mm.inputs[0]); nt.links.new(socket, mm.inputs[1]); nt.links.new(mm.outputs[0], a.inputs[1])


def _fade_material(obj):
    """Opacity: every material's opacity is multiplied by the object's color alpha (obj.color[3], keyable)."""
    _ensure_material(obj)
    for slot in obj.material_slots:
        _alpha_node(slot.material)


def apply(obj, name, phase="in", start=0, px=1 / 180, duration=1.0, intensity=1.0, ease=None):
    """Applies preset `name` (phase in|out) to obj from frame `start`. Returns the end frame. ease: a token that replaces
    the preset's own curves (opacity keeps its own)."""
    rec = RECIPES["presets"].get(name)
    if not rec:
        raise KeyError(f"preset not found: {name}")
    segs = rec.get(phase)
    if not isinstance(segs, list) or not segs:
        raise ValueError(f"{name} has no portable {phase} phase")
    if name not in RECIPES["portable"]:
        print(f"[mdna] {name}: only part of it is portable (After Effects only: {', '.join(rec['ae_only'])})")
    fps = bpy.context.scene.render.fps / bpy.context.scene.render.fps_base
    k = fps / RECIPES["fps"] * duration
    rest_loc, rest_scale, rest_rot = obj.location.copy(), obj.scale.copy(), obj.rotation_euler.copy()
    end = start
    for s in segs:
        ch = s.get("channel")
        if not ch:
            continue
        f0 = start + s["start_f"] * k
        bz0 = EASE[ease] if ease and ch != "opacity" and ease in EASE else _bezier_of(s)   # the panel's Curve override (fades keep theirs)
        pieces = [(s["from"], s["to"], s["frames"], bz0)]
        if s["kind"] == "stops":   # several token segments in a row
            pieces, v = [], s["from"]
            for st in s["stops"]:
                pieces.append((v, st["v"], st["frames"], EASE.get(st["ease"], [0, 0, 1, 1]))); v = st["v"]
        for a, b, frames, bz in pieces:
            f1 = f0 + frames * k
            if ch == "position":
                for idx, (va, vb) in ((0, (a[0], b[0])), (2, (-a[1], -b[1]))):   # AE y down → Blender z up
                    _key(obj, "location", idx, f0, rest_loc[idx] + va * px * intensity, f1, rest_loc[idx] + vb * px * intensity, bz)
            elif ch == "scale":
                for idx in (0, 1):
                    fa = 1 + (a[idx] - 1) * intensity; fb = 1 + (b[idx] - 1) * intensity
                    _key(obj, "scale", idx, f0, rest_scale[idx] * fa, f1, rest_scale[idx] * fb, bz)
            elif ch == "opacity":
                _fade_material(obj)
                _key(obj, "color", 3, f0, a, f1, b, bz)
            elif ch in ("rotation", "rotationX", "rotationY"):
                idx = {"rotation": 1, "rotationX": 0, "rotationY": 2}[ch]   # screen plane = world Y for a front camera
                _key(obj, "rotation_euler", idx, f0, rest_rot[idx] + math.radians(a * intensity), f1, rest_rot[idx] + math.radians(b * intensity), bz)
            f0 = f1
            end = max(end, f1)
    obj["mdna_preset"] = f"{name} ({phase})"
    return end


def ease_selected_keys(obj, ease_or_bezier):
    """Gives every pair of consecutive selected keyframes on obj's curves the token curve (or a [x1,y1,x2,y2] list)."""
    bz = EASE[ease_or_bezier] if isinstance(ease_or_bezier, str) else list(ease_or_bezier)
    ad = obj.animation_data
    if not ad or not ad.action:
        return 0
    act = ad.action
    curves = act.fcurves if hasattr(act, "fcurves") else [c for l in act.layers for st in l.strips for c in st.channelbag(ad.action_slot).fcurves]
    n = 0
    for fc in curves:
        ks = sorted((k for k in fc.keyframe_points if k.select_control_point), key=lambda k: k.co.x)
        for k0, k1 in zip(ks, ks[1:]):
            (f0, v0), (f1, v1) = k0.co, k1.co
            k0.interpolation = "BEZIER"; k0.handle_right_type = "FREE"; k1.handle_left_type = "FREE"
            k0.handle_right = (f0 + bz[0] * (f1 - f0), v0 + bz[1] * (v1 - v0))
            k1.handle_left = (f0 + bz[2] * (f1 - f0), v0 + bz[3] * (v1 - v0))
            n += 1
    return n


# ---------------------------------------------------------------------------------------------------------------------
# Kit pieces (research/platforms/kit_portable.json): Effects, Text, Loops and Elements beyond the portable presets.
# Every keyed value uses the token curve as exact bezier handles; drivers (simple expressions, no Python needed) only
# turn a keyed value into the channels that show it. Nothing relies on frame handlers: it all lives in the .blend.
# ---------------------------------------------------------------------------------------------------------------------
KIT = json.load(open(ROOT / "research/platforms/kit_portable.json", encoding="utf-8"))
KIT_BY_ID = {it["id"]: it for it in KIT["items"]}
DOF_ORTHO = 0.02   # EEVEE ortho circle of confusion: radius (scene units) = 0.02 * depth offset / f-stop (measured)


def kit_list(kind=None):
    """The kit pieces (dicts from kit_portable.json), optionally of one type (Effects, Text, Loops, Elements)."""
    return [dict(it) for it in KIT["items"] if kind in (None, it["type"])]


def _srgb_to_linear(hexstr):
    h = hexstr.lstrip("#")
    out = []
    for i in (0, 2, 4):
        c = int(h[i:i + 2], 16) / 255
        out.append(c / 12.92 if c <= 0.04045 else ((c + 0.055) / 1.055) ** 2.4)
    return tuple(out)


def _curves(idb):
    ad = idb.animation_data
    if not ad or not ad.action:
        return []
    act = ad.action
    if hasattr(act, "fcurves"):
        return list(act.fcurves)
    out = []
    for lay in act.layers:
        for st in lay.strips:
            cb = st.channelbag(ad.action_slot)
            if cb:
                out.extend(cb.fcurves)
    return out


def _find_fc(idb, path, index=0):
    return next((c for c in _curves(idb) if c.data_path == path and c.array_index == (index or 0)), None)


def _set(idb, path, index, v):
    if path.startswith('["'):
        idb[path[2:-2]] = v
    elif path.startswith('modifiers["'):
        q = path.split('"')
        idb.modifiers[q[1]][q[3]] = v
    elif index is None or index < 0:
        head, _, attr = path.rpartition(".")
        setattr(idb.path_resolve(head) if head else idb, attr, v)
    else:
        idb.path_resolve(path)[index] = v


def _keyp(idb, path, index, f0, v0, f1, v1, bz):
    """Like _key for any data path (custom properties '["x"]', modifier sockets, delta_location, data.x...)."""
    for f, v in ((f0, v0), (f1, v1)):
        _set(idb, path, index, v)
        idb.keyframe_insert(path, index=-1 if index is None else index, frame=f)
    fc = _find_fc(idb, path, index)
    pts = {round(k.co.x, 3): k for k in fc.keyframe_points}
    k0, k1 = pts[round(f0, 3)], pts[round(f1, 3)]
    dt, dv = f1 - f0, v1 - v0
    k0.interpolation = "BEZIER"
    k0.handle_right_type = "FREE"; k1.handle_left_type = "FREE"
    k0.handle_right = (f0 + bz[0] * dt, v0 + bz[1] * dv)
    k1.handle_left = (f0 + bz[2] * dt, v0 + bz[3] * dv)
    return fc


def _keys_stops(idb, path, index, f0, values, frames_each, beziers):
    """Several token segments in a row: values[0] -> values[1] -> ... each over frames_each with its bezier."""
    fc = None
    for i, (a, b) in enumerate(zip(values, values[1:])):
        fa = f0 + i * frames_each
        fc = _keyp(idb, path, index, fa, a, fa + frames_each, b, beziers[i] if isinstance(beziers[0], list) else beziers)
    return fc


def _key_const(idb, path, index, pairs):
    """Step keys (CONSTANT interpolation): pairs of (frame, value)."""
    for f, v in pairs:
        _set(idb, path, index, v)
        idb.keyframe_insert(path, index=-1 if index is None else index, frame=f)
    fc = _find_fc(idb, path, index)
    frames = {round(f, 3) for f, _ in pairs}
    for k in fc.keyframe_points:
        if round(k.co.x, 3) in frames:
            k.interpolation = "CONSTANT"
    return fc


def _clear_fc(idb, path, index):
    fc = _find_fc(idb, path, index)
    if fc is None:
        return
    ad = idb.animation_data; act = ad.action
    if hasattr(act, "fcurves"):
        act.fcurves.remove(fc)
    else:
        for lay in act.layers:
            for st in lay.strips:
                cb = st.channelbag(ad.action_slot)
                if cb and fc in list(cb.fcurves):
                    cb.fcurves.remove(fc); return


def _driver(obj, path, index, expr, var_path):
    try:
        obj.driver_remove(path, index)
    except TypeError:
        pass
    fc = obj.driver_add(path, index)
    for m in list(fc.modifiers):
        fc.modifiers.remove(m)
    d = fc.driver; d.type = "SCRIPTED"
    v = d.variables.new(); v.name = "b"; v.type = "SINGLE_PROP"
    v.targets[0].id_type = "OBJECT"; v.targets[0].id = obj; v.targets[0].data_path = var_path
    d.expression = expr
    return fc


def _ease(token, override):
    return EASE.get(override) if override in EASE else EASE.get(token, [0, 0, 1, 1])


def _appear(obj, f):
    """The object is invisible before frame f (opacity steps 0 -> 1)."""
    _fade_material(obj)
    _key_const(obj, "color", 3, [(f - 1, 0.0), (f, 1.0)])


def _fade(obj, f0, f1, a, b, bz):
    _fade_material(obj)
    _keyp(obj, "color", 3, f0, a, f1, b, bz)


def _loc_space(obj, vec_world):
    """A world vector expressed in the space of obj.location / delta_location (parent and parent inverse)."""
    if not obj.parent:
        return vec_world.copy()
    return (obj.parent.matrix_world @ obj.matrix_parent_inverse).to_3x3().inverted() @ vec_world


def _frame_size(sc, cam, dist=1.0):
    """Width and height of the camera frame in scene units (at `dist` in front of a perspective camera)."""
    rx = sc.render.resolution_x * sc.render.pixel_aspect_x
    ry = sc.render.resolution_y * sc.render.pixel_aspect_y
    c = cam.data
    fit = c.sensor_fit if c.sensor_fit != "AUTO" else ("HORIZONTAL" if rx >= ry else "VERTICAL")
    if c.type == "ORTHO":
        size = c.ortho_scale
    else:
        sensor = c.sensor_height if c.sensor_fit == "VERTICAL" else c.sensor_width
        size = dist * sensor / c.lens
    return (size, size * ry / rx) if fit == "HORIZONTAL" else (size * rx / ry, size)


# --- blur (Blur In, Slam In): depth of field ---------------------------------------------------------------------------
# A panel user can blur any object (text, mesh, image plane) in one render pass, and several objects each on their own
# timing, with no view layers or compositor: the camera's depth of field is on, focused on the object's plane, and the
# object is moved toward the camera while it is blurred. The blur amount (px at 1080p) is a keyed custom property
# obj["mdna_blur"] with the token curve; drivers turn it into the depth offset (delta_location), so the blur follows
# the curve exactly. Ortho camera: blur is linear in depth and the size does not change. Perspective camera: the object
# slides along the camera ray and delta_scale compensates, so it keeps its size on screen (k = Q / (Q + blur)).
# Trade-offs: the bokeh is EEVEE's depth of field (a disc, softer than AE's Gaussian at the same radius); other objects
# off the focus plane get a little blur (the f-stop is chosen so the requested blur uses ~85% of the room in front of
# the object, so a layer 0.2 units deeper gets <1 px); in perspective, Float/Pulse on the same object fight the drivers.
def _blur(obj, f0, f1, b0, b1, bz):
    sc = bpy.context.scene
    cam = sc.camera
    obj["mdna_blur"] = float(b0)
    fc = _keyp(obj, '["mdna_blur"]', None, f0, b0, f1, b1, bz)
    if not cam:
        print(f"[mdna] {obj.name}: no scene camera, the blur is keyed (obj['mdna_blur']) but not shown"); return fc
    bmax = max(abs(b0), abs(b1), 1e-6)
    c = cam.data
    rx, ry = sc.render.resolution_x, sc.render.resolution_y
    s_r = min(rx, ry) / 1080 * sc.render.resolution_percentage / 100   # render px per 1080p px
    cm = cam.matrix_world
    fwd = -(cm.to_3x3() @ Vector((0, 0, 1))).normalized()   # camera looks along its -Z
    to_world = (obj.parent.matrix_world @ obj.matrix_parent_inverse).to_3x3() if obj.parent else Matrix.Identity(3)
    P = obj.matrix_world.translation - to_world @ obj.delta_location   # rest position: without a blur already applied
    depth = (P - cm.translation).dot(fwd)
    room = depth - c.clip_start
    if depth <= 0:
        print(f"[mdna] {obj.name}: behind the camera, no blur"); return fc
    W, H = _frame_size(sc, cam, depth)
    ppu = rx * sc.render.resolution_percentage / 100 / W          # render px per scene unit on the object's plane
    ours = c.get("mdna_dof")
    if not c.dof.use_dof:
        c.dof.use_dof = True; c.dof.focus_object = None; c.dof.focus_distance = depth; c["mdna_dof"] = True
        ours = True
        if c.type == "ORTHO":
            c.dof.aperture_fstop = 0.85 * room * DOF_ORTHO * ppu / (bmax * s_r)
        else:
            f = c.lens / 1000; sens = W / depth * f   # sensor size (scene units) across the frame width
            k_min = max(0.15, 1.5 * c.clip_start / depth)
            c.dof.aperture_fstop = f * f / (2 * (depth - f)) * (rx / sens) * (1 / k_min - 1) / (bmax * s_r)
    focus = (c.dof.focus_object.matrix_world.translation - cm.translation).dot(fwd) if c.dof.focus_object else c.dof.focus_distance
    N = max(c.dof.aperture_fstop, 1e-4)
    rest_px = abs(focus - depth) * DOF_ORTHO * ppu / N / s_r if c.type == "ORTHO" else 0
    if rest_px > 1 or (c.type != "ORTHO" and abs(focus - depth) > 0.01 * depth):
        print(f"[mdna] {obj.name}: off the camera's focus plane ({focus:.2f} vs {depth:.2f}): blurred at rest too")
    var = '["mdna_blur"]'
    if c.type == "ORTHO":
        K = s_r * N / (DOF_ORTHO * ppu)                            # scene units per px of blur
        if bmax * K > 0.95 * room:
            print(f"[mdna] {obj.name}: {bmax:.0f} px needs {bmax * K:.2f} units of room, only {room:.2f}: lower the camera f-stop")
        d = _loc_space(obj, -fwd)                                   # toward the camera
        for i in range(3):
            if abs(d[i]) > 1e-6:
                _driver(obj, "delta_location", i, f"b*{d[i] * K:.9g}", var)
            else:
                obj.delta_location[i] = 0.0
    else:
        f = c.lens / 1000; sens = W / depth * f
        Q = f * f / (2 * N * (depth - f)) * (rx * sc.render.resolution_percentage / 100 / sens) / s_r   # 1080p px
        V = _loc_space(obj, P - cm.translation)
        for i in range(3):
            _driver(obj, "delta_location", i, f"-{V[i]:.9g}*b/({Q:.9g}+b)", var)
            _driver(obj, "delta_scale", i, f"{Q:.9g}/({Q:.9g}+b)", var)
    obj["mdna_blur_dof"] = "ours" if ours else "camera"
    return fc


# --- masks (Wipe Reveal, Iris Reveal): the material reads keyed object properties ----------------------------------------
# Values are "hidden amounts" (0 = fully shown), so other objects sharing the material, which do not have the
# properties, stay visible. The edge moves linearly with the property, so it follows the token curve exactly.
def _attr(nt, name, out="Fac"):
    a = nt.nodes.new("ShaderNodeAttribute"); a.attribute_type = "OBJECT"; a.attribute_name = f'["{name}"]'
    return a.outputs[out]


def _math(nt, op, a, b=None, clamp=False):
    n = nt.nodes.new("ShaderNodeMath"); n.operation = op; n.use_clamp = clamp
    for i, x in enumerate((a, b)):
        if x is None:
            continue
        if isinstance(x, (int, float)):
            n.inputs[i].default_value = x
        else:
            nt.links.new(x, n.inputs[i])
    return n.outputs[0]


def _wipe_mask(m):
    nt = m.node_tree
    if nt.nodes.get("MDNA Wipe"):
        return
    tc = nt.nodes.new("ShaderNodeTexCoord"); tc.name = tc.label = "MDNA Wipe"
    axis = _attr(nt, "mdna_wipe_axis", "Vector")
    fe = _math(nt, "MAXIMUM", _attr(nt, "mdna_wipe_feather"), 0.002)
    win, wout = _attr(nt, "mdna_wipe_in"), _attr(nt, "mdna_wipe_out")
    c = nt.nodes.new("ShaderNodeVectorMath"); c.operation = "SUBTRACT"; c.inputs[1].default_value = (0.5, 0.5, 0.5)
    nt.links.new(tc.outputs["Generated"], c.inputs[0])
    dot = nt.nodes.new("ShaderNodeVectorMath"); dot.operation = "DOT_PRODUCT"
    nt.links.new(c.outputs[0], dot.inputs[0]); nt.links.new(axis, dot.inputs[1])
    x = _math(nt, "ADD", dot.outputs["Value"], 0.5)
    onefe = _math(nt, "ADD", fe, 1.0)
    e_in = _math(nt, "MULTIPLY", _math(nt, "SUBTRACT", 1.0, win), onefe)             # reveal edge
    m_in = _math(nt, "DIVIDE", _math(nt, "SUBTRACT", e_in, x), fe, clamp=True)
    e_out = _math(nt, "SUBTRACT", _math(nt, "MULTIPLY", wout, onefe), fe)             # hide edge
    m_out = _math(nt, "DIVIDE", _math(nt, "SUBTRACT", x, e_out), fe, clamp=True)
    _alpha_mul(m, _math(nt, "MULTIPLY", m_in, m_out))


def _iris_mask(m):
    nt = m.node_tree
    if nt.nodes.get("MDNA Iris"):
        return
    tc = nt.nodes.new("ShaderNodeTexCoord"); tc.name = tc.label = "MDNA Iris"
    w, a = _attr(nt, "mdna_iris"), _attr(nt, "mdna_iris_aspect")
    fe = _math(nt, "MAXIMUM", _attr(nt, "mdna_iris_feather"), 0.002)
    sep = nt.nodes.new("ShaderNodeSeparateXYZ"); nt.links.new(tc.outputs["Generated"], sep.inputs[0])
    cx = _math(nt, "MULTIPLY", _math(nt, "SUBTRACT", sep.outputs["X"], 0.5), a)
    cy = _math(nt, "SUBTRACT", sep.outputs["Y"], 0.5)
    dist = _math(nt, "SQRT", _math(nt, "ADD", _math(nt, "MULTIPLY", cx, cx), _math(nt, "MULTIPLY", cy, cy)))
    half_a = _math(nt, "MULTIPLY", a, 0.5)
    rmax = _math(nt, "ADD", _math(nt, "SQRT", _math(nt, "ADD", _math(nt, "MULTIPLY", half_a, half_a), 0.25)), fe)
    r = _math(nt, "MULTIPLY", _math(nt, "SUBTRACT", 1.0, w), rmax)
    _alpha_mul(m, _math(nt, "DIVIDE", _math(nt, "SUBTRACT", r, dist), fe, clamp=True))


def _with_masks(obj, maker):
    _fade_material(obj)
    for slot in obj.material_slots:
        if slot.material and _alpha_node(slot.material):
            maker(slot.material)


# --- skew (Jello, Light Speed In): a Geometry Nodes modifier, its Skew input keyed ------------------------------------
def _skew_group():
    ng = bpy.data.node_groups.get("MDNA Skew")
    if ng:
        return ng
    ng = bpy.data.node_groups.new("MDNA Skew", "GeometryNodeTree")
    ng.interface.new_socket("Geometry", in_out="INPUT", socket_type="NodeSocketGeometry")
    s = ng.interface.new_socket("Skew", in_out="INPUT", socket_type="NodeSocketFloat")   # degrees, CSS skewX sign
    s.min_value, s.max_value = -89, 89
    ng.interface.new_socket("Geometry", in_out="OUTPUT", socket_type="NodeSocketGeometry")
    N, L = ng.nodes, ng.links
    gi = N.new("NodeGroupInput"); go = N.new("NodeGroupOutput")
    sp = N.new("GeometryNodeSetPosition"); pos = N.new("GeometryNodeInputPosition")
    sep = N.new("ShaderNodeSeparateXYZ")
    rad = N.new("ShaderNodeMath"); rad.operation = "RADIANS"
    tan = N.new("ShaderNodeMath"); tan.operation = "TANGENT"
    mul = N.new("ShaderNodeMath"); mul.operation = "MULTIPLY"
    neg = N.new("ShaderNodeMath"); neg.operation = "MULTIPLY"; neg.inputs[1].default_value = -1.0
    comb = N.new("ShaderNodeCombineXYZ")
    L.new(gi.outputs["Geometry"], sp.inputs["Geometry"]); L.new(sp.outputs["Geometry"], go.inputs["Geometry"])
    L.new(pos.outputs[0], sep.inputs[0]); L.new(gi.outputs["Skew"], rad.inputs[0]); L.new(rad.outputs[0], tan.inputs[0])
    L.new(sep.outputs["Y"], mul.inputs[0]); L.new(tan.outputs[0], mul.inputs[1]); L.new(mul.outputs[0], neg.inputs[0])
    L.new(neg.outputs[0], comb.inputs["X"]); L.new(comb.outputs[0], sp.inputs["Offset"])
    return ng


def _skew_path(obj):
    md = obj.modifiers.get("MDNA Skew")
    if not md:
        md = obj.modifiers.new("MDNA Skew", "NODES"); md.node_group = _skew_group()
    sid = next(i.identifier for i in md.node_group.interface.items_tree if getattr(i, "name", "") == "Skew")
    return f'modifiers["MDNA Skew"]["{sid}"]'


# --- text split (Chars Rise, Words Fade Up, Typewriter) ------------------------------------------------------------------
def _split_text(obj, unit):
    """One text object per character (unit 'chars') or word ('words'), placed by Blender's own layout (Geometry Nodes
    String to Curves), parented to the original text, which is hidden from renders and shown as its bounds (select it
    to re-apply or remove). Returns the pieces in reading order."""
    if obj.get("mdna_split") == unit:
        pieces = sorted((c for c in obj.children if c.get("mdna_piece") is not None), key=lambda c: c["mdna_piece"])
        if pieces:
            return pieces
    _unsplit(obj)
    cu = obj.data
    font = cu.font or bpy.data.fonts.load("<builtin>")
    ng = bpy.data.node_groups.new("mdna_layout", "GeometryNodeTree")
    ng.interface.new_socket("Geometry", in_out="INPUT", socket_type="NodeSocketGeometry")
    ng.interface.new_socket("Geometry", in_out="OUTPUT", socket_type="NodeSocketGeometry")
    s2c = ng.nodes.new("GeometryNodeStringToCurves")
    s2c.inputs["String"].default_value = cu.body; s2c.inputs["Size"].default_value = cu.size
    s2c.inputs["Character Spacing"].default_value = cu.space_character
    s2c.inputs["Word Spacing"].default_value = cu.space_word
    s2c.inputs["Line Spacing"].default_value = cu.space_line
    s2c.font = font
    s2c.align_x = cu.align_x if cu.align_x in ("LEFT", "CENTER", "RIGHT", "JUSTIFY", "FLUSH") else "LEFT"
    s2c.align_y = {"CENTER": "MIDDLE"}.get(cu.align_y, cu.align_y)
    go = ng.nodes.new("NodeGroupOutput"); ng.links.new(s2c.outputs["Curve Instances"], go.inputs[0])
    tmp = bpy.data.objects.new("mdna_tmp_layout", bpy.data.meshes.new("mdna_tmp"))
    bpy.context.scene.collection.objects.link(tmp)
    tmp.matrix_world = obj.matrix_world @ Matrix.Translation((cu.offset_x, cu.offset_y, 0))
    tmp.modifiers.new("l", "NODES").node_group = ng
    bpy.context.view_layer.update()
    gs = tmp.evaluated_get(bpy.context.evaluated_depsgraph_get()).evaluated_geometry()
    pc, refs = gs.instances_pointcloud(), gs.instance_references()
    mats = []
    if pc is not None:
        ref_idx = [d.value for d in pc.attributes[".reference_index"].data]
        tr = [Matrix([list(r) for r in d.value]) for d in pc.attributes["instance_transform"].data]
        mats = [tmp.matrix_world @ t for t, ri in zip(tr, ref_idx) if refs[ri] is not None]
    me = tmp.data
    bpy.data.objects.remove(tmp); bpy.data.meshes.remove(me); bpy.data.node_groups.remove(ng)
    chars = [ch for ch in cu.body if not ch.isspace()]
    if len(mats) != len(chars):
        raise RuntimeError(f"{obj.name}: layout gave {len(mats)} glyphs for {len(chars)} characters")
    units, ci, cur = [], 0, None   # (text, matrix) per piece
    for ch in cu.body:
        if ch.isspace():
            cur = None; continue
        if unit == "chars" or cur is None:
            cur = [ch, mats[ci]]; units.append(cur)
        else:
            cur[0] += ch
        ci += 1
    pieces = []
    for i, (body, mw) in enumerate(units):
        d = cu.copy(); d.body = body; d.align_x = "LEFT"; d.align_y = "TOP_BASELINE"; d.offset_x = d.offset_y = 0
        o = bpy.data.objects.new(f"{obj.name}.{unit[0]}{i:02d}", d)
        for col in obj.users_collection:
            col.objects.link(o)
        o.parent = obj; o.matrix_parent_inverse = obj.matrix_world.inverted(); o.matrix_world = mw
        o["mdna_piece"] = i
        pieces.append(o)
    obj["mdna_split"] = unit
    obj.hide_render = True; obj["mdna_display"] = obj.display_type; obj.display_type = "BOUNDS"
    return pieces


def _unsplit(obj):
    for c in [c for c in obj.children if c.get("mdna_piece") is not None]:
        d = c.data; bpy.data.objects.remove(c)
        if d and d.users == 0:
            bpy.data.curves.remove(d)
    if "mdna_split" in obj:
        del obj["mdna_split"]
        obj.hide_render = False; obj.display_type = obj.get("mdna_display", "TEXTURED")


# --- counter: Geometry Nodes, the value keyed with the token curve, thousands separators built from string nodes ---------
def _counter_group(name, font, size, align_x):
    ng = bpy.data.node_groups.new(name, "GeometryNodeTree")
    I = ng.interface
    I.new_socket("Geometry", in_out="INPUT", socket_type="NodeSocketGeometry")
    for nm, st in (("Value", "NodeSocketFloat"), ("Decimals", "NodeSocketInt"), ("Separator", "NodeSocketString"),
                   ("Prefix", "NodeSocketString"), ("Suffix", "NodeSocketString"), ("Material", "NodeSocketMaterial")):
        I.new_socket(nm, in_out="INPUT", socket_type=st)
    I.new_socket("Geometry", in_out="OUTPUT", socket_type="NodeSocketGeometry")
    N, L = ng.nodes, ng.links
    gi = N.new("NodeGroupInput"); go = N.new("NodeGroupOutput")

    def math(op, a, b=None):
        n = N.new("ShaderNodeMath"); n.operation = op
        for i, x in enumerate((a, b)):
            if x is None:
                continue
            if isinstance(x, (int, float)):
                n.inputs[i].default_value = x
            else:
                L.new(x, n.inputs[i])
        return n.outputs[0]

    def to_str(v):
        n = N.new("FunctionNodeValueToString"); L.new(v, n.inputs["Value"]); n.inputs["Decimals"].default_value = 0
        return n.outputs["String"]

    def pad(v, power, length):   # zero-padded to `length` digits: str(v + power) without its leading "1"
        sl = N.new("FunctionNodeSliceString")
        L.new(to_str(math("ADD", v, power)), sl.inputs["String"])
        sl.inputs["Position"].default_value = 1
        if isinstance(length, int):
            sl.inputs["Length"].default_value = length
        else:
            L.new(length, sl.inputs["Length"])
        return sl.outputs[0]

    def join(parts, delim=None):   # multi-input sockets list the last link first: link in reverse
        n = N.new("GeometryNodeStringJoin")
        if delim is not None:
            L.new(delim, n.inputs["Delimiter"])
        for p in reversed(parts):
            L.new(p, n.inputs["Strings"])
        return n.outputs[0]

    def switch(cond, a_false, a_true):
        n = N.new("GeometryNodeSwitch"); n.input_type = "STRING"
        L.new(cond, n.inputs["Switch"]); L.new(a_false, n.inputs["False"]); L.new(a_true, n.inputs["True"])
        return n.outputs[0]

    def cmp(a, b, op="GREATER_EQUAL"):
        n = N.new("FunctionNodeCompare"); n.data_type = "FLOAT"; n.operation = op
        L.new(a, n.inputs[0])
        if isinstance(b, (int, float)):
            n.inputs[1].default_value = b
        else:
            L.new(b, n.inputs[1])
        return n.outputs[0]

    def lit(s):
        n = N.new("FunctionNodeInputString"); n.string = s
        return n.outputs[0]

    v = gi.outputs["Value"]
    dec = gi.outputs["Decimals"]
    scale = math("POWER", 10.0, dec)
    n_int = math("ROUND", math("MULTIPLY", math("ABSOLUTE", v), scale))   # |v| in units of the last decimal, exact
    ip = math("FLOOR", math("DIVIDE", n_int, scale))
    fd = math("SUBTRACT", n_int, math("MULTIPLY", ip, scale))
    frac = switch(cmp(dec, 0.5), lit(""), join([lit("."), pad(fd, scale, dec)]))
    g0 = math("FLOORED_MODULO", ip, 1000.0)
    g1 = math("FLOORED_MODULO", math("FLOOR", math("DIVIDE", ip, 1000.0)), 1000.0)
    g2 = math("FLOOR", math("DIVIDE", ip, 1000000.0))
    sep = gi.outputs["Separator"]
    a = to_str(g0)
    b = join([to_str(g1), pad(g0, 1000.0, 3)], sep)
    c = join([to_str(g2), pad(g1, 1000.0, 3), pad(g0, 1000.0, 3)], sep)
    ints = switch(cmp(ip, 1000000.0), switch(cmp(ip, 1000.0), a, b), c)
    sign = switch(cmp(v, 0.0, "LESS_THAN"), lit(""), lit("-"))
    text = join([gi.outputs["Prefix"], sign, ints, frac, gi.outputs["Suffix"]])
    s2c = N.new("GeometryNodeStringToCurves"); s2c.font = font; s2c.inputs["Size"].default_value = size
    s2c.align_x = align_x if align_x in ("LEFT", "CENTER", "RIGHT") else "CENTER"; s2c.align_y = "MIDDLE"
    L.new(text, s2c.inputs["String"])
    fill = N.new("GeometryNodeFillCurve")
    sm = N.new("GeometryNodeSetMaterial")
    L.new(s2c.outputs["Curve Instances"], fill.inputs["Curve"]); L.new(fill.outputs[0], sm.inputs["Geometry"])
    L.new(gi.outputs["Material"], sm.inputs["Material"]); L.new(sm.outputs[0], go.inputs["Geometry"])
    return ng


def _emit_material(name, rgb):
    m = bpy.data.materials.get(name)
    if m:
        return m
    m = bpy.data.materials.new(name); m.use_nodes = True
    nt = m.node_tree; nt.nodes.clear()
    out = nt.nodes.new("ShaderNodeOutputMaterial"); em = nt.nodes.new("ShaderNodeEmission")
    em.inputs["Color"].default_value = (*rgb, 1); nt.links.new(em.outputs[0], out.inputs["Surface"])
    return m


def _counter(obj, f0, f1, prm, bz):
    sc = bpy.context.scene
    created = obj is None
    if created:
        obj = bpy.data.objects.new("MDNA Counter", bpy.data.meshes.new("MDNA Counter"))
        sc.collection.objects.link(obj)
        obj.location = sc.cursor.location
        obj.rotation_euler = sc.camera.matrix_world.to_euler() if sc.camera else (math.pi / 2, 0, 0)
        font, size, align, mat = bpy.data.fonts.load("<builtin>"), prm.get("size", 1.0), "CENTER", None
    else:
        cu = obj.data if obj.type == "FONT" else None
        font = (cu.font if cu else None) or bpy.data.fonts.load("<builtin>")
        size, align = (cu.size, cu.align_x) if cu else (prm.get("size", 1.0), "CENTER")
        mat = obj.material_slots[0].material if obj.material_slots else None
    if mat is None:
        mat = _emit_material("MDNA Counter", _srgb_to_linear(KIT_BY_ID["bars_transition"]["params"]["colors"][0]))
        if not obj.material_slots and obj.type in ("MESH", "FONT"):
            obj.data.materials.append(mat)
    md = obj.modifiers.get("MDNA Counter")
    if not md:
        md = obj.modifiers.new("MDNA Counter", "NODES")
        md.node_group = _counter_group(f"MDNA Counter {obj.name}", font, size, align)
    ids = {i.name: i.identifier for i in md.node_group.interface.items_tree if getattr(i, "in_out", "") == "INPUT"}
    md[ids["Decimals"]] = int(prm["decimals"]); md[ids["Separator"]] = prm["separator"]
    md[ids["Prefix"]] = prm["prefix"]; md[ids["Suffix"]] = prm["suffix"]; md[ids["Material"]] = mat
    path = f'modifiers["MDNA Counter"]["{ids["Value"]}"]'
    _keyp(obj, path, None, f0, float(prm["from"]), f1, float(prm["to"]), bz)
    obj["mdna_counter_path"] = path
    return obj


# --- bars transition: planes parented to the camera, over everything -----------------------------------------------------
def _bars(start, prm, k, bz_in, bz_out):
    sc = bpy.context.scene
    cam = sc.camera
    if not cam:
        raise RuntimeError("Bars Transition needs a scene camera")
    c = cam.data
    # just in front of the nearest object (not at the near clip): with depth of field on (Blur In), the bars sit next to
    # the focus plane and stay sharp
    cm = cam.matrix_world; fwd = -(cm.to_3x3() @ Vector((0, 0, 1))).normalized()
    near = []
    for o in sc.objects:
        if o.type not in ("MESH", "CURVE", "FONT", "SURFACE", "META") or o.name.startswith("MDNA Bar") or o.hide_render:
            continue
        tw = (o.parent.matrix_world @ o.matrix_parent_inverse).to_3x3() if o.parent else Matrix.Identity(3)
        off = tw @ o.delta_location if "mdna_blur" in o else Vector()   # rest depth, not mid-blur
        near += [(o.matrix_world @ Vector(b) - off - cm.translation).dot(fwd) for b in o.bound_box]
    near = [d for d in near if d > c.clip_start]
    z = max(c.clip_start * 2.0, c.clip_start + 0.01, (min(near) * 0.995) if near else 0)
    W, H = _frame_size(sc, cam, z)
    big = max(W, H); cx, cy = c.shift_x * big, c.shift_y * big
    W, H = W * 1.02, H * 1.02
    n = int(prm["count"]); direction = prm["direction"]; stg = prm["stagger_frames"] * k
    cover, uncover = prm["cover_frames"] * k, prm["uncover_frames"] * k
    horizontal = direction in ("left_to_right", "right_to_left")
    sign = 1 if direction in ("left_to_right", "bottom_to_top") else -1
    root = bpy.data.objects.new("MDNA Bars", None); sc.collection.objects.link(root)
    root.parent = cam; root.location = (cx, cy, -z); root.empty_display_size = 0.1
    cols = [_srgb_to_linear(h) for h in prm["colors"]]
    cut = start + (n - 1) * stg + cover
    bars = []
    for i in range(n):
        me = bpy.data.meshes.new(f"MDNA Bar {i}")
        L = 0.5 * sign
        verts = [(-0.5 + L, -0.5, 0), (0.5 + L, -0.5, 0), (0.5 + L, 0.5, 0), (-0.5 + L, 0.5, 0)] if horizontal else \
            [(-0.5, -0.5 + L, 0), (0.5, -0.5 + L, 0), (0.5, 0.5 + L, 0), (-0.5, 0.5 + L, 0)]
        me.from_pydata(verts, [], [(0, 1, 2, 3)])
        me.materials.append(_emit_material(f"MDNA Bar {prm['colors'][i % len(cols)]}", cols[i % len(cols)]))
        o = bpy.data.objects.new(f"MDNA Bar {i}", me); sc.collection.objects.link(o); o.parent = root
        o.visible_shadow = False
        ax = 0 if horizontal else 1
        span, thick = (W, H / n) if horizontal else (H, W / n)
        edge0 = -sign * span / 2
        if horizontal:   # stacked top to bottom
            o.location = (edge0, H / 2 - thick * (i + 0.5), 0); o.scale = (1e-4, thick * 1.02, 1)
        else:            # side by side, left to right
            o.location = (-W / 2 + thick * (i + 0.5), edge0, 0); o.scale = (thick * 1.02, 1e-4, 1)
        s = start + i * stg
        _key(o, "scale", ax, s, 1e-4, s + cover, span, bz_in)                       # cover: grows from its edge
        u = cut + i * stg
        _key(o, "location", ax, u, edge0, u + uncover, -edge0, bz_out)               # uncover: the edge leaves...
        _key(o, "scale", ax, u, span, u + uncover, 1e-4, bz_out)                     # ...the far edge stays
        bars.append(o)
    root["mdna_cut_frame"] = cut
    return root, bars, cut, cut + (n - 1) * stg + uncover


# --- kit() --------------------------------------------------------------------------------------------------------------
def kit(id, objects=None, phase=None, start=0, duration=1.0, intensity=1.0, stagger=3, ease=None, params=None, px=1 / 180):
    """Applies kit piece `id` (see kit_list()) to objects (objects or names; default: the selection) from frame `start`,
    `stagger` frames between objects. phase: one of the piece's phases (in / out / emphasis / loop / transition; None =
    its first). duration x scales every frame count, intensity x the amounts (blur, distance, angle, scale, amplitude).
    ease: a token that replaces the piece's curve. params: overrides of the piece's params (e.g. {"to": 980}).
    Returns {"end": last keyed frame, "objects": the objects animated or created}."""
    it = KIT_BY_ID.get(id) or next((x for x in KIT["items"] if x["name"].lower() == str(id).lower()), None)
    if not it:
        raise KeyError(f"kit piece not found: {id}")
    id = it["id"]
    phase = phase or it["phase"][0]
    if phase not in it["phase"]:
        raise ValueError(f"{it['name']} supports {', '.join(it['phase'])}, not {phase}")
    prm = dict(it["params"]); prm.update(params or {})
    sc = bpy.context.scene
    bpy.context.view_layer.update()   # matrices and dimensions of objects made by a script are stale until then
    k = sc.render.fps / sc.render.fps_base / 30 * duration   # catalog frames are at 30 fps
    if objects is None:
        objects = sorted(bpy.context.selected_objects, key=lambda o: o.name)
    objs = [bpy.data.objects[o] if isinstance(o, str) else o for o in objects]
    # pieces of a split text stand for their text
    seen, uniq = set(), []
    for o in objs:
        if o.get("mdna_piece") is not None and o.parent:
            o = o.parent
        if o.name not in seen:
            seen.add(o.name); uniq.append(o)
    objs = uniq
    bz = _ease(prm.get("ease"), ease)
    end, out = start, []

    if id == "counter":
        targets = [o for o in objs if o.type == "FONT" or o.modifiers.get("MDNA Counter")] or [None]
        for i, o in enumerate(targets):
            s = start + i * stagger
            out.append(_counter(o, s, s + prm["frames"] * k, prm, bz)); end = max(end, s + prm["frames"] * k)
        return {"end": end, "objects": out}
    if id == "bars_transition":
        root, bars, cut, end = _bars(start, prm, k, _ease(prm["ease_in"], ease), _ease(prm["ease_out"], ease))
        print(f"[mdna] Bars Transition: frame covered at {cut:g} (cut your scenes there)")
        return {"end": end, "objects": [root] + bars, "cut": cut}
    if not objs:
        raise ValueError(f"{it['name']}: select objects first")

    for i, ob in enumerate(objs):
        s = start + i * stagger
        F = prm.get("frames", 0) * k
        rest_loc, rest_scale, rest_rot = ob.location.copy(), ob.scale.copy(), ob.rotation_euler.copy()
        if id == "blur_in":
            fade = prm["fade_frames"] * k; b = prm["blur_px"] * intensity
            if phase == "in":
                _blur(ob, s, s + F, b, 0.0, bz); _fade(ob, s, s + fade, 0.0, 1.0, bz)
            else:
                _blur(ob, s, s + F, 0.0, b, bz); _fade(ob, s + F - fade, s + F, 1.0, 0.0, bz)
            e = s + F
        elif id == "slam_in":
            _appear(ob, s)
            _blur(ob, s, s + F, prm["blur_px"] * intensity, 0.0, bz)
            sf = 1 + (prm["scale_from"] - 1) * intensity
            for idx in (0, 1):
                _key(ob, "scale", idx, s, rest_scale[idx] * sf, s + F, rest_scale[idx], bz)
            _key(ob, "rotation_euler", 1, s, rest_rot[1] + math.radians(prm["rotation_from"] * intensity), s + F, rest_rot[1], bz)
            e = s + F
        elif id in ("wipe_reveal", "iris_reveal"):
            _ensure_material(ob)
            if id == "wipe_reveal":
                axis = {"left_to_right": (1, 0, 0), "right_to_left": (-1, 0, 0), "top_to_bottom": (0, -1, 0),
                        "bottom_to_top": (0, 1, 0)}[prm["direction"]]
                ob["mdna_wipe_axis"] = axis
                width = ob.dimensions.x if axis[0] else ob.dimensions.y
                ob["mdna_wipe_feather"] = (prm["feather_px"] * px / width) if width else 0.0
                _with_masks(ob, _wipe_mask)
                if phase == "in":
                    ob["mdna_wipe_out"] = 0.0
                    _keyp(ob, '["mdna_wipe_in"]', None, s, 1.0, s + F, 0.0, bz)
                else:
                    ob["mdna_wipe_in"] = ob.get("mdna_wipe_in", 0.0)
                    _keyp(ob, '["mdna_wipe_out"]', None, s, 0.0, s + F, 1.0, bz)
            else:
                d = ob.dimensions
                ob["mdna_iris_aspect"] = (d.x / d.y) if d.y else 1.0
                ob["mdna_iris_feather"] = 0.01
                _with_masks(ob, _iris_mask)
                a, b = (1.0, 0.0) if phase == "in" else (0.0, 1.0)
                _keyp(ob, '["mdna_iris"]', None, s, a, s + F, b, bz)
            e = s + F
        elif id == "jello":
            path = _skew_path(ob)
            vals = [0.0] + [v * intensity for v in prm["skew_deg"]]
            seg = F / (len(vals) - 1)
            _keys_stops(ob, path, None, s, vals, seg, bz)
            e = s + F
        elif id == "light_speed_in":
            _fade(ob, s, s + 0.6 * F, 0.0, 1.0, bz)
            _key(ob, "location", 0, s, rest_loc[0] + prm["from_x_px"] * px * intensity, s + F, rest_loc[0], bz)
            _keyp(ob, _skew_path(ob), None, s, prm["skew_from_deg"] * intensity, s + F, 0.0, bz)
            e = s + F
        elif id == "line_draw":
            if ob.type != "CURVE":
                print(f"[mdna] Line Draw: {ob.name} is not a curve, skipped"); continue
            cu = ob.data
            if cu.bevel_depth == 0 and cu.extrude == 0 and not cu.bevel_object and cu.bevel_mode != "PROFILE":
                cu.bevel_depth = 0.02; print(f"[mdna] Line Draw: {ob.name} had no stroke, bevel depth set to 0.02")
            cu.bevel_factor_mapping_start = cu.bevel_factor_mapping_end = "SPLINE"
            if phase == "in":
                _keyp(cu, "bevel_factor_end", None, s, 0.0, s + F, 1.0, bz)
            else:
                _keyp(cu, "bevel_factor_start", None, s, 0.0, s + F, 1.0, bz)
            e = s + F
        elif id in ("chars_rise", "words_fade_up", "typewriter"):
            if ob.type != "FONT":
                print(f"[mdna] {it['name']}: {ob.name} is not a text object, skipped"); continue
            pieces = _split_text(ob, "words" if id == "words_fade_up" else "chars")
            e = s
            if id == "typewriter":
                step = sc.render.fps / sc.render.fps_base / prm["chars_per_second"] * duration
                for j, p in enumerate(pieces):
                    f = s + j * step
                    for path in ("hide_render", "hide_viewport"):
                        _key_const(p, path, None, [(min(s, f) - 1, True), (f, False)])
                    e = f
            else:
                rise = prm["rise_px"] * px * intensity; st = prm["stagger_frames"] * k
                for j, p in enumerate(pieces):
                    f = s + j * st
                    z = p.location[2]
                    if phase == "in":
                        _key(p, "location", 2, f, z - rise, f + F, z, bz); _fade(p, f, f + F, 0.0, 1.0, bz)
                    else:
                        _key(p, "location", 2, f, z, f + F, z + rise, bz); _fade(p, f, f + F, 1.0, 0.0, bz)
                    e = f + F
            out.extend(pieces)
        elif id == "float":
            T = prm["period_frames"] * duration * sc.render.fps / sc.render.fps_base / 30
            a = prm["amp_px"] * px * intensity
            _clear_fc(ob, "delta_location", 2)
            fc = _keyp(ob, "delta_location", 2, s, 0.0, s + T / 2, a, bz)
            _keyp(ob, "delta_location", 2, s + T / 2, a, s + T, 0.0, bz)
            fc.modifiers.new("CYCLES")
            e = s + T
        elif id == "pulse":
            T = prm["period_frames"] * duration * sc.render.fps / sc.render.fps_base / 30
            amp = 1 + (prm["scale"] - 1) * intensity
            for idx in (0, 1):
                _clear_fc(ob, "delta_scale", idx)
                fc = _keyp(ob, "delta_scale", idx, s, 1.0, s + T / 2, amp, bz)
                _keyp(ob, "delta_scale", idx, s + T / 2, amp, s + T, 1.0, bz)
                fc.modifiers.new("CYCLES")
            e = s + T
        elif id == "wiggle":
            _clear_fc(ob, "delta_rotation_euler", 1)
            ob.delta_rotation_euler[1] = 0.0
            ob.keyframe_insert("delta_rotation_euler", index=1, frame=s)
            fc = _find_fc(ob, "delta_rotation_euler", 1)
            m = fc.modifiers.new("NOISE")
            m.scale = sc.render.fps / sc.render.fps_base / prm["frequency_hz"] * duration
            # REPLACE mode is centred: value + (noise - 0.5) * strength; Blender's turbulence rarely leaves 0.5 +- 0.36,
            # so strength = 2.8 x amplitude peaks near +-amplitude, like AE's wiggle(freq, amp)
            m.strength = 2.8 * math.radians(prm["rotation_deg"] * intensity)
            m.phase = 1 + 7 * (zlib.crc32(ob.name.encode()) % 97) / 97; m.blend_type = "REPLACE"
            e = s + m.scale
        ob["mdna_kit"] = f"{it['name']} ({phase})"
        out.append(ob)
        end = max(end, e)
    return {"end": end, "objects": out}


def _cli(argv):
    import argparse
    ap = argparse.ArgumentParser(prog="mdna_blender")
    sub = ap.add_subparsers(dest="cmd", required=True)
    sub.add_parser("list")
    a = sub.add_parser("apply")
    a.add_argument("preset"); a.add_argument("--objects", default=""); a.add_argument("--phase", default="in")
    a.add_argument("--start", type=float, default=0); a.add_argument("--stagger", type=float, default=4)
    a.add_argument("--save", default="")
    kp = sub.add_parser("kit")
    kp.add_argument("piece"); kp.add_argument("--objects", default=""); kp.add_argument("--phase", default=None)
    kp.add_argument("--start", type=float, default=0); kp.add_argument("--stagger", type=float, default=3)
    kp.add_argument("--save", default="")
    sub.add_parser("kit-list")
    o = ap.parse_args(argv)
    if o.cmd == "list":
        print("\n".join(portable())); return
    if o.cmd == "kit-list":
        print("\n".join(f"{it['id']} ({it['type']}): {it['use']}" for it in kit_list())); return
    if o.cmd == "kit":
        objs = [bpy.data.objects[n] for n in o.objects.split(",") if n] or None
        print(kit(o.piece, objs, o.phase, o.start, stagger=o.stagger))
        if o.save:
            bpy.ops.wm.save_as_mainfile(filepath=o.save)
        return
    objs = [bpy.data.objects[n] for n in o.objects.split(",") if n] or list(bpy.context.selected_objects)
    for i, ob in enumerate(objs):
        print(ob.name, "→", apply(ob, o.preset, o.phase, o.start + i * o.stagger))
    if o.save:
        bpy.ops.wm.save_as_mainfile(filepath=o.save)


if __name__ == "__main__" and "--" in sys.argv:
    _cli(sys.argv[sys.argv.index("--") + 1:])
