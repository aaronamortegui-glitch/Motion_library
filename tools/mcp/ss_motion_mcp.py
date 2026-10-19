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
    """The After Effects that is running (2025 and 2026 can both be installed), else the newest one installed."""
    if os.environ.get("SS_AE_APP"):
        return os.environ["SS_AE_APP"]
    try:
        out = subprocess.run(["pgrep", "-fl", "Adobe After Effects 20[0-9]+.app/Contents/MacOS/"], capture_output=True, text=True, timeout=10).stdout
        import re
        m = re.search(r"(Adobe After Effects 20\d\d)\.app", out)
        if m:
            return m.group(1)
    except Exception:
        pass
    apps = sorted(p.name for p in pathlib.Path("/Applications").glob("Adobe After Effects 20*"))
    return apps[-1] if apps else "Adobe After Effects 2026"
PROTOCOL = "2025-06-18"


# ---------------------------------------------------------------- bridge
def ae_running():
    try:
        if IS_MAC:
            return subprocess.run(["pgrep", "-f", "Adobe After Effects 20[0-9]+.app/Contents/MacOS/"], capture_output=True, timeout=10).returncode == 0
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
    out = [{"name": p["name"], "kind": p["kind"], "family": p.get("family", "own"), "channels": p["channels"], "energy": p["energy"], "use": p["use"]} for p in lib]
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
    return "\n".join(f'{p["name"]} ({p["energy"]} {p.get("energy_range", "")}, tones {"/".join(p.get("tones", []))}, curve {p.get("curve", "per preset")}, '
                     f'transition {p.get("transition", "-")}, stagger {p.get("stagger", 3)}f): {p["desc"]} · ' +
                     ", ".join(f'{k}={v.get("text") or v.get("motion")}{"+" + v["fx"] if v.get("fx") else ""}' for k, v in p["roles"].items())
                     for p in packs)


# ---------------------------------------------------------------- brand profiles (library/brands, tools/brand.py)
sys.path.insert(0, str(ROOT / "tools"))
import brand as _brand  # noqa: E402


def t_list_brands():
    bs = _brand.all_brands()
    if not bs:
        return "No brand profiles yet. Create one with add_brand_note after `python tools/brand.py new <slug> --name ...`."
    return "\n".join(f"{b['slug']}: {b['name']} · style {b['feel']['style']} · curve {b['feel'].get('curve') or '-'} · tones "
                     f"{'/'.join(b['feel']['tones'])} · energy {b['feel']['energy']} · {len(b['rules'])} rules · {b['_where']}" for b in bs)


def t_get_brand(slug):
    return _brand.digest(slug)


def t_add_brand_note(slug, rule, category="layout", why="", project="", by=""):
    r = _brand.note(slug, rule, category, why, project, by)
    return f"saved rule {r['id']} ({r['category']}) in {_brand.path(slug).as_posix()}: {r['rule']}"


def t_apply_brand(slug, comp=None, layers=None, phase="both", marker_timing=True, duration=1.0, intensity=1.0, existing="modify"):
    b = _brand.load(slug)
    f, mo = b["feel"], b.get("motion") or {}
    return run_jsx(COMP_JS + f"""var c = findComp({js(comp)}), names = {js(layers or [])}, ls = null;
if (names.length) ls = findLayers(c, names);
SSP.markerTiming({str(bool(marker_timing)).lower()}); {tune_js(duration, intensity, ease=f.get("curve"))}
app.beginUndoGroup("Motion DNA brand (MCP): {b['name']}");
var r, tm = []; try {{ r = SSP.applyPack(c, {js(f['style'])}, ls, {js(phase)}, {js(existing)});
  tm = SSP.brandTiming(c, ls, {js(mo.get('timing') or [])}, {js(mo.get('curves') or [])}); }} finally {{ SSP.markerTiming(false); SSP.tune(); app.endUndoGroup(); }}
return "{b['name']}: style " + {js(f['style'])} + " with curve " + {js(f.get('curve') or 'of the style')} + "\\n" + (r.length ? r.join("\\n") : "No layers matched") +
  (tm.length ? "\\nBrand timing:\\n" + tm.join("\\n") : "");""") + \
        "\nThe brand's own timing is applied where its entries name a layer or role. Check its motion rules (get_brand) on a rendered frame, then run check_layout."


def t_solid_transition(look=None, type=None, at_s=None, comp=None, colors=None, brand=None, dur=None, duration=None, ease_in=None, ease_out=None,
                       count=None, angle=None, stagger=None, order=None, cols=None, outgoing=None, incoming=None, energy=None, tone=None):
    """Flat 2D transition from solids and masks (tools/ss_transitions.jsx). No look/type: list the named looks."""
    lib = json.loads((ROOT / "library" / "transitions.json").read_text(encoding="utf-8"))["transitions"]
    if not look and not type:
        rows = [t for t in lib if (not energy or t["energy"][0] <= energy <= t["energy"][1]) and (not tone or tone in t["tones"])]
        return "\n".join(f"{t['name']} ({t['type']}{', clip to clip' if t.get('clip_to_clip') else ''}, {t['dur']} · {' → '.join(t['curves'])}, energy {t['energy'][0]}-{t['energy'][1]}, {'/'.join(t['tones'])}): {t['use']}"
                         for t in rows) or "no look matches; types: wipe, bars, blinds, split, interleave, stack, iris, diamond, grid"
    if not colors and brand:
        colors = [v for v in (_brand.load(brand).get("identity", {}).get("colors") or {}).values() if str(v).startswith("#")][:3] or None
    o = {k: v for k, v in dict(colors=colors, dur=dur, duration=duration, ease_in=ease_in, ease_out=ease_out, count=count, angle=angle, stagger=stagger, order=order,
                               cols=cols, outgoing=outgoing, incoming=incoming).items() if v is not None}
    at = "c.time" if at_s is None else str(float(at_s))
    call = f"SST.recipe(c, {js(look)}, {at}, {js(o)})" if look else f"SST.add(c, {js(type)}, {at}, {js(o)})"
    return run_jsx(COMP_JS + f"""var c = findComp({js(comp)});
app.beginUndoGroup("Motion DNA solid transition");
var ctrl; try {{ ctrl = {call}; }} finally {{ app.endUndoGroup(); }}
if (typeof ctrl === "string") return ctrl + " (clip to clip: both layers are trimmed at the cut and keyed with token curves)";
return ctrl.name + ": covers the frame at " + {at} + " s (Progress 50), from " + ctrl.inPoint.toFixed(2) + " to " + ctrl.outPoint.toFixed(2) +
  " s. Edit Direction, Stagger, Ease In / Ease Out (token curves) and Color 1-3 on the controller.";""", includes=("ss_presets.jsx", "ss_behaviors.jsx", "ss_looks.jsx", "ss_transitions.jsx")) + \
        ("" if outgoing or incoming else "\nPlace it on a cut: the clip below should change at that time (or pass outgoing/incoming to trim them).")


def _brand_colors(brand):
    b = _brand.load(brand)
    return [v for v in (b.get("identity", {}).get("colors") or {}).values() if str(v).startswith("#")]


def t_add_element(kind, text=None, sub=None, layer=None, point=None, comp=None, t=None, out=None, colors=None, brand=None,
                  size=None, position=None, padding=None, radius=None, text_preset=None, items=None, value=None, start=None,
                  style=None, mode=None, outline=None, slot=None, click=None, pressed=None, prefix=None, suffix=None, decimals=None, width=None, pressed_box=None, logo=None):
    """Self-sizing graphic elements (tools/ss_elements.jsx): label, lower_third, title, underline, highlight, callout."""
    cols = {}
    if colors:
        cols = dict(zip(("box", "accent", "text"), colors))
    elif brand:
        b = _brand.load(brand); vals = [v for v in (b.get("identity", {}).get("colors") or {}).values() if str(v).startswith("#")]
        cols = dict(zip(("box", "accent", "text"), vals[:3]))
        f = b.get("identity", {}).get("fonts") or {}
    o = {k: v for k, v in dict(t=t, out=out, colors=cols or None, size=size, position=position, padding=padding, radius=radius,
                               textPreset=text_preset, style=style, mode=mode, outline=outline, slot=slot, click=click, prefix=prefix,
                               suffix=suffix, decimals=decimals, width=width, pressedBox=pressed_box, logo=str((ROOT / logo).as_posix()) if logo and not pathlib.Path(logo).is_absolute() else logo, layer=layer if kind == "media" else None).items() if v is not None}
    if brand and colors is None:
        fonts = {k: [f[k]] for k in ("title", "text") if f.get(k)}
        if f.get("accent"): fonts["display"] = [f["accent"]]
        if fonts: o["fonts"] = fonts
    at = "c.time" if t is None else None
    if at: o_js = js(o)[:-1] + (", " if o else "") + '"t": c.time}'
    else: o_js = js(o)
    end_o = js(dict(o, t=t, text=text or "Motion DNA", **({"tagline": sub} if sub else {}), **({"layout": "horizontal"} if style == "horizontal" else {}))) if t is not None else js(dict(o, text=text or "Motion DNA", **({"tagline": sub} if sub else {}), **({"layout": "horizontal"} if style == "horizontal" else {})))[:-1] + ', "t": c.time}'
    calls = {"label": f"SSE.label(c, {js(text)}, {o_js})", "lower_third": f"SSE.lowerThird(c, {js(text)}, {js(sub)}, {o_js})",
             "title": f"SSE.title(c, {js(text)}, {js(sub)}, {o_js})", "underline": f"SSE.underline(c, {js(layer)}, {o_js})",
             "highlight": f"SSE.highlight(c, {js(layer)}, {o_js})", "callout": f"SSE.callout(c, {js(text)}, {js(point or [0, 0])}, {o_js})",
             "counter": f"SSE.counter(c, {js(start or 0)}, {js(value if value is not None else 100)}, {o_js})", "timer": f"SSE.timer(c, {js(value or 0)}, {o_js})",
             "price_tag": f"SSE.priceTag(c, {js(text)}, {js(sub)}, {o_js})", "handle": f"SSE.handle(c, {js(text)}, {o_js})",
             "bubble": f"SSE.bubble(c, {js(text)}, {o_js})", "sticker": f"SSE.sticker(c, {js(text)}, {o_js})",
             "quote": f"SSE.quote(c, {js(text)}, {js(sub)}, {o_js})", "list": f"SSE.list(c, {js(items or [])}, {o_js})",
             "progress": f"SSE.progress(c, {js(value if value is not None else 70)}, {o_js})", "button": f"SSE.button(c, {js(text)}, {js(pressed)}, {o_js})",
             "kinetic": f"SSE.kinetic(c, {js(items or [])}, {o_js})", "tiles": f"SSE.tiles(c, {js(text)}, {o_js})",
             "text_box": f"SSE.textbox(c, {js(text)}, {js(sub)}, {o_js})", "media": f"SSE.media(c, {js(text)}, {o_js})",
             "scale_title": f"SSE.scaleTitle(c, {js(text)}, {js(sub)}, {o_js})", "cinematic": f"SSE.cinematic(c, {js(text)}, {o_js})",
             "chat": f"SSE.chat(c, {js(text)}, {o_js})", "rating": f"SSE.rating(c, {js(value if value is not None else 5)}, {o_js})",
             "ring": f"SSE.ring(c, {js(value if value is not None else 70)}, {o_js})",
             "end_card": f"SSE.endCard(c, {end_o})",
             "glass_card": f"{{name: SSL.glassCard(c, {js(text)}, {js(sub)}, {o_js}), inPoint: c.time, outPoint: c.duration}}"}
    if kind not in calls:
        return "unknown kind: " + kind + " (" + ", ".join(calls) + ")"
    if kind in ("underline", "highlight") and not layer:
        return kind + " needs layer: the name of an existing text layer"
    if kind == "callout" and not point:
        return "callout needs point: [x, y] in comp pixels"
    return run_jsx(COMP_JS + f"""var c = findComp({js(comp)});
app.beginUndoGroup("Motion DNA element: {kind}");
var ctrl; try {{ ctrl = {calls[kind]}; }} finally {{ app.endUndoGroup(); }}
return ctrl.name + " built (" + ctrl.inPoint.toFixed(2) + "-" + ctrl.outPoint.toFixed(2) + " s). Restyle it on the controller: Reveal, Padding X/Y, Radius, Gap, Box/Accent/Text colours.";""",
                   includes=("ss_presets.jsx", "ss_shapes.jsx", "ss_behaviors.jsx", "ss_looks.jsx", "ss_elements.jsx")) + "\nCheck it with render_frame and check_layout (text must not touch other objects)."


