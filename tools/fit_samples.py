"""Ajusta curvas bezier a las propiedades muestreadas de CALIBRATION (samples_*.json).

Por propiedad animada: separa fases (entrada/salida) donde el valor cambia, normaliza a progreso 0→1,
ajusta un cubic-bezier CSS (x1,y1,x2,y2) y reporta duración, overshoot y el token más cercano.
Uso: python fit_samples.py <samples.json> [--plot carpeta] [--out resumen.json]
"""
import argparse
import json
from pathlib import Path

import numpy as np
from scipy.optimize import minimize

TOKENS = json.loads((Path(__file__).resolve().parent.parent / "tokens" / "superside_motion_tokens.json").read_text(encoding="utf-8"))


def bez(p, xs):
    x1, y1, x2, y2 = p
    t = np.linspace(0, 1, 1500)
    bx = 3 * (1 - t) ** 2 * t * x1 + 3 * (1 - t) * t ** 2 * x2 + t ** 3
    by = 3 * (1 - t) ** 2 * t * y1 + 3 * (1 - t) * t ** 2 * y2 + t ** 3
    order = np.argsort(bx)
    return np.interp(xs, bx[order], by[order])


def fit(prog):
    xs = np.linspace(0, 1, len(prog))
    err = lambda p: np.mean((bez(np.clip(p, [0, -1, 0, -1], [1, 2.5, 1, 2.5]), xs) - prog) ** 2)
    best = None
    for init in ([0.42, 0, 0.58, 1], [0, 0, 0.2, 1], [0.6, 0, 1, 1], [0.3, 1.5, 0.6, 1]):
        r = minimize(err, init, method="Nelder-Mead", options={"xatol": 1e-4, "fatol": 1e-7, "maxiter": 4000})
        if best is None or r.fun < best.fun:
            best = r
    p = np.clip(best.x, [0, -1, 0, -1], [1, 2.5, 1, 2.5])
    return [round(float(v), 3) for v in p], float(np.sqrt(best.fun))


def magnitude(v):
    v = np.asarray(v, dtype=float)
    return v if v.ndim == 1 else v  # se maneja por componente abajo


def phases(values, thr=1e-3):
    v = np.asarray(values, dtype=float)
    if v.ndim == 1:
        v = v[:, None]
    span = np.ptp(v, axis=0)
    if span.max() < 1e-6:
        return []
    comp = int(np.argmax(span))  # componente que más cambia
    s = v[:, comp]
    d = np.abs(np.diff(s)) > thr * (span[comp] or 1)
    segs, start = [], None
    for i, a in enumerate(d):
        if a and start is None:
            start = i
        elif not a and start is not None:
            segs.append((start, i)); start = None
    if start is not None:
        segs.append((start, len(d)))
    # unir segmentos separados por 1 frame quieto (ej. overshoot que pasa por 0 velocidad)
    merged = []
    for sg in segs:
        if merged and sg[0] - merged[-1][1] <= 2:
            merged[-1] = (merged[-1][0], sg[1])
        else:
            merged.append(sg)
    out = []
    for a, b in merged:
        seg = s[a:b + 1]
        if b - a < 2:
            continue
        v0, v1 = seg[0], seg[-1]
        rng = v1 - v0
        if abs(rng) < 1e-6:  # va y vuelve (pulso): normalizar por el pico
            pk = seg[np.argmax(np.abs(seg - v0))]
            prog = (seg - v0) / ((pk - v0) or 1)
            out.append({"start": a, "end": b, "comp": comp, "from": round(float(v0), 3), "to": round(float(v1), 3), "pulse": True, "prog": prog})
            continue
        prog = (seg - v0) / rng
        out.append({"start": a, "end": b, "comp": comp, "from": round(float(v0), 3), "to": round(float(v1), 3), "pulse": False, "prog": prog})
    return out


def nearest_token(p):
    best, bd = None, 9
    xs = np.linspace(0, 1, 100)
    for e in TOKENS["easings"]:
        d = float(np.sqrt(np.mean((bez(e["bezier"], xs) - bez(p, xs)) ** 2)))
        if d < bd:
            best, bd = e["name"], d
    return best, round(bd, 3)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("src")
    ap.add_argument("--plot")
    ap.add_argument("--out")
    a = ap.parse_args()
    data = json.loads(Path(a.src).read_text(encoding="utf-8"))
    fps = data["fps"]
    summary = []
    for L in data["layers"]:
        print(f'\n## {L["layer"]}  markers={L["markers"]}')
        rows = []
        for P in L["props"]:
            for ph in phases(P["values"]):
                n = ph["end"] - ph["start"]
                over = float(max(ph["prog"].max() - 1, -ph["prog"].min(), 0))
                p, rmse = fit(np.clip(ph["prog"], -1, 2.5)) if not ph["pulse"] else ([None] * 4, 0)
                tok = nearest_token(p) if not ph["pulse"] else ("pulse", 0)
                row = {"prop": P["path"], "start_f": ph["start"], "frames": n, "ms": round(n / fps * 1000),
                       "from": ph["from"], "to": ph["to"], "bezier": p, "fit_rmse": round(rmse, 4),
                       "overshoot": round(over, 3), "nearest_token": tok[0], "token_dist": tok[1], "pulse": ph["pulse"],
                       "progress": [round(float(x), 4) for x in ph["prog"]]}
                rows.append(row)
                print(f'  {P["path"][-45:]:45s} f{ph["start"]:>3}-{ph["end"]:<3} {n:>2}f {row["ms"]:>4}ms  '
                      f'{ph["from"]}→{ph["to"]}  bez={p}  over={over:.2f}  ~{tok[0]}({tok[1]})' + ("  PULSO" if ph["pulse"] else ""))
        summary.append({"layer": L["layer"], "markers": L["markers"], "phases": rows})
        if a.plot and rows:
            import matplotlib
            matplotlib.use("Agg")
            import matplotlib.pyplot as plt
            Path(a.plot).mkdir(parents=True, exist_ok=True)
            fig, ax = plt.subplots(figsize=(6, 3.4))
            for r in rows:
                ax.plot(np.linspace(0, 1, len(r["progress"])), r["progress"], lw=2,
                        label=f'{r["prop"].split("/")[-1]} f{r["start_f"]} {r["frames"]}f ~{r["nearest_token"]}')
            ax.axhline(1, color="grey", lw=0.5); ax.axhline(0, color="grey", lw=0.5)
            ax.set_title(L["layer"][:70], fontsize=8)
            ax.legend(fontsize=6)
            fig.tight_layout()
            fig.savefig(Path(a.plot) / (L["layer"][:2] + ".png"), dpi=110)
            plt.close(fig)
    if a.out:
        Path(a.out).write_text(json.dumps(summary, ensure_ascii=False, indent=1), encoding="utf-8")


if __name__ == "__main__":
    main()
