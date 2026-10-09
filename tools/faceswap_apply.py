"""Puts the refined clips from tools/faceswap_refine.py in place of the originals (originals move to
media/faceswap/preswap/, git-ignored), so every scene, edit and render that uses them picks up the real faces.
Then reload the footage in AE: bash tools/bridge.sh tools/reload_footage.jsx
  python tools/faceswap_apply.py media/faceswap/jobs.json [--only id ...]
"""
import argparse, json, os, shutil

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
ap = argparse.ArgumentParser(); ap.add_argument("jobs"); ap.add_argument("--only", nargs="*")
a = ap.parse_args()
for job in json.load(open(a.jobs, encoding="utf-8"))["jobs"]:
    if a.only and job["id"] not in a.only:
        continue
    src, out = os.path.join(ROOT, job["src"]), os.path.join(ROOT, job["out"])
    if not os.path.exists(out):
        print("not refined yet:", job["id"]); continue
    keep = os.path.join(ROOT, "media", "faceswap", "preswap", job["src"].replace("/", "__"))
    os.makedirs(os.path.dirname(keep), exist_ok=True)
    if not os.path.exists(keep):
        shutil.copy2(src, keep)
    shutil.copy2(out, src)
    print("applied:", job["src"])
