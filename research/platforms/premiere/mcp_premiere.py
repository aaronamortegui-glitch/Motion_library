#!/usr/bin/env python3
"""motion-dna-premiere: MCP server that lets Claude (or any MCP client) drive the Premiere project you have open.

Beta, on the branch premiere-beta. No dependencies (Python 3 standard library). Speaks MCP over stdio and talks to
the Motion DNA UXP plugin inside Premiere through helper.py (WebSocket on localhost); it starts the helper by itself
when it is not running. Works on whatever project is open in Premiere; several Premiere versions can be open at once
(`premiere: "26"` / `"27"` picks one, default the newest connection).

Register (Claude Code), from the repo root:
  claude mcp add motion-dna-premiere -- python research/platforms/premiere/mcp_premiere.py

The API rules learned in the spike (README.md here) are built into every tool: import paths use "/", export and
preset paths use "\\", files are checked before import (a failed import opens a modal that blocks Premiere),
keyframe times are offset by the clip's in-point, actions are created inside lockedAccess.
"""
import base64
import json
import os
import pathlib
import subprocess
import sys
import tempfile
import time
import urllib.error
import urllib.request

HERE = pathlib.Path(__file__).resolve().parent
ROOT = HERE.parents[2]
BASE = "http://127.0.0.1:8738"
PROTOCOL = "2025-06-18"
TOKENS = ROOT / "tokens" / "superside_motion_tokens.json"


# ---------------------------------------------------------------- helper + plugin
def _get(path, timeout=3):
    with urllib.request.urlopen(BASE + path, timeout=timeout) as r:
        return json.load(r)


def ensure_helper():
    try:
        return _get("/status")
    except (urllib.error.URLError, OSError):
        pass
    flags = 0
    if sys.platform == "win32":
        flags = subprocess.CREATE_NO_WINDOW | subprocess.DETACHED_PROCESS | subprocess.CREATE_NEW_PROCESS_GROUP
    subprocess.Popen([sys.executable, str(HERE / "helper.py")], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL,
                     stdin=subprocess.DEVNULL, creationflags=flags, start_new_session=(sys.platform != "win32"))
    for _ in range(40):   # the plugin reconnects every 2 s once the helper is up
        time.sleep(0.25)
        try:
            st = _get("/status")
            if st.get("plugin"):
                return st
        except (urllib.error.URLError, OSError):
            continue
    time.sleep(2.5)
    return _get("/status")


def diagnose():
    """Why Premiere is not connected, in plain words, with the one thing to do about it."""
    sys.path.insert(0, str(HERE))
    import install_premiere as ip
    usable = [p for p in ip.premieres() if p[0] >= (26, 0, 0)]
    if not usable:
        return "Premiere 2026 or newer is not installed on this machine (Motion DNA needs its UXP API)."
    have = ip.installed()
    if ip.PLUGIN_ID not in have and not any(k in have for k in ip.OLD_IDS):
        return ("The Motion DNA plugin is not installed in Premiere. Install it: python tools/setup.py (or "
                "python research/platforms/premiere/install_premiere.py). The Creative Cloud app must be open.")
    if not ip.premiere_running():
        return "Premiere is not open. Ask the user to open Premiere with a project, then Window > UXP Plugins > Motion DNA."
    return ("Premiere is open but the Motion DNA panel is not connected. Ask the user to open Window > UXP Plugins > "
            "Motion DNA (and to restart Premiere if the plugin was installed or updated while it was open). It connects "
            "within 2 seconds.")


def run(js, premiere=None, timeout=30):
    st = ensure_helper()
    if not st.get("plugin"):
        raise RuntimeError(diagnose())
    data = json.dumps({"js": PRELUDE + js, "timeout": timeout, "target": premiere}).encode()
    req = urllib.request.Request(BASE + "/call", data=data, headers={"Content-Type": "application/json"})
    with urllib.request.urlopen(req, timeout=timeout + 10) as r:
        res = json.load(r)
    if not res.get("ok"):
        err = res.get("error", "")
        if "timeout" in err:
            err += (". Premiere is probably showing a dialog (an import error, a save prompt…): ask the user to close it; "
                    "every later call waits until it is closed.")
        raise RuntimeError(err.split("\n    at ")[0])
    return res.get("result"), res.get("premiere")


# Shared JS helpers, prepended to every job. `P` is the open project.
PRELUDE = r"""
const P = await ppro.Project.getActiveProject();
if (!P) throw new Error("No project is open in Premiere: open or create one first.");
const FWD = (s) => String(s).split("\\").join("/");        // importFiles wants forward slashes
const BACK = (s) => String(s).split("/").join("\\");       // exportSequenceFrame and preset paths want backslashes
const MAJOR = parseInt(uxp.host.version, 10);
async function seqBy(name) {
  if (!name) { const s = await P.getActiveSequence(); if (!s) throw new Error("No active sequence: name one."); return s; }
  const s = (await P.getSequences()).find((x) => x.name === name);
  if (!s) throw new Error("No sequence named " + JSON.stringify(name));
  return s;
}
async function fpsOf(seq) { return (await (await seq.getSettings()).getVideoFrameRate()).value; }
function tx(label, build) {               // actions must be created inside lockedAccess
  let ok;
  P.lockedAccess(() => { const acts = [].concat(build()); ok = P.executeTransaction((ca) => { for (const a of acts) ca.addAction(a); }, label); });
  return ok;
}
async function clipsOf(seq, kind, t) {
  const tr = kind === "audio" ? await seq.getAudioTrack(t) : await seq.getVideoTrack(t);
  return tr ? await tr.getTrackItems(ppro.Constants.TrackItemType.CLIP, false) : [];
}
async function clipAt(seq, track, clip) {   // track is 1-based (V1); clip is an index (0-based) or a name
  const items = await clipsOf(seq, "video", track - 1);
  if (!items.length) throw new Error("No clip on V" + track);
  if (typeof clip === "string") { for (const it of items) if ((await it.getName()) === clip) return it; throw new Error("No clip named " + clip + " on V" + track); }
  const it = items[clip || 0]; if (!it) throw new Error("V" + track + " has " + items.length + " clips"); return it;
}
async function findItem(name) {         // a project item by name, in the root or one bin deep
  const root = await P.getRootItem();
  const walk = async (folder, depth) => {
    for (const it of await folder.getItems()) {
      if (it.name === name) return it;
      if (depth < 2) { let f = null; try { f = ppro.FolderItem.cast(it); } catch (e) {} if (f) { try { const r = await walk(f, depth + 1); if (r) return r; } catch (e) {} } }   // bins: cast, plain items throw
    }
    return null;
  };
  return walk(root, 0);
}
async function componentByMatch(item, match) {
  const chain = await item.getComponentChain();
  for (let c = 0; c < chain.getComponentCount(); c++) { const k = chain.getComponentAtIndex(c); if ((await k.getMatchName()) === match) return k; }
  return null;
}
"""


# ---------------------------------------------------------------- token curves
def _tokens():
    return json.loads(TOKENS.read_text(encoding="utf-8"))


def bezier_y(x1, y1, x2, y2, x):
    lo, hi = 0.0, 1.0
    for _ in range(60):
        t = (lo + hi) / 2
        xt = 3 * (1 - t) ** 2 * t * x1 + 3 * (1 - t) * t ** 2 * x2 + t ** 3
        lo, hi = (t, hi) if xt < x else (lo, t)
    t = (lo + hi) / 2
    return 3 * (1 - t) ** 2 * t * y1 + 3 * (1 - t) * t ** 2 * y2 + t ** 3


# ---------------------------------------------------------------- tools
def t_ppro_status(premiere=None):
    st = ensure_helper()
    vers = [h.get("version") for h in st.get("connected", [])]
    if not vers:
        return "Not connected. " + diagnose()
    r, v = run("""
const a = await P.getActiveSequence();
const seqs = [];
for (const s of await P.getSequences()) seqs.push({ name: s.name, fps: +(await fpsOf(s)).toFixed(3), videoTracks: await s.getVideoTrackCount(), active: !!a && a.name === s.name });
return { project: P.name, path: P.path, sequences: seqs };""", premiere)
    return json.dumps({"premiere_connected": vers, "using": v, **r}, indent=1)


def t_list_sequences(premiere=None):
    return t_ppro_status(premiere)


def t_create_sequence(name, fps=25, premiere=None, open=True):
    presets = {23.976: "23.976", 24: None, 25: "25", 29.97: "29.97", 50: "50", 59.94: "59.94"}
    key = next((k for k in presets if abs(k - float(fps)) < 0.01 and presets[k]), None)
    r, v = run(f"""
const name = {json.dumps(name)}; const fps = {float(fps)}; const preset = {json.dumps(presets.get(key) if key else None)};
if ((await P.getSequences()).some((s) => s.name === name)) throw new Error("A sequence named " + name + " already exists");
let seq = null;
if (preset) seq = await P.createSequenceWithPresetPath(name, BACK("C:/Program Files/Adobe/Adobe Premiere Pro 20" + MAJOR + "/Settings/SequencePresets/HD 1080p/HD 1080p " + preset + " fps.sqpreset"));
if (!seq) {{
  seq = await P.createSequence(name);
  const st = await seq.getSettings();
  const exact = {{ 23.976: 24000 / 1001, 29.97: 30000 / 1001, 59.94: 60000 / 1001 }}[fps] || fps;
  await st.setVideoFrameRate(ppro.FrameRate.createWithValue(exact));
  tx("Motion DNA: frame rate", () => seq.createSetSettingsAction(st));
}}
if ({json.dumps(bool(open))}) await P.openSequence(seq);
return {{ name: seq.name, fps: await fpsOf(seq), from: preset ? "preset HD 1080p" : "default + frame rate" }};""", premiere)
    return f"Created sequence {r['name']} at {r['fps']:.3f} fps ({r['from']}) in Premiere {v}."


