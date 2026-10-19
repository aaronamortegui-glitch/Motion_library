"""Test 14 · Layout check (Motion DNA check_layout: text overlapping text, text outside the 40 px safe area,
text under 32 px), computed from object bounding boxes projected to the camera.

For each object: the 8 corners of the EVALUATED object's bound_box (obj.evaluated_get(depsgraph), so modifiers,
GN and animation at the current frame count) -> matrix_world -> bpy_extras.object_utils.world_to_camera_view(scene,
camera, co) -> normalized (0..1, origin bottom-left) -> pixel rect. Then rect intersection for overlaps, rect vs
frame inset by 40 px for safe area, rect height for size (text height = glyph bbox height, a proxy of AE's).
Hidden objects (hide_render) and zero opacity (obj.color[3] == 0) are skipped. Can run at any frame (frame_set).
Run: blender -b --factory-startup -P research/platforms/blender/tests/t14_layout_check.py
"""
import pathlib
import sys
sys.path.insert(0, str(pathlib.Path(__file__).resolve().parent))
import bpy  # noqa: E402
from bpy_extras.object_utils import world_to_camera_view  # noqa: E402
from mathutils import Vector  # noqa: E402
import common as C  # noqa: E402


def screen_rect(scene, obj, dg=None):
    dg = dg or bpy.context.evaluated_depsgraph_get()
    ev = obj.evaluated_get(dg)
    W, H = scene.render.resolution_x, scene.render.resolution_y
    pts = [world_to_camera_view(scene, scene.camera, ev.matrix_world @ Vector(c)) for c in ev.bound_box]
    xs = [p.x * W for p in pts]; ys = [(1 - p.y) * H for p in pts]   # pixel coords, origin top-left like AE
    return min(xs), min(ys), max(xs), max(ys)


def layout_check(scene, objs=None, safe_px=40, min_text_px=32):
    dg = bpy.context.evaluated_depsgraph_get()
    W, H = scene.render.resolution_x, scene.render.resolution_y
    objs = [o for o in (objs or scene.objects) if o.type in ("FONT", "MESH", "CURVE") and not o.hide_render
            and (o.color[3] > 0.001)]
    rects = {o.name: screen_rect(scene, o, dg) for o in objs}
    texts = [o for o in objs if o.type == "FONT" or o.get("mdna_text")]
    warn = []
    for i, a in enumerate(texts):
        ra = rects[a.name]
        for b in texts[i + 1:]:
            rb = rects[b.name]
            ix = min(ra[2], rb[2]) - max(ra[0], rb[0]); iy = min(ra[3], rb[3]) - max(ra[1], rb[1])
            if ix > 0 and iy > 0:
                warn.append(f"overlap: '{a.name}' x '{b.name}' ({ix:.0f}x{iy:.0f} px)")
        if ra[0] < safe_px or ra[1] < safe_px or ra[2] > W - safe_px or ra[3] > H - safe_px:
            warn.append(f"outside safe area ({safe_px} px): '{a.name}' rect {tuple(round(v) for v in ra)}")
        if ra[3] - ra[1] < min_text_px:
            warn.append(f"text under {min_text_px} px: '{a.name}' ({ra[3] - ra[1]:.0f} px)")
    return rects, warn


def main():
    sc = C.scene(w=1920, h=1080, frames=30)
    font = C.bold_font()
    C.text("Headline", 1.0, (0, 0, 1.0), (0.85, 0.92, 0.9), font)
    C.text("Overlapping sub", 0.6, (0.5, 0, 0.6), (0.75, 0.95, 0.35), font)
    C.text("Edge text", 0.5, (4.9, 0, -2.6), (0.85, 0.92, 0.9), font)
    C.text("tiny legal line", 0.12, (0, 0, -1.5), (0.85, 0.92, 0.9), font)
    mover = C.text("Moving in", 0.5, (0, 0, -0.6), (0.85, 0.92, 0.9), font)
    C.M.apply(mover, "Slide Land", "in", 0)
    for f in (0, 29):
        sc.frame_set(f)
        rects, warn = layout_check(sc)
        print(f"T14 frame {f}: {len(warn)} warnings")
        for w in warn:
            print("T14   ", w)
        print("T14   rect Headline:", tuple(round(v) for v in rects["Headline"]), "Moving in:", tuple(round(v) for v in rects["Moving in"]))
    C.render(sc, 29, "t14_layout")
    print("T14_DONE")


if __name__ == "__main__":
    main()
