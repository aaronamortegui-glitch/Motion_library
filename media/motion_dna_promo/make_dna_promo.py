"""Writes the After Effects specs for the Motion DNA promo (1985 infomercial parody, ~43 s):
  media/motion_dna_promo/scenes_fx.json -> tools/build_scene.jsx (DNAFX_P01…: live plates with the library's techniques)
  media/motion_dna_promo/scenes.json    -> tools/build_explainer.jsx (DNA_S01…: shots + graphics, folder "DNA PROMO")
  media/motion_dna_promo/edit.json      -> tools/build_edit.jsx (DNA_EDIT: shots, Rex freeze title, dialogue, music, SFX)
Live action: two Seedance 2.5 clips cut into 1080p plates (shots/pNN.mp4, one frame before each camera cut, so no frame
of the next shot leaks in). Techniques per plate, all from the library:
  p01 2D tracked callouts on Dana and Marcus (tools/track_points.py) + "1985" planar-tracked onto the back wall
      (tools/planar_track.py, perspective corner pin)
  p03 tracked bracket on Dana's CRT
  p04 Rex walks in: god rays from behind him (roto: tools/video_matte.py, head track: tools/matte_points.py) + a glowing
      contour halo (tools/matte_contours.py) + a synthesized choir on "no longer a problem"
  p05 tracked bracket on the box
  p06 the cheer: "YES!" behind the people (roto), contour strokes on both, action-line bursts from the raised box (tracked
      backwards from the last frame, where the box is sharp)
  p07 tracked callout on the floppy label
Graphics are timed to the dialogue word times (video/part*.words.json, tools/vo_words.py); dialogue is cut per shot from
the clips' audio. Text rule: nothing smaller than 36 px on screen, and every line holds long enough to read.
Run from the repo root: python media/motion_dna_promo/make_dna_promo.py, then bash tools/bridge.sh tools/build_dna_promo.jsx 900
"""
import json
import pathlib
import subprocess

ROOT = pathlib.Path(__file__).resolve().parent.parent.parent
D = "media/motion_dna_promo"
SH = D + "/shots"
P1, P2 = D + "/video/part1.mp4", D + "/video/part2.mp4"
AUD = "v4"                                # audio cut version: AE locks imported files, so a new cut gets a new name
W1 = {w["w"].strip(".,!?").lower(): w for w in json.load(open(ROOT / D / "video/part1.words.json", encoding="utf-8"))}
W2 = json.load(open(ROOT / D / "video/part2.words.json", encoding="utf-8"))
CRT = [0.45, 0.95, 0.55]                  # phosphor green
WARM = [1.0, 0.93, 0.72]                  # holy light
FPS = 24

# plates: (source, start s, frames) — cut with ffmpeg to shots/pNN.mp4 at 1920x1080 / 24 fps (see story.md)
PLATES = {"p01": (P1, 0.0, 72), "p03": (P1, 3.663, 137), "p04": (P1, 9.417, 89),
          "p05": (P2, 0.0, 171), "p06": (P2, 7.617, 52), "p07": (P2, 9.833, 67)}
FREEZE = round(W1["problem"]["e"] - PLATES["p04"][1] + 0.1, 2)   # Rex, arms wide, right after "problem!"


def w2(word):
    return next(w for w in W2 if w["w"].strip(".,!?").lower() == word)["s"]


def local(word, plate):   # a part-1 word's time inside a plate
    return round(W1[word]["s"] - PLATES[plate][1], 2)


TAIL = 0.35   # rule: dialogue audio runs this far past its shot's cut and fades, so no phrase or breath is cut dead


def cut_audio(plate, name):
    src, a, n = PLATES[plate]
    n = n + TAIL * FPS
    name = f"{name}_{AUD}"
    out = ROOT / D / "audio" / (name + ".wav")
    out.parent.mkdir(exist_ok=True)
    if not out.exists():
        subprocess.run(["ffmpeg", "-v", "error", "-y", "-ss", str(a), "-t", str(n / FPS), "-i", str(ROOT / src), "-vn", "-ar", "48000",
                        "-ac", "2", "-af", f"afade=t=in:d=0.02,areverse,afade=t=in:d={TAIL},areverse", str(out)], check=True)
    return f"{D}/audio/{name}.wav"


