"""Test 15 · Social resize 16:9 -> 9:16 (Motion DNA resize_comp: modes fit and reflow, title-safe, then check_layout).

Same scene, animation untouched (keys are relative to each object's rest, so nothing is re-keyed):
- resolution 1920x1080 -> 1080x1920. Ortho camera: ortho_scale spans the LARGER side (sensor_fit AUTO), so in 9:16
  ortho_scale is the frame HEIGHT in world units.
- fit: union of the layout's screen rects (t14.screen_rect at the rest frame, in world X/Z) -> camera centred on it,
  ortho_scale chosen so the union fits inside the 9:16 title-safe box (insets top .10, sides .08, bottom .20: clear
  of the Reels/TikTok UI). Everything scales as one block.
- reflow: camera ortho_scale fixed (same world units per pixel as the 16:9 width), every top-level item keeps its
  size unless wider than the safe width (then scaled down), items are stacked vertically in their original order,
  centred, with a gap. Moves the object's rest location (applied BEFORE animation keys, or offset via a parent).
  Here items are parented to an empty per item so keyed locations stay valid.
Run: blender -b --factory-startup -P research/platforms/blender/tests/t15_resize_9x16.py
"""
import pathlib
import sys
sys.path.insert(0, str(pathlib.Path(__file__).resolve().parent))
import bpy  # noqa: E402
import common as C  # noqa: E402
from t14_layout_check import layout_check, screen_rect  # noqa: E402

SAFE = dict(top=0.10, side=0.08, bottom=0.20)


def build():
    sc = C.scene(w=1920, h=1080, frames=40)
    font = C.bold_font()
    items = []
    for name, obj in (("title", C.text("Launch week is here", 0.9, (0, 0, 1.3), (0.85, 0.92, 0.9), font)),
                      ("sub", C.text("Five drops, one every day", 0.4, (0, 0, 0.4), (0.75, 0.95, 0.35), font)),
                      ("card", C.plane("Card", 6.5, 1.2, (0, 0.2, -1.0), (0.02, 0.16, 0.13)))):
        e = bpy.data.objects.new("grp_" + name, None); sc.collection.objects.link(e)
        e.location = obj.location.copy(); obj.parent = e; obj.location = (0, 0, 0)
        items.append((e, obj))
    C.M.apply(items[0][1], "Fade Up", "in", 0)
    C.M.apply(items[1][1], "Slide Land", "in", 6)
    C.M.apply(items[2][1], "Scale Pop", "in", 10)
    return sc, items


def world_rect(sc, obj):
    """Screen rect -> world X/Z extents for an ortho front camera."""
    W, H = sc.render.resolution_x, sc.render.resolution_y
    cam = sc.camera; os_ = cam.data.ortho_scale
    upp = os_ / max(W, H)   # world units per pixel
    x0, y0, x1, y1 = screen_rect(sc, obj)
    cx, cz = cam.location.x, cam.location.z
    return (cx + (x0 - W / 2) * upp, cz - (y1 - H / 2) * upp, cx + (x1 - W / 2) * upp, cz - (y0 - H / 2) * upp)


def to_9x16(sc):
    sc.render.resolution_x, sc.render.resolution_y = 1080, 1920


# ---- fit ----
sc, items = build()
sc.frame_set(40)   # rest pose (end of the in animations)
rects = [world_rect(sc, o) for _, o in items]
ux0 = min(r[0] for r in rects); uz0 = min(r[1] for r in rects); ux1 = max(r[2] for r in rects); uz1 = max(r[3] for r in rects)
to_9x16(sc)
safe_w = 1 - 2 * SAFE["side"]; safe_h = 1 - SAFE["top"] - SAFE["bottom"]
# frame height H_w must satisfy: width (H_w * 9/16) * safe_w >= union width and H_w * safe_h >= union height
Hw = max((ux1 - ux0) / (safe_w * 9 / 16), (uz1 - uz0) / safe_h)
cam = sc.camera; cam.data.ortho_scale = Hw
cam.location.x = (ux0 + ux1) / 2
# centre of the safe box sits (bottom - top)/2 of the frame above the frame centre
cam.location.z = (uz0 + uz1) / 2 - (SAFE["bottom"] - SAFE["top"]) / 2 * Hw
_, warn = layout_check(sc, safe_px=40)
print("T15 fit: ortho_scale", round(Hw, 3), "warnings:", warn or "none")
for f in (8, 40):
    C.render(sc, f, "t15_fit_9x16")

# ---- reflow ----
sc, items = build()
sc.frame_set(40)
upp_169 = sc.camera.data.ortho_scale / 1920          # keep world units per pixel of the 16:9 frame
rects = [world_rect(sc, o) for _, o in items]
to_9x16(sc)
cam = sc.camera; cam.data.ortho_scale = upp_169 * 1920   # 1920 px is now the height
Hw = cam.data.ortho_scale; Ww = Hw * 9 / 16
safe_w_world = Ww * safe_w
gap = 0.35
sizes = []
for (e, o), r in zip(items, rects):
    w, h = r[2] - r[0], r[3] - r[1]
    k = min(1.0, safe_w_world / w)
    e.scale = (k, k, k); sizes.append((w * k, h * k, r, k))
total = sum(s[1] for s in sizes) + gap * (len(sizes) - 1)
z = cam.location.z + (SAFE["bottom"] - SAFE["top"]) / 2 * Hw + total / 2   # stack centred in the safe box
for (e, o), (w, h, r, k) in zip(items, sizes):
    oz = (r[1] + r[3]) / 2 - e.location.z          # rect centre relative to the group origin (at rest)
    ox = (r[0] + r[2]) / 2 - e.location.x
    e.location.z = z - h / 2 - oz * k; e.location.x = cam.location.x - ox * k
    z -= h + gap
_, warn = layout_check(sc, safe_px=40)
print("T15 reflow: ortho_scale", round(Hw, 3), "warnings:", warn or "none")
for f in (8, 40):
    C.render(sc, f, "t15_reflow_9x16")
print("T15_DONE")
