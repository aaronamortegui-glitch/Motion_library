#!/usr/bin/env python3
"""Stamp a copy of a .mogrt with new default values (text, colours, sliders) - no After Effects needed.

Why: setting a MOGRT's text through Premiere's API (MogrtText.setText) shows in the Program monitor but is dropped by
every export (Premiere 27, Media Encoder too). A MOGRT inserted untouched exports fine. So the text, colour and slider
values are written into the copy's definition.json as its defaults, the copy gets its own capsuleID (Premiere caches
templates by it), and it is inserted as is.

A .mogrt is a zip: definition.json (the controls: clientControls[].value), project.aegraphic, thumb.png/mp4.

Usage (also used by the MCP's add_title):
  python mogrt_stamp.py kit.mogrt out.mogrt '{"Headline": "Two voices", "Text colour": "#FFD166", "Text width %": 86}'
"""
import hashlib
import io
import json
import pathlib
import sys
import uuid
import zipfile


def _rgb(v):
    if isinstance(v, str):
        h = v.lstrip("#")
        return [int(h[i:i + 2], 16) / 255 for i in (0, 2, 4)] + [1]
    v = [float(x) for x in v]
    return (v + [1])[:4] if len(v) == 3 else v[:4]


def controls(src):
    """[{name, type, value}] of a .mogrt's controls (type 6 text, 4 colour, 2 slider, 1 checkbox…)."""
    src = resolve(src)
    with zipfile.ZipFile(src) as z:
        d = json.loads(z.read("definition.json").decode("utf-8"))
    out = []
    for c in d.get("clientControls", []):
        name = next((s["str"] for s in c.get("uiName", {}).get("strDB", [])), "")
        val = c.get("value")
        if c.get("type") == 6:
            val = next((s["str"] for s in (val or {}).get("strDB", [])), "")
        out.append({"name": name, "type": c.get("type"), "value": val, "min": c.get("min"), "max": c.get("max")})
    return out


def resolve(path):
    """After Effects writes '<name>.mogrt' inside a folder named like the path it was given."""
    p = pathlib.Path(path)
    if p.is_dir():
        inner = sorted(p.glob("*.mogrt"))
        if inner:
            return inner[0]
    return p


def stamp(src, out, values):
    src = resolve(src)
    out = pathlib.Path(out)
    out.parent.mkdir(parents=True, exist_ok=True)
    with zipfile.ZipFile(src) as z:
        items = {i.filename: z.read(i.filename) for i in z.infolist()}
    d = json.loads(items["definition.json"].decode("utf-8"))
    names = {}
    for c in d.get("clientControls", []):
        name = next((s["str"] for s in c.get("uiName", {}).get("strDB", [])), "")
        names[name] = c
    missing = [k for k in values if k not in names]
    if missing:
        raise KeyError(f"no control named {missing}; this template has {list(names)}")
    for k, v in values.items():
        c = names[k]
        t = c.get("type")
        if t == 6:     # source text: every locale gets the new text
            for s in c["value"]["strDB"]:
                s["str"] = str(v)
        elif t == 4:   # colour
            c["value"] = _rgb(v)
        elif t == 2:   # slider: Premiere clamps to the control's range
            c["value"] = max(c.get("min", 0), min(c.get("max", 100), float(v)))
        else:
            c["value"] = v
    key = hashlib.sha1(json.dumps([str(src), values], sort_keys=True).encode()).hexdigest()[:8]
    d["capsuleID"] = str(uuid.uuid5(uuid.NAMESPACE_URL, f"motion-dna/{d['capsuleID']}/{key}"))   # stable per (template, values)
    base = d.get("capsuleName", src.stem)
    label = str(next((v for k, v in values.items() if names[k].get("type") == 6), ""))[:40]
    d["capsuleName"] = f"{base} · {label}" if label else f"{base} · {key}"
    for s in d.get("capsuleNameLocalized", {}).get("strDB", []):
        s["str"] = d["capsuleName"]
    items["definition.json"] = json.dumps(d, ensure_ascii=False).encode("utf-8")
    # Premiere renders the text stored in project.aegraphic, not the defaults above. Motion DNA kit titles read their
    # text from a CSV packed inside it ("(Footage)/<name>_data.csv", column "text"): write the new text there.
    text = next((v for k, v in values.items() if names[k].get("type") == 6), None)
    if text is not None:
        inner_in = zipfile.ZipFile(io.BytesIO(items["project.aegraphic"]))
        csvs = [n for n in inner_in.namelist() if n.lower().endswith("_data.csv")]
        if not csvs:
            raise ValueError(f"{src.name} has no data CSV: its text cannot be set for export (Premiere drops API-set "
                             "MOGRT text in exports). Use a Motion DNA kit title.")
        buf = io.BytesIO()
        with zipfile.ZipFile(buf, "w", zipfile.ZIP_DEFLATED) as zo:
            for n in inner_in.namelist():
                data = inner_in.read(n)
                if n in csvs:
                    cell = str(text).replace('"', '""')
                    data = ("text\n" + (f'"{cell}"' if any(ch in cell for ch in ',"\n') else cell) + "\n").encode("utf-8")
                zo.writestr(n, data)
        items["project.aegraphic"] = buf.getvalue()
    with zipfile.ZipFile(out, "w", zipfile.ZIP_DEFLATED) as z:
        for name, data in items.items():
            z.writestr(name, data)
    return out, d["capsuleName"]


if __name__ == "__main__":
    o, n = stamp(sys.argv[1], sys.argv[2], json.loads(sys.argv[3]))
    print(o, n)
