"""The Agent's head as a 3D model (GLB), modelled in code with three.js and exported with its GLTFExporter, so the
library has a product of its own for the 3D turntable (tools/web_fx/helix3d.html, option model) and for Blender: no
third-party model, no licence to track. Colours from the character file.

Usage: python tools/make_robot_glb.py            # -> assets/models/the-agent_head.glb
"""
import base64
import json
import pathlib
import sys

ROOT = pathlib.Path(__file__).resolve().parent.parent
OUT = ROOT / "assets/models/the-agent_head.glb"

PAGE = r"""<!doctype html><meta charset="utf-8"><script type="importmap">{ "imports": { "three": "https://cdn.jsdelivr.net/npm/three@0.186.1/build/three.module.js",
  "three/addons/": "https://cdn.jsdelivr.net/npm/three@0.186.1/examples/jsm/" } }</script>
<script type="module">
import * as THREE from "three";
import { RoundedBoxGeometry } from "three/addons/geometries/RoundedBoxGeometry.js";
import { GLTFExporter } from "three/addons/exporters/GLTFExporter.js";
const P = __PAL__, m = (c, o = {}) => new THREE.MeshStandardMaterial(Object.assign({ color: c, roughness: .45 }, o));
const head = new THREE.Group(); head.name = "The Agent head";
const shell = new THREE.Mesh(new RoundedBoxGeometry(2.4, 2.05, 1.6, 6, .32), m(P.cream)); shell.name = "Shell"; head.add(shell);
const bezel = new THREE.Mesh(new RoundedBoxGeometry(1.95, 1.5, .2, 5, .16), m(P.cream_lo || P.cream, { roughness: .6 })); bezel.position.z = .78; bezel.name = "Bezel"; head.add(bezel);
const glass = new THREE.Mesh(new RoundedBoxGeometry(1.7, 1.25, .1, 5, .12), m(P.glass || "#0B2A26", { roughness: .15, metalness: .1 })); glass.position.z = .86; glass.name = "Screen"; head.add(glass);
const eyeM = m(P.eye || "#8DFDBA", { emissive: P.eye || "#8DFDBA", emissiveIntensity: 1.6 });
for (const x of [-.38, .38]) { const e = new THREE.Mesh(new RoundedBoxGeometry(.22, .38, .04, 3, .05), eyeM); e.position.set(x, .12, .92); e.name = "Eye"; head.add(e); }
const smile = new THREE.Mesh(new THREE.TorusGeometry(.26, .045, 8, 24, Math.PI), eyeM); smile.rotation.z = Math.PI; smile.position.set(0, -.22, .92); smile.name = "Smile"; head.add(smile);
const ant = new THREE.Mesh(new THREE.CylinderGeometry(.045, .045, .7, 12), m(P.cream_deep || P.cream)); ant.position.set(.62, 1.35, 0); ant.rotation.z = -.25; ant.name = "Antenna"; head.add(ant);
const tip = new THREE.Mesh(new THREE.SphereGeometry(.11, 20, 14), m(P.red || "#E2402F", { emissive: P.red || "#E2402F", emissiveIntensity: .6 })); tip.position.set(.71, 1.7, 0); tip.name = "Antenna tip"; head.add(tip);
for (const s of [-1, 1]) { const ear = new THREE.Mesh(new THREE.CylinderGeometry(.22, .22, .16, 24), m(P.cream_lo || P.cream)); ear.rotation.z = Math.PI / 2; ear.position.set(s * 1.26, 0, 0); ear.name = "Ear"; head.add(ear); }
new GLTFExporter().parse(head, b => { const u = new Uint8Array(b); let s = ""; for (let i = 0; i < u.length; i++) s += String.fromCharCode(u[i]); window.GLB = btoa(s); }, e => { window.GLB = "ERR " + e; }, { binary: true });
</script>"""


def main():
    sys.path.insert(0, str(ROOT / "tools")); from sound_kit import browser
    from playwright.sync_api import sync_playwright
    C = json.loads((ROOT / "library/characters/the-agent/character.json").read_text(encoding="utf-8"))
    pal = {k: v["hex"] for k, v in C["palette"].items()}
    with sync_playwright() as p:
        b = browser(p); pg = b.new_page(); pg.set_content(PAGE.replace("__PAL__", json.dumps(pal)))
        pg.wait_for_function("window.GLB", timeout=60000); g = pg.evaluate("window.GLB"); b.close()
    if g.startswith("ERR"): sys.exit(g)
    OUT.parent.mkdir(parents=True, exist_ok=True); OUT.write_bytes(base64.b64decode(g)); print(OUT.relative_to(ROOT), OUT.stat().st_size // 1024, "KB")


if __name__ == "__main__":
    main()
