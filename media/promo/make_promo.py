"""Writes media/promo/promo.json (scenes for tools/build_explainer.jsx) and media/promo/edit.json (tools/build_edit.jsx)
for the promotional cut of the SS Motion explainer: full-screen footage, oversized type, big shape wipes, one
continuous VO read (ElevenLabs Multilingual v2, Chris) and an upbeat pop bed.
Scene cuts come from the VO word times (vo/<take>.words.json, tools/vo_words.py): a scene starts in the pause before
its sentence, so it never changes before the last word. The music is shifted so its drop lands on "So we built".
Type rule: one hero per beat (huge) with a small kicker, never two lines of similar size touching.
Run from the repo root: python media/promo/make_promo.py
"""
import json
import pathlib
import subprocess
import wave

ROOT = pathlib.Path(__file__).resolve().parent.parent.parent
TAKE = "chris_c"
OFF = 0.4                      # VO starts this far into the edit
TAIL = 6.4                     # end card after the last word
DROP = 16.28                   # drop of media/promo/music_promo_pop.mp3 (RMS envelope)
WORDS = json.load(open(ROOT / ("media/promo/vo/%s.words.json" % TAKE), encoding="utf-8"))
if not (ROOT / ("media/promo/vo/%s.wav" % TAKE)).exists():   # the WAV is derived (git-ignored): rebuild it from the MP3
    subprocess.run(["ffmpeg", "-v", "error", "-y", "-i", str(ROOT / ("media/promo/vo/%s.mp3" % TAKE)), "-ar", "48000", "-ac", "2",
                    str(ROOT / ("media/promo/vo/%s.wav" % TAKE))], check=True)
TOK = [x["w"].strip(".,!?").lower().replace("-", "") for x in WORDS]
SPARK, PINE, CLOUD = "spark", "pine", "cloud"


def find(phrase, n=1):
    p = phrase.lower().split()
    k = 0
    for i in range(len(TOK) - len(p) + 1):
        if TOK[i:i + len(p)] == p:
            k += 1
            if k == n:
                return i
    raise KeyError(phrase)


# Breaths: extra silence opened in the VO before a phrase (in the middle of the existing pause), so a shot can stay on
# screen long enough to be seen (the technique montage was cutting every ~1 s). Seconds per phrase.
BREATHS = {"superside timing": 0.8, "68": 0.5, "it lives": 0.9, "drag a": 0.5, "and claude": 0.6, "roto": 0.5, "kinetic": 0.5, "speed ramps": 0.5, "all real": 2.4}
INSERTS = []                                   # (VO time of the insertion, seconds), sorted
for ph, sec in BREATHS.items():
    i = find(ph)
    INSERTS.append(((WORDS[i - 1]["e"] + WORDS[i]["s"]) / 2, sec))
INSERTS.sort()


def shift(t):
    """VO time -> VO time after the breaths are inserted."""
    return t + sum(sec for at, sec in INSERTS if at <= t)


def w(phrase, n=1):
    """Edit time of the n-th occurrence of a phrase (consecutive words) in the VO."""
    return shift(WORDS[find(phrase, n)]["s"]) + OFF


def vo_with_breaths(src, dst):
    a = wave.open(str(src), "rb"); prm = a.getparams(); fr = prm.framerate; data = a.readframes(prm.nframes); a.close()
    bpf = prm.sampwidth * prm.nchannels
    out, last = [], 0
    for at, sec in INSERTS:
        cut = int(at * fr) * bpf
        out += [data[last:cut], bytes(int(sec * fr) * bpf)]
        last = cut
    out.append(data[last:])
    b = wave.open(str(dst), "wb"); b.setparams(prm); b.writeframes(b"".join(out)); b.close()


# scene starts: just before each sentence's first word (0.15 s of air)
STARTS = ["so we built", "68", "one click", "it lives", "drag a", "and claude", "every project", "all real",
          "motion that", "the ss"]
CUTS = [0] + [round(w(p) - 0.15, 3) for p in STARTS]
END = round(shift(WORDS[-1]["e"]) + OFF + TAIL, 3)
CUTS.append(END)


def T(text, font, size, at, t, preset=None, motion=None, color=None, **k):
    e = {"type": "text", "text": text, "font": font, "size": size, "at": at, "t": round(max(0, t), 3)}
    if preset: e["preset"] = preset
    if motion: e["motion"] = motion
    if color: e["color"] = color
    if "until" in k: k["until"] = round(k["until"], 3)
    e.update(k)
    return e


