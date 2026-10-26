"""Characters, ready to animate: a pixel character (library/characters/<slug>/character.json, style "pixel") as layers
for Figma and After Effects, and lipsync from a voice line. Everything comes from the character file, so Figma, After
Effects and the videos never drift apart. No GPU, nothing to install beyond Playwright and ffmpeg.

  python tools/character_kit.py export the-agent
      -> library/characters/the-agent/kit/: body_<emotion>.png (the sprite with that face, no mouth), mouth_<A-H>.png
         (only the mouth's pixels, transparent elsewhere), kit.json (sizes, layers)
  python tools/character_kit.py figma the-agent
      -> kit/figma_build.js: a script for the Figma MCP (use_figma) that draws the character as editable pixel
         rectangles, one group per layer (Body · <emotion>, Mouth · <viseme>), in a frame named "<Name> · pixel kit"
  python tools/character_kit.py lipsync voice.wav --text "the words" [--out visemes.json]
      -> visemes over time [{t, v}]: word timings from tools/vo_words.py when it runs (faster-whisper), else the text
         spread over the voice's loud stretches; letters become Rhubarb shapes (A-H, X at rest), held at least 2 frames
  python tools/character_kit.py ae the-agent [--audio voice.wav --text "..."] [--emotion happy]
      -> builds "CHAR__<slug>" in the open After Effects: the body layers (one visible), the mouth layers keyed by the
         lipsync, the voice, blinks; nearest-neighbour scaling so the pixels stay crisp
The MCP tools add_character and lipsync call the same functions.
"""
import argparse
import json
import pathlib
import re
import subprocess
import sys

ROOT = pathlib.Path(__file__).resolve().parent.parent
RIG = ROOT / "research/video_prompts/runtime/pixel_rig.js"
FPS = 30


def char(slug):
    return json.loads((ROOT / "library/characters" / slug / "character.json").read_text(encoding="utf-8"))


def kit_dir(slug):
    d = ROOT / "library/characters" / slug / "kit"; d.mkdir(parents=True, exist_ok=True); return d


# ---------------------------------------------------------------- export: the rig's sprites as layers
def export(slug, scale=1):
    sys.path.insert(0, str(ROOT / "tools")); from sound_kit import browser
    from playwright.sync_api import sync_playwright
    C = char(slug); out = kit_dir(slug)
    html = f"""<!doctype html><script>{RIG.read_text(encoding='utf-8')}</script><script>
      const C = {json.dumps(C)}; const rig = PixelRig(C);
      const png = st => rig.render(Object.assign({{pose: "idle", light: 1, sy: 1, t: 0.2}}, st)).toDataURL("image/png");
      window.KIT = {{w: rig.W, h: rig.H,
        bodies: Object.fromEntries(Object.keys(C.emotions).map(e => [e, png({{emotion: e, mouth: null}})])),
        mouths: Object.fromEntries(Object.entries(C.visemes).filter(([k]) => k !== "note").map(([k, v]) => [k, png({{emotion: "neutral", mouth: v}})]))}};
    </script>"""
    with sync_playwright() as p:
        b = browser(p); pg = b.new_page(); pg.set_content(html); kit = pg.evaluate("window.KIT"); b.close()
    import base64, io
    from PIL import Image, ImageChops
    dec = lambda u: Image.open(io.BytesIO(base64.b64decode(u.split(",", 1)[1]))).convert("RGBA")
    for e, u in kit["bodies"].items(): dec(u).save(out / f"body_{e}.png")
    blank = dec(kit["bodies"]["neutral"])
    for v, u in kit["mouths"].items():   # the mouth alone: the pixels that differ from the neutral face without a mouth
        im = dec(u); diff = ImageChops.difference(im.convert("RGB"), blank.convert("RGB")).convert("L").point(lambda x: 255 if x else 0)
        m = Image.new("RGBA", im.size, (0, 0, 0, 0)); m.paste(im, mask=diff); m.save(out / f"mouth_{v}.png")
    meta = {"slug": slug, "name": C["name"], "w": kit["w"], "h": kit["h"], "emotions": list(kit["bodies"]), "visemes": list(kit["mouths"])}
    (out / "kit.json").write_text(json.dumps(meta, indent=1) + "\n", encoding="utf-8")
    return meta


