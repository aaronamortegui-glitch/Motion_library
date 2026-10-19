"""Tests for the Motion DNA kit pieces in Blender (mdna_blender.kit, research/platforms/kit_portable.json).

  pieces: every piece on test objects, in and out where it has them; samples the keyed curves against the CSS
          cubic-bezier of its token (max error, % of the move) and renders key frames to out/kit/<piece>_<frame>.png
  addon:  registers the add-on headless and runs bpy.ops.mdna.apply (Create) once per type, plus Remove
  demo:   a short scene with several pieces (Chars Rise title, Blur In photo, a counter, Float, a bars transition):
          4 frames and out/kit/demo_kit.mp4 (+ demo_kit.blend)
Run: blender -b --factory-startup -P research/platforms/blender/test_kit.py -- [pieces] [addon] [demo]
"""
import math
import pathlib
import subprocess
import sys

import bpy

HERE = pathlib.Path(__file__).resolve().parent
sys.path.insert(0, str(HERE)); sys.path.insert(0, str(HERE / "tests"))
import mdna_blender as M   # noqa: E402
import common as C         # noqa: E402

OUT = HERE / "out" / "kit"; OUT.mkdir(parents=True, exist_ok=True)
ARGS = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else ["pieces", "addon", "demo"]
PHOTO = M.ROOT / "docs/examples/backgrounds.jpg"
REPORT = []
F = lambda: bpy.data.fonts.load("<builtin>", check_existing=True)   # noqa: E731  (fonts die with each new scene)


def css(bz, x):
    x1, y1, x2, y2 = bz
    lo, hi = 0.0, 1.0
    for _ in range(60):
        t = (lo + hi) / 2; bx = 3 * (1 - t) ** 2 * t * x1 + 3 * (1 - t) * t * t * x2 + t ** 3
        lo, hi = (t, hi) if bx < x else (lo, t)
    t = (lo + hi) / 2
    return 3 * (1 - t) ** 2 * t * y1 + 3 * (1 - t) * t * t * y2 + t ** 3


def err(fc, f0, f1, ease, n=40):
    """Max deviation of the F-curve between f0 and f1 from the token's CSS cubic-bezier, in % of the move."""
    bz = M.EASE[ease] if isinstance(ease, str) else ease
    v0, v1 = fc.evaluate(f0), fc.evaluate(f1)
    if abs(v1 - v0) < 1e-12:
        return float("nan")
    return 100 * max(abs((fc.evaluate(f0 + (f1 - f0) * i / n) - v0) / (v1 - v0) - css(bz, i / n)) for i in range(n + 1))


def scene(frames=60):
    sc = C.scene(frames=frames)
    sc.eevee.taa_render_samples = 32
    return sc


def photo(name, w, h, loc):
    bpy.ops.mesh.primitive_plane_add(size=1); o = bpy.context.object; o.name = name
    o.rotation_euler = (math.pi / 2, 0, 0); o.location = loc; o.scale = (w, h, 1)
    m = bpy.data.materials.new(name + "_m"); m.use_nodes = True
    nt = m.node_tree; nt.nodes.clear()
    out = nt.nodes.new("ShaderNodeOutputMaterial"); em = nt.nodes.new("ShaderNodeEmission")
    tex = nt.nodes.new("ShaderNodeTexImage"); tex.image = bpy.data.images.load(str(PHOTO), check_existing=True)
    nt.links.new(tex.outputs["Color"], em.inputs["Color"]); nt.links.new(em.outputs[0], out.inputs["Surface"])
    o.data.materials.append(m)
    return o


def render(sc, name, frames):
    files = []
    for f in frames:
        sc.frame_set(f)
        sc.render.filepath = str(OUT / f"{name}_{f:03d}.png")
        bpy.ops.render.render(write_still=True)
        files.append(sc.render.filepath)
    return files


