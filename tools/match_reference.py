"""Compares a reference profile (library/references/<slug>.json, see library/references/_schema.md) with the library
and says what already fits, how to build each observed move from existing presets + token curves + durations, and what
is missing (gaps) so it can be created and added to the library.

  python tools/match_reference.py library/references/google-calm-modern.json
  -> research/references/<slug>.md (report) and research/references/<slug>.gaps.json (to implement)

Also used by the MCP server (match_reference). Reads library/tags.json (python tools/tag_library.py) and the tokens.
"""
import json
import math
import pathlib
import sys

ROOT = pathlib.Path(__file__).resolve().parent.parent
TAGS = json.load(open(ROOT / "library/tags.json", encoding="utf-8"))
TOK = json.load(open(ROOT / "tokens/superside_motion_tokens.json", encoding="utf-8"))
BEZ = {e["name"]: e["bezier"] for e in TOK["easings"] if "bezier" in e}
DUR = {d["name"]: d["ms"] for d in TOK["durations"]}
FAMILY = {c["name"]: c["family"] for c in TAGS["curves"]}
# presets whose own motion is an overshoot / anticipation (excluded when the reference avoids those families)
INTRINSIC = {"overshoot": {"Scale Pop", "Spin Pop", "Drop Bounce", "Bounce In", "Bounce In Up", "Rubber Band", "Jello", "Tada", "Wobble",
                           "Jack In The Box", "Back In Down", "Back In Left", "Back Out Up", "Chars Pop", "Squash Warp", "Heart Beat"},
             "anticipation": {"Back In Down", "Back In Left", "Back Out Up", "Light Speed In"}}
MIRROR = {("left", "right"), ("right", "left"), ("up", "down"), ("down", "up")}


def overlap(a, b):
    return not (a[1] < b[0] or b[1] < a[0])


def avoided(p, avoid):
    if p["name"] in avoid or set(p["tones"]) & set(avoid):
        return True
    return any(p["name"] in INTRINSIC.get(f, set()) for f in avoid)


def score_move(m, p, prof):
    if m.get("role") not in p["roles"]:
        return 0, None
    s, why = 0.0, []
    if m.get("target") in p["targets"]:
        s += 2; why.append("target")
    ch_o, ch_p = set(m.get("channels", [])), set(p["channels"])
    if ch_o or ch_p:
        j = len(ch_o & ch_p) / max(1, len(ch_o | ch_p)); s += 4 * j
        if j: why.append("channels %.0f%%" % (j * 100))
    flip = None
    d_o, d_p = m.get("direction", "in-place"), p["direction"]
    if d_o == d_p:
        s += 1
    elif (d_o, d_p) in MIRROR:
        s += 0.8; flip = "mirror horizontal" if d_o in ("left", "right") else "mirror vertical"
    if overlap(p["energy"], prof["energy"]):
        s += 1; why.append("energy")
    else:
        s -= min(abs(p["energy"][0] - prof["energy"][1]), abs(prof["energy"][0] - p["energy"][1]))
    t = len(set(p["tones"]) & set(prof.get("tones", [])))
    s += 0.5 * min(t, 2)
    return s, flip


def nearest_curve(bez, avoid):
    best, dist = None, 9
    for n, b in BEZ.items():
        if n in avoid or FAMILY.get(n) in avoid or n in ("Pop", "Recoil"):
            continue
        d = math.dist(b, bez)
        if d < dist:
            best, dist = n, d
    return best, dist


def nearest_duration(ms):
    n = min(DUR, key=lambda k: abs(DUR[k] - ms))
    return n, round(ms / DUR[n], 2)


def curve_for(prof, avoid):
    """Best token curve for the reference feel when a move has no measured bezier."""
    best, sc = None, -9
    for c in TAGS["curves"]:
        if c["name"] in avoid or c["family"] in avoid or c["name"] in ("Pop", "Recoil"):
            continue
        s = (2 if overlap(c["energy"], prof["energy"]) else -2) + len(set(c["tones"]) & set(prof.get("tones", [])))
        if s > sc:
            best, sc = c["name"], s
    return best