def plate_scene(p, hud, matte=False):
    s = {"comp": "DNAFX_" + p.upper(), "plate": f"{SH}/{p}.mp4", "tracks": f"{SH}/{p}_tracks.json", "grain": False, "hud": hud}
    if (ROOT / SH / f"{p}_faces.json").exists():
        s["faces"] = f"{SH}/{p}_faces.json"   # tools/face_boxes.py: check_layout.jsx flags graphics on faces
    if matte:
        s["matte"] = f"{SH}/{p}_matte.mov"
    return s


def footage(p, comp, extra=()):
    return {"comp": comp, "bg": "pine", "dur": PLATES[p][2] / FPS,
            "elements": [{"type": "media", "full": True, "comp": "DNAFX_" + p.upper(), "motion": "cut"}] + list(extra)}


# ---- 1) techniques on the live plates (build_scene.jsx) ----
fx = [
    plate_scene("p01", [
        {"type": "planar", "file": f"{SH}/p01_planar.json", "quad": "wall", "text": "1985", "role": "InterTight-Bold", "size": 150,
         "color": "cloud", "opacity": 80, "t0": 0.1, "preset": "Chars Rise"},
        {"type": "callout", "anchor": "TRK dana_body", "offset": [150, -200], "title": "DANA", "lines": ["Designer", "Bored since 9:00"],
         "titleSize": 44, "bodySize": 34, "t0": 0.3, "card": True},
        {"type": "callout", "anchor": "TRK marcus_body", "offset": [-250, -150], "title": "MARCUS", "lines": ["Motion designer", "Asleep"],
         "titleSize": 44, "bodySize": 34, "t0": 0.7, "card": True}]),
    plate_scene("p03", [
        {"type": "bracket", "anchor": "TRK crt", "size": [270, 230], "label": ["SAME FADE", "SAME EASE", "AGAIN"], "labelSize": 34,
         "labelTracking": 60, "labelLift": 170, "card": True, "t0": 0.6, "t1": 2.9}]),
    plate_scene("p04", [
        {"type": "glow", "anchor": "TRK body", "t0": round(W1["that's"]["s"] - PLATES["p04"][1], 2), "size": [620, 980],
         "offset": [0, -60], "color": WARM, "opacity": 75}], matte=True),
    plate_scene("p05", [
        {"type": "bracket", "anchor": "TRK box", "size": [300, 340], "label": ["v1.0", "FREE", "OPEN SOURCE"], "labelSize": 34,
         "labelSide": "bottom", "labelAlign": "right", "labelTracking": 60, "card": True, "t0": 4.4}]),
    plate_scene("p06", [
        {"type": "behind", "text": "YES!", "role": "InterTight-Bold", "size": 420, "color": "spark", "at": [960, 450], "t0": 0.1,
         "preset": "Chars Pop", "opacity": 100},
        {"type": "contour", "file": f"{SH}/p06_contours.json", "key": "c0", "t0": 0.15, "width": 7},
        {"type": "contour", "file": f"{SH}/p06_contours.json", "key": "c1", "t0": 0.25, "width": 7},
        {"type": "burst", "anchor": "TRK box", "t0": 0.5, "repeat": 3, "every": 0.4, "count": 16, "r0": 110, "r1": 520, "width": 16}], matte=True),
    plate_scene("p07", [
        {"type": "callout", "anchor": "TRK label", "offset": [-150, -260], "title": "MOTION_DNA.DSK", "lines": ["Moves · curves · styles"],
         "titleSize": 42, "bodySize": 34, "wrap": 24, "card": True, "instant": True, "t0": 0.0, "t1": 2.3}]),
]
json.dump({"folder": "DNA PROMO", "scenes": fx}, open(ROOT / D / "scenes_fx.json", "w", encoding="utf-8"), indent=1)

# ---- 2) shots and graphics (build_explainer.jsx) ----
DINO = ["..........XXXXXX", ".........XX.XXXXX", ".........XXXXXXXX", ".........XXXXX...", ".........XXXXXXX.",
        "X.......XXXXX....", "X......XXXXXX....", "XX...XXXXXXXXX...", "XXXXXXXXXXXX.X...", ".XXXXXXXXXX......",
        "..XXXXXXXX.......", "...XXX.XX........", "...X....X........", "...XX...XX......."]   # our own pixel dino