def rec(piece, status, curve, looked, note=""):
    REPORT.append((piece, status, curve, looked, note))
    print(f"KIT {piece}: {status} | curve {curve} | {note}")


def pieces():
    lime, mint, bark = (0.58, 0.89, 0.1), (0.85, 0.92, 0.9), (0.02, 0.16, 0.13)

    # blur_in: a photo plane, a static label 0.2 units deeper (checks the unwanted DOF blur)
    sc = scene(); ph = photo("Photo", 4.8, 2.7, (0, 0, 0.2)); lab = C.text("Static label", 0.4, (0, 0.2, -1.9), mint, F())
    r = M.kit("blur_in", [ph], "in", 0)
    e1 = err(M._find_fc(ph, '["mdna_blur"]'), 0, 14, "Surge"); e2 = err(M._find_fc(ph, "color", 3), 0, 9, "Surge")
    sc.frame_set(7); b = ph["mdna_blur"]; dy = ph.delta_location[1]
    cam = sc.camera.data
    ob2 = C.text("Out", 0.6, (3.5, 0, 2.2), mint, F()); M.kit("blur_in", [ob2], "out", 20)
    e3 = err(M._find_fc(ob2, '["mdna_blur"]'), 20, 34, "Surge")
    render(sc, "blur_in", (2, 5, 9, 14))
    rec("blur_in", "works", f"blur {e1:.3f}% fade {e2:.3f}% out {e3:.3f}%", "2,5,9,14",
        f"f7 blur {b:.1f}px -> depth {dy:.3f}; fstop {cam.dof.aperture_fstop:.3f}; label 0.2 deeper unblurred")

    # slam_in
    sc = scene(30); t = C.text("SLAM", 1.6, (0, 0, 0), lime, F())
    M.kit("slam_in", [t], "in", 2)
    es = err(M._fcurve(t, "scale", 0), 2, 11, "Whip"); er = err(M._fcurve(t, "rotation_euler", 1), 2, 11, "Whip")
    eb = err(M._find_fc(t, '["mdna_blur"]'), 2, 11, "Whip")
    render(sc, "slam_in", (1, 3, 5, 11))
    rec("slam_in", "works", f"scale {es:.3f}% rot {er:.3f}% blur {eb:.3f}%", "1,3,5,11", "hidden before start (opacity step)")

    # wipe_reveal: a bar and a word, in; a second bar out
    sc = scene(40)
    bar = C.plane("Bar", 6, 0.5, (0, 0, 1.2), lime, 1.0)
    w = C.text("Wipe Reveal", 0.9, (0, 0, 0), mint, F())
    bar2 = C.plane("BarOut", 6, 0.5, (0, 0, -1.4), (0.9, 0.5, 0.3), 1.0)
    M.kit("wipe_reveal", [bar, w], "in", 0, stagger=4)
    M.kit("wipe_reveal", [bar2], "out", 0)
    ew = err(M._find_fc(bar, '["mdna_wipe_in"]'), 0, 14, "Surge"); eo = err(M._find_fc(bar2, '["mdna_wipe_out"]'), 0, 14, "Surge")
    render(sc, "wipe_reveal", (4, 8, 12, 18))
    rec("wipe_reveal", "works", f"in {ew:.3f}% out {eo:.3f}%", "4,8,12,18", "bottom bar = out")

    # iris_reveal
    sc = scene(40); ph = photo("Photo", 4.8, 2.7, (0, 0, 0))
    M.kit("iris_reveal", [ph], "in", 0)
    ei = err(M._find_fc(ph, '["mdna_iris"]'), 0, 21, "Wind-up")
    render(sc, "iris_reveal", (3, 8, 13, 21))
    rec("iris_reveal", "works", f"{ei:.3f}%", "3,8,13,21", "Wind-up anticipation keeps it closed at the start")

    # jello
    sc = scene(30); j = C.text("Jello", 1.6, (0, 0, 0), lime, F())
    M.kit("jello", [j], "emphasis", 0)
    path = j["mdna_kit"] and next(c.data_path for c in M._curves(j) if "MDNA Skew" in c.data_path)
    fc = M._find_fc(j, path); seg = 21 / 5
    ej = max(err(fc, i * seg, (i + 1) * seg, "Settle") for i in range(5))
    render(sc, "jello", (4, 8, 13, 21))
    rec("jello", "works", f"{ej:.3f}% (worst of 5 Settle segments)", "4,8,13,21", "skew via GN modifier, text stays editable")

    # light_speed_in
    sc = scene(30); ls = C.text("Light Speed", 1.0, (0, 0, 0), mint, F())
    M.kit("light_speed_in", [ls], "in", 0)
    el = err(M._fcurve(ls, "location", 0), 0, 14, "Whip")
    ek = err(M._find_fc(ls, next(c.data_path for c in M._curves(ls) if "MDNA Skew" in c.data_path)), 0, 14, "Whip")
    render(sc, "light_speed_in", (2, 5, 8, 14))
    rec("light_speed_in", "works", f"x {el:.3f}% skew {ek:.3f}%", "2,5,8,14", "fade over the first 60% (as animate.css)")

    # line_draw
    sc = scene(50)
    cu = bpy.data.curves.new("Stroke", "CURVE"); cu.dimensions = "3D"
    sp = cu.splines.new("BEZIER"); sp.bezier_points.add(5)
    for i, bp in enumerate(sp.bezier_points):
        bp.co = (-4 + i * 1.6, 0, 0.6 * math.sin(i * 1.3)); bp.handle_left_type = bp.handle_right_type = "AUTO"
    st = bpy.data.objects.new("Stroke", cu); sc.collection.objects.link(st); cu.materials.append(C.emit_mat("st_m", lime))
    cu2 = cu.copy(); st2 = bpy.data.objects.new("Stroke2", cu2); sc.collection.objects.link(st2); st2.location.z = -1.8
    M.kit("line_draw", [st], "in", 0); M.kit("line_draw", [st2], "out", 0)
    ed = err(M._find_fc(cu, "bevel_factor_end"), 0, 21, "Cruise"); eo = err(M._find_fc(cu2, "bevel_factor_start"), 0, 21, "Cruise")
    render(sc, "line_draw", (5, 10, 15, 21))
    rec("line_draw", "works", f"in {ed:.3f}% out {eo:.3f}%", "5,10,15,21", "curve had no stroke: bevel 0.02 added")

    # chars_rise + layout check
    sc = scene(60); t = C.text("Chars Rise", 1.2, (0, 0, 0.6), lime, F())
    bpy.context.view_layer.update()
    from mathutils import Vector
    def bbox(objs):
        dg = bpy.context.evaluated_depsgraph_get(); pts = []
        for o in objs:
            pts += [o.evaluated_get(dg).matrix_world @ Vector(c) for c in o.evaluated_get(dg).bound_box]
        return [round(min(p[i] for p in pts), 3) for i in (0, 2)] + [round(max(p[i] for p in pts), 3) for i in (0, 2)]
    before = bbox([t])
    r = M.kit("chars_rise", [t], "in", 0)
    pcs = [o for o in r["objects"] if o.get("mdna_piece") is not None]
    sc.frame_set(59); after = bbox(pcs)
    ec = max(err(M._fcurve(p, "location", 2), 1.5 * i, 1.5 * i + 14, "Land") for i, p in enumerate(pcs))
    ef = err(M._fcurve(pcs[0], "color", 3), 0, 14, "Land")
    t2 = C.text("Chars out", 0.8, (0, 0, -1.6), mint, F()); M.kit("chars_rise", [t2], "out", 30)
    render(sc, "chars_rise", (3, 8, 14, 40))
    rec("chars_rise", "works", f"rise {ec:.3f}% fade {ef:.3f}%", "3,8,14,40",
        f"{len(pcs)} chars; bounds original {before} vs pieces {after}")

    # words_fade_up
    sc = scene(60); t = C.text("Words fade up one by one", 0.6, (0, 0, 0), mint, F())
    r = M.kit("words_fade_up", [t], "in", 0)
    pcs = [o for o in r["objects"] if o.get("mdna_piece") is not None]
    ew = max(err(M._fcurve(p, "location", 2), 3 * i, 3 * i + 14, "Land") for i, p in enumerate(pcs))
    render(sc, "words_fade_up", (4, 9, 15, 30))
    rec("words_fade_up", "works", f"{ew:.3f}%", "4,9,15,30", f"{len(pcs)} words: {[p.data.body for p in pcs]}")

    # typewriter
    sc = scene(60); t = C.text("Typewriter, keyed", 0.7, (0, 0, 0), lime, F()); t.data.align_x = "LEFT"; t.location.x = -3.5
    r = M.kit("typewriter", [t], "in", 2)
    pcs = [o for o in r["objects"] if o.get("mdna_piece") is not None]
    ok = True
    for i, p in enumerate(pcs):
        f = 2 + i * 30 / 24
        for fr, want in ((f - 0.01, True), (f + 0.01, False)):
            sc.frame_set(int(math.floor(fr)), subframe=fr - math.floor(fr))
            ok &= p.hide_render == want
    render(sc, "typewriter", (4, 10, 16, 24))
    rec("typewriter", "works" if ok else "fails", "n/a (step keys)", "4,10,16,24", f"{len(pcs)} chars, 1 per 1.25 f, timing ok={ok}")

    # loops
    sc = scene(90)
    fl = C.plane("Float", 1.2, 1.2, (-3, 0, 0), lime); pu = C.plane("Pulse", 1.2, 1.2, (0, 0, 0), (0.9, 0.5, 0.3))
    wi = C.text("Wiggle", 0.8, (3, 0, 0), mint, F())
    M.kit("float", [fl], "loop", 0); M.kit("pulse", [pu], "loop", 0); M.kit("wiggle", [wi], "loop", 0)
    ffc = M._find_fc(fl, "delta_location", 2)
    efl = max(err(ffc, 0, 30, "Cruise"), err(ffc, 30, 60, "Cruise"), err(ffc, 60, 90, "Cruise"))   # 2nd cycle too
    pfc = M._find_fc(pu, "delta_scale", 0)
    epu = max(err(pfc, 0, 15, "Cruise"), err(pfc, 45, 60, "Cruise"))
    wfc = M._find_fc(wi, "delta_rotation_euler", 1)
    wv = [math.degrees(wfc.evaluate(f)) for f in range(0, 300)]
    render(sc, "loops", (0, 8, 15, 30))
    rec("float", "works", f"{efl:.3f}% (cycles 1-2)", "0,8,15,30", f"amp {ffc.evaluate(30):.4f} units = 12 px")
    rec("pulse", "works", f"{epu:.3f}% (cycles 1-2)", "0,8,15,30", f"peak {pfc.evaluate(15):.3f}")
    rec("wiggle", "works", "n/a (noise)", "0,8,15,30", f"rotation range {min(wv):.2f}..{max(wv):.2f} deg over 10 s (target +-4)")

    # counter: created (no selection) and on a selected text
    sc = scene(40)
    bpy.ops.object.select_all(action="DESELECT")
    r = M.kit("counter", None, "in", 0)
    cnt = r["objects"][0]; cnt.location = (0, 0, 1.0)
    tx = C.text("0", 0.8, (0, 0, -1.2), mint, F())
    M.kit("counter", [tx], "in", 0, params={"to": 1234567.89, "decimals": 2, "prefix": "$", "suffix": " raised"})
    ecn = err(M._find_fc(cnt, cnt["mdna_counter_path"]), 0, 33, "Land")
    render(sc, "counter", (0, 6, 15, 33))
    rec("counter", "works", f"{ecn:.3f}%", "0,6,15,33", "created at the 3D cursor; 2nd on a text: $ prefix, 2 decimals, suffix")

    # bars_transition
    sc = scene(50)
    a = C.text("Scene A", 1.2, (0, 0, 0), mint, F()); b = C.text("Scene B", 1.2, (0, 0, 0), lime, F())
    r = M.kit("bars_transition", None, "transition", 2)
    cut = r["cut"]
    for o, vis in ((a, [(0, False), (cut, True)]), (b, [(0, True), (cut, False)])):
        for f, hide in vis:
            o.hide_render = hide; o.keyframe_insert("hide_render", frame=f)
    bar0 = r["objects"][1]
    eb = err(M._fcurve(bar0, "scale", 0), 2, 11, "Surge"); eu = err(M._fcurve(bar0, "location", 0), cut, cut + 9, "Launch")
    render(sc, "bars_transition", (6, 10, int(cut), int(cut) + 6, int(cut) + 12))
    rec("bars_transition", "works", f"cover {eb:.3f}% uncover {eu:.3f}%", f"6,10,{cut:g},+6,+12", f"covered at {cut:g}")

    # every in/out piece in its other phases (no exceptions)
    sc = scene(60)
    probe_fail = []
    for it in M.kit_list():
        for ph in it["phase"]:
            try:
                if it["type"] == "Text":
                    o = C.text("Probe text", 0.5, (0, 0, 0), mint, F())
                elif it["id"] == "line_draw":
                    cu = bpy.data.curves.new("pc", "CURVE"); sp = cu.splines.new("POLY"); sp.points.add(1)
                    sp.points[1].co = (2, 0, 0, 1); o = bpy.data.objects.new("pc", cu); sc.collection.objects.link(o)
                else:
                    o = C.plane("probe", 1, 1, (0, 0, 0), lime)
                M.kit(it["id"], None if it.get("creates") else [o], ph, 0, duration=1.5, intensity=0.5)
            except Exception as ex:
                probe_fail.append(f"{it['id']} {ph}: {ex}")
    print("KIT_PROBE", "failures:", probe_fail or "none")


