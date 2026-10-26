"""Builds one preview scene per style (library/packs.json) in the open After Effects: a still from our tutorials
full-bleed, the people kept whole (tools/subjects.py), and the style's own type, line, pills and shape in the free side,
all animated by the style itself (SSP.applyPack, its own curve). Renders to library/packs/<slug>.mp4; then
bash tools/make_previews_stills.sh makes the GIF, the poster and the panel stills (the design agreed on 26 Oct 2026,
Figma motion-adn › 10 · Preview proposals).

Usage (AE open, bridge running):
  python tools/style_scenes.py build     # comps "STYLE__<slug>" in a "Style Previews" folder, queued, project saved
  python tools/style_scenes.py render    # aerender the queue, then re-encode the MP4s small
  NAMES=playful,tech python tools/style_scenes.py build
"""
import json, os, pathlib, subprocess, sys

ROOT = pathlib.Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT / "tools")); sys.path.insert(0, str(ROOT / "tools" / "mcp"))
from subjects import subjects, frame_people  # noqa: E402

W, H = 1280, 720
STILLS = ROOT / "library" / "packs" / "stills"
C = dict(pine="#0A211F", spark="#D8FF85", cloud="#F7F9F2", sea="#174A46", ink="#04120F", coral="#FF8A6B", cream="#EFE6D6", sand="#E2D6C0")
SERIF, SANS, BLACK, MONO = ["InstrumentSerif-Italic", "InstrumentSerif-Regular"], ["InterTight-SemiBold"], ["InterTight-ExtraBold", "InterTight-Bold"], ["JetBrainsMono-Medium", "InterTight-Medium"]
# style: (line, pills, title font, title px, ink, paint)
STYLE = {
    "calm-modern": ("Small travel, word by word, quiet exits.", ["soft · Settle", "calm", "friendly"], SERIF, 146, "pine", "cream"),
    "modern": ("Clean rises and slides on the brand curves.", ["medium · Land", "modern", "corporate"], BLACK, 150, "pine", "spark"),
    "elegant": ("Slow blurs, soft rises, generous timing.", ["soft · Surge", "elegant", "luxury"], SERIF, 180, "cloud", "pine"),
    "dynamic": ("Slams, whips and speed ramps.", ["dynamic · Whip", "bold", "cinematic"], BLACK, 170, "ink", "spark"),
    "playful": ("Bounces, wobbles, jack-in-the-box reveals.", ["dynamic · Pop", "playful"], BLACK, 146, "ink", "coral"),
    "tech": ("Decoding text, line draws, flicker.", ["medium · Coast", "technical", "retro"], MONO, 120, "spark", "ink"),
    "editorial": ("Typing, snaps on the action, construction lines.", ["medium · Coast", "editorial", "modern"], SERIF, 132, "ink", "cloud"),
    "storybook": ("Line by line, soft 3 % overshoots.", ["soft · Nudge", "warm", "organic"], SERIF, 150, "sea", "cream"),
    "collage": ("Cut-outs, archive, boil on 3s.", ["dynamic · Cruise", "retro", "handmade"], BLACK, 124, "ink", "cloud"),
}
WASH, PANEL = ("calm-modern", "elegant", "tech"), ("modern", "editorial")


