#!/usr/bin/env python3
"""Motion DNA for Blender · MCP server (beta): lets Claude drive an open Blender that has the Motion DNA add-on, through
the add-on's file bridge (research/platforms/blender/bridge/inbox → outbox; no network port), like the After Effects
server does with AE.

Register for Claude Code (from the clone that has research/platforms):
  claude mcp add motion-dna-blender -- python "<clone>/research/platforms/blender/mcp_blender.py"
Blender must be open with the add-on enabled (it listens by itself; bridge/alive.json is refreshed while it does).
No dependencies (Python 3 standard library); JSON-RPC 2.0 over stdio, one message per line.
"""
import json
import pathlib
import sys
import time
import uuid

HERE = pathlib.Path(__file__).resolve().parent
BRIDGE = HERE / "bridge"
INBOX, OUTBOX = BRIDGE / "inbox", BRIDGE / "outbox"
PROTOCOL = "2025-06-18"


def alive():
    try:
        a = json.loads((BRIDGE / "alive.json").read_text(encoding="utf-8"))
        return a if time.time() - a["t"] < 5 else None
    except (OSError, ValueError, KeyError):
        return None


def run(code, timeout=180):
    """Runs Python inside the open Blender (bpy, M = mdna_blender, F = mdna_figma); the code sets `result`."""
    if not alive():
        raise RuntimeError("Blender is not listening: open Blender with the Motion DNA add-on enabled (Edit › Preferences › Add-ons › Motion DNA)")
    INBOX.mkdir(parents=True, exist_ok=True)
    jid = f"{time.time_ns()}_{uuid.uuid4().hex[:6]}"
    tmp = INBOX / (jid + ".tmp")
    tmp.write_text(code, encoding="utf-8"); tmp.rename(INBOX / (jid + ".py"))   # appears whole, never half written
    out = OUTBOX / (jid + ".json")
    end = time.time() + timeout
    while time.time() < end:
        if out.exists():
            time.sleep(0.05)
            r = json.loads(out.read_text(encoding="utf-8")); out.unlink()
            if not r.get("ok"):
                raise RuntimeError(r.get("error", "error") + "\n" + r.get("trace", ""))
            return r.get("result")
        time.sleep(0.1)
    raise RuntimeError(f"No answer from Blender in {timeout}s (a modal dialog, or a long render?)")


def js(v):   # a Python literal for the job's code (None, True, lists, dicts, strings)
    return repr(v)


SELECT = """
names = {names}
objs = [bpy.data.objects[n] for n in names if n in bpy.data.objects] if names else list(bpy.context.selected_objects)
if not objs: raise RuntimeError("no objects: pass names or select them in Blender")
objs = sorted(objs, key=lambda o: o.name) if not names else objs
"""


def t_status():
    a = alive()
    if not a:
        return "Blender is not listening (open it with the Motion DNA add-on enabled)."
    r = run("""sc = bpy.context.scene
result = {"blender": bpy.app.version_string, "file": bpy.data.filepath or "(unsaved)", "scene": sc.name, "frames": [sc.frame_start, sc.frame_end], "fps": sc.render.fps,
          "resolution": [sc.render.resolution_x, sc.render.resolution_y], "camera": sc.camera.name if sc.camera else None,
          "selected": [o.name for o in bpy.context.selected_objects], "objects": len(sc.objects), "presets": len(M.portable()), "kit": len(M.kit_list())}""")
    return json.dumps(r)


def t_list_objects():
    return json.dumps(run("""result = [{"name": o.name, "type": o.type, "role": o.get("mdna_role"), "animated": bool(o.animation_data and o.animation_data.action),
           "selected": o.select_get()} for o in bpy.context.scene.objects]"""))


def t_list_presets():
    return json.dumps(run('result = {"presets": M.portable(), "kit": [(k["id"], k["type"], k["name"]) for k in M.kit_list()]}'))


def t_apply_preset(preset, objects=None, phase="in", start=None, stagger=3, duration=1.0, intensity=1.0, ease=None):
    return json.dumps(run(SELECT.format(names=js(objects or [])) + f"""
s0 = {js(start)} if {js(start)} is not None else bpy.context.scene.frame_current
result = [M.apply(o, {js(preset)}, {js(phase)}, s0 + i * {js(stagger)}, duration={js(duration)}, intensity={js(intensity)}, ease={js(ease)}) for i, o in enumerate(objs)]"""))


def t_add_kit(id, objects=None, phase=None, start=None, stagger=3, duration=1.0, intensity=1.0, params=None):
    return json.dumps(run(f"""names = {js(objects or [])}
objs = [bpy.data.objects[n] for n in names if n in bpy.data.objects] if names else list(bpy.context.selected_objects)
s0 = {js(start)} if {js(start)} is not None else bpy.context.scene.frame_current
result = M.kit({js(id)}, objs, {js(phase)}, s0, duration={js(duration)}, intensity={js(intensity)}, stagger={js(stagger)}, params={js(params)})""", timeout=300), default=str)


def t_figma_build(folder):
    return json.dumps(run(f"""built = F.build({js(folder)})
result = [(b["name"], b["role"]) for b in built]"""))


def t_figma_animate(start=None, stagger=4):
    return json.dumps(run(f"""built = [{{"name": o.name, "object": o, "role": o["mdna_role"], "order": o["mdna_order"]}} for o in bpy.context.scene.objects if "mdna_role" in o]
s0 = {js(start)} if {js(start)} is not None else bpy.context.scene.frame_current
result = F.animate(built, start=s0, stagger={js(stagger)})"""))


