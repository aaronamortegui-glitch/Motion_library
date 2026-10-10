"""Brand profiles: a custom style per brand or project that learns from every review and lives in the repo.

Each brand is one folder, library/brands/<slug>/ (schema: library/brands/_schema.md):
  brand.json   identity (colours, fonts, logo), feel (energy, tones, base style, curve, transition), preferred and
               avoided presets per role, the rules learned in reviews (with why, project, date, who), the projects
  thumb.png    the card shown in the panel's Brands category (python tools/brand.py thumb <slug>)
Brands are independent: each one grows its own rules. Claude reads a brand before animating for it (MCP get_brand) and
records every new review note in it (MCP add_brand_note), so the next piece starts where the last one ended.

  python tools/brand.py list
  python tools/brand.py show <slug>                       # the digest Claude follows (markdown)
  python tools/brand.py new <slug> --name "Acme" --style Modern --curve Coast --tones modern,corporate --energy 2,3
  python tools/brand.py note <slug> "Labels go into the negative space" --cat layout --why "..." --project promo --by Aaron
  python tools/brand.py thumb <slug>                      # panel card from the logo, colours and name
"""
import argparse
import datetime
import json
import pathlib
import subprocess
import sys

ROOT = pathlib.Path(__file__).resolve().parent.parent
BRANDS = ROOT / "library" / "brands"
CATEGORIES = ["layout", "typography", "motion", "effects", "color", "audio", "edit", "process"]


def path(slug):
    return BRANDS / slug / "brand.json"


def load(slug):
    return json.loads(path(slug).read_text(encoding="utf-8"))


def save(b):
    p = path(b["slug"]); p.parent.mkdir(parents=True, exist_ok=True)
    p.write_text(json.dumps(b, indent=1, ensure_ascii=False) + "\n", encoding="utf-8")


def all_brands():
    return [load(p.parent.name) for p in sorted(BRANDS.glob("*/brand.json"))]


def new(slug, name, style="Modern", curve=None, tones=(), energy=(2, 3), by=""):
    if path(slug).exists():
        raise SystemExit(f"brand '{slug}' already exists")
    b = {"name": name, "slug": slug, "created": str(datetime.date.today()), "by": by,
         "identity": {"colors": {}, "fonts": {}, "logo": ""},
         "feel": {"energy": list(energy), "tones": list(tones), "style": style, "curve": curve, "transition": None},
         "presets": {"prefer": {}, "avoid": []}, "rules": [], "projects": []}
    save(b)
    return b


def note(slug, rule, cat="layout", why="", project="", by=""):
    if cat not in CATEGORIES:
        raise SystemExit(f"category must be one of {', '.join(CATEGORIES)}")
    b = load(slug)
    for r in b["rules"]:   # the same rule twice only refreshes its source
        if r["rule"].strip().lower() == rule.strip().lower():
            r["source"] = {"project": project, "date": str(datetime.date.today()), "by": by}
            save(b); return r
    r = {"id": max([x["id"] for x in b["rules"]] or [0]) + 1, "category": cat, "rule": rule, "why": why,
         "source": {"project": project, "date": str(datetime.date.today()), "by": by}}
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
    for cat in CATEGORIES:
        rs = [r for r in b["rules"] if r["category"] == cat]
        if rs:
            out.append(f"\n## {cat.capitalize()}")
            out += [f"- {r['rule']}" + (f" ({r['why']})" if r.get("why") else "") for r in rs]
    if b.get("projects"):
        out.append("\nProjects: " + "; ".join(f"{p['name']} ({p['date']}, {p['path']})" for p in b["projects"]))
    out.append("\nRecord every new review note with add_brand_note (MCP) or `python tools/brand.py note`.")
    return "\n".join(out)


def thumb(slug):
    """224x126 panel card: logo on the brand's dark colour with its name."""
    b = load(slug); i = b["identity"]; cols = i.get("colors", {})
    bg = (list(cols.values())[0] if cols else "#0A211F").lstrip("#")
    fg = (cols.get("spark") or (list(cols.values())[1] if len(cols) > 1 else "#F7F9F2")).lstrip("#")
    out = BRANDS / slug / "thumb.png"; font = ROOT / "assets/fonts/InterTight[wght].ttf"
    tmp = BRANDS / slug / "_font.ttf"; tmp.write_bytes(font.read_bytes())   # no brackets in an ffmpeg filter path
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
    o = sub.add_parser("note"); o.add_argument("slug"); o.add_argument("rule"); o.add_argument("--cat", default="layout")
    o.add_argument("--why", default=""); o.add_argument("--project", default=""); o.add_argument("--by", default="")
    t = sub.add_parser("thumb"); t.add_argument("slug")
    a = ap.parse_args()
    if a.cmd == "list":
        for b in all_brands():
            print(f"{b['slug']}: {b['name']} · style {b['feel']['style']} · curve {b['feel'].get('curve') or '-'} · "
                  f"tones {'/'.join(b['feel']['tones'])} · {len(b['rules'])} rules · {len(b.get('projects', []))} projects")
    elif a.cmd == "show":
        print(digest(a.slug))
    elif a.cmd == "new":
        b = new(a.slug, a.name, a.style, a.curve, [x for x in a.tones.split(",") if x], [int(x) for x in a.energy.split(",")], a.by)
        print(f"created {path(b['slug'])}")
    elif a.cmd == "note":
        r = note(a.slug, a.rule, a.cat, a.why, a.project, a.by)
        print(f"rule {r['id']} ({r['category']}): {r['rule']}")
    elif a.cmd == "thumb":
        print(thumb(a.slug))


if __name__ == "__main__":
    sys.exit(main())