def t_add_shape(kind, comp=None, t=None, out=None, position=None, size=None, stroke=None, style=None, anim=None, ease=None, dur=None,
                colors=None, brand=None, count=None, loop=None, spread=None, angle=None, mirror=None, item=None, hold=None):
    """Animated shape primitives, lines and AC Shape-Elements families (tools/ss_shapes.jsx)."""
    cols = colors or ((_brand_colors(brand)[1:3] or None) if brand else None)
    o = {k: v for k, v in dict(t=t, out=out, position=position, size=size, stroke=stroke, style=style, anim=anim, ease=ease, dur=dur, colors=cols,
                               count=count, loop=loop, spread=spread, angle=angle, mirror=mirror, item=item, hold=hold).items() if v is not None}
    o_js = js(o) if t is not None else js(o)[:-1] + (", " if o else "") + '"t": c.time}'
    return run_jsx(COMP_JS + f"""var c = findComp({js(comp)});
app.beginUndoGroup("Motion DNA shape: {kind}");
var L; try {{ L = SSS.add(c, {js(kind)}, {o_js}); }} finally {{ app.endUndoGroup(); }}
return L.name + " (" + L.comment.replace("SS shape: ", "") + "), in at " + L.inPoint.toFixed(2) + " s. Controls on the layer: Reveal, Size, Stroke, Color 1/2.";""",
                   includes=("ss_presets.jsx", "ss_behaviors.jsx", "ss_shapes.jsx"))


def t_move(move, layers=None, comp=None, phase="in", t=None, dur=None, ease=None, axis=None, edge=None, direction=None, origin=None,
           distance=None, angle=None, fade=None, uniform=None):
    """Parametric 2D/3D entrances and exits (tools/ss_moves.jsx): flip, hinge, orbit, fly, tumble, grow_edge, squash."""
    o = {k: v for k, v in dict(dur=dur, ease=ease, axis=axis, edge=edge, direction=direction, distance=distance, angle=angle, fade=fade,
                               uniform=uniform, **({"from": origin} if origin else {})).items() if v is not None}
    return run_jsx(COMP_JS + f"""var c = findComp({js(comp)}), ls = findLayers(c, {js(layers or [])}), r = [];
app.beginUndoGroup("Motion DNA move: {move}");
try {{ for (var i = 0; i < ls.length; i++) r.push(SSMV.apply(ls[i], {js(move)}, {js(phase)}, {js(t)}, {js(o)})); }} finally {{ app.endUndoGroup(); }}
return r.join("\\n");""", includes=("ss_presets.jsx", "ss_keyframes.jsx", "ss_moves.jsx"))


def t_animate_text(layers=None, comp=None, unit="chars", channels=None, mode=None, order=None, phase="in", t=None, dur=None, ease=None,
                   spread=None, amount=None, color=None, mask=None, typewriter=None, cps=None, cursor=None):
    """Per-character / word / line text animation on token curves (tools/ss_text.jsx), or a typewriter with a cursor."""
    if typewriter:
        o = {k: v for k, v in dict(t=t, cps=cps, cursor=cursor).items() if v is not None}
        call = f"SSTX.typewriter(ls[i], {js(o)})"
    else:
        o = {k: v for k, v in dict(unit=unit, channels=channels or ["fade", "rise"], mode=mode, order=order, phase=phase, t=t, dur=dur, ease=ease,
                                   spread=spread, amount=amount, color=color, mask=mask).items() if v is not None}
        call = f"SSTX.animate(ls[i], {js(o)})"
    return run_jsx(COMP_JS + f"""var c = findComp({js(comp)}), ls = findLayers(c, {js(layers or [])}), r = [];
app.beginUndoGroup("Motion DNA text animation");
try {{ for (var i = 0; i < ls.length; i++) if (ls[i] instanceof TextLayer) r.push({call}); }} finally {{ app.endUndoGroup(); }}
return r.length ? r.join("\\n") : "No text layer among the named or selected layers";""", includes=("ss_text.jsx",))


def t_add_look(kind, comp=None, layer=None, t=None, dur=None, colors=None, brand=None, amount=None, length=None, angle=None, color=None,
               ratio=None, speed=None, count=None, particle_color=None):
    """Backgrounds, finishing looks, long shadow and glitch (tools/ss_looks.jsx)."""
    cols = colors or (_brand_colors(brand) if brand else None)
    bgs = ("stripes", "dots", "grid", "gradient", "liquid", "topo", "network", "blobs", "mesh", "glass")
    if kind in bgs:
        o = {k: v for k, v in dict(colors=cols, speed=speed, t=t).items() if v is not None}
        call = f"var r = SSL.background(c, {js(kind)}, {js(o)}).name;"
    elif kind == "long_shadow":
        if not layer: return "long_shadow needs layer"
        o = {k: v for k, v in dict(length=length, angle=angle, color=color or (cols[0] if cols else None)).items() if v is not None}
        call = f"var r = SSL.longShadow(c, {js(layer)}, {js(o)});"
    elif kind == "glitch":
        if not layer: return "glitch needs layer"
        o = {k: v for k, v in dict(t=t, dur=dur, amount=amount).items() if v is not None}
        call = f"var r = SSL.glitch(c, {js(layer)}, {js(o)});"
    else:
        o = {k: v for k, v in dict(colors=cols, amount=amount, ratio=ratio, t=t, dur=dur, count=count, particleColor=particle_color).items() if v is not None}
        call = f"var r = SSL.look(c, {js(kind)}, {js(o)});"
    return run_jsx(COMP_JS + f"""var c = findComp({js(comp)});
app.beginUndoGroup("Motion DNA look: {kind}");
try {{ {call} }} finally {{ app.endUndoGroup(); }}
return r;""", includes=("ss_presets.jsx", "ss_behaviors.jsx", "ss_looks.jsx"))


def t_add_captions(words=None, words_path=None, srt_path=None, comp=None, style="highlight", size=None, position=None, colors=None, brand=None,
                   box=None, stroke=None, max_chars=None):
    """Captions from word timings ([{w, s, e}], tools/vo_words.py) or an SRT file, styled (tools/ss_text.jsx)."""
    if words_path:
        words = json.loads(pathlib.Path(words_path).read_text(encoding="utf-8"))
    elif srt_path:   # cues → words spread evenly over each cue
        import re
        words = []
        for blk in re.split(r"\n\s*\n", pathlib.Path(srt_path).read_text(encoding="utf-8-sig").strip()):
            ls = blk.strip().splitlines()
            tm = next((x for x in ls if "-->" in x), None)
            if not tm: continue
            def sec(x):
                h, mm, rest = x.strip().replace(",", ".").split(":"); return int(h) * 3600 + int(mm) * 60 + float(rest)
            a, b = [sec(x) for x in tm.split("-->")]
            txt = " ".join(ls[ls.index(tm) + 1:]).split()
            for i, w in enumerate(txt):
                words.append({"w": w, "s": round(a + (b - a) * i / len(txt), 3), "e": round(a + (b - a) * (i + 1) / len(txt), 3)})
    if not words:
        return "give words ([{w, s, e}]), words_path (tools/vo_words.py output) or srt_path"
    c = {}
    if colors: c = dict(zip(("text", "accent", "box"), colors))
    elif brand:
        v = _brand_colors(brand); c = {"text": v[2] if len(v) > 2 else "#FFFFFF", "accent": v[1] if len(v) > 1 else "#D8FF85", "box": v[0] if v else "#000000"}
    o = {k: v for k, v in dict(style=style, size=size, position=position, colors=c or None, box=box, stroke=stroke, maxChars=max_chars).items() if v is not None}
    return run_jsx(COMP_JS + f"""var c = findComp({js(comp)});
app.beginUndoGroup("Motion DNA captions");
var r; try {{ r = SSTX.captions(c, {js(words)}, {js(o)}); }} finally {{ app.endUndoGroup(); }}
return r;""", includes=("ss_text.jsx",))


