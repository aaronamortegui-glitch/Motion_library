"""Integra los resultados de un lote (research/batch/<id>/) en el sistema.

Uso: python -I tools/style_research/integrate.py ref06 ref07 ...
Por id: lee entry.json + metrics.json + audio.json; mueve el video de references/_inbox a la carpeta de su familia;
copia analysis.md a research/styles/<familia>/; extrae la miniatura; actualiza catalog.json y behaviors.json.
"""
import json
import re
import shutil
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
FOLDERS = {"01 Elegant": "01_elegant_corporate", "02 Playful reel": "02_playful_reel",
           "03 Character": "03_character_animation", "04 Mixed media (proposed)": "04_mixed_media_collage"}


def slug(s):
    return re.sub(r"[^a-z0-9]+", "_", s.lower()).strip("_")[:40]


def folder_for(family):
    if family in FOLDERS:
        return FOLDERS[family]
    return slug(family)


def load(p):
    return json.loads(Path(p).read_text(encoding="utf-8"))


cat_p = ROOT / "research/style_map/catalog.json"; beh_p = ROOT / "research/ontology/behaviors.json"
cat = load(cat_p); beh = load(beh_p)
for vid in sys.argv[1:]:
    B = ROOT / "research/batch" / vid
    e = load(B / "entry.json"); m = load(B / "metrics.json")
    a = load(B / "audio.json") if (B / "audio.json").exists() else {"audio": False}
    fam = e["family"]; fold = folder_for(fam)
    # video
    src = ROOT / "references/_inbox" / f"{vid}.mp4"; dst_dir = ROOT / "references" / fold; dst_dir.mkdir(parents=True, exist_ok=True)
    dst = dst_dir / f"{vid}.mp4"
    if src.exists():
        shutil.move(str(src), str(dst))
    if not dst.exists():
        found = list((ROOT / "references").glob(f"*/{vid}.mp4"))
        dst = found[0] if found else dst
    # analysis doc
    sdir = ROOT / "research/styles" / fold; sdir.mkdir(parents=True, exist_ok=True)
    doc = sdir / f"{vid}_{slug(e['title'].split('—')[0])}.md"
    shutil.copy(B / "analysis.md", doc)
    # thumbnail
    th = ROOT / "research/style_map/thumbs" / f"{vid}.jpg"
    subprocess.run(["ffmpeg", "-v", "error", "-y", "-ss", str(e.get("thumb_time_s", 1)), "-i", str(dst),
                    "-frames:v", "1", "-vf", "scale=480:-1", str(th)], check=False)
    music = {k: a.get(k) for k in ("audio", "bpm", "pulse_clarity", "percussive_share", "cuts_on_beat", "cuts_on_half_beat",
                                    "accents_on_beat", "chance_on_beat", "median_shot_beats", "verdict")}
    music["summary"] = (e.get("music") or {}).get("summary")
    entry = {k: e[k] for k in ("id", "title", "family", "substyle", "format", "mood", "cast", "space", "motion_language", "transitions", "tone", "signature")}
    entry.update({"file": dst.relative_to(ROOT).as_posix(), "analysis": doc.relative_to(ROOT).as_posix(),
                  "thumb": f"thumbs/{vid}.jpg", "metrics": m, "music": music, "family_note": e.get("family_note")})
    cat["videos"] = [v for v in cat["videos"] if v["id"] != vid] + [entry]
    bs = e.get("behaviors", [])
    beh["behaviors"] = [b for b in beh["behaviors"] if b.get("video") != vid] + bs
    print(f"{vid}: {fam} / {e.get('substyle')} · {len(bs)} behaviors · {fold}")
cat["videos"].sort(key=lambda v: v["id"])
cat_p.write_text(json.dumps(cat, ensure_ascii=False, indent=2), encoding="utf-8")
beh_p.write_text(json.dumps(beh, ensure_ascii=False, indent=2), encoding="utf-8")
print(len(cat["videos"]), "videos ·", len(beh["behaviors"]), "behaviors")