CACTUS = ["..XX..", "..XX.X", "X.XX.X", "X.XXXX", "XXXX..", "..XX..", "..XX..", "..XX.."]
SCREEN = [[462, 290], [712, 292], [462, 552], [710, 577]]   # CRT glass in ae/desk_crt.png (UL, UR, LL, LR)
CLOSE = [[592, 307], [1222, 315], [600, 997], [1218, 1027]]  # CRT glass in ae/crt_close.png (location sheet crop)
LOGO = "assets/brand/motion_dna_mark_1024.png"               # tools/trace_mark.py, from the box art
EST = local("every", "p03")

UI = {"comp": "DNA_UIFLAT", "bg": "pine", "dur": 3.0, "elements": [   # designed in x 460..1460 (the 1000 px the screen shows)
    {"type": "rect", "size": [1000, 1080], "at": [460, 0], "fill": [0.02, 0.09, 0.05], "motion": "cut"},
    {"type": "rect", "size": [1000, 96], "at": [460, 0], "fill": CRT, "opacity": 22, "motion": "cut"},
    {"type": "text", "text": "MOTION/85", "font": "semi", "size": 54, "color": CRT, "at": [490, 22], "motion": "cut"},
    {"type": "text", "text": "File  Edit  Animate", "font": "reg", "size": 40, "color": CRT, "at": [860, 30], "motion": "cut"},
    {"type": "rect", "size": [940, 470], "at": [490, 120], "fill": [0.03, 0.15, 0.08], "motion": "cut"},
    {"type": "text", "text": "No creativity detected.", "font": "semi", "size": 44, "color": CRT, "at": [520, 140], "motion": "cut"},
    {"type": "text", "text": "Your new title", "font": "reg", "size": 60, "color": CRT, "at": [880, 250], "t": 0.3, "motion": "Fade"},
    {"type": "rect", "size": [880, 5], "at": [520, 540], "fill": CRT, "motion": "cut"},
    {"type": "pixels", "name": "dino", "rows": DINO, "cell": 9, "at": [580, 414], "color": CRT, "jump": {"every": 1.3, "height": 140, "offset": 0.9}},
    {"type": "pixels", "name": "cactus", "rows": CACTUS, "cell": 9, "at": [1300, 468], "color": CRT, "scroll": {"speed": 420, "span": 760}},
    {"type": "rect", "size": [940, 430], "at": [490, 620], "fill": [0.03, 0.12, 0.07], "motion": "cut"},
    {"type": "text", "text": "Title", "font": "med", "size": 46, "color": CRT, "at": [510, 650], "motion": "cut"},
    {"type": "text", "text": "Dino", "font": "med", "size": 46, "color": CRT, "at": [510, 745], "motion": "cut"},
    {"type": "text", "text": "Cactus", "font": "med", "size": 46, "color": CRT, "at": [510, 840], "motion": "cut"},
    {"type": "pixels", "name": "keys title", "rows": ["X...........X"], "cell": 20, "at": [860, 655], "color": CRT},
    {"type": "pixels", "name": "keys dino", "rows": ["X...........X"], "cell": 20, "at": [860, 750], "color": CRT},
    {"type": "pixels", "name": "keys cactus", "rows": ["X...........X"], "cell": 20, "at": [860, 845], "color": CRT},
    {"type": "pixels", "name": "playhead", "rows": ["X"] * 14, "cell": 6, "at": [850, 630], "color": CRT, "scroll": {"speed": -260, "span": 420}},
    {"type": "text", "text": "Ease: Linear   Preset: Fade", "font": "reg", "size": 42, "color": CRT, "at": [510, 950], "motion": "cut"},
    {"type": "lines", "count": 30, "color": CRT, "opacity": 8, "width": 1}]}

