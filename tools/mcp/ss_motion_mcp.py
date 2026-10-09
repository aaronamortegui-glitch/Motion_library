#!/usr/bin/env python3
"""Motion DNA MCP server: lets Claude (or any MCP client) browse the library and drive After Effects.

No dependencies (Python 3 standard library). Speaks MCP over stdio (JSON-RPC 2.0, one message per line) and talks to
After Effects through the repo's file bridge (tools/ss_bridge.jsx polls bridge/inbox and writes bridge/outbox).
The bridge starts by itself when the Motion DNA panel loads in AE (see tools/install_panel.ps1); if it is not running,
the server starts it the same way tools/bridge.sh does.

Registered for Claude Code in .mcp.json at the repo root. Manual run (for debugging): python tools/mcp/ss_motion_mcp.py
"""
import json
import os
import pathlib
import subprocess
import sys
import time

ROOT = pathlib.Path(__file__).resolve().parent.parent.parent
TOOLS = ROOT / "tools"
INBOX, OUTBOX = ROOT / "bridge" / "inbox", ROOT / "bridge" / "outbox"
IS_MAC = sys.platform == "darwin"
AFX = os.environ.get("SS_AFTERFX", r"C:\Program Files\Adobe\Adobe After Effects 2026\Support Files\AfterFX.exe")


def mac_app():
    if os.environ.get("SS_AE_APP"):
        return os.environ["SS_AE_APP"]
    apps = sorted(p.name for p in pathlib.Path("/Applications").glob("Adobe After Effects 20*"))
    return apps[-1] if apps else "Adobe After Effects 2026"
PROTOCOL = "2025-06-18"


# ---------------------------------------------------------------- bridge
def ae_running():
    try:
        if IS_MAC:
            return subprocess.run(["pgrep", "-f", mac_app() + ".app/Contents/MacOS"], capture_output=True, timeout=10).returncode == 0
        out = subprocess.run(["tasklist", "/FI", "IMAGENAME eq AfterFX.exe"], capture_output=True, text=True, timeout=10).stdout
        return "afterfx" in out.lower()
    except Exception:
        return False