def M(file, t=0, motion="cut", **k):
    e = {"type": "media", "t": round(max(0, t), 3), "motion": motion}
    if file: e["file"] = file
    if "at" not in k: e["full"] = True
    e.update(k)
    return e


def R(at, size, t, fill=PINE, opacity=None, motion="cut", **k):
    e = {"type": "rect", "at": at, "size": size, "t": round(max(0, t), 3), "fill": fill, "motion": motion}
    if opacity is not None: e["opacity"] = opacity
    e.update(k)
    return e


def P(text, at, t, motion="Stretch Slide", size=34, **k):
    e = {"type": "pill", "text": text, "at": at, "t": round(max(0, t), 3), "motion": motion, "size": size}
    e.update(k)
    return e


# Transitions: slower, smoother bars (Surge curve). The closing bars arrive in the pause after the last word; the
# opening bars take longer to leave, so the reveal reads as a move, not a flash.
# Each cut gets a pair: WOUT(c, d) at the end of a scene and WIN(c, d) at the start of the next, with the SAME
# colours and direction, so the bars travel through the cut in one continuous move (accelerate in, decelerate out).
TRANS = [(PINE, SPARK, 1), (SPARK, PINE, -1), (CLOUD, SPARK, -1), (PINE, SPARK, 1), (SPARK, CLOUD, 1), (CLOUD, PINE, -1),
         (PINE, SPARK, 1), (SPARK, PINE, -1), (PINE, CLOUD, 1), (PINE, SPARK, 1)]   # cut i = between scene i and i+1


def WIN(i):
    a, b, d = TRANS[i - 1]
    return {"type": "wipe", "mode": "in", "colors": [a, b], "dir": d, "t": 0, "duration": 0.75, "gap": 0.12, "ease": "Land"}


def WOUT(i):
    a, b, d = TRANS[i]
    return {"type": "wipe", "mode": "out", "colors": [a, b], "dir": d, "duration": 0.5, "gap": 0.1, "ease": "Launch"}


S = []
def scene(i, bg, elements):
    S.append({"comp": "PR_S%02d" % (i + 1), "bg": bg, "dur": round(CUTS[i + 1] - CUTS[i], 3), "elements": elements})


# P01 · Hook: big per-character typography over slow ambient lines; each "Same …" takes the whole frame
s0 = CUTS[0]
s1, s2, s3 = w("same curves") - s0, w("same moves") - s0, w("same template") - s0
scene(0, PINE, [
    {"type": "lines", "count": 8, "color": "spark", "opacity": 18, "t": 0},
    T("Motion made", "bold", 230, [100, 140], w("motion made") - s0, preset="Chars Ramp", until=s1),
    T("with AI", "ital", 250, [96, 380], w("with ai") - s0, preset="Chars Rise", color=SPARK, until=s1),
    T("all looks the same.", "semi", 96, [110, 720], w("all looks") - s0, preset="Words Fade Up", until=s1),
    T("Same curves.", "bold", 250, [110, 390], s1, preset="Chars Rise", until=s2),
    T("Same moves.", "bold", 250, [110, 390], s2, preset="Chars Pop", until=s3),
    T("Same template.", "ital", 250, [100, 380], s3, preset="Chars Ramp", color=SPARK),
    WOUT(0),
])

# P02 · The drop: the tracked Cypher scene (HUD chips, brackets and callouts follow both of them)
s0 = CUTS[1]
scene(1, PINE, [
    WIN(1),
    M(None, comp="CY_WIDE", push=1.06, skip=0.6),
    R([0, 640], [1920, 440], 0, PINE, 50),
    T("So we built", "semi", 70, [96, 680], w("so we built") - s0 - 0.05, preset="Chars Rise", until=w("superside timing") - s0),
    T("Superside timing.", "semi", 70, [96, 680], w("superside timing") - s0, preset="Chars Rise"),
    T("our own.", "ital", 300, [76, 760], w("our own") - s0, color=SPARK, preset="Chars Ramp"),
    WOUT(1),
])