def t_open_sequence(name, premiere=None):
    run(f"await P.openSequence(await seqBy({json.dumps(name)})); return true;", premiere)
    return f"Opened {name}."


def t_list_clips(sequence=None, premiere=None):
    r, v = run(f"""
const seq = await seqBy({json.dumps(sequence)});
const out = {{ sequence: seq.name, fps: await fpsOf(seq), video: [], audio: [] }};
for (const kind of ["video", "audio"]) {{
  const n = kind === "video" ? await seq.getVideoTrackCount() : await seq.getAudioTrackCount();
  for (let t = 0; t < n; t++) {{
    const items = await clipsOf(seq, kind, t);
    out[kind].push({{ track: (kind === "video" ? "V" : "A") + (t + 1), clips: await Promise.all(items.map(async (it, i) => ({{ i, name: await it.getName(),
      start: +(await it.getStartTime()).seconds.toFixed(3), end: +(await it.getEndTime()).seconds.toFixed(3) }}))) }});
  }}
}}
return out;""", premiere)
    return json.dumps(r, indent=1)


def _download(url, folder):
    folder.mkdir(parents=True, exist_ok=True)
    name = url.split("?")[0].rstrip("/").split("/")[-1] or "download"
    dest = folder / name
    req = urllib.request.Request(url, headers={"User-Agent": "motion-dna"})
    with urllib.request.urlopen(req, timeout=120) as r, open(dest, "wb") as f:
        f.write(r.read())
    return dest


def t_import_media(source, bin=None, premiere=None, download_dir=None):
    if source.startswith(("http://", "https://")):
        folder = pathlib.Path(download_dir) if download_dir else pathlib.Path(tempfile.gettempdir()) / "motion_dna_premiere"
        source = str(_download(source, folder))
    p = pathlib.Path(source)
    if not p.exists():   # never let Premiere try: a failed import opens a modal that blocks every later call
        raise FileNotFoundError(f"{source} does not exist")
    r, v = run(f"""
const f = FWD({json.dumps(str(p))});
const root = await P.getRootItem();
let target = root;
const binName = {json.dumps(bin)};
if (binName) {{
  let b = (await root.getItems()).find((i) => i.name === binName);
  if (!b) {{ tx("Motion DNA: bin", () => root.createBinAction(binName, true)); b = (await root.getItems()).find((i) => i.name === binName); }}
  if (b) target = ppro.FolderItem.cast(b);
}}
const ok = await P.importFiles([f], true, target, false);
return {{ ok, name: f.split("/").pop(), bin: binName || "(root)" }};""", premiere, timeout=120)
    return f"Imported {r['name']} into {r['bin']} (Premiere {v})." if r["ok"] else f"Premiere refused to import {p.name}."


def t_place_clip(item, sequence=None, track=1, time_s=0.0, mode="overwrite", audio_track=None, after=False, premiere=None):
    a_idx = -1 if audio_track is None else int(audio_track) - 1
    r, v = run(f"""
const seq = await seqBy({json.dumps(sequence)});
const it = await findItem({json.dumps(item)});
if (!it) throw new Error("No project item named " + {json.dumps(item)} + " (import it first)");
const ed = ppro.SequenceEditor.getEditor(seq);
const v = {int(track) - 1}, a = {a_idx};
let at = {float(time_s)};
if ({json.dumps(bool(after))}) {{ for (const c of await clipsOf(seq, "video", v)) at = Math.max(at, (await c.getEndTime()).seconds); }}   // no gap after the last clip
const T = ppro.TickTime.createWithSeconds(at);
tx("Motion DNA: place " + it.name, () => {json.dumps(mode)} === "insert" ? ed.createInsertProjectItemAction(it, T, v, a, false) : ed.createOverwriteItemAction(it, T, v, a));
return (await clipsOf(seq, "video", v)).length;""", premiere)
    return f"Placed {item} on V{track} at {time_s}s ({mode}) in {sequence or 'the active sequence'}; V{track} now has {r} clip(s)."


PROPS = {   # property -> (component match name, param index, kind)
    "position_x": ("AE.ADBE Motion", 0, "x"), "position_y": ("AE.ADBE Motion", 0, "y"),
    "scale": ("AE.ADBE Motion", 1, "n"), "rotation": ("AE.ADBE Motion", 4, "n"), "opacity": ("AE.ADBE Opacity", 0, "n"),
}


def t_animate(property, start, end, sequence=None, track=1, clip=0, curve="Land", duration="Arrive", at_s=0.0, premiere=None):
    """Bake a token curve: one Linear keyframe per frame, read from the token bezier (exact on every frame)."""
    if property not in PROPS:
        raise ValueError(f"property must be one of {list(PROPS)}")
    tok = _tokens()
    ez = next((e for e in tok["easings"] if e["name"].lower() == str(curve).lower()), None)
    if not ez:
        raise ValueError(f"unknown curve {curve}; curves: {[e['name'] for e in tok['easings']]}")
    if isinstance(duration, str) and not duration.replace(".", "", 1).isdigit():
        d = next((d for d in tok["durations"] if d["name"].lower() == duration.lower()), None)
        if not d:
            raise ValueError(f"unknown duration {duration}; durations: {[d['name'] for d in tok['durations']]}")
        seconds = d["ms"] / 1000
    else:
        seconds = float(duration)
    steps = 400
    table = [float(start) + (float(end) - float(start)) * bezier_y(*ez["bezier"], i / steps) for i in range(steps + 1)]
    match, idx, kind = PROPS[property]
    r, v = run(f"""
const seq = await seqBy({json.dumps(sequence)});
const item = await clipAt(seq, {int(track)}, {json.dumps(clip)});
const comp = await componentByMatch(item, {json.dumps(match)});
const prm = comp.getParam({idx});
const rate = await fpsOf(seq);
const inS = (await item.getInPoint()).seconds;               // keyframe times are clip time
const t0 = inS + {float(at_s)};
const frames = Math.max(1, Math.round({seconds} * rate));
const table = {json.dumps(table)};
const val = (f) => {{ const k = f / frames * (table.length - 1); const i = Math.min(Math.floor(k), table.length - 2); return table[i] + (table[i + 1] - table[i]) * (k - i); }};
const kind = {json.dumps(kind)};
let other = null;
if (kind !== "n") {{ const sv = (await prm.getValueAtTime(ppro.TickTime.createWithSeconds(t0))).value; other = kind === "x" ? sv[1] : sv[0]; }}
const at = (f) => ppro.TickTime.createWithSeconds(t0 + f / rate);
if (!prm.isTimeVarying()) tx("Motion DNA: animate", () => prm.createSetTimeVaryingAction(true));
tx("Motion DNA: {property} on {curve}", () => {{
  const acts = [];
  for (let f = 0; f <= frames; f++) {{
    const x = val(f);
    const value = kind === "x" ? new ppro.PointF(x, other) : kind === "y" ? new ppro.PointF(other, x) : x;
    const kf = prm.createKeyframe(value); kf.position = at(f); acts.push(prm.createAddKeyframeAction(kf));
  }}
  return acts;
}});
tx("Motion DNA: linear keys", () => {{ const acts = []; for (let f = 0; f <= frames; f++) acts.push(prm.createSetInterpolationAtKeyframeAction(at(f), ppro.Constants.InterpolationMode.LINEAR, false)); return acts; }});
return {{ clip: await item.getName(), frames, rate }};""", premiere, timeout=60)
    unit = " (0-1 of the frame width/height)" if kind != "n" else ""
    return (f"{property} {start}→{end}{unit} on {r['clip']}: {curve} over {r['frames'] + 1} keyframes "
            f"({seconds:.3f}s at {r['rate']:.3f} fps), exact on every frame. Premiere {v}.")


def t_add_mogrt(path, sequence=None, track=2, time_s=0.0, premiere=None):
    p = pathlib.Path(path)
    if p.is_dir():   # After Effects writes "<name>.mogrt" inside the folder it is given
        inner = sorted(p.glob("*.mogrt"))
        if inner:
            p = inner[0]
    if not p.is_file():
        raise FileNotFoundError(f"{path} is not a .mogrt file")
    r, v = run(f"""
const seq = await seqBy({json.dumps(sequence)});
let items = null;
P.lockedAccess(() => {{ items = ppro.SequenceEditor.getEditor(seq).insertMogrtFromPath(FWD({json.dumps(str(p))}), ppro.TickTime.createWithSeconds({float(time_s)}), {int(track) - 1}, 0); }});
return items ? items.length : 0;""", premiere, timeout=90)
    return f"Inserted {p.name} on V{track} at {time_s}s ({r} item(s)). Use mogrt_params to see its controls (Premiere {v})."


