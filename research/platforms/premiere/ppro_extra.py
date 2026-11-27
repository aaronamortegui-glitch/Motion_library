"""motion-dna-premiere, part 2: project management, assets from generators and voices, effects, transitions, markers,
colour (the Motion DNA look library on Lumetri) and masks (Track Matte Key with mattes made by Motion DNA).

Loaded by mcp_premiere.py, which adds TOOLS below to its tool list. Every tool works on the project open in Premiere.
API rules behind each choice: README.md in this folder.
"""
import json
import math
import pathlib
import shutil
import subprocess
import sys
import time

M = sys.modules.get("__main__") if hasattr(sys.modules.get("__main__"), "TOOLS_DEF") else None
if M is None:
    import mcp_premiere as M   # noqa: N812

HERE = pathlib.Path(__file__).resolve().parent
ROOT = HERE.parents[2]
run, run_tool = M.run, None
js = json.dumps
LOOKS = HERE / "looks.json"
BRAND = {"pine": (10, 33, 31), "spark": (216, 255, 133), "cloud": (247, 249, 242), "sea": (23, 74, 69)}

# Premiere's label colours (index): what each kind of item gets
LABELS = {"Footage": 5, "Audio": 3, "Music": 3, "Voice": 4, "Generated": 7, "Graphics": 9, "Stills": 1, "Sequences": 11,
          "Placeholders": 8, "Renders": 12}
EXT = {"Footage": {".mp4", ".mov", ".mxf", ".avi", ".mkv", ".m4v", ".r3d", ".braw"}, "Audio": {".wav", ".mp3", ".aif", ".aiff", ".m4a", ".flac", ".ogg"},
       "Stills": {".png", ".jpg", ".jpeg", ".tif", ".tiff", ".psd", ".webp", ".exr"}, "Graphics": {".mogrt", ".aep", ".ai", ".svg"}}


def _items_js():
    """JS: every project item, walked recursively, with its bin path, kind and media path."""
    return """
async function walk(folder, path, out) {
  for (const it of await folder.getItems()) {
    let f = null; try { f = ppro.FolderItem.cast(it); } catch (e) {}
    let isBin = false; try { isBin = !!(f && f.getItems && (await f.getItems()) !== undefined && it.type === ppro.Constants.ProjectItemType.BIN); } catch (e) {}
    if (it.type === ppro.Constants.ProjectItemType.BIN && f) { out.push({ it, name: it.name, path, bin: true }); await walk(f, path.concat(it.name), out); continue; }
    let media = null, isSeq = false;
    try { const c = ppro.ClipProjectItem.cast(it); isSeq = await c.isSequence(); if (!isSeq) media = await c.getMediaFilePath(); } catch (e) {}
    out.push({ it, name: it.name, path, bin: false, media, isSeq });
  }
  return out;
}
"""


# ---------------------------------------------------------------- project
def t_organize_project(premiere=None, dry_run=False):
    """Sort the project into Motion DNA bins by kind (Footage, Audio, Music, Voice, Generated, Graphics, Stills,
    Sequences, Placeholders, Renders) with a colour label each. Items already inside a bin of yours are left where
    they are; only loose items at the root are moved."""
    r, v = run(_items_js() + f"""
const root = await P.getRootItem();
const all = await walk(root, [], []);
const EXT = {js({k: sorted(x) for k, x in EXT.items()})}, LABELS = {js(LABELS)};
const kindOf = (e) => {{
  if (e.isSeq) return "Sequences";
  if (/^PLACEHOLDER/i.test(e.name)) return "Placeholders";
  const m = (e.media || "").toLowerCase().replace(/\\\\/g, "/");
  if (m.includes("/motion dna renders/")) return "Renders";
  if (m.includes("/generated/") || /flora|krea|weave|seedance|kling|runway/i.test(m)) return "Generated";
  if (/voice|vo_|narration|elevenlabs|tts/i.test(m)) return EXT.Audio.some((x) => m.endsWith(x)) ? "Voice" : null;
  for (const k of Object.keys(EXT)) if (EXT[k].some((x) => m.endsWith(x))) return k === "Audio" && /music|bed|song|loop/i.test(m) ? "Music" : k;
  return null;
}};
const plan = [];
for (const e of all) if (!e.bin && e.path.length === 0) {{ const k = kindOf(e); if (k) plan.push([e, k]); }}
if ({js(bool(dry_run))}) return plan.map(([e, k]) => [e.name, k]);
const bins = {{}};
for (const e of all) if (e.bin && e.path.length === 0) bins[e.name] = e.it;
for (const k of new Set(plan.map(([, k]) => k))) if (!bins[k]) {{
  tx("Motion DNA: bin " + k, () => root.createBinAction(k, true));
  for (const it of await root.getItems()) if (it.name === k) bins[k] = it;
}}
for (const [e, k] of plan) {{
  try {{ tx("Motion DNA: organize", () => root.createMoveItemAction(e.it, ppro.FolderItem.cast(bins[k]))); }} catch (err) {{ e.err = String(err.message || err); }}
  try {{ tx("Motion DNA: label", () => e.it.createSetColorLabelAction(LABELS[k])); }} catch (err) {{}}
}}
for (const [k, b] of Object.entries(bins)) if (LABELS[k] != null) try {{ tx("Motion DNA: bin label", () => ppro.FolderItem.cast(b).createSetColorLabelAction(LABELS[k])); }} catch (err) {{}}
return plan.map(([e, k]) => [e.name, k, e.err || "ok"]);""", premiere, timeout=180)
    if not r:
        return "Nothing loose at the root: the project is already organized."
    rows = "\n".join(f"  {n} -> {k}" + ("" if len(x) < 1 or x[0] == "ok" else f" ({x[0]})") for n, k, *x in r)
    return ("Would move:\n" if dry_run else f"Organized {len(r)} items into Motion DNA bins (Premiere {v}):\n") + rows


def t_collect_project(dest, premiere=None):
    """Collect files: copy every piece of media the project uses into dest/Media/<bin>, save the project there as a
    copy (Save As: the open project becomes the copy) and relink the copy to the collected media. The original
    project file and media on disk are not touched."""
    dest = pathlib.Path(dest)
    (dest / "Media").mkdir(parents=True, exist_ok=True)
    r, v = run(_items_js() + """
const all = await walk(await P.getRootItem(), [], []);
return { name: P.name, path: P.path, media: all.filter((e) => e.media).map((e) => ({ name: e.name, bin: e.path.join("/"), media: e.media })) };""", premiere, timeout=120)
    copied, plan = 0, []
    for e in r["media"]:
        src = pathlib.Path(str(e["media"]).replace("\\\\?\\", ""))
        if not src.exists():
            plan.append((e["name"], None, "missing on disk"))
            continue
        tgt_dir = dest / "Media" / (e["bin"] or "Root")
        tgt_dir.mkdir(parents=True, exist_ok=True)
        tgt = tgt_dir / src.name
        if not tgt.exists():
            shutil.copy2(src, tgt)
            copied += 1
        plan.append((e["name"], str(tgt), "ok"))
    proj = dest / (pathlib.Path(r["name"]).stem + " (collected).prproj")
    run(f"return await P.saveAs(BACK({js(str(proj))}));", premiere, timeout=300)
    relink = [(n, t) for n, t, s in plan if s == "ok"]
    out, _ = run(_items_js() + f"""
const RL = {js(relink)};
const all = await walk(await P.getRootItem(), [], []);
let n = 0;
for (const [name, tgt] of RL) {{ const e = all.find((x) => x.name === name && x.media); if (!e) continue;
  try {{ const c = ppro.ClipProjectItem.cast(e.it); if (await c.changeMediaFilePath(BACK(tgt), true)) n++; }} catch (err) {{}} }}
await P.save();
return n;""", premiere, timeout=300)
    missing = [n for n, _, s in plan if s != "ok"]
    return (f"Collected into {dest}: {copied} files copied ({len(plan)} media in use), project saved as {proj.name} and "
            f"{out} items relinked to the copies. The open project is now the collected copy; the original is untouched."
            + (f" Missing on disk: {', '.join(missing)}." if missing else ""))


