"""Brand profiles: a custom style per brand or project that learns from every review.

Where brands live (the repo is shared, client data never goes in it):
  library/brands/<slug>/        TEMPLATES only (e.g. motion-dna), committed; anything else there is git-ignored
  library/brands.local/<slug>/  your brands, on this machine (git-ignored): the default for new brands
  any folder you choose         listed in library/brands.local/_registry.json (e.g. the client's project drive)
Each brand folder holds brand.json (schema: library/brands/_schema.md) and thumb.png (the panel card).
Brands are independent: each one grows its own rules. Claude reads a brand before animating for it (MCP get_brand) and
records every new review note in it (MCP add_brand_note), so the next piece starts where the last one ended.
To share a brand, export it to one file and import it on the other machine: the rules merge (new, edited and removed
rules travel, nothing is overwritten blindly) and the ones that came in show as new in the panel.

  python tools/brand.py list
  python tools/brand.py show <slug>                       # the digest Claude follows (markdown)
  python tools/brand.py new <slug> --name "Acme" --style Modern --curve Coast --tones modern,corporate --energy 2,3
                                                          # [--dir <folder>] to keep it outside the plugin folder
  python tools/brand.py note <slug> "Labels go into the negative space" --cat layout --why "..." --project promo --by Aaron
  python tools/brand.py export <slug> [file]              # one shareable file: <slug>.motiondna-brand.json
  python tools/brand.py import <file>                     # adds the brand, or merges it into yours
  python tools/brand.py thumb <slug>                      # panel card from the logo, colours and name
"""
import argparse
import base64
import datetime
import hashlib
import json
import pathlib
import secrets
import subprocess
import sys

ROOT = pathlib.Path(__file__).resolve().parent.parent
BRANDS = ROOT / "library" / "brands"            # templates (repo)
LOCAL = ROOT / "library" / "brands.local"       # this machine's brands (git-ignored)
REGISTRY = LOCAL / "_registry.json"             # brands kept in other folders
CATEGORIES = ["layout", "typography", "motion", "effects", "color", "audio", "edit", "process"]


def today():
    return str(datetime.date.today())


def registry():
    try:
        return json.loads(REGISTRY.read_text(encoding="utf-8")).get("external", [])
    except (OSError, ValueError):
        return []


def register(folder):
    ext, f = registry(), str(pathlib.Path(folder).resolve()).replace("\\", "/")
    if f not in ext:
        LOCAL.mkdir(parents=True, exist_ok=True)
        REGISTRY.write_text(json.dumps({"external": ext + [f]}, indent=1) + "\n", encoding="utf-8")


def folders():
    """Every brand folder in priority order: a slug found twice resolves to your copy, not the template."""
    out = [(d, "local") for d in sorted(LOCAL.glob("*")) if (d / "brand.json").exists()]
    out += [(pathlib.Path(e), "external") for e in registry() if (pathlib.Path(e) / "brand.json").exists()]
    out += [(d, "template") for d in sorted(BRANDS.glob("*")) if (d / "brand.json").exists()]
    return out


def where(slug):
    for d, kind in folders():
        try:
            if d.name == slug or json.loads((d / "brand.json").read_text(encoding="utf-8")).get("slug") == slug:
                return d, kind
        except ValueError:
            continue
    return None, None


def path(slug):
    d, _ = where(slug)
    return (d or LOCAL / slug) / "brand.json"


def load(slug):
    p = path(slug)
    if not p.exists():
        raise SystemExit(f"brand '{slug}' not found (python tools/brand.py list)")
    return json.loads(p.read_text(encoding="utf-8"))


def save(b, folder=None):
    p = (pathlib.Path(folder) / "brand.json") if folder else path(b["slug"])
    p.parent.mkdir(parents=True, exist_ok=True)
    b = {k: v for k, v in b.items() if not k.startswith("_")}
    p.write_text(json.dumps(b, indent=1, ensure_ascii=False) + "\n", encoding="utf-8")
    return p


