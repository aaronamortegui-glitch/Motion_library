"""Lists every library item whose preview is missing, the way the panel looks for it (panel/js/app.js, agent.js):
presets (thumbs/ + gifs/), recipes, styles (packs/<slug>_md.png + .gif) and techniques (techniques/<slug>_card.png or _md.png).
The panel never shows a broken image (it falls back to a placeholder), so this is what keeps the previews complete.
  python tools/check_previews.py        (exit code 1 when something is missing; run by setup.py and test_all.py)
"""
import json
import pathlib
import re
import sys

ROOT = pathlib.Path(__file__).resolve().parent.parent
LIB = ROOT / "library"


def slug(s):   # same as slug() in panel/js/app.js
    return re.sub(r"^-|-$", "", re.sub(r"[^a-z0-9]+", "-", s.lower().replace("__", "-")))


def load(name, key):
    p = LIB / name
    return json.loads(p.read_text(encoding="utf-8")).get(key, []) if p.exists() else []


def missing():
    out = []
    for p in load("library.json", "presets"):
        for rel in (f"thumbs/{p['kind']}/{p['slug']}.png", f"gifs/{p['kind']}/{p['slug']}.gif"):
            if not (LIB / rel).exists():
                out.append(("preset", p["name"], rel))
    for r in load("recipes.json", "recipes"):
        s = slug(r["id"])
        for rel in (f"thumbs/recipe/{s}.png", f"gifs/recipe/{s}.gif"):
            if not (LIB / rel).exists():
                out.append(("recipe", r["id"], rel))
    for pk in load("packs.json", "packs"):
        for rel in (f"packs/{pk['slug']}_md.png", f"packs/{pk['slug']}.gif"):
            if not (LIB / rel).exists():
                out.append(("style", pk["name"], rel))
    for t in load("techniques.json", "techniques"):
        s = slug(t["name"])
        if not any((LIB / f"techniques/{s}{e}").exists() for e in ("_card.png", "_md.png")):
            out.append(("technique", t["name"], f"techniques/{s}_card.png"))
    return out


HOW = {"preset": "run the library pipeline (CONTRIBUTING §1)", "recipe": "run the library pipeline (CONTRIBUTING §1)",
       "style": "tools/pack_demos.jsx (CONTRIBUTING §3)", "technique": "python tools/technique_cards.py"}

if __name__ == "__main__":
    miss = missing()
    if not miss:
        print("OK every preset, recipe, style and technique has its preview")
        sys.exit(0)
    for kind, name, rel in miss:
        print(f"MISSING {kind} '{name}': library/{rel}  → {HOW[kind]}")
    sys.exit(1)