def t_export_interchange(fmt="otio", sequence=None, out=None, premiere=None):
    """Hand a sequence to another app: OpenTimelineIO (otio, 26.2+), Final Cut Pro XML (fcpxml, 26.2+) or AAF (26.3+)."""
    fmt = fmt.lower()
    ext = {"otio": ".otio", "fcpxml": ".xml", "xml": ".xml", "aaf": ".aaf"}[fmt]
    r0, v = run(f"return {{ name: (await seqBy({js(sequence)})).name, project: P.path }};", premiere)
    path = pathlib.Path(out) if out else M._renders_dir(r0["project"]) / f"{r0['name']}{ext}"
    call = {"otio": "exportAsOpenTimelineIO(seq, BACK(F), true)", "fcpxml": "exportAsFinalCutProXML(seq, BACK(F), true)",
            "xml": "exportAsFinalCutProXML(seq, BACK(F), true)", "aaf": "exportAAF(seq, BACK(F), new ppro.AAFExportOptions())"}[fmt]
    try:
        ok, v = run(f"const seq = await seqBy({js(sequence)}); const F = {js(str(path))}; return await ppro.ProjectConverter.{call};", premiere, timeout=120)
    except RuntimeError as e:   # AAF: Premiere writes the file but its promise may never answer
        if "timeout" in str(e) and path.exists() and path.stat().st_size:
            ok, v = True, "?"
        else:
            raise
    return f"{r0['name']} -> {path} ({fmt}): {'done' if ok and path.exists() else 'Premiere answered ' + str(ok)}. Premiere {v}."


def t_merge_project(path, bin=None, premiere=None):
    """Bring another Premiere project into this one (all its bins and sequences, into a bin), or After Effects comps
    (an .aep: every comp, live through Dynamic Link)."""
    p = pathlib.Path(path)
    if not p.exists():
        raise FileNotFoundError(path)
    target = bin or f"Merged · {p.stem}"
    if p.suffix.lower() == ".aep":
        r, v = run(f"""
const root = await P.getRootItem();
tx("Motion DNA: bin", () => root.createBinAction({js(target)}, true));
const b = (await root.getItems()).find((i) => i.name === {js(target)});
return await P.importAllAEComps(FWD({js(str(p))}), b);""", premiere, timeout=600)
        return f"After Effects comps of {p.name} imported live (Dynamic Link) into bin {target!r}: {r}. Premiere {v}."
    r, v = run(f"""
const root = await P.getRootItem();
tx("Motion DNA: bin", () => root.createBinAction({js(target)}, true));
const b = ppro.FolderItem.cast((await root.getItems()).find((i) => i.name === {js(target)}));
return await P.importFiles([FWD({js(str(p))})], true, b, false);""", premiere, timeout=600)
    return f"Project {p.name} merged into bin {target!r}: {r}. Premiere {v}."


# ---------------------------------------------------------------- assets in
def _placeholder_png(what, size=(1920, 1080)):
    from PIL import Image, ImageDraw, ImageFont
    im = Image.new("RGB", size, BRAND["pine"])
    d = ImageDraw.Draw(im)
    d.rectangle([24, 24, size[0] - 25, size[1] - 25], outline=BRAND["spark"], width=6)
    try:
        f1 = ImageFont.truetype(str(ROOT / "assets/fonts/InterTight-Bold.ttf"), 72)
        f2 = ImageFont.truetype(str(ROOT / "assets/fonts/InterTight-Bold.ttf"), 40)
    except OSError:
        f1 = f2 = ImageFont.load_default()
    d.text((size[0] / 2, size[1] / 2 - 40), "PLACEHOLDER", font=f2, fill=BRAND["spark"], anchor="mm")
    d.text((size[0] / 2, size[1] / 2 + 40), what, font=f1, fill=BRAND["cloud"], anchor="mm")
    return im


def t_add_placeholder(what, sequence=None, track=1, time_s=None, duration_s=3.0, premiere=None):
    """A labelled card 'PLACEHOLDER · <what>' (brand colours) where a shot is still to come (generated, filmed, a
    logo...). Replace it later with add_generated(replace=...) or replace_clip."""
    r0, v = run("return P.path;", premiere)
    out = M._renders_dir(r0) / "placeholders" / f"PLACEHOLDER · {''.join(c if c.isalnum() or c in ' -_' else '_' for c in what)[:50]}.png"
    out.parent.mkdir(parents=True, exist_ok=True)
    fr, _ = run(f"const f = await (await seqBy({js(sequence)})).getFrameSize(); return [f.width, f.height];", premiere)
    _placeholder_png(what, tuple(fr)).save(out)
    M.t_import_media(str(out), bin="Placeholders", premiere=premiere)
    msg = M.t_place_clip(out.name, sequence=sequence, track=track, time_s=time_s or 0.0, after=time_s is None, premiere=premiere)
    _set_last_duration(sequence, track, duration_s, premiere)
    return f"PLACEHOLDER · {what} ({duration_s}s). " + msg


def _set_last_duration(sequence, track, duration_s, premiere):
    run(f"""
const seq = await seqBy({js(sequence)});
const items = await clipsOf(seq, "video", {int(track) - 1});
let last = items[0], e = -1;
for (const it of items) {{ const t = (await it.getEndTime()).seconds; if (t > e) {{ e = t; last = it; }} }}
const s = (await last.getStartTime()).seconds;
tx("Motion DNA: duration", () => last.createSetEndAction(ppro.TickTime.createWithSeconds(s + {float(duration_s)})));
return true;""", premiere)


def t_add_generated(source, provider="generated", prompt="", cost_usd=None, sequence=None, track=1, time_s=None, replace=None,
                    duration_s=None, premiere=None):
    """Bring a generated asset (Flora, Krea, Figma Weave, Seedance… a URL or a file) into the edit: bin
    Generated/<provider>, placed on a track (or over a placeholder: replace='<name or what>'), with a marker that keeps
    its provenance (provider, prompt, cost). Generate it first with that provider's tools (quote the cost in USD)."""
    binname = f"Generated · {provider}"
    msg = M.t_import_media(source, bin=binname, premiere=premiere,
                           download_dir=str(M._renders_dir(run("return P.path;", premiere)[0]) / "generated" / provider))
    name = pathlib.Path(source.split("?")[0]).name
    at = time_s
    if replace:
        hit, _ = run(f"""
const seq = await seqBy({js(sequence)});
for (let t = 0; t < await seq.getVideoTrackCount(); t++) for (const it of await clipsOf(seq, "video", t)) {{
  const n = await it.getName();
  if (n.toLowerCase().includes({js(str(replace).lower())})) return {{ t: t + 1, s: (await it.getStartTime()).seconds, e: (await it.getEndTime()).seconds, n }};
}}
return null;""", premiere)
        if not hit:
            raise ValueError(f"no clip named like {replace!r} to replace")
        track, at, duration_s = hit["t"], hit["s"], duration_s or (hit["e"] - hit["s"])
    place = M.t_place_clip(name, sequence=sequence, track=track, time_s=at or 0.0, after=at is None, premiere=premiere)
    if duration_s:
        _set_last_duration(sequence, track, duration_s, premiere)
    note = f"{provider}: {prompt}" + (f" · ${cost_usd}" if cost_usd is not None else "")
    run(f"""
const seq = await seqBy({js(sequence)});
const mk = await ppro.Markers.getMarkers(seq);
const t = {float(at or 0)};
tx("Motion DNA: provenance", () => mk.createAddMarkerAction({js(name)}, "Comment", ppro.TickTime.createWithSeconds(t), ppro.TickTime.createWithSeconds(0), {js(note)}));
return true;""", premiere)
    return f"{msg}\n{place}\nMarker at {at or 'the end'}: {note}"


