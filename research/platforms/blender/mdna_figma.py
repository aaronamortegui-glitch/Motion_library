"""Motion DNA · Figma bridge for Blender: rebuilds a Figma frame from its manifest (research/platforms/figma) facing a
front orthographic camera at the same place and size: text stays live text, rectangles and ellipses are flat meshes with
an emission colour, photos are image planes. Layers keep their Figma names and get the custom properties mdna_role /
mdna_order, so a style can animate them by role.

Inside Blender:  import mdna_figma as F; built = F.build("<project>/figma/<frame folder>"); F.animate(built)
Headless:        blender -b -P mdna_figma.py -- <frame folder> [--animate] [--save out.blend]

Units: 1 px = 1/180 Blender unit (a 1920×1080 frame is 10.67 × 6, the same scale mdna_blender's presets use).
Inter Tight's outlines overlap and Blender fills them with holes: fix_fonts.py makes merged copies in blender/fonts/
(install.py runs it); without them Inter Tight falls back to Blender's built-in font.
"""
import json
import math
import pathlib
import sys

import bpy

HERE = pathlib.Path(__file__).resolve().parent
if str(HERE) not in sys.path:
    sys.path.insert(0, str(HERE))
import mdna_blender as M   # noqa: E402

PX = 1 / 180
# After Effects (8/16 bpc, no linear workspace) blends, fades and blurs in sRGB numbers; Blender does it in linear light,
# so a 22 % fade looks ~50 % opaque and blurs glow. DISPLAY_SPACE renders like AE: the view transform is Raw (no curve),
# colours are given as their sRGB numbers and images are read as Non-Color, so every mix happens on display values.
DISPLAY_SPACE = True
STACK = 0.0002   # depth step between layers: enough for draw order, ~0.001 px of depth-of-field blur at rest
FONT_FILES = {"Instrument Serif|Italic": "InstrumentSerif-Italic.ttf", "Instrument Serif|Regular": "InstrumentSerif-Regular.ttf"}
BROKEN_FONTS = {"Inter Tight", "Inter"}   # overlapping contours: holes in Blender (see the module docstring)


def _em_factor(path):
    """Blender sizes a font by its full bounding box (head.yMax - head.yMin), Figma by its em: the factor that turns a
    Figma px size into a Blender size. Read straight from the .ttf/.otf 'head' table (no fontTools in Blender)."""
    import struct
    try:
        with open(path, "rb") as f:
            data = f.read()
        n = struct.unpack(">H", data[4:6])[0]
        for i in range(n):
            tag, _, off, _ = struct.unpack(">4sIII", data[12 + 16 * i: 28 + 16 * i])
            if tag == b"head":
                upm = struct.unpack(">H", data[off + 18: off + 20])[0]
                ymin, ymax = struct.unpack(">hh", data[off + 38: off + 40] + data[off + 42: off + 44])
                return (ymax - ymin) / upm
    except Exception:
        pass
    return None


_BUILTIN = {}


def _builtin_factor():
    """Blender's built-in font (Inter, .woff2): measure a capital H at size 1; Inter's cap height is 0.727 em."""
    if "f" not in _BUILTIN:
        cu = bpy.data.curves.new("_mdna_probe", "FONT"); cu.body = "H"; ob = bpy.data.objects.new("_mdna_probe", cu)
        bpy.context.scene.collection.objects.link(ob); bpy.context.view_layer.update()
        zs = [v[1] for v in ob.bound_box]
        _BUILTIN["f"] = 0.727 / max(max(zs) - min(zs), 1e-6)
        bpy.data.objects.remove(ob); bpy.data.curves.remove(cu)
    return _BUILTIN["f"]


def _lin(hexstr):
    """A Figma hex colour as the render's working values: sRGB numbers as they are in display space (DISPLAY_SPACE),
    else linear."""
    h = hexstr.lstrip("#")[:6]
    c = [int(h[i:i + 2], 16) / 255 for i in (0, 2, 4)]
    if DISPLAY_SPACE:
        return tuple(c)
    return tuple(x / 12.92 if x <= 0.04045 else ((x + 0.055) / 1.055) ** 2.4 for x in c)


