"""Aligns the ontology with Motion DNA terminology.

For every behavior in research/ontology/behaviors.json:
- dna_curve: nearest Motion DNA curve token (measured beziers, distance <= 0.08), else the hand-stated nearest_token
- dna_preset: Motion DNA preset that reproduces the mechanism (keyword rules below), or null = gap
- dna_match: "measured" | "rule" | "gap"
Also writes research/ontology/dna_coverage.json (coverage stats + gaps).

Uso: python -I tools/style_research/map_to_dna.py
"""
import json
import re
import sys
from pathlib import Path

import numpy as np

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT / "tools"))
from fit_samples import bez  # noqa: E402

TOK = json.loads((ROOT / "tokens/superside_motion_tokens.json").read_text(encoding="utf-8"))
XS = np.linspace(0, 1, 100)

# (regex on id + mechanism, Motion DNA preset). First match wins; order = most specific first.
RULES = [
    (r"wordmark|from behind (the|its) mark|slides out from behind", "Wordmark Reveal"),
    (r"iris|circular reveal|circle (wipe|reveal)|circle opens", "Iris Reveal"),
    (r"snap", "Snap Scale"),
    (r"push[- ]?in|zoom[- ]?through|fly[- ]?through|push through|pushes in|flies through|zoom out across", "Push Through"),
    (r"liquid wipe|color wipe|diagonal.*wipe|plate wipe|strip|wedge|band sweeps|arch wipe|panel", "Color Wipe"),
    (r"whip", "Whip Pan"),
    (r"boil", "Boil"),
    (r"on twos|on 2s|stepped time|held frames|held-frame|stop-motion", "On Twos"),
    (r"scramble|glitch build|decode|glitch / scramble", "Scramble"),
    (r"count(s)? up|counter|countdown|digits count|rolling digits", "Count Up"),
    (r"typing|typed|type[- ]on|typewriter|types on|retyped", "Typewriter"),
    (r"blur.*(per|each) character|character.*blur|chars blur", "Chars Blur"),
    (r"blur.*word|word.*blur|blur[- ]fade", "Blur Words"),
    (r"underline|draws? on|draw-on|outline|construction|trim|line draw|hand-drawn", "Line Draw"),
    (r"bar(s)? (grow|rise)|grows from the baseline|rise from the floor|bars rise", "Nudge Grow"),
    (r"anticipation", "Wind-up Slide"),
    (r"pop|stamp|pills? pop|icons? pop|burst", "Scale Pop"),
    (r"easing lane", "Fade"),
    (r"orbit", "Orbit"),
    (r"pendulum|swing", "Swing"),
    (r"idle|float|drift|breath|loop", "Float"),
    (r"jitter|flicker|strobe", "Jitter"),
    (r"line (by line|rising)|mask[- ]rise|rises? from (a|its|their) (baseline )?mask|rise", "Chars Rise"),
    (r"slides? (in|up|out)|slide", "Slide Land"),
    (r"fade", "Fade"),
    (r"glitch|rgb split|slice", "Jitter"),
    (r"hop|bounce", "Drop Bounce"),
    (r"word by word|one word at a time|glyph by glyph|write on|writes on", "Words Fade Up"),
]
# mechanisms that are camera / edit / acting craft, not layer presets (kept as gaps on purpose)
CRAFT = r"camera|truck|cut|montage|edit|match cut|acting|walk|jump|character|crowd|hud|continuity|bookend|morph|merge|transform|becomes|particles|fill"


def nearest(bz):
    best = None
    for e in TOK["easings"]:
        d = float(np.sqrt(np.mean((bez(e["bezier"], XS) - bez(bz, XS)) ** 2)))
        if best is None or d < best[1]:
            best = (e["name"], round(d, 3))
    return best


bp = ROOT / "research/ontology/behaviors.json"
B = json.loads(bp.read_text(encoding="utf-8"))
stats = {"behaviors": 0, "curve_measured_matched": 0, "curve_measured": 0, "preset_rule": 0, "gap_craft": 0, "gap_other": 0}
gaps = {}
for b in B["behaviors"]:
    stats["behaviors"] += 1
    c = b.get("curve") or {}
    bz = c.get("bezier")
    b["dna_curve"] = None
    if b.get("measured") and isinstance(bz, list) and len(bz) == 4 and all(isinstance(x, (int, float)) for x in bz):
        stats["curve_measured"] += 1
        name, d = nearest(bz)
        b["dna_curve_distance"] = d
        if d <= 0.08:
            b["dna_curve"] = name; stats["curve_measured_matched"] += 1
    elif c.get("kind") in ("stepped",):
        b["dna_curve"] = "Snap" if "snap" in (b.get("mechanism") or "").lower() else None
    if not b["dna_curve"] and b.get("nearest_token"):
        nt = b["nearest_token"]; b["dna_curve"] = nt[0] if isinstance(nt, list) else nt
    text = (b["id"].replace("-", " ") + " " + (b.get("mechanism") or "")).lower()
    preset = next((p for rx, p in RULES if re.search(rx, text)), None)
    b["dna_preset"] = preset
    if preset:
        b["dna_match"] = "rule"; stats["preset_rule"] += 1
    else:
        craft = bool(re.search(CRAFT, text))
        b["dna_match"] = "gap-craft" if craft else "gap"
        stats["gap_craft" if craft else "gap_other"] += 1
        gaps.setdefault("craft" if craft else "other", []).append(f"{b['id']}: {b.get('mechanism','')[:110]}")
bp.write_text(json.dumps(B, ensure_ascii=False, indent=2), encoding="utf-8")
from collections import Counter
cov = {"stats": stats,
       "presets_used": Counter(b["dna_preset"] for b in B["behaviors"] if b["dna_preset"]).most_common(),
       "curves_used": Counter(b["dna_curve"] for b in B["behaviors"] if b["dna_curve"]).most_common(),
       "gaps": gaps}
(ROOT / "research/ontology/dna_coverage.json").write_text(json.dumps(cov, ensure_ascii=False, indent=1), encoding="utf-8")
print(json.dumps(stats)); print("presets:", cov["presets_used"]); print("curves:", cov["curves_used"])
print("other gaps:", len(gaps.get("other", [])))
for g in gaps.get("other", [])[:40]: print("  ", g)
