"""Builds one preview comp per kit piece (library/kit.json + library/transitions.json) in the open After Effects, through
the same MCP calls Claude uses, renders them and turns them into catalog GIFs. Doubles as a test of every piece.

Usage (AE open, panel docked so the bridge runs):
  python tools/kit_gifs.py build     # comps "GIF__kit-<kind>__<name>" in a "Kit Previews" folder + research/kit_gif_comps.txt
  python tools/kit_gifs.py render    # renders the missing MP4s in AE (library/mp4/kit-<kind>/<slug>.mp4)
  python tools/kit_gifs.py gifs      # MP4 -> library/gifs/kit-<kind>/<slug>.gif (240 px, 12 fps) + _md.png stills
  python tools/kit_gifs.py all       # the three steps
  ONLY=element,shape python tools/kit_gifs.py build   # a subset of kinds (NAMES=glitch,spring for single pieces)
Samples use the DNA colours and the brand fonts (Inter Tight / Instrument Serif, falling back when AE substitutes them).
"""
import json
import os
import pathlib
import re
import subprocess
import sys
import time

ROOT = pathlib.Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT / "tools" / "mcp"))
import ss_motion_mcp as m  # noqa: E402

W, H, FPS = 1280, 720, 30
PINE, SEA, SPARK, CLOUD, TEAL, MINT = "#0A211F", "#174A46", "#D8FF85", "#F7F9F2", "#2E8B80", "#9FD9C4"
LIST = ROOT / "research" / "kit_gif_comps.txt"
CLIP_TYPES = {"zoom", "spin", "stretch", "slide", "flash", "dip", "shake", "twirl", "slices", "glitch"}


def slug(s):
    return re.sub(r"[^a-z0-9]+", "-", s.lower()).strip("-")


def comp_name(kind, name):
    return f"GIF__kit-{kind}__{name}"


# JSX helpers shared by every setup: a comp in the "Kit Previews" folder, brand fonts, a sample title, a card, A/B scenes
HELP = f"""
var KW = {W}, KH = {H};
function hx(h) {{ h = h.replace("#", ""); return [parseInt(h.substr(0, 2), 16) / 255, parseInt(h.substr(2, 2), 16) / 255, parseInt(h.substr(4, 2), 16) / 255]; }}
function kfont(list) {{ var bad = {{}}; try {{ var mm = app.fonts.missingOrSubstitutedFonts; for (var j = 0; j < mm.length; j++) bad[mm[j].postScriptName] = 1; }} catch (e) {{}}
  for (var i = 0; i < list.length; i++) {{ var ok = false; try {{ ok = app.fonts.getFontsByPostScriptName(list[i]).length > 0; }} catch (e) {{}} if (ok && !bad[list[i]]) return list[i]; }} return list[list.length - 1]; }}
function kfolder() {{ for (var i = 1; i <= app.project.numItems; i++) if (app.project.item(i) instanceof FolderItem && app.project.item(i).name === "Kit Previews") return app.project.item(i); return app.project.items.addFolder("Kit Previews"); }}
function kcomp(name, dur, bg) {{
  for (var i = app.project.numItems; i >= 1; i--) if (app.project.item(i).name === name) app.project.item(i).remove();
  var c = app.project.items.addComp(name, KW, KH, 1, dur, {FPS}); c.parentFolder = kfolder();
  if (bg) {{ var S = c.layers.addSolid(hx(bg), "BG", KW, KH, 1); S.locked = true; }}
  return c; }}
function ktext(c, str, serif, size, col, x, y, name) {{
  var L = c.layers.addText(str), p = L.property("ADBE Text Properties").property("ADBE Text Document"), d = p.value;
  d.resetCharStyle(); d.font = serif ? kfont(["InstrumentSerif-Regular", "Georgia"]) : kfont(["InterTight-SemiBold", "InterTight-Bold", "Arial-BoldMT"]);
  d.fontSize = size; d.fillColor = hx(col); d.applyFill = true; d.justification = ParagraphJustification.LEFT_JUSTIFY; p.setValue(d);
  var r = L.sourceRectAtTime(0, false); L.property("ADBE Transform Group").property("ADBE Position").setValue([x - r.left - r.width / 2, y - r.top - r.height / 2]);
  if (name) L.name = name; return L; }}
function kcard(c, w, h, col, name) {{
  var L = c.layers.addShape(); L.name = name || "Card";
  var v = L.property("ADBE Root Vectors Group").addProperty("ADBE Vector Group").property("ADBE Vectors Group");
  var r = v.addProperty("ADBE Vector Shape - Rect"); r.property("ADBE Vector Rect Size").setValue([w, h]); r.property("ADBE Vector Rect Roundness").setValue(28);
  v.addProperty("ADBE Vector Graphic - Fill").property("ADBE Vector Fill Color").setValue(hx(col));
  L.property("ADBE Transform Group").property("ADBE Position").setValue([KW / 2, KH / 2]); return L; }}
// our mark (assets/brand/motion_dna_mark.json) as the sample subject, centred, h px high
function kmark(c, h, name) {{
  var jf = new File(SS_ROOT + "/assets/brand/motion_dna_mark.json"); jf.encoding = "UTF-8"; jf.open("r"); var D = eval("(" + jf.read() + ")"); jf.close();
  var L = c.layers.addShape(); L.name = name || "Card";
  var v = L.property("ADBE Root Vectors Group").addProperty("ADBE Vector Group").property("ADBE Vectors Group");
  for (var i = 0; i < D.paths.length; i++) {{ var P = D.paths[i], sh = new Shape(); sh.vertices = P.v; sh.inTangents = P.i; sh.outTangents = P.o; sh.closed = true;
    v.addProperty("ADBE Vector Shape - Group").property("ADBE Vector Shape").setValue(sh); }}
  var f = v.addProperty("ADBE Vector Graphic - Fill"); f.property("ADBE Vector Fill Rule").setValue(2); f.property("ADBE Vector Fill Color").setValue(hx("#D8FF85"));
  var k = h / D.height * 100; L.property("ADBE Transform Group").property("ADBE Scale").setValue([k, k]);
  L.property("ADBE Transform Group").property("ADBE Position").setValue([KW / 2, KH / 2]); return L; }}
function kscene(name, bg, word, col, serif) {{
  for (var i = 1; i <= app.project.numItems; i++) if (app.project.item(i).name === name) return app.project.item(i);
  var c = kcomp(name, 10, bg); ktext(c, word, serif, 150, col, KW / 2, KH / 2); return c; }}
"""


