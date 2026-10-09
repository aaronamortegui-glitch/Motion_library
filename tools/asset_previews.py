"""Panel thumbnails for the local asset packs (licensed, never in the repo): a waveform for each sound effect and a
frame for each overlay, 112x63 PNGs in library/assets_cache/<type>/<slug>.png (git-ignored, rebuilt per machine).
SFX get a Spark waveform on Pine drawn by ffmpeg; overlays a frame at 40 % of the clip.
Run after python tools/index_assets.py:   python tools/asset_previews.py [--force]
"""
import json
import os
import pathlib
import re
import subprocess
import sys

ROOT = pathlib.Path(__file__).resolve().parent.parent
OUT = ROOT / "library" / "assets_cache"
FIT = "scale=112:63:force_original_aspect_ratio=decrease,pad=112:63:(ow-iw)/2:(oh-ih)/2:color=0x0A211F"


def slug(s):
    return re.sub(r"[^a-z0-9]+", "-", s.lower()).strip("-")


def ff(*a):
    return subprocess.run(["ffmpeg", "-v", "error", "-y", *a], capture_output=True).returncode == 0


def main():
    data = json.load(open(ROOT / "library" / "assets.local.json", encoding="utf-8"))
    root = pathlib.Path(data["source"]) if data.get("source") else None
    if not root or not root.exists():
        sys.exit("asset packs folder not found (run python tools/index_assets.py first)")
    force = "--force" in sys.argv
    packs = {p.name[:8]: p for p in root.iterdir() if p.is_dir()}
    made = skipped = missing = 0
    for a in data["assets"]:
        out = OUT / a["type"] / f'{slug(a["name"])}.png'
        if out.exists() and not force:
            skipped += 1; continue
        folder = packs.get(a["pack"])
        hits = sorted(folder.glob(f'{a["name"]} #*.{a["ext"]}')) if folder else []
        if not hits:
            missing += 1; continue
        out.parent.mkdir(parents=True, exist_ok=True)
        src = hits[0]
        if a["type"] == "sfx":   # one look for every sound: a Spark waveform on Pine (the packs' own previews vary)
            ok = ff("-i", str(src), "-filter_complex", "color=c=0x0A211F:s=224x126[bg];[0:a]aformat=channel_layouts=mono,dynaudnorm=f=150:p=0.95,showwavespic=s=224x126:colors=0xD8FF85:scale=sqrt[w];"
                    "[bg][w]overlay=format=auto,scale=112:63", "-frames:v", "1", str(out))
        else:
            t = max(0.0, (a.get("seconds") or 1) * 0.4)
            ok = ff("-ss", f"{t:.2f}", "-i", str(src), "-frames:v", "1", "-vf", FIT, str(out))
        made += ok
    print(f"asset previews: {made} made, {skipped} already there, {missing} files not found -> {OUT}")


if __name__ == "__main__":
    main()
