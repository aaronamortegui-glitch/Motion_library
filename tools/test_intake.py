"""Tests for tools/intake.py (read_brief): direct vs open requests, candidates, routes, questions and project history.
Usage: python tools/test_intake.py
"""
import json
import pathlib
import sys
import tempfile

sys.path.insert(0, str(pathlib.Path(__file__).resolve().parent))
import intake  # noqa: E402

FAIL = []


def check(name, cond, info=""):
    print(("PASS " if cond else "FAIL ") + name + ("" if cond else f"  ({info})"))
    if not cond:
        FAIL.append(name)


ids = lambda r: [c["id"] for c in r["candidates"]]
routes = lambda r: [x["main"] for x in r["routes"]]
asks = lambda r: [q["key"] for q in r["ask"]]

# the data file is valid and every entry is complete
D = json.loads(intake.DATA.read_text(encoding="utf-8"))
keys = {"id", "kind", "title", "domain", "on_screen", "needs", "energy", "triggers", "how"}
check("every intake entry has its fields", all(keys <= set(e) for e in D["entries"]), [e["id"] for e in D["entries"] if not keys <= set(e)])
check("intake ids are unique", len({e["id"] for e in D["entries"]}) == len(D["entries"]))
check("every template in the catalog has an intake entry",
      {t["id"] for t in json.loads((intake.ROOT / "research/video_prompts/templates/catalog.json").read_text(encoding="utf-8"))["templates"]} <= {e["id"] for e in D["entries"]})
check("every character has an intake entry",
      {"char_" + p.name for p in (intake.ROOT / "library/characters").iterdir() if (p / "character.json").exists()} <= {e["id"] for e in D["entries"]})

r = intake.read_brief("aplica Land a las capas seleccionadas")
check("a precise order is direct, with no questions", r["mode"] == "direct" and not r["ask"], r)
r = intake.read_brief("apply Pop to the selected layers")
check("a precise order in English is direct", r["mode"] == "direct" and not r["ask"], r)

r = intake.read_brief("quiero un video para lanzar nuestra app de recetas")
check("a launch request is open and proposes the launch film", r["mode"] == "open" and "t02_saas_launch" in ids(r), ids(r))
check("an open request gets three routes", len(r["routes"]) == 3, routes(r))
check("an open request asks what is missing (purpose, assets, length, energy)", asks(r) == ["purpose", "assets", "length", "energy"], asks(r))
check("no style is invented when no feel was given", all(x["style"] is None for x in r["routes"]), r["routes"])

r = intake.read_brief("Necesito un reel dinámico de 15 s con el logo y footage del evento")
check("what the request says is not asked again", not {"length", "energy", "assets"} & set(asks(r)), asks(r))
check("energy, length and assets are read", r["found"]["energy"] == [4] and r["found"]["length"] and {"logo", "footage"} <= set(r["found"]["assets"]), r["found"])
check("a footage request is offered a footage technique", any(m.startswith("tech_") for m in routes(r)), routes(r))
check("the dynamic style is used", all(x["style"] == "pack_dynamic" for x in r["routes"]), r["routes"])

r = intake.read_brief("hazme algo con nuestro robot en pixel para explicar como funciona el plugin")
check("a character request brings the character into the routes", all(x["character"] == "char_the-agent" for x in r["routes"]) and "t14_pixel_character" in routes(r), r["routes"])
check("a character is not a route of its own", "char_the-agent" not in routes(r), routes(r))

r = intake.read_brief("I want a calm premium video about our numbers this year")
check("English works and calm maps to a calm style", "t08_data_story" in ids(r) and r["routes"][0]["style"] == "pack_calm-modern", r["routes"])

r = intake.read_brief("algo bonito")
check("nothing specific: safe starting points and questions", r["fallback"] and len(r["candidates"]) >= 3 and r["ask"], r)

with tempfile.TemporaryDirectory() as d:
    intake.record(d, ["t02_saas_launch"])
    r = intake.read_brief("quiero un video para lanzar nuestra app", d)
    check("what the project already made goes last", routes(r)[-1] == "t02_saas_launch" and routes(r)[0] != "t02_saas_launch", routes(r))
    check("history is read from <project>/claude/intake_history.json", (pathlib.Path(d) / "claude" / "intake_history.json").exists())

print("\nall passed" if not FAIL else f"\n{len(FAIL)} failed")
sys.exit(1 if FAIL else 0)