def fix_channels(path, make_stereo=False):
    """A file whose sound is on one channel only (a lav mic on the left) plays from one side: make a copy with the live
    channel on both (ffmpeg), next to it, and use that. Mono stays mono (Premiere centres it in a stereo sequence)
    unless make_stereo. Returns (path to use, what was done)."""
    p = pathlib.Path(path)
    pr = subprocess.run(["ffprobe", "-v", "error", "-select_streams", "a:0", "-show_entries", "stream=channels", "-of", "csv=p=0", str(p)],
                        capture_output=True, text=True).stdout.strip()
    ch = int(pr or 0)
    if ch == 1:
        if not make_stereo:
            return p, "mono (plays centred on both sides)"
        out = p.with_name(p.stem + "_stereo" + p.suffix if p.suffix.lower() in (".wav", ".aif", ".aiff") else p.stem + "_stereo.wav")
        subprocess.run(["ffmpeg", "-v", "error", "-y", "-i", str(p), "-af", "pan=stereo|c0=c0|c1=c0", str(out)], check=True)
        return out, "mono made stereo (same sound on both sides)"
    if ch != 2:
        return p, f"{ch} channels"
    import re
    levels = []
    for c in (0, 1):
        r = subprocess.run(["ffmpeg", "-nostats", "-i", str(p), "-af", f"pan=mono|c0=c{c},volumedetect", "-f", "null", "-"],
                           capture_output=True, text=True, encoding="utf-8", errors="replace")
        m = re.search(r"mean_volume:\s*(-?[\d.]+|-inf) dB", r.stderr)
        levels.append(float(m.group(1)) if m and m.group(1) != "-inf" else -120.0)
    dead = [i for i, L in enumerate(levels) if L < -55 and max(levels) - L > 25]
    if not dead:
        return p, "stereo"
    live = 1 - dead[0]
    out = p.with_name(p.stem + "_fixed.wav")
    subprocess.run(["ffmpeg", "-v", "error", "-y", "-i", str(p), "-af", f"pan=stereo|c0=c{live}|c1=c{live}", str(out)], check=True)
    return out, f"sound only on the {'left' if live == 0 else 'right'} channel: copied to both sides ({out.name})"


def t_add_voice(source, sequence=None, track=1, time_s=0.0, voice_lufs=-16.0, duck_music_db=16.0, music_track=2, make_stereo=False, premiere=None):
    """A voice line (ElevenLabs, a local voice clone, a recording) on an audio track at time_s, levelled to voice_lufs,
    with the music on music_track ducked duck_music_db under it while it speaks (keys on the library's Cruise curve)."""
    p = pathlib.Path(source)
    if not p.exists():
        raise FileNotFoundError(source)
    p, chan_note = fix_channels(p, make_stereo)
    M.t_import_media(str(p), bin="Voice", premiere=premiere)
    L = M._lufs(p)
    gain = max(-30.0, min(15.0, voice_lufs - L)) if L is not None else 0.0
    dur = float(subprocess.run(["ffprobe", "-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", str(p)],
                               capture_output=True, text=True).stdout.strip() or 0)
    lin = lambda db: 10 ** ((db - 15) / 20)
    r, v = run(f"""
const seq = await seqBy({js(sequence)});
const item = await findItem({js(p.name)});
const ed = ppro.SequenceEditor.getEditor(seq);
tx("Motion DNA: voice", () => ed.createOverwriteItemAction(item, ppro.TickTime.createWithSeconds({float(time_s)}), -1, {int(track) - 1}));
let clip = null;
for (const c of await clipsOf(seq, "audio", {int(track) - 1})) if (Math.abs((await c.getStartTime()).seconds - {float(time_s)}) < 0.05) clip = c;
// mono, stereo or 5.1 clips each have their own volume component ("Internal Volume Mono/Stereo/…"): Level is param 1
const lvl = async (c) => {{ const ch = await c.getComponentChain(); for (let i = 0; i < ch.getComponentCount(); i++) {{ const k = ch.getComponentAtIndex(i); if (/^Internal Volume/.test(await k.getMatchName())) return k.getParam(1); }} return null; }};
const vp = await lvl(clip);
tx("Motion DNA: voice level", () => vp.createSetValueAction(vp.createKeyframe({lin(gain)}), true));
// duck the music under the line
const music = (await clipsOf(seq, "audio", {int(music_track) - 1}))[0];
let ducked = false;
if (music) {{
  const mp = await lvl(music);
  const inS = (await music.getInPoint()).seconds, ms = (await music.getStartTime()).seconds;
  const T = (s) => ppro.TickTime.createWithSeconds(inS + s - ms);
  const base = (await mp.getValueAtTime(T({float(time_s)} - 0.4))).value;
  const low = base * Math.pow(10, -{float(duck_music_db)} / 20);
  if (!mp.isTimeVarying()) tx("Motion DNA: music keys", () => mp.createSetTimeVaryingAction(true));
  const a = {float(time_s)}, b = a + {dur};
  const keys = [[a - 0.35, base], [a, low], [b, low], [b + 0.5, base]];
  tx("Motion DNA: duck", () => keys.map(([s, g]) => {{ const kf = mp.createKeyframe(g); kf.position = T(s); return mp.createAddKeyframeAction(kf); }}));
  ducked = true;
}}
return {{ ducked }};""", premiere, timeout=90)
    return (f"Voice {p.name} ({chan_note}) on A{track} at {time_s}s ({dur:.1f}s): {L:.1f} LUFS file -> {voice_lufs:g} LUFS ({gain:+.1f} dB)"
            + (f"; music on A{music_track} ducked {duck_music_db:g} dB under it." if r["ducked"] else "; no music to duck.") + f" Premiere {v}.")


def t_add_animation(source, sequence=None, track=2, time_s=0.0, render_args="", premiere=None):
    """A Motion DNA animation over the edit: a code template (research/video_prompts/templates/*.html, rendered with
    html_to_mp4.py: ProRes 4444 with alpha when the scene has it), a rendered file (MOV/MP4/PNG sequence folder), or
    an After Effects project (.aep: its comps come in live through Dynamic Link)."""
    p = pathlib.Path(source)
    if not p.exists():
        cand = ROOT / "research/video_prompts/templates" / source
        cand = cand if cand.exists() else cand.with_suffix(".html")
        if cand.exists():
            p = cand
        else:
            raise FileNotFoundError(f"{source} (a file, a PNG-sequence folder, an .aep, or a template in research/video_prompts/templates)")
    if p.suffix.lower() == ".aep":
        return t_merge_project(str(p), bin=f"AE · {p.stem}", premiere=premiere)
    if p.suffix.lower() == ".html":
        r0, _ = run("return P.path;", premiere)
        out_dir = M._renders_dir(r0) / "animations"
        out_dir.mkdir(exist_ok=True)
        before = set((ROOT / "research/video_prompts/renders").glob("*"))
        args = [sys.executable, str(ROOT / "research/video_prompts/html_to_mp4.py"), str(p)] + (render_args.split() if render_args else [])
        rr = subprocess.run(args, capture_output=True, text=True, encoding="utf-8", errors="replace", timeout=3600)
        made = sorted(set((ROOT / "research/video_prompts/renders").glob(p.stem + "*.m*")) - before, key=lambda f: f.stat().st_mtime)
        made = made or sorted((ROOT / "research/video_prompts/renders").glob(p.stem + "*.m*"), key=lambda f: f.stat().st_mtime)
        if rr.returncode != 0 or not made:
            raise RuntimeError("render failed: " + (rr.stderr or rr.stdout)[-600:])
        p = pathlib.Path(shutil.copy2(made[-1], out_dir / made[-1].name))
    if p.is_dir():   # a PNG sequence
        first = sorted(p.glob("*.png"))[0]
        run(f"""
const root = await P.getRootItem();
tx("Motion DNA: bin", () => root.createBinAction("Animations", true));
const b = ppro.FolderItem.cast((await root.getItems()).find((i) => i.name === "Animations"));
return await P.importFiles([FWD({js(str(first))})], true, b, true);""", premiere, timeout=300)
        name = first.name
    else:
        M.t_import_media(str(p), bin="Animations", premiere=premiere)
        name = p.name
    place = M.t_place_clip(name, sequence=sequence, track=track, time_s=time_s, premiere=premiere)
    return f"Animation {name} over the edit. {place}"


