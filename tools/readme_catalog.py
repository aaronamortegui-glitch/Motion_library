"""Writes the full preset catalog into docs/CATALOG.md between <!-- catalog:start --> and <!-- catalog:end -->
(the README stays short and links to it; image paths are relative to docs/).

Source of truth: library/library.json (motion, text, fx) and library/recipes.json (recipes).
Run after growing the library:  python tools/readme_catalog.py
"""
import json
import pathlib

ROOT = pathlib.Path(__file__).resolve().parent.parent
README = ROOT / "docs" / "CATALOG.md"   # the catalog page (README links to it)
UP = "../"                              # image paths from docs/
COLS = 4
ENERGY = {"s": "soft", "m": "medium", "d": "dynamic"}
SECTIONS = [
    ("motion", "Motion", "Entrances and exits for any layer. `SSP.apply(layer, name, \"in\" | \"out\" | \"both\")`"),
    ("classic", "Classics", "Effects adapted from animate.css 4.1.1 (MIT) into native keyframes: entrances, exits and attention moves. Same call as Motion."),
    ("text", "Text", "Per character or per word, on text layers. `SSP.applyText(layer, name, \"in\" | \"out\" | \"both\")`"),
    ("fx", "Effects", "Continuous loops driven by expressions. `SSP.applyFx(layer, name)`"),
    ("recipe", "Recipes", "Behavior measured from reference animations and rebuilt with our own keyframes. `SSP.applyRecipe(layer, id, \"both\")`"),
]


def cell(gif, title, energy, use):
    return f"<img src=\"{UP}{gif}\" width=\"200\"><br>**{title}** · `{energy}`<br><sub>{use}</sub>"


def table(cells):
    rows = [cells[i:i + COLS] for i in range(0, len(cells), COLS)]
    out = ["| " + " | ".join([" "] * COLS) + " |", "|" + "---|" * COLS]
    for r in rows:
        out.append("| " + " | ".join(r + [" "] * (COLS - len(r))) + " |")
    return "\n".join(out)


def main():
    lib = json.loads((ROOT / "library/library.json").read_text(encoding="utf-8"))["presets"]
    recipes = json.loads((ROOT / "library/recipes.json").read_text(encoding="utf-8"))
    recipes = recipes.get("recipes", []) if isinstance(recipes, dict) else recipes
    blocks = []
    total = len(lib) + len(recipes)
    blocks.append(f"**{total} presets** in 5 categories, plus style packs. Every one is also listed in `library/INDEX.txt` (for LLMs) and `library/index.html` (for people).\n")
    for kind, title, blurb in SECTIONS:
        if kind == "recipe":
            cells = []
            for r in recipes:
                slug = r["id"].replace("__", "-").replace("+", "-").lower()
                gif = f"library/gifs/recipe/{slug}.gif"
                if not (ROOT / gif).exists():
                    continue
                chans = " & ".join(r.get("channels", []))
                style = "loop" if "loop" in r.get("phases", {}) else "transition"
                cells.append(cell(gif, r.get("name") or r["code"], ENERGY.get(r.get("energy"), r.get("energy", "")), f"{chans} · {style}"))
        else:
            if kind == "classic":
                cells = [cell("library/" + p["gif"], p["name"], p["energy"], p["use"]) for p in lib if p.get("family") == "classic"]
            else:
                cells = [cell("library/" + p["gif"], p["name"], p["energy"], p["use"]) for p in lib if p["kind"] == kind and p.get("family", "own") != "classic"]
        blocks.append(f"### {title} ({len(cells)})\n\n{blurb}\n\n{table(cells)}\n")
    packs = json.loads((ROOT / "library/packs.json").read_text(encoding="utf-8"))["packs"]
    pc = [f"<img src=\"{UP}library/packs/{p['slug']}.gif\" width=\"260\"><br>**{p['name']}** · `{p['energy']}`<br><sub>{p['desc']}</sub>" for p in packs]
    blocks.append(f"### Packs ({len(packs)})\n\nOne click gives a whole comp an identity: each layer gets the preset of its role "
                  "(title, subtitle, body, shape, media, logo), staggered. `SSP.applyPack(comp, name)`\n\n" + table(pc) + "\n")
    body = "\n".join(blocks)
    s = README.read_text(encoding="utf-8")
    a, b = "<!-- catalog:start -->", "<!-- catalog:end -->"
    if a not in s or b not in s:
        raise SystemExit("docs/CATALOG.md is missing the catalog markers")
    s = s[: s.index(a) + len(a)] + "\n" + body + s[s.index(b):]
    README.write_text(s, encoding="utf-8")
    print(f"catalog: {total} presets")


if __name__ == "__main__":
    main()