def t_add_behavior(behavior=None, target="shape", comp=None, t=None, out=None, at_s=None, layer=None, layers=None, element=None, colors=None,
                   brand=None, count=None, seed=None, origin=None, speed=None, size=None, stroke=None, goo=None, dur=None, ease=None,
                   box=None, amount=None, step=None, ease_in=None, ease_out=None, spread=None):
    """Behaviours (tools/ss_behaviors.jsx): an algorithm drawn into a target. No behavior: list them by family."""
    rows = [b for b in json.loads((ROOT / "library" / "kit.json").read_text(encoding="utf-8"))["items"] if b["kind"] == "behavior"]
    if not behavior:
        return "\n".join(f"{fam} · {b['name']} [targets: {', '.join(b['targets'])}] (energy {b['energy'][0]}-{b['energy'][1]}, {'/'.join(b['tones'])}): {b['use']}"
                         + (f"\n    pairs well with: {'; '.join(b['pairs'])}" if b.get("pairs") else "")
                         for fam in ("fill", "swarm", "physics", "modifier") for b in rows if b.get("family") == fam)
    known = {b["name"]: b for b in rows}
    if behavior not in known:
        return f"unknown behavior: {behavior} ({', '.join(known)})"
    tg = "mask" if target == "text" else target
    if tg not in known[behavior]["targets"]:
        why = (known[behavior].get("avoid") or {}).get(tg)
        return (f"{behavior} does not pass on {target}" + (f" ({why})" if why else "") + f": use one of {', '.join(known[behavior]['targets'])}"
                + (f". Pairs well with: {'; '.join(known[behavior]['pairs'])}" if known[behavior].get("pairs") else ""))
    cols = colors or (_brand_colors(brand) if brand else None)
    o = {k: v for k, v in dict(t=t, out=out, layer=layer, layers=layers, element=element, colors=cols, count=count, seed=seed, origin=origin,
                               speed=speed, size=size, stroke=stroke, goo=goo, dur=dur, ease=ease, box=box, amount=amount, step=step,
                               ease_in=ease_in, ease_out=ease_out, spread=spread).items() if v is not None}
    if tg == "transition":
        at = "c.time" if at_s is None else str(float(at_s))
        o["behavior"] = behavior
        call = (f'var R = SST.add(c, "behavior", {at}, {js(o)});\n'
                f'var r = R.name + ": covers the frame at " + {at} + " s (Progress 50), " + R.inPoint.toFixed(2) + "-" + R.outPoint.toFixed(2) + '
                '" s. Edit Progress, Stagger, Ease In / Ease Out and Color 1-3 on the controller.";')
    else:
        o_js = js(o)[:-1] + (", " if o else "") + '"t": c.time}' if (tg in ("shape", "mask") and t is None) else js(o)
        call = f'var R = SSB.add(c, {js(behavior)}, {js(tg)}, {o_js}); var r = typeof R === "string" ? R : R.name + " (" + R.comment.replace(/^SS [a-z]+: /, "") + ")";'
    return run_jsx(COMP_JS + f"""var c = findComp({js(comp)});
app.beginUndoGroup("Motion DNA behavior: {behavior} on {target}");
try {{ {call} }} finally {{ app.endUndoGroup(); }}
return r;""", includes=("ss_presets.jsx", "ss_behaviors.jsx", "ss_looks.jsx", "ss_transitions.jsx")) + ("\nCheck it with render_frame." if tg != "layer" else "")


def t_list_kit(kind=None, energy=None, tone=None, query=None):
    """The building blocks beyond presets: elements, shapes, moves, text channels, looks, backgrounds and transitions."""
    kit = json.loads((ROOT / "library" / "kit.json").read_text(encoding="utf-8"))
    rows = []
    for it in kit["items"]:
        if kind and it["kind"] != kind: continue
        if energy and not (it["energy"][0] <= energy <= it["energy"][1]): continue
        if tone and tone not in it["tones"]: continue
        if query and query.lower() not in json.dumps(it).lower(): continue
        rows.append(f"[{it['kind']}] {it['name']} (energy {it['energy'][0]}-{it['energy'][1]}, {'/'.join(it['tones'])}): {it['use']} -> {it['call']}")
    tr = json.loads((ROOT / "library" / "transitions.json").read_text(encoding="utf-8"))["transitions"]
    if not kind or kind == "transition":
        for x in tr:
            if energy and not (x["energy"][0] <= energy <= x["energy"][1]): continue
            if tone and tone not in x["tones"]: continue
            if query and query.lower() not in json.dumps(x).lower(): continue
            rows.append(f"[transition] {x['name']} ({x['type']}, energy {x['energy'][0]}-{x['energy'][1]}, {'/'.join(x['tones'])}): {x['use']} -> solid_transition(look=\"{x['name']}\")")
    return "\n".join(rows) if rows else "no match · kinds: element, shape, move, text, look, background, transition"


def _tags():
    return json.loads((ROOT / "library" / "tags.json").read_text(encoding="utf-8"))


def t_list_tags(role=None, target=None, tone=None, energy=None, kind=None):
    """Presets, curves and techniques with their tags, filtered. energy: a level 1-5 the preset's range must include."""
    t, out = _tags(), []
    for p in t["presets"]:
        if role and role not in p["roles"]: continue
        if target and target not in p["targets"]: continue
        if tone and tone not in p["tones"]: continue
        if kind and kind != p["kind"]: continue
        if energy and not (p["energy"][0] <= int(energy) <= p["energy"][1]): continue
        out.append(f'{p["kind"]}|{p["name"]}|roles {"/".join(p["roles"])}|targets {"/".join(p["targets"])}|channels {"/".join(p["channels"])}|'
                   f'dir {p["direction"]}|energy {p["energy"][0]}-{p["energy"][1]}|tones {"/".join(p["tones"])}')
    out.append("# curves: " + "; ".join(f'{c["name"]} ({c["family"]}, energy {c["energy"][0]}-{c["energy"][1]}, {"/".join(c["tones"])})' for c in t["curves"]))
    out.append("# techniques: " + "; ".join(f'{c["name"]} (energy {c["energy"][0]}-{c["energy"][1]}, needs {"/".join(c["needs"]) or "-"})' for c in t["techniques"]))
    out.append(f'# energy scale: {t["energy_scale"]} · tones: {", ".join(t["tones"])} (open vocabulary: add new tones in tools/tag_library.py)')
    return "\n".join(out)


def t_match_reference(profile_path=None, profile_json=None):
    """Compare a reference profile (library/references/_schema.md) with the library: what fits, how to build each move, gaps."""
    import contextlib
    import importlib
    import io
    sys.path.insert(0, str(ROOT / "tools"))
    mr = importlib.import_module("match_reference")
    if profile_json:
        data = json.loads(profile_json) if isinstance(profile_json, str) else profile_json
        path = ROOT / "library" / "references" / f'{data.get("slug") or "reference"}.json'
        path.write_text(json.dumps(data, indent=1, ensure_ascii=False), encoding="utf-8")
    else:
        path = pathlib.Path(profile_path)
        if not path.is_absolute():
            path = ROOT / path
    buf = io.StringIO()
    with contextlib.redirect_stdout(buf):
        gaps = mr.main(str(path))
    return buf.getvalue() + f'\n(gaps saved to research/references/{gaps["reference"]}.gaps.json)'


def t_suggest_mix(role="enter", target="title", tones=None, energy=None, avoid=None, limit=5):
    """Ranked combinations move x curve x duration for a layer role/target and a feel (tones, energy 1-5)."""
    t = _tags()
    tones, avoid = tones or [], avoid or []
    e = max(1, min(5, int(energy) if energy else 3))
    timing = t["timing"][str(e)]
    moves = []
    for p in t["presets"]:
        if role not in p["roles"] or target not in p["targets"] or p["name"] in avoid or set(p["tones"]) & set(avoid):
            continue
        sc = (2 if p["energy"][0] <= e <= p["energy"][1] else -abs(e - sum(p["energy"]) / 2)) + len(set(p["tones"]) & set(tones))
        moves.append((sc, p))
    moves.sort(key=lambda x: -x[0])
    curves = sorted((((2 if c["energy"][0] <= e <= c["energy"][1] else -1) + len(set(c["tones"]) & set(tones)), c["name"]) for c in t["curves"]
                     if c["family"] not in avoid and c["name"] not in avoid), key=lambda x: -x[0])
    cv = [c for _, c in curves[:2]]
    lines = [f"duration tokens for energy {e}: {', '.join(timing)} · curves for this feel: {', '.join(cv)}"]
    for sc, p in moves[:limit]:
        lines.append(f'{p["name"]} ({p["kind"]}, tones {"/".join(p["tones"])}, energy {p["energy"][0]}-{p["energy"][1]}) -> '
                     f'apply_preset(preset="{p["name"]}", ease="{cv[0]}")')
    if role == "transition":   # the named solid/clip transitions (library/transitions.json) fit the same feel
        looks = json.loads((ROOT / "library" / "transitions.json").read_text(encoding="utf-8"))["transitions"]
        ranked = sorted(((2 if l["energy"][0] <= e <= l["energy"][1] else -1) + len(set(l["tones"]) & set(tones)), l["name"], l.get("clip_to_clip"))
                        for l in looks if l["name"] not in avoid)
        for sc, name, clip in sorted(ranked, key=lambda x: -x[0])[:3]:
            lines.append(f'{name} (named transition{", clip to clip" if clip else ""}) -> solid_transition(look="{name}"' + (', outgoing=…, incoming=…' if clip else '') + ')')
        return "\n".join(lines)
    return "\n".join(lines) if moves else "No preset for that role/target: it is a gap (create it, see CONTRIBUTING.md §8)."


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


def t_list_resources(category=None, query=None, commercial_only=True, no_attribution=False, include_excluded=False, limit=40):
    """The catalog of outside resources (library/resources.json): what exists, its license, how to get it, when to use it."""
    data = json.loads((ROOT / "library" / "resources.json").read_text(encoding="utf-8"))
    q = (query or "").lower(); out = []
    for r in data["resources"]:
        if category and r["category"] != category:
            continue
        if r["status"] == "excluded" and not include_excluded:
            continue
        if commercial_only and r.get("commercial_ok") is False:
            continue
        if no_attribution and r.get("attribution_required"):
            continue
        if q and q not in json.dumps(r, ensure_ascii=False).lower():
            continue
        out.append(f"[{r['category']}] {r['name']} ({r['status']}) · {r['license']}" + (" · credit required" if r.get("attribution_required") else "") +
                   (" · can live in the repo" if r.get("vendor_in_repo") else " · local only") + f" · {r['access']} · {r['url']}\n  use: {r['claude_use']}" +
                   (f"\n  why: {r['reason']}" if r.get("reason") else "") +
                   (f"\n  already here: {r['in_repo']} (list_assets / add_asset)" if r.get("in_repo") else ""))
    if not out:
        return "no match · categories: " + ", ".join(sorted({r["category"] for r in data["resources"]}))
    return "\n".join(out[:limit]) + (f"\n… {len(out) - limit} more" if len(out) > limit else "")