def all_brands():
    seen, out = set(), []
    for d, kind in folders():
        b = json.loads((d / "brand.json").read_text(encoding="utf-8"))
        if b["slug"] in seen:
            continue
        seen.add(b["slug"]); b["_where"] = kind; b["_dir"] = str(d).replace("\\", "/"); out.append(b)
    return out


def rule_uid(r):
    """Rules carry a uid so edits and removals travel when a brand is shared; older rules get one from their text."""
    if not r.get("uid"):
        r["uid"] = hashlib.sha1(r["rule"].strip().lower().encode("utf-8")).hexdigest()[:8]
    return r["uid"]


def new(slug, name, style="Modern", curve=None, tones=(), energy=(2, 3), by="", folder=None):
    if where(slug)[0]:
        raise SystemExit(f"brand '{slug}' already exists")
    b = {"name": name, "slug": slug, "created": today(), "by": by,
         "identity": {"colors": {}, "fonts": {}, "logo": ""},
         "feel": {"energy": list(energy), "tones": list(tones), "style": style, "curve": curve, "transition": None},
         "presets": {"prefer": {}, "avoid": []}, "motion": {"curves": [], "timing": []},
         "rules": [], "removed": [], "projects": []}
    save(b, folder or LOCAL / slug)
    if folder:
        register(folder)
    return b


def note(slug, rule, cat="layout", why="", project="", by=""):
    if cat not in CATEGORIES:
        raise SystemExit(f"category must be one of {', '.join(CATEGORIES)}")
    b = load(slug)
    for r in b["rules"]:   # the same rule twice only refreshes its source
        if r["rule"].strip().lower() == rule.strip().lower():
            r["source"] = {"project": project, "date": today(), "by": by}
            save(b); return r
    r = {"id": max([x["id"] for x in b["rules"]] or [0]) + 1, "uid": secrets.token_hex(4), "category": cat, "rule": rule,
         "why": why, "updated": today(), "source": {"project": project, "date": today(), "by": by}}
    b["rules"].append(r)
    save(b)
    return r


def digest(slug):
    """What Claude follows when it animates for this brand."""
    b = load(slug); f, i = b["feel"], b["identity"]
    out = [f"# Brand: {b['name']} ({b['slug']})",
           f"Feel: energy {f['energy'][0]}-{f['energy'][1]}, tones {', '.join(f['tones']) or '-'}; base style **{f['style']}**"
           + (f", curve **{f['curve']}**" if f.get("curve") else "") + (f", transition {f['transition']}" if f.get("transition") else "")]
    if i.get("colors"):
        out.append("Colours: " + ", ".join(f"{k} {v}" for k, v in i["colors"].items()))
    if i.get("fonts"):
        out.append("Fonts: " + ", ".join(f"{k} {v}" for k, v in i["fonts"].items()))
    if i.get("logo"):
        out.append(f"Logo: {i['logo']}")
    pr = b.get("presets", {})
    if pr.get("prefer"):
        out.append("Prefer: " + "; ".join(f"{k}: {', '.join(v)}" for k, v in pr["prefer"].items()))
    if pr.get("avoid"):
        out.append("Avoid: " + ", ".join(pr["avoid"]))
    mo = b.get("motion") or {}
    if mo.get("curves"):
        out.append("Brand curves: " + "; ".join(f"{c['name']} {c['bezier']}" + (f" ({c['use']})" if c.get("use") else "") for c in mo["curves"]))
    if mo.get("timing"):
        out.append("Timing: " + "; ".join(f"{t['element']} {t['value']} {t['unit']}" + (f" of {t['of']}" if t.get("of") else "")
                                          + (f" on {t['curve']}" if t.get("curve") else "") for t in mo["timing"]))
    for cat in CATEGORIES:
        rs = [r for r in b["rules"] if r["category"] == cat]
        if rs:
            out.append(f"\n## {cat.capitalize()}")
            out += [f"- {r['rule']}" + (f" ({r['why']})" if r.get("why") else "") for r in rs]
    if b.get("projects"):
        out.append("\nProjects: " + "; ".join(f"{p['name']} ({p['date']}, {p['path']})" for p in b["projects"]))
    out.append("\nRecord every new review note with add_brand_note (MCP) or `python tools/brand.py note`.")
    return "\n".join(out)