def t_mogrt_params(sequence=None, track=2, clip=0, premiere=None):
    r, v = run(f"""
const seq = await seqBy({json.dumps(sequence)});
const item = await clipAt(seq, {int(track)}, {json.dumps(clip)});
const chain = await item.getComponentChain();
const out = [];
for (let c = 0; c < chain.getComponentCount(); c++) {{
  const k = chain.getComponentAtIndex(c);
  if ((await k.getMatchName()) !== "AE.ADBE Capsule") continue;
  for (let i = 0; i < k.getParamCount(); i++) {{
    const prm = k.getParam(i); let sv = null, text = null;
    try {{ sv = await prm.getStartValue(); if (sv && sv.getText) text = await sv.getText(); }} catch (e) {{}}
    out.push({{ i, name: prm.displayName, type: sv && sv.constructor && sv.constructor.name, text, value: sv && sv.value !== undefined ? sv.value : null }});
  }}
}}
return out;""", premiere)
    if not r:
        return (f"No editable MOGRT controls found (Premiere {v}). Controls are exposed only for After Effects-authored MOGRTs, "
                "and only from Premiere 27.0.")
    return json.dumps(r, indent=1)


def t_set_mogrt_text(text, param=None, sequence=None, track=2, clip=0, premiere=None):
    r, v = run(f"""
const seq = await seqBy({json.dumps(sequence)});
const item = await clipAt(seq, {int(track)}, {json.dumps(clip)});
const chain = await item.getComponentChain();
for (let c = 0; c < chain.getComponentCount(); c++) {{
  const k = chain.getComponentAtIndex(c);
  if ((await k.getMatchName()) !== "AE.ADBE Capsule") continue;
  for (let i = 0; i < k.getParamCount(); i++) {{
    const prm = k.getParam(i);
    if ({json.dumps(param)} && prm.displayName !== {json.dumps(param)}) continue;
    const sv = await prm.getStartValue();
    if (!(sv && sv.setText)) continue;
    sv.setText({json.dumps(text)});
    const kf = prm.createKeyframe(sv);
    tx("Motion DNA: MOGRT text", () => prm.createSetValueAction(kf, true));
    return prm.displayName;
  }}
}}
throw new Error("No MOGRT text control found (needs an After Effects MOGRT and Premiere 27+)");""", premiere)
    return f"Set {r} to {text!r} (Premiere {v})."


def t_set_mogrt_color(color, param=None, sequence=None, track=2, clip=0, premiere=None):
    """color: "#rrggbb" or [r, g, b] in 0-1."""
    if isinstance(color, str):
        h = color.lstrip("#"); rgb = [int(h[i:i + 2], 16) / 255 for i in (0, 2, 4)]
    else:
        rgb = [float(c) for c in color[:3]]
    r, v = run(f"""
const seq = await seqBy({json.dumps(sequence)});
const item = await clipAt(seq, {int(track)}, {json.dumps(clip)});
const k = await componentByMatch(item, "AE.ADBE Capsule");
if (!k) throw new Error("This clip has no MOGRT controls (needs an After Effects MOGRT and Premiere 27+)");
for (let i = 0; i < k.getParamCount(); i++) {{
  const prm = k.getParam(i);
  if ({json.dumps(param)} && prm.displayName !== {json.dumps(param)}) continue;
  const sv = await prm.getStartValue();
  if (!(sv && sv.constructor && sv.constructor.name === "Color")) continue;
  const kf = prm.createKeyframe(new ppro.Color({rgb[0]}, {rgb[1]}, {rgb[2]}, 1));
  tx("Motion DNA: MOGRT colour", () => prm.createSetValueAction(kf, true));
  return prm.displayName;
}}
throw new Error("No MOGRT colour control found");""", premiere)
    return f"Set {r} to {color} (Premiere {v})."


def t_render_frame(time_s=0.0, sequence=None, width=960, premiere=None):
    out = pathlib.Path(tempfile.gettempdir()) / "motion_dna_premiere"
    out.mkdir(exist_ok=True)
    name = f"frame_{int(time.time() * 1000)}.png"
    r, v = run(f"""
const seq = await seqBy({json.dumps(sequence)});
const fr = await seq.getFrameSize();
const w = {int(width)}, h = Math.round(w * fr.height / fr.width);
const ok = await ppro.Exporter.exportSequenceFrame(seq, ppro.TickTime.createWithSeconds({float(time_s)}), {json.dumps(name)}, BACK({json.dumps(str(out) + os.sep)}), w, h);
return {{ ok, seq: seq.name }};""", premiere)
    f = out / name
    for _ in range(20):
        if f.exists() and f.stat().st_size:
            break
        time.sleep(0.25)
    if not (r["ok"] and f.exists()):
        return f"Premiere did not write the frame ({r})."
    data = base64.b64encode(f.read_bytes()).decode()
    return {"content": [{"type": "text", "text": f"{r['seq']} at {time_s}s (Premiere {v}): {f}"},
                        {"type": "image", "data": data, "mimeType": "image/png"}]}


# ---------------------------------------------------------------- library presets (portable recipes from the AE engine)
PORTABLE = HERE / "portable_presets.json"   # copied from branch platforms-beta (research/platforms/export_portable.jsx)


def _portable():
    return json.loads(PORTABLE.read_text(encoding="utf-8"))


def _ae_bezier(ae):
    """After Effects influence/speed (speed as a multiple of the average) -> cubic-bezier."""
    o, i = ae.get("out", {}), ae.get("in", {})
    if o == "linear" or i == "linear":
        return [0, 0, 1, 1]
    x1 = o.get("influence", 33.3) / 100
    x2 = 1 - i.get("influence", 33.3) / 100
    return [x1, min(1.5, x1 * o.get("speed_x_avg", 1)), x2, 1 - (1 - x2) * i.get("speed_x_avg", 1)]


def _seg_curve(seg, tok):
    if seg.get("bezier"):
        return seg["bezier"]
    if seg.get("ease"):
        return next(e["bezier"] for e in tok["easings"] if e["name"] == seg["ease"])
    if seg.get("ae"):
        return _ae_bezier(seg["ae"])
    return [0, 0, 1, 1]


def _lerp(a, b, u):
    if isinstance(a, list):
        return [x + (y - x) * u for x, y in zip(a, b)]
    return a + (b - a) * u


def _expand(seg, tok):
    """A segment -> simple pieces (start_f, frames, from, to, bezier); `stops` become several pieces."""
    if seg["kind"] == "stops":
        out, f0, v0 = [], seg["start_f"], seg["from"]
        for st in seg["stops"]:
            bz = next(e["bezier"] for e in tok["easings"] if e["name"] == st["ease"])
            out.append((f0, st["frames"], v0, st["v"], bz))
            f0 += st["frames"]
            v0 = st["v"]
        return out
    return [(seg["start_f"], seg["frames"], seg["from"], seg["to"], _seg_curve(seg, tok))]


def _channel_value(pieces, f):
    """Value of a channel at template frame f (30 fps): the first `from` before, the last `to` after."""
    pieces = sorted(pieces, key=lambda p: p[0])
    if f <= pieces[0][0]:
        return pieces[0][2]
    for (s0, n, a, b, bz) in pieces:
        if s0 <= f <= s0 + n:
            u = 1.0 if n == 0 else (f - s0) / n
            return _lerp(a, b, bezier_y(*bz, u))
    return max(pieces, key=lambda p: p[0] + p[1])[3]


def t_list_presets(query=None):
    d = _portable()
    rows = []
    for name, p in d["presets"].items():
        if query and query.lower() not in name.lower():
            continue
        chans = sorted({s.get("channel") or "effect" for ph in ("in", "out") for s in p.get(ph, [])})
        if name in d["portable"]:
            rows.append(f"OK  {name}: {', '.join(chans)}")
        else:
            rows.append(f"AE  {name}: {', '.join(chans)} (After Effects only: {', '.join(p.get('ae_only', [])) or 'effects'})")
    return f"{len(rows)} presets (OK = works in Premiere; AE = needs After Effects):\n" + "\n".join(rows)


