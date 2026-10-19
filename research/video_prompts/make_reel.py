"""Joins the pilot renders into one review reel (renders/pilot_reel.mp4), each clip labelled with its template and route.
Alpha renders (.mov) are laid over pine; the native AE rebuilds (route B) follow their HTML version.
Usage: python research/video_prompts/make_reel.py
"""
import json, os, subprocess

HERE = os.path.dirname(os.path.abspath(__file__)); R = os.path.join(HERE, "renders")
ROOT = os.path.abspath(os.path.join(HERE, "..", ".."))
FONT = os.path.join(ROOT, "assets", "fonts", "static", "InterTight-SemiBold.ttf").replace("\\", "/").replace(":", "\\:")
cat = json.load(open(os.path.join(HERE, "templates", "catalog.json"), encoding="utf-8"))["templates"]
clips = []
for c in cat:
    f = os.path.join(R, c["id"] + (".mov" if c["alpha"] else ".mp4"))
    clips.append((f, f"{c['id'][:3].upper()} · {c['title']} · route {c['route']}" + (" · HTML render" if c["route"] == "B" or c["alpha"] else "")))
    ae = os.path.join(ROOT, "renders", "mcp", {"t05_kinetic_type": "VP T05 · kinetic type (AE).mp4", "t12_logo_reveal": "VP T12 · logo reveal (AE).mp4"}.get(c["id"], "-"))
    if os.path.exists(ae): clips.append((ae, f"{c['id'][:3].upper()} · {c['title']} · native AE rebuild (editable)"))
parts = []
for i, (f, label) in enumerate(clips):
    out = os.path.join(R, f"_reel_{i:02d}.mp4"); parts.append(out)
    lab = label.replace(":", "\\:").replace("'", "")
    vf = (f"[0:v]scale=1920:1080,fps=30,format=yuva420p[v];color=c=0x0A211F:s=1920x1080:r=30[bg];[bg][v]overlay=shortest=1,"
          f"drawtext=fontfile='{FONT}':text='{lab}':x=40:y=36:fontsize=30:fontcolor=0xF7F9F2:box=1:boxcolor=0x0A211Fcc:boxborderw=14,format=yuv420p")
    subprocess.run(["ffmpeg", "-v", "error", "-y", "-i", f, "-filter_complex", vf, "-an", "-c:v", "libx264", "-crf", "20", "-preset", "fast", out], check=True)
lst = os.path.join(R, "_reel.txt"); open(lst, "w").write("".join(f"file '{p.replace(os.sep, '/')}'\n" for p in parts))
subprocess.run(["ffmpeg", "-v", "error", "-y", "-f", "concat", "-safe", "0", "-i", lst, "-c", "copy", os.path.join(R, "pilot_reel.mp4")], check=True)
for p in parts: os.remove(p)
os.remove(lst); print("renders/pilot_reel.mp4 ·", len(clips), "clips")