# ---------------------------------------------------------------- effects, transitions, markers
def _catalog(premiere):
    r, _ = run("""
const fx = await ppro.VideoFilterFactory.getMatchNames(), names = await ppro.VideoFilterFactory.getDisplayNames();
return { fx: fx.map((m, i) => [m, names[i]]), tr: await ppro.TransitionFactory.getVideoTransitionMatchNames() };""", premiere)
    return r


def t_list_effects(query=None, premiere=None):
    c = _catalog(premiere)
    q = (query or "").lower()
    fx = [f"{n}  ({m})" for m, n in c["fx"] if q in (m + n).lower()]
    tr = [t for t in c["tr"] if q in t.lower()]
    return f"Effects ({len(fx)}):\n  " + "\n  ".join(fx) + f"\nTransitions ({len(tr)}):\n  " + "\n  ".join(tr)


def _resolve_fx(name, premiere):
    c = _catalog(premiere)
    n = name.lower()
    for m, d in c["fx"]:
        if n in (m.lower(), d.lower()):
            return m
    hits = [m for m, d in c["fx"] if n in (m + " " + d).lower()]
    if not hits:
        raise ValueError(f"no effect like {name!r}; see list_effects")
    return hits[0]


SET_PARAMS_JS = """
// params: {"Name": value} or {"Name#2": value} for the 2nd parameter with that name; colours as "#rrggbb"
async function setParams(comp, params) {
  const seen = {}, done = [];
  const acts = [];
  for (let i = 0; i < comp.getParamCount(); i++) {
    const p = comp.getParam(i), nm = (p.displayName || "").trim();
    if (!nm) continue;
    seen[nm] = (seen[nm] || 0) + 1;
    const key = params[nm + "#" + seen[nm]] !== undefined ? nm + "#" + seen[nm] : (seen[nm] === 1 && params[nm] !== undefined ? nm : null);
    if (!key) continue;
    let v = params[key];
    if (typeof v === "string" && /^#[0-9a-f]{6}$/i.test(v)) v = new ppro.Color(parseInt(v.slice(1, 3), 16) / 255, parseInt(v.slice(3, 5), 16) / 255, parseInt(v.slice(5, 7), 16) / 255, 1);
    acts.push([p, v]); done.push(key);
  }
  if (acts.length) tx("Motion DNA: params", () => acts.map(([p, v]) => p.createSetValueAction(p.createKeyframe(v), true)));
  return done;
}
"""


def _targets_js(sequence, track, clip):
    """JS that sets `targets` to the clips to act on: one clip, a whole track (clip='all'), or every video clip (track=0)."""
    return f"""
const seq = await seqBy({js(sequence)});
let targets = [];
if ({int(track)} === 0) {{ for (let t = 0; t < await seq.getVideoTrackCount(); t++) targets.push(...(await clipsOf(seq, "video", t))); }}
else if ({js(clip)} === "all") targets = await clipsOf(seq, "video", {int(track) - 1});
else targets = [await clipAt(seq, {int(track)}, {js(clip)})];
"""


def t_add_effect(effect, sequence=None, track=1, clip=0, params=None, premiere=None):
    """Add any Premiere video effect (by name or match name: Gaussian Blur, Warp Stabilizer, Ultra Key, Glow, Vignette,
    Transform, Lumetri…) to a clip, a whole track (clip='all') or every clip (track=0), with optional parameter values
    by their display name ({"Blurriness": 20}; "Name#2" for a repeated name)."""
    match = _resolve_fx(effect, premiere)
    r, v = run(SET_PARAMS_JS + _targets_js(sequence, track, clip) + f"""
const out = [];
for (const it of targets) {{
  const comp = await ppro.VideoFilterFactory.createComponent({js(match)});
  const chain = await it.getComponentChain();
  tx("Motion DNA: effect", () => chain.createAppendComponentAction(comp));
  const ch2 = await it.getComponentChain();
  let added = null;
  for (let c = ch2.getComponentCount() - 1; c >= 0 && !added; c--) {{ const k = ch2.getComponentAtIndex(c); if ((await k.getMatchName()) === {js(match)}) added = k; }}
  const done = added ? await setParams(added, {js(params or {})}) : [];
  out.push([await it.getName(), done]);
}}
return out;""", premiere, timeout=120)
    return f"{match} on {len(r)} clip(s): " + "; ".join(f"{n}" + (f" ({', '.join(d)})" if d else "") for n, d in r) + f". Premiere {v}."


TRANSITIONS = {   # Motion DNA picks by energy (1 calm .. 5 explosive); every name is in Premiere's own list
    "dissolve": "AE.ADBE Cross Dissolve New", "film dissolve": "ADBE Film Dissolve", "dip to black": "AE.ADBE Dip To Black",
    "dip to white": "AE.ADBE Dip To White", "push": "ADBE Push", "slide": "ADBE Slide", "whip": "AE.ADBE Whip",
    "cross zoom": "ADBE Cross Zoom", "iris": "ADBE Iris Round", "wipe": "ADBE Wipe", "light leaks": "AE.AE_Impact_Light_Leaks",
    "flash": "AE.AE_Impact_Flash", "glitch": "AE.AE_Impact_Glitch", "zoom blur": "AE.AE_Impact_Zoom_Blur", "spin": "AE.AE_Impact_Spin",
    "morph cut": "AE.ADBE MorphCut", "blur dissolve": "AE.AE_Impact_Blur_dissolve", "luma fade": "AE.AE_Impact_Luma_Fade",
}
BY_ENERGY = {1: "dissolve", 2: "film dissolve", 3: "push", 4: "whip", 5: "glitch"}


def t_add_transition(name=None, energy=None, sequence=None, track=1, clip=0, where="end", duration="Glide", premiere=None):
    """A transition on a cut: by name (dissolve, film dissolve, dip to black, push, slide, whip, cross zoom, light leaks,
    flash, glitch, zoom blur, spin, morph cut… or any of Premiere's 118) or by Motion DNA energy (1 calm .. 5
    explosive). where: end (the cut after the clip), start, or both. duration: a token (Tick..Stage) or seconds."""
    key = (name or BY_ENERGY.get(int(energy or 2), "dissolve")).lower()
    match = TRANSITIONS.get(key)
    if not match:
        c = _catalog(premiere)
        match = next((t for t in c["tr"] if key in t.lower()), None)
        if not match:
            raise ValueError(f"no transition like {key!r}; see list_effects")
    tok = M._tokens()
    if isinstance(duration, str) and not duration.replace(".", "", 1).isdigit():
        secs = next(d["ms"] for d in tok["durations"] if d["name"].lower() == duration.lower()) / 1000
    else:
        secs = float(duration)
    sides = ["end", "start"] if where == "both" else [where]
    r, v = run(_targets_js(sequence, track, clip) + f"""
const out = [];
for (const it of targets) for (const side of {js(sides)}) {{
  const tr = await ppro.TransitionFactory.createVideoTransition({js(match)});
  const opt = new ppro.AddTransitionOptions();
  opt.setApplyToStart(side === "start");
  opt.setDuration(ppro.TickTime.createWithSeconds({secs}));
  try {{ tx("Motion DNA: transition", () => it.createAddVideoTransitionAction(tr, opt, true)); out.push([await it.getName(), side, "ok"]); }}
  catch (e) {{ out.push([await it.getName(), side, String(e.message || e)]); }}
}}
return out;""", premiere, timeout=120)
    return f"{match} ({secs:.2f}s): " + "; ".join(f"{n} {s}: {st}" for n, s, st in r) + f". Premiere {v}."


