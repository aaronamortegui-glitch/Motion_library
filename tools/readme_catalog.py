"""Writes the full preset catalog into docs/CATALOG.md between <!-- catalog:start --> and <!-- catalog:end -->
(the README stays short and links to it; image paths are relative to docs/).

Source of truth: library/library.json (motion, text, fx), library/recipes.json (recipes), library/packs.json (styles),
library/kit.json and library/transitions.json (the kit Claude builds through MCP; GIFs from tools/kit_gifs.py).
Run after growing the library:  python tools/readme_catalog.py
"""
import json
import pathlib
import re

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
    # the kit: one row per family (library/kit_groups.json), a still of its first piece and its variants as text
    kit = json.loads((ROOT / "library/kit.json").read_text(encoding="utf-8"))["items"]
    tr = json.loads((ROOT / "library/transitions.json").read_text(encoding="utf-8"))["transitions"]
    fams = json.loads((ROOT / "library/kit_groups.json").read_text(encoding="utf-8"))["groups"]
    byk = {(x["kind"], x["name"]): x for x in kit}
    byk.update({("transition", x["name"]): dict(x, call=f'solid_transition(look="{x["name"]}")') for x in tr})
    def sl(n): return re.sub(r"[^a-z0-9]+", "-", n.lower()).strip("-")
    n_kit = len(byk)
    blocks.append(f"## The kit ({n_kit} pieces in {len(fams)} families)\n\nBuilt by Claude on the open comp through the MCP server, on the same token curves. "
                  "One row per family: a still of its first piece and every variant by name (ask for any of them in the chat; `list_kit` shows energy "
                  "and tones). Moving previews: hover a card in `library/index.html` or open *Agent › Library › Kit* in the panel.\n")
    cats = []
    for g in fams:
        if g["category"] not in cats: cats.append(g["category"])
    for cat in cats:
        rows = ["| | Family | Variants (ask for them by name) |", "|---|---|---|"]
        for g in [x for x in fams if x["category"] == cat]:
            m0 = g["members"][0]; it = byk[(m0["kind"], m0["name"])]
            img = f"<img src=\"{UP}library/gifs/kit-{m0['kind']}/{sl(m0['name'])}_md.png\" width=\"160\">"
            names = " · ".join(f"`{m['name']}`" for m in g["members"])
            rows.append(f"| {img} | **{g['name']}**<br><sub>{g['desc']}</sub><br><sub>`{it['call']}`</sub> | {names} |")
        blocks.append(f"### {cat} ({sum(len(x['members']) for x in fams if x['category'] == cat)})\n\n" + "\n".join(rows) + "\n")
    body = "\n".join(blocks)
    s = README.read_text(encoding="utf-8")
    a, b = "<!-- catalog:start -->", "<!-- catalog:end -->"
    if a not in s or b not in s:
        raise SystemExit("docs/CATALOG.md is missing the catalog markers")
    s = s[: s.index(a) + len(a)] + "\n" + body + s[s.index(b):]
    README.write_text(s, encoding="utf-8")
    print(f"catalog: {total} presets + {n_kit} kit pieces")


if __name__ == "__main__":
    main()