def spec(slug):
    """Everything the JSX needs for one style, in comp pixels."""
    line, pills, font, size, ink, paint = STYLE[slug]
    s = dict(slug=slug, line=line, pills=pills, font=font, size=size, ink=C[ink], paint=C[paint], shapes=[], stills=[], m=64)
    s["pill_dark"] = ink != "spark" and ink != "cloud"   # dark pills on light paint, spark pills on dark
    if slug == "storybook":   # a page: the still set in it whole, the title beside it
        l, t, w = .43, .1, .53
        s.update(bg=C[paint], stills=[dict(file="storybook.jpg", l=l, t=t, w=w, rot=1.5)], side="left", x=64, colw=l * W - 110, anchor="bottom",
                 robot=dict(at=[(l + w) * W - 70, (t + w * 16 / 9 * 9 / 16) * H + 90], h=100, color=C["sea"]))
        return s
    if slug == "collage":   # cut-outs on paper, the title on a strip below
        s.update(bg=C["sand"], stills=[dict(file="collage-a.jpg", l=.03, t=.04, w=.5, rot=-4), dict(file="collage-b.jpg", l=.53, t=.08, w=.44, rot=5)],
                 side="left", x=60, colw=W * .7, anchor="bottom", strip=True, cutout=dict(file="robot.png", at=[W * .87, H * .8], h=H * .3),
                 shapes=[dict(kind="rect", c=[W * .515, H * .045], size=[W * .15, H * .07], rot=-12, color=C["spark"])])
        return s
    side, frac, sc, dx, dy, F, B = frame_people(subjects(STILLS / f"{slug}.jpg"))
    s.update(stills=[dict(file=f"{slug}.jpg", full=True, sc=sc, dx=dx, dy=dy)], side=side, faces=F)
    if side == "bottom":
        h = frac * H; s.update(x=64, colw=W * .46 - 80, anchor="bottom", band=h)
        if slug in WASH: s["wash"] = dict(rect=[0, H - h, W, h], feather=[0, H * .2])
        elif slug in PANEL: s["shapes"].append(dict(kind="poly", pts=[[0, H - h], [W, H - h], [W, H], [0, H]], color=C[paint]))
        elif slug == "dynamic": s["shapes"].append(dict(kind="poly", pts=[[0, H - h * .78], [W, H - h], [W, H], [0, H]], color=C[paint]))
        else: s["shapes"].append(dict(kind="wave", y=H - h, h=h, color=C[paint]))
        return s
    w = frac * W; x0 = 0 if side == "left" else W - w
    s.update(x=x0 + 64, colw=w - 128, anchor="bottom")
    if slug in WASH: s["wash"] = dict(rect=[x0, 0, w, H], feather=[W * .16, 0])
    elif slug in PANEL: s["shapes"].append(dict(kind="poly", pts=[[x0, 0], [x0 + w, 0], [x0 + w, H], [x0, H]], color=C[paint]))
    elif slug == "dynamic":
        s["shapes"].append(dict(kind="poly", pts=[[0, 0], [w, 0], [w * .84, H], [0, H]] if side == "left" else [[x0 + w * .16, 0], [W, 0], [W, H], [x0, H]], color=C[paint]))
        s["colw"] = w * .84 - 128
    else: s["shapes"].append(dict(kind="blob", x0=x0, w=w, side=side, color=C[paint]))
    if slug == "tech" and F: s["frame"] = [F[0][0] * W, F[0][1] * H, F[0][2] * W, F[0][3] * H]
    return s


