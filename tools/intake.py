"""Reads a request the way a motion designer would before building: what kind of piece it is, which of our templates,
techniques, styles and characters fit, what is still unknown, and which few questions to ask. Data: library/intake.json.

  python tools/intake.py "quiero un video para lanzar nuestra app de recetas"     # the brief, as text
  python tools/intake.py "..." --project D:/work/vela-launch                     # ranks what this project already used lower
  python tools/intake.py --project D:/work/vela-launch --chose t02_saas_launch,pack_playful   # record what was built
  add --json for the raw result. The MCP tool read_brief calls read_brief() below.

A precise order ("apply Land to the selected layers") is "direct": no questions, just do it. An open request ("I want a
video for…") gets candidates from different kinds, 2-3 routes to propose, and only the questions it leaves open.
"""
import json
import pathlib
import re
import sys
import unicodedata

ROOT = pathlib.Path(__file__).resolve().parent.parent
DATA = ROOT / "library" / "intake.json"

DIRECT = r"^(apply|aplica|aplicar|add|agrega|agregar|anade|pon|ponle|put|change|cambia|cambiar|remove|quita|quitar|delete|borra|render|renderiza|resize|retime|stagger|mirror|move|mueve|bake|copy|copia|set|ajusta|make (it|this|the) (slower|faster|bigger|smaller)|hazlo mas)\b"
OPEN = r"\b(video|videos|clip|reel|piece|pieza|spot|anuncio|ad|film|pelicula|animacion|animation|quiero|necesito|want|need|make me|hazme|haz un|haz una|crea|create|idea|ideas|propuesta|pitch|campaign|campana)\b"
SELECTION = r"\b(selected|seleccionad[oa]s?|these layers|estas capas|this layer|esta capa)\b"
ENERGY_WORDS = {1: ["calm", "calmado", "tranquilo", "suave", "soft", "serene", "sereno"], 2: ["premium", "elegant", "elegante", "minimal", "minimalista", "luxury", "lujo"],
                3: ["clear", "claro", "modern", "moderno", "corporate", "corporativo", "professional", "profesional"],
                4: ["dynamic", "dinamico", "energetic", "energetico", "punchy", "bold", "fun", "divertido", "playful", "jugueton"],
                5: ["explosive", "explosivo", "hype", "epic", "epico", "crazy", "loco", "intense", "intenso"]}
ASSET_WORDS = {"logo": ["logo"], "screenshots": ["screenshot", "screenshots", "captura", "capturas", "pantallas", "screens", "mockup", "figma"],
               "footage": ["footage", "clip", "clips", "grabacion", "grabaciones", "video de", "videos de", "filmamos", "shot"],
               "voiceover": ["voz", "voiceover", "voice over", "locucion", "narracion", "guion", "script"], "music": ["musica", "music", "cancion", "song", "track"],
               "character": ["personaje", "character", "mascota", "mascot", "robot"], "data": ["datos", "data", "numeros", "numbers", "cifras", "stats"],
               "copy": ["texto", "frase", "titulo", "title", "headline", "copy", "slogan", "tagline"], "figma": ["figma"]}
KIND_ORDER = ["template", "technique", "character", "style", "kit", "tool"]


def norm(s):
    s = unicodedata.normalize("NFKD", str(s).lower())
    return "".join(c for c in s if not unicodedata.combining(c))


def has(text, phrase):
    p = norm(phrase)
    if " " in p or not p.isalnum():
        return p in text
    return re.search(r"\b" + re.escape(p) + r"\b", text) is not None


def history_file(project_dir):
    return pathlib.Path(project_dir) / "claude" / "intake_history.json"


def load_history(project_dir):
    if not project_dir:
        return {}
    try:
        used = json.loads(history_file(project_dir).read_text(encoding="utf-8")).get("used", [])
    except (OSError, ValueError):
        return {}
    counts = {}
    for u in used:
        counts[u] = counts.get(u, 0) + 1
    return counts


def record(project_dir, ids):
    f = history_file(project_dir)
    try:
        data = json.loads(f.read_text(encoding="utf-8"))
    except (OSError, ValueError):
        data = {"used": []}
    data["used"] = (data.get("used", []) + [i for i in ids if i])[-200:]
    f.parent.mkdir(parents=True, exist_ok=True)
    f.write_text(json.dumps(data, indent=1) + "\n", encoding="utf-8")
    return data["used"]