scenes = [
    footage("p01", "DNA_S01"),
    {"comp": "DNA_S02", "bg": "pine", "dur": 3.0,          # the problem, on an old monitor: a retro animation app with one preset
     "push": {"to": [905, 660], "scale": 1.08, "t": 0, "dur": 3.0, "ease": "Cruise"},
     "elements": [
        {"type": "media", "full": True, "file": D + "/ae/crt_close_clean.png", "motion": "cut"},
        {"type": "screen", "comp": "DNA_UIFLAT", "corners": CLOSE, "size": [1000, 1080], "opacity": 100, "motion": "cut",
         "bulge": 38, "blend": "add", "glow": 22}]},
    footage("p03", "DNA_S03", [   # each word lands on Dana's voice
        {"type": "text", "text": "EVERY.", "font": "bold", "size": 210, "color": "spark", "at": [70, 250], "t": EST, "motion": "Snap Scale", "shadow": True},
        {"type": "text", "text": "SINGLE.", "font": "bold", "size": 210, "color": "spark", "at": [70, 480], "t": local("single", "p03"), "motion": "Snap Scale", "shadow": True},
        {"type": "text", "text": "TIME.", "font": "bold", "size": 210, "color": "spark", "at": [70, 710], "t": local("time", "p03"), "motion": "Snap Scale", "shadow": True}]),
    footage("p04", "DNA_S04"),
    footage("p05", "DNA_S05", [
        {"type": "rect", "size": [760, 1080], "at": [0, 0], "fill": "pine", "opacity": 82, "t": 0.0, "motion": "Wipe Reveal"},
        {"type": "text", "text": "Motion DNA", "font": "bold", "size": 110, "color": "cloud", "at": [80, 150], "t": round(w2("motion"), 2), "preset": "Chars Ramp"},
        {"type": "text", "text": "Techniques", "font": "bold", "size": 92, "color": "spark", "at": [80, 340], "t": round(w2("techniques"), 2), "preset": "Chars Pop"},
        {"type": "text", "text": "Curves", "font": "bold", "size": 92, "color": "spark", "at": [80, 460], "t": round(w2("curves"), 2), "preset": "Chars Pop"},
        {"type": "text", "text": "Styles", "font": "bold", "size": 92, "color": "spark", "at": [80, 580], "t": round(w2("styles"), 2), "preset": "Chars Pop"},
        {"type": "text", "text": "so your AI animates", "font": "ital", "size": 66, "color": "cloud", "at": [80, 760], "t": round(w2("so"), 2), "preset": "Words Fade Up"},
        {"type": "pill", "text": "IN YOUR BRAND'S STYLE", "size": 40, "at": [80, 860], "t": round(w2("brand"), 2), "motion": "Scale Pop", "fill": "spark", "light": True}]),
    footage("p06", "DNA_S06"),
    footage("p07", "DNA_S07", [
        {"type": "rect", "size": [1920, 170], "at": [0, 910], "fill": "pine", "opacity": 88, "t": 1.2, "motion": "Fade"},
        {"type": "text", "text": "INSTALLING MOTION DNA", "font": "semi", "size": 56, "color": "spark", "at": [96, 960], "t": 1.25, "preset": "Typewriter"},
        {"type": "rect", "size": [640, 16], "at": [1184, 990], "fill": "spark", "t": 1.4, "motion": "Wipe Reveal"}]),
    {"comp": "DNA_S07B", "bg": "pine", "dur": 2.6,          # the library lands on Dana's CRT, then the camera pushes into it
     "push": {"to": [587, 433], "scale": 7.6, "t": 1.0, "dur": 1.6, "ease": "Launch"},
     "elements": [
        {"type": "media", "full": True, "file": D + "/ae/desk_crt.png", "motion": "cut"},
        {"type": "screen", "file": "docs/examples/library-mosaic.mp4", "corners": SCREEN, "size": [1440, 1080], "opacity": 94, "t": 0.15, "motion": "Fade"}]},
    {"comp": "DNA_S08", "bg": "pine", "dur": 4.6, "elements": [   # the real library, full screen (match cut from the CRT)
        {"type": "lines", "count": 7, "color": "spark", "opacity": 14},
        {"type": "rect", "size": [1316, 747], "at": [88, 282], "radius": 28, "fill": "sea", "motion": "cut"},
        {"type": "media", "file": "docs/examples/library-mosaic.mp4", "at": [96, 290], "size": [1300, 731], "radius": 22, "motion": "cut", "until": 2.4},
        {"type": "media", "file": "docs/examples/test-styles.mp4", "at": [96, 290], "size": [1300, 731], "radius": 22, "t": 2.4, "motion": "Slide Land"},
        {"type": "text", "text": "Moves, curves and styles,", "font": "bold", "size": 84, "at": [96, 64], "t": 0.0, "preset": "Chars Ramp"},
        {"type": "text", "text": "tagged so the AI picks the right one.", "font": "ital", "size": 68, "color": "spark", "at": [96, 184], "t": 0.3, "preset": "Words Fade Up"},
        {"type": "pill", "text": "60+ MOVES", "size": 40, "at": [1440, 300], "t": 0.4, "motion": "Fade Up"},
        {"type": "pill", "text": "ENERGY 1-5", "size": 40, "at": [1440, 400], "t": 0.6, "motion": "Fade Up"},
        {"type": "pill", "text": "6 STYLES", "size": 40, "at": [1440, 500], "t": 2.5, "motion": "Fade Up"},
        {"type": "pill", "text": "2x2 PREVIEWS", "size": 40, "at": [1440, 600], "t": 2.7, "motion": "Fade Up"},
        {"type": "wipe", "mode": "out", "colors": ["spark", "pine"], "dir": 1, "duration": 0.4, "gap": 0.07, "ease": "Launch"}]},
    {"comp": "DNA_S09", "bg": "pine", "dur": 5.0, "elements": [   # the bridge
        {"type": "wipe", "mode": "in", "colors": ["spark", "pine"], "dir": 1, "duration": 0.35, "gap": 0.07, "ease": "Land"},
        {"type": "text", "text": "A bridge between AI", "font": "bold", "size": 96, "at": [96, 110], "t": 0.1, "preset": "Chars Ramp"},
        {"type": "text", "text": "and After Effects.", "font": "ital", "size": 104, "color": "spark", "at": [96, 238], "t": 0.3, "preset": "Words Fade Up"},
        {"type": "pill", "text": "Claude", "size": 52, "at": [96, 500], "t": 0.5, "motion": "Scale Pop"},
        {"type": "rect", "size": [140, 6], "at": [340, 540], "fill": "spark", "t": 0.65, "motion": "Wipe Reveal"},
        {"type": "pill", "text": "Motion DNA", "size": 52, "at": [500, 500], "t": 0.8, "motion": "Scale Pop", "fill": "spark", "light": True},
        {"type": "rect", "size": [140, 6], "at": [890, 540], "fill": "spark", "t": 0.95, "motion": "Wipe Reveal"},
        {"type": "pill", "text": "After Effects", "size": 52, "at": [1050, 500], "t": 1.1, "motion": "Scale Pop"},
        {"type": "text", "text": "Claude reads the tags, picks moves, curves and styles,\nand animates your layers in After Effects.", "font": "reg",
         "size": 50, "color": "cloud", "at": [96, 700], "t": 1.4, "preset": "Words Fade Up", "bold": ["tags", "After Effects"]},
        {"type": "media", "file": D + "/ae/panel.mp4", "at": [1520, 260], "size": [300, 514], "radius": 14, "t": 1.2, "motion": "Slide Land"},
        {"type": "pill", "text": "CLAUDE CONNECTED", "size": 30, "at": [1500, 800], "t": 1.7, "motion": "Fade Up"},
        {"type": "wipe", "mode": "out", "colors": ["spark", "pine"], "dir": -1, "duration": 0.4, "gap": 0.07, "ease": "Launch"}]},
    {"comp": "DNA_S10", "bg": "pine", "dur": 3.6, "elements": [   # end card: the mark from the box + the wordmark
        {"type": "lines", "count": 6, "color": "spark", "opacity": 16},
        {"type": "wipe", "mode": "in", "colors": ["spark", "pine"], "dir": -1, "duration": 0.35, "gap": 0.07, "ease": "Land"},
        {"type": "media", "file": LOGO, "at": [150, 300], "size": [282, 306], "t": 0.0, "motion": "Snap Scale"},
        {"type": "text", "text": "Motion DNA", "font": "bold", "size": 200, "at": [480, 330], "t": 0.35, "motion": "Wordmark Reveal"},
        {"type": "text", "text": "Your motion, with its own DNA.", "font": "ital", "size": 80, "color": "spark", "at": [490, 560], "t": 0.45, "preset": "Words Fade Up"},
        {"type": "pill", "text": "AFTER EFFECTS + AI BRIDGE · OPEN SOURCE", "size": 36, "at": [490, 700], "t": 0.75, "motion": "Fade Up"}]},
]
# ---- music-led timing (Motion Style Map, research/styles/_music_and_edit.md): place key moments on musical events.
# The bridge (S09) starts on a beat and the end card's mark lands on a downbeat; S08/S09 absorb the difference.
BEATS = json.load(open(ROOT / D / "audio/music_beats.json", encoding="utf-8"))["beats"]
DROP, FREEZE_DUR = 16.28, 1.8
t_drop = sum(sc["dur"] for sc in scenes[:3]) + FREEZE   # the drop lands on Rex's freeze
edit_beats = [b - DROP + t_drop for b in BEATS]
k0 = min(range(len(BEATS)), key=lambda k: abs(BEATS[k] - DROP))           # the drop's beat = bar start
downbeats = [edit_beats[k] for k in range(len(BEATS)) if (k - k0) % 4 == 0]