def start_bridge_script(path):
    if IS_MAC:   # AE's AppleScript dictionary: DoScriptFile runs a .jsx in the running app
        subprocess.Popen(["osascript", "-e", f'tell application "{mac_app()}" to DoScriptFile "{path}"'],
                         stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    else:
        subprocess.Popen([AFX, "-s", f"$.evalFile(new File('{path}'))"], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)


def ensure_bridge():
    marker = OUTBOX / "_bridge_started.txt"
    if not ae_running():
        marker.unlink(missing_ok=True)
        raise RuntimeError("After Effects is not running. Open it (with the Motion DNA panel docked the bridge starts by itself).")
    if not marker.exists():
        start_bridge_script((TOOLS / "ss_bridge.jsx").as_posix())
        for _ in range(60):
            if marker.exists():
                break
            time.sleep(0.5)


def run_jsx(body, timeout=180, includes=("ss_presets.jsx", "ss_assets.jsx")):
    """Runs ExtendScript in AE. `body` is the inside of a function: use `return` for the result."""
    ensure_bridge()
    INBOX.mkdir(parents=True, exist_ok=True)
    name = f"{time.time_ns()}_mcp"
    job = TOOLS / f"_mcp_{name}.jsx"
    head = "".join(f'#include "{i}"\n' for i in includes)
    job.write_text(head + "(function () {\n" + body + "\n})();\n", encoding="utf-8")
    try:
        (INBOX / f"{name}.jsx").write_text(f'$.evalFile(new File("{job.as_posix()}"));\n', encoding="utf-8")
        out = OUTBOX / f"{name}.txt"
        for _ in range(int(timeout * 4)):
            if out.exists():
                break
            time.sleep(0.25)
        else:
            raise RuntimeError(f"No answer from After Effects in {timeout}s (is a render or a modal dialog blocking it?)")
        text = out.read_text(encoding="utf-8", errors="replace")
        status, _, rest = text.partition("\n")
        if not status.startswith("OK"):
            raise RuntimeError(text.strip())
        return rest.strip()
    finally:
        job.unlink(missing_ok=True)


def js(s):
    return json.dumps(s)


COMP_JS = """
function findComp(name) {
    if (!name) { var a = app.project.activeItem; if (a instanceof CompItem) return a; throw new Error("No active comp: open one or pass comp"); }
    for (var i = 1; i <= app.project.numItems; i++) { var it = app.project.item(i); if (it instanceof CompItem && it.name === name) return it; }
    throw new Error("Comp not found: " + name);
}
function findLayers(c, names) {
    var out = [];
    if (names && names.length) { for (var i = 0; i < names.length; i++) { var L = c.layer(names[i]); if (!L) throw new Error("Layer not found: " + names[i]); out.push(L); } }
    else for (var j = 0; j < c.selectedLayers.length; j++) out.push(c.selectedLayers[j]);
    if (!out.length) throw new Error("No layers: select layers in the comp or pass layers");
    return out;
}
"""


# ---------------------------------------------------------------- library (no AE needed)
def lib_presets():
    lib = json.loads((ROOT / "library" / "library.json").read_text(encoding="utf-8"))["presets"]
    rec = json.loads((ROOT / "library" / "recipes.json").read_text(encoding="utf-8"))
    rec = rec.get("recipes", rec) if isinstance(rec, dict) else rec
    energy = {"s": "soft", "m": "medium", "d": "dynamic"}
    out = [{"name": p["name"], "kind": p["kind"], "family": p.get("family", "ss"), "channels": p["channels"], "energy": p["energy"], "use": p["use"]} for p in lib]
    out += [{"name": r["id"], "kind": "recipe", "family": "recipe", "channels": " & ".join(r.get("channels", [])),
             "energy": energy.get(r.get("energy"), r.get("energy")), "use": "measured reference"} for r in rec]
    return out


def kind_of(name):
    for p in lib_presets():
        if p["name"] == name:
            return p["kind"]
    raise RuntimeError(f"Unknown preset: {name}. Use list_presets.")


# ---------------------------------------------------------------- tools
def t_list_presets(kind=None, energy=None, family=None, query=None):
    q = (query or "").lower()
    rows = [p for p in lib_presets()
            if (not kind or p["kind"] == kind) and (not energy or p["energy"] == energy) and (not family or p["family"] == family)
            and (not q or q in (p["name"] + " " + p["channels"] + " " + p["use"]).lower())]
    return "\n".join(f'{p["kind"]}|{p["name"]}|{p["channels"]}|{p["energy"]}|{p["use"]}' for p in rows) or "no match"


def t_list_packs():
    packs = json.loads((ROOT / "library" / "packs.json").read_text(encoding="utf-8"))["packs"]
    return "\n".join(f'{p["name"]} ({p["energy"]}, stagger {p.get("stagger", 3)}f): {p["desc"]} · ' +
                     ", ".join(f'{k}={v.get("text") or v.get("motion")}{"+" + v["fx"] if v.get("fx") else ""}' for k, v in p["roles"].items())
                     for p in packs)


def t_list_assets(type=None, category=None, query=None, limit=60):
    f = ROOT / "library" / "ASSETS.local.txt"
    if not f.exists():
        return "No local asset index. Run: python tools/index_assets.py"
    q = (query or "").lower(); out = []
    for line in f.read_text(encoding="utf-8").splitlines():
        if not line or line.startswith("#"):
            continue
        c = line.split("|")
        if (type and c[0] != type) or (category and c[1] != category) or (q and q not in c[2].lower()):
            continue
        out.append(line)
    return "\n".join(out[:limit]) + (f"\n… {len(out) - limit} more" if len(out) > limit else "") if out else "no match"


def t_ae_status():
    if not ae_running():
        return "After Effects is not running."
    return run_jsx("""var a = app.project.activeItem;
return "AE " + app.version + " · project: " + (app.project.file ? app.project.file.name : "unsaved") +
  " · active: " + (a instanceof CompItem ? a.name + " (" + a.width + "x" + a.height + ", " + a.duration.toFixed(2) + "s, " + a.numLayers + " layers, selected: " + a.selectedLayers.length + ")" : "none") +
  " · panel: " + (typeof SS_PANEL !== "undefined" ? "loaded" : "not loaded");""", includes=())


def t_list_layers(comp=None):
    return run_jsx(COMP_JS + f"""var c = findComp({js(comp)}), o = [];
for (var i = 1; i <= c.numLayers; i++) {{ var L = c.layer(i);
  var ty = "av"; if (L instanceof TextLayer) ty = "text"; else if (L instanceof ShapeLayer) ty = "shape"; else if (L.nullLayer) ty = "null"; else if (L.source instanceof CompItem) ty = "precomp";
  o.push(i + "|" + L.name + "|" + ty +
         "|" + L.inPoint.toFixed(2) + "-" + L.outPoint.toFixed(2) + (L.selected ? "|selected" : "")); }}
return c.name + "\\n" + o.join("\\n");""", includes=())


def tune_js(duration=1.0, intensity=1.0, direction="as designed", ease=None):
    d = (direction or "").lower()
    o = {"speed": float(duration or 1), "intensity": float(intensity if intensity is not None else 1),
         "flipX": d in ("mirror horizontal", "mirror both", "horizontal", "both"), "flipY": d in ("mirror vertical", "mirror both", "vertical", "both"),
         "ease": ease or None}
    return "SSP.tune(" + json.dumps(o) + ");"


def t_apply_preset(preset, layers=None, comp=None, phase="both", stagger_frames=4, marker_timing=True,
                   duration=1.0, intensity=1.0, direction="as designed", ease=None):
    kind = kind_of(preset)
    call = {"text": f"SSP.applyText(L, {js(preset)}, {js(phase)}, t0)", "fx": f"SSP.applyFx(L, {js(preset)})",
            "recipe": f"SSP.applyRecipe(L, {js(preset)}, {js(phase)})"}.get(kind, f"SSP.apply(L, {js(preset)}, {js(phase)}, t0)")
    return run_jsx(COMP_JS + f"""var c = findComp({js(comp)}), ls = findLayers(c, {js(layers or [])}), st = {float(stagger_frames)} * c.frameDuration, done = [];
SSP.markerTiming({str(bool(marker_timing)).lower()}); {tune_js(duration, intensity, direction, ease)}
app.beginUndoGroup("Motion DNA (MCP): {preset}");
try {{ for (var i = 0; i < ls.length; i++) {{ var L = ls[i], t0 = ({js(phase)} === "out" ? L.outPoint - SSM.seconds("Arrive") : L.inPoint) + i * st; {call}; done.push(L.name); }} }}
finally {{ SSP.markerTiming(false); SSP.tune(); app.endUndoGroup(); }}
return "{preset} ({kind}, {phase}) → " + done.join(", ");""")


def t_remove_animation(layers=None, comp=None):
    return run_jsx(COMP_JS + f"""var c = findComp({js(comp)}), ls = findLayers(c, {js(layers or [])}), n = 0, done = [];
app.beginUndoGroup("Motion DNA (MCP): remove");
try {{ for (var i = 0; i < ls.length; i++) {{ n += SSP.remove(ls[i]); done.push(ls[i].name); }} }} finally {{ app.endUndoGroup(); }}
return "cleared " + n + " properties on " + done.join(", ");""")


def t_apply_pack(pack, comp=None, layers=None, phase="both", marker_timing=True, duration=1.0, intensity=1.0):
    return run_jsx(COMP_JS + f"""var c = findComp({js(comp)}), names = {js(layers or [])}, ls = null;
if (names.length) ls = findLayers(c, names);
SSP.markerTiming({str(bool(marker_timing)).lower()}); {tune_js(duration, intensity)}
app.beginUndoGroup("Motion DNA style (MCP): {pack}");
var r; try {{ r = SSP.applyPack(c, {js(pack)}, ls, {js(phase)}); }} finally {{ SSP.markerTiming(false); SSP.tune(); app.endUndoGroup(); }}
return r.length ? r.join("\\n") : "No layers matched";""")


def t_add_asset(name, type="sfx", time_s=None, gain_db=-9, opacity=70, comp=None):
    at = "c.time" if time_s is None else str(float(time_s))
    call = f"SSA.sfx(c, {js(name)}, {at}, {float(gain_db)})" if type == "sfx" else f"SSA.overlay(c, {js(name)}, {at}, null, {float(opacity)})"
    return run_jsx(COMP_JS + f"""var c = findComp({js(comp)}); app.beginUndoGroup("SS asset (MCP)"); var L = {call}; app.endUndoGroup(); return "added " + L.name + " at " + {at};""")


def t_show_in_panel(kind, name):
    return run_jsx(f"""if (typeof SS_PANEL === "undefined") return "Motion DNA panel is not open (Window > Motion DNA.jsx)"; return SS_PANEL.select({js(kind)}, {js(name)});""", includes=())


def t_render_frame(time_s=None, comp=None):
    out = (ROOT / "research" / "mcp" / f"frame_{int(time.time())}.png")
    out.parent.mkdir(parents=True, exist_ok=True)
    t = "c.time" if time_s is None else str(float(time_s))
    run_jsx(COMP_JS + f"""var c = findComp({js(comp)}); c.saveFrameToPng({t}, new File({js(out.as_posix())})); return "ok";""", includes=())
    for _ in range(120):
        if out.exists() and out.stat().st_size > 0:
            time.sleep(0.3)
            return f"Saved {out} (open it to look at the frame)"
        time.sleep(0.25)
    raise RuntimeError("Frame was not written in time")


def t_render_comp(comp=None, wait_s=600):
    out = ROOT / "renders" / "mcp"
    out.mkdir(parents=True, exist_ok=True)
    res = run_jsx(COMP_JS + f"""var c = findComp({js(comp)}), rq = app.project.renderQueue;
for (var i = rq.numItems; i >= 1; i--) rq.item(i).remove();
var it = rq.items.add(c), om = it.outputModule(1);
try {{ om.applyTemplate("H.264 - Match Render Settings - 15 Mbps"); }} catch (e) {{}}
var f = new File({js(out.as_posix())} + "/" + c.name + ".mp4"); if (f.exists) f.remove(); om.file = f;
app.scheduleTask("app.project.renderQueue.render()", 200, false); return f.fsName;""", includes=())
    target = pathlib.Path(res)
    last = -1
    for _ in range(int(wait_s / 2)):
        time.sleep(2)
        if target.exists():
            size = target.stat().st_size
            if size == last and size > 0:
                return f"Rendered {target}"
            last = size
    return f"Render queued; still writing {target} (AE shows 'Not Responding' while it renders)"


def t_run_jsx(code, timeout_s=180):
    return run_jsx(code, timeout=timeout_s)


TOOLS_DEF = [
    ("ae_status", t_ae_status, "After Effects status: version, project, active comp, selection, whether the Motion DNA panel is loaded.", {}),
    ("list_presets", t_list_presets, "List library presets (one line each: kind|name|channels|energy|use). Filter by kind (motion|text|fx|recipe), energy (soft|medium|dynamic), family (ss|classic|recipe) or a text query. Pick presets from this before applying.",
     {"kind": {"type": "string"}, "energy": {"type": "string"}, "family": {"type": "string"}, "query": {"type": "string"}}),
    ("list_packs", t_list_packs, "List styles (Dynamic, Elegant, Modern, Playful, Tech…) and which preset each layer role gets.", {}),
    ("list_assets", t_list_assets, "List locally installed SFX and overlays (licensed, never in the repo) with category, seconds, loudness and flags.",
     {"type": {"type": "string", "description": "sfx | overlay"}, "category": {"type": "string"}, "query": {"type": "string"}, "limit": {"type": "integer"}}),
    ("list_layers", t_list_layers, "List the layers of a comp (default: the active comp) with type, timing and selection.", {"comp": {"type": "string"}}),
    ("apply_preset", t_apply_preset, "Apply a preset to layers (by name, or the selected layers) of a comp (default: active). phase in|out|both. With marker_timing the layer gets 'SS in'/'SS out' markers: dragging them retimes the animation. Tuning (same as the panel's Controls): duration multiplier (0.5-2), intensity (0.25-2, scales the travel), direction (as designed | mirror horizontal | mirror vertical | mirror both), ease (token: Land, Settle, Launch, Cruise, Surge, Ramp, Whip, Flat).",
     {"preset": {"type": "string"}, "layers": {"type": "array", "items": {"type": "string"}}, "comp": {"type": "string"},
      "phase": {"type": "string", "enum": ["in", "out", "both"]}, "stagger_frames": {"type": "number"}, "marker_timing": {"type": "boolean"},
      "duration": {"type": "number"}, "intensity": {"type": "number"}, "direction": {"type": "string"}, "ease": {"type": "string"}}, ["preset"]),
    ("remove_animation", t_remove_animation, "Remove what Motion DNA added to layers (keyframes, our expressions, SS in/out markers, SS text animators and effects); each property keeps its resting value.",
     {"layers": {"type": "array", "items": {"type": "string"}}, "comp": {"type": "string"}}),
    ("apply_pack", t_apply_pack, "Apply a style pack to a whole comp (or the named layers): titles, text, shapes, media and logo each get the pack's preset, staggered.",
     {"pack": {"type": "string"}, "comp": {"type": "string"}, "layers": {"type": "array", "items": {"type": "string"}},
      "phase": {"type": "string", "enum": ["in", "out", "both"]}, "marker_timing": {"type": "boolean"}, "duration": {"type": "number"}, "intensity": {"type": "number"}}, ["pack"]),
    ("add_asset", t_add_asset, "Place a local SFX or overlay (by exact name from list_assets) in a comp at a time (default: playhead).",
     {"name": {"type": "string"}, "type": {"type": "string", "enum": ["sfx", "overlay"]}, "time_s": {"type": "number"}, "gain_db": {"type": "number"},
      "opacity": {"type": "number"}, "comp": {"type": "string"}}, ["name"]),
    ("show_in_panel", t_show_in_panel, "Select a preset in the open Motion DNA panel so the user sees its live preview.",
     {"kind": {"type": "string"}, "name": {"type": "string"}}, ["kind", "name"]),
    ("render_frame", t_render_frame, "Save one frame of a comp as PNG (default: active comp at the playhead) and return its path, to check the result visually.",
     {"time_s": {"type": "number"}, "comp": {"type": "string"}}),
    ("render_comp", t_render_comp, "Render a comp to MP4 through AE's render queue (renders/mcp/<comp>.mp4). Blocks AE while rendering.",
     {"comp": {"type": "string"}, "wait_s": {"type": "number"}}),
    ("run_jsx", t_run_jsx, "Advanced: run ExtendScript in AE with the library loaded (SSM, SSP, SSA available). The code is a function body: use `return` for the result.",
     {"code": {"type": "string"}, "timeout_s": {"type": "number"}}, ["code"]),
]


def tool_list():
    out = []
    for t in TOOLS_DEF:
        name, _, desc, props = t[:4]
        req = t[4] if len(t) > 4 else []
        out.append({"name": name, "description": desc, "inputSchema": {"type": "object", "properties": props, "required": req}})
    return out


# ---------------------------------------------------------------- JSON-RPC over stdio
def send(msg):
    sys.stdout.write(json.dumps(msg) + "\n")
    sys.stdout.flush()


def handle(req):
    method, rid = req.get("method"), req.get("id")
    if method == "initialize":
        return {"protocolVersion": req.get("params", {}).get("protocolVersion", PROTOCOL),
                "capabilities": {"tools": {}}, "serverInfo": {"name": "motion-dna", "version": "0.1"},
                "instructions": "Motion DNA, a motion library for After Effects. Browse with list_presets/list_packs/list_assets (no AE needed); "
                                "apply with apply_preset/apply_pack/add_asset; check results with render_frame. Read CLAUDE.md in the repo for the rules."}
    if method == "tools/list":
        return {"tools": tool_list()}
    if method == "tools/call":
        p = req.get("params", {})
        fn = {t[0]: t[1] for t in TOOLS_DEF}.get(p.get("name"))
        if not fn:
            return {"content": [{"type": "text", "text": f"Unknown tool {p.get('name')}"}], "isError": True}
        try:
            text = fn(**(p.get("arguments") or {}))
            return {"content": [{"type": "text", "text": str(text)}]}
        except Exception as e:  # tool errors go back to the model, not as protocol errors
            return {"content": [{"type": "text", "text": f"Error: {e}"}], "isError": True}
    if method == "ping":
        return {}
    if rid is None:
        return None  # notification
    raise KeyError(method)


def main():
    sys.stdin.reconfigure(encoding="utf-8")
    sys.stdout.reconfigure(encoding="utf-8")
    for line in sys.stdin:
        line = line.strip()
        if not line:
            continue
        try:
            req = json.loads(line)
        except json.JSONDecodeError:
            continue
        try:
            res = handle(req)
            if req.get("id") is not None and res is not None:
                send({"jsonrpc": "2.0", "id": req["id"], "result": res})
        except KeyError as e:
            if req.get("id") is not None:
                send({"jsonrpc": "2.0", "id": req["id"], "error": {"code": -32601, "message": f"Method not found: {e}"}})
        except Exception as e:
            if req.get("id") is not None:
                send({"jsonrpc": "2.0", "id": req["id"], "error": {"code": -32603, "message": str(e)}})


if __name__ == "__main__":
    main()