def read_brief(text, project_dir=None, data=None):
    D = data or json.loads(DATA.read_text(encoding="utf-8"))
    t = norm(text)
    # what the request already tells us
    energy = [lvl for lvl, ws in ENERGY_WORDS.items() if any(has(t, w) for w in ws)]
    assets = sorted(a for a, ws in ASSET_WORDS.items() if any(has(t, w) for w in ws))
    if re.search(r"\b(no tengo|nothing yet|no assets|sin nada|desde cero|from scratch)\b", t):
        assets.append("none")
    length = re.search(D["questions"]["length"]["found_regex"], t)
    direct = bool(re.search(DIRECT, t.strip())) or (bool(re.search(SELECTION, t)) and not re.search(r"\b(video|reel|anuncio|ad)\b", t))
    is_open = bool(re.search(OPEN, t))
    mode = "direct" if direct and not (is_open and re.search(r"\b(quiero|necesito|want|need|hazme|make me)\b", t)) else "open"

    used = load_history(project_dir)
    scored = []
    for e in D["entries"]:
        hits = [w for lang in ("en", "es") for w in e["triggers"].get(lang, []) if has(t, w)]
        s = sum(3 if " " in w else 2 for w in set(hits))
        if not s:
            continue
        lo, hi = e.get("energy", [1, 5])
        if energy:
            s += 1 if any(lo <= x <= hi for x in energy) else -2
        need = [n for n in e.get("needs", []) if n not in ("copy", "script", "dates", "consent")]
        if need and all(n in assets for n in need):
            s += 1
        s -= 2 * used.get(e["id"], 0)
        scored.append({"id": e["id"], "kind": e["kind"], "title": e["title"], "score": s, "hits": sorted(set(hits)), "how": e.get("how", ""),
                       "needs": e.get("needs", []), "missing": [n for n in e.get("needs", []) if n not in assets], "used_before": used.get(e["id"], 0)})
    scored.sort(key=lambda c: (-c["score"], KIND_ORDER.index(c["kind"])))
    # candidates from different kinds: at most two of each, five in all
    cands, per = [], {}
    for c in scored:
        if per.get(c["kind"], 0) < 2 and len(cands) < 5:
            cands.append(c); per[c["kind"]] = per.get(c["kind"], 0) + 1
    fallback = not cands and mode == "open"
    if fallback:   # nothing specific matched: start from the safe all-rounders, still asking first
        pick = {"t05_kinetic_type", "t02_saas_launch", "t06_storybook_explainer", "pack_modern", "tech_styles"}
        cands = [{"id": e["id"], "kind": e["kind"], "title": e["title"], "score": 0, "hits": [], "how": e.get("how", ""), "needs": e.get("needs", []),
                  "missing": [n for n in e.get("needs", []) if n not in assets], "used_before": used.get(e["id"], 0)} for e in D["entries"] if e["id"] in pick]

    # routes: three different main pieces (a template, technique or kit family), each with the style that fits best and
    # the character if one was asked for. Few matches? Fill with pieces of the same kind of video (shared domain), ranked
    # by what the user can make with what they already have and by what this project has not used yet: never the same.
    styles = [c for c in scored if c["kind"] == "style"]
    if not styles and energy:
        lvl = round(sum(energy) / len(energy))
        styles = [{"id": e["id"], "title": e["title"]} for e in D["entries"] if e["kind"] == "style" and e["energy"][0] <= lvl <= e["energy"][1]][:1]
    chars = [c for c in scored if c["kind"] == "character"]
    MAIN = ("template", "technique", "kit")
    mains = [c for c in (scored if not fallback else cands) if c["kind"] in MAIN][:3]
    if mode == "open" and mains and len(mains) < 3:
        doms = {d for m in mains for e in D["entries"] if e["id"] == m["id"] for d in e.get("domain", [])}
        have = set(mains[i]["id"] for i in range(len(mains)))
        def fit(e):
            need = [n for n in e.get("needs", []) if n not in ("copy", "script", "dates", "consent")]
            lo, hi = e.get("energy", [1, 5])
            return ((2 if need and all(n in assets for n in need) else 0) - (1 if any(n not in assets for n in need) else 0)
                    - 2 * used.get(e["id"], 0) + (1 if energy and any(lo <= x <= hi for x in energy) else 0) - (2 if energy and not any(lo <= x <= hi for x in energy) else 0))
        extra = sorted((e for e in D["entries"] if e["kind"] in MAIN and e["id"] not in have and doms & set(e.get("domain", []))), key=lambda e: -fit(e))
        for e in extra[:3 - len(mains)]:
            mains.append({"id": e["id"], "title": e["title"], "how": e.get("how", ""), "missing": [n for n in e.get("needs", []) if n not in assets], "related": True})
    mains.sort(key=lambda m: used.get(m["id"], 0) > 0)   # what this project already made goes last
    routes = [{"main": m["id"], "title": m["title"], "style": styles[0]["id"] if styles else None, "character": chars[0]["id"] if chars else None,
               "how": m["how"], "needs": m["missing"], "related": bool(m.get("related"))} for m in mains]

    # only the questions the request leaves open (none for a direct order), at most four
    ask = []
    if mode == "open":
        Q = D["questions"]
        found = {"purpose": any(has(t, w) for w in Q["purpose"]["found"]), "length": bool(length), "assets": bool(assets),
                 "energy": bool(energy), "message": bool(re.search(Q["message"]["found_regex"], text))}
        needs_copy = any(n in ("copy", "script") for c in cands for n in c["needs"])
        for k in ["purpose", "assets", "length", "energy", "message"]:
            if found[k] or (k == "message" and not needs_copy):
                continue
            q = Q[k]; ask.append({"key": k, "ask": q["ask"], "options": q["options"], "multi": bool(q.get("multi"))})
        ask = ask[:4]
    return {"mode": mode, "found": {"energy": energy, "assets": assets, "length": length.group(0) if length else None},
            "candidates": cands, "routes": routes, "ask": ask, "fallback": fallback, "history": used}


