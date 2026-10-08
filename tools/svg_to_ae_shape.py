"""Convierte un path SVG (M/L/H/V/C/Z absolutos) a vértices de Shape de After Effects (JSON).

Uso: python svg_to_ae_shape.py <archivo.svg> <salida.json>
Salida: {"viewBox":[w,h], "fill":"#hex", "paths":[{"v":[[x,y]..], "i":[[dx,dy]..], "o":[[dx,dy]..], "closed":true}]}
Coordenadas centradas en el viewBox (0,0 = centro) para que el anchor quede en el medio.
"""
import json
import re
import sys
from pathlib import Path


def parse(d):
    tokens = re.findall(r"[MLHVCZmlhvcz]|-?\d*\.?\d+(?:e-?\d+)?", d)
    paths, cur, i, cmd = [], None, 0, None
    pos = (0.0, 0.0)

    def num():
        nonlocal i
        v = float(tokens[i])
        i += 1
        return v

    while i < len(tokens):
        if re.match(r"[A-Za-z]", tokens[i]):
            cmd = tokens[i]
            i += 1
        if cmd in "Mm":
            cur = {"pts": [], "in": [], "out": [], "closed": False}
            paths.append(cur)
            pos = (num(), num())
            cur["pts"].append(pos); cur["in"].append((0, 0)); cur["out"].append((0, 0))
            cmd = "L"
        elif cmd == "L":
            pos = (num(), num())
            cur["pts"].append(pos); cur["in"].append((0, 0)); cur["out"].append((0, 0))
        elif cmd == "H":
            pos = (num(), pos[1])
            cur["pts"].append(pos); cur["in"].append((0, 0)); cur["out"].append((0, 0))
        elif cmd == "V":
            pos = (pos[0], num())
            cur["pts"].append(pos); cur["in"].append((0, 0)); cur["out"].append((0, 0))
        elif cmd == "C":
            c1, c2, p = (num(), num()), (num(), num()), (num(), num())
            last = cur["pts"][-1]
            cur["out"][-1] = (c1[0] - last[0], c1[1] - last[1])
            cur["pts"].append(p); cur["in"].append((c2[0] - p[0], c2[1] - p[1])); cur["out"].append((0, 0))
            pos = p
        elif cmd in "Zz":
            cur["closed"] = True
            # si el último punto repite el primero, fusionarlos
            if len(cur["pts"]) > 1 and abs(cur["pts"][-1][0] - cur["pts"][0][0]) < 0.05 and abs(cur["pts"][-1][1] - cur["pts"][0][1]) < 0.05:
                cur["in"][0] = cur["in"][-1]
                for k in ("pts", "in", "out"):
                    cur[k].pop()
            cmd = None
        else:
            raise ValueError(f"Comando SVG no soportado: {cmd}")
    return paths


def main():
    svg = Path(sys.argv[1]).read_text(encoding="utf-8")
    vb = [float(x) for x in re.search(r'viewBox="([^"]+)"', svg).group(1).split()]
    fill = re.search(r'<path[^>]*fill="([^"]+)"', svg).group(1)
    d = re.search(r'\sd="([^"]+)"', svg).group(1)
    cx, cy = vb[0] + vb[2] / 2, vb[1] + vb[3] / 2
    out = {"viewBox": vb[2:], "fill": fill, "paths": []}
    for p in parse(d):
        out["paths"].append({
            "v": [[round(x - cx, 3), round(y - cy, 3)] for x, y in p["pts"]],
            "i": [[round(a, 3), round(b, 3)] for a, b in p["in"]],
            "o": [[round(a, 3), round(b, 3)] for a, b in p["out"]],
            "closed": p["closed"],
        })
    Path(sys.argv[2]).write_text(json.dumps(out), encoding="utf-8")
    print(f'{len(out["paths"])} path(s), {sum(len(p["v"]) for p in out["paths"])} vértices')


if __name__ == "__main__":
    main()
