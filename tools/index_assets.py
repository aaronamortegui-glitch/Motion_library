"""Indexes the asset packs installed on THIS machine (Animation Composer: SFX, overlays, textures) so an LLM can
pick them by category, length and loudness. The files are licensed and are never copied into the repo: the index
holds names and measurements only, and its output files are git-ignored.

It also indexes the free CC0 packs in assets.free/ (tools/fetch_free_assets.py): SFX, music, VFX image sequences
(fire, smoke, explosions) and particle textures. Those lines carry the flag "cc0" and a relative path.

Output:  library/assets.local.json   (full data)
         library/ASSETS.local.txt    (compact, one line per asset: type|category|name|seconds|mean dB|peak dB|flags|path)
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


FREE = ROOT / "assets.free"
VFX_CATS = [("explosion", r"explosion"), ("fire", r"fire|flame"), ("smoke", r"smoke|cloud"), ("spark", r"spark|star|flare|light"),
            ("magic", r"magic|twirl|circle|symbol"), ("dust", r"dirt|dust|scorch|splat")]
FREE_SFX = [("impact", r"explosion|crunch"), ("ui", r"minimize|maximize|rollover|scroll|back|question|mouse|tone|bong|pluck|pep"),
            ("riser", r"power ?up|high ?up|phase ?jump"), ("sci-fi", r"thruster|engine|low ?frequency|low ?random|low ?down|high ?down"),
            ("cartoon", r"slime|scratch|knife|chop|belt|handle|leather|die")] + SFX_CATS + [("impact", r"footstep|metal|wood|glass|plate|punch"), ("ui", r"select|confirm|error|drop|open|close|switch|toggle"),
                       ("sci-fi", r"laser|phaser|zap|force|space|computer"), ("cartoon", r"chip|coin|dice|card|cloth|book|door")]


SKIP_FREE = re.compile(r"black background|/rotated/|unity samples|preview|sample\.|license|\.url$|\.ini$", re.I)   # duplicates and pack extras


def free_assets():
    """Assets in assets.free/<pack>/…: audio files, image sequences (one entry per folder) and textures."""
    items = []
    if not FREE.exists():
        return items
    for pack in sorted(d for d in FREE.iterdir() if d.is_dir()):
        seqs = {}
        for f in sorted(pack.rglob("*")):
            if not f.is_file() or SKIP_FREE.search(f.relative_to(pack).as_posix()):
                continue
            ext, rel = f.suffix.lower().lstrip("."), f.relative_to(ROOT).as_posix()
            if ext in ("wav", "mp3", "aif", "aiff"):
                music = "music" in pack.name
                it = {"name": f.stem, "ext": ext, "pack": pack.name, "path": rel, "type": "music" if music else "sfx",
                      "category": ("jingle" if pack.name == "kenney-music" else "track") if music else cat(f.stem.replace("_", " "), FREE_SFX, "misc")}
                it["seconds"], _, _ = probe(f)
                it["mean_db"], it["peak_db"] = loudness(f)
                it["flags"] = ["cc0"] + (["loud"] if it["mean_db"] is not None and it["mean_db"] > -12 else [])
                items.append(it)
            elif ext in ("tga", "png", "exr") and re.search(r"\d{2,}$", f.stem):
                seqs.setdefault((f.parent, re.sub(r"[_\-. ]*\d+$", "", f.stem)), []).append(f)   # frames share a prefix
            elif ext in ("png", "jpg", "jpeg"):
                items.append({"name": f"{pack.name}/{f.stem}", "ext": ext, "pack": pack.name, "path": rel, "type": "texture",
                              "category": cat(f.stem.replace("_", " "), VFX_CATS, "particle"), "flags": ["cc0"]})
        for (folder, prefix), frames in seqs.items():
            if len(frames) < 60:   # numbered stills (circle_01.png, blackSmoke00-24 …), not a sequence
                for f in frames:
                    items.append({"name": f"{pack.name}/{f.stem}", "ext": f.suffix.lower().lstrip("."), "pack": pack.name, "path": f.relative_to(ROOT).as_posix(),
                                  "type": "texture", "category": cat(f.stem.replace("_", " "), VFX_CATS, "particle"), "flags": ["cc0"]})
                continue
            name = folder.relative_to(pack).parts[0] if folder != pack else prefix
            items.append({"name": name, "ext": frames[0].suffix.lower().lstrip("."), "pack": pack.name, "path": frames[0].relative_to(ROOT).as_posix(),
                          "type": "vfx", "category": cat(name, VFX_CATS, "vfx"), "frames": len(frames),
                          "seconds": round(len(frames) / 30, 2), "flags": ["cc0", "sequence", "alpha"]})
    return items


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--packs", default=str(DEFAULT))
    a = ap.parse_args()
    packs = pathlib.Path(a.packs)
    if not packs.exists() and not FREE.exists():
        raise SystemExit(f"No asset packs at {packs} and no {FREE} (python tools/fetch_free_assets.py)")
    items, seen = [], set()
    for f in sorted(packs.rglob("*")) if packs.exists() else []:
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

    items += free_assets()
    (ROOT / "library/assets.local.json").write_text(json.dumps({"source": str(packs), "free": str(FREE), "assets": items}, indent=1), encoding="utf-8")
    lines = ["# Local asset packs (licensed, NOT in the repo) + free CC0 packs (assets.free/) · type|category|name|seconds|mean dB|peak dB|flags|path",
             "# use in AE: #include \"ss_assets.jsx\" · SSA.sfx(comp, name, t, gainDb[, len]) · SSA.overlay(comp, name, t[, blend, opacity])",
             "# sfx tip: prefer mean dB below -15 for UI sounds; 'loud' ones need -12 dB or more of gain reduction",
             "# vfx (cc0 image sequences with alpha): SSA.vfx(comp, name, t[, blend, scale %]) · music: SSA.sfx works for music too"]
    order = {"sfx": 0, "music": 1, "overlay": 2, "vfx": 3, "texture": 4, "graphic": 5}
    for it in sorted(items, key=lambda x: (order.get(x["type"], 9), x["category"], x["name"])):
        lines.append("|".join([it["type"], it["category"], it["name"], str(it.get("seconds", "")),
                               "" if it.get("mean_db") is None else str(it["mean_db"]),
                               "" if it.get("peak_db") is None else str(it["peak_db"]), ",".join(it["flags"]), it.get("path", "")]))
    (ROOT / "library/ASSETS.local.txt").write_text("\n".join(lines) + "\n", encoding="utf-8")
    by = {}
    for it in items:
        by.setdefault(f'{it["type"]}/{it["category"]}', 0)
        by[f'{it["type"]}/{it["category"]}'] += 1
    print(f"{len(items)} assets · " + " · ".join(f"{k} {v}" for k, v in sorted(by.items())))


if __name__ == "__main__":
    main()
