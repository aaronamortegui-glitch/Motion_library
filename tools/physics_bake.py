"""2D physics for After Effects layers: simulate with matter.js (tools/physics/sim.html, MIT) and bake the result to
Position and Rotation keyframes. Used by the MCP tool physics; also runs on a JSON spec from the command line.

Modes (each layer is a box the size of its visible content, or a circle):
  fall     the layers fall from where they are onto the floor (the bottom of the comp) and pile up
  drop_in  they start above the frame, one after another, and fall into a pile on the floor
  burst    they fly out from the centre of the group, spinning, and fall (no floor, so they leave the frame)

Usage: python tools/physics_bake.py spec.json out.json     (spec: see tools/physics/sim.html)
"""
import json, math, os, random, sys
from playwright.sync_api import sync_playwright

HERE = os.path.dirname(os.path.abspath(__file__))
HOST = os.path.join(HERE, "physics", "sim.html")


def simulate(spec):
    sys.path.insert(0, HERE); from sound_kit import browser, url
    with sync_playwright() as p:
        b = browser(p); pg = b.new_page(); errors = []; pg.on("pageerror", lambda e: errors.append(str(e)))
        pg.goto(url(HOST, "")); pg.wait_for_function("typeof window.SIM === 'function' && !!window.Matter", timeout=30000)
        out = pg.evaluate("s => SIM(s)", spec); b.close()
    if errors: raise RuntimeError("; ".join(errors))
    return out


def spec_for(layers, comp, mode="fall", duration=3.0, gravity=1.0, bounce=0.25, stagger=0.12, seed=7):
    """layers: [{id, cx, cy, w, h, angle_deg, circle}] in comp pixels (centre of the visible content)."""
    r = random.Random(seed); W, H, fps = comp["w"], comp["h"], comp["fps"]
    gx = sum(l["cx"] for l in layers) / len(layers); gy = sum(l["cy"] for l in layers) / len(layers)
    bodies = []
    for i, l in enumerate(sorted(layers, key=lambda l: l["cy"])):
        b = {"id": l["id"], "x": l["cx"], "y": l["cy"], "w": max(4, l["w"]), "h": max(4, l["h"]), "angle": math.radians(l.get("angle_deg", 0)),
             "shape": "circle" if l.get("circle") else "rect", "restitution": bounce}
        if mode == "drop_in":
            b["y"] = -l["h"] - 40 - i * 30; b["x"] = l["cx"] + r.uniform(-20, 20); b["delay"] = i * stagger; b["va"] = r.uniform(-1.5, 1.5)
        elif mode == "burst":
            a = math.atan2(l["cy"] - gy, l["cx"] - gx) if (l["cx"], l["cy"]) != (gx, gy) else r.uniform(0, 2 * math.pi)
            sp = r.uniform(900, 1500); b.update(vx=math.cos(a) * sp, vy=math.sin(a) * sp - 900, va=r.uniform(-8, 8), restitution=bounce)
        bodies.append(b)
    return {"fps": fps, "duration": duration, "w": W, "h": H, "gravity": gravity, "floor": None if mode == "burst" else H, "walls": mode != "burst", "bodies": bodies}


if __name__ == "__main__":
    spec = json.load(open(sys.argv[1], encoding="utf-8"))
    json.dump(simulate(spec), open(sys.argv[2], "w", encoding="utf-8"))