def t_apply_preset(preset, sequence=None, track=1, clip=0, phase="in", duration=1.0, intensity=1.0, premiere=None):
    d, tok = _portable(), _tokens()
    p = d["presets"].get(preset) or next((v for k, v in d["presets"].items() if k.lower() == str(preset).lower()), None)
    if not p:
        raise ValueError(f"unknown preset {preset}; see list_presets")
    info, v = run(f"""
const seq = await seqBy({json.dumps(sequence)});
const item = await clipAt(seq, {int(track)}, {json.dumps(clip)});
const fr = await seq.getFrameSize();
const motion = await componentByMatch(item, "AE.ADBE Motion"), opa = await componentByMatch(item, "AE.ADBE Opacity");
const t = (await item.getInPoint()).seconds, dur = (await item.getEndTime()).seconds - (await item.getStartTime()).seconds;
const at = ppro.TickTime.createWithSeconds(t + dur / 2);       // rest values: the middle of the clip
const val = async (prm) => (await prm.getValueAtTime(at)).value;
return {{ name: await item.getName(), fps: await fpsOf(seq), w: fr.width, h: fr.height, inS: t, dur,
  pos: await val(motion.getParam(0)), scale: await val(motion.getParam(1)), scaleW: await val(motion.getParam(2)),
  rot: await val(motion.getParam(4)), opacity: await val(opa.getParam(0)) }};""", premiere)
    fps, k = info["fps"], float(intensity)
    tracks, skipped = {}, set()
    for ph in (["in", "out"] if phase == "both" else [phase]):
        pieces = {}
        for sg in p.get(ph, []):
            ch = sg.get("channel")
            if ch not in ("position", "scale", "opacity", "rotation"):
                skipped.add(str(ch or sg.get("prop")))
                continue
            pieces.setdefault(ch, []).extend(_expand(sg, tok))
        if not pieces:
            continue
        total = max(pc[0] + pc[1] for lst in pieces.values() for pc in lst)   # template frames at 30 fps
        span = total / 30 * float(duration)
        n = max(1, round(span * fps))
        t0 = 0.0 if ph == "in" else max(0.0, info["dur"] - span)
        for ch, pcs in pieces.items():
            for f in range(n + 1):
                x = _channel_value(pcs, f / n * total)
                if ch == "position":   # template offsets are pixels: convert to 0-1 of this frame
                    x = [info["pos"][0] + x[0] * k / info["w"], info["pos"][1] + x[1] * k / info["h"]]
                elif ch == "scale":
                    x = [info["scaleW"] * (1 + (x[0] - 1) * k), info["scale"] * (1 + (x[1] - 1) * k)]
                elif ch == "opacity":
                    x = info["opacity"] * x
                else:
                    x = info["rot"] + x * k
                tracks.setdefault(ch, []).append((t0 + f / fps, x))
    if not tracks:
        return f"{preset} has nothing Premiere can animate (it uses {', '.join(sorted(skipped))}: After Effects only)."
    # Full-frame footage must never show its edges (a black band in the first frames of Glide In, Slide Land…):
    # overscale it just enough for the whole move. Clips smaller than the frame (graphics, cut-outs) are left alone.
    guard = 1.0
    try:
        media, _ = _clip_media(sequence, track, clip, premiere)
        import cv2
        cap = cv2.VideoCapture(media["path"])
        mw, mh = cap.get(cv2.CAP_PROP_FRAME_WIDTH), cap.get(cv2.CAP_PROP_FRAME_HEIGHT)
        cap.release()
        W, H = info["w"], info["h"]
        rest_s = info["scale"] / 100
        if mw and mh and mw * rest_s >= W - 1 and mh * rest_s >= H - 1:
            sc = {round(t, 4): x for t, x in tracks.get("scale", [])}
            po = {round(t, 4): x for t, x in tracks.get("position", [])}
            for t in sorted(set(sc) | set(po)):
                sx, sy = (sc.get(t) or [info["scaleW"], info["scale"]])
                px, py = po.get(t) or info["pos"]
                dx, dy = abs(px - 0.5) * W, abs(py - 0.5) * H
                need = max((W / 2 + dx) / max(1e-6, mw * sx / 200), (H / 2 + dy) / max(1e-6, mh * sy / 200))
                guard = max(guard, need)
            if guard > 1.0005:
                guard *= 1.002   # a hair more, so no half-pixel edge either
                if "scale" in tracks:
                    tracks["scale"] = [(t, [x[0] * guard, x[1] * guard]) for t, x in tracks["scale"]]
                else:
                    tracks["scale"] = [(0.0, [info["scaleW"] * guard, info["scale"] * guard])]
    except Exception:
        guard = 1.0
    nonuniform = any(abs(x[0] - x[1]) > 1e-6 for _, x in tracks.get("scale", []))
    r, v = run(f"""
const seq = await seqBy({json.dumps(sequence)});
const item = await clipAt(seq, {int(track)}, {json.dumps(clip)});
const motion = await componentByMatch(item, "AE.ADBE Motion"), opa = await componentByMatch(item, "AE.ADBE Opacity");
const inS = {info["inS"]};
const T = {json.dumps(tracks)};
const nonuniform = {json.dumps(nonuniform)};
if (nonuniform) {{ const u = motion.getParam(3); tx("Motion DNA: non-uniform scale", () => u.createSetValueAction(u.createKeyframe(false), true)); }}
const jobs = [];
if (T.position) jobs.push([motion.getParam(0), T.position.map(([s, x]) => [s, new ppro.PointF(x[0], x[1])])]);
if (T.scale) {{ jobs.push([motion.getParam(1), T.scale.map(([s, x]) => [s, nonuniform ? x[1] : x[0]])]); if (nonuniform) jobs.push([motion.getParam(2), T.scale.map(([s, x]) => [s, x[0]])]); }}
if (T.rotation) jobs.push([motion.getParam(4), T.rotation]);
if (T.opacity) jobs.push([opa.getParam(0), T.opacity]);
let keys = 0;
for (const [prm, list] of jobs) {{
  if (!prm.isTimeVarying()) tx("Motion DNA: animate", () => prm.createSetTimeVaryingAction(true));
  const at = (s) => ppro.TickTime.createWithSeconds(inS + s);
  tx("Motion DNA: preset", () => list.map(([s, x]) => {{ const kf = prm.createKeyframe(x); kf.position = at(s); return prm.createAddKeyframeAction(kf); }}));
  tx("Motion DNA: linear", () => list.map(([s]) => prm.createSetInterpolationAtKeyframeAction(at(s), ppro.Constants.InterpolationMode.LINEAR, false)));
  keys += list.length;
}}
return keys;""", premiere, timeout=90)
    note = f" Skipped (After Effects only): {', '.join(sorted(skipped))}." if skipped else ""
    if guard > 1.0005:
        note += f" Overscaled x{guard:.3f} so the footage never shows its edges during the move."
    return (f"{preset} ({phase}) on {info['name']}: {', '.join(tracks)} baked, {r} keyframes, exact on every frame at "
            f"{fps:.3f} fps (Premiere {v}).{note}")


# ---------------------------------------------------------------- reformat (16:9 -> 9:16 and any size)
FORMATS = {"16:9": (1920, 1080), "9:16": (1080, 1920), "1:1": (1080, 1080), "4:5": (1080, 1350), "4:3": (1440, 1080), "21:9": (2560, 1080)}


