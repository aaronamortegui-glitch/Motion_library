"""Converts harvested behaviors (research/harvest/**.json) into our own recipes → library/recipes.json.

A recipe describes WHAT moves and HOW (channels relative to rest, frames, curve); it does not copy the preset:
SSP.applyRecipe() reproduces it with native keyframes and our tokens. If the measured curve resembles a token
(distance < 0.06) the token is used; otherwise the fitted bezier is stored.

Usage: python tools/harvest_to_library.py
"""
import csv
import glob
import json
import re
from pathlib import Path

import numpy as np

from fit_samples import fit, nearest_token, phases

ROOT = Path(__file__).resolve().parent.parent
TOK = json.loads((ROOT / "tokens/superside_motion_tokens.json").read_text(encoding="utf-8"))
DURS = [(d["name"], d["frames"]) for d in TOK["durations"]]
CHANNEL = {"/Transform/Position": "position", "/Transform/Scale": "scale", "/Transform/Rotation": "rotation",
           "/Transform/Opacity": "opacity", "/Transform/X Rotation": "rotation_x", "/Transform/Y Rotation": "rotation_y"}


def slug(s):
    return re.sub(r"[^a-z0-9]+", "-", s.lower()).strip("-")


def load_labels():
    p = ROOT / "research/harvest/station/labels.csv"
    if not p.exists():
        return {}
    with open(p, encoding="utf-8-sig") as fh:
        return {r["code"]: r["name"] for r in csv.DictReader(fh) if r.get("name")}


def layers_in(path):
    d = json.loads(Path(path).read_text(encoding="utf-8"))
    if "layers" in d:  # harvest.jsx format (full comp)
        for L in d["layers"]:
            L.setdefault("fps", d.get("fps", 30)); L.setdefault("section", d.get("comp", ""))
            yield L
    else:              # station format (one layer)
        yield d


def phase_spec(values, ph, fps, chan):
    v = np.asarray(values, dtype=float)
    if v.ndim == 1:
        v = v[:, None]
    a, b = ph["start"], ph["end"]
    start, end = v[a], v[b]
    n = b - a
    bz, rmse = fit(np.clip(ph["prog"], -1, 2.5))
    tok, dist = nearest_token(bz)
    over = float(max(ph["prog"].max() - 1, -ph["prog"].min(), 0))
    return {"start_f": int(a), "frames": int(n), "from": [round(float(x), 3) for x in start], "to": [round(float(x), 3) for x in end],
            "bezier": bz, "token": tok if dist < 0.06 else None, "overshoot": round(over, 3),
            "duration_token": min(DURS, key=lambda d: abs(d[1] - n * 30 / fps))[0]}


def oscillation(values, fps):
    """Continuous loop: amplitude (half the range) and dominant frequency (FFT) per component."""
    v = np.asarray(values, dtype=float)
    if v.ndim == 1:
        v = v[:, None]
    amps, freqs = [], []
    for k in range(v.shape[1]):
        x = v[:, k] - v[:, k].mean()
        amps.append(round(float(np.ptp(v[:, k]) / 2), 3))
        if np.ptp(x) < 1e-6:
            freqs.append(0.0); continue
        spec = np.abs(np.fft.rfft(x * np.hanning(len(x))))
        f = np.fft.rfftfreq(len(x), 1 / fps)
        freqs.append(round(float(f[1:][np.argmax(spec[1:])]), 3))
    jitter = float(np.mean(np.abs(np.diff(v, 2, axis=0)))) / (float(np.ptp(v)) or 1)
    return {"amp": amps, "freq": freqs, "rest": [round(float(x), 3) for x in v.mean(axis=0)],
            "style": "wiggle" if jitter > 0.05 else "sine"}


def recipe(L, labels):
    codes = [c["code"] for c in L.get("controls", [])]
    key = "+".join(dict.fromkeys(codes)) or "unknown"
    fps = L.get("fps", 30)
    markers = [m["f"] for m in L.get("markers", [])]
    split = markers[0] if markers else None
    chans, effects = {}, []
    is_fx = not markers and any(c["role"] == "fx" for c in L.get("controls", []))
    for P in L.get("props", []):
        ch = CHANNEL.get(P["path"])
        if not ch:
            effects.append(P["path"].split("/")[-2] if P["path"].count("/") > 1 else P["path"])
            continue
        if is_fx:
            if np.ptp(np.asarray(P["values"], dtype=float)) > 1e-4:
                chans.setdefault("loop", {})[ch] = oscillation(P["values"], fps)
            continue
        for ph in phases(P["values"]):
            role = "in" if (split is None and ph["start"] < len(P["values"]) / 2) or (split is not None and ph["start"] < split) else "out"
            if ph["pulse"]:
                role = "loop"
            chans.setdefault(role, {})[ch] = phase_spec(P["values"], ph, fps, ch) if role != "loop" else {"frames": ph["end"] - ph["start"]}
    if not chans:
        return None
    ins = chans.get("in", {})
    over = max([c.get("overshoot", 0) for c in ins.values()] or [0])
    n_in = max([c["frames"] for c in ins.values()] or [0])
    energy = "d" if over > 0.03 or (0 < n_in < 10) else ("s" if n_in > 20 or set(ins) <= {"opacity"} else "m")
    kind = "fx" if is_fx else "transition"
    if is_fx:  # energy of a loop: high frequency or wiggle style → dynamic
        fmax = max([max(c["freq"]) for c in chans.get("loop", {}).values()] or [0])
        wig = any(c["style"] == "wiggle" for c in chans.get("loop", {}).values())
        energy = "d" if wig or fmax > 2 else ("m" if fmax > 0.8 else "s")
    sec = L.get("section", "")
    return {"id": f"{slug(sec)}__{key}", "code": key, "name": labels.get(key, ""), "section": sec, "kind": kind,
            "energy": energy, "channels": sorted({c for ph in chans.values() for c in ph}),
            "native_effects": sorted(set(e for e in effects if e)), "params": {c["role"]: c["params"] for c in L.get("controls", [])},
            "phases": chans}


def main():
    labels = load_labels()
    files = sorted(glob.glob(str(ROOT / "research/harvest/station/*.json")) + glob.glob(str(ROOT / "research/harvest/*.json")))
    out = {}
    for f in files:
        for L in layers_in(f):
            r = recipe(L, labels)
            if r and r["id"] not in out:
                out[r["id"]] = r
    (ROOT / "library/recipes.json").write_text(json.dumps({"version": 1, "recipes": list(out.values())}, ensure_ascii=False, separators=(",", ":")), encoding="utf-8")
    print(f"{len(out)} recipes → library/recipes.json")
    for r in out.values():
        ph = r["phases"].get("in") or r["phases"].get("loop", {})
        desc = [(k, v["frames"], v["token"] or v["bezier"]) if "frames" in v else (k, v["style"], v["freq"], v["amp"]) for k, v in ph.items()]
        print(f'  {r["id"][:40]:40s} {r["kind"]:10s} e={r["energy"]} {desc}')


if __name__ == "__main__":
    main()
