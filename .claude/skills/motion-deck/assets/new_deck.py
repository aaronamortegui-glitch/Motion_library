"""Scaffold a Motion Deck folder from this kit.

Usage: python new_deck.py <folder> --title "Deck name" [--theme light|dark] [--mono AB]
Copies the engine (deck.src.html), build.py, media.py and the fonts into <folder>, fills in the title, the theme and
the monogram of the menu mark, and writes an empty media.json. Never overwrites an existing deck.src.html.
"""
import json, re, shutil, sys
from pathlib import Path

KIT = Path(__file__).parent
args = sys.argv[1:]
if not args or args[0].startswith("-"):
    raise SystemExit(__doc__)
dst = Path(args[0])
def opt(name, default):
    return args[args.index(name) + 1] if name in args else default
title, theme = opt("--title", "Presentation"), opt("--theme", "light")
mono = opt("--mono", "".join(w[0] for w in re.findall(r"[A-Za-z0-9]+", title)[:2]).upper() or "MD")

dst.mkdir(parents=True, exist_ok=True)
page = dst / "deck.src.html"
if page.exists():
    raise SystemExit(f"{page} exists: not overwritten")
html = (KIT / "deck.src.html").read_text(encoding="utf-8")
html = html.replace("__TITLE__", title).replace("__MONO__", mono).replace('data-theme="light"', f'data-theme="{theme}"', 1)
page.write_text(html, encoding="utf-8")
for f in ("build.py", "media.py", "qa_snippet.js"):
    shutil.copy(KIT / f, dst / f)
shutil.copytree(KIT / "fonts", dst / "fonts", dirs_exist_ok=True)
(dst / "assets").mkdir(exist_ok=True)
if not (dst / "media.json").exists():
    (dst / "media.json").write_text(json.dumps({"films": [], "loops": [], "stills": []}, indent=2), encoding="utf-8")
print(f"Deck scaffolded in {dst}\n  1. list media in media.json, run: python media.py   (and --lite for email)\n"
      f"  2. write the slides in deck.src.html\n  3. python build.py   (and --lite)")