def t_reformat_sequence(target, sequence=None, name=None, footage="fill", graphics="fit", focus_x=0.5, focus_y=0.5, follow=True, premiere=None):
    """Duplicate a sequence at another size and re-fit every clip (keyframes included)."""
    w, h = FORMATS.get(str(target), (None, None))
    if w is None:
        try:
            w, h = (int(x) for x in str(target).lower().split("x"))
        except ValueError:
            raise ValueError(f"target is a ratio {list(FORMATS)} or WIDTHxHEIGHT")
    r, v = run(f"""
let stage = "start";
try {{
const src = await seqBy({json.dumps(sequence)});
const fr = await src.getFrameSize();
const W0 = fr.width, H0 = fr.height, W = {w}, H = {h};
const newName = {json.dumps(name)} || (src.name + " " + W + "x" + H);
// objects go stale after each edit ("The script object is no longer valid"): look the sequence up again every step
const byName = async (n) => (await P.getSequences()).find((s) => s.name === n);
let seq = await byName(newName);
if (seq) {{
  const f1 = await seq.getFrameSize();
  if (f1.width === W && f1.height === H) throw new Error("A sequence named " + newName + " already exists at " + W + "x" + H);
  // a copy left by an interrupted run, still at the old size: carry on with it
}} else {{
  const before = (await P.getSequences()).map((s) => s.guid.toString());
  stage = "duplicate"; tx("Motion DNA: duplicate", () => src.createCloneAction());
  const copy = (await P.getSequences()).find((s) => !before.includes(s.guid.toString()));
  if (!copy) throw new Error("Premiere did not duplicate the sequence");
  const pi = await copy.getProjectItem();
  stage = "rename"; tx("Motion DNA: rename", () => pi.createSetNameAction(newName));
  seq = await byName(newName);
}}
stage = "frame size"; const st = await seq.getSettings();
const rect = await st.getVideoFrameRect(); rect.width = W; rect.height = H;
await st.setVideoFrameRect(rect);
tx("Motion DNA: frame size", () => seq.createSetSettingsAction(st));
seq = await byName(newName);
const cover = Math.max(W / W0, H / H0), fit = Math.min(W / W0, H / H0);
const mode = {{ footage: {json.dumps(footage)}, graphics: {json.dumps(graphics)} }};
const focus = [{float(focus_x)}, {float(focus_y)}];
const report = [];
const nTracks = await seq.getVideoTrackCount();
for (let t = 0; t < nTracks; t++) {{
  const nClips = (await clipsOf(seq, "video", t)).length;
  for (let ci = 0; ci < nClips; ci++) {{
    stage = "read V" + (t + 1) + " clip " + ci; seq = await byName(newName);                                 // fresh objects after every edit
    const it = (await clipsOf(seq, "video", t))[ci];
    const motion = await componentByMatch(it, "AE.ADBE Motion");
    if (!motion) continue;
    const kind = (await componentByMatch(it, "AE.ADBE Capsule")) ? "graphics" : "footage";
    const m = mode[kind];
    const k = m === "fill" ? cover : m === "fit" ? fit : 1;
    // positions are 0-1 of the frame: keep each clip's pixel offset from the centre, scaled by k;
    // cropped footage keeps the focus point in the centre
    const c = kind === "footage" && m === "fill" ? focus : [0.5, 0.5];
    const remap = (p) => new ppro.PointF(0.5 + (p[0] - c[0]) * W0 * k / W, 0.5 + (p[1] - c[1]) * H0 * k / H);
    const pos = motion.getParam(0), sc = motion.getParam(1), scw = motion.getParam(2);
    const mid = ppro.TickTime.createWithSeconds((await it.getInPoint()).seconds + 0.01);
    // read every value first, then create the actions inside the transaction (actions built outside go stale)
    const plan = [];
    for (const [prm, f] of [[sc, (x) => x * k], [scw, (x) => x * k], [pos, remap]]) {{
      if (prm.isTimeVarying()) {{
        const keys = [];
        for (const tt of prm.getKeyframeListAsTickTimes()) keys.push([tt, (await prm.getValueAtTime(tt)).value]);
        plan.push([prm, f, keys]);
      }} else {{
        plan.push([prm, f, null, (await prm.getValueAtTime(mid)).value]);
      }}
    }}
    stage = "refit V" + (t + 1) + " clip " + ci;
    tx("Motion DNA: refit", () => {{
      const acts = [];
      for (const [prm, f, keys, still] of plan) {{
        if (keys) for (const [tt, val] of keys) {{ const kf = prm.createKeyframe(f(val)); kf.position = tt; acts.push(prm.createAddKeyframeAction(kf)); }}
        else acts.push(prm.createSetValueAction(prm.createKeyframe(f(still)), true));
      }}
      return acts;
    }});
    // responsive Motion DNA text MOGRTs ("Text width %", "Max scale %"): the text takes the share of the new frame's
    // width that reads well in that format, and its size cap grows by as much as the clip shrank
    let textNote = null;
    if (kind === "graphics") {{
      const cap = await componentByMatch(it, "AE.ADBE Capsule");
      if (cap) {{
        const want = W / H < 0.7 ? 86 : W / H < 1.2 ? 80 : null;   // 9:16 -> 86 %, 1:1 / 4:5 -> 80 %, wider: keep
        const sets = [];
        for (let i = 0; i < cap.getParamCount(); i++) {{
          const prm = cap.getParam(i);
          if (prm.displayName === "Text width %" && want) sets.push([prm, want]);
          // MOGRT sliders stop at 100 in Premiere: the kit's "Max size" (shown as "Max scale %") is 0-100 = a 0-200 % cap
          if (prm.displayName === "Max scale %" || prm.displayName === "Max size") {{ const cur = (await prm.getValueAtTime(mid)).value; sets.push([prm, Math.min(100, Math.round(cur / k))]); }}
        }}
        if (sets.length) {{
          tx("Motion DNA: responsive text", () => sets.map(([prm, val]) => prm.createSetValueAction(prm.createKeyframe(val), true)));
          textNote = sets.map(([prm, val]) => prm.displayName + " " + val).join(", ");
        }}
      }}
    }}
    report.push({{ track: "V" + (t + 1), t: t + 1, ci, clip: await it.getName(), kind, mode: m, factor: +k.toFixed(3), text: textNote }});
  }}
}}
await P.openSequence(seq);
const f2 = await seq.getFrameSize();
return {{ name: newName, size: f2.width + "x" + f2.height, from: W0 + "x" + H0, clips: report }};
}} catch (e) {{ throw new Error("reformat, " + stage + ": " + e.message); }}""", premiere, timeout=180)
    lines = "\n".join(f"  {c['track']} {c['clip']}: {c['kind']} -> {c['mode']} (x{c['factor']})"
                      + (f", text: {c['text']}" if c.get("text") else "") for c in r["clips"])
    for c in r["clips"]:   # kit titles (responsive text): into the band that reads in this format, clear of the face
        if c["kind"] == "graphics" and c.get("text"):
            try:
                fw, fh = (int(x) for x in r["size"].split("x"))
                st, _ = run(f"return (await (await seqBy({json.dumps(r['name'])}).then((s) => clipAt(s, {c['t']}, {c['ci']}))).getStartTime()).seconds;", premiere)
                ty = _title_band(fw, fh, _face_y(r["name"], st + 1.0, premiere))
                _place_title(r["name"], c["t"], c["ci"], ty, premiere)
                lines += f"\n  {c['track']} {c['clip']}: text at y {ty:.2f} of the frame"
            except Exception as e:
                lines += f"\n  {c['clip']}: title not re-placed ({str(e)[:100]})"
    if follow and footage == "fill":   # keep each person in frame instead of a fixed centre crop
        for c in r["clips"]:
            if c["kind"] == "footage":
                try:
                    lines += "\n  " + t_reframe_follow(sequence=r["name"], track=c["t"], clip=c["ci"], premiere=premiere)
                except Exception as e:   # a still or a clip with no person: keep the centre crop
                    lines += f"\n  {c['clip']}: centre crop (no tracking: {str(e)[:120]})"
    return (f"{r['name']}: {r['from']} -> {r['size']} (Premiere {v}); the original is untouched.\n{lines}\n"
            "Check it with render_frame; move what footage keeps in frame with focus_x/focus_y.")


# ---------------------------------------------------------------- clips on disk: speed ramps and subject tracking
def _clip_media(sequence, track, clip, premiere):
    r, v = run(f"""
const seq = await seqBy({json.dumps(sequence)});
const it = await clipAt(seq, {int(track)}, {json.dumps(clip)});
const pi = ppro.ClipProjectItem.cast(await it.getProjectItem());
return {{ name: await it.getName(), path: await pi.getMediaFilePath(), start: (await it.getStartTime()).seconds,
  end: (await it.getEndTime()).seconds, inS: (await it.getInPoint()).seconds, fps: await fpsOf(seq), project: P.path }};""", premiere)
    r["path"] = r["path"].replace("\\\\?\\", "")
    return r, v


def _renders_dir(project_path):
    p = pathlib.Path(str(project_path).replace("\\\\?\\", "")).parent / "Motion DNA renders"
    p.mkdir(parents=True, exist_ok=True)
    return p


def t_speed_ramp(sequence=None, track=1, clip=0, at_s=1.0, hold_s=1.0, min_speed=0.25, ramp_s=0.5,
                 curve_down="Land", curve_up="Ramp", premiere=None):
    """Premiere's API has no time remapping: render the ramp (only this clip) on the library's curves and swap it in."""
    import cv2
    tok = _tokens()
    bz = {e["name"].lower(): e["bezier"] for e in tok["easings"]}
    down, up = bz[curve_down.lower()], bz[curve_up.lower()]
    info, v = _clip_media(sequence, track, clip, premiere)
    cap = cv2.VideoCapture(info["path"])
    fps = cap.get(cv2.CAP_PROP_FPS) or 24
    n = int(cap.get(cv2.CAP_PROP_FRAME_COUNT))
    w, h = int(cap.get(cv2.CAP_PROP_FRAME_WIDTH)), int(cap.get(cv2.CAP_PROP_FRAME_HEIGHT))
    src_len = n / fps
    # speed as a function of output time: 1 -> min (curve_down) -> hold -> 1 (curve_up)
    times, t_src, t_out, dt = [], 0.0, 0.0, 1 / fps
    phase_start = None
    while t_src < src_len - dt / 2:
        times.append(t_src)
        if t_src < at_s:
            s = 1.0
        else:
            if phase_start is None:
                phase_start = t_out
            u = t_out - phase_start
            if u < ramp_s:
                s = 1 + (min_speed - 1) * bezier_y(*down, u / ramp_s)
            elif u < ramp_s + hold_s:
                s = min_speed
            elif u < 2 * ramp_s + hold_s:
                s = min_speed + (1 - min_speed) * bezier_y(*up, (u - ramp_s - hold_s) / ramp_s)
            else:
                s = 1.0
        t_src += s * dt
        t_out += dt
    out = _renders_dir(info["project"]) / f"{pathlib.Path(info['path']).stem}_ramp_{int(min_speed * 100)}.mp4"
    ff = subprocess.Popen(["ffmpeg", "-v", "error", "-y", "-f", "rawvideo", "-pix_fmt", "bgr24", "-s", f"{w}x{h}", "-r", str(fps),
                           "-i", "-", "-c:v", "libx264", "-crf", "16", "-pix_fmt", "yuv420p", str(out)], stdin=subprocess.PIPE)
    idx, a, b = -1, None, None
    for ts in times:   # frames are read in order; slow parts blend the two neighbouring frames
        f = ts * fps
        i0 = int(f)
        while idx < i0 + 1:
            ok, fr = cap.read()
            if not ok:
                break
            a, b = b, fr
            idx += 1
        fa = a if a is not None else b
        frac = f - i0
        frame = cv2.addWeighted(fa, 1 - frac, b, frac, 0) if frac > 0.01 and fa is not None else (fa if fa is not None else b)
        ff.stdin.write(frame.tobytes())
    ff.stdin.close()
    ff.wait()
    cap.release()
    t_import_media(str(out), bin="Motion DNA renders", premiere=premiere)
    t_place_clip(out.name, sequence=sequence, track=track, time_s=info["start"], premiere=premiere)
    return (f"Speed ramp on {info['name']}: from {at_s}s it drops to {min_speed:g}x on {curve_down} ({ramp_s}s), holds {hold_s}s, "
            f"comes back on {curve_up}; {len(times)} frames ({len(times) / fps:.2f}s, was {src_len:.2f}s), slow part frame-blended. "
            f"Rendered to {out} and placed on V{track} at {info['start']:.2f}s over the original (Premiere's API has no time "
            f"remapping, so only this clip is a render; the source file is untouched). Note: no audio in the ramped clip.")