# ---------------------------------------------------------------- figma: editable pixel rectangles
def figma(slug, emotions=("neutral", "happy"), px=8):   # two faces keep the script under the Figma MCP's 50 KB
    """use_figma JavaScript: a frame with one group per layer, each pixel run a rectangle (runs merged per row)."""
    from PIL import Image
    d = kit_dir(slug); meta = json.loads((d / "kit.json").read_text(encoding="utf-8")); groups = []
    def runs(path):
        im = Image.open(path).convert("RGBA"); W, H = im.size; px_ = im.load(); out = []
        for y in range(H):
            x = 0
            while x < W:
                c = px_[x, y]
                if c[3] == 0: x += 1; continue
                x0 = x
                while x < W and px_[x, y] == c: x += 1
                out.append([x0, y, x - x0, "%02x%02x%02x" % c[:3]])
        return out
    for e in emotions: groups.append([f"Body · {e}", runs(d / f"body_{e}.png"), e == "neutral"])
    for v in meta["visemes"]:
        if v != "X": groups.append([f"Mouth · {v}", runs(d / f"mouth_{v}.png"), v == "A"])
    js = f"""// Draws {meta['name']} as editable pixel art (built by tools/character_kit.py figma {slug}). One group per layer;
// hidden groups are the other faces and mouths. After editing, export each group as PNG into
// library/characters/{slug}/kit/ (same names) and run: python tools/character_kit.py ae {slug}
const G = {json.dumps(groups)}, PX = {px}, W = {meta['w']}, H = {meta['h']};
const hex = h => ({{r: parseInt(h.slice(0, 2), 16) / 255, g: parseInt(h.slice(2, 4), 16) / 255, b: parseInt(h.slice(4, 6), 16) / 255}});
let maxX = 0; for (const n of figma.currentPage.children) maxX = Math.max(maxX, n.x + n.width);
const frame = figma.createFrame(); frame.name = "{meta['name']} · pixel kit"; frame.resize(W * PX, H * PX); frame.x = maxX + 200; frame.y = 0;
frame.fills = [{{type: "SOLID", color: hex("0A211F")}}];
const ids = [frame.id];
for (const [name, rects, visible] of G) {{
  const nodes = rects.map(([x, y, w, c]) => {{ const r = figma.createRectangle(); r.x = x * PX; r.y = y * PX; r.resize(w * PX, PX); r.fills = [{{type: "SOLID", color: hex(c)}}]; frame.appendChild(r); return r; }});
  const g = figma.group(nodes, frame); g.name = name; g.visible = visible; ids.push(g.id);
}}
return {{createdNodeIds: ids, frame: frame.id}};
"""
    (d / "figma_build.js").write_text(js, encoding="utf-8")
    return d / "figma_build.js"


# ---------------------------------------------------------------- lipsync: letters to mouth shapes on the voice
SHAPE = [("mbp", "A"), ("fv", "G"), ("ou", "F"), ("w", "F"), ("o", "E"), ("a", "D"), ("e", "C"), ("i", "C"), ("y", "C"),
         ("l", "H"), ("tdnsz", "B"), ("kgcjxqrh", "B")]


def letter(ch):
    for keys, v in SHAPE:
        if ch in keys: return v
    return None


def loudness(audio, fps=FPS):
    raw = subprocess.run(["ffmpeg", "-v", "error", "-i", str(audio), "-ac", "1", "-ar", "16000", "-f", "s16le", "-"], capture_output=True, check=True).stdout
    import numpy as np
    a = np.abs(np.frombuffer(raw, np.int16).astype(float)); hop = 16000 // fps
    e = np.array([a[i:i + hop].mean() for i in range(0, len(a), hop)]); return e / (e.max() or 1)


def words_of(audio, text):
    """[{w, s, e}]: from faster-whisper when it runs, else the text spread over the loud stretches of the voice."""
    try:
        import tempfile
        tmp = pathlib.Path(tempfile.mkdtemp()) / "words.json"
        subprocess.run([sys.executable, str(ROOT / "tools/vo_words.py"), str(audio), str(tmp)], capture_output=True, text=True, timeout=600)
        ws = json.loads(tmp.read_text(encoding="utf-8")) if tmp.exists() else []
        ws = ws.get("words", ws) if isinstance(ws, dict) else ws
        if ws: return [{"w": w.get("w") or w.get("word", ""), "s": float(w.get("s", w.get("start", 0))), "e": float(w.get("e", w.get("end", 0)))} for w in ws]
    except Exception:
        pass
    e = loudness(audio); on = e > .12; words = re.findall(r"[\w']+", text or "")
    spans, i = [], 0
    while i < len(on):   # the loud stretches
        if on[i]:
            j = i
            while j < len(on) and (on[j] or (j + 4 < len(on) and on[j:j + 4].any())): j += 1
            spans.append((i / FPS, j / FPS)); i = j
        else: i += 1
    total = sum(b - a for a, b in spans) or 1; chars = sum(len(w) for w in words) or 1; out, k = [], 0
    for a, b in spans:   # give each stretch its share of the words, by letters
        share = (b - a) / total * chars; acc = 0; t = a
        while k < len(words) and acc < share - .5:
            d = (b - a) * len(words[k]) / max(1, share); out.append({"w": words[k], "s": t, "e": min(b, t + d)}); t += d; acc += len(words[k]); k += 1
    return out