def t_ae_status():
    if not ae_running():
        return "After Effects is not running."
    return run_jsx("""var a = app.project.activeItem;
return "AE " + app.version + " · project: " + (app.project.file ? app.project.file.name : "unsaved") +
  " · active: " + (a instanceof CompItem ? a.name + " (" + a.width + "x" + a.height + ", " + a.duration.toFixed(2) + "s, " + a.numLayers + " layers, selected: " + a.selectedLayers.length + ")" : "none") +
  " · panel: " + ($.global.MDNA_CEP ? "loaded (Window > Extensions > Motion DNA)" : (typeof SS_PANEL !== "undefined" ? "loaded (legacy Window > Motion DNA.jsx)" : "not loaded")) +
  (function () { try { var m = app.fonts.missingOrSubstitutedFonts, n = []; for (var i = 0; i < m.length; i++) n.push(m[i].postScriptName);
    return n.length ? " · WARNING fonts substituted (" + n.join(", ") + "): restart After Effects before building" : " · fonts ok"; } catch (e) { return ""; } })();""", includes=())


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
                   duration=1.0, intensity=1.0, direction="as designed", ease=None, existing="modify"):
    kind = kind_of(preset)
    call = {"text": f"SSP.applyText(L, {js(preset)}, {js(phase)}, t0)", "fx": f"SSP.applyFx(L, {js(preset)})",
            "recipe": f"SSP.applyRecipe(L, {js(preset)}, {js(phase)})"}.get(kind, f"SSP.apply(L, {js(preset)}, {js(phase)}, t0)")
    return run_jsx(COMP_JS + f"""var c = findComp({js(comp)}), ls = findLayers(c, {js(layers or [])}), st = {float(stagger_frames)} * c.frameDuration, done = [];
SSP.markerTiming({str(bool(marker_timing)).lower()}); {tune_js(duration, intensity, direction, ease)}
app.beginUndoGroup("Motion DNA (MCP): {preset}");
try {{ for (var i = 0; i < ls.length; i++) {{ var L = ls[i], t0 = ({js(phase)} === "out" ? L.outPoint - SSM.seconds("Arrive") : L.inPoint) + i * st;
  if ({js(kind)} === "fx") {{ {call}; done.push(L.name); continue; }}
  var how = SSP.smartApply(L, {js(preset)}, {js(existing)}, (function (L, t0) {{ return function () {{ {call}; }}; }})(L, t0));
  done.push(L.name + (how === "generated" ? "" : " (" + how + ")")); }} }}
finally {{ SSP.markerTiming(false); SSP.tune(); app.endUndoGroup(); }}
return "{preset} ({kind}, {phase}) → " + done.join(", ");""")


def t_keyframes(action, layers=None, comp=None, frames=None, order=None, type=None, factor=None, which=None, at_s=None, source=None):
    """Keyframe toolkit (tools/ss_keyframes.jsx) on named or selected layers."""
    args = {"reverse": "SSK.reverse(ls)",
            "mirror_out": f"SSK.mirrorOut(ls, {js(frames or 0)})",
            "stagger": f"SSK.stagger(ls, {js(3 if frames is None else frames)}, {js(order)})",
            "shift": f"SSK.shift(ls, {js((frames or 0))} * c.frameDuration)",
            "to_playhead": f"SSK.toPlayhead(ls, {js(which or 'start')}, {js(at_s)})",
            "sequence": f"SSK.sequence(ls, {js(frames or 0)})",
            "distribute": "SSK.distribute(ls)",
            "loop": f"SSK.loop(ls, {js(type or 'cycle')})",
            "bake": "SSK.bake(ls)",
            "stretch": f"SSK.stretch(ls, {js(factor or 1.0)})",
            "copy_to": f"SSK.copyTo(c.layer({js(source)}), ls, false)",
            "ease": f"SSK.ease(ls, {js(type or 'Settle')})",
            "copy_ease": f"SSK.copyEase(c.layer({js(source)}), ls)",
            "randomize": f"SSK.randomize(ls, {js(frames or 4)})"}
    if action not in args:
        return "unknown action: " + action + " (use " + ", ".join(args) + ")"
    return run_jsx(COMP_JS + f"""var c = findComp({js(comp)}), ls = findLayers(c, {js(layers or [])});
app.beginUndoGroup("Motion DNA keyframes: {action}");
try {{ return {args[action]}; }} finally {{ app.endUndoGroup(); }}""", includes=("ss_presets.jsx", "ss_keyframes.jsx"))


def t_anchor_point(where="center", layers=None, comp=None):
    return run_jsx(COMP_JS + f"""var c = findComp({js(comp)}), ls = findLayers(c, {js(layers or [])}), o = [];
app.beginUndoGroup("Motion DNA anchor point");
try {{ for (var i = 0; i < ls.length; i++) o.push(SSK.anchor(ls[i], {js(where)})); }} finally {{ app.endUndoGroup(); }}
return o.join("\\n");""", includes=("ss_presets.jsx", "ss_keyframes.jsx"))


def t_remove_animation(layers=None, comp=None):
    return run_jsx(COMP_JS + f"""var c = findComp({js(comp)}), ls = findLayers(c, {js(layers or [])}), n = 0, done = [];
app.beginUndoGroup("Motion DNA (MCP): remove");
try {{ for (var i = 0; i < ls.length; i++) {{ n += SSP.remove(ls[i]); done.push(ls[i].name); }} }} finally {{ app.endUndoGroup(); }}
return "cleared " + n + " properties on " + done.join(", ");""")


def t_apply_pack(pack, comp=None, layers=None, phase="both", marker_timing=True, duration=1.0, intensity=1.0, existing="modify"):
    return run_jsx(COMP_JS + f"""var c = findComp({js(comp)}), names = {js(layers or [])}, ls = null;
if (names.length) ls = findLayers(c, names);
SSP.markerTiming({str(bool(marker_timing)).lower()}); {tune_js(duration, intensity)}
app.beginUndoGroup("Motion DNA style (MCP): {pack}");
var r; try {{ r = SSP.applyPack(c, {js(pack)}, ls, {js(phase)}, {js(existing)});
  var mods = {js(_pack_modifiers(pack))};   // style modifiers from packs.json (e.g. Collage: line_boil, the hand-drawn tremble)
  for (var m = 0; m < mods.length; m++) {{ var tg = [], pool = ls;
    if (!pool) {{ pool = []; for (var i = 1; i <= c.numLayers; i++) pool.push(c.layer(i)); }}
    for (var j = 0; j < pool.length; j++) {{ var L = pool[j];
      if ((L instanceof ShapeLayer || L instanceof TextLayer) && L.enabled && !/^(BG|LK|TR|GL) · /.test(L.name) && String(L.comment).indexOf("line boil") < 0) tg.push(L.name); }}
    if (tg.length) r.push(SSB.add(c, mods[m], "layer", {{layers: tg}})); }}
}} finally {{ SSP.markerTiming(false); SSP.tune(); app.endUndoGroup(); }}
return r.length ? r.join("\\n") : "No layers matched";""", includes=("ss_presets.jsx", "ss_assets.jsx", "ss_behaviors.jsx"))


def _pack_modifiers(pack):
    """Style modifiers a pack carries in library/packs.json ("modifiers": ["line_boil"]): applied after its presets."""
    for x in json.loads((ROOT / "library" / "packs.json").read_text(encoding="utf-8"))["packs"]:
        if pack.lower() in (x["name"].lower(), x.get("slug", "")):
            return x.get("modifiers", [])
    return []


def t_add_asset(name, type="sfx", time_s=None, gain_db=-9, opacity=70, comp=None, blend=None, scale=None):
    at = "c.time" if time_s is None else str(float(time_s))
    call = {"sfx": f"SSA.sfx(c, {js(name)}, {at}, {float(gain_db)})", "music": f"SSA.sfx(c, {js(name)}, {at}, {float(gain_db)})",
            "vfx": f"SSA.vfx(c, {js(name)}, {at}, {js(blend)}, {js(scale)})"}.get(type, f"SSA.overlay(c, {js(name)}, {at}, {js(blend)}, {float(opacity)})")
    return run_jsx(COMP_JS + f"""var c = findComp({js(comp)}); app.beginUndoGroup("SS asset (MCP)"); var L = {call}; app.endUndoGroup(); return "added " + L.name + " at " + {at};""")


def t_show_in_panel(kind, name):
    return run_jsx(f"""if (typeof SS_PANEL === "undefined") return $.global.MDNA_CEP ? "The Motion DNA panel (Window > Extensions > Motion DNA) cannot be driven from a script yet: tell the user which preset to pick." : "Motion DNA panel is not open (Window > Extensions > Motion DNA)"; return SS_PANEL.select({js(kind)}, {js(name)});""", includes=())


def t_render_frame(time_s=None, comp=None):
    out = (ROOT / "research" / "mcp" / f"frame_{int(time.time() * 1000)}.png")
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


def t_apply_transition(preset, outgoing, incoming, comp=None, at_s=None, duration=1.0, intensity=1.0):
    return run_jsx(COMP_JS + f"""var c = findComp({js(comp)}), A = findLayers(c, [{js(outgoing)}])[0], B = findLayers(c, [{js(incoming)}])[0];
{tune_js(duration, intensity)}
app.beginUndoGroup("Motion DNA transition (MCP): {preset}");
var t; try {{ t = SSP.applyTransition(c, A, B, {js(preset)}, {js(at_s)}); }} finally {{ SSP.tune(); app.endUndoGroup(); }}
return A.name + " leaves as " + B.name + " arrives: " + {js(preset)} + " at " + t.toFixed(2) + " s";""")