def addon():
    import motion_dna_addon as A
    A.register()
    sc = scene(60)
    p = sc.mdna
    results = []
    cases = [("MOVES", None, "in", "plane"), ("Effects", "blur_in", "both", "plane"), ("Effects", "wipe_reveal", "in", "plane"),
             ("Text", "chars_rise", "in", "text"), ("Text", "typewriter", "in", "text"), ("Loops", "pulse", "in", "plane"),
             ("Elements", "counter", "in", None), ("Elements", "bars_transition", "in", None)]
    for kind, piece, phase, target in cases:
        bpy.ops.object.select_all(action="DESELECT")
        o = None
        if target == "plane":
            o = C.plane(f"ui_{kind}", 1, 1, (0, 0, 0), (0.5, 0.8, 0.3))
        elif target == "text":
            o = C.text(f"UI {kind}", 0.5, (0, 0, 0), (0.8, 0.9, 0.9), F())
        if o:
            o.select_set(True); bpy.context.view_layer.objects.active = o
        p.kind = kind
        if piece:
            p.piece = piece
        else:
            p.preset = "Fade Up"
        p.phase = phase
        res = bpy.ops.mdna.apply()
        anim = bool(o and (o.animation_data or any(c.animation_data for c in o.children))) if o else bool([x for x in bpy.data.objects if x.name.startswith("MDNA")])
        results.append((kind, piece or p.preset, phase, res, anim))
        if o and kind != "Text":
            res2 = bpy.ops.mdna.remove()
            results.append(("remove", piece, "", res2, not o.animation_data and o.delta_location.length == 0))
    for r_ in results:
        print("ADDON", r_)
    # enum items per type (and that icons load)
    for kind in ("Effects", "Text", "Loops", "Elements"):
        p.kind = kind
        items = A.piece_items(p, bpy.context)
        print("ADDON_ITEMS", kind, [(i[0], i[3] != 0) for i in items])
    A.unregister()


