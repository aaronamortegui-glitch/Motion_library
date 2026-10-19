"""Downloads the third-party material this research reads, into git-ignored folders (each user fetches it locally):
  source/          the awesome-opus5-5-videos collection (data/videos.json + prompts/): needed by build_index.py
  source/remakes/  the Skillry remake MP4s of the prompts our templates were inspired by: needed by compare.py
The prompt texts belong to their creators and the remakes to Skillry: keep them local, never commit or redistribute.
Usage: python research/video_prompts/fetch_sources.py [--no-remakes]
"""
import json, os, shutil, subprocess, sys, tempfile

HERE = os.path.dirname(os.path.abspath(__file__)); SRC = os.path.join(HERE, "source")
REPO = "https://github.com/yihui-dev/awesome-opus5-5-videos"
REMAKES = {"t01": "prasenx-693512", "t02": "techtactician-144474", "t03": "thegrootdev-966114", "t04": "dale-vaz-879074", "t05": "wani-shola-459278",
           "t06": "astrothewizard-618782", "t07": "retropunkai-277590", "t09": "ishuagra02-678129", "t10": "alexalbert-274839", "t12": "ho-ba-761062"}

os.makedirs(SRC, exist_ok=True)
if not os.path.exists(os.path.join(SRC, "data", "videos.json")):
    tmp = tempfile.mkdtemp()
    subprocess.run(["git", "clone", "--depth", "1", REPO, tmp], check=True)
    for name in ("data", "prompts", "LICENSE"):
        s = os.path.join(tmp, name); d = os.path.join(SRC, name)
        (shutil.copytree if os.path.isdir(s) else shutil.copy)(s, d)
    shutil.rmtree(tmp, ignore_errors=True)
    print("collection →", SRC)
if "--no-remakes" not in sys.argv:
    os.makedirs(os.path.join(SRC, "remakes"), exist_ok=True)
    for tag, slug in REMAKES.items():
        out = os.path.join(SRC, "remakes", f"{tag}_{slug}.mp4")
        if not os.path.exists(out):
            subprocess.run(["curl", "-sL", "-A", "Mozilla/5.0", "-o", out, f"https://media.skillry.dev/opus-5-5/{slug}/remake.mp4"], check=True)
    print("remakes →", os.path.join(SRC, "remakes"))