def t_matte(source, out=None, size="1920x1080", fps=24, import_to_comp=None):
    """Cuts the subject out of a still or a video with tools/video_matte.py in ComfyUI's Python (local GPU, no cost)."""
    src = pathlib.Path(source)
    if not src.exists():
        return f"not found: {source}"
    still = src.suffix.lower() in (".jpg", ".jpeg", ".png", ".webp", ".tif", ".tiff")
    dst = pathlib.Path(out) if out else src.with_name(src.stem + ("_cutout.png" if still else "_matte.mov"))
    py = pathlib.Path(os.environ.get("SS_COMFY_PORTABLE", r"D:\ComfyUI_windows_portable_nvidia\ComfyUI_windows_portable")) / "python_embeded" / "python.exe"
    if not py.exists():
        return f"ComfyUI's Python not found at {py}: set SS_COMFY_PORTABLE to the ComfyUI portable folder"
    args = [str(py), str(ROOT / "tools" / "video_matte.py"), str(src), str(dst)] + ([] if still else ["--size", size, "--fps", str(fps)])
    r = subprocess.run(args, capture_output=True, text=True, encoding="utf-8", errors="replace", timeout=1800)
    if r.returncode != 0 or not dst.exists():
        return "matte failed: " + (r.stderr or r.stdout)[-800:]
    msg = f"matte: {dst.as_posix()}"
    if import_to_comp:
        msg += "\n" + run_jsx(COMP_JS + f"""var c = findComp({js(import_to_comp)}), it = app.project.importFile(new ImportOptions(new File({js(dst.as_posix())})));
var L = c.layers.add(it); L.name = {js(src.stem + (" cutout" if still else " matte"))};
var s = Math.min(c.width / it.width, c.height / it.height) * 100; L.property("ADBE Transform Group").property("ADBE Scale").setValue([s, s, 100]);
return "imported as layer " + L.index + " (" + L.name + ") in " + c.name;""")
    return msg


def t_text_behind(subject, text, comp=None):
    """Text behind a person or product: mattes the subject's footage, then puts the cut-out above the text, parented to
    the subject so it follows its moves (still or video)."""
    info = run_jsx(COMP_JS + f"""var c = findComp({js(comp)}), S = findLayers(c, [{js(subject)}])[0];
if (!(S.source instanceof FootageItem) || !S.source.file) throw new Error(S.name + " is not footage from a file");
return S.source.file.fsName.split("\\\\").join("/") + "|" + S.source.width + "x" + S.source.height + "|" + (S.source.frameRate || 24);""")
    if "|" not in info:
        return info
    path, size, fps = info.strip().split("|")[:3]
    still = pathlib.Path(path).suffix.lower() in (".jpg", ".jpeg", ".png", ".webp", ".tif", ".tiff")
    out = pathlib.Path(path).with_name(pathlib.Path(path).stem + ("_cutout.png" if still else "_matte.mov"))
    if not out.exists():
        r = t_matte(path, str(out), size=size, fps=float(fps))
        if not r.startswith("matte:"):
            return r
    return run_jsx(COMP_JS + f"""var c = findComp({js(comp)}), S = findLayers(c, [{js(subject)}])[0], T = findLayers(c, [{js(text)}])[0];
app.beginUndoGroup("Motion DNA: text behind " + S.name);
try {{
  if (T.index > S.index) T.moveBefore(S);   // the text sits above the subject...
  var it = app.project.importFile(new ImportOptions(new File({js(out.as_posix())}))), K = c.layers.add(it);
  K.name = S.name + " cut-out"; K.moveBefore(T);   // ...and the cut-out above the text
  K.parent = S; var tg = K.property("ADBE Transform Group");
  tg.property("ADBE Anchor Point").setValue([it.width / 2, it.height / 2]); tg.property("ADBE Position").setValue([S.source.width / 2, S.source.height / 2]);
  tg.property("ADBE Scale").setValue([S.source.width / it.width * 100, S.source.height / it.height * 100]); tg.property("ADBE Rotate Z").setValue(0);
  K.startTime = S.startTime; K.inPoint = S.inPoint; K.outPoint = S.outPoint;
}} finally {{ app.endUndoGroup(); }}
return T.name + " is behind " + S.name + ": cut-out layer " + K.index + " (" + K.name + "), parented to the subject. Check a frame where they overlap.";""")


def t_check_layout(comps=None):
    names = comps or []
    return run_jsx(COMP_JS + f"""var names = {js(names)};
if (!names.length) {{ var c = findComp(null); names = [c.name]; }}
$.global.QA_COMPS = names; QA_COMPS = names;
return String($.evalFile(new File(SS_ROOT + "/tools/check_layout.jsx")));""", timeout=300)


def t_resize_comp(comp=None, sizes=None, mode=None, safe=None, suffix=None, check=True):
    """Social resizes (tools/ss_resize.jsx): duplicates the comp per size, keeps every keyframe, reframes on rig nulls, then
    runs the layout QA on each new comp."""
    o = {k: v for k, v in dict(mode=mode, safe=safe, suffix=suffix).items() if v is not None}
    res = run_jsx(COMP_JS + f"""var c = findComp({js(comp)}), r;
app.beginUndoGroup("Motion DNA: social resizes");
try {{ r = SSRZ.resize(c, {js(sizes or [])}, {js(o)}); }} finally {{ app.endUndoGroup(); }}
var lines = [], names = [];
for (var i = 0; i < r.length; i++) {{ lines.push(SSRZ.describe(r[i])); names.push(r[i].name); }}
return names.join("|") + "\\n" + c.name + " (" + c.width + "x" + c.height + ") -> " + r.length + " resize(s), every keyframe kept:\\n" + lines.join("\\n");""",
                  includes=("ss_presets.jsx", "ss_resize.jsx"))
    names, _, text = res.partition("\n")
    text += "\nAdjust a framing by moving or scaling its 'SS resize · content' / 'SS resize · bg' nulls (shy guide layers)."
    if check:
        text += "\n" + t_check_layout(names.split("|"))
    return text + "\nLook at each size with render_frame(comp=...)."


MEDIA_EXT = {".mp4", ".mov", ".m4v", ".webm", ".avi", ".mxf", ".png", ".jpg", ".jpeg", ".tif", ".tiff", ".gif", ".psd", ".ai", ".pdf",
             ".svg", ".exr", ".webp", ".mp3", ".wav", ".aif", ".aiff", ".m4a", ".aac"}
MEDIA_TYPES = {"video/mp4": ".mp4", "video/quicktime": ".mov", "video/webm": ".webm", "image/png": ".png", "image/jpeg": ".jpg",
               "image/gif": ".gif", "image/webp": ".webp", "image/tiff": ".tif", "image/svg+xml": ".svg", "audio/mpeg": ".mp3",
               "audio/wav": ".wav", "audio/x-wav": ".wav", "audio/wave": ".wav", "audio/mp4": ".m4a", "audio/aac": ".aac"}
MAX_DOWNLOAD = 2 * 1024 ** 3   # 2 GB


def _sniff_ext(head):
    for sig, ext in ((b"\x89PNG", ".png"), (b"\xff\xd8\xff", ".jpg"), (b"GIF8", ".gif"), (b"ID3", ".mp3"), (b"\x1aE\xdf\xa3", ".webm")):
        if head.startswith(sig):
            return ext
    if head[4:8] == b"ftyp":
        return ".mov" if head[8:10] == b"qt" else ".mp4"
    if head[:4] == b"RIFF":
        return ".wav" if head[8:12] == b"WAVE" else ".webp" if head[8:12] == b"WEBP" else ""
    return ""


def _safe_name(s):
    import re
    import urllib.parse
    s = re.sub(r'[<>:"/\|?*\x00-\x1f%]', "_", urllib.parse.unquote(str(s))).strip(" .")
    return s[:120] or f"media_{int(time.time())}"


def _download(url, folder, name):
    """Streams url into folder (a .part file renamed when complete); returns the path. Refuses web pages and huge files."""
    import shutil
    import urllib.parse
    import urllib.request
    base = _safe_name(name or pathlib.Path(urllib.parse.urlparse(url).path).name)
    stem, ext = (base[: -len(pathlib.Path(base).suffix)], pathlib.Path(base).suffix.lower()) if pathlib.Path(base).suffix.lower() in MEDIA_EXT else (base, "")
    part = folder / f"{stem}.{int(time.time() * 1000)}.part"
    ctype = ""
    try:
        req = urllib.request.Request(url, headers={"User-Agent": "MotionDNA/1.0"})
        with urllib.request.urlopen(req, timeout=60) as r:
            ctype = r.headers.get_content_type()
            if ctype == "text/html":
                raise RuntimeError("the URL answers with a web page, not a media file (a login or an expired link?)")
            if int(r.headers.get("Content-Length") or 0) > MAX_DOWNLOAD:
                raise RuntimeError("the file is larger than 2 GB")
            got, t0 = 0, time.time()
            with open(part, "wb") as f:
                while True:
                    chunk = r.read(1 << 20)
                    if not chunk:
                        break
                    got += len(chunk); f.write(chunk)
                    if got > MAX_DOWNLOAD or time.time() - t0 > 1800:
                        raise RuntimeError("the download is larger than 2 GB or took over 30 minutes")
    except RuntimeError:
        part.unlink(missing_ok=True); raise
    except Exception as e:   # python.org's Python on macOS has no CA certificates: curl uses the system's
        part.unlink(missing_ok=True)
        if "CERTIFICATE" not in str(e).upper() and "SSL" not in str(e).upper():
            raise
        r = subprocess.run(["curl", "-fsSL", "--max-time", "1800", "--max-filesize", str(MAX_DOWNLOAD), "-o", str(part), url], capture_output=True, text=True)
        if r.returncode != 0:
            part.unlink(missing_ok=True)
            raise RuntimeError("download failed: " + (r.stderr.strip() or str(e)))
    head = part.read_bytes()[:64]
    if head.lstrip().lower().startswith((b"<!doctype html", b"<html")):
        part.unlink(missing_ok=True)
        raise RuntimeError("the URL answers with a web page, not a media file (a login or an expired link?)")
    ext = ext or MEDIA_TYPES.get(ctype, "") or _sniff_ext(head)
    path = folder / f"{stem}{ext}"
    if path.exists():
        path = folder / f"{stem}_{int(time.time())}{ext}"
    part.replace(path)
    return path