def main(path):
    prof = json.load(open(path, encoding="utf-8"))
    avoid = prof.get("avoid", [])
    slug = prof.get("slug") or pathlib.Path(path).stem
    presets = [p for p in TAGS["presets"]]
    fit = [p for p in presets if not avoided(p, avoid) and overlap(p["energy"], prof["energy"]) and
           (not prof.get("tones") or set(p["tones"]) & set(prof["tones"]))]
    default_curve = curve_for(prof, avoid)
    rows, gaps = [], {"reference": slug, "moves": [], "curves": [], "techniques": [], "tones": []}
    for m in prof.get("moves", []):
        cands = sorted(((score_move(m, p, prof), p) for p in presets if not avoided(p, avoid)), key=lambda x: -x[0][0])
        (sc, flip), best = cands[0] if cands else ((0, None), None)
        curve, cdist = nearest_curve(m["bezier"], avoid) if m.get("bezier") else (default_curve, 0)
        dur, mult = nearest_duration(m.get("duration_ms", 400))
        target_ok = best is not None and m.get("target") in best["targets"]
        # match / adapt need the same kind of layer; otherwise the move is new for the library
        status = "match" if (sc >= 6 and target_ok) else ("adapt" if (sc >= 4 and target_ok) else "gap")
        rows.append((m, best, sc, flip, curve, dur, mult, status))
        if status == "gap":
            gaps["moves"].append({**m, "closest": best["name"] if best else None, "score": round(sc, 1),
                                  "suggested_tags": {"roles": [m.get("role")], "targets": [m.get("target")], "channels": m.get("channels", []),
                                                     "direction": m.get("direction", "in-place"), "energy": prof["energy"], "tones": prof.get("tones", [])},
                                  "suggested_curve": curve, "suggested_duration": dur})
    curve_rows = []
    for c in prof.get("curves", []):
        n, d = nearest_curve(c["bezier"], [])
        curve_rows.append((c, n, d))
        if d > 0.25:
            gaps["curves"].append({**c, "closest_token": n, "distance": round(d, 2)})
    have = {t["name"].lower() for t in TAGS["techniques"]}
    for t in prof.get("techniques", []):
        if t["name"].lower() not in have and not any(t["name"].lower() in h or h in t["name"].lower() for h in have):
            gaps["techniques"].append(t)
    gaps["tones"] = sorted(set(prof.get("tones", [])) - set(TAGS["tones"]))

    # a proposed style: one preset per layer role, from what fits
    def pick(kinds, targets, roles=("enter",)):
        c = [p for p in fit if p["kind"] in kinds and set(p["targets"]) & set(targets) and set(p["roles"]) & set(roles)]
        c.sort(key=lambda p: (-len(set(p["tones"]) & set(prof.get("tones", []))), abs(sum(p["energy"]) / 2 - sum(prof["energy"]) / 2)))
        return c[0]["name"] if c else None
    style = {"name": prof["name"].split("—")[0].strip(), "slug": slug, "energy": TAGS["energy_scale"][str(round(sum(prof["energy"]) / 2))],
             "desc": "From reference: " + prof["name"], "stagger": 6 if prof["energy"][1] <= 2 else 4 if prof["energy"][1] <= 3 else 3,
             "curve": default_curve, "roles": {}}
    for role, kinds, targets in [("title", ["text"], ["title"]), ("subtitle", ["text"], ["text", "title"]), ("body", ["text"], ["text"]),
                                 ("shape", ["motion"], ["shape", "ui"]), ("media", ["motion"], ["media"]), ("logo", ["motion"], ["logo", "icon"])]:
        n = pick(kinds, targets)
        if n:
            style["roles"][role] = {"text" if kinds == ["text"] else "motion": n}
    gaps["style"] = style

    out = ROOT / "research/references"; out.mkdir(parents=True, exist_ok=True)
    L = [f"# Reference match: {prof['name']}", "",
         f"Energy {prof['energy'][0]}–{prof['energy'][1]} ({TAGS['energy_scale'][str(prof['energy'][0])]} to {TAGS['energy_scale'][str(prof['energy'][1])]}) · tones: {', '.join(prof.get('tones', []))} · avoid: {', '.join(avoid) or '—'}", "",
         f"## Presets that fit ({len(fit)})", ", ".join(sorted(p["name"] for p in fit)) or "—", "",
         f"Default curve for this feel: **{default_curve}**.", "",
         "## Observed moves → how to build them", "| Move | Status | Preset | Curve | Duration | Notes |", "|---|---|---|---|---|---|"]
    for m, best, sc, flip, curve, dur, mult, status in rows:
        notes = []
        if flip: notes.append(flip)
        if mult != 1: notes.append(f"duration ×{mult}")
        L.append(f"| {m['describe']} | {status} ({sc:.1f}) | {best['name'] if best else '—'} | {curve} | {dur} | {', '.join(notes)} |")
    L += ["", "## Curves", "| Observed | Bezier | Closest token | Distance |", "|---|---|---|---|"]
    for c, n, d in curve_rows:
        L.append(f"| {c['name']} | {c['bezier']} | {n} | {d:.2f}{' **gap**' if d > 0.25 else ''} |")
    L += ["", "## Gaps to create", f"- moves: {len(gaps['moves'])}" + "".join(f"\n  - {g['describe']} (closest: {g['closest']})" for g in gaps["moves"]),
          f"- curves: {len(gaps['curves'])}" + "".join(f"\n  - {g['name']} {g['bezier']}" for g in gaps["curves"]),
          f"- techniques: {len(gaps['techniques'])}" + "".join(f"\n  - {g['name']}: {g.get('describe', '')}" for g in gaps["techniques"]),
          f"- new tones: {', '.join(gaps['tones']) or '—'}", "",
          "## Proposed style", "```json", json.dumps(style, indent=1, ensure_ascii=False), "```", "",
          "Next steps: CONTRIBUTING.md §8 (create the gaps, tag them, render the samples, add the style)."]
    (out / f"{slug}.md").write_text("\n".join(L) + "\n", encoding="utf-8")
    json.dump(gaps, open(out / f"{slug}.gaps.json", "w", encoding="utf-8"), indent=1, ensure_ascii=False)
    print("\n".join(L))
    return gaps


if __name__ == "__main__":
    main(sys.argv[1] if len(sys.argv) > 1 else str(ROOT / "library/references/google-calm-modern.json"))