JSX = r"""
function hx(h) { h = h.replace("#", ""); return [parseInt(h.substr(0, 2), 16) / 255, parseInt(h.substr(2, 2), 16) / 255, parseInt(h.substr(4, 2), 16) / 255]; }
function font(list) { for (var i = 0; i < list.length; i++) { try { if (app.fonts.getFontsByPostScriptName(list[i]).length) return list[i]; } catch (e) { return list[0]; } } return SSM.font("ui"); }
function tr(L, p) { return L.property("ADBE Transform Group").property(p); }
function footage(file) {
  var f = new File(SS_ROOT + "/library/packs/stills/" + file);
  for (var i = 1; i <= app.project.numItems; i++) { var it = app.project.item(i); if (it instanceof FootageItem && it.file && it.file.fsName === f.fsName) return it; }
  var io = new ImportOptions(f); return app.project.importFile(io);
}
function text(c, s, fnt, size, col, track) {
  var L = c.layers.addText(s), tp = L.property("ADBE Text Properties").property("ADBE Text Document"), td = tp.value;
  td.resetCharStyle(); td.font = fnt; td.fontSize = size; td.fillColor = hx(col); td.applyFill = true; td.tracking = track || 0;
  td.justification = ParagraphJustification.LEFT_JUSTIFY; tp.setValue(td); return L;
}
function box(L) { var r = L.sourceRectAtTime(0, false); return r; }
function setSize(L, size) { var tp = L.property("ADBE Text Properties").property("ADBE Text Document"), td = tp.value; td.fontSize = size; tp.setValue(td); }
function place(L, x, top) { var r = box(L); tr(L, "ADBE Position").setValue([x - r.left, top - r.top]); return r.height; }   // left edge at x, top at top
function poly(c, name, pts, ins, outs, col) {
  var L = c.layers.addShape(); L.name = name;
  var v = L.property("ADBE Root Vectors Group").addProperty("ADBE Vector Group").property("ADBE Vectors Group"), sh = new Shape();
  sh.vertices = pts; sh.inTangents = ins || []; sh.outTangents = outs || []; sh.closed = true;
  if (!ins) { var z = []; for (var i = 0; i < pts.length; i++) z.push([0, 0]); sh.inTangents = z; sh.outTangents = z; }
  v.addProperty("ADBE Vector Shape - Group").property("ADBE Vector Shape").setValue(sh);
  v.addProperty("ADBE Vector Graphic - Fill").property("ADBE Vector Fill Color").setValue(hx(col));
  tr(L, "ADBE Position").setValue([0, 0]);   // the path is in comp pixels
  return L;
}
function rect(c, name, cx, cy, w, h, r, col) {
  var L = c.layers.addShape(); L.name = name;
  var v = L.property("ADBE Root Vectors Group").addProperty("ADBE Vector Group").property("ADBE Vectors Group");
  var q = v.addProperty("ADBE Vector Shape - Rect"); q.property("ADBE Vector Rect Size").setValue([w, h]); q.property("ADBE Vector Rect Roundness").setValue(r);
  v.addProperty("ADBE Vector Graphic - Fill").property("ADBE Vector Fill Color").setValue(hx(col));
  tr(L, "ADBE Position").setValue([cx, cy]); return L;
}
function build(S, folder) {
  var name = "STYLE__" + S.slug;
  for (var i = app.project.numItems; i >= 1; i--) if (app.project.item(i) instanceof CompItem && app.project.item(i).name === name) app.project.item(i).remove();
  var c = app.project.items.addComp(name, 1280, 720, 1, 3.5, 30); c.parentFolder = folder;
  var bg = c.layers.addSolid(hx(S.bg || "#04120F"), "BG", 1280, 720, 1); bg.locked = true;
  for (var s = 0; s < S.stills.length; s++) {   // stills: full-bleed (zoomed and slid to keep people whole) or set in the page
    var st = S.stills[s], it = footage(st.file), L = c.layers.add(it); L.name = "Still " + (s + 1);
    if (st.full) { var k = 1280 / it.width * 100 * st.sc; tr(L, "ADBE Scale").setValue([k, k]); tr(L, "ADBE Position").setValue([(st.dx + st.sc / 2) * 1280, (st.dy + st.sc / 2) * 720]); L.locked = true; }
    else { var k2 = st.w * 1280 / it.width * 100; tr(L, "ADBE Scale").setValue([k2, k2]); tr(L, "ADBE Position").setValue([(st.l + st.w / 2) * 1280, st.t * 720 + st.w * 720 / 2]); tr(L, "ADBE Rotate Z").setValue(st.rot || 0); }
  }
  if (S.wash) {   // a soft wash from the edge: a solid with a feathered mask
    var w = c.layers.addSolid(hx(S.paint), "Wash", 1280, 720, 1), m = w.property("ADBE Mask Parade").addProperty("ADBE Mask Atom"), sh = new Shape(), R = S.wash.rect;
    sh.vertices = [[R[0], R[1]], [R[0] + R[2], R[1]], [R[0] + R[2], R[1] + R[3]], [R[0], R[1] + R[3]]]; sh.closed = true;
    m.property("ADBE Mask Shape").setValue(sh); m.property("ADBE Mask Feather").setValue(S.wash.feather); tr(w, "ADBE Opacity").setValue(94); w.locked = true;
  }
  for (var p = 0; p < S.shapes.length; p++) {
    var Q = S.shapes[p], P;
    if (Q.kind === "poly") P = poly(c, "Panel", Q.pts, null, null, Q.color);
    else if (Q.kind === "wave") P = poly(c, "Panel", [[0, Q.y + Q.h * .2], [1280, Q.y], [1280, 720], [0, 720]], [[0, 0], [-500, Q.h * .12], [0, 0], [0, 0]], [[420, -Q.h * .28], [0, 0], [0, 0], [0, 0]], Q.color);
    else if (Q.kind === "blob") P = (Q.side === "left") ? poly(c, "Panel", [[0, 72], [Q.x0 + Q.w, 720], [0, 720]], [[0, 0], [0, -420], [0, 0]], [[Q.w * .9, 0], [0, 0], [0, 0]], Q.color)
                                                      : poly(c, "Panel", [[1280, 72], [1280, 720], [Q.x0, 720]], [[0, 0], [0, 0], [0, -420]], [[0, 0], [0, 0], [0, 0]], Q.color);
    else { P = rect(c, "Tape", Q.c[0], Q.c[1], Q.size[0], Q.size[1], 0, Q.color); tr(P, "ADBE Rotate Z").setValue(Q.rot); tr(P, "ADBE Opacity").setValue(90); }
    if (Q.kind !== "rect") P.locked = true;   // the style's backdrop holds still; what sits on it animates
  }
  if (S.frame) { var fr = c.layers.addShape(); fr.name = "Tracking frame"; var fv = fr.property("ADBE Root Vectors Group").addProperty("ADBE Vector Group").property("ADBE Vectors Group");
    var fq = fv.addProperty("ADBE Vector Shape - Rect"); fq.property("ADBE Vector Rect Size").setValue([S.frame[2], S.frame[3]]); fq.property("ADBE Vector Rect Roundness").setValue(12);
    var fs = fv.addProperty("ADBE Vector Graphic - Stroke"); fs.property("ADBE Vector Stroke Color").setValue(hx("#D8FF85")); fs.property("ADBE Vector Stroke Width").setValue(4);
    tr(fr, "ADBE Position").setValue([S.frame[0] + S.frame[2] / 2, S.frame[1] + S.frame[3] / 2]); }
  if (S.robot) { var rb = SSM.sampleRobot(c, true, S.robot.h, S.robot.at, "Robot · line"); var gs = rb.property("ADBE Root Vectors Group");
    for (var g = 1; g <= gs.numProperties; g++) { var stk = gs.property(g).property("ADBE Vectors Group").property("ADBE Vector Graphic - Stroke"); if (stk) stk.property("ADBE Vector Stroke Color").setValue(hx(S.robot.color)); } }
  if (S.cutout) { var ci = footage(S.cutout.file), CL = c.layers.add(ci); CL.name = "Robot cut-out"; var kk = S.cutout.h / ci.height * 100; tr(CL, "ADBE Scale").setValue([kk, kk]); tr(CL, "ADBE Position").setValue(S.cutout.at); }
  // the type: title (shrunk until it fits its column), the line (wrapped), the pills (wrapped); stacked from the bottom
  var T = text(c, S.title, font(S.font), S.size, S.ink, S.font[0].indexOf("Inter") === 0 ? -30 : 0); T.name = "Title";
  var size = S.size; while (box(T).width > (S.side === "bottom" && !S.strip ? S.colw : S.colw) && size > 40) { size -= 4; setSize(T, size); }
  var lineW = S.side === "bottom" && !S.strip ? 1280 - 128 - S.colw - 48 : S.colw;
  var Ln = c.layers.addBoxText([lineW, 200], S.line), tp = Ln.property("ADBE Text Properties").property("ADBE Text Document"), td = tp.value;
  td.resetCharStyle(); td.font = font(["InterTight-Medium", "InterTight-Regular"]); td.fontSize = 36; td.fillColor = hx(S.ink); td.applyFill = true; td.leading = 46;
  td.justification = ParagraphJustification.LEFT_JUSTIFY; tp.setValue(td); Ln.name = "Line";
  var pills = [], pf = font(["InterTight-Bold", "InterTight-SemiBold"]);
  for (var q = 0; q < S.pills.length; q++) {
    var lab = S.pills[q].toUpperCase(), lt = text(c, lab, pf, 26, S.pill_dark ? "#D8FF85" : "#04120F", 60); lt.name = "Pill label " + (q + 1);
    var lr = box(lt), pw = lr.width + 40, ps = rect(c, "Pill " + (q + 1), 0, 0, pw, 52, 26, S.pill_dark ? "#04120F" : "#D8FF85");
    ps.moveAfter(lt); pills.push({ L: lt, S: ps, w: pw, r: lr });
  }
  // rows of pills inside lineW
  var rows = [[]], rw = 0; for (var a = 0; a < pills.length; a++) { if (rw + pills[a].w > lineW && rows[rows.length - 1].length) { rows.push([]); rw = 0; } rows[rows.length - 1].push(pills[a]); rw += pills[a].w + 14; }
  var pillsH = rows.length * 52 + (rows.length - 1) * 12, lh = box(Ln).height, th = box(T).height;
  var bottom = 720 - 56, x = S.x;
  function putPills(x0, top) { for (var r = 0; r < rows.length; r++) { var px = x0; for (var b = 0; b < rows[r].length; b++) { var pp = rows[r][b], cy = top + r * 64 + 26;
      tr(pp.S, "ADBE Position").setValue([px + pp.w / 2, cy]); tr(pp.L, "ADBE Position").setValue([px + 20 - pp.r.left, cy - pp.r.top - pp.r.height / 2]); pp.L.parent = pp.S; px += pp.w + 14; } } }
  if (S.side === "bottom" && !S.strip) {   // title on the left, line and pills on the right, bottoms aligned
    place(T, x, bottom - th); var rx = x + S.colw + 48; place(Ln, rx, bottom - pillsH - 18 - lh); putPills(rx, bottom - pillsH);
  } else {
    var top = bottom - pillsH - 18 - lh - 22 - th;
    if (S.strip) {   // collage: the title on a paper strip
      place(T, x + 24, top); var tb = box(T), strip = rect(c, "Title strip", x + tb.width / 2 + 24, top + th / 2, tb.width + 64, th + 28, 0, "#F7F9F2"); strip.moveAfter(T);
      tr(strip, "ADBE Rotate Z").setValue(-2); T.parent = strip; Ln.enabled = false; putPills(x, bottom - pillsH);
    } else { place(T, x, top); place(Ln, x, top + th + 22); putPills(x, bottom - pillsH); }
  }
  SSP.applyPack(c, S.name, null, "in");
  return c;
}
"""