def _emission(name, hexstr, alpha=1.0, image=None):
    m = bpy.data.materials.new(name); m.use_nodes = True
    nt = m.node_tree; nt.nodes.clear()
    out = nt.nodes.new("ShaderNodeOutputMaterial"); em = nt.nodes.new("ShaderNodeEmission")
    mix = nt.nodes.new("ShaderNodeMixShader"); tr = nt.nodes.new("ShaderNodeBsdfTransparent")
    if image:
        tex = nt.nodes.new("ShaderNodeTexImage"); tex.image = bpy.data.images.load(str(image), check_existing=True)
        if DISPLAY_SPACE:
            tex.image.colorspace_settings.name = "Non-Color"
        nt.links.new(tex.outputs["Color"], em.inputs["Color"]); nt.links.new(tex.outputs["Alpha"], mix.inputs[0])
    else:
        em.inputs["Color"].default_value = (*_lin(hexstr), 1); mix.inputs[0].default_value = alpha
    nt.links.new(tr.outputs[0], mix.inputs[1]); nt.links.new(em.outputs[0], mix.inputs[2]); nt.links.new(mix.outputs[0], out.inputs[0])
    if hasattr(m, "surface_render_method"):
        m.surface_render_method = "BLENDED"
    return m


def _camera(W, H):
    sc = bpy.context.scene
    sc.render.resolution_x, sc.render.resolution_y = W, H
    cam = sc.camera
    if not cam:
        cam = bpy.data.objects.new("Motion DNA camera", bpy.data.cameras.new("Motion DNA camera"))
        sc.collection.objects.link(cam); sc.camera = cam
    cam.data.type = "ORTHO"; cam.data.ortho_scale = max(W, H) * PX
    cam.location = (0, -20, 0); cam.rotation_euler = (math.pi / 2, 0, 0)
    sc.view_settings.view_transform = "Raw" if DISPLAY_SPACE else "Standard"   # Figma's hex colours, not AgX's
    return cam


def _svg(path, L, col):
    """A Figma vector: Blender's SVG importer makes curves on the XY plane; join them, stand them up facing the camera,
    centre the origin and scale to the Figma box."""
    import mathutils
    before = set(bpy.data.objects)
    bpy.ops.import_curve.svg(filepath=str(path))
    new = [o for o in bpy.data.objects if o not in before and o.type == "CURVE"]
    if not new:
        return None
    bpy.ops.object.select_all(action="DESELECT")
    for o in new:
        o.select_set(True)
    bpy.context.view_layer.objects.active = new[0]
    if len(new) > 1:
        bpy.ops.object.join()
    ob = bpy.context.view_layer.objects.active
    for c in list(ob.users_collection):
        c.objects.unlink(ob)
    col.objects.link(ob)
    bpy.ops.object.origin_set(type="ORIGIN_GEOMETRY", center="BOUNDS")
    xs = [v[0] for v in ob.bound_box]; ys = [v[1] for v in ob.bound_box]
    w, h = max(xs) - min(xs), max(ys) - min(ys)
    k = min(L["box"][2] * PX / max(w, 1e-9), L["box"][3] * PX / max(h, 1e-9))
    ob.scale = (k, k, k); ob.rotation_euler = (math.pi / 2, 0, 0)
    for slot in ob.material_slots:   # the importer's materials need light: the same flat emission as the other layers
        if slot.material:
            c = slot.material.diffuse_color
            hexstr = "#" + "".join("%02x" % round(255 * (x * 12.92 if x <= 0.0031308 else 1.055 * x ** (1 / 2.4) - 0.055)) for x in c[:3])
            slot.material = _emission(L["name"], hexstr, c[3])
    return ob