# P03 · Numbers: 68 presets, 5 style packs
s0 = CUTS[2]
packs = ["dynamic", "elegant", "modern", "playful", "tech"]
scene(2, PINE, [
    WIN(2),
    {"type": "lines", "count": 6, "color": "cloud", "opacity": 10, "t": 0},
    T("68", "bold", 420, [110, 200], 0.3, preset="Count Up", color=SPARK),
    T("presets", "ital", 96, [130, 620], w("presets") - s0),
    T("5", "bold", 420, [1040, 200], w("five") - s0, preset="Count Up", color=SPARK),
    T("style packs", "ital", 96, [1060, 620], w("style") - s0),
] + [P(p.capitalize(), [130 + i * 300, 830], w("five") - s0 + 0.2 + i * 0.1, "Bounce In Up", size=40)
     for i, p in enumerate(packs)] + [WOUT(2)])

# P04 · Packs: one click, the whole video changes identity (pack demos in a framed card)
s0 = CUTS[3]
dy, el, pl = w("dynamic") - s0, w("elegant") - s0, w("playful") - s0
CARD = dict(at=[800, 200], size=[1040, 585], radius=28)
scene(3, PINE, [
    WIN(3),
    T("One click.", "bold", 300, [100, 250], w("one click") - s0, preset="Chars Pop", until=dy),
    T("A whole video, one identity.", "ital", 72, [114, 620], w("whole") - s0, preset="Words Fade Up", color=SPARK, until=dy),
    R([790, 190], [1060, 605], dy, "sea", radius=34, motion="Surge Rise"),
    M("library/packs/dynamic.mp4", dy, "Surge Rise", skip=1.4, **CARD),
    T("Dynamic.", "ital", 170, [90, 400], dy, preset="Chars Pop", color=SPARK, until=el),
    M("library/packs/elegant.mp4", el, "Blur In", skip=1.4, **CARD),
    T("Elegant.", "ital", 170, [90, 400], el, preset="Blur Words", until=pl),
    M("library/packs/playful.mp4", pl, "Blur In", skip=1.4, **CARD),
    T("Playful.", "ital", 170, [90, 400], pl, preset="Chars Pop", color=SPARK),
    {"type": "rect", "at": [800, 200], "size": [1040, 585], "t": round(dy, 3), "fill": None, "stroke": "spark", "strokeWidth": 3, "radius": 28, "motion": "Surge Rise"},
    WOUT(3),
])

# P05 · The plugin: live gallery inside After Effects; In / Out / Both
s0 = CUTS[4]
scene(4, PINE, [
    WIN(4),
    {"type": "lines", "count": 7, "color": "spark", "opacity": 14, "t": 0},
    T("Right inside", "semi", 64, [114, 110], w("it lives") - s0, preset="Chars Rise"),
    T("After Effects.", "ital", 190, [100, 190], w("after effects") - s0, color=SPARK, preset="Chars Ramp"),
    M("media/explainer/panel_rec.mp4", w("it lives") - s0 + 0.2, "Ramp Slide", at=[1250, 50], size=[570, 979], radius=28),
    T("Pick a move. Watch it live.", "med", 48, [116, 470], w("pick a") - s0, preset="Words Fade Up"),
    T("In.", "bold", 200, [110, 590], w("in out") - s0, preset="Chars Pop"),
    T("Out.", "bold", 200, [450, 590], w("out or") - s0, preset="Chars Pop"),
    T("Both.", "ital", 240, [110, 800], w("or both") - s0 + 0.15, preset="Chars Ramp", color=SPARK),
    WOUT(4),
])

# P06 · Markers retime the curve
s0 = CUTS[5]
scene(5, CLOUD, [
    WIN(5),
    {"type": "lines", "count": 5, "color": "sea", "opacity": 10, "t": 0},
    T("Drag a marker.", "semi", 72, [114, 110], w("drag a") - s0, preset="Chars Rise", color=PINE),
    T("The curve follows.", "ital", 190, [100, 200], w("the curve") - s0, color=PINE, preset="Chars Ramp"),
    M("media/explainer/ae_markers_timeline.png", 0.3, "Slide Land", at=[60, 600], size=[1800, 270], radius=20),
    {"type": "marker", "label": "SS out", "color": "sea", "from": [1220, 500], "at": [1560, 500], "t": w("marker") - s0, "duration": "Sweep", "ease": "Whip"},
    WOUT(5),
])