def lipsync(audio, text=""):
    """Visemes over time [{t, v}], held at least 2 frames, X (rest) between words."""
    keys = []
    for w in words_of(audio, text):
        letters = [c for c in w["w"].lower() if letter(c)]
        if not letters: continue
        d = (w["e"] - w["s"]) / len(letters)
        for i, c in enumerate(letters): keys.append({"t": round(w["s"] + i * d, 3), "v": letter(c)})
        keys.append({"t": round(w["e"], 3), "v": "X"})
    out, last = [], None
    for k in sorted(keys, key=lambda k: k["t"]):   # merge repeats, hold each shape 2 frames or more
        if last and (k["v"] == last["v"] or k["t"] - last["t"] < 2 / FPS):
            if k["v"] == "X" and k["t"] - last["t"] >= 2 / FPS: pass
            else: continue
        out.append(k); last = k
    return out


# ---------------------------------------------------------------- after effects
def ae_jsx(slug, emotion="neutral", visemes=None, audio=None, scale=6, at=None, dur=None):
    d = kit_dir(slug); meta = json.loads((d / "kit.json").read_text(encoding="utf-8"))
    dur = dur or ((visemes[-1]["t"] + 1.0) if visemes else 4.0)
    return f"""
var KIT = {json.dumps(str(d).replace(chr(92), '/'))}, META = {json.dumps(meta)}, EMO = {json.dumps(emotion)}, VIS = {json.dumps(visemes or [])};
var AUDIO = {json.dumps(str(audio).replace(chr(92), '/') if audio else None)}, S = {scale}, DUR = {dur:.3f};
function imp(f) {{ var file = new File(f); for (var i = 1; i <= app.project.numItems; i++) {{ var it = app.project.item(i); if (it instanceof FootageItem && it.file && it.file.fsName === file.fsName) return it; }} return app.project.importFile(new ImportOptions(file)); }}
var name = "CHAR__" + META.slug;
var c = null;   // rebuilt in place, so scenes that already use it keep it
for (var i = 1; i <= app.project.numItems; i++) if (app.project.item(i) instanceof CompItem && app.project.item(i).name === name) c = app.project.item(i);
if (c) {{ for (var j = c.numLayers; j >= 1; j--) c.layer(j).remove(); c.duration = DUR; }} else c = app.project.items.addComp(name, META.w * S, META.h * S, 1, DUR, {FPS});
function layer(file, nm) {{ var L = c.layers.add(imp(KIT + "/" + file)); L.name = nm; L.quality = LayerQuality.DRAFT;   // draft = nearest neighbour: crisp pixels
  L.property("ADBE Transform Group").property("ADBE Scale").setValue([S * 100, S * 100]); L.property("ADBE Transform Group").property("ADBE Position").setValue([c.width / 2, c.height / 2]); return L; }}
for (var e = 0; e < META.emotions.length; e++) {{ var B = layer("body_" + META.emotions[e] + ".png", "Body · " + META.emotions[e]); B.enabled = META.emotions[e] === EMO; }}
var M = {{}};
for (var v = 0; v < META.visemes.length; v++) {{ var k = META.visemes[v]; if (k === "X") continue; M[k] = layer("mouth_" + k + ".png", "Mouth · " + k); M[k].moveToBeginning();
  var op = M[k].property("ADBE Transform Group").property("ADBE Opacity"); op.setValueAtTime(0, 0); op.setInterpolationTypeAtKey(1, KeyframeInterpolationType.HOLD); }}
for (var j = 0; j < VIS.length; j++) for (var k2 in M) {{ var o = M[k2].property("ADBE Transform Group").property("ADBE Opacity"); var idx = o.addKey(VIS[j].t); o.setValueAtKey(idx, VIS[j].v === k2 ? 100 : 0); o.setInterpolationTypeAtKey(idx, KeyframeInterpolationType.HOLD); }}
if (AUDIO) {{ var A = c.layers.add(imp(AUDIO)); A.name = "Voice"; A.moveToEnd(); }}
c.comment = "Motion DNA character: " + META.name + " (" + EMO + "), lipsync " + VIS.length + " keys";
return name + " · " + VIS.length + " mouth keys";
"""


def ae(slug, emotion="neutral", audio=None, text="", scale=6):
    sys.path.insert(0, str(ROOT / "tools/mcp")); import ss_motion_mcp as m
    if not (kit_dir(slug) / "kit.json").exists(): export(slug)
    audio = pathlib.Path(audio).resolve() if audio else None   # After Effects needs a full path
    vis = lipsync(audio, text) if audio else []
    return m.run_jsx(ae_jsx(slug, emotion, vis, audio, scale), timeout=300, includes=())


if __name__ == "__main__":
    ap = argparse.ArgumentParser(); ap.add_argument("cmd"); ap.add_argument("arg"); ap.add_argument("--text", default="")
    ap.add_argument("--audio"); ap.add_argument("--emotion", default="neutral"); ap.add_argument("--out")
    a = ap.parse_args()
    if a.cmd == "export": print(export(a.arg))
    elif a.cmd == "figma": print(figma(a.arg))
    elif a.cmd == "lipsync":
        v = lipsync(a.arg, a.text); s = json.dumps(v, indent=1)
        (pathlib.Path(a.out).write_text(s) if a.out else print(s))
    elif a.cmd == "ae": print(ae(a.arg, a.emotion, a.audio, a.text))