def t_remove_animation(objects=None):
    return json.dumps(run(SELECT.format(names=js(objects or [])) + """
for o in objs: o.animation_data_clear()
result = [o.name for o in objs]"""))


def t_render_frame(frame=None, scale=50):
    path = (BRIDGE / "frames" / f"frame_{int(time.time() * 1000)}.png").as_posix()
    run(f"""import os
sc = bpy.context.scene; back = sc.frame_current; pct = sc.render.resolution_percentage; fp = sc.render.filepath
os.makedirs(os.path.dirname({js(path)}), exist_ok=True)
sc.frame_set({js(frame)} if {js(frame)} is not None else back); sc.render.resolution_percentage = {js(scale)}; sc.render.filepath = {js(path)}
bpy.ops.render.render(write_still=True)
sc.render.filepath = fp; sc.render.resolution_percentage = pct; sc.frame_set(back)
result = {js(path)}""", timeout=600)
    return f"Saved {path} (open it to look at the frame)"


def t_run_python(code, timeout_s=180):
    return json.dumps(run(code, timeout=timeout_s), default=str)


S, N, A = {"type": "string"}, {"type": "number"}, {"type": "array", "items": {"type": "string"}}
TOOLS_DEF = [
    ("blender_status", t_status, "Is Blender listening? Version, file, scene, frame range, fps, resolution, camera, selection, Motion DNA presets and kit.", {}),
    ("list_objects", t_list_objects, "Objects of the open scene with type, Figma role (mdna_role), whether animated and selected.", {}),
    ("list_presets", t_list_presets, "The portable presets (37) and the kit pieces (id, type, name) Blender has.", {}),
    ("apply_preset", t_apply_preset, "Apply a Motion DNA preset to objects (names, or the selection) from a frame (default: playhead), staggered, with the exact token curves. phase in|out; duration and intensity multipliers; ease = a token that replaces the preset's curves.",
     {"preset": S, "objects": A, "phase": {"type": "string", "enum": ["in", "out"]}, "start": N, "stagger": N, "duration": N, "intensity": N, "ease": S}, ["preset"]),
    ("add_kit", t_add_kit, "Add a kit piece (blur_in, slam_in, wipe_reveal, iris_reveal, jello, light_speed_in, line_draw, chars_rise, words_fade_up, typewriter, float, pulse, wiggle, counter, bars_transition) to objects or the selection; counter and bars_transition create their own objects. params overrides the catalog's (research/platforms/kit_portable.json).",
     {"id": S, "objects": A, "phase": S, "start": N, "stagger": N, "duration": N, "intensity": N, "params": {"type": "object"}}, ["id"]),
    ("figma_build", t_figma_build, "Rebuild a Figma frame from the folder the Figma bridge wrote (manifest.json + assets; research/platforms/figma/README.md) facing the camera: live text, shapes, image planes, SVG; Figma names and roles kept.", {"folder": S}, ["folder"]),
    ("figma_animate", t_figma_animate, "Animate the imported Figma layers by role (title Chars Rise, subtitle Words Fade Up, media Blur In, shapes Wipe Reveal, body Fade Up, logo Scale Pop), staggered in reading order.", {"start": N, "stagger": N}),
    ("remove_animation", t_remove_animation, "Remove the animation from objects (names, or the selection).", {"objects": A}),
    ("render_frame", t_render_frame, "Render one frame (default: playhead) to a PNG at scale % (default 50) and return its path: look at it to check the work.", {"frame": N, "scale": N}),
    ("run_python", t_run_python, "Advanced: run Python in the open Blender (bpy; M = mdna_blender; F = mdna_figma). Set `result` to return a value.", {"code": S, "timeout_s": N}, ["code"]),
]


def handle(req):
    method = req.get("method")
    if method == "initialize":
        return {"protocolVersion": req.get("params", {}).get("protocolVersion", PROTOCOL), "capabilities": {"tools": {}},
                "serverInfo": {"name": "motion-dna-blender", "version": "0.1"},
                "instructions": "Motion DNA in Blender (beta): drives the open Blender through the Motion DNA add-on. Check blender_status first; "
                                "apply presets and kit pieces with the exact token curves; bring Figma frames with figma_build after the Figma bridge "
                                "(research/platforms/figma/README.md); look at render_frame before calling something done. Never save the .blend unless asked."}
    if method == "tools/list":
        return {"tools": [{"name": t[0], "description": t[2], "inputSchema": {"type": "object", "properties": t[3], "required": t[4] if len(t) > 4 else []}} for t in TOOLS_DEF]}
    if method == "tools/call":
        p = req.get("params", {}); fn = {t[0]: t[1] for t in TOOLS_DEF}.get(p.get("name"))
        if not fn:
            return {"content": [{"type": "text", "text": "unknown tool"}], "isError": True}
        try:
            return {"content": [{"type": "text", "text": str(fn(**(p.get("arguments") or {})))}]}
        except Exception as e:
            return {"content": [{"type": "text", "text": f"ERROR: {e}"}], "isError": True}
    if method in ("notifications/initialized", "initialized"):
        return None
    return {}


def main():
    sys.stdin.reconfigure(encoding="utf-8"); sys.stdout.reconfigure(encoding="utf-8")
    for line in sys.stdin:
        line = line.strip()
        if not line:
            continue
        try:
            req = json.loads(line)
        except json.JSONDecodeError:
            continue
        res = handle(req)
        if req.get("id") is not None and res is not None:
            sys.stdout.write(json.dumps({"jsonrpc": "2.0", "id": req["id"], "result": res}) + "\n"); sys.stdout.flush()


if __name__ == "__main__":
    main()