# P07 · Claude drives it (MCP)
s0 = CUTS[6]
scene(6, PINE, [
    WIN(6),
    {"type": "lines", "count": 6, "color": "cloud", "opacity": 9, "t": 0},
    T("Claude", "ital", 280, [100, 60], w("claude") - s0, preset="Chars Ramp", color=SPARK),
    T("drives it too.", "semi", 72, [114, 370], w("drive") - s0, preset="Words Fade Up"),
    {"type": "card", "name": "chat", "at": [110, 520], "size": [900, 230], "t": round(w("it reads") - s0 - 0.3, 3), "motion": "Surge Rise", "fill": "sea", "radius": 28, "items": [
        {"text": "Apply the Elegant pack to this comp\rand show me a frame.", "font": "med", "size": 46, "at": [44, 40], "color": "cloud"},
        {"text": "Claude Code  ·  ss-motion MCP", "font": "reg", "size": 26, "at": [44, 170], "color": "muted"}]},
    P("✓  reads the library", [110, 800], w("library") - s0, light=True),
    P("✓  applies a pack", [470, 800], w("applies") - s0, light=True),
    P("✓  checks every frame", [790, 800], w("checks") - s0, light=True, motion="Scale Pop"),
    M("media/explainer/tech_text_behind.png", w("checks") - s0, "Flip In", at=[1150, 90], size=[660, 371], radius=22),
    M("media/explainer/tech_tracking.png", w("frame by") - s0, "Flip In", at=[1210, 360], size=[620, 349], radius=22),
    M("media/explainer/tech_hud.png", w("by frame") - s0 + 0.2, "Flip In", at=[1150, 620], size=[660, 371], radius=22),
    WOUT(6),
])

# P08 · Techniques: the tracked sneakers scene opens, then one shot per technique, each long enough to read
s0 = CUTS[7]
tr_, ro, ki, sp = w("tracking") - s0, w("roto") - s0, w("kinetic") - s0, w("speed ramps") - s0
BAND = dict(fill=PINE, opacity=78)
scene(7, PINE, [
    WIN(7),
    M(None, comp="CY_SNEAKERS", hide=["BRONX"], push=1.08, skip=0.4),
    R([0, 0], [1920, 470], 0, PINE, 45),
    T("Every project leaves", "semi", 70, [100, 110], w("every project") - s0, preset="Chars Rise", until=tr_),
    T("a technique behind.", "ital", 190, [90, 200], w("technique") - s0, color=SPARK, preset="Chars Ramp", until=tr_),
    M("renders/CYPHER_EDIT.mp4", tr_, skip=16.9, push=1.06),
    R([0, 800], [1920, 280], tr_, until=ro, **BAND),
    T("Tracking", "bold", 190, [80, 840], tr_, preset="Chars Rise", color=SPARK, until=ro),
    M("renders/05_Text_Behind_70s.mp4", ro, skip=1.0, push=1.06),
    R([0, 800], [1920, 280], ro, until=ki, **BAND),
    T("Roto", "bold", 190, [80, 840], ro, preset="Chars Rise", color=SPARK, until=ki),
    # kinetic type is shown by the label itself: big words animated per character on Pine
    R([0, 0], [1920, 1080], ki, PINE, until=sp),
    {"type": "lines", "count": 6, "color": "spark", "opacity": 14, "t": round(ki, 3)},
    T("Kinetic", "bold", 330, [100, 230], ki, preset="Chars Pop", until=sp),
    T("type.", "ital", 330, [600, 560], ki + 0.3, preset="Chars Ramp", color=SPARK, until=sp),
    M("media/cypher/clip03_aaron_sd.mp4", sp, "Speed Ramp"),
    R([0, 800], [1920, 280], sp, **BAND),
    T("Speed ramps", "bold", 190, [80, 840], sp, preset="Chars Rise", color=SPARK),
    WOUT(7),
])

# P09 · Real keyframes, the designer keeps the final touch
s0 = CUTS[8]
scene(8, CLOUD, [
    WIN(8),
    M("media/explainer/ae_markers_full.png", 0, "Blur In", at=[700, 120], size=[1300, 817], radius=24, push=1.06),
    R([0, 0], [820, 1080], 0, PINE, motion="Ramp Slide"),
    T("All real", "semi", 72, [84, 290], w("all real") - s0, preset="Chars Rise", color=CLOUD),
    T("keyframes.", "ital", 180, [70, 380], w("real") - s0 + 0.25, color=SPARK, preset="Chars Ramp"),
    T("Designers keep\rthe final touch.", "med", 56, [84, 700], w("designers") - s0, preset="Words Fade Up", color=CLOUD),
    WOUT(8),
])