def start_of(name):
    t = 0
    for sc in scenes:
        if sc["comp"] == name:
            return t
        t += sc["dur"] + (FREEZE_DUR if sc["comp"] == "DNA_S04" else 0)


def snap(name, grid, prev, lo, hi):   # move scene `name` to the next grid time by stretching scene `prev` within [lo, hi]
    st = start_of(name); sp = next(sc for sc in scenes if sc["comp"] == prev)
    for g in grid:
        nd = sp["dur"] + (g - st)
        if g >= st - 0.25 and lo <= nd <= hi:
            sp["dur"] = round(round(nd * FPS) / FPS, 4)
            return g
    return st


b9 = snap("DNA_S09", edit_beats, "DNA_S08", 4.2, 5.2)
b10 = snap("DNA_S10", downbeats, "DNA_S09", 4.6, 6.4)
print(f"music: S09 on beat {b9:.2f}s, end card (mark lands) on downbeat {b10:.2f}s")

json.dump({"fps": FPS, "prefix": "DNA_", "folder": "DNA PROMO", "scenes": [UI] + scenes}, open(ROOT / D / "scenes.json", "w", encoding="utf-8"), indent=1)

# rule check: no cut inside a spoken word (the audio tail covers breaths; a cut word means re-cut the plate)
for nm, words in (("part1", json.load(open(ROOT / D / "video/part1.words.json", encoding="utf-8"))), ("part2", W2)):
    for p, (src, a, n) in PLATES.items():
        if not src.endswith(nm + ".mp4"):
            continue
        end = a + n / FPS
        for w in words:
            if w["s"] < end < w["e"] - 0.05:
                print(f"  !! {p} cuts the word '{w['w']}' ({w['s']:.2f}-{w['e']:.2f}) at {end:.2f}")