def jsx(body):
    return m.run_jsx(HELP + body, includes=("ss_presets.jsx", "ss_behaviors.jsx", "ss_looks.jsx"))   # setups may draw a mesh background


def setup(kind, name, dur, bg=PINE, extra=""):
    """A fresh preview comp; extra JSX runs with `c` bound to it."""
    cn = comp_name(kind, name)
    r = jsx(f'var c = kcomp({json.dumps(cn)}, {dur}, {json.dumps(bg) if bg else "null"});\n{extra}\nreturn "ok";')
    if "ok" not in r:
        raise RuntimeError(r)
    return cn


SAMPLE = f'ktext(c, "Motion DNA", false, 120, "{CLOUD}", KW / 2, KH / 2, "Sample");'
CARD = f'kcard(c, 340, 190, "{SPARK}", "Card");'
MESH = 'SSL.background(c, "mesh", {colors: ["#0A211F", "#174A46", "#2E8B80", "#0F302C", "#174A46", "#9FD9C4"]});'

ELEMENTS = {
    "label": dict(text="New release"), "lower_third": dict(text="Dana Ruiz", sub="Head of Design"),
    "title": dict(text="Motion DNA", sub="The motion library"), "underline": dict(layer="Sample"), "highlight": dict(layer="Sample"),
    "callout": dict(text="Tap here", point=[520, 430]), "counter": dict(start=0, value=12500, prefix="$"), "timer": dict(value=10),
    "price_tag": dict(text="$49", sub="per month"), "handle": dict(text="motiondna"), "bubble": dict(text="Looks great!"),
    "sticker": dict(text="wow"), "quote": dict(text="Motion with its own DNA", sub="Motion DNA"), "list": dict(items=["Moves", "Curves", "Styles"]),
    "progress": dict(value=72), "button": dict(text="Subscribe", pressed="Subscribed", click=1.8), "kinetic": dict(items=["Move", "with", "intent"]),
    "tiles": dict(text="DNA"), "text_box": dict(text="Text box", sub="Sizes itself to the copy"), "media": dict(slot=[560, 315], text="Product shot"),
    "scale_title": dict(text="Scale title", mode="push"), "cinematic": dict(text="Cinema", style="blur"), "chat": dict(text="Did you see the new kit?"),
    "rating": dict(value=5), "ring": dict(value=72), "glass_card": dict(text="Glass card", sub="Frosted and smoky"),
    "end_card": dict(text="Motion DNA", sub="The motion library for After Effects"),
}
TEXT = {
    "Chars Pop Rise": dict(unit="chars", channels=["fade", "rise"], ease="Pop"),
    "Words Decode": dict(unit="words", channels=["decode", "fade"], mode="flicker"),
    "Lines Mask Rise": dict(unit="lines", channels=["rise"], mask=True),
    "Chars 3D Flip": dict(unit="chars", channels=["rotate3d", "fade"], order="center", ease="Nudge"),
    "Chars Wiggly Scale": dict(unit="chars", channels=["scale"], mode="wiggly", order="random"),
    "Words Tracking Blur": dict(unit="words", channels=["tracking", "blur", "fade"]),
    "Chars Skew Slide": dict(unit="chars", channels=["skew", "slide", "fade"], ease="Whip"),
    "Words Colour Pop": dict(unit="words", channels=["color", "scale"], ease="Pop"),
    "Typewriter Cursor": dict(typewriter=True, cps=14),
}