# P10 · Motion that looks like Superside. Not like AI.
s0 = CUTS[9]
nt = w("not like") - s0
scene(9, PINE, [
    WIN(9),
    M("media/whisky/clip01.mp4", push=1.1),
    R([0, 610], [1920, 470], 0, PINE, 55),
    T("Motion that looks like", "semi", 66, [100, 650], w("motion that") - s0, preset="Chars Rise", until=nt),
    T("Superside.", "ital", 300, [80, 730], w("looks like") - s0 + 0.5, color=SPARK, preset="Chars Ramp", until=nt),
    R([0, 0], [1920, 1080], nt - 0.04, PINE),
    {"type": "lines", "count": 7, "color": "spark", "opacity": 14, "t": round(nt, 3)},
    T("Not like AI.", "bold", 320, [110, 360], nt, preset="Chars Pop"),
    WOUT(9),
])

# P11 · End card over a clean plate (no titles in the footage under the type)
s0 = CUTS[10]
scene(10, PINE, [
    WIN(10),
    M("media/whisky/clip04.mp4", push=1.08),
    R([0, 0], [1920, 1080], 0, PINE, 80),
    {"type": "lines", "count": 6, "color": "spark", "opacity": 12, "t": 0.3},
    T("SS Motion", "ital", 320, [110, 170], w("the ss") - s0 + 0.15, color=SPARK, preset="Chars Ramp"),
    T("Library", "bold", 170, [124, 500], w("library", 2) - s0, preset="Chars Rise"),
    P("68 presets  ·  5 style packs  ·  plugin  ·  MCP", [130, 760], 1.8, size=36),
])

spec = {"fps": 24, "prefix": "PR_", "folder": "PROMO", "scenes": S}
json.dump(spec, open(ROOT / "media/promo/promo.json", "w", encoding="utf-8"), indent=1, ensure_ascii=False)

# SFX (edit time), levels set against the music: a whoosh through every cut, swooshes on hero words, pops on pills,
# a low hit on "Not like AI." (the first cut had them at -14/-19 dB under a loud bed: inaudible)
SFX = []
for i in range(1, len(S)):
    SFX.append({"name": "Swoosh Transition 28", "t": round(CUTS[i] - 0.45, 3), "gainDb": -3})
for i, sc in enumerate(S):
    t0 = CUTS[i]
    for e in sc["elements"]:
        if e["type"] == "text" and e.get("size", 0) >= 170 and e["t"] > 0.2:
            SFX.append({"name": "Swoosh Plastic Big 03", "t": round(t0 + e["t"] - 0.03, 3), "gainDb": -8})
        if e["type"] == "pill":
            SFX.append({"name": "Pop Mouth 01_Variant Plus 3", "t": round(t0 + e["t"], 3), "gainDb": -9})
SFX.append({"name": "Clean Bass Bend 05", "t": round(w("not like") - 0.05, 3), "gainDb": -5, "len": 1.4})

# versioned name: AE keeps the previous file open
import hashlib
VO = "media/promo/vo/%s_b%s.wav" % (TAKE, hashlib.md5(json.dumps(sorted(BREATHS.items())).encode()).hexdigest()[:6])
if not (ROOT / VO).exists():   # same breaths = same file (AE keeps it open)
    vo_with_breaths(ROOT / ("media/promo/vo/%s.wav" % TAKE), ROOT / VO)

# music: shift the track so its drop lands on "So we built", fade out on the end card
mshift = DROP - w("so we built")
subprocess.run(["ffmpeg", "-v", "error", "-y", "-ss", "%.3f" % mshift, "-i", str(ROOT / "media/promo/music_promo_pop.mp3"),
                "-t", "%.3f" % (END + 2), "-af", "afade=t=in:d=0.25,afade=t=out:st=%.3f:d=2.5" % (END - 2.6),
                "-ar", "48000", "-ac", "2", str(ROOT / "media/promo/music_promo_cut.wav")], check=True)

edit = {"comp": "PROMO_EDIT", "fps": 24, "size": [1920, 1080],
        "music": "media/promo/music_promo_cut.wav", "musicGainDb": -6, "duckDb": -8,
        "shots": [{"comp": s["comp"], "dur": s["dur"]} for s in S],
        "vo": [{"file": VO, "shot": 0, "local": OFF, "gainDb": 6}],
        "sfx": SFX}
json.dump(edit, open(ROOT / "media/promo/edit.json", "w", encoding="utf-8"), indent=1)
print("scenes:", ", ".join("%s %.2fs" % (s["comp"], s["dur"]) for s in S), "· total %.2fs" % END)
