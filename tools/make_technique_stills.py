"""Thumbnails for the Techniques category (panel and visualizer): one frame of each technique's result, taken from our own
renders, in library/techniques/<slug>.png (480x270), <slug>_md.png (224x126, panel grid) and <slug>_sm.png (112x63, favorites).
Run after the showcase renders exist (renders/*.mp4):   python tools/make_technique_stills.py
"""
import json
import pathlib
import re
import subprocess

ROOT = pathlib.Path(__file__).resolve().parent.parent
OUT = ROOT / "library" / "techniques"
FIT = "scale={w}:{h}:force_original_aspect_ratio=increase,crop={w}:{h}"

# technique name -> (source file, time in s or None for stills, optional crop "w:h:x:y" in source pixels)
SOURCES = {
    "Tracked labels": ("renders/CYPHER_EDIT.mp4", 18.0, None),
    "Text behind people": ("renders/05_Text_Behind_70s.mp4", 2.0, None),
    "Roto breakdown": ("renders/WHISKY_EDIT.mp4", 32.5, None),
    "HUD overlays": ("renders/HUD_TEST.mp4", 2.5, None),
    "Speed ramps": ("renders/CYPHER_EDIT.mp4", 26.2, None),
    "Freeze frame + kinetic type": ("renders/WHISKY_EDIT.mp4", 8.0, None),
    "Shape-wipe transitions": ("renders/PROMO_EDIT.mp4", 5.28, None),
    "Marker timing": ("media/explainer/ae_markers_timeline.png", None, "1300:520:1500:0"),
    "Styles": ("library/packs/dynamic.png", None, None),
}


def slug(s):
    return re.sub(r"[^a-z0-9]+", "-", s.lower()).strip("-")


def frame(src, t, crop, out):
    vf = (f"crop={crop}," if crop else "") + FIT.format(w=480, h=270)
    args = ["ffmpeg", "-v", "error", "-y"] + (["-ss", str(t)] if t is not None else []) + ["-i", str(ROOT / src), "-frames:v", "1", "-vf", vf, str(out)]
    return subprocess.run(args, capture_output=True).returncode == 0


def voice_cuts(out):
    """Cut on the voice: the promo VO as a Spark waveform with the scene cuts as Coral lines."""
    spec = json.load(open(ROOT / "media/promo/edit.json", encoding="utf-8"))
    vo = ROOT / spec["vo"][0]["file"].replace("_b", "_b") if False else ROOT / "media/promo/vo/chris_c.mp3"
    total, t, lines = sum(s["dur"] for s in spec["shots"]), 0.0, []
    for s in spec["shots"][:-1]:
        t += s["dur"]; x = int(480 * t / total)
        lines.append(f"drawbox=x={x}:y=40:w=2:h=190:color=0xFF9595@1:t=fill")
    fc = ("color=c=0x0A211F:s=480x270[bg];[0:a]aformat=channel_layouts=mono,showwavespic=s=480x190:colors=0xD8FF85:scale=sqrt[w];"
          "[bg][w]overlay=0:40," + ",".join(lines))
    return subprocess.run(["ffmpeg", "-v", "error", "-y", "-i", str(vo), "-filter_complex", fc, "-frames:v", "1", str(out)], capture_output=True).returncode == 0


def face_refine(out):
    """Face refinement: before | after (a face crop from the original and the refined clip)."""
    before = ROOT / "media/faceswap/preswap/media__cypher__clip04_gian.mp4"
    after = ROOT / "media/cypher/clip04_gian.mp4"
    if not before.exists():
        return False
    fc = ("[0:v]crop=560:630:620:60,scale=240:270[a];[1:v]crop=560:630:620:60,scale=240:270[b];[a][b]hstack,"
          "drawbox=x=239:y=0:w=2:h=270:color=0xD8FF85@1:t=fill")
    return subprocess.run(["ffmpeg", "-v", "error", "-y", "-ss", "2.5", "-i", str(before), "-ss", "2.5", "-i", str(after),
                           "-filter_complex", fc, "-frames:v", "1", str(out)], capture_output=True).returncode == 0


def main():
    OUT.mkdir(parents=True, exist_ok=True)
    techs = json.load(open(ROOT / "library/techniques.json", encoding="utf-8"))
    made = []
    for t in techs["techniques"]:
        out = OUT / f"{slug(t['name'])}.png"
        if t["name"] in SOURCES:
            ok = frame(*SOURCES[t["name"]], out)
        elif t["name"] == "Cut on the voice":
            ok = voice_cuts(out)
        elif t["name"] == "Face refinement":
            ok = face_refine(out)
        else:
            ok = False
        if ok:
            subprocess.run(["ffmpeg", "-v", "error", "-y", "-i", str(out), "-vf", "scale=224:126", str(OUT / f"{slug(t['name'])}_md.png")])
            subprocess.run(["ffmpeg", "-v", "error", "-y", "-i", str(out), "-vf", "scale=112:63", str(OUT / f"{slug(t['name'])}_sm.png")])
            t["image"] = f"techniques/{slug(t['name'])}.png"
            made.append(t["name"])
    json.dump(techs, open(ROOT / "library/techniques.json", "w", encoding="utf-8"), indent=1, ensure_ascii=False)
    print(f"technique stills: {len(made)}/{len(techs['techniques'])} ->", ", ".join(made))


if __name__ == "__main__":
    main()
