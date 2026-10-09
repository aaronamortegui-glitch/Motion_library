"""Writes media/explainer/explainer.json (scenes for tools/build_explainer.jsx) and media/explainer/edit.json
(sequence for tools/build_edit.jsx). Coordinates match the Figma storyboard (file slack_video, page "motion pluguin").
Run from the repo root: python media/explainer/make_specs.py
"""
import json
import pathlib

ROOT = pathlib.Path(__file__).resolve().parent.parent.parent
LEAD = 0.3                                              # VO starts this long into each scene
DUR = [6.65, 7.52, 8.2, 8.38, 5.2, 8.45, 8.91, 5.82, 8.5]  # VO length (atempo 1.05) + margins


def T(text, font, size, at, t, preset=None, motion=None, color=None, **k):
    e = {"type": "text", "text": text, "font": font, "size": size, "at": at, "t": t}
    if preset: e["preset"] = preset
    if motion: e["motion"] = motion
    if color: e["color"] = color
    e.update(k)
    return e


def P(text, at, t, motion="Bounce In", size=30, **k):
    e = {"type": "pill", "text": text, "at": at, "t": t, "motion": motion, "size": size}
    e.update({a: b for a, b in k.items() if b is not None})
    return e


def M(file, at, size, t, motion, radius=24, **k):
    e = {"type": "media", "file": file, "at": at, "size": size, "t": t, "motion": motion, "radius": radius}
    e.update(k)
    return e


def C(name, at, size, t, motion, fill, items, radius=28, **k):
    e = {"type": "card", "name": name, "at": at, "size": size, "t": t, "motion": motion, "fill": fill, "items": items, "radius": radius}
    e.update(k)
    return e


S = []
# S01 · Hook
S.append({"comp": "EX_S01", "bg": "pine", "elements": [
    T("AI motion all looks the\rsame.", "med", 130, [140, 250], 0.3, preset="Words Fade Up"),
    T("Same curves. Same moves.", "ital", 150, [140, 590], 2.2, motion="Slam In", color="spark"),
] + [P(p[0], [p[1], p[2]], 0.6 + i * 0.12, fx="Jitter", size=34) for i, p in enumerate(
    [["ease-in-out", 1180, 150], ["default bounce", 1480, 250], ["template", 1260, 830], ["fade + slide", 1520, 930], ["linear", 1600, 700], ["overshoot", 1120, 960]])]})

# S02 · Our own curves
cards2 = [["6", "durations", "Tick → Stage, 133 ms to 1.1 s", "head"], ["10", "curves", "Land, Settle, Pop, Recoil…", "head"], ["3", "speed ramps", "Ramp · Surge · Whip", "spark"]]
S.append({"comp": "EX_S02", "bg": "cloud", "elements": [
    T("We start from", "med", 110, [140, 90], 0.2, preset="Chars Rise"),
    T("our own curves.", "ital", 124, [920, 82], 0.9, motion="Slam In"),
    M("docs/screens/tokens.png", [140, 250], [1180, 726], 1.3, "Surge Rise"),
] + [C(c[1], [1380, 250 + i * 250], [400, 226], 2.4 + i * 0.45, "Scale Pop" if i == 2 else "Slide Land", c[3], [
    {"text": c[0], "font": "ital", "size": 96, "at": [36, 14]}, {"text": c[1], "font": "semi", "size": 44, "at": [36, 118]},
    {"text": c[2], "font": "reg", "size": 26, "at": [36, 176]}], radius=32) for i, c in enumerate(cards2)]})

# S03 · Categories & styles
packs = ["Dynamic", "Elegant", "Modern", "Playful", "Tech"]
S.append({"comp": "EX_S03", "bg": "pine", "elements": [
    T("Motion by", "med", 110, [140, 90], 0.2, preset="Chars Rise"),
    T("category and style.", "ital", 124, [640, 82], 0.8, motion="Slam In", color="spark"),
    M("docs/screens/visualizer.png", [140, 260], [1080, 682], 0.9, "Whip Pan"),
    P("68 presets · 5 categories", [140, 975], 2.0, motion="Fade Up", size=30),
] + [C("pack " + p, [1260, 260 + i * 140], [520, 132], 3.6 + i * 0.16, "Back In Left", None, [
    {"type": "media", "file": "library/packs/%s.mp4" % p.lower(), "at": [12, 12], "size": [192, 108], "radius": 12, "skip": 1.2},
    {"text": p, "font": "semi", "size": 40, "at": [228, 26], "color": "cloud"},
    {"text": "pack", "font": "ital", "size": 34, "at": [228, 76], "color": "spark"}], radius=20, stroke="pillStroke") for i, p in enumerate(packs)]})