def build(folder, collection_name=None):
    folder = pathlib.Path(folder)
    m = json.loads((folder / "manifest.json").read_text(encoding="utf-8"))
    W, H = m["w"], m["h"]
    sc = bpy.context.scene
    _camera(W, H)
    if not sc.world:
        sc.world = bpy.data.worlds.new("Motion DNA background")
    sc.world.use_nodes = True
    bg = sc.world.node_tree.nodes.get("Background")
    if bg:
        bg.inputs[0].default_value = (*_lin(m["bg"]), 1)
    col = bpy.data.collections.new(collection_name or ("Figma · " + m["source"]["name"]))
    sc.collection.children.link(col)
    fonts_dir = M.ROOT / "assets/fonts"
    built, depth = [], 0
    for L in m["layers"]:
        if L["kind"] == "group":
            continue
        x, y, w, h = L["box"]
        cx, cz = (x + w / 2 - W / 2) * PX, (H / 2 - (y + h / 2)) * PX
        depth += 1
        cy = -depth * STACK   # later Figma layers sit closer to the camera (on top)
        ob = None
        if L["kind"] in ("rect", "ellipse", "image"):
            if L["kind"] == "ellipse":
                bpy.ops.mesh.primitive_circle_add(vertices=96, radius=0.5, fill_type="NGON")
            else:
                bpy.ops.mesh.primitive_plane_add(size=1)
            ob = bpy.context.object
            ob.rotation_euler = (math.pi / 2, 0, 0); ob.scale = (w * PX, h * PX, 1)
            if L["kind"] == "image" and L.get("file"):
                ob.data.materials.append(_emission(L["name"], "#ffffff", image=folder / L["file"]))
            elif L.get("fill"):
                ob.data.materials.append(_emission(L["name"], L["fill"]["c"], L["fill"].get("o", 1)))
            if L.get("radius") and L["kind"] == "rect":
                bev = ob.modifiers.new("Corner radius", "BEVEL"); bev.affect = "VERTICES"; bev.segments = 8
                bev.width = min(L["radius"] * PX, w * PX / 2, h * PX / 2) / max(w * PX, h * PX, 1e-6)   # in the unscaled plane's units
            for c in list(ob.users_collection):
                c.objects.unlink(ob)
            col.objects.link(ob)
        elif L["kind"] == "text":
            t = L["text"]
            cu = bpy.data.curves.new(L["name"], "FONT"); cu.body = t["string"]
            fn = FONT_FILES.get(t["family"] + "|" + t["style"]) or (t["family"].replace(" ", "") + "-" + t["style"].replace(" ", "") + ".ttf")
            safe = HERE / "fonts" / fn   # fix_fonts.py: overlaps merged, Blender fills them cleanly
            path = safe if safe.exists() else (fonts_dir / fn if (fonts_dir / fn).exists() else fonts_dir / "static" / fn)
            factor = None
            if path.exists() and (safe.exists() or t["family"] not in BROKEN_FONTS):
                cu.font = bpy.data.fonts.load(str(path), check_existing=True)
                factor = _em_factor(path)
            cu.size = t["size"] * PX * (factor or _builtin_factor())   # Figma's em size in Blender's bounding-box size
            cu.space_character = 1 + (t.get("tracking") or 0) / max(t["size"], 1)
            cu.align_x = {"left": "LEFT", "center": "CENTER", "right": "RIGHT"}.get(t["align"], "LEFT")
            ob = bpy.data.objects.new(L["name"], cu); col.objects.link(ob)
            ob.rotation_euler = (math.pi / 2, 0, 0)
            cu.materials.append(_emission(L["name"], t["color"]))
            ob.location = (0, cy, 0); bpy.context.view_layer.update()
            if t.get("tracking") and len(t["string"]) > 1:   # Figma tracking is px per letter; fit Blender's factor to the width
                import mathutils as _mu
                def _gw():
                    bpy.context.view_layer.update()
                    xs = [(ob.matrix_world @ _mu.Vector(c)).x for c in ob.bound_box]
                    return max(xs) - min(xs)
                target = (w - t["tracking"]) * PX   # Figma's box keeps the trailing letter space
                s0 = cu.space_character; g0 = _gw(); cu.space_character = s0 + 0.2; g1 = _gw()
                if abs(g1 - g0) > 1e-6:
                    cu.space_character = max(0.0, s0 + 0.2 * (target - g0) / (g1 - g0))
            # match Figma's box: left (or centre/right) edge on its x, glyphs centred on its box
            pts = [ob.matrix_world @ __import__("mathutils").Vector(c) for c in ob.bound_box]
            gx0, gx1 = min(p.x for p in pts), max(p.x for p in pts); gz = (min(p.z for p in pts) + max(p.z for p in pts)) / 2
            ax = {"left": (x - W / 2) * PX, "center": cx, "right": (x + w - W / 2) * PX}.get(t["align"], (x - W / 2) * PX)
            cur = {"left": gx0, "center": (gx0 + gx1) / 2, "right": gx1}.get(t["align"], gx0)
            ob.location = (ax - cur, cy, cz - gz)
            ob["mdna_role"] = L["role"]; ob["mdna_order"] = L["order"]; ob["mdna_figma"] = L["id"]
            built.append({"name": L["name"], "object": ob, "role": L["role"], "order": L["order"]})
            continue
        elif L["kind"] == "svg" and L.get("file"):
            ob = _svg(folder / L["file"], L, col)
            if ob:
                ob.location = (cx, cy, cz)
        if ob is None:
            continue
        ob.name = L["name"]
        if L["kind"] != "svg":
            ob.location = (cx, cy, cz)
        if L.get("rotation"):
            ob.rotation_euler[1] = math.radians(-L["rotation"])
        ob["mdna_role"] = L["role"]; ob["mdna_order"] = L["order"]; ob["mdna_figma"] = L["id"]
        built.append({"name": L["name"], "object": ob, "role": L["role"], "order": L["order"]})
    # a backdrop plane right behind the layers, on the focus plane: with the world as background, EEVEE's depth of field
    # (the blur pieces) bleeds every in-focus edge into the infinitely far world, a soft halo around all layers
    bpy.ops.mesh.primitive_plane_add(size=1)
    bd = bpy.context.object; bd.name = "Backdrop"
    for c in list(bd.users_collection):
        c.objects.unlink(bd)
    col.objects.link(bd)
    bd.rotation_euler = (math.pi / 2, 0, 0); bd.scale = (W * PX * 1.5, H * PX * 1.5, 1); bd.location = (0, STACK, 0)
    bd.data.materials.append(_emission("Backdrop", m["bg"])); bd["mdna_role"] = "backdrop"
    cam = sc.camera.data   # depth of field (blur pieces) focuses on the middle of the stack
    cam.dof.focus_object = None
    cam.dof.focus_distance = (0 - sc.camera.location.y) - depth * STACK / 2; cam["mdna_focus"] = True
    bpy.context.view_layer.update()
    return built