def merge(mine, theirs, by=""):
    """Merges a shared copy of a brand into yours. Rules match by uid (or by text): new ones are added, a newer edit
    wins, a removal travels when it is newer than your copy of the rule. Curves and timing rows are added by name; your
    identity and feel stay. Returns (brand, counts); the uids that came in go to brand["inbox"] (shown as new)."""
    rules = {rule_uid(r): r for r in mine.get("rules", [])}
    removed = {x["uid"]: x for x in mine.get("removed", [])}
    for x in theirs.get("removed", []):
        if x["uid"] not in removed or x.get("date", "") > removed[x["uid"]].get("date", ""):
            removed[x["uid"]] = x
    n, inbox = {"new": 0, "updated": 0, "removed": 0, "curves": 0, "timing": 0}, []
    for r in theirs.get("rules", []):
        r = dict(r); u = rule_uid(r)
        if u in removed and removed[u].get("date", "") >= r.get("updated", r.get("source", {}).get("date", "")):
            continue
        if u not in rules:
            r["id"] = max([x.get("id", 0) for x in rules.values()] or [0]) + 1
            rules[u] = r; inbox.append(u); n["new"] += 1
        elif r.get("updated", "") > rules[u].get("updated", "") and (r["rule"], r.get("why")) != (rules[u]["rule"], rules[u].get("why")):
            r["id"] = rules[u].get("id"); rules[u] = r; inbox.append(u); n["updated"] += 1
    for u, x in removed.items():
        if u in rules and x.get("date", "") >= rules[u].get("updated", rules[u].get("source", {}).get("date", "")):
            del rules[u]; n["removed"] += 1
    out = dict(mine)
    out["rules"] = sorted(rules.values(), key=lambda r: r.get("id", 0))
    out["removed"] = list(removed.values())
    mo = out.setdefault("motion", {})
    for key, name in (("curves", "name"), ("timing", "element")):
        have = {c.get(name) for c in mo.setdefault(key, [])}
        for c in (theirs.get("motion") or {}).get(key, []):
            if c.get(name) not in have:
                mo[key].append(c); n[key] += 1
    out["inbox"] = sorted(set(out.get("inbox", []) + inbox))
    out.setdefault("shared", []).append({"date": today(), "by": by, "from": theirs.get("exported_by", "")})
    return out, n


def export(slug, file=None, by=""):
    d, _ = where(slug)
    b = load(slug); b.pop("inbox", None); b.pop("claude", None)   # conversations are per computer
    for r in b.get("rules", []):
        rule_uid(r)
    b["exported"], b["exported_by"] = today(), by
    if d and (d / "thumb.png").exists():
        b["thumb_png"] = base64.b64encode((d / "thumb.png").read_bytes()).decode()
    out = pathlib.Path(file or f"{slug}.motiondna-brand.json")
    out.write_text(json.dumps(b, indent=1, ensure_ascii=False) + "\n", encoding="utf-8")
    return out


def import_(file, by="", folder=None):
    theirs = json.loads(pathlib.Path(file).read_text(encoding="utf-8"))
    png = theirs.pop("thumb_png", None); theirs.pop("claude", None)
    d, _ = where(theirs["slug"])
    if d:
        b, n = merge(json.loads((d / "brand.json").read_text(encoding="utf-8")), theirs, by)
    else:
        b, d = dict(theirs), pathlib.Path(folder) if folder else LOCAL / theirs["slug"]
        b["inbox"] = [rule_uid(r) for r in b.get("rules", [])]
        b.setdefault("shared", []).append({"date": today(), "by": by, "from": theirs.get("exported_by", "")})
        n = {"new": len(b.get("rules", [])), "updated": 0, "removed": 0, "curves": 0, "timing": 0}
        if folder:
            register(folder)
    for k in ("exported", "exported_by"):
        b.pop(k, None)
    save(b, d)
    if png and not (d / "thumb.png").exists():
        (d / "thumb.png").write_bytes(base64.b64decode(png))
    return b, n, d