def build(names):
    import ss_motion_mcp as m
    packs = {p["slug"]: p for p in json.loads((ROOT / "library/packs.json").read_text(encoding="utf-8"))["packs"]}
    specs = []
    for slug in names:
        s = spec(slug); s.update(name=packs[slug]["name"], title=packs[slug]["name"]); specs.append(s)
    body = JSX + f"""
var SPECS = {json.dumps(specs)}, folder = null;
for (var i = 1; i <= app.project.numItems; i++) if (app.project.item(i) instanceof FolderItem && app.project.item(i).name === "Style Previews") folder = app.project.item(i);
if (!folder) folder = app.project.items.addFolder("Style Previews");
var rq = app.project.renderQueue, out = [];
for (var r = rq.numItems; r >= 1; r--) rq.item(r).remove();
Folder(SS_ROOT + "/library/packs").create();
for (var k = 0; k < SPECS.length; k++) {{
  var c = build(SPECS[k], folder), it = rq.items.add(c), om = it.outputModule(1);
  try {{ om.applyTemplate("H.264 - Match Render Settings - 15 Mbps"); }} catch (e) {{ try {{ om.applyTemplate("H.264"); }} catch (e2) {{}} }}
  om.file = new File(SS_ROOT + "/library/packs/" + SPECS[k].slug + ".mp4"); out.push(c.name);
}}
app.project.save();
return out.join(", ");
"""
    print(m.run_jsx(body, timeout=600))


if __name__ == "__main__":
    cmd = sys.argv[1] if len(sys.argv) > 1 else "build"
    names = [n for n in os.environ.get("NAMES", "").split(",") if n] or list(STYLE)
    if cmd in ("build", "all"): build(names)
    if cmd in ("render", "all"):
        subprocess.run(["bash", str(ROOT / "tools/render_queue_aerender.sh")], check=False)
        for n in names:   # the photo makes aerender's 15 Mbps files heavy: re-encode near the old demos' size
            f = ROOT / "library/packs" / f"{n}.mp4"; t = f.with_suffix(".tmp.mp4")
            subprocess.run(["ffmpeg", "-v", "error", "-y", "-i", str(f), "-c:v", "libx264", "-crf", "30", "-preset", "slow", "-pix_fmt", "yuv420p", "-an", str(t)], check=True)
            t.replace(f); print(f.name, f.stat().st_size // 1024, "KB")