def t_reframe_follow(sequence=None, track=1, clip=0, focus_y=None, deadzone=0.03, premiere=None):
    """Keep the person in frame: track the clip's subject and key its position so the subject stays centred."""
    info, v = _clip_media(sequence, track, clip, premiere)
    src = pathlib.Path(info["path"])
    cache = _renders_dir(info["project"]) / f"{src.stem}.track.json"
    if not cache.exists():
        subprocess.run([sys.executable, str(HERE / "track_subject.py"), str(src), "--out", str(cache), "--deadzone", str(deadzone)],
                       check=True, capture_output=True, text=True)
    tr = json.loads(cache.read_text(encoding="utf-8"))
    pts = [[p[0], p[1], p[2]] for p in tr["points"]]
    r, v = run(f"""
const seq = await seqBy({json.dumps(sequence)});
const it = await clipAt(seq, {int(track)}, {json.dumps(clip)});
const fr = await seq.getFrameSize();
const W = fr.width, H = fr.height, W0 = {tr["width"]}, H0 = {tr["height"]};
const motion = await componentByMatch(it, "AE.ADBE Motion");
const pos = motion.getParam(0), sc = motion.getParam(1);
const inS = (await it.getInPoint()).seconds;
const k = (await sc.getValueAtTime(ppro.TickTime.createWithSeconds(inS + 0.01))).value / 100;   // clip scale
const cw = W0 * k, ch = H0 * k;                                // the clip's size on screen (px)
const clamp = (p, size, frame) => {{ const lo = 1 - size / (2 * frame), hi = size / (2 * frame); return lo > hi ? 0.5 : Math.min(hi, Math.max(lo, p)); }};
const PTS = {json.dumps(pts)};
const fy = {json.dumps(focus_y)};
const keys = PTS.map(([t, u, vv]) => [t, clamp(0.5 + cw * (0.5 - u) / W, cw, W), clamp(0.5 + ch * (0.5 - (fy == null ? vv : fy)) / H, ch, H)]);
if (!pos.isTimeVarying()) tx("Motion DNA: follow", () => pos.createSetTimeVaryingAction(true));
tx("Motion DNA: follow the subject", () => keys.map(([t, x, y]) => {{ const kf = pos.createKeyframe(new ppro.PointF(x, y)); kf.position = ppro.TickTime.createWithSeconds(inS + t); return pos.createAddKeyframeAction(kf); }}));
return {{ clip: await it.getName(), keys: keys.length, k, xs: [Math.min(...keys.map((q) => q[1])), Math.max(...keys.map((q) => q[1]))] }};""", premiere, timeout=90)
    return (f"{r['clip']}: follows the person with {r['keys']} position keys (tracked {tr['found']}/{tr['samples']} samples, "
            f"spring-smoothed), clip x between {r['xs'][0]:.3f} and {r['xs'][1]:.3f} of the frame, never past its edges. Premiere {v}.")


# ---------------------------------------------------------------- titles from the Motion DNA kit
KIT = HERE / "kit"   # .mogrt titles built once in After Effects (text read from a packed CSV); users never need AE


def t_list_titles():
    sys.path.insert(0, str(HERE))
    import mogrt_stamp
    rows = []
    for f in sorted(KIT.glob("*.mogrt")):
        ctr = ", ".join(f"{c['name']} ({ {6: 'text', 4: 'colour', 2: 'slider'}.get(c['type'], c['type']) })" for c in mogrt_stamp.controls(f))
        rows.append(f"{f.stem}: {ctr}")
    return "Motion DNA titles (kit):\n" + "\n".join(rows) if rows else "No titles in the kit yet."


KIT_TEXT_Y = 780 / 1080   # where the kit titles' text sits in their own 1920x1080 comp (0-1)


def _face_y(sequence, t, premiere):
    """The tracked person's height (0-1 of the frame) in the V1 clip playing at time t, or None (no clip, no person)."""
    try:
        r, _ = run(f"""
const seq = await seqBy({json.dumps(sequence)});
for (const [ci, it] of (await clipsOf(seq, "video", 0)).entries()) {{
  const s = (await it.getStartTime()).seconds, e = (await it.getEndTime()).seconds;
  if (s <= {float(t)} && {float(t)} < e) return {{ ci, s }};
}}
return null;""", premiere)
        if not r:
            return None
        info, _ = _clip_media(sequence, 1, r["ci"], premiere)
        cache = _renders_dir(info["project"]) / f"{pathlib.Path(info['path']).stem}.track.json"
        if not cache.exists():
            subprocess.run([sys.executable, str(HERE / "track_subject.py"), info["path"], "--out", str(cache)], check=True, capture_output=True)
        pts = json.loads(cache.read_text(encoding="utf-8"))["points"]
        local = float(t) - r["s"]
        return min(pts, key=lambda p: abs(p[0] - local))[2]
    except Exception:
        return None


def _title_band(fw, fh, face):
    """Where a title's text goes (0-1 of the frame height): clear of the face, inside the feed safe box."""
    # `face` is the tracked point, which sits at the chin (head-and-shoulders box centre): the text goes below it with
    # a margin (the lower band, inside the feed safe box y 270-1440 of 1920), and only above the head when the person
    # is so low that the lower band would cover the face.
    portrait, square = fh / fw > 1.2, abs(fh / fw - 1) <= 0.2
    low, high = (0.74, 0.16) if portrait else (0.84, 0.14) if square else (0.86, 0.12)
    return low if face is None or face < low - 0.08 else high


def _place_title(sequence, track, clip, text_y, premiere):
    """Move a kit title so its text centre sits at text_y (0-1 of the frame), whatever the clip's scale."""
    run(f"""
const seq = await seqBy({json.dumps(sequence)});
const it = await clipAt(seq, {int(track)}, {json.dumps(clip)});
const fr = await seq.getFrameSize();
const m = await componentByMatch(it, "AE.ADBE Motion");
const pos = m.getParam(0), sc = m.getParam(1);
const t0 = ppro.TickTime.createWithSeconds((await it.getInPoint()).seconds + 0.01);
const k = (await sc.getValueAtTime(t0)).value / 100;
const x = (await pos.getValueAtTime(t0)).value[0];
const y = {float(text_y)} - ({KIT_TEXT_Y} - 0.5) * 1080 * k / fr.height;   // the text sits below the comp centre
tx("Motion DNA: title place", () => pos.createSetValueAction(pos.createKeyframe(new ppro.PointF(x, y)), true));
return y;""", premiere)


def t_add_title(text, title="headline", sequence=None, track=2, time_s=0.0, color=None, text_width=None, max_size=None, y=None, premiere=None):
    """Insert a kit title with its text. The text is stamped into a copy of the template (API-set MOGRT text is dropped
    by Premiere's exports); colour and sliders are set through the API, which exports fine."""
    sys.path.insert(0, str(HERE))
    import mogrt_stamp
    src = KIT / f"{title}.mogrt"
    if not src.exists():
        raise FileNotFoundError(f"no kit title {title!r}; see list_titles")
    textc = next(c["name"] for c in mogrt_stamp.controls(src) if c["type"] == 6)
    r0, v = run("return P.path;", premiere)
    safe = "".join(ch if ch.isalnum() else "_" for ch in text)[:40]
    out, cap_name = mogrt_stamp.stamp(src, _renders_dir(r0) / "mogrt" / f"{title}_{safe}.mogrt", {textc: text})
    t_add_mogrt(str(out), sequence=sequence, track=track, time_s=time_s, premiere=premiere)
    sets = {}
    if color is not None:
        sets["colour"] = color
    if text_width is not None:
        sets["Text width %"] = text_width
    if max_size is not None:
        sets["Max size"] = max_size
    if sets:
        rgb = None
        if color is not None:
            h = str(color).lstrip("#"); rgb = [int(h[i:i + 2], 16) / 255 for i in (0, 2, 4)]
        run(f"""
const seq = await seqBy({json.dumps(sequence)});
const v = {int(track) - 1};
let item = null;
for (const it of await clipsOf(seq, "video", v)) if (Math.abs((await it.getStartTime()).seconds - {float(time_s)}) < 0.05) item = it;
if (!item) throw new Error("title not found on V{int(track)} at {time_s}s");
let cap = null;
for (let k = 0; k < 20 && !cap; k++) {{ cap = await componentByMatch(item, "AE.ADBE Capsule"); if (!cap) await new Promise((r) => setTimeout(r, 300)); }}   // controls load a moment after insert
if (!cap) throw new Error("the title's controls did not load");
const S = {json.dumps({k: val for k, val in sets.items() if k != "colour"})}, RGB = {json.dumps(rgb)};
const acts = [];
for (let i = 0; i < cap.getParamCount(); i++) {{
  const p = cap.getParam(i);
  if (RGB && /colou?r/i.test(p.displayName)) acts.push([p, new ppro.Color(RGB[0], RGB[1], RGB[2], 1)]);
  else if (S[p.displayName] != null) acts.push([p, Math.max(0, Math.min(100, S[p.displayName]))]);
}}
tx("Motion DNA: title look", () => acts.map(([p, val]) => p.createSetValueAction(p.createKeyframe(val), true)));
return acts.length;""", premiere)
    # place it clear of the person under it (tracked face), in the band that reads in this format
    fr, _ = run(f"const f = await (await seqBy({json.dumps(sequence)})).getFrameSize(); return [f.width, f.height];", premiere)
    face = _face_y(sequence, float(time_s) + 1.0, premiere)
    ty = float(y) if y is not None else _title_band(fr[0], fr[1], face)
    r_ci, _ = run(f"""
const seq = await seqBy({json.dumps(sequence)});
const items = await clipsOf(seq, "video", {int(track) - 1});
for (const [ci, it] of items.entries()) if (Math.abs((await it.getStartTime()).seconds - {float(time_s)}) < 0.05) return ci;
return 0;""", premiere)
    _place_title(sequence, track, r_ci, ty, premiere)
    sets["text at y"] = round(ty, 2)
    extra = ", ".join(f"{k} {val}" for k, val in sets.items())
    why = "" if y is not None else (" (clear of the face)" if face is not None else "")
    return f"Title {title!r} \"{text}\" on V{track} at {time_s}s{(' (' + extra + ')') if extra else ''}{why}; it exports with the text. Premiere {v}."


