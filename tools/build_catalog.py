"""Reclasifica los resultados de analyze_previews.py con reglas calibradas y arma el catálogo.

Reglas (de research/calibration_fit.json):
- overshoot real ≈ 3–8 %, ocurre después del 40 % de la fase y termina asentado (|p_final − 1| < 2 %)
- energía por terciles globales → suave / medio / dinámico
Salida: catalog/catalog.json y catalog/catalog.csv
"""
import csv
import glob
import json
from pathlib import Path

import numpy as np

from analyze_previews import FAMILY_SAMPLES, CURVE_SAMPLES, fit_curve

ROOT = Path(__file__).resolve().parent.parent
PRODUCTS = {  # tipo de pack según los previews revisados
    "42": "Texto", "43": "Elemento/Logo In-Out", "3260": "Shapes y líneas", "3297": "Shapes y líneas",
    "3266": "Transición con footage", "3283": "Títulos y callouts", "3300": "Pack mixto", "2014": "Transición flat 2D",
}
# El método mide un elemento aislado: en estos tipos los canales no son confiables
ISOLATED = {"Elemento/Logo In-Out", "Shapes y líneas"}


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
    """Frames entre 2 % y 98 % del progreso (sin colas quietas) y progreso recortado a ese tramo."""
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
        return n, "corte", "Flat"
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
        x["energy_class"] = "suave" if x["energy"] < t1 else "medio" if x["energy"] < t2 else "dinámico"
        # Uso sugerido: lo que la mayoría de briefs piden
        if x["energy_class"] == "dinámico" or x["bounce"]:
            x["use_for"] = "Video dinámico / social / hype"
        elif x["energy_class"] == "suave":
            x["use_for"] = "Corporativo / explicativo / UI"
        else:
            x["use_for"] = "General / presentaciones"
    out = ROOT / "catalog"
    out.mkdir(exist_ok=True)
    (out / "catalog.json").write_text(json.dumps({"energy_thresholds": [t1, t2], "items": rows}, ensure_ascii=False), encoding="utf-8")
    with open(out / "catalog.csv", "w", newline="", encoding="utf-8-sig") as fh:
        w = csv.DictWriter(fh, fieldnames=list(rows[0].keys()))
        w.writeheader()
        w.writerows(rows)

    from collections import Counter
    print(f"{len(rows)} items · terciles energía {t1:.3f} / {t2:.3f}")
    print("bounce real:", sum(x["bounce"] for x in rows), f"({100 * sum(x['bounce'] for x in rows) / len(rows):.0f}%)")
    for k in PRODUCTS:
        sub = [x for x in rows if x["product"] == k]
        if not sub:
            continue
        ec = Counter(x["energy_class"] for x in sub)
        fam = Counter(x["in_family"] for x in sub).most_common(3)
        inf = sorted(x["in_frames"] for x in sub)
        print(f"\n{k:>5} {PRODUCTS[k]:24s} n={len(sub):4d}  energía {dict(ec)}  bounce {sum(x['bounce'] for x in sub)}")
        print(f"       entrada mediana {inf[len(inf) // 2]}f · curvas entrada {fam}")
        if PRODUCTS[k] in ISOLATED:
            print("       categorías:", Counter(x["category"] for x in sub).most_common(5))


if __name__ == "__main__":
    main()
