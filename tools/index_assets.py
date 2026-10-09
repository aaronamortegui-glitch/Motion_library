"""Indexes the asset packs installed on THIS machine (Animation Composer: SFX, overlays, textures) so an LLM can
pick them by category, length and loudness. The files are licensed and are never copied into the repo: the index
holds names and measurements only, and its output files are git-ignored.

Output:  library/assets.local.json   (full data)
         library/ASSETS.local.txt    (compact, one line per asset: type|category|name|seconds|mean dB|peak dB|flags)
Usage:   python tools/index_assets.py [--packs <folder>]
In AE:   #include "ss_assets.jsx"  →  SSA.sfx(comp, "Swoosh Wood 01_Variant Main", t, -9)
"""
import argparse
import json
import os
import pathlib
import re
import subprocess
import sys

ROOT = pathlib.Path(__file__).resolve().parent.parent
if os.environ.get("SS_ASSET_PACKS"):
    DEFAULT = pathlib.Path(os.environ["SS_ASSET_PACKS"])
elif sys.platform == "darwin":
    DEFAULT = pathlib.Path.home() / "Library/Application Support/MisterHorse/ProductManager/AssetPacks"
else:
    DEFAULT = pathlib.Path(os.environ.get("LOCALAPPDATA", "")) / "MisterHorse/ProductManager/AssetPacks"

SFX_CATS = [  # first match wins
    ("whoosh", r"swoosh|whoosh|swish|swipe|transition|approach"),
    ("impact", r"boom|hit|impact|punch|thud|slam|drop|bass"),
    ("glitch", r"glitch|hiss|noise|data|static|digital|scan"),
    ("ui", r"beep|blip|click|pop|tap|ui|notification|tick|switch|button|keyboard"),
    ("riser", r"riser|rise|build|reverse|reversed|slowdown|slow motion"),
    ("slide", r"slide|silde|cloth|breeze|spray"),
    ("sparkle", r"glitter|glittering|fireworks|clink|clang|wineglass"),
    ("cartoon", r"balloon|rubber|creak|smoke puff|knock|key"),
    ("sci-fi", r"sci-fi|teleport|drone|energy|transmission"),
    ("film", r"film|vhs|tv crackling|projector"),
]
OVL_CATS = [
    ("light-leak", r"light ?leak"),
    ("film-burn", r"burn"),
    ("grain", r"grain"),
    ("scratches", r"scratch"),
    ("vhs", r"vhs|tv_noise|crt"),
    ("glitch", r"glitch|distort"),
    ("film-footage", r"8mm|16mm|35mm|film footage"),
    ("mockup", r"iphone|device|mockup"),
    ("film-texture", r"^film \d"),
]


def clean(name):
    return re.sub(r"\s*#[0-9a-f]{6,}$", "", name).strip()


def cat(name, table, default):
    low = name.lower()
    for c, rx in table:
        if re.search(rx, low):
            return c
    return default


def probe(path):
    try:
        out = subprocess.run(["ffprobe", "-v", "error", "-show_entries", "format=duration:stream=width,height",
                              "-of", "json", str(path)], capture_output=True, text=True, timeout=30).stdout
        d = json.loads(out or "{}")
        dur = float(d.get("format", {}).get("duration", 0) or 0)
        st = (d.get("streams") or [{}])[0]
        return round(dur, 2), st.get("width"), st.get("height")
    except Exception:
        return 0, None, None


def loudness(path):
    try:
        err = subprocess.run(["ffmpeg", "-hide_banner", "-nostats", "-i", str(path), "-af", "volumedetect", "-f", "null", "-"],
                             capture_output=True, text=True, timeout=60).stderr
        mean = re.search(r"mean_volume: (-?[\d.]+)", err)
        peak = re.search(r"max_volume: (-?[\d.]+)", err)
        return (float(mean.group(1)) if mean else None, float(peak.group(1)) if peak else None)
    except Exception:
        return None, None


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--packs", default=str(DEFAULT))
    a = ap.parse_args()
    packs = pathlib.Path(a.packs)
    if not packs.exists():
        raise SystemExit(f"No asset packs at {packs}")
    items, seen = [], set()
    for f in sorted(packs.rglob("*")):
        if not f.is_file():
            continue
        ext = f.suffix.lower().lstrip(".")
        name = clean(f.stem)
        if ext == "png" and name.endswith(".wav"):
            continue  # waveform previews
        key = (name, ext)
        if key in seen:
            continue
        seen.add(key)
        it = {"name": name, "ext": ext, "pack": f.parent.name[:8]}
        if ext in ("wav", "mp3", "aif", "aiff"):
            it["type"] = "sfx"
            it["category"] = cat(name, SFX_CATS, "misc")
            it["seconds"], _, _ = probe(f)
            it["mean_db"], it["peak_db"] = loudness(f)
            flags = []
            if it["mean_db"] is not None and it["mean_db"] > -12:
                flags.append("loud")          # e.g. Single UI Beep 02 sat at -3.9 dB mean and read as an alarm
            if it["seconds"] and it["seconds"] > 3:
                flags.append("long")          # trim + fade the tail (build_edit.jsx sfx "len")
            it["flags"] = flags
        elif ext in ("mp4", "mov", "webm"):
            it["type"] = "overlay"
            it["category"] = cat(name, OVL_CATS, "overlay")
            it["seconds"], it["width"], it["height"] = probe(f)
            it["flags"] = []
        elif ext in ("png", "jpg", "jpeg"):
            it["type"] = "texture"
            it["category"] = cat(name, OVL_CATS, "texture")
            it["flags"] = []
        else:
            it["type"] = "graphic"
            it["category"] = ext
            it["flags"] = []
        items.append(it)

    (ROOT / "library/assets.local.json").write_text(json.dumps({"source": str(packs), "assets": items}, indent=1), encoding="utf-8")
    lines = ["# Local asset packs (licensed, NOT in the repo) · type|category|name|seconds|mean dB|peak dB|flags",
             "# use in AE: #include \"ss_assets.jsx\" · SSA.sfx(comp, name, t, gainDb[, len]) · SSA.overlay(comp, name, t[, blend, opacity])",
             "# sfx tip: prefer mean dB below -15 for UI sounds; 'loud' ones need -12 dB or more of gain reduction"]
    order = {"sfx": 0, "overlay": 1, "texture": 2, "graphic": 3}
    for it in sorted(items, key=lambda x: (order.get(x["type"], 9), x["category"], x["name"])):
        lines.append("|".join([it["type"], it["category"], it["name"], str(it.get("seconds", "")),
                               "" if it.get("mean_db") is None else str(it["mean_db"]),
                               "" if it.get("peak_db") is None else str(it["peak_db"]), ",".join(it["flags"])]))
    (ROOT / "library/ASSETS.local.txt").write_text("\n".join(lines) + "\n", encoding="utf-8")
    by = {}
    for it in items:
        by.setdefault(f'{it["type"]}/{it["category"]}', 0)
        by[f'{it["type"]}/{it["category"]}'] += 1
    print(f"{len(items)} assets · " + " · ".join(f"{k} {v}" for k, v in sorted(by.items())))


if __name__ == "__main__":
    main()