# ---------------------------------------------------------------- music and export
def _lufs(path):
    """Integrated loudness of a file (ffmpeg ebur128), or None."""
    r = subprocess.run(["ffmpeg", "-nostats", "-i", str(path), "-filter_complex", "ebur128", "-f", "null", "-"],
                       capture_output=True, text=True, encoding="utf-8", errors="replace")
    import re
    m = re.findall(r"I:\s+(-?[\d.]+) LUFS", r.stderr)
    return float(m[-1]) if m else None


def t_add_music(source, sequence=None, track=2, level_db=None, fade_in_s=0.5, fade_out_s=1.5, curve="Cruise", target_lufs=-14.0, premiere=None):
    """Lay a music bed under the edit: trimmed to the sequence, faded in/out on a library curve. Level: with a voice
    (other audio in the sequence) 16 dB under; alone, the gain that brings it to target_lufs (feed master ~-14)."""
    p = pathlib.Path(source)
    if p.exists():
        t_import_media(str(p), bin="Music", premiere=premiere)
        name = p.name
    else:
        name = source   # already in the project
    how = "set by hand"
    if level_db is None:
        others, _ = run(f"""
const seq = await seqBy({json.dumps(sequence)});
let n = 0;
for (let a = 0; a < await seq.getAudioTrackCount(); a++) if (a !== {int(track) - 1}) n += (await clipsOf(seq, "audio", a)).length;
return n;""", premiere)
        if others:
            level_db, how = -16.0, "16 dB under the voice"
        else:
            src_lufs = _lufs(p) if p.exists() else None
            level_db = max(-30.0, min(15.0, target_lufs - src_lufs)) if src_lufs is not None else 0.0
            how = f"music alone: {src_lufs:.1f} LUFS file -> {target_lufs:g} LUFS" if src_lufs is not None else "music alone (not measured)"
    tok = _tokens()
    bz = next(e["bezier"] for e in tok["easings"] if e["name"].lower() == curve.lower())
    lin = lambda db: 10 ** ((db - 15) / 20)   # Premiere's Level: linear gain, 0 dB = 0.1778, +15 dB = 1
    steps = 12
    fin = [(fade_in_s * i / steps, lin(-60 + (level_db + 60) * bezier_y(*bz, i / steps))) for i in range(steps + 1)] if fade_in_s else []
    fout = [(i / steps, lin(level_db + (-60 - level_db) * bezier_y(*bz, i / steps))) for i in range(steps + 1)] if fade_out_s else []
    r, v = run(f"""
const seq = await seqBy({json.dumps(sequence)});
const item = await findItem({json.dumps(name)});
if (!item) throw new Error("No project item named " + {json.dumps(name)});
const a = {int(track) - 1};
// the edit's end: the last video clip
let end = 0;
for (let t = 0; t < await seq.getVideoTrackCount(); t++) for (const it of await clipsOf(seq, "video", t)) end = Math.max(end, (await it.getEndTime()).seconds);
const ed = ppro.SequenceEditor.getEditor(seq);
tx("Motion DNA: music", () => ed.createOverwriteItemAction(item, ppro.TickTime.createWithSeconds(0), -1, a));
let clip = (await clipsOf(seq, "audio", a))[0];
if ((await clip.getEndTime()).seconds > end + 0.01) tx("Motion DNA: trim music", () => clip.createSetEndAction(ppro.TickTime.createWithSeconds(end)));
clip = (await clipsOf(seq, "audio", a))[0];
const chain = await clip.getComponentChain();
let lvl = null;
for (let c = 0; c < chain.getComponentCount(); c++) {{ const k = chain.getComponentAtIndex(c); if ((await k.getMatchName()) === "Internal Volume Stereo") lvl = k.getParam(1); }}
const inS = (await clip.getInPoint()).seconds, len = (await clip.getEndTime()).seconds - (await clip.getStartTime()).seconds;
const FIN = {json.dumps(fin)}, FOUT = {json.dumps(fout)}, FO = {float(fade_out_s)};
const keys = FIN.map(([s, g]) => [s, g]).concat(FOUT.map(([u, g]) => [len - FO + u * FO, g]));
if (keys.length) {{
  if (!lvl.isTimeVarying()) tx("Motion DNA: level", () => lvl.createSetTimeVaryingAction(true));
  tx("Motion DNA: music level", () => keys.map(([s, g]) => {{ const kf = lvl.createKeyframe(g); kf.position = ppro.TickTime.createWithSeconds(inS + s); return lvl.createAddKeyframeAction(kf); }}));
}} else tx("Motion DNA: music level", () => lvl.createSetValueAction(lvl.createKeyframe({lin(level_db)}), true));
return {{ len: +len.toFixed(2), keys: keys.length }};""", premiere, timeout=90)
    return (f"Music {name} on A{track}: {r['len']}s (trimmed to the edit), {level_db:+.1f} dB ({how}), fade in {fade_in_s}s / out {fade_out_s}s "
            f"on {curve} ({r['keys']} level keys). Premiere {v}.")


H264 = "C:/Program Files/Adobe/Adobe Premiere Pro 20{major}/MediaIO/systempresets/4E49434B_48323634/00 - Match Source - High bitrate.epr"


def t_export_sequence(sequence=None, out=None, preset=None, queue=False, premiere=None):
    """Export a sequence to H.264 (Match Source: the sequence's own size and rate) or any .epr preset."""
    r0, v = run(f"return {{ name: (await seqBy({json.dumps(sequence)})).name, project: P.path }};", premiere)
    major = v.split(".")[0][-2:]
    pre = preset or H264.format(major=major)
    dest = pathlib.Path(out) if out else _renders_dir(r0["project"]) / f"{r0['name']}.mp4"
    dest.parent.mkdir(parents=True, exist_ok=True)
    mode = "QUEUE_TO_AME" if queue else "IMMEDIATELY"
    t0 = time.time()
    r, v = run(f"""
const seq = await seqBy({json.dumps(sequence)});
const em = await ppro.EncoderManager.getManager();
return await em.exportSequence(seq, ppro.Constants.ExportType.{mode}, BACK({json.dumps(str(dest))}), BACK({json.dumps(pre)}), true);""",
               premiere, timeout=1800)
    if queue:
        return f"Queued {r0['name']} in Media Encoder -> {dest}."
    for _ in range(60):
        if dest.exists() and dest.stat().st_size:
            break
        time.sleep(1)
    ok = dest.exists() and dest.stat().st_size > 0
    return (f"Exported {r0['name']} -> {dest} ({dest.stat().st_size / 1e6:.1f} MB, {time.time() - t0:.0f}s)." if ok
            else f"Premiere answered {r} but {dest} was not written.")


def t_run_script(code, premiere=None, timeout_s=30):
    r, v = run(code, premiere, timeout=float(timeout_s))
    return json.dumps({"premiere": v, "result": r}, indent=1)


