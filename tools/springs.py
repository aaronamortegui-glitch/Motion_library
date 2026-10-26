"""Springs and named eases from open-source motion libraries, as Motion DNA data: library/springs.json.

Sources (both MIT, values copied from their code at the versions below):
  - react-spring 10.1.2 (pmndrs/react-spring, packages/core/src/constants.ts): the six `config` presets, mass 1.
  - anime.js 4.5.0 (juliangarnier/anime, src/easings/spring and src/easings/eases/parser.js): spring() from
    bounce + perceived duration, and the named eases outBack, outElastic, outBounce, outExpo, inOutCirc.
Each entry carries the curve sampled 0..1 (61 points), how long a spring takes to settle and how far it overshoots,
the closest Motion DNA token curve (so a brief that says "wobbly" maps onto our system), and an After Effects
expression that plays the curve between a property's first two keyframes (MCP apply_spring).

Usage: python tools/springs.py   (rewrites library/springs.json)
"""
import json, math, pathlib

ROOT = pathlib.Path(__file__).resolve().parent.parent
N = 61


def spring_fn(k, c, m=1.0):
    """Unit step response of a damped spring (start 0, rest 1, no initial velocity), physical time in seconds."""
    w0 = math.sqrt(k / m); z = c / (2 * math.sqrt(k * m))
    if z < 1:
        wd = w0 * math.sqrt(1 - z * z)
        return (lambda s: 1 - math.exp(-z * w0 * s) * (math.cos(wd * s) + z * w0 / wd * math.sin(wd * s))), w0, z
    if z == 1:
        return (lambda s: 1 - (1 + w0 * s) * math.exp(-w0 * s)), w0, z
    r1, r2 = -w0 * (z - math.sqrt(z * z - 1)), -w0 * (z + math.sqrt(z * z - 1))
    return (lambda s: 1 - (r2 * math.exp(r1 * s) - r1 * math.exp(r2 * s)) / (r2 - r1)), w0, z


def settle(f, eps=0.0005, hold=0.2, step=0.002, cap=10.0):
    """First time after which the curve stays within eps of rest for good (anime.js uses .0005 and 200 ms)."""
    t, last_out = 0.0, 0.0
    while t < cap:
        if abs(1 - f(t)) > eps: last_out = t
        elif t - last_out > hold: return round(last_out, 3)
        t += step
    return cap


def anime_bd(bounce=0.5, duration_ms=628):
    """anime.js spring({ bounce, duration }) -> stiffness and damping (Spring.calculateSDFromBD, timeScale 1)."""
    pds = duration_ms / 1000; s = (2 * math.pi / pds) ** 2
    d = (1 - bounce) * 4 * math.pi / pds if bounce >= 0 else 4 * math.pi / (pds * (1 + bounce))
    return round(s, 3), round(min(d, 300), 3)


def bezier(x1, y1, x2, y2):
    def at(x):
        lo, hi = 0.0, 1.0
        for _ in range(40):
            t = (lo + hi) / 2; bx = 3 * (1 - t) ** 2 * t * x1 + 3 * (1 - t) * t * t * x2 + t ** 3
            lo, hi = (t, hi) if bx < x else (lo, t)
        t = (lo + hi) / 2; return 3 * (1 - t) ** 2 * t * y1 + 3 * (1 - t) * t * t * y2 + t ** 3
    return at


back = lambda o=1.70158: (lambda t: 1 - ((o + 1) * (1 - t) ** 3 - o * (1 - t) ** 2))
def elastic(a=1.0, p=0.3):
    a = max(1.0, a); s = p / (2 * math.pi) * math.asin(1 / a); e = 2 * math.pi / p
    return lambda t: t if t in (0, 1) else 1 - (-a * 2 ** (-10 * t) * math.sin((t - s) * e))
def bounce_in(t):
    b = 4
    while True:
        b -= 1; p2 = 2 ** b
        if not t < (p2 - 1) / 11: break
    return 1 / 4 ** (3 - b) - 7.5625 * ((p2 * 3 - 2) / 22 - t) ** 2
NAMED = {   # anime.js 4.5.0 eases, written as out/inOut of their ease-in functions
    "anime outBack": (back(), "outBack (overshoot 1.7)", "1 - ((o + 1) * Math.pow(1 - p, 3) - o * Math.pow(1 - p, 2))", {"o": 1.70158}),
    "anime outElastic": (elastic(), "outElastic (amplitude 1, period .3)", "p == 0 || p == 1 ? p : 1 + Math.pow(2, -10 * p) * Math.sin((p - per / (2 * Math.PI) * Math.asin(1)) * 2 * Math.PI / per)", {"per": 0.3}),
    "anime outBounce": (lambda t: 1 - bounce_in(1 - t), "outBounce", None, {}),
    "anime outExpo": (lambda t: 1 - (2 ** (10 * (1 - t) - 10) if t < 1 else 0), "outExpo", "p >= 1 ? 1 : 1 - Math.pow(2, -10 * p)", {}),
    "anime inOutCirc": (lambda t: (1 - math.sqrt(1 - (2 * t) ** 2)) / 2 if t < .5 else 1 - (1 - math.sqrt(1 - (2 - 2 * t) ** 2)) / 2, "inOutCirc", None, {}),
}