# ---- 3) edit: dialogue per shot, music, SFX (build_edit.jsx) ----
vo = [{"file": cut_audio("p01", "a01"), "shot": 0, "local": 0, "gainDb": 0},
      {"file": cut_audio("p03", "a03"), "shot": 2, "local": 0, "gainDb": 0},
      {"file": cut_audio("p04", "a04"), "shot": 3, "local": 0, "gainDb": 0},
      {"file": f"{D}/audio/holy.wav", "shot": 3, "local": round(W1["that's"]["s"] - PLATES["p04"][1], 2), "gainDb": -3},   # synthesized choir
      {"file": cut_audio("p05", "a05"), "shot": 4, "local": 0, "gainDb": 0},
      {"file": cut_audio("p06", "a06"), "shot": 5, "local": 0, "gainDb": 0},
      {"file": cut_audio("p07", "a07"), "shot": 6, "local": 0, "gainDb": 0}]
shots = [{"comp": s["comp"], "dur": s["dur"]} for s in scenes]
# Rex's freeze: he stays in colour (matte cut-out of the clean plate), the office goes black and white, and his name
# flanks him in two typefaces (Rex spans x 484-1404 at the freeze, so the words sit in the free space either side)
shots[3]["matte"], shots[3]["plate"] = f"{SH}/p04_matte.mov", f"{SH}/p04.mp4"
shots[3]["freeze"] = {"at": FREEZE, "dur": FREEZE_DUR, "title": "Rex Valance.", "titleAt": 0.12, "mono": True,
                      "split": [{"text": "Rex", "font": "InterTight-Bold", "size": 250, "color": "spark", "at": [600, 560], "rot": -6},
                                {"text": "Valance.", "font": "InstrumentSerif-Italic", "size": 170, "color": "cloud", "at": [1420, 650], "rot": 3}],
                      "sub": {"text": "MOTION SALESMAN · SINCE 1985", "size": 40, "at": [960, 1010]}}

