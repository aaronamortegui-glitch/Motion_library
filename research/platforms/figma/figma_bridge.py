"""Motion DNA · Figma bridge, step 2: turns the tree read from Figma (read_frame.figma.js through the Figma MCP tool
use_figma) and the PNGs exported with get_screenshot into a manifest the Cavalry and Blender importers build from.

  python research/platforms/figma/figma_bridge.py <folder>        # reads <folder>/tree.json + <folder>/assets/<id>.png

The folder (one per Figma frame, inside the project, never the repo) ends up as:
  tree.json       what Figma returned (kept for reference)
  assets/         <node-id>.png (photos, gradients) and <node-id>.svg (vectors), named by Figma node id
  manifest.json   {frame, w, h, bg, layers: [...]} — flat, bottom to top, each layer with
                  name, id, kind (text|rect|ellipse|image|svg|group), box [x, y, w, h] in frame pixels (y down),
                  parent (group id or null), role, order (reading order for staggers), and its style
                  (fill, stroke, radius, opacity, rotation; text: string, font family/style, size, colour, tracking,
                  line height, align) or file.
Roles are the After Effects styles' roles (title, subtitle, body, shape, media, logo, background), from the Figma
layer name when it says so (e.g. "title", "logo / mark"), else from the layout (largest type = title…).
"""
import json
import pathlib
import re
import sys

ROLE_WORDS = {"title": "title", "headline": "title", "heading": "title", "subtitle": "subtitle", "kicker": "subtitle",
              "eyebrow": "subtitle", "body": "body", "copy": "body", "cta": "body", "price": "body", "legal": "body",
              "logo": "logo", "mark": "logo", "photo": "media", "image": "media", "media": "media", "video": "media",
              "bg": "background", "background": "background", "shape": "shape", "stripe": "shape"}
KIND = {"t": "text", "r": "rect", "e": "ellipse", "img": "image", "v": "svg", "g": "group"}


def role_from_name(name):
    for word in re.split(r"[^a-z]+", name.lower()):
        if word in ROLE_WORDS:
            return ROLE_WORDS[word]
    return None


def build(folder):
    folder = pathlib.Path(folder)
    tree = json.loads((folder / "tree.json").read_text(encoding="utf-8"))
    W, H = tree["w"], tree["h"]
    assets = folder / "assets"; assets.mkdir(exist_ok=True)
    layers = []

    def walk(nodes, parent):
        for n in nodes:   # Figma lists children bottom to top
            k = KIND.get(n.get("k"), "group")
            L = {"name": n["n"], "id": n["id"], "kind": k, "box": n["b"], "parent": parent}
            for key, out in (("o", "opacity"), ("rot", "rotation"), ("r", "radius"), ("clip", "clip")):
                if key in n:
                    L[out] = n[key]
            if "f" in n: L["fill"] = n["f"]
            if "st" in n: L["stroke"] = dict(n["st"], width=n.get("sw", 1))
            fid = n["id"].replace(":", "-").replace(";", "_")
            if k == "text":
                fam, _, style = n["g"]["f"].partition("|")
                L["text"] = {"string": n["s"], "family": fam, "style": style, "size": n["g"]["z"], "color": n["g"]["c"],
                             "tracking": n["g"].get("ls", 0), "line_height": n["g"].get("lh"), "align": {"L": "left", "C": "center", "R": "right", "J": "justified"}.get(n.get("al", "L"), "left")}
            if n.get("svg"):
                (assets / f"{fid}.svg").write_text(n["svg"], encoding="utf-8")
                L["file"] = f"assets/{fid}.svg"
            if n.get("png"):
                L["kind"] = "image"
                p = assets / f"{fid}.png"
                L["file"] = f"assets/{fid}.png" if p.exists() else None
                if not p.exists():
                    L["missing"] = "export this node with get_screenshot (contentsOnly) to " + p.as_posix()
            layers.append(L)
            if n.get("c"):
                walk(n["c"], n["id"])

    walk(tree["u"], None)

    # roles: the layer's own name first, then the layout
    texts = [l for l in layers if l["kind"] == "text"]
    biggest = max((l["text"]["size"] for l in texts), default=0)
    for l in layers:
        r = role_from_name(l["name"])
        if not r:
            x, y, w, h = l["box"]
            if l["kind"] == "text":
                s, z = l["text"], l["text"]["size"]
                if z >= 0.6 * biggest: r = "title"
                elif s["string"].isupper() or s["tracking"] > 0.1 * z: r = "subtitle"
                elif z >= 0.4 * biggest: r = "subtitle"
                else: r = "body"
            elif l["kind"] == "image":
                r = "background" if w >= 0.95 * W and h >= 0.95 * H else "media"
            elif l["kind"] == "svg":
                r = "logo" if w * h < 0.04 * W * H else "shape"
            elif l["kind"] in ("rect", "ellipse"):
                r = "background" if w >= 0.95 * W and h >= 0.95 * H else "shape"
            else:
                r = "group"
        l["role"] = r
    # reading order (top to bottom, then left to right) for staggers
    for i, l in enumerate(sorted(layers, key=lambda l: (round(l["box"][1] / 40), l["box"][0]))):
        l["order"] = i

    manifest = {"version": 1, "source": {"file": tree.get("file"), "node": tree["id"], "name": tree["name"]},
                "w": W, "h": H, "bg": tree.get("bg", "#000000"), "layers": layers}
    (folder / "manifest.json").write_text(json.dumps(manifest, indent=1, ensure_ascii=False) + "\n", encoding="utf-8")
    missing = [l["name"] for l in layers if l.get("missing")]
    roles = {}
    for l in layers: roles[l["role"]] = roles.get(l["role"], 0) + 1
    print(f"manifest: {len(layers)} layers · roles {roles}" + (f" · missing exports: {missing}" if missing else ""))
    return manifest


if __name__ == "__main__":
    build(sys.argv[1])
