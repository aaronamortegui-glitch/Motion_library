"""Reclassifies the analyze_previews.py results with calibrated rules and builds the catalog.

Rules (from research/calibration_fit.json):
- real overshoot ≈ 3–8 %, happens after 40 % of the phase and ends settled (|p_final − 1| < 2 %)
- energy by global tertiles → soft / medium / dynamic
Output: catalog/catalog.json and catalog/catalog.csv
"""
import csv
import glob
import json
from pathlib import Path

import numpy as np

from analyze_previews import FAMILY_SAMPLES, CURVE_SAMPLES, fit_curve

ROOT = Path(__file__).resolve().parent.parent
PRODUCTS = {  # pack type according to the reviewed previews
    "42": "Text", "43": "Element/Logo In-Out", "3260": "Shapes & lines", "3297": "Shapes & lines",
    "3266": "Footage transition", "3283": "Titles & callouts", "3300": "Mixed pack", "2014": "Flat 2D transition",
}
# The method measures a single isolated element: per-channel categories are only reliable for these types
ISOLATED = {"Element/Logo In-Out", "Shapes & lines"}


def smooth(p, k=3):
    p = np.asarray(p, dtype=float)
    if len(p) < k + 2:
        return p
    return np.convolve(np.pad(p, (k // 2, k // 2), mode="edge"), np.ones(k) / k, mode="valid")


def real_overshoot(prog):
    p = smooth(prog)
    if len(p) < 5:
        return 0.0
    i = int(np.argmax(p))
    peak = p[i] - 1
    settled = abs(p[-1] - 1) < 0.02
    late = i / (len(p) - 1) > 0.4
    return float(peak) if (0.02 < peak < 0.3 and settled and late) else 0.0


def perceived(prog):
    """Frames between 2 % and 98 % of the progress (without still tails) and progress trimmed to that span."""
    p = smooth(prog)
    above = np.nonzero(p >= 0.02)[0]
    if not len(above):
        return len(p) - 1, p
    a = above[0]
    reach = np.nonzero(p[a:] >= 0.98)[0]
    b = a + (reach[0] if len(reach) else len(p) - 1 - a)
    return max(int(b - a), 1), np.asarray(prog, dtype=float)[a:b + 1]


def describe(phase, over):
    n, cut = perceived(phase["progress"])
    if over > 0:
        return n, "overshoot", "Pop"
    if len(cut) < 3:
        return n, "cut", "Flat"
    return n, fit_curve(cut, FAMILY_SAMPLES)[0], fit_curve(cut, CURVE_SAMPLES)[0]


def main():
    rows = []
    for f in sorted(glob.glob(str(ROOT / "research/analysis/product_*.json"))):
        pid = Path(f).stem.split("_")[1]
        kind = PRODUCTS.get(pid, "?")
        for r in json.loads(Path(f).read_text(encoding="utf-8")):
            if "error" in r or not r.get("phases"):
                continue
            ph = r["phases"]
            overs = [real_overshoot(p["progress"]) for p in ph]
            entry = ph[0]
            exitp = ph[-1] if len(ph) > 1 else None
            in_n, in_fam, in_tok = describe(entry, overs[0])
            out_n, out_fam, _ = describe(exitp, overs[-1]) if exitp else (None, None, None)
            rows.append({
                "product": pid, "kind": kind, "item": r["file"].split(".")[0],
                "preview": str(Path(f"~/AppData/Local/MisterHorse/ProductManager/Products/{pid}/Items/{r['file']}")),
                "category": r["category"] if kind in ISOLATED else "(n/a: " + kind.lower() + ")",
                "energy": r["energy"], "bounce": max(overs) > 0, "overshoot": round(max(overs), 3),
                "in_frames": in_n, "in_family": in_fam, "in_token": in_tok,
                "out_frames": out_n, "out_family": out_fam,
                "phases": len(ph),
            })
    en = sorted(x["energy"] for x in rows)
    t1, t2 = en[len(en) // 3], en[2 * len(en) // 3]
    for x in rows:
        x["energy_class"] = "soft" if x["energy"] < t1 else "medium" if x["energy"] < t2 else "dynamic"
        # Suggested use: what most briefs ask for
        if x["energy_class"] == "dynamic" or x["bounce"]:
            x["use_for"] = "Dynamic video / social / hype"
        elif x["energy_class"] == "soft":
            x["use_for"] = "Corporate / explainer / UI"
        else:
            x["use_for"] = "General / presentations"
    out = ROOT / "catalog"
    out.mkdir(exist_ok=True)
    (out / "catalog.json").write_text(json.dumps({"energy_thresholds": [t1, t2], "items": rows}, ensure_ascii=False), encoding="utf-8")
    with open(out / "catalog.csv", "w", newline="", encoding="utf-8-sig") as fh:
        w = csv.DictWriter(fh, fieldnames=list(rows[0].keys()))
        w.writeheader()
        w.writerows(rows)

    from collections import Counter
    print(f"{len(rows)} items · energy tertiles {t1:.3f} / {t2:.3f}")
    print("real bounce:", sum(x["bounce"] for x in rows), f"({100 * sum(x['bounce'] for x in rows) / len(rows):.0f}%)")
    for k in PRODUCTS:
        sub = [x for x in rows if x["product"] == k]
        if not sub:
            continue
        ec = Counter(x["energy_class"] for x in sub)
        fam = Counter(x["in_family"] for x in sub).most_common(3)
        inf = sorted(x["in_frames"] for x in sub)
        print(f"\n{k:>5} {PRODUCTS[k]:24s} n={len(sub):4d}  energy {dict(ec)}  bounce {sum(x['bounce'] for x in sub)}")
        print(f"       median entry {inf[len(inf) // 2]}f · entry curves {fam}")
        if PRODUCTS[k] in ISOLATED:
            print("       categories:", Counter(x["category"] for x in sub).most_common(5))


if __name__ == "__main__":
    main()