# music: silent until Rex arrives, drop on his freeze (media/promo/music_promo_pop.mp3, drop at 16.28 s)
DROP = 16.28
t_freeze = sum(s["dur"] for s in scenes[:3]) + FREEZE
lead = 1.2
music = ROOT / D / f"audio/music_{AUD}.wav"
if not music.exists():
    subprocess.run(["ffmpeg", "-v", "error", "-y", "-ss", str(DROP - lead), "-i", str(ROOT / "media/promo/music_promo_pop.mp3"), "-af",
                    f"afade=t=in:d=0.6,adelay={int((t_freeze - lead) * 1000)}|{int((t_freeze - lead) * 1000)}", "-ar", "48000", "-ac", "2",
                    str(music)], check=True)

sfx = [{"name": "Pop Plastic Micro 02", "shot": 0, "local": 0.3, "gainDb": -10},                # Dana's label
       {"name": "Pop Plastic Micro 04", "shot": 0, "local": 0.7, "gainDb": -10},                # Marcus's label
       {"name": "Swoosh Wood 01_Variant Main", "shot": 1, "local": 0.0, "gainDb": -8},          # cut to the CRT
       {"name": "Blip 01_Variant Minus 24", "shot": 1, "local": 0.9, "gainDb": -12},            # dino hops
       {"name": "Blip 01_Variant Minus 24", "shot": 1, "local": 2.2, "gainDb": -12},
       {"name": "Slide Box Low Short 02", "shot": 2, "local": EST, "gainDb": -4},               # EVERY. SINGLE. TIME.
       {"name": "Slide Box Low Short 03", "shot": 2, "local": local("single", "p03"), "gainDb": -4},
       {"name": "Slide Box Low Short 02", "shot": 2, "local": local("time", "p03"), "gainDb": -3},
       {"name": "Bass Drop 02", "shot": 3, "local": 0.05, "gainDb": -4},                        # the door bangs open
       {"name": "Pop Plastic Micro 03", "shot": 4, "local": round(w2("techniques"), 2), "gainDb": -6},
       {"name": "Pop Plastic Micro 05", "shot": 4, "local": round(w2("curves"), 2), "gainDb": -6},
       {"name": "Pop Plastic Micro 07", "shot": 4, "local": round(w2("styles"), 2), "gainDb": -6},
       {"name": "Fireworks Reverb 03", "shot": 5, "local": 0.1, "gainDb": -10},
       {"name": "Glitter 04_Variant Plus 6", "shot": 5, "local": 0.5, "gainDb": -8},              # bursts from the box
       {"name": "Mouse Click 01 A", "shot": 6, "local": 0.9, "gainDb": -4},
       {"name": "Blip 01_Variant Minus 15", "shot": 6, "local": 1.3, "gainDb": -8},
       {"name": "Digital Rattle 03", "shot": 7, "local": 0.1, "gainDb": -12},                   # the CRT wakes up
       {"name": "Bass Approach 01", "shot": 7, "local": 1.0, "gainDb": -8},                     # push into the screen
       {"name": "Swoosh Wood 01_Variant Plus 6", "shot": 8, "local": 2.4, "gainDb": -9},
       {"name": "Swoosh Wood 01_Variant Minus 6", "shot": 9, "local": 0.0, "gainDb": -6},
       {"name": "Glitter 04_Variant Main", "shot": 10, "local": 0.1, "gainDb": -9}]

json.dump({"comp": "DNA_EDIT", "fps": FPS, "size": [1920, 1080], "music": f"{D}/audio/music_{AUD}.wav", "musicGainDb": -8, "duckDb": -8,
           "shots": shots, "vo": vo, "sfx": sfx},
          open(ROOT / D / "edit.json", "w", encoding="utf-8"), indent=1)
total = sum(s["dur"] for s in scenes) + 1.8
print(f"plates {len(fx)} · scenes {len(scenes)} · freeze at {FREEZE}s in S04 · music in at {t_freeze - lead:.2f}s · total ≈ {total:.1f}s")