def t_import_media(source, comp=None, time_s=None, dest=None, name=None, fit=True, layer=True):
    """Brings generated or local media into AE: an https URL (Krea, Flora, Figma exports…) is downloaded first."""
    src = str(source).strip()
    if src.lower().startswith(("http://", "https://")):
        if dest:
            folder = pathlib.Path(dest).expanduser().resolve()
        else:   # next to the open AE project, else renders/generated (git-ignored)
            try:
                aep = run_jsx("return app.project.file ? app.project.file.parent.fsName : '';", includes=())
            except RuntimeError:
                aep = ""
            folder = (pathlib.Path(aep) if aep else ROOT / "renders") / "generated"
        folder.mkdir(parents=True, exist_ok=True)
        try:
            path = _download(src, folder, name)
        except Exception as e:
            return f"download failed: {e}"
    else:
        path = pathlib.Path(src).expanduser().resolve()
        if not path.exists():
            return f"not found: {src}"
    if path.suffix.lower() == ".webp":
        return f"saved {path.as_posix()} — After Effects does not import WebP: convert it (ffmpeg -i in.webp out.png) and call import_media with the PNG"
    if not path.suffix:
        return f"saved {path.as_posix()} — its type is unknown (no extension): rename it with the right extension and call import_media with the file"
    at = "c.time" if time_s is None else str(float(time_s))
    # the comp is found first: a missing comp must not leave a stray item in the project
    body = f"""var c = {'findComp(' + js(comp) + ')' if layer else 'null'};
app.beginUndoGroup("Motion DNA import (MCP)");
try {{
var it = app.project.importFile(new ImportOptions(new File({js(path.as_posix())})));
if ({js(name)}) it.name = {js(name)};
if (!c) return "imported " + it.name + " (project panel only)";
var L = c.layers.add(it); L.startTime = {at};
if ({'true' if fit else 'false'} && it.width && it.height) {{ var s = Math.max(c.width / it.width, c.height / it.height) * 100; L.property("ADBE Transform Group").property("ADBE Scale").setValue([s, s, 100]); }}
return "imported " + it.name + " as layer " + L.index + " in " + c.name + " at " + L.startTime.toFixed(2) + " s";
}} finally {{ app.endUndoGroup(); }}"""
    return ("saved " if src.lower().startswith("http") else "file ") + path.as_posix() + "\n" + run_jsx(COMP_JS + body, includes=())


def t_run_jsx(code, timeout_s=180):
    return run_jsx(code, timeout=timeout_s)