DEFAULT_STYLE = {"background": None, "shape": {"kit": "wipe_reveal"}, "media": {"kit": "blur_in"}, "title": {"kit": "chars_rise"},
                 "subtitle": {"kit": "words_fade_up"}, "body": {"preset": "Fade Up"}, "logo": {"preset": "Scale Pop"}}


def animate(built, style=None, start=0, stagger=4):
    """Animates a built frame by role, like an After Effects style, staggered in reading order."""
    style = style or DEFAULT_STYLE
    done = []
    for i, b in enumerate(sorted(built, key=lambda b: b["order"])):
        s = style.get(b["role"])
        if not s:
            continue
        at = start + i * stagger
        try:
            if "kit" in s:
                M.kit(s["kit"], [b["object"]], "in", at)
            else:
                M.apply(b["object"], s["preset"], "in", at)
            done.append(f"{b['name']} · {b['role']} · {s.get('kit') or s.get('preset')} @{at}")
        except Exception as e:
            done.append(f"{b['name']} · {e}")
    return done


if __name__ == "__main__" and "--" in sys.argv:
    args = sys.argv[sys.argv.index("--") + 1:]
    built = build(args[0])
    print("MDNA_BUILT", [(b["name"], b["role"]) for b in built])
    if "--animate" in args:
        print("MDNA_ANIM", animate(built))
    if "--save" in args:
        bpy.ops.wm.save_as_mainfile(filepath=args[args.index("--save") + 1])