def as_text(r):
    if r["mode"] == "direct":
        return "Direct order: do it now with the matching tool (no questions)." + (
            "\nPossibly related: " + ", ".join(f"{c['title']} ({c['id']})" for c in r["candidates"][:3]) if r["candidates"] else "")
    out = ["Open request: ask first, then propose routes, build the one chosen."]
    f = r["found"]
    out.append("Already known: " + (", ".join(filter(None, [f"energy {f['energy']}" if f["energy"] else "", "assets: " + ", ".join(f["assets"]) if f["assets"] else "",
                                                          f"length {f['length']}" if f["length"] else ""])) or "nothing beyond the topic"))
    out.append(("Nothing specific matched; safe starting points:" if r["fallback"] else "Fits (different kinds):"))
    for c in r["candidates"]:
        extra = (f" · needs {', '.join(c['missing'])}" if c["missing"] else "") + (f" · used {c['used_before']}x in this project" if c["used_before"] else "")
        out.append(f"  - [{c['kind']}] {c['title']} ({c['id']}) — {c['how']}" + (f" · matched: {', '.join(c['hits'][:4])}" if c["hits"] else "") + extra)
    if r["routes"]:
        out.append("Routes to propose (2-3, in plain words):")
        for i, rt in enumerate(r["routes"]):
            out.append(f"  {'ABC'[i]}. {rt['title']}" + (f" with {rt['character'].replace('char_', '')}" if rt["character"] else "")
                       + (f" in the {rt['style'].replace('pack_', '')} style" if rt["style"] else "") + (f" (needs {', '.join(rt['needs'])})" if rt["needs"] else "")
                       + (" · same kind of video, not asked by name" if rt["related"] else ""))
        if not any(rt["style"] for rt in r["routes"]):
            out.append("  (No feel given: the energy question picks the style.)")
    if r["ask"]:
        out.append("Ask (short, with options; skip what the user already answered):")
        for q in r["ask"]:
            out.append(f"  - {q['ask']}" + (f" Options{' (several)' if q['multi'] else ''}: " + " / ".join(q["options"]) if q["options"] else ""))
    out.append("After the user picks: read_brief(project_dir=…, chose=[ids]) so the next brief offers something different.")
    return "\n".join(out)


def main():
    args = sys.argv[1:]
    for s in (sys.stdout, sys.stderr):
        try: s.reconfigure(encoding="utf-8", errors="replace")
        except Exception: pass
    proj = args[args.index("--project") + 1] if "--project" in args else None
    chose = args[args.index("--chose") + 1].split(",") if "--chose" in args else None
    if chose:
        if not proj:
            sys.exit("--chose needs --project")
        print("recorded:", record(proj, chose)); return
    words = [a for i, a in enumerate(args) if not a.startswith("--") and (i == 0 or args[i - 1] not in ("--project", "--chose"))]
    r = read_brief(" ".join(words), proj)
    print(json.dumps(r, indent=1, ensure_ascii=False) if "--json" in args else as_text(r))


if __name__ == "__main__":
    main()