def t_add_markers(times, names=None, comments=None, sequence=None, color=None, premiere=None):
    """Sequence markers at times (seconds): cut points, beats (from tools/audio_markers.py), chapters, notes."""
    names = names or [f"M{i + 1}" for i in range(len(times))]
    comments = comments or [""] * len(times)
    r, v = run(f"""
const seq = await seqBy({js(sequence)});
const mk = await ppro.Markers.getMarkers(seq);
const T = {js(list(map(float, times)))}, N = {js(names)}, C = {js(comments)};
tx("Motion DNA: markers", () => T.map((t, i) => mk.createAddMarkerAction(N[i] || "", "Comment", ppro.TickTime.createWithSeconds(t), ppro.TickTime.createWithSeconds(0), C[i] || "")));
return T.length;""", premiere)
    return f"{r} markers on {sequence or 'the active sequence'}. Premiere {v}."


def t_beat_markers(audio, sequence=None, mode="beats", every=1, limit=64, premiere=None):
    """Markers on the music's beats (or onsets), so cuts and moves land on them: tools/audio_markers.py on the file."""
    a = pathlib.Path(audio)
    if not a.exists():
        raise FileNotFoundError(audio)
    out = subprocess.run([sys.executable, str(ROOT / "tools/audio_markers.py"), str(a), mode],   # prints {"bpm", "beats"} or a list
                         capture_output=True, text=True, encoding="utf-8", errors="replace", timeout=600)
    try:
        data = json.loads(out.stdout)
        raw = data.get("beats") if isinstance(data, dict) else data
        times = [float(t if not isinstance(t, (list, dict)) else (t[0] if isinstance(t, list) else t.get("t", t.get("start", 0)))) for t in raw]
        times = times[::max(1, int(every))][:int(limit)]
    except Exception:
        raise RuntimeError("audio_markers.py did not return times: " + (out.stderr or out.stdout)[-300:])
    return t_add_markers(times, names=[f"beat {i + 1}" for i in range(len(times))], sequence=sequence, premiere=premiere)


# ---------------------------------------------------------------- colour
def _looks():
    return json.loads(LOOKS.read_text(encoding="utf-8"))["looks"]


LUM_SECTIONS = {"Basic": 1, "Creative": 2, "Vignette": 1}   # which occurrence of a repeated name each section uses
LUM_NAMES = {   # Motion DNA key -> (Lumetri display name, occurrence among same-named params)
    "Basic.Temperature": ("Temperature", 1), "Basic.Tint": ("Tint", 1), "Basic.Saturation": ("Saturation", 1),
    "Basic.Exposure": ("Exposure", 1), "Basic.Contrast": ("Contrast", 1), "Basic.Highlights": ("Highlights", 1),
    "Basic.Shadows": ("Shadows", 1), "Basic.Whites": ("Whites", 1), "Basic.Blacks": ("Blacks", 1),
    "Creative.Intensity": ("Intensity", 2), "Creative.Faded Film": ("Faded Film", 1), "Creative.Sharpen": ("Sharpen", 1),
    "Creative.Vibrance": ("Vibrance", 1), "Creative.Saturation": ("Saturation", 2), "Creative.Tint Balance": ("Tint Balance", 1),
    "Vignette.Amount": ("Amount", 1), "Vignette.Midpoint": ("Midpoint", 1), "Vignette.Roundness": ("Roundness", 1), "Vignette.Feather": ("Feather", 1),
}


def t_list_looks(tone=None, energy=None):
    rows = []
    for k, L in _looks().items():
        if tone and tone not in L["tones"]:
            continue
        if energy and not (L["energy"][0] <= int(energy) <= L["energy"][1]):
            continue
        rows.append(f"{k}: {L['label']} · energy {L['energy'][0]}-{L['energy'][1]} · {'/'.join(L['tones'])} · {L['use']}")
    return "Motion DNA looks (Lumetri, editable):\n" + "\n".join(rows)


def t_apply_look(look, sequence=None, track=0, clip="all", intensity=1.0, extra=None, premiere=None):
    """Grade with a Motion DNA look (list_looks: clean-modern, warm-film, teal-orange, noir, pastel-soft, golden-hour,
    cool-tech, vivid-pop, muted-editorial, retro-70s, night-neon, natural-fix) as Lumetri Color, on one clip, a track
    (clip='all') or every video clip (track=0, the default: one look for the whole edit). intensity scales the look
    toward neutral (0.5 = half); extra overrides keys like {"Basic.Exposure": 0.2}. Re-applying replaces the values."""
    L = _looks().get(look)
    if not L:
        raise ValueError(f"unknown look {look!r}; see list_looks")
    neutral = {"Saturation": 100}
    vals = dict(L["params"]); vals.update(extra or {})
    params = {}
    for key, val in vals.items():
        nm, occ = LUM_NAMES[key]
        base = neutral.get(nm, 0)
        params[f"{nm}#{occ}"] = base + (val - base) * float(intensity)
    r, v = run(SET_PARAMS_JS + _targets_js(sequence, track, clip) + f"""
const out = [];
for (const it of targets) {{
  if (await componentByMatch(it, "AE.ADBE Capsule")) continue;   // titles are not graded
  let lum = await componentByMatch(it, "AE.ADBE Lumetri");
  if (!lum) {{
    const comp = await ppro.VideoFilterFactory.createComponent("AE.ADBE Lumetri");
    const chain = await it.getComponentChain();
    tx("Motion DNA: Lumetri", () => chain.createAppendComponentAction(comp));
    lum = await componentByMatch(it, "AE.ADBE Lumetri");
  }}
  const done = await setParams(lum, {js(params)});
  out.push([await it.getName(), done.length]);
}}
return out;""", premiere, timeout=180)
    if L.get("wheels"):
        w = {k: ({"hue": x["hue"], "amount": x["amount"] * float(intensity)} if isinstance(x, dict) else x) for k, x in L["wheels"].items()}
        t_color_wheels(sequence=sequence, track=track, clip=clip, premiere=premiere, **w)
    return (f"Look {L['label']} (x{float(intensity):g}{', with colour wheels' if L.get('wheels') else ''}) on {len(r)} clip(s): " + ", ".join(f"{n} ({k} values)" for n, k in r)
            + f". Lumetri Color, editable in Premiere's Lumetri panel. Premiere {v}.")


