"""Lists every library item whose preview or registration is missing, the way the panel looks for it (panel/js/app.js,
agent.js): presets (thumbs/ + gifs/), recipes, styles (packs/<slug>_md.png + .gif), techniques (techniques/<slug>_card.png
or _md.png, and its tags in tools/tag_library.py) and the kit (library/kit.json + transitions.json: gifs/kit-<kind>/<slug>.gif
and _md.png, energy, tones, use and call, and the name in the README kit table). This is the gate of the protocol for
feeding the plugin (CONTRIBUTING §11): a new piece is not done until it passes here.
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
    tag_src = (ROOT / "tools/tag_library.py").read_text(encoding="utf-8")
    for t in load("techniques.json", "techniques"):
        if f'"{t["name"]}":' not in tag_src:
            out.append(("tags", t["name"], "TECH in tools/tag_library.py"))
    readme = (ROOT / "README.md").read_text(encoding="utf-8")
    kit = [(x["kind"], x) for x in load("kit.json", "items")] + [("transition", x) for x in load("transitions.json", "transitions")]
    for kind, x in kit:
        s_ = re.sub(r"[^a-z0-9]+", "-", x["name"].lower()).strip("-")
        for rel in (f"gifs/kit-{kind}/{s_}.gif", f"gifs/kit-{kind}/{s_}_md.png"):
            if not (LIB / rel).exists():
                out.append(("kit", x["name"], rel))
        for field in ("energy", "tones", "use"):
            if not x.get(field):
                out.append(("kit-tags", x["name"], f"'{field}' in library/{'transitions' if kind == 'transition' else 'kit'}.json"))
        if kind != "transition" and not x.get("call"):
            out.append(("kit-tags", x["name"], "'call' in library/kit.json"))
        if f"`{x['name']}`" not in readme:
            out.append(("readme", x["name"], "README.md › The kit table"))
    groups = load("kit_groups.json", "groups")
    member = [(m["kind"], m["name"]) for g in groups for m in g["members"]]
    for kind, x in kit:
        n = member.count((kind, x["name"]))
        if n != 1:
            out.append(("family", x["name"], f"library/kit_groups.json ({'in no family' if n == 0 else 'in %d families' % n})"))
    return out


HOW = {"tags": "add it to TECH and run python tools/tag_library.py", "kit": "NAMES=\"<name>\" python tools/kit_gifs.py all",
       "kit-tags": "fill the entry (CONTRIBUTING §11)", "readme": "add it to the README kit table (CONTRIBUTING §11)", "family": "put it in exactly one family in library/kit_groups.json", "preset": "run the library pipeline (CONTRIBUTING §1)", "recipe": "run the library pipeline (CONTRIBUTING §1)",
       "style": "tools/pack_demos.jsx (CONTRIBUTING §3)", "technique": "python tools/technique_cards.py"}

if __name__ == "__main__":
    miss = missing()
    if not miss:
        print("OK every preset, recipe, style, technique and kit piece has its preview and its registration")
        sys.exit(0)
    for kind, name, rel in miss:
        print(f"MISSING {kind} '{name}': library/{rel}  → {HOW[kind]}")
    sys.exit(1)
