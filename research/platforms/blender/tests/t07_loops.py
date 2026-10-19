"""Test 7 · FX loops (AE: Float, Pulse, Wiggle, Spin... expression loops).

F-curve modifiers, keyed on the object so they render anywhere and persist in the .blend:
  Float:  location Z keyed rest -> rest + a (Cruise) -> rest (Cruise), then fcurve.modifiers.new("CYCLES")
          = a seamless token-curve loop (period = keyed span).
  Pulse:  scale X/Y keyed 1 -> 1.08 (Pop) -> 1 (Settle) + CYCLES.
  Wiggle: location X/Z with one key + modifiers.new("NOISE") (scale = period in frames, strength = amplitude,
          phase = seed per channel); AE wiggle(freq, amp) ~ scale = fps / freq, strength = 2 * amp.
  Spin:   rotation keyed 0 -> 360 deg linear + CYCLES with cycles_after mode "REPEAT_OFFSET".
  Sine:   FNGENERATOR (function_type "SIN") as an alternative to keys.
Run: blender -b --factory-startup -P research/platforms/blender/tests/t07_loops.py
"""
import math
import pathlib
import sys
sys.path.insert(0, str(pathlib.Path(__file__).resolve().parent))
import bpy  # noqa: E402
import common as C  # noqa: E402

sc = C.scene(frames=90)
fl = C.plane("Float", 1.2, 1.2, (-3.6, 0, 0), (0.75, 0.95, 0.35))
pu = C.plane("Pulse", 1.2, 1.2, (-1.2, 0, 0), (0.85, 0.45, 0.25))
wi = C.plane("Wiggle", 1.2, 1.2, (1.2, 0, 0), (0.25, 0.55, 0.9))
sp = C.plane("Spin", 1.2, 1.2, (3.6, 0, 0), (0.85, 0.92, 0.9))
sn = C.plane("Sine", 0.6, 0.6, (0, 0, -2.2), (0.75, 0.95, 0.35))

# Float: 0 -> +0.3 -> 0 over 40 frames, Cruise both ways, cycles
f1 = C.key_bezier(fl, "location", 2, 0, 0.0, 20, 0.3, "Cruise")
C.key_bezier(fl, "location", 2, 20, 0.3, 40, 0.0, "Cruise")
f1.modifiers.new("CYCLES")
# Pulse: scale X and Y
for idx in (0, 1):
    fc = C.key_bezier(pu, "scale", idx, 0, 1.2, 8, 1.2 * 1.08, "Pop")
    C.key_bezier(pu, "scale", idx, 8, 1.2 * 1.08, 30, 1.2, "Settle")
    fc.modifiers.new("CYCLES")
# Wiggle: noise on X and Z
for idx, phase in ((0, 1.0), (2, 7.0)):
    wi.keyframe_insert("location", index=idx, frame=0)
    fc = next(c for c in C.fcurves(wi) if c.data_path == "location" and c.array_index == idx)
    m = fc.modifiers.new("NOISE"); m.scale = 15; m.strength = 0.6; m.phase = phase; m.blend_type = "ADD"
# Spin: 0 -> 360 deg linear, repeat with offset
sp.rotation_euler[1] = 0; sp.keyframe_insert("rotation_euler", index=1, frame=0)
sp.rotation_euler[1] = 2 * math.pi; sp.keyframe_insert("rotation_euler", index=1, frame=60)
fsp = next(c for c in C.fcurves(sp) if c.data_path == "rotation_euler" and c.array_index == 1)
for kp in fsp.keyframe_points:
    kp.interpolation = "LINEAR"
cm = fsp.modifiers.new("CYCLES"); cm.mode_after = "REPEAT_OFFSET"
# Sine generator on X (no keys needed: keyframe one value so the F-curve exists)
sn.keyframe_insert("location", index=0, frame=0)
fsn = next(c for c in C.fcurves(sn) if c.data_path == "location" and c.array_index == 0)
g = fsn.modifiers.new("FNGENERATOR"); g.function_type = "SIN"; g.amplitude = 2.0; g.phase_multiplier = 2 * math.pi / 45; g.use_additive = True

ev = lambda fc, fs: [round(fc.evaluate(f), 3) for f in fs]
print("T07 float z @0,20,40,60,80:", ev(f1, (0, 20, 40, 60, 80)))
fpx = next(c for c in C.fcurves(pu) if c.data_path == "scale" and c.array_index == 0)
print("T07 pulse sx @0,8,30,38,60:", ev(fpx, (0, 8, 30, 38, 60)))
fwx = next(c for c in C.fcurves(wi) if c.data_path == "location" and c.array_index == 0)
print("T07 wiggle x @0,10,20,30:", ev(fwx, (0, 10, 20, 30)))
print("T07 spin deg @30,60,90:", [round(math.degrees(v), 1) for v in ev(fsp, (30, 60, 90))])
print("T07 sine x @0,11.25,22.5:", ev(fsn, (0, 11.25, 22.5)))
for f in (0, 10, 20):
    C.render(sc, f, "t07_loops")
print("T07_DONE")