# ---------------------------------------------------------------- masks
def _matte_video(shape, size, seconds, fps, curve, feather, reveal_s, out, invert=False, rect=None, center=(0.5, 0.5)):
    """White shape on black (a luma matte), animated on a Motion DNA curve: rect / ellipse / rounded / iris / wipe."""
    from PIL import Image, ImageDraw, ImageFilter
    W, H = size
    tok = M._tokens()
    bz = next(e["bezier"] for e in tok["easings"] if e["name"].lower() == curve.lower())
    n = max(1, round(seconds * fps))
    rx = rect or (0.1, 0.1, 0.9, 0.9)
    ff = subprocess.Popen(["ffmpeg", "-v", "error", "-y", "-f", "rawvideo", "-pix_fmt", "gray", "-s", f"{W}x{H}", "-r", str(fps), "-i", "-",
                           "-c:v", "libx264", "-pix_fmt", "yuv420p", "-crf", "12", str(out)], stdin=subprocess.PIPE)
    for f in range(n):
        u = 1.0 if reveal_s <= 0 else min(1.0, (f / fps) / reveal_s)
        k = M.bezier_y(*bz, u)
        im = Image.new("L", (W, H), 0)
        d = ImageDraw.Draw(im)
        cx, cy = center[0] * W, center[1] * H
        if shape == "wipe":
            d.rectangle([0, 0, W * k, H], fill=255)
        elif shape == "iris":
            r = k * math.hypot(W, H) / 2
            d.ellipse([cx - r, cy - r, cx + r, cy + r], fill=255)
        else:
            x0, y0, x1, y1 = rx[0] * W, rx[1] * H, rx[2] * W, rx[3] * H
            mx, my = (x0 + x1) / 2, (y0 + y1) / 2
            x0, x1 = mx + (x0 - mx) * k, mx + (x1 - mx) * k
            y0, y1 = my + (y0 - my) * k, my + (y1 - my) * k
            if shape == "ellipse":
                d.ellipse([x0, y0, x1, y1], fill=255)
            elif shape == "rounded":
                d.rounded_rectangle([x0, y0, x1, y1], radius=int(min(W, H) * 0.06 * k) + 1, fill=255)
            else:
                d.rectangle([x0, y0, x1, y1], fill=255)
        if feather:
            im = im.filter(ImageFilter.GaussianBlur(feather))
        if invert:
            im = Image.eval(im, lambda p: 255 - p)
        ff.stdin.write(im.tobytes())
    ff.stdin.close()
    ff.wait()
    return out


def t_add_mask(shape="rounded", sequence=None, track=1, clip=0, rect=None, center=None, feather=12, invert=False,
               curve="Land", reveal="Arrive", person=False, premiere=None):
    """Mask a clip: rect / ellipse / rounded / iris / wipe, revealed on a Motion DNA curve (reveal: a duration token or
    seconds, 0 = static), feathered; or person=True to cut the person out (local GPU matte, this machine only).
    Premiere's API has no mask paths: the matte is a clip made by Motion DNA, placed on the track above, and the clip
    gets Track Matte Key (luma) pointing at it. rect = (x0, y0, x1, y1) in 0-1 of the frame."""
    info, v = M._clip_media(sequence, track, clip, premiere)
    fr, _ = run(f"const f = await (await seqBy({js(sequence)})).getFrameSize(); return [f.width, f.height];", premiere)
    secs = info["end"] - info["start"]
    out_dir = M._renders_dir(info["project"]) / "mattes"
    out_dir.mkdir(exist_ok=True)
    if person:
        src = pathlib.Path(info["path"])
        out = out_dir / f"{src.stem}_person_matte.mov"
        if not out.exists():
            py = pathlib.Path(r"D:\ComfyUI_windows_portable_nvidia\ComfyUI_windows_portable\python_embeded\python.exe")
            if not py.exists():
                raise RuntimeError("the person matte needs the local GPU matting (tools/video_matte.py in ComfyUI's Python): not on this machine")
            rr = subprocess.run([str(py), str(ROOT / "tools/video_matte.py"), str(src), str(out), "--size", f"{fr[0]}x{fr[1]}", "--fps", str(info["fps"])],
                                capture_output=True, text=True, encoding="utf-8", errors="replace", timeout=3600)
            if rr.returncode != 0 or not out.exists():
                raise RuntimeError("person matte failed: " + (rr.stderr or rr.stdout)[-400:])
        mode = "alpha"
    else:
        tok = M._tokens()
        rs = 0.0 if reveal in (0, "0", None) else (float(reveal) if str(reveal).replace(".", "", 1).isdigit() else
                                                   next(d["ms"] for d in tok["durations"] if d["name"].lower() == str(reveal).lower()) / 1000)
        out = out_dir / f"matte_{shape}_{int(time.time())}.mp4"
        _matte_video(shape, tuple(fr), secs, info["fps"], curve, feather, rs, out, invert, rect, center or (0.5, 0.5))
        mode = "luma"
    M.t_import_media(str(out), bin="Mattes", premiere=premiere)
    above = int(track) + 1
    M.t_place_clip(out.name, sequence=sequence, track=above, time_s=info["start"], premiere=premiere)
    r, v = run(SET_PARAMS_JS + f"""
const seq = await seqBy({js(sequence)});
const it = await clipAt(seq, {int(track)}, {js(clip)});
const comp = await ppro.VideoFilterFactory.createComponent("AE.ADBE Legacy Key Track Matte");
const chain = await it.getComponentChain();
tx("Motion DNA: track matte", () => chain.createAppendComponentAction(comp));
const k = await componentByMatch(it, "AE.ADBE Legacy Key Track Matte");
// Matte: the track number (1-based: Video 2 = 2); Composite Using: 0 alpha, 1 luma. Premiere then hides the matte track.
const m = k.getParam(0), c = k.getParam(1);
tx("Motion DNA: matte settings", () => [m.createSetValueAction(m.createKeyframe({int(above)}), true), c.createSetValueAction(c.createKeyframe({1 if mode == "luma" else 0}), true)]);
return [(await m.getStartValue()).value, (await c.getStartValue()).value];""", premiere)
    return (f"Mask ({'person' if person else shape}, {mode}) on {info['name']}: matte {out.name} on V{above}, Track Matte Key set to "
            f"Video {above} ({mode}). Check it with render_frame (exact): the quick frame export does not draw track mattes. Premiere {v}.")


# ---------------------------------------------------------------- Lumetri: every parameter the API exposes
LUMETRI_SECTIONS = ["Basic Correction", "Color", "Light", "Creative", "Adjustments", "Curves", "RGB Curves", "Hue Saturation Curves",
                    "Color Wheels", "HSL Secondary", "Key", "Refine", "Correction", "Vignette"]
LUMETRI_JS = """
// Lumetri's parameters by section ("Light/Exposure", "Correction/Saturation"…): writable ones only (number, bool,
// colour); curve points, wheel values and custom LUT files are not exposed to plugins
async function lumetriMap(lum) {
  const SECT = SECTIONS_JSON, map = {};
  let sec = "Lumetri";
  for (let i = 0; i < lum.getParamCount(); i++) {
    const p = lum.getParam(i), nm = (p.displayName || "").trim();
    if (!nm) continue;
    if (SECT.includes(nm)) { sec = nm; map[nm + " (on)"] = p; continue; }
    let sv = null; try { sv = await p.getStartValue(); } catch (e) {}
    if (!sv) continue;
    let key = sec + "/" + nm, n = 2;
    while (map[key]) key = sec + "/" + nm + " #" + (n++);
    map[key] = p;
  }
  return map;
}
async function ensureLumetri(it) {
  let lum = await componentByMatch(it, "AE.ADBE Lumetri");
  if (!lum) { const comp = await ppro.VideoFilterFactory.createComponent("AE.ADBE Lumetri"); const ch = await it.getComponentChain(); tx("Motion DNA: Lumetri", () => ch.createAppendComponentAction(comp)); lum = await componentByMatch(it, "AE.ADBE Lumetri"); }
  return lum;
}
""".replace("SECTIONS_JSON", json.dumps(LUMETRI_SECTIONS))


