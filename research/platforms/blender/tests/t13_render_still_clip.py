"""Test 13 · Render a still and a clip (AE: render_frame / render_comp), with timings.

1920x1080, 30 fps, EEVEE (Blender 5: engine "BLENDER_EEVEE"), Standard view transform. A small title card using
portable presets (Scale Pop, Surge Rise, Fade Up, Bounce In staggered). Still: frame_set + render(write_still=True).
Clip A: image_settings.file_format = "PNG" + render(animation=True) -> external ffmpeg (libx264, yuv420p).
Clip B (direct video, tested): Blender 5 split formats by media type; file_format = "FFMPEG" fails until
  image_settings.media_type = "VIDEO" is set first, then file_format = "FFMPEG", ffmpeg.format = "MPEG4",
  ffmpeg.codec = "H264" -> writes <filepath>0000-0059.mp4 directly.
Run: blender -b --factory-startup -P research/platforms/blender/tests/t13_render_still_clip.py
"""
import pathlib
import sys
import time
sys.path.insert(0, str(pathlib.Path(__file__).resolve().parent))
import bpy  # noqa: E402
import common as C  # noqa: E402

sc = C.scene(w=1920, h=1080, frames=60)
font = C.bold_font()
card = C.plane("Card", 7.2, 2.2, (0, 0.2, 0.3), (0.02, 0.16, 0.13))
title = C.text("Motion DNA", 0.95, (0, 0, 0.5), (0.75, 0.95, 0.35), font)
sub = C.text("Blender · token curves", 0.32, (0, 0, -0.35), (0.85, 0.92, 0.9), font)
chips = [C.plane(f"Chip{i}", 0.5, 0.5, (-1.2 + i * 1.2, 0.1, -1.9), (0.75, 0.95, 0.35)) for i in range(3)]
C.M.apply(card, "Scale Pop", "in", 0); C.M.apply(title, "Surge Rise", "in", 6); C.M.apply(sub, "Fade Up", "in", 14)
for i, c in enumerate(chips):
    C.M.apply(c, "Bounce In", "in", 22 + i * 4)

print("T13 file_format options:", [i.identifier for i in bpy.types.ImageFormatSettings.bl_rna.properties["file_format"].enum_items])
t0 = time.time(); C.render(sc, 30, "t13_still"); t_still = time.time() - t0
t0 = time.time(); mp4 = C.render_clip(sc, "t13_clip", 0, 59); t_clip = time.time() - t0
sc.render.image_settings.media_type = "VIDEO"; sc.render.image_settings.file_format = "FFMPEG"
sc.render.ffmpeg.format = "MPEG4"; sc.render.ffmpeg.codec = "H264"; sc.render.ffmpeg.constant_rate_factor = "HIGH"
sc.render.filepath = str(C.OUT / "t13_direct_")
t0 = time.time(); bpy.ops.render.render(animation=True); t_direct = time.time() - t0
print("T13 direct video:", sorted(p.name for p in C.OUT.glob("t13_direct_*")), f"{t_direct:.1f}s")
print(f"T13 still 1080p: {t_still:.2f}s · clip 60 frames 1080p (+ffmpeg): {t_clip:.1f}s ({t_clip / 60:.2f}s/frame) · {mp4.stat().st_size} bytes")
print("T13_DONE")