# S04 · The plugin
feats = [["01", "Gallery by category", "Motion, Classics, Text, Effects,\rRecipes, Packs, Assets", "head"], ["02", "Live preview", "The real curve, redrawn as vectors", "head"],
         ["03", "In · Out · Both", "One click, with a stagger", "spark"], ["04", "Markers", "Drag SS in / SS out to retime", "head"]]
el4 = [T("A plugin you", "med", 110, [140, 110], 0.2, preset="Chars Rise"),
       T("drive by hand.", "ital", 124, [140, 220], 0.7, motion="Slam In"),
       M("media/explainer/panel_rec.mp4", [1290, 60], [556, 954], 0.4, "Flip In"),
       P("Window › SS Motion.jsx · Windows & macOS", [140, 820], 3.6, motion="Fade Up", size=28, light=True)]
for i, f in enumerate(feats):
    e = C(f[1], [140 + (i % 2) * 530, 420 + (i // 2) * 175], [500, 150], 1.6 + i * 0.35, "Stretch Slide", f[3], [
        {"text": f[0], "font": "ital", "size": 56, "at": [30, 18]}, {"text": f[1], "font": "semi", "size": 34, "at": [120, 26]},
        {"text": f[2], "font": "reg", "size": 22, "at": [120, 78]}])
    if i == 2:
        e["attention"] = {"name": "Rubber Band", "t": 5.6}
    el4.append(e)
S.append({"comp": "EX_S04", "bg": "cloud", "elements": el4})

# S05 · Markers
S.append({"comp": "EX_S05", "bg": "pine", "elements": [
    T("Drag a marker.", "med", 130, [140, 110], 0.2, preset="Words Fade Up"),
    T("The curve follows.", "ital", 150, [140, 240], 1.7, preset="Chars Ramp", color="spark"),
    M("media/explainer/ae_markers_timeline.png", [140, 470], [1640, 246], 0.3, "Blur In", radius=16),
    {"type": "rect", "at": [140, 850], "size": [1640, 56], "radius": 12, "fill": "bar", "t": 0.6, "motion": "Wipe Reveal"},
    {"type": "marker", "label": "SS in", "color": "spark", "from": [300, 778], "at": [700, 778], "t": 1.4, "duration": "Stage", "ease": "Whip"},
    {"type": "marker", "label": "SS out", "color": "coral", "from": [1600, 778], "at": [1300, 778], "t": 2.6, "duration": "Stage", "ease": "Whip"},
    T("← entrance ends here", "reg", 26, [720, 960], 2.3, motion="Fade Up"),
    T("exit starts here →", "reg", 26, [1060, 960], 3.4, motion="Fade Up"),
]})

# S06 · Claude drives it
rows = [["list_packs", "5 packs", "cloud"], ["apply_pack · Elegant", "8 layers animated · SS in / SS out markers", "spark"], ["render_frame · 1.2 s", "frame.png", "cloud"]]
el6 = [T("Or let", "med", 110, [140, 90], 0.2, preset="Chars Rise"),
       T("Claude drive it.", "ital", 124, [460, 82], 0.6, motion="Slam In"),
       C("chat", [140, 260], [900, 700], 0.9, "Fade Up", "white", [
           {"type": "box", "at": [60, 50], "size": [780, 120], "radius": 24, "fill": "head"},
           {"text": "Apply the Elegant pack to this comp\rand show me a frame.", "font": "med", "size": 32, "at": [90, 66]},
           {"text": "ss-motion MCP server · Claude Code", "font": "reg", "size": 24, "at": [60, 640], "color": "gray"}], radius=32, stroke="chipStroke"),
       M("library/packs/elegant.mp4", [1100, 260], [680, 383], 5.4, "Ramp Zoom", skip=1.5),
       T("Checks its own work,", "semi", 44, [1100, 680], 5.9, preset="Words Fade Up"),
       T("frame by frame.", "ital", 60, [1100, 736], 6.3, preset="Words Fade Up")]
for i, r in enumerate(rows):
    el6.append(C("tool " + r[0], [200, 470 + i * 130], [780, 110], 2.4 + i * 0.9, "Back In Left", r[2], [
        {"text": "✓  " + r[0], "font": "semi", "size": 32, "at": [30, 18]}, {"text": r[1], "font": "reg", "size": 24, "at": [76, 64]}], radius=20))
S.append({"comp": "EX_S06", "bg": "cloud", "elements": el6})

# S07 · Techniques
tech = [["tech_freeze_type", "Kinetic type on freezes"], ["tech_roto_breakdown", "AI roto + contours"], ["tech_speed_ramp", "Speed ramps"],
        ["tech_tracking", "Tracked labels"], ["tech_text_behind", "Text behind people"], ["tech_hud", "HUD on footage"]]
el7 = [T("Every test leaves", "med", 110, [140, 80], 0.2, preset="Chars Rise"),
       T("a technique behind.", "ital", 124, [1010, 72], 0.8, motion="Slam In", color="spark")]
for i, t in enumerate(tech):
    x, y = 140 + (i % 3) * 556, 250 + (i // 3) * 390
    el7.append(M("media/explainer/%s.png" % t[0], [x, y], [530, 298], 1.4 + i * 0.14, "Scale Pop", radius=20))
    el7.append(P(t[1], [x, y + 314], 1.7 + i * 0.14, motion="Fade Up", size=26))
S.append({"comp": "EX_S07", "bg": "pine", "elements": el7})

# S08 · Refine by hand
checks = ["Native keyframes and expressions", "No plugin needed to render", "Every curve stays editable", "Markers, packs or by hand"]
el8 = [T("Then you", "med", 110, [140, 90], 0.2, preset="Chars Rise"),
       T("refine it.", "ital", 124, [640, 82], 0.7, motion="Slam In"),
       M("media/explainer/ae_markers_window.png", [140, 250], [1280, 723], 0.6, "Surge Rise", radius=20)]
for i, c in enumerate(checks):
    el8.append(P("✓  " + c, [1450, 300 + i * 110], 1.6 + i * 0.3, motion="Drop Bounce", size=22, light=True, fill="spark" if i == 0 else None))
S.append({"comp": "EX_S08", "bg": "cloud", "elements": el8})

# S09 · Close
S.append({"comp": "EX_S09", "bg": "pine", "elements": [
    T("Motion that looks like us.", "ital", 170, [120, 150], 0.3, preset="Blur Words", color="spark"),
    T("Not like AI.", "med", 110, [140, 470], 2.4, motion="Slam In"),
    M("media/explainer/reel_cypher.png", [1180, 430], [300, 169], 1.4, "Flip In X", radius=16),
    M("media/explainer/reel_boardroom.png", [1500, 430], [300, 169], 1.6, "Flip In X", radius=16),
] + [P(p, [x, 650], 3.3 + i * 0.12, size=28) for i, (p, x) in enumerate([["68 presets", 140], ["5 packs", 360], ["plugin + MCP", 540], ["open repo", 810]])] + [
    M("media/explainer/superside_logo_cloud.png", [110, 880], [560, 201], 4.4, "Fade Up", radius=0),
    {"type": "rect", "at": [661, 905], "size": [2, 72], "fill": "muted", "t": 4.6, "motion": "Fade"},
    T("SS Motion Library", "med", 30, [695, 912], 4.7, preset="Words Fade Up", color="cloud"),
    T("by Aaron Amortegui & Gian Orsi · AI Native Studio", "reg", 22, [695, 952], 4.9, motion="Fade Up", color="muted"),
    T("github.com/aaronamortegui-glitch/Motion_library", "reg", 22, [1300, 930], 5.1, motion="Fade Up", color="muted"),
]})

for s, d in zip(S, DUR):
    s["dur"] = d
(ROOT / "media/explainer/explainer.json").write_text(json.dumps({"fps": 24, "scenes": S}, indent=1, ensure_ascii=False), encoding="utf-8")

edit = {"comp": "EXPLAINER_EDIT", "fps": 24, "size": [1920, 1080], "music": "media/explainer/music_explainer_slow.wav", "musicGainDb": -4, "duckDb": -8,
        "shots": [{"comp": s["comp"], "dur": s["dur"]} for s in S],
        "vo": [{"file": "media/explainer/vo/v_0%d.wav" % (i + 1), "shot": i, "local": LEAD, "gainDb": -2} for i in range(9)],
        "sfx": [{"name": "Swoosh Transition 23", "shot": i, "local": 0.0, "gainDb": -20} for i in range(1, 9)]}
(ROOT / "media/explainer/edit.json").write_text(json.dumps(edit, indent=1, ensure_ascii=False), encoding="utf-8")
print("scenes", len(S), "total", round(sum(DUR), 2))