def t_list_lumetri(sequence=None, track=1, clip=0, premiere=None):
    """Every Lumetri parameter Claude can set (by "Section/Name"), with its current value on a clip."""
    r, v = run(LUMETRI_JS + f"""
const it = await clipAt(await seqBy({js(sequence)}), {int(track)}, {js(clip)});
const map = await lumetriMap(await ensureLumetri(it));
const out = [];
for (const [k, p] of Object.entries(map)) {{ const sv = await p.getStartValue(); out.push([k, sv.value !== undefined ? sv.value : (sv.red !== undefined ? [sv.red, sv.green, sv.blue].map((x) => +x.toFixed(3)) : null)]); }}
return out;""", premiere, timeout=90)
    return ("Lumetri, writable through the API (\"Section/Name\": value). Not exposed by Premiere: RGB curve points, Hue/Sat "
            "curve points, colour wheel values, custom .cube LUT files (use color_wheels and the Look/Input LUT index instead).\n"
            + "\n".join(f"  {k}: {val}" for k, val in r))


def t_lumetri(params, sequence=None, track=0, clip="all", premiere=None):
    """Set any Lumetri parameter by "Section/Name" (see list_lumetri): numbers, on/off ("Creative (on)": true), colours
    "#rrggbb". A value can be animated: {"from": a, "to": b, "curve": "Land", "duration": "Sweep", "at_s": 0} bakes
    keys on the Motion DNA curve (a grade that changes over time). Whole edit by default (track=0)."""
    tok = M._tokens()
    plain, anim = {}, {}
    for k, val in params.items():
        if isinstance(val, dict) and "to" in val:
            bz = next(e["bezier"] for e in tok["easings"] if e["name"].lower() == str(val.get("curve", "Land")).lower())
            d = val.get("duration", "Sweep")
            secs = float(d) if str(d).replace(".", "", 1).isdigit() else next(x["ms"] for x in tok["durations"] if x["name"].lower() == str(d).lower()) / 1000
            steps = max(2, round(secs * 30))
            anim[k] = [[float(val.get("at_s", 0)) + secs * i / steps, val["from"] + (val["to"] - val["from"]) * M.bezier_y(*bz, i / steps)] for i in range(steps + 1)]
        else:
            plain[k] = val
    r, v = run(LUMETRI_JS + _targets_js(sequence, track, clip) + f"""
const PLAIN = {js(plain)}, ANIM = {js(anim)};
const col = (v) => typeof v === "string" && /^#[0-9a-f]{{6}}$/i.test(v) ? new ppro.Color(parseInt(v.slice(1, 3), 16) / 255, parseInt(v.slice(3, 5), 16) / 255, parseInt(v.slice(5, 7), 16) / 255, 1) : v;
const out = [];
for (const it of targets) {{
  if (await componentByMatch(it, "AE.ADBE Capsule")) continue;
  const map = await lumetriMap(await ensureLumetri(it));
  const miss = [...Object.keys(PLAIN), ...Object.keys(ANIM)].filter((k) => !map[k]);
  if (miss.length) throw new Error("unknown Lumetri parameter(s): " + miss.join(", ") + " (see list_lumetri)");
  const on = new Set([...Object.keys(PLAIN), ...Object.keys(ANIM)].map((k) => k.split("/")[0]).filter((s) => map[s + " (on)"]));
  if (on.size) tx("Motion DNA: Lumetri sections", () => [...on].map((s) => map[s + " (on)"].createSetValueAction(map[s + " (on)"].createKeyframe(true), true)));
  if (Object.keys(PLAIN).length) tx("Motion DNA: Lumetri", () => Object.entries(PLAIN).map(([k, v]) => map[k].createSetValueAction(map[k].createKeyframe(col(v)), true)));
  const inS = (await it.getInPoint()).seconds;
  for (const [k, keys] of Object.entries(ANIM)) {{
    const p = map[k];
    if (!p.isTimeVarying()) tx("Motion DNA: animate", () => p.createSetTimeVaryingAction(true));
    tx("Motion DNA: grade keys", () => keys.map(([s, val]) => {{ const kf = p.createKeyframe(val); kf.position = ppro.TickTime.createWithSeconds(inS + s); return p.createAddKeyframeAction(kf); }}));
    tx("Motion DNA: linear", () => keys.map(([s]) => p.createSetInterpolationAtKeyframeAction(ppro.TickTime.createWithSeconds(inS + s), ppro.Constants.InterpolationMode.LINEAR, false)));
  }}
  out.push(await it.getName());
}}
return out;""", premiere, timeout=180)
    return (f"Lumetri on {len(r)} clip(s) ({', '.join(r)}): {len(plain)} values set" + (f", {len(anim)} animated on Motion DNA curves" if anim else "")
            + f". Premiere {v}.")


def _wheel(v):
    """A wheel as [r, g, b] offsets (-1..1) or {"hue": degrees, "amount": 0..1}."""
    if isinstance(v, dict):
        h, a = math.radians(float(v.get("hue", 0))), float(v.get("amount", 0.3))
        return [a * math.cos(h), a * math.cos(h - 2 * math.pi / 3), a * math.cos(h + 2 * math.pi / 3)]
    return [float(x) for x in v]


def t_color_wheels(shadows=None, midtones=None, highlights=None, sequence=None, track=0, clip="all", premiere=None):
    """Colour wheels (lift / gamma / gain), which Lumetri does not expose to plugins, done with Levels per channel:
    shadows lift each channel's black output, midtones bend its gamma, highlights move its white input. Each wheel:
    {"hue": degrees (0 red, 120 green, 200 teal, 30 orange…), "amount": 0..1} or [r, g, b] offsets -1..1."""
    sh, md, hi = (_wheel(x) if x else [0, 0, 0] for x in (shadows, midtones, highlights))
    vals = {}
    for i, ch in enumerate("RGB"):
        vals[f"({ch}) Black Output Level"] = round(max(0, sh[i]) * 60, 2)
        vals[f"({ch}) Black Input Level"] = round(max(0, -sh[i]) * 40, 2)
        vals[f"({ch}) Gamma"] = round(100 * (1 + md[i] * 0.5), 2)
        vals[f"({ch}) White Input Level"] = round(255 - max(0, hi[i]) * 60, 2)
        vals[f"({ch}) White Output Level"] = round(255 - max(0, -hi[i]) * 60, 2)
    r, v = run(SET_PARAMS_JS + _targets_js(sequence, track, clip) + f"""
const out = [];
for (const it of targets) {{
  if (await componentByMatch(it, "AE.ADBE Capsule")) continue;
  let lv = await componentByMatch(it, "PR.ADBE Levels");
  if (!lv) {{ const comp = await ppro.VideoFilterFactory.createComponent("PR.ADBE Levels"); const ch = await it.getComponentChain(); tx("Motion DNA: wheels", () => ch.createAppendComponentAction(comp)); lv = await componentByMatch(it, "PR.ADBE Levels"); }}
  await setParams(lv, {js(vals)});
  out.push(await it.getName());
}}
return out;""", premiere, timeout=180)
    return f"Colour wheels (Levels per channel) on {len(r)} clip(s): shadows {shadows}, midtones {midtones}, highlights {highlights}. Premiere {v}."


def t_remove_effect(effect, sequence=None, track=1, clip=0, premiere=None):
    """Remove an effect (by name or match name) from a clip, a track (clip='all') or every clip (track=0)."""
    match = _resolve_fx(effect, premiere)
    r, v = run(_targets_js(sequence, track, clip) + f"""
let n = 0;
for (const it of targets) {{
  let k;
  while ((k = await componentByMatch(it, {js(match)}))) {{ const ch = await it.getComponentChain(); tx("Motion DNA: remove effect", () => ch.createRemoveComponentAction(k)); n++; if (n > 20) break; }}
}}
return n;""", premiere, timeout=120)
    return f"Removed {r} x {match}. Premiere {v}."