def build_one(kind, name, rows):
    """Creates the preview comp for one piece and applies it. Returns (comp name, answer)."""
    if kind == "element":
        bg_extra = (MESH if name == "glass_card" else "") + (SAMPLE.replace("120", "110") if name in ("underline", "highlight") else "")
        cn = setup(kind, name, 4.0 if name == "end_card" else 3.5, None if name == "glass_card" else PINE, bg_extra)
        args = dict(ELEMENTS.get(name, {}))
        cols = [PINE, SPARK, CLOUD]
        if name in ("label", "sticker"): cols = [SPARK, PINE, PINE]
        if name in ("title", "scale_title", "media"): cols = [CLOUD, SPARK, PINE]   # boxless: the text takes the Box colour
        return cn, m.t_add_element(kind=name, comp=cn, t=0.2, colors=cols, **args)
    if kind == "shape":
        cn = setup(kind, name, 2.6)
        return cn, m.t_add_shape(kind=name, comp=cn, t=0.15, position=[W / 2, H / 2], size=320, colors=[SPARK, CLOUD])
    if kind == "move":
        cn = setup(kind, name, 2.2, PINE, CARD)
        return cn, m.t_move(move=name, layers=["Card"], comp=cn, phase="in", t=0.2)
    if kind == "text":
        if name == "Captions":
            cn = setup(kind, name, 3.0)
            words = [{"w": w, "s": 0.2 + i * 0.35, "e": 0.55 + i * 0.35} for i, w in enumerate("Motion with its own DNA".split())]
            return cn, m.t_add_captions(words=words, comp=cn, style="highlight", colors=[PINE, SPARK, CLOUD])
        cn = setup(kind, name, 2.6, PINE, SAMPLE)
        return cn, m.t_animate_text(layers=["Sample"], comp=cn, t=0.2, **TEXT[name])
    if kind == "background":
        cn = setup(kind, name, 3.0, None)
        return cn, m.t_add_look(kind=name, comp=cn, colors=[PINE, SEA, TEAL, MINT, SPARK, CLOUD])
    if kind == "look":
        cn = setup(kind, name, 2.6, None, MESH + SAMPLE)
        if name in ("long_shadow", "glitch"):
            return cn, m.t_add_look(kind=name, comp=cn, layer="Sample", t=0.6)
        return cn, m.t_add_look(kind=name, comp=cn, colors=[PINE, TEAL, SPARK])
    if kind == "behavior":
        row = rows[name]
        tg = row["targets"][0]
        bg = None if tg == "background" else PINE
        cn = setup(kind, name, 3.0, bg, CARD if tg == "layer" else "")
        extra = dict(layers=["Card"]) if tg == "layer" else {}
        if tg == "box":   # a box behaviour drives an existing element's box: build a label first
            m.t_add_element(kind="label", comp=cn, t=0.15, text="Jelly label", colors=[SPARK, PINE, PINE], size=64)
            extra = dict(element="EL · label 1")
        return cn, m.t_add_behavior(behavior=name, target=tg, comp=cn, t=0.15, colors=[SPARK, MINT, TEAL, CLOUD], **extra)
    if kind == "transition":
        row = rows[name]
        ab = 'var A = kscene("KIT scene A", "#0A211F", "MOTION", "#F7F9F2", false), B = kscene("KIT scene B", "#174A46", "DNA", "#D8FF85", false);\n' \
             'var LA = c.layers.add(A); LA.name = "A"; LA.outPoint = 1.25; var LB = c.layers.add(B); LB.name = "B"; LB.startTime = 0; LB.inPoint = 1.25; LB.moveToBeginning();'
        cn = setup(kind, name, 2.5, None, ab)
        clip = row["type"] in CLIP_TYPES
        return cn, m.t_solid_transition(look=name, at_s=1.25, comp=cn, outgoing="A" if clip else None, incoming="B" if clip else None,
                                        colors=None if clip else [SPARK])
    raise ValueError(kind)


def pieces():
    kit = json.loads((ROOT / "library/kit.json").read_text(encoding="utf-8"))["items"]
    tr = json.loads((ROOT / "library/transitions.json").read_text(encoding="utf-8"))["transitions"]
    OSS = {"webfx", "spring", "physics", "gltransition"}   # previewed without AE by tools/oss_previews.py, by their own engines
    out = [(x["kind"], x["name"], x) for x in kit if x["kind"] not in OSS] + [("transition", x["name"], x) for x in tr]
    only = [k for k in os.environ.get("ONLY", "").split(",") if k]
    names = [k for k in os.environ.get("NAMES", "").split(",") if k]   # e.g. NAMES=glitch,spring (rebuild a few pieces)
    return [p for p in out if (not only or p[0] in only) and (not names or p[1] in names)]


