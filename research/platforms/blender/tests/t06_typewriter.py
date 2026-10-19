"""Test 6 · Typewriter and Decode (AE: Source Text animators / text presets).

A) Handler: bpy.app.handlers.frame_change_pre sets text.data.body = full[:n(frame)] (align_x LEFT so the text
   does not re-centre as it grows) plus a cursor "|". "Decode": same handler, unrevealed chars replaced by
   seeded random glyphs. Handlers run in bpy.ops.render.render(animation=True) and on frame_set; they are NOT
   stored in the .blend (re-register on load: a text block with use_module = True + trusted auto-run, or the add-on).
B) No handler: one text object per character (see t05) with hide_render keyed CONSTANT per character
   (keyframe_insert("hide_render")) -> persists in the .blend, renders anywhere.
Also renders a clip (PNG sequence -> ffmpeg) to prove the handler fires during animation renders.
Run: blender -b --factory-startup -P research/platforms/blender/tests/t06_typewriter.py
"""
import pathlib
import random
import sys
sys.path.insert(0, str(pathlib.Path(__file__).resolve().parent))
import bpy  # noqa: E402
import common as C  # noqa: E402
from t05_per_char import split_chars  # noqa: E402  (re-runs nothing: t05's demo is guarded below)

sc = C.scene(frames=45)
font = C.bold_font()
FULL = "Typewriter in Blender"
DEC = "DECODE SIGNAL"
tw = C.text("", 0.7, (-4.2, 0, 1.6), (0.75, 0.95, 0.35), font, name="Typewriter"); tw.data.align_x = "LEFT"
dc = C.text("", 0.7, (-4.2, 0, 0.4), (0.85, 0.92, 0.9), font, name="Decode"); dc.data.align_x = "LEFT"
GLYPHS = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789#%&*"


def mdna_text_handler(scene, *_):
    f = scene.frame_current
    n = max(0, min(len(FULL), int((f - 2) / 1.2)))          # 1 char every 1.2 frames from frame 2
    cursor = "|" if (f // 8) % 2 == 0 or n < len(FULL) else ""
    bpy.data.objects["Typewriter"].data.body = FULL[:n] + cursor
    k = max(0, min(len(DEC), int((f - 6) / 2)))              # decode: reveal 1 char every 2 frames
    rnd = random.Random(f)
    scramble = "".join(c if c == " " else rnd.choice(GLYPHS) for c in DEC[k:min(len(DEC), k + 6)])
    bpy.data.objects["Decode"].data.body = DEC[:k] + scramble


bpy.app.handlers.frame_change_pre.clear()
bpy.app.handlers.frame_change_pre.append(mdna_text_handler)

# B) per-character visibility keys (no handler)
chars, _ = split_chars("Keyed visibility, no handler", 0.5, (0, 0, -1.4), (0.25, 0.75, 0.95), font, "V")
for i, o in enumerate(chars):
    o.hide_render = True; o.keyframe_insert("hide_render", frame=0)
    o.hide_render = False; o.keyframe_insert("hide_render", frame=4 + i)
    for fc in C.fcurves(o):
        for kp in fc.keyframe_points:
            kp.interpolation = "CONSTANT"

for f in (10, 20, 34):
    C.render(sc, f, "t06_type")
mp4 = C.render_clip(sc, "t06_type_clip", 0, 44)
print("T06 clip:", mp4, mp4.stat().st_size, "bytes")
print("T06_DONE")