def demo():
    sc = scene(120)
    sc.render.resolution_x, sc.render.resolution_y = 960, 540
    bg = C.plane("BG", 12, 7, (0, 1.0, 0), (0.012, 0.03, 0.026), 1.0)
    ph = photo("Photo", 3.6, 2.03, (-2.4, 0, 0.35))
    title = C.text("Motion DNA", 0.85, (2.3, 0, 0.9), (0.58, 0.89, 0.1), F())
    sub = C.text("in Blender", 0.38, (2.3, 0, 0.15), (0.85, 0.92, 0.9), F())
    chip = C.plane("Chip", 0.6, 0.6, (-2.4, -0.05, -1.75), (0.58, 0.89, 0.1), 1.0)
    bpy.ops.object.select_all(action="DESELECT")
    cnt = M.kit("counter", None, "in", 26, params={"to": 1250, "suffix": " presets"})["objects"][0]
    cnt.location = (2.3, 0, -1.3)
    md = cnt.modifiers["MDNA Counter"]
    s2c = next(n for n in md.node_group.nodes if n.bl_idname == "GeometryNodeStringToCurves"); s2c.inputs["Size"].default_value = 0.55
    M.kit("blur_in", [ph], "in", 2)
    M.kit("chars_rise", [title], "in", 8)
    M.kit("words_fade_up", [sub], "in", 22)
    M.apply(chip, "Scale Pop", "in", 30)
    M.kit("float", [chip], "loop", 30)
    M.kit("pulse", [chip], "loop", 30)
    r = M.kit("bars_transition", None, "transition", 78)
    cut = r["cut"]
    end = C.text("Kit pieces", 1.0, (0, -0.1, 0), (0.85, 0.92, 0.9), F())
    for o in [o for o in sc.objects if o.type != "CAMERA" and not o.name.startswith("MDNA Bar") and o is not end and o.parent is None and not o.get("mdna_split")]:
        o.hide_render = False; o.keyframe_insert("hide_render", frame=0)
        o.hide_render = True; o.keyframe_insert("hide_render", frame=cut)
    for o in [o for o in sc.objects if o.parent and o.parent.get("mdna_split")]:
        o.hide_render = False; o.keyframe_insert("hide_render", frame=0)
        o.hide_render = True; o.keyframe_insert("hide_render", frame=cut)
    end.hide_render = True; end.keyframe_insert("hide_render", frame=0)
    end.hide_render = False; end.keyframe_insert("hide_render", frame=cut)
    M.kit("slam_in", [end], "in", cut + 2)
    for f in (14, 40, cut - 2, 110):
        render(sc, "demo_kit", (int(f),))
    bpy.ops.wm.save_as_mainfile(filepath=str(OUT / "demo_kit.blend"))
    seq = OUT / "demo_seq"; seq.mkdir(exist_ok=True)
    sc.frame_start, sc.frame_end = 0, 119
    sc.render.filepath = str(seq / "f_"); bpy.ops.render.render(animation=True)
    subprocess.run(["ffmpeg", "-y", "-loglevel", "error", "-framerate", "30", "-start_number", "0", "-i", str(seq / "f_%04d.png"),
                    "-c:v", "libx264", "-pix_fmt", "yuv420p", str(OUT / "demo_kit.mp4")], check=True)
    print("DEMO_DONE", OUT / "demo_kit.mp4", "cut", cut)


if "pieces" in ARGS:
    pieces()
    print("\nKIT_REPORT")
    for r in REPORT:
        print(" | ".join(str(x) for x in r))
if "addon" in ARGS:
    addon()
if "demo" in ARGS:
    demo()
print("TEST_KIT_DONE")