TOOLS_DEF = [
    ("ae_status", t_ae_status, "After Effects status: version, project, active comp, selection, whether the Motion DNA panel is loaded.", {}),
    ("list_presets", t_list_presets, "List library presets (one line each: kind|name|channels|energy|use). Filter by kind (motion|text|fx|recipe), energy (soft|medium|dynamic), family (own|classic|recipe) or a text query. Pick presets from this before applying.",
     {"kind": {"type": "string"}, "energy": {"type": "string"}, "family": {"type": "string"}, "query": {"type": "string"}}),
    ("list_packs", t_list_packs, "List styles (Dynamic, Elegant, Modern, Playful, Tech, Calm Modern…) with their tags (energy range, tones, curve, transition) and which preset each layer role gets.", {}),
    ("list_tags", t_list_tags, "The tag vocabulary: every preset with roles, targets, channels, direction, energy range (1 calm … 5 explosive) and tones; the curves and techniques with theirs. Filter by role, target, tone, energy, kind. Use it to choose or combine moves for a feel.",
     {"role": {"type": "string"}, "target": {"type": "string"}, "tone": {"type": "string"}, "energy": {"type": "integer"}, "kind": {"type": "string"}}),
    ("match_reference", t_match_reference, "Compare a reference analysis (a brand or video placed in an energy range and tones, with observed moves, curves and techniques; schema in library/references/_schema.md) with the library: what already fits, how to build each observed move (preset + curve + duration), the gaps to create, and a proposed style. Pass profile_path (library/references/<slug>.json) or profile_json.",
     {"profile_path": {"type": "string"}, "profile_json": {"type": "string"}}),
    ("suggest_mix", t_suggest_mix, "Ranked move x curve x duration combinations for a layer (role: enter/exit/emphasis/loop/transition, target: title/text/shape/icon/logo/ui/media/footage/background) and a feel (tones, energy 1-5, avoid). Each line says how to apply it.",
     {"role": {"type": "string"}, "target": {"type": "string"}, "tones": {"type": "array", "items": {"type": "string"}}, "energy": {"type": "integer"},
      "avoid": {"type": "array", "items": {"type": "string"}}, "limit": {"type": "integer"}}),
    ("list_assets", t_list_assets, "List the assets on this machine: licensed packs (never in the repo) and the free CC0 packs in assets.free/ (flag cc0): SFX, music, overlays, VFX image sequences (fire, smoke, explosions) and particle textures, with category, seconds, loudness and flags.",
     {"type": {"type": "string", "description": "sfx | music | overlay | vfx | texture"}, "category": {"type": "string"}, "query": {"type": "string"}, "limit": {"type": "integer"}}),
    ("list_resources", t_list_resources, "Catalog of outside resources Claude may use, each with its license checked: AE scripts and expression libraries, easing math, render automation, VFX footage (fire, smoke, explosions), motion graphics, textures, icons, sound effects, royalty-free music and local generators. Says whether credit is needed, whether it can live in the repo or stays local, how to get it and when to use it. Nothing here is downloaded by itself: ask the user before downloading.",
     {"category": {"type": "string", "description": "ae_script | expression_lib | easing_math | render_automation | import_export | shape_tools | audio_tools | vfx_footage | motion_graphics | textures | illustration_icons | sfx | music | generator"},
      "query": {"type": "string"}, "commercial_only": {"type": "boolean", "description": "default true"}, "no_attribution": {"type": "boolean"},
      "include_excluded": {"type": "boolean", "description": "also list what was ruled out and why"}, "limit": {"type": "integer"}}),
    ("list_layers", t_list_layers, "List the layers of a comp (default: the active comp) with type, timing and selection.", {"comp": {"type": "string"}}),
    ("apply_preset", t_apply_preset, "Apply a preset to layers (by name, or the selected layers) of a comp (default: active). A layer that already moves keeps its animation (existing=modify, default: its keyframe values stay, it gets the preset's curve and the duration factor) or loses it (existing=replace); a layer with no animation gets the preset generated. phase in|out|both. With marker_timing the layer gets 'SS in'/'SS out' markers: dragging them retimes the animation. Tuning (same as the panel's Controls): duration multiplier (0.5-2), intensity (0.25-2, scales the travel), direction (as designed | mirror horizontal | mirror vertical | mirror both), ease (token: Land, Settle, Launch, Cruise, Surge, Ramp, Whip, Flat).",
     {"preset": {"type": "string"}, "layers": {"type": "array", "items": {"type": "string"}}, "comp": {"type": "string"},
      "phase": {"type": "string", "enum": ["in", "out", "both"]}, "stagger_frames": {"type": "number"}, "marker_timing": {"type": "boolean"},
      "duration": {"type": "number"}, "intensity": {"type": "number"}, "direction": {"type": "string"}, "ease": {"type": "string"}, "existing": {"type": "string", "enum": ["modify", "replace"]}}, ["preset"]),
    ("solid_transition", t_solid_transition, "Flat 2D transition built from solids and masks (like Animation Composer's Flat 2D transitions): coloured pieces cover the frame at the cut and uncover it after, driven by one editable controller (Progress, Direction, Stagger, Ease In / Ease Out token curves, Color 1-3). Timing and curves are Motion DNA tokens: dur = duration token (Tick … Stage), ease_in / ease_out = curve tokens (Surge, Pop, Whip, Land…). Call with no look/type to list the named looks (filter by energy 1-5 or tone); look = a named look, or type = wipe | bars | blinds | split | interleave | stack | iris | diamond | grid (solid pieces over a cut), or zoom | spin | stretch | slide (clip to clip: the outgoing and incoming layers move themselves; both names required). Colours: a hex list, or brand = slug to use the brand's colours. at_s = the cut (default playhead); outgoing/incoming = layer names to trim at the cut.",
     {"look": {"type": "string"}, "type": {"type": "string", "enum": ["wipe", "bars", "blinds", "split", "interleave", "stack", "iris", "diamond", "grid", "dots", "fan", "liquid", "ink", "zoom", "spin", "stretch", "slide", "flash", "dip", "shake", "twirl", "slices", "glitch"]},
      "at_s": {"type": "number"}, "comp": {"type": "string"}, "colors": {"type": "array", "items": {"type": "string"}}, "brand": {"type": "string"},
      "dur": {"type": "string", "description": "duration token: Tick, Blink, Glide, Arrive, Sweep, Stage"}, "duration": {"type": "number", "description": "seconds, overrides dur"},
      "ease_in": {"type": "string", "description": "curve token while covering"}, "ease_out": {"type": "string", "description": "curve token while uncovering"},
      "count": {"type": "integer"}, "angle": {"type": "number"}, "stagger": {"type": "number"},
      "order": {"type": "string", "enum": ["index", "reverse", "center", "edges", "random", "diagonal"]},
      "cols": {"type": "integer"}, "outgoing": {"type": "string"}, "incoming": {"type": "string"}, "energy": {"type": "integer"}, "tone": {"type": "string"}}),
    ("list_kit", t_list_kit, "List the building blocks beyond presets, each with energy, tones, use and the call to make: element (self-sizing titles, callouts, counters, social…), shape (primitives, lines, impacts, fireworks, glitter…), move (2D/3D entrances), text (per-unit text animation, typewriter, captions), look (finishing looks), background, transition. Filter by kind, energy 1-5, tone or a word.",
     {"kind": {"type": "string", "enum": ["element", "shape", "move", "text", "look", "background", "transition"]}, "energy": {"type": "integer"}, "tone": {"type": "string"}, "query": {"type": "string"}}),
    ("add_shape", t_add_shape, "Animated shape on its own layer, keyed with token curves (Reveal, Size, Stroke, Color 1/2 on the layer): primitives (circle, ring, square, frame, triangle, diamond, pentagon, hexagon, star, sparkle, badge, heart, shield), lines (line, wave, zigzag, arrow, curved_arrow, chevrons, brackets, spiral, infinity, brush, speed_lines), marks (cross, plus, check, dots, loader, rings) and Shape-Elements families (burst, impact with spread/mirror, pops, shape_row, fireworks, glitter, swoosh, confetti), blob (liquid shape that keeps breathing); lines draw on and, with out or hold, travel off. anim: draw | pop | spin | burst | pulse; loop keeps it moving.",
     {"kind": {"type": "string"}, "comp": {"type": "string"}, "t": {"type": "number"}, "out": {"type": "number"}, "position": {"type": "array", "items": {"type": "number"}},
      "size": {"type": "number"}, "stroke": {"type": "number"}, "style": {"type": "string", "enum": ["fill", "outline", "dotted"]}, "anim": {"type": "string", "enum": ["draw", "pop", "spin", "burst", "pulse"]}, "hold": {"type": "number", "description": "seconds on screen before it leaves (lines travel off)"},
      "ease": {"type": "string"}, "dur": {"type": "string"}, "colors": {"type": "array", "items": {"type": "string"}}, "brand": {"type": "string"}, "count": {"type": "integer"},
      "loop": {"type": "boolean"}, "spread": {"type": "number"}, "angle": {"type": "number"}, "mirror": {"type": "boolean"}, "item": {"type": "string"}}, ["kind"]),
    ("add_behavior", t_add_behavior, "Behaviours: an algorithm apart from what it draws, so one behaviour feeds many targets. Call with no behavior to list them by family with the targets where each passed the quality check. Families: fill (covers a region: bubbles = liquid metaballs that merge, blob, voronoi = cells and shards, grow = branching vines), swarm (flock, flow = noise flow-field streamlines), physics (spring = jelly box driven by the token curve, rope = verlet rope that pays out and settles), modifier (line_boil = hand-drawn tremble on 3s, on any existing layer; the Collage style applies it). target: shape (its own layer; box [x, y, w, h] or layer = a layer to wrap) | background (loops at the bottom; colors[0] = base) | mask or text (layer = the layer revealed through it) | box (element = an add_element controller such as 'EL · label 1': its box is redrawn) | transition (at_s = the cut: covers, then uncovers, like solid_transition) | layer (layers = names, for modifiers). Timing on token curves: t, out, dur, ease (ease_in / ease_out for transitions).",
     {"behavior": {"type": "string"}, "target": {"type": "string", "enum": ["shape", "background", "mask", "text", "box", "transition", "layer"]}, "comp": {"type": "string"},
      "t": {"type": "number"}, "out": {"type": "number"}, "at_s": {"type": "number"}, "layer": {"type": "string"}, "layers": {"type": "array", "items": {"type": "string"}},
      "element": {"type": "string"}, "colors": {"type": "array", "items": {"type": "string"}}, "brand": {"type": "string"}, "count": {"type": "integer"},
      "seed": {"type": "integer"}, "origin": {"type": "string"}, "speed": {"type": "number"}, "size": {"type": "number"}, "stroke": {"type": "number"},
      "goo": {"type": "number"}, "dur": {"type": "string"}, "ease": {"type": "string"}, "box": {"type": "array", "items": {"type": "number"}},
      "amount": {"type": "number"}, "step": {"type": "integer"}, "ease_in": {"type": "string"}, "ease_out": {"type": "string"}, "spread": {"type": "number"}}),
    ("move", t_move, "2D/3D entrance or exit for named or selected layers on token curves (AC 3D Transitions and Scale families): flip (card turn, axis x|y), hinge (door on an edge: left|right|top|bottom, direction forward|backward), orbit (swings in round a distant pivot, origin behind|front), fly (Z, origin near|far), tumble (fly + turn), grow_edge (from an edge, one axis or uniform), squash (one-axis bounce).",
     {"move": {"type": "string", "enum": ["flip", "hinge", "orbit", "fly", "tumble", "grow_edge", "squash"]}, "layers": {"type": "array", "items": {"type": "string"}}, "comp": {"type": "string"},
      "phase": {"type": "string", "enum": ["in", "out", "both"]}, "t": {"type": "number"}, "dur": {"type": "string"}, "ease": {"type": "string"}, "axis": {"type": "string"}, "edge": {"type": "string"},
      "direction": {"type": "string"}, "origin": {"type": "string"}, "distance": {"type": "number"}, "angle": {"type": "number"}, "fade": {"type": "boolean"}, "uniform": {"type": "boolean"}}, ["move"]),
    ("animate_text", t_animate_text, "Animate named or selected text layers per unit (chars | words | lines) on token curves, overshoot per letter included (AC Text Presets): channels fade, rise, drop, slide, scale, rotate, rotate3d, skew, tracking, blur, decode, color; mode ease | flicker | wiggly; order forward | reverse | center | edges | random; mask = slide up from behind the text box. typewriter = true types the text with a blinking cursor (cps).",
     {"layers": {"type": "array", "items": {"type": "string"}}, "comp": {"type": "string"}, "unit": {"type": "string", "enum": ["chars", "words", "lines"]},
      "channels": {"type": "array", "items": {"type": "string"}}, "mode": {"type": "string", "enum": ["ease", "flicker", "wiggly"]}, "order": {"type": "string"},
      "phase": {"type": "string", "enum": ["in", "out", "both"]}, "t": {"type": "number"}, "dur": {"type": "string"}, "ease": {"type": "string"}, "spread": {"type": "number"},
      "amount": {"type": "number"}, "color": {"type": "string"}, "mask": {"type": "boolean"}, "typewriter": {"type": "boolean"}, "cps": {"type": "number"}, "cursor": {"type": "string"}}),
    ("add_look", t_add_look, "Backgrounds and finishing looks from native effects (AC Backgrounds / Overlays / Mixed): backgrounds stripes | dots | grid | gradient | liquid | topo | network (plexus: drifting points joined by lines that fade with distance) | blobs (liquid shapes breathing) | mesh (blurred colour mesh gradient) | glass (mesh behind frosted panes) (at the bottom, looping); looks tritone | duotone | vignette | grain | scanlines | letterbox | dust | embers | snow (on top; for light leaks use real footage with add_asset); long_shadow and glitch on a named layer. Colours from a list or brand.",
     {"kind": {"type": "string"}, "comp": {"type": "string"}, "layer": {"type": "string"}, "t": {"type": "number"}, "dur": {"type": "number"}, "colors": {"type": "array", "items": {"type": "string"}},
      "brand": {"type": "string"}, "amount": {"type": "number"}, "length": {"type": "number"}, "angle": {"type": "number"}, "color": {"type": "string"}, "ratio": {"type": "number"},
      "speed": {"type": "number"}, "count": {"type": "integer"}, "particle_color": {"type": "string"}}, ["kind"]),
    ("add_captions", t_add_captions, "Captions from word timings (words [{w, s, e}] or words_path from tools/vo_words.py) or an SRT file: lines grouped by length and pauses; style highlight (spoken word in the accent) | karaoke | build (words appear as spoken) | pop | word (one word at a time); optional box and outline.",
     {"words": {"type": "array", "items": {"type": "object"}}, "words_path": {"type": "string"}, "srt_path": {"type": "string"}, "comp": {"type": "string"},
      "style": {"type": "string", "enum": ["highlight", "karaoke", "build", "pop", "word"]}, "size": {"type": "number"}, "position": {"type": "array", "items": {"type": "number"}},
      "colors": {"type": "array", "items": {"type": "string"}}, "brand": {"type": "string"}, "box": {"type": "boolean"}, "stroke": {"type": "boolean"}, "max_chars": {"type": "integer"}}),
    ("add_element", t_add_element, "Semi-finished graphic element that sizes itself to its text (like Animation Composer's titles, callouts, social and counters): label (chip), lower_third (text = name, sub = role), title (text + sub, accent rule), underline / highlight (layer = an existing text layer), callout (point = [x, y]), counter (start → value, prefix/suffix/decimals), timer (value = countdown s, 0 counts up), price_tag (text = price, sub = label), handle (@name pill), bubble, chat (typing dots then text), sticker (tilted outlined word), quote (text, sub = author), text_box (text = title, sub = body), list (items), progress / ring (value %), rating (value of 5), button (text, pressed, click time; a cursor clicks; pressed_box Box on light scenes), kinetic (items = lines), tiles (letters on 3D tiles), media (slot [w, h] + optional layer to fit), scale_title (mode push|drop), cinematic (style neon|blur|kerning), glass_card (text, sub: a smoky frosted pane that blurs what is behind it; size [w, h]), end_card (the Motion DNA logo close, as in the logo manual: the helix mark grows up its diagonal with overshoot, the arrow kicks, MOTION / DNA rise into place below it; style horizontal for the side-by-side lockup; text = wordmark, sub = tagline, size = mark height; close every Motion DNA demo with it). outline = true draws boxes as outlines. list_kit shows them all with energy and tones. One controller per element (Reveal, Padding, Radius, Gap, Box/Accent/Text colours). Colours: [box, accent, text] hex, or brand = slug (its colours and fonts). t = in (s, default playhead), out = exit (s, optional).",
     {"kind": {"type": "string", "enum": ["label", "lower_third", "title", "underline", "highlight", "callout", "counter", "timer", "price_tag", "handle", "bubble", "sticker",
                                          "quote", "list", "progress", "button", "kinetic", "tiles", "text_box", "media", "scale_title", "cinematic", "chat", "rating", "ring", "glass_card", "end_card"]},
      "items": {"type": "array", "items": {"type": "string"}}, "value": {"type": "number"}, "start": {"type": "number"}, "style": {"type": "string"}, "mode": {"type": "string"},
      "outline": {"type": "boolean"}, "slot": {"type": "array", "items": {"type": "number"}}, "click": {"type": "number"}, "pressed": {"type": "string"}, "prefix": {"type": "string"},
      "suffix": {"type": "string"}, "decimals": {"type": "integer"}, "width": {"type": "number"}, "text": {"type": "string"}, "sub": {"type": "string"}, "pressed_box": {"type": "string", "enum": ["Text", "Box"]}, "logo": {"type": "string", "description": "end_card: a mark JSON from tools/logo_to_shape.py + tools/logo_strokes.py (default: the Motion DNA mark)"},
      "layer": {"type": "string"}, "point": {"type": "array", "items": {"type": "number"}}, "comp": {"type": "string"}, "t": {"type": "number"}, "out": {"type": "number"},
      "colors": {"type": "array", "items": {"type": "string"}}, "brand": {"type": "string"}, "size": {"type": "number"},
      "position": {"type": "array", "items": {"type": "number"}}, "padding": {"type": "array", "items": {"type": "number"}}, "radius": {"type": "number"},
      "text_preset": {"type": "string"}}, ["kind"]),
    ("keyframes", t_keyframes, "Keyframe toolkit for named or selected layers (all their animated properties), the helpers an animator uses between presets: ease (type = curve token for every segment) | copy_ease (source = layer whose easing to copy, values kept) | randomize (frames = max random shift per layer) | reverse | mirror_out (build the exit from the entrance, ending at the out point; frames = gap) | stagger (frames apart; order selection/top/bottom/random/center) | shift (frames) | to_playhead (which = start|end; at_s overrides the playhead) | sequence (end to end, frames = overlap) | distribute (selected keys evenly) | loop (type cycle/pingpong/offset/continue) | bake (expressions to keys) | stretch (factor) | copy_to (source = layer name to copy from).",
     {"action": {"type": "string", "enum": ["reverse", "mirror_out", "stagger", "shift", "to_playhead", "sequence", "distribute", "loop", "bake", "stretch", "copy_to", "ease", "copy_ease", "randomize"]},
      "layers": {"type": "array", "items": {"type": "string"}}, "comp": {"type": "string"}, "frames": {"type": "number"}, "order": {"type": "string"},
      "type": {"type": "string"}, "factor": {"type": "number"}, "which": {"type": "string"}, "at_s": {"type": "number"}, "source": {"type": "string"}}, ["action"]),
    ("anchor_point", t_anchor_point, "Move the anchor point of named or selected layers to center, top, bottom, left, right or a corner (top-left, bottom-right…) of their own box, without moving them on screen (keyed positions are compensated).",
     {"where": {"type": "string"}, "layers": {"type": "array", "items": {"type": "string"}}, "comp": {"type": "string"}}),
    ("remove_animation", t_remove_animation, "Remove what Motion DNA added to layers (keyframes, our expressions, SS in/out markers, SS text animators and effects); each property keeps its resting value.",
     {"layers": {"type": "array", "items": {"type": "string"}}, "comp": {"type": "string"}}),
    ("apply_pack", t_apply_pack, "Apply a style pack to a whole comp (or the named layers): titles, text, shapes, media and logo each get the pack's preset, staggered.",
     {"pack": {"type": "string"}, "comp": {"type": "string"}, "layers": {"type": "array", "items": {"type": "string"}},
      "phase": {"type": "string", "enum": ["in", "out", "both"]}, "marker_timing": {"type": "boolean"}, "duration": {"type": "number"}, "intensity": {"type": "number"}, "existing": {"type": "string", "enum": ["modify", "replace"]}}, ["pack"]),
    ("add_asset", t_add_asset, "Place an asset by exact name from list_assets in a comp at a time (default: playhead): sfx or music (audio, gain_db), overlay (full frame, looped, blend + opacity), or vfx (a free CC0 image sequence with alpha: fire, smoke, explosion; blend default add, scale %).",
     {"name": {"type": "string"}, "type": {"type": "string", "enum": ["sfx", "music", "overlay", "vfx"]}, "time_s": {"type": "number"}, "gain_db": {"type": "number"},
      "opacity": {"type": "number"}, "blend": {"type": "string"}, "scale": {"type": "number"}, "comp": {"type": "string"}}, ["name"]),
    ("show_in_panel", t_show_in_panel, "Select a preset in the open Motion DNA panel so the user sees its live preview.",
     {"kind": {"type": "string"}, "name": {"type": "string"}}, ["kind", "name"]),
    ("render_frame", t_render_frame, "Save one frame of a comp as PNG (default: active comp at the playhead) and return its path, to check the result visually.",
     {"time_s": {"type": "number"}, "comp": {"type": "string"}}),
    ("render_comp", t_render_comp, "Render a comp to MP4 through AE's render queue (renders/mcp/<comp>.mp4). Blocks AE while rendering.",
     {"comp": {"type": "string"}, "wait_s": {"type": "number"}}),
    ("list_brands", t_list_brands, "List brand profiles (library/brands): custom styles that learn from every review, each with its base style, curve, tones and how many rules it has learned.", {}),
    ("get_brand", t_get_brand, "Read a brand profile before animating for that brand: identity (colours, fonts, logo), feel (energy, tones, base style, curve, transition), preferred and avoided presets, and every rule learned in its reviews, by category. Follow it.",
     {"slug": {"type": "string"}}, ["slug"]),
    ("add_brand_note", t_add_brand_note, "Save a review note as a rule in a brand profile, so the next piece for that brand starts with it. Write one instruction anyone can follow without context, plus why. category: layout | typography | motion | effects | color | audio | edit | process.",
     {"slug": {"type": "string"}, "rule": {"type": "string"}, "category": {"type": "string"}, "why": {"type": "string"},
      "project": {"type": "string"}, "by": {"type": "string"}}, ["slug", "rule"]),
    ("apply_brand", t_apply_brand, "Animate a comp (or the named layers) in a brand's style: its base style, layer role by layer role, on the brand's own curve.",
     {"slug": {"type": "string"}, "comp": {"type": "string"}, "layers": {"type": "array", "items": {"type": "string"}},
      "phase": {"type": "string", "enum": ["in", "out", "both"]}, "marker_timing": {"type": "boolean"}, "duration": {"type": "number"}, "intensity": {"type": "number"}, "existing": {"type": "string", "enum": ["modify", "replace"]}}, ["slug"]),
    ("apply_transition", t_apply_transition, "A transition between two layers: the outgoing layer plays the preset's exit while the incoming one plays its entrance, from the same cut, so they read as one move (e.g. Whip Pan: one leaves left as the other arrives from the right). Use a preset tagged 'transition' (list_tags role=transition). at_s: the cut (default: the playhead when both are visible, else the incoming layer's in point). The keys add to what the layers already have.",
     {"preset": {"type": "string"}, "outgoing": {"type": "string"}, "incoming": {"type": "string"}, "comp": {"type": "string"}, "at_s": {"type": "number"},
      "duration": {"type": "number"}, "intensity": {"type": "number"}}, ["preset", "outgoing", "incoming"]),
    ("matte", t_matte, "Cut the subject (person, product, car) out of a still or a video on this computer's GPU (InSPyReNet, no cost): a still gives a PNG with alpha (<name>_cutout.png), a video a ProRes 4444 .mov with alpha (<name>_matte.mov). import_to_comp: a comp name to add it to as a layer, fitted to the frame. Use it for text behind a subject, product cutouts, and contour strokes.",
     {"source": {"type": "string"}, "out": {"type": "string"}, "size": {"type": "string"}, "fps": {"type": "number"}, "import_to_comp": {"type": "string"}}, ["source"]),
    ("text_behind", t_text_behind, "Technique 'Text behind people': puts a text layer behind the person or product of a footage layer (still or video). It mattes the subject on this computer's GPU (matte), adds the cut-out above the text, parented to the subject so it follows its moves. Animate the text as usual; render a frame to check.",
     {"subject": {"type": "string"}, "text": {"type": "string"}, "comp": {"type": "string"}}, ["subject", "text"]),
    ("check_layout", t_check_layout, "Layout QA on built comps (default: the active comp), before you report a build as done: text overlapping text, text outside the 40 px safe area, text under 32 px, low contrast, graphics on faces, substituted fonts. Fix every warning or say why it stays.",
     {"comps": {"type": "array", "items": {"type": "string"}}}),
    ("resize_comp", t_resize_comp, "Social resizes of a comp (default: the active one): duplicates it once per size — 9:16 (1080x1920), 1:1 (1080x1080) and 4:5 (1080x1350) by default; also 16:9, 4:3, 2:3 or any WxH such as 1200x628 — keeping every keyframe and expression (nothing is re-keyed), and reframes it inside the size's title-safe area (9:16 stays clear of the Reels/TikTok/Shorts interface). Full-frame backgrounds (plates, solids, footage, adjustment layers) cover the new frame. mode reflow (default): layers that rest on or next to each other move as a group, each group keeps its own size where it fits (never above the source size) and is placed round the frame centre, so a 16:9 title stays legible in 9:16; mode fit: the whole layout scales as one block, and a text that would still rest outside the safe area gets its own fit null. Every placement is a null ('SS resize · content', 'SS resize · bg', 'SS fit · <layer>': shy guide layers) to adjust by hand. New comps are named '<comp> · 9x16' etc. Runs check_layout on each (check=false skips it); then look at each with render_frame. Layers inside precomps are not reframed. safe = title-safe insets [top, right, bottom, left] as fractions to override the default.",
     {"comp": {"type": "string"}, "sizes": {"type": "array", "items": {"type": "string"}, "description": "9:16 | 1:1 | 4:5 | 16:9 | 4:3 | 2:3 | WxH; default 9:16, 1:1, 4:5"},
      "mode": {"type": "string", "enum": ["reflow", "fit"]}, "safe": {"type": "array", "items": {"type": "number"}}, "suffix": {"type": "string"}, "check": {"type": "boolean"}}),
    ("import_media", t_import_media, "Bring media into After Effects: a local file or an https URL (a Krea or Flora generation, a Figma export…), downloaded first into dest (default: a 'generated' folder next to the open .aep, else renders/generated). Imports it and, unless layer=false, adds it to the comp (default: active) at time_s (default: playhead), scaled to cover the frame (fit=false keeps 100%). Use it for every generated still, clip or audio instead of downloading by hand.",
     {"source": {"type": "string", "description": "file path or https URL"}, "comp": {"type": "string"}, "time_s": {"type": "number"},
      "dest": {"type": "string", "description": "folder to save downloads in (the project's folder, e.g. <project>/generated)"},
      "name": {"type": "string", "description": "file and item name"}, "fit": {"type": "boolean"}, "layer": {"type": "boolean"}}, ["source"]),
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
                "instructions": "Motion DNA: a motion library for After Effects that gives AI-made motion its own identity. Everything is tagged "
                                "(roles, targets, channels, direction, energy 1 calm..5 explosive, tones): use list_tags, suggest_mix and list_packs "
                                "(styles) to pick or combine a move + token curve + duration for a feel. If you bring a reference analysis (a brand or "
                                "video placed in an energy range and tones, e.g. calm + modern), run match_reference: build what fits from existing "
                                "presets and CREATE what is missing (moves, curves, transitions, techniques), tag it, render its samples and add a style "
                                "(CONTRIBUTING.md section 8). Apply with apply_preset (duration, intensity, direction, ease), apply_pack, add_asset; undo "
                                "with remove_animation; check with render_frame and, before calling a build done, check_layout. Never save the AE project unless asked. Working for a brand or a project? Read it first with get_brand and "
                                "save every review note with add_brand_note: each brand profile learns and keeps its own rules. "
                                "Read CLAUDE.md in the repo for the rules."}
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
