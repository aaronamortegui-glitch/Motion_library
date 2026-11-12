"""Scaffold a Motion Deck folder from this kit.

Usage: python new_deck.py <folder> --title "Deck name"
Copies the engine (deck.src.html), palette.py, build.py, media.py, qa_snippet.js and the fonts into <folder>, fills in
the title and writes an empty media.json. Never overwrites an existing deck.src.html.
Next: python palette.py --pptx source.pptx (or --image / --colors / --preset superside), list media, build.
"""
import json, shutil, sys
from pathlib import Path

KIT = Path(__file__).parent
args = sys.argv[1:]
if not args or args[0].startswith("-"):
    raise SystemExit(__doc__)
dst = Path(args[0])
title = args[args.index("--title") + 1] if "--title" in args else "Presentation"

dst.mkdir(parents=True, exist_ok=True)
page = dst / "deck.src.html"
if page.exists():
    raise SystemExit(f"{page} exists: not overwritten")
page.write_text((KIT / "deck.src.html").read_text(encoding="utf-8").replace("__TITLE__", title), encoding="utf-8")
for f in ("palette.py", "build.py", "media.py", "qa_snippet.js"):
    shutil.copy(KIT / f, dst / f)
shutil.copytree(KIT / "fonts", dst / "fonts", dirs_exist_ok=True)
(dst / "assets").mkdir(exist_ok=True)
if not (dst / "media.json").exists():
    (dst / "media.json").write_text(json.dumps({"films": [], "loops": [], "stills": []}, indent=2), encoding="utf-8")
print(f"Deck scaffolded in {dst}\n  1. python palette.py --pptx <source.pptx>   (or --image, --colors, --preset superside)\n"
      f"  2. list media in media.json, then python media.py   (and --lite for email)\n"
      f"  3. write the slides in deck.src.html\n  4. python build.py   (and --lite)")