PREM = {"premiere": {"type": "string", "description": "Premiere version to use when several are open, e.g. \"26\" or \"27\" (default: the newest connection)"}}
SEQ = {"sequence": {"type": "string", "description": "sequence name (default: the active sequence)"}}
TOOLS_DEF = [
    ("ppro_status", t_ppro_status, "Which Premiere versions are connected, the open project and its sequences (fps, video tracks, which is active). Call it first.", {**PREM}),
    ("create_sequence", t_create_sequence, "Create a sequence in the open project (1080p; any frame rate, e.g. 23.976, 25, 29.97, 50, 59.94) and open it.",
     {"name": {"type": "string"}, "fps": {"type": "number"}, "open": {"type": "boolean"}, **PREM}, ["name"]),
    ("open_sequence", t_open_sequence, "Open (activate) a sequence by name.", {"name": {"type": "string"}, **PREM}, ["name"]),
    ("list_clips", t_list_clips, "Video and audio tracks of a sequence with each clip's index, name, start and end (s).", {**SEQ, **PREM}),
    ("import_media", t_import_media, "Import a file (or download a URL: Flora / Krea results) into the project, optionally into a bin (created if missing). The file is checked first: a failed import would open a dialog that blocks Premiere.",
     {"source": {"type": "string", "description": "file path or https URL"}, "bin": {"type": "string"}, "download_dir": {"type": "string"}, **PREM}, ["source"]),
    ("place_clip", t_place_clip, "Put a project item (by name) on a video track at a time, overwrite (default) or insert.",
     {"item": {"type": "string"}, **SEQ, "track": {"type": "integer", "description": "1 = V1"}, "time_s": {"type": "number"},
      "mode": {"type": "string", "enum": ["overwrite", "insert"]}, "audio_track": {"type": "integer"},
      "after": {"type": "boolean", "description": "place it right after the last clip on that track (no gap)"}, **PREM}, ["item"]),
    ("animate", t_animate, "Animate a clip on a Motion DNA token curve (Land, Pop, Snap, Cruise…; durations Tick..Stage or seconds). Baked: one keyframe per frame, exact on every frame (Premiere's API cannot ease keyframes). position_x/y are 0-1 of the frame; scale and opacity in %; rotation in degrees.",
     {"property": {"type": "string", "enum": list(PROPS)}, "start": {"type": "number"}, "end": {"type": "number"}, **SEQ,
      "track": {"type": "integer"}, "clip": {"description": "clip index on the track (0 = first) or its name"}, "curve": {"type": "string"},
      "duration": {"description": "token name (Arrive, Sweep…) or seconds"}, "at_s": {"type": "number", "description": "start, seconds from the clip's start"}, **PREM},
     ["property", "start", "end"]),
    ("add_mogrt", t_add_mogrt, "Insert a .mogrt (or the folder After Effects exported it into) on a video track at a time.",
     {"path": {"type": "string"}, **SEQ, "track": {"type": "integer"}, "time_s": {"type": "number"}, **PREM}, ["path"]),
    ("mogrt_params", t_mogrt_params, "The editable controls of a MOGRT clip (text, colours…). Only After Effects-authored MOGRTs, Premiere 27+.",
     {**SEQ, "track": {"type": "integer"}, "clip": {}, **PREM}),
    ("set_mogrt_text", t_set_mogrt_text, "Set the text of a MOGRT clip's text control. WARNING: Premiere shows it in the monitor but drops it in every export; for titles that must export use add_title.",
     {"text": {"type": "string"}, "param": {"type": "string"}, **SEQ, "track": {"type": "integer"}, "clip": {}, **PREM}, ["text"]),
    ("set_mogrt_color", t_set_mogrt_color, "Set a colour control of a MOGRT clip (the first one, or the one named `param`): \"#rrggbb\" or [r,g,b] 0-1. Premiere 27+, After Effects MOGRTs.",
     {"color": {"description": "#rrggbb or [r,g,b]"}, "param": {"type": "string"}, **SEQ, "track": {"type": "integer"}, "clip": {}, **PREM}, ["color"]),
    ("list_presets", t_list_presets, "Motion DNA presets (moves) and whether each works in Premiere (position, scale, rotation, opacity) or needs After Effects (blur, wipe, masks, 3D).", {"query": {"type": "string"}}),
    ("apply_preset", t_apply_preset, "Apply a Motion DNA preset (Slide Land, Scale Pop, Drop Bounce, Whip Pan…) to a clip: baked keyframes on the library's curves, exact on every frame, relative to the clip's own position/scale. phase in (clip start), out (clip end) or both; duration and intensity are multipliers.",
     {"preset": {"type": "string"}, **SEQ, "track": {"type": "integer"}, "clip": {}, "phase": {"type": "string", "enum": ["in", "out", "both"]},
      "duration": {"type": "number"}, "intensity": {"type": "number"}, **PREM}, ["preset"]),
    ("reformat_sequence", t_reformat_sequence, "Adapt a sequence to another format (9:16, 1:1, 4:5, 16:9, 4:3, 21:9 or WIDTHxHEIGHT): duplicates it (the original stays), changes the frame size and re-fits every clip, keyframes included. footage (clips) and graphics (MOGRTs) each fill, fit or keep; focus_x/focus_y (0-1) choose what footage keeps in frame when cropped.",
     {"target": {"type": "string"}, **SEQ, "name": {"type": "string"}, "footage": {"type": "string", "enum": ["fill", "fit", "keep"]},
      "graphics": {"type": "string", "enum": ["fit", "fill", "keep"]}, "focus_x": {"type": "number"}, "focus_y": {"type": "number"},
      "follow": {"type": "boolean", "description": "track the person in each footage clip and keep them centred (default true)"}, **PREM}, ["target"]),
    ("speed_ramp", t_speed_ramp, "Time remapping on the library's curves: from at_s (seconds into the clip) the speed drops to min_speed on curve_down over ramp_s, holds hold_s, and comes back on curve_up. Premiere's API has no time remapping, so this one clip is rendered (frame-blended slow motion) into 'Motion DNA renders' next to the project and placed over the original.",
     {**SEQ, "track": {"type": "integer"}, "clip": {}, "at_s": {"type": "number"}, "hold_s": {"type": "number"}, "min_speed": {"type": "number"},
      "ramp_s": {"type": "number"}, "curve_down": {"type": "string"}, "curve_up": {"type": "string"}, **PREM}),
    ("reframe_follow", t_reframe_follow, "Keep the person in frame after a reformat (16:9 -> 9:16…): tracks the clip's subject (OpenCV, cached next to the project), smooths it with a critically damped spring and keys the clip's position so the person stays centred, never showing the clip's edges.",
     {**SEQ, "track": {"type": "integer"}, "clip": {}, "focus_y": {"type": "number", "description": "fixed vertical focus 0-1 (default: follow)"}, "deadzone": {"type": "number"}, **PREM}),
    ("list_titles", t_list_titles, "The Motion DNA title kit (animated titles built from the library, e.g. headline with Chars Rise) and their controls.", {}),
    ("add_title", t_add_title, "Add a Motion DNA kit title with its text (and optional colour #rrggbb, text_width % of the frame, max_size 0-100). Use this, not set_mogrt_text: it is the only way the text survives export.",
     {"text": {"type": "string"}, "title": {"type": "string", "description": "kit name (default headline)"}, **SEQ, "track": {"type": "integer"},
      "time_s": {"type": "number"}, "color": {"type": "string"}, "text_width": {"type": "number"}, "max_size": {"type": "number"},
      "y": {"type": "number", "description": "text height 0-1 of the frame (default: the readable band clear of the person's face)"}, **PREM}, ["text"]),
    ("add_music", t_add_music, "Lay a music bed (file or project item) on an audio track: trimmed to the edit, faded in and out on a library curve; level: 16 dB under a voice, or music alone brought to -14 LUFS (feed master).",
     {"source": {"type": "string"}, **SEQ, "track": {"type": "integer", "description": "audio track, 1 = A1"}, "level_db": {"type": "number", "description": "default: 16 dB under a voice, or the level that brings music alone to target_lufs"},
      "target_lufs": {"type": "number"}, "fade_in_s": {"type": "number"}, "fade_out_s": {"type": "number"}, "curve": {"type": "string"}, **PREM}, ["source"]),
    ("export_sequence", t_export_sequence, "Export a sequence to an MP4 (H.264 Match Source: its own size and frame rate) or any .epr preset; immediately (waits) or queued in Media Encoder.",
     {**SEQ, "out": {"type": "string"}, "preset": {"type": "string"}, "queue": {"type": "boolean"}, **PREM}),
    ("render_frame", t_render_frame, "Export one frame of a sequence and look at it. Check your work with it.",
     {"time_s": {"type": "number"}, **SEQ, "width": {"type": "integer"}, **PREM}),
    ("run_script", t_run_script, "Advanced: run UXP JavaScript in Premiere (async function body with ppro, uxp, require, P = open project and the helpers seqBy, tx, clipAt, findItem, BACK, FWD). Use `return`.",
     {"code": {"type": "string"}, "timeout_s": {"type": "number"}, **PREM}, ["code"]),
]
INSTRUCTIONS = ("Motion DNA in Premiere (beta): drives the Premiere project the user has open through the Motion DNA UXP plugin. "
                "Start with ppro_status. Create or open sequences, import media (files or Flora/Krea URLs) and place it, animate clips "
                "on the library's token curves (animate: exact, one keyframe per frame), add MOGRTs (titles from After Effects; their "
                "text is editable from Premiere 27), and check every change with render_frame. Never save the project unless asked. "
                "If a call times out, Premiere is showing a dialog: ask the user to close it.")


# ---------------------------------------------------------------- JSON-RPC over stdio
def tool_list():
    out = []
    for t in TOOLS_DEF:
        name, _, desc, props = t[:4]
        req = t[4] if len(t) > 4 else []
        out.append({"name": name, "description": desc, "inputSchema": {"type": "object", "properties": props, "required": req}})
    return out


def handle(req):
    method, rid = req.get("method"), req.get("id")
    if method == "initialize":
        return {"protocolVersion": req.get("params", {}).get("protocolVersion", PROTOCOL), "capabilities": {"tools": {}},
                "serverInfo": {"name": "motion-dna-premiere", "version": "0.1"}, "instructions": INSTRUCTIONS}
    if method == "tools/list":
        return {"tools": tool_list()}
    if method == "tools/call":
        p = req.get("params", {})
        fn = {t[0]: t[1] for t in TOOLS_DEF}.get(p.get("name"))
        if not fn:
            return {"content": [{"type": "text", "text": f"Unknown tool {p.get('name')}"}], "isError": True}
        try:
            out = fn(**(p.get("arguments") or {}))
            if isinstance(out, dict) and "content" in out:
                return out
            return {"content": [{"type": "text", "text": str(out)}]}
        except Exception as e:
            return {"content": [{"type": "text", "text": f"Error: {e}"}], "isError": True}
    if method == "ping":
        return {}
    if rid is None:
        return None
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
                sys.stdout.write(json.dumps({"jsonrpc": "2.0", "id": req["id"], "result": res}) + "\n"); sys.stdout.flush()
        except KeyError as e:
            if req.get("id") is not None:
                sys.stdout.write(json.dumps({"jsonrpc": "2.0", "id": req["id"], "error": {"code": -32601, "message": f"Method not found: {e}"}}) + "\n"); sys.stdout.flush()
        except Exception as e:
            if req.get("id") is not None:
                sys.stdout.write(json.dumps({"jsonrpc": "2.0", "id": req["id"], "error": {"code": -32603, "message": str(e)}}) + "\n"); sys.stdout.flush()


if __name__ == "__main__":
    main()