def nearest_token(samples):
    toks = json.loads((ROOT / "tokens" / "superside_motion_tokens.json").read_text(encoding="utf-8"))["easings"]
    best = None
    for e in toks:
        f = bezier(*e["bezier"]); err = math.sqrt(sum((f(i / (N - 1)) - v) ** 2 for i, v in enumerate(samples)) / N)
        if best is None or err < best[1]: best = (e["name"], err)
    return {"name": best[0], "rms": round(best[1], 3)}


def expr(name, body, params):
    """AE expression: plays the curve between the property's first two keyframes (works on any dimension)."""
    head = "".join(f"var {k} = {v}; " for k, v in params.items())
    return (f"// Motion DNA · {name} (library/springs.json). Plays between keyframes 1 and 2; outside them, the keys hold.\n"
            f"if (numKeys < 2) value; else {{ var t0 = key(1).time, t1 = key(2).time, a = key(1).value, b = key(2).value;\n"
            f"  if (time <= t0) a; else if (time >= t1) b; else {{ var p = (time - t0) / (t1 - t0); {head}\n"
            f"    var q = {body};\n    a + (b - a) * q; }} }}")


def entry(name, kind, f, source, params, body=None, eparams=None, T=None):
    samples = [round(f(i / (N - 1) * (T or 1)), 4) for i in range(N)]
    e = {"name": name, "kind": kind, **source, "params": params, "samples": samples,
         "overshoot_pct": round(max(0.0, (max(samples) - 1) * 100), 1), "nearest_token": nearest_token(samples)}
    if T: e["settle_s"] = T
    if body: e["ae_expression"] = expr(name, body, eparams or {})
    return e


def build():
    rs = {"source": "react-spring", "version": "10.1.2", "license": "MIT", "url": "https://github.com/pmndrs/react-spring"}
    an = {"source": "anime.js", "version": "4.5.0", "license": "MIT", "url": "https://github.com/juliangarnier/anime"}
    out = []
    springs = [(f"react-spring {n}", rs, {"tension": k, "friction": c, "mass": 1}, k, c) for n, k, c in
               [("default", 170, 26), ("gentle", 120, 14), ("wobbly", 180, 12), ("stiff", 210, 20), ("slow", 280, 60), ("molasses", 280, 120)]]
    springs.append(("anime spring default", an, {"mass": 1, "stiffness": 100, "damping": 10}, 100, 10))
    for b, d in [(0.0, 500), (0.25, 600), (0.5, 628), (0.7, 800)]:
        s, dmp = anime_bd(b, d); springs.append((f"anime spring bounce {b:g} · {d} ms", an, {"bounce": b, "duration_ms": d, "stiffness": s, "damping": dmp}, s, dmp))
    for name, src, params, k, c in springs:
        f, w0, z = spring_fn(k, c); T = settle(f)
        if z < 1:
            wd = w0 * math.sqrt(1 - z * z)
            body = "1 - Math.exp(-z * w0 * s) * (Math.cos(wd * s) + z * w0 / wd * Math.sin(wd * s))"; ep = {"w0": round(w0, 5), "z": round(z, 5), "wd": round(wd, 5)}
        elif z == 1:
            body = "1 - (1 + w0 * s) * Math.exp(-w0 * s)"; ep = {"w0": round(w0, 5)}
        else:
            r1, r2 = -w0 * (z - math.sqrt(z * z - 1)), -w0 * (z + math.sqrt(z * z - 1))
            body = "1 - (r2 * Math.exp(r1 * s) - r1 * Math.exp(r2 * s)) / (r2 - r1)"; ep = {"r1": round(r1, 5), "r2": round(r2, 5)}
        ep["T"] = T; body = body.replace("s)", "(p * T))").replace("* s", "* (p * T)")
        out.append(entry(name, "spring", f, src, {**params, "damping_ratio": round(z, 3)}, body, ep, T))
    for name, (f, label, body, ep) in NAMED.items():
        out.append(entry(name, "ease", f, an, {"ease": label}, body, ep))
    data = {"note": "Springs and named eases from open-source libraries (values copied at the versions given). Generated by tools/springs.py; "
                    "samples are the curve 0..1 at 61 even steps (for a spring, over settle_s). Apply in AE with MCP apply_spring.", "curves": out}
    (ROOT / "library" / "springs.json").write_text(json.dumps(data, indent=1), encoding="utf-8")
    for e in out: print(f"{e['name']:<36} overshoot {e['overshoot_pct']:>5}%  settle {e.get('settle_s', '-'):>6}  ~ {e['nearest_token']['name']} ({e['nearest_token']['rms']})")


if __name__ == "__main__":
    build()