def build():
    ps = pieces()
    rows = {n: x for _, n, x in ps}
    done, failed = [], []
    for kind, name, _ in ps:
        try:
            cn, ans = build_one(kind, name, rows)
            bad = re.search(r"(?i)\b(error|unknown|needs|does not pass)\b", ans or "")
            (failed if bad else done).append(cn if not bad else f"{cn}: {ans[:200]}")
            print(("FAIL " if bad else "ok   ") + cn, flush=True)
        except Exception as e:  # keep going: one broken piece must not stop the catalog
            failed.append(f"{comp_name(kind, name)}: {e}")
            print("FAIL " + comp_name(kind, name) + f": {e}", flush=True)
    prev = [l for l in LIST.read_text(encoding="utf-8").splitlines() if l] if LIST.exists() and (os.environ.get("ONLY") or os.environ.get("NAMES")) else []
    LIST.write_text("\n".join(sorted(set(prev + done))) + "\n", encoding="utf-8")
    print(f"{len(done)} comps built, {len(failed)} failed")
    for f in failed:
        print("  " + f)


def render():
    """Queues every listed comp without an MP4 and renders in AE (render_queue.jsx with the kit list)."""
    m.run_jsx(f'$.global.SS_GIF_LIST = {json.dumps(LIST.as_posix())}; $.evalFile(new File(SS_ROOT + "/tools/render_queue.jsx")); return "queued";', includes=())
    names = [l for l in LIST.read_text(encoding="utf-8").splitlines() if l]
    want = [ROOT / "library/mp4" / n.split("__")[1] / (slug("__".join(n.split("__")[2:])) + ".mp4") for n in names]
    t0 = time.time()
    while time.time() - t0 < 3 * 3600:
        missing = [p for p in want if not p.exists()]
        print(f"\r{len(want) - len(missing)}/{len(want)} rendered", end="", flush=True)
        if not missing:
            break
        time.sleep(15)
    print()


def gifs():
    names = [l for l in LIST.read_text(encoding="utf-8").splitlines() if l]
    n = 0
    for nm in names:
        kind, s = nm.split("__")[1], slug("__".join(nm.split("__")[2:]))
        mp4 = ROOT / "library/mp4" / kind / f"{s}.mp4"
        if not mp4.exists():
            print("missing " + str(mp4)); continue
        out = ROOT / "library/gifs" / kind
        out.mkdir(parents=True, exist_ok=True)
        subprocess.run(["ffmpeg", "-loglevel", "error", "-y", "-i", str(mp4), "-filter_complex",
                        "fps=12,scale=240:-1:flags=lanczos,split[a][b];[a]palettegen=max_colors=48:stats_mode=diff[p];[b][p]paletteuse=dither=bayer:bayer_scale=4:diff_mode=rectangle",
                        str(out / f"{s}.gif")], check=True)
        # a still for cards: the most detailed frame between 15% and 90% (particles peak early); for transitions the middle of the change
        import cv2
        cap = cv2.VideoCapture(str(mp4)); N = int(cap.get(cv2.CAP_PROP_FRAME_COUNT)); best, score = None, -1
        ends = []
        for f in (2, N - 3):   # transitions: the frame furthest from both shots is the transition itself
            cap.set(cv2.CAP_PROP_POS_FRAMES, f); ok, fr = cap.read(); ends.append(fr.astype("float32") if ok else None)
        for f in range(int(N * 0.15), int(N * 0.9), max(1, N // 24)):
            cap.set(cv2.CAP_PROP_POS_FRAMES, f); ok, fr = cap.read()
            if not ok: continue
            if kind == "kit-transition" and all(e is not None for e in ends):
                # away from both shots AND structured: a half-covered frame, not the flat full cover
                sc = min(float(abs(fr.astype("float32") - e).mean()) for e in ends) * (float(fr.std()) + 5)
            else:
                sc = cv2.Laplacian(cv2.cvtColor(fr, cv2.COLOR_BGR2GRAY), cv2.CV_64F).var() + fr.std() * 4
            if sc > score: best, score = fr, sc
        cap.release()
        if best is not None:
            cv2.imwrite(str(out / f"{s}_md.png"), cv2.resize(best, (480, round(best.shape[0] * 480 / best.shape[1])), interpolation=cv2.INTER_AREA))
        n += 1
    print(f"{n} GIFs written")


if __name__ == "__main__":
    step = sys.argv[1] if len(sys.argv) > 1 else "all"
    if step in ("build", "all"): build()
    if step in ("render", "all"): render()
    if step in ("gifs", "all"): gifs()