TOOLS = [
    ("organize_project", t_organize_project, "Sort the open project into Motion DNA bins (Footage, Audio, Music, Voice, Generated, Graphics, Stills, Sequences, Placeholders, Renders) with colour labels. dry_run shows the plan.",
     {"dry_run": {"type": "boolean"}}),
    ("collect_project", t_collect_project, "Collect files: copy all media in use to dest/Media/<bin>, Save As the project there and relink it to the copies (a complete hand-off folder). The open project becomes the copy; the original stays.",
     {"dest": {"type": "string"}}, ["dest"]),
    ("export_interchange", t_export_interchange, "Export a sequence for another app: otio (OpenTimelineIO), fcpxml (Final Cut / Resolve XML) or aaf.",
     {"fmt": {"type": "string", "enum": ["otio", "fcpxml", "aaf"]}, "sequence": {"type": "string"}, "out": {"type": "string"}}),
    ("merge_project", t_merge_project, "Bring another .prproj (its bins and sequences) into this project, in a bin; or an .aep (After Effects comps, live through Dynamic Link).",
     {"path": {"type": "string"}, "bin": {"type": "string"}}, ["path"]),
    ("add_placeholder", t_add_placeholder, "A 'PLACEHOLDER · <what>' card (brand colours) for a shot still to come; replace it later with add_generated(replace=...).",
     {"what": {"type": "string"}, "sequence": {"type": "string"}, "track": {"type": "integer"}, "time_s": {"type": "number"}, "duration_s": {"type": "number"}}, ["what"]),
    ("add_generated", t_add_generated, "Bring a generated asset (Flora, Krea, Figma Weave, Seedance… URL or file; generate it first with that provider's tools and quote USD) into bin Generated · <provider>, place it (or replace a placeholder) and mark its provenance (provider, prompt, cost).",
     {"source": {"type": "string"}, "provider": {"type": "string"}, "prompt": {"type": "string"}, "cost_usd": {"type": "number"}, "sequence": {"type": "string"},
      "track": {"type": "integer"}, "time_s": {"type": "number"}, "replace": {"type": "string"}, "duration_s": {"type": "number"}}, ["source"]),
    ("add_voice", t_add_voice, "A voice line (ElevenLabs, local voice clone, recording: a file) on an audio track, levelled to -16 LUFS, with the music ducked under it while it speaks.",
     {"source": {"type": "string"}, "sequence": {"type": "string"}, "track": {"type": "integer"}, "time_s": {"type": "number"}, "voice_lufs": {"type": "number"},
      "duck_music_db": {"type": "number"}, "music_track": {"type": "integer"}, "make_stereo": {"type": "boolean", "description": "turn a mono file into stereo (by default mono plays centred)"}}, ["source"]),
    ("add_animation", t_add_animation, "A Motion DNA animation over the edit: a code template (research/video_prompts/templates, rendered with alpha when it has it), a rendered MOV/MP4 or PNG-sequence folder, or an .aep (comps live).",
     {"source": {"type": "string"}, "sequence": {"type": "string"}, "track": {"type": "integer"}, "time_s": {"type": "number"}, "render_args": {"type": "string"}}, ["source"]),
    ("list_effects", t_list_effects, "Premiere's video effects and transitions (115 / 118 on 27.0), filtered by a word.", {"query": {"type": "string"}}),
    ("add_effect", t_add_effect, "Add any video effect (Gaussian Blur, Warp Stabilizer, Ultra Key, Glow, Vignette, Transform, Lens Flare…) to a clip, a track (clip='all') or every clip (track=0), with parameter values by display name.",
     {"effect": {"type": "string"}, "sequence": {"type": "string"}, "track": {"type": "integer"}, "clip": {}, "params": {"type": "object"}}, ["effect"]),
    ("add_transition", t_add_transition, "A transition on a cut, by name (dissolve, film dissolve, dip to black, push, slide, whip, cross zoom, light leaks, flash, glitch, zoom blur, spin, morph cut…) or by energy 1-5; duration a token (Tick..Stage) or seconds; where end/start/both; clip='all' for every cut on the track.",
     {"name": {"type": "string"}, "energy": {"type": "integer"}, "sequence": {"type": "string"}, "track": {"type": "integer"}, "clip": {}, "where": {"type": "string", "enum": ["end", "start", "both"]}, "duration": {}}),
    ("add_markers", t_add_markers, "Sequence markers at times (seconds), with names and comments.",
     {"times": {"type": "array", "items": {"type": "number"}}, "names": {"type": "array", "items": {"type": "string"}}, "comments": {"type": "array", "items": {"type": "string"}}, "sequence": {"type": "string"}}, ["times"]),
    ("beat_markers", t_beat_markers, "Markers on a music file's beats or onsets (tools/audio_markers.py), so cuts and moves land on them.",
     {"audio": {"type": "string"}, "sequence": {"type": "string"}, "mode": {"type": "string"}, "every": {"type": "integer"}, "limit": {"type": "integer"}}, ["audio"]),
    ("list_looks", t_list_looks, "The Motion DNA colour looks (Lumetri presets tagged by energy and tone).", {"tone": {"type": "string"}, "energy": {"type": "integer"}}),
    ("apply_look", t_apply_look, "Grade with a Motion DNA look as Lumetri Color (editable): the whole edit by default (track=0), a track (clip='all') or one clip; intensity 0-1+; extra overrides (e.g. {\"Basic.Exposure\": 0.2}).",
     {"look": {"type": "string"}, "sequence": {"type": "string"}, "track": {"type": "integer"}, "clip": {}, "intensity": {"type": "number"}, "extra": {"type": "object"}}, ["look"]),
    ("list_lumetri", t_list_lumetri, "Every Lumetri parameter Claude can set (\"Section/Name\") with its value on a clip, and what Premiere does not expose (curve points, wheel values, custom LUT files).",
     {"sequence": {"type": "string"}, "track": {"type": "integer"}, "clip": {}}),
    ("lumetri", t_lumetri, "Set any Lumetri parameter by \"Section/Name\" (Light/Exposure, Color/Temperature, Creative/Faded Film, Vignette/Amount, Correction/Saturation…; sections switch on by themselves); values can be animated on Motion DNA curves ({from, to, curve, duration, at_s}). Whole edit by default.",
     {"params": {"type": "object"}, "sequence": {"type": "string"}, "track": {"type": "integer"}, "clip": {}}, ["params"]),
    ("color_wheels", t_color_wheels, "Colour wheels (lift/gamma/gain) through Levels per channel, since Lumetri's wheels are not exposed: shadows / midtones / highlights each {hue, amount} or [r,g,b].",
     {"shadows": {}, "midtones": {}, "highlights": {}, "sequence": {"type": "string"}, "track": {"type": "integer"}, "clip": {}}),
    ("remove_effect", t_remove_effect, "Remove an effect from a clip, a track (clip='all') or every clip (track=0).",
     {"effect": {"type": "string"}, "sequence": {"type": "string"}, "track": {"type": "integer"}, "clip": {}}, ["effect"]),
    ("add_mask", t_add_mask, "Mask a clip: rect / ellipse / rounded / iris / wipe revealed on a Motion DNA curve (feather, invert, rect in 0-1), or person=True (local GPU cut-out). Done with a matte clip on the track above + Track Matte Key.",
     {"shape": {"type": "string", "enum": ["rect", "ellipse", "rounded", "iris", "wipe"]}, "sequence": {"type": "string"}, "track": {"type": "integer"}, "clip": {},
      "rect": {"type": "array", "items": {"type": "number"}}, "center": {"type": "array", "items": {"type": "number"}}, "feather": {"type": "number"}, "invert": {"type": "boolean"},
      "curve": {"type": "string"}, "reveal": {}, "person": {"type": "boolean"}}),
]
for t in TOOLS:   # every tool can target a Premiere version
    t[3]["premiere"] = {"type": "string", "description": "Premiere version when several are open, e.g. \"26\" or \"27\""}
if hasattr(M, "TOOLS_DEF") and not any(t[0] == "organize_project" for t in M.TOOLS_DEF):
    M.TOOLS_DEF += TOOLS