def thumb(slug):
    """224x126 panel card: logo on the brand's dark colour with its name."""
    b = load(slug); i = b["identity"]; cols = i.get("colors", {})
    bg = (list(cols.values())[0] if cols else "#0A211F").lstrip("#")
    fg = (cols.get("spark") or (list(cols.values())[1] if len(cols) > 1 else "#F7F9F2")).lstrip("#")
    d, _ = where(slug)
    out = d / "thumb.png"; font = ROOT / "assets/fonts/InterTight[wght].ttf"
    tmp = d / "_font.ttf"; tmp.write_bytes(font.read_bytes())   # no brackets in an ffmpeg filter path
    ft = tmp.as_posix().replace(":", "\\:")
    name = b["name"].replace(":", "\\:").replace("'", "")
    logo = i.get("logo", "")
    logo_png = ROOT / logo.replace(".svg", "_1024.png") if logo.endswith(".svg") else ROOT / logo
    cmd = ["ffmpeg", "-v", "error", "-y", "-f", "lavfi", "-i", f"color=c=0x{bg}:s=448x252"]
    if logo and logo_png.exists():
        cmd += ["-i", str(logo_png), "-filter_complex",
                f"[1]scale=-1:150[l];[0][l]overlay=28:51,drawtext=fontfile='{ft}':text='{name}':fontcolor=0x{fg}:fontsize=40:x=200:y=(h-text_h)/2,scale=224:126"]
    else:
        cmd += ["-vf", f"drawtext=fontfile='{ft}':text='{name}':fontcolor=0x{fg}:fontsize=44:x=(w-text_w)/2:y=(h-text_h)/2,scale=224:126"]
    subprocess.run(cmd + ["-frames:v", "1", str(out)], check=True)
    tmp.unlink()
    return out


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    sub = ap.add_subparsers(dest="cmd", required=True)
    sub.add_parser("list")
    s = sub.add_parser("show"); s.add_argument("slug")
    n = sub.add_parser("new"); n.add_argument("slug"); n.add_argument("--name", required=True); n.add_argument("--style", default="Modern")
    n.add_argument("--curve"); n.add_argument("--tones", default=""); n.add_argument("--energy", default="2,3"); n.add_argument("--by", default="")
    n.add_argument("--dir", help="keep the brand in this folder instead of library/brands.local")
    o = sub.add_parser("note"); o.add_argument("slug"); o.add_argument("rule"); o.add_argument("--cat", default="layout")
    o.add_argument("--why", default=""); o.add_argument("--project", default=""); o.add_argument("--by", default="")
    e = sub.add_parser("export"); e.add_argument("slug"); e.add_argument("file", nargs="?"); e.add_argument("--by", default="")
    m = sub.add_parser("import"); m.add_argument("file"); m.add_argument("--by", default=""); m.add_argument("--dir")
    t = sub.add_parser("thumb"); t.add_argument("slug")
    a = ap.parse_args()
    if a.cmd == "list":
        for b in all_brands():
            print(f"{b['slug']}: {b['name']} · style {b['feel']['style']} · curve {b['feel'].get('curve') or '-'} · "
                  f"tones {'/'.join(b['feel']['tones'])} · {len(b['rules'])} rules · {len(b.get('projects', []))} projects · {b['_where']}")
    elif a.cmd == "show":
        print(digest(a.slug))
    elif a.cmd == "new":
        b = new(a.slug, a.name, a.style, a.curve, [x for x in a.tones.split(",") if x], [int(x) for x in a.energy.split(",")], a.by, a.dir)
        print(f"created {path(b['slug'])}")
    elif a.cmd == "note":
        r = note(a.slug, a.rule, a.cat, a.why, a.project, a.by)
        print(f"rule {r['id']} ({r['category']}): {r['rule']}")
    elif a.cmd == "export":
        print(f"exported {export(a.slug, a.file, a.by)}")
    elif a.cmd == "import":
        b, n, d = import_(a.file, a.by, a.dir)
        print(f"{b['name']} in {d}: {n['new']} new rules, {n['updated']} updated, {n['removed']} removed, "
              f"{n['curves']} curves, {n['timing']} timings")
    elif a.cmd == "thumb":
        print(thumb(a.slug))


if __name__ == "__main__":
    sys.exit(main())
