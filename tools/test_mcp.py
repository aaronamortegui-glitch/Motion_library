"""Calls every tool of the MCP server (tools/mcp/ss_motion_mcp.py) over stdio JSON-RPC, as Claude would, and checks the
answers. The AE tools run against a temporary comp in the open After Effects (bridge active), removed at the end.
  python tools/test_mcp.py   ->  research/tests/mcp_report.json
"""
import json
import pathlib
import shutil
import subprocess
import sys

ROOT = pathlib.Path(__file__).resolve().parent.parent
p = subprocess.Popen([sys.executable, str(ROOT / "tools/mcp/ss_motion_mcp.py")], stdin=subprocess.PIPE, stdout=subprocess.PIPE,
                     stderr=subprocess.DEVNULL, text=True, encoding="utf-8", cwd=ROOT)
nid = 0


def rpc(method, params=None):
    global nid
    nid += 1
    p.stdin.write(json.dumps({"jsonrpc": "2.0", "id": nid, "method": method, "params": params or {}}) + "\n")
    p.stdin.flush()
    return json.loads(p.stdout.readline())


def call(tool, args):
    r = rpc("tools/call", {"name": tool, "arguments": args})
    res = r.get("result", {})
    text = "".join(c.get("text", "") for c in res.get("content", []))
    return (not res.get("isError")) and "error" not in r, text


rpc("initialize", {"protocolVersion": "2024-11-05", "capabilities": {}, "clientInfo": {"name": "test", "version": "1"}})
tools = [t["name"] for t in rpc("tools/list")["result"]["tools"]]
COMP = "_MCP_TEST"
# matte, text_behind and add_brand_note write files: they work on copies in research/_mcp_test (git-ignored)
import time  # noqa: E402
shutil.rmtree(ROOT / "research/_mcp_test", ignore_errors=True)   # earlier runs (After Effects may still hold a file: then it stays, git-ignored)
TMP = ROOT / "research/_mcp_test" / time.strftime("%Y%m%d-%H%M%S"); TMP.mkdir(parents=True, exist_ok=True)
PHOTO = TMP / "product_car_side.jpg"; shutil.copy(ROOT / "research/tests/fixtures/product_car_side.jpg", PHOTO)
subprocess.run([sys.executable, str(ROOT / "tools/brand.py"), "new", "mcp-test", "--name", "MCP Test", "--dir", str(TMP / "brand")],
               capture_output=True, cwd=ROOT)
NO_GPU = "ComfyUI's Python not found"   # matte needs the local InSPyReNet setup: elsewhere these two are skipped, not failed
setup = f"""var c = app.project.items.addComp("{COMP}", 1280, 720, 1, 4, 30);
var t = c.layers.addText("Motion DNA"); t.name = "Title";
var s = c.layers.addShape(); s.name = "Chip"; var v = s.property("ADBE Root Vectors Group").addProperty("ADBE Vector Group").property("ADBE Vectors Group");
v.addProperty("ADBE Vector Shape - Rect"); v.addProperty("ADBE Vector Graphic - Fill");
c.openInViewer(); return "ok";"""
checks = [
    ("ae_status", {}, lambda t: t.startswith("AE ") and "panel" in t),
    ("list_presets", {"kind": "motion", "energy": "soft"}, lambda t: "Fade" in t),
    ("list_packs", {}, lambda t: "Calm Modern" in t and "tones" in t),
    ("list_tags", {"role": "transition"}, lambda t: "Whip Pan" in t),
    ("suggest_mix", {"role": "enter", "target": "title", "tones": ["elegant"], "energy": 2}, lambda t: "apply_preset" in t),
    ("match_reference", {"profile_path": "library/references/google-calm-modern.json"}, lambda t: "Gaps" in t),
    ("list_assets", {"type": "sfx", "limit": 3}, lambda t: len(t) > 0),
    ("list_resources", {"category": "music"}, lambda t: "[music]" in t and "CC0" in t),
    ("list_resources", {"query": "explosion", "include_excluded": True}, lambda t: "Unity Labs" in t),
    ("run_jsx", {"code": setup}, lambda t: "ok" in t),
    ("list_layers", {"comp": COMP}, lambda t: "Title" in t and "Chip" in t),
    ("resize_comp", {"comp": COMP}, lambda t: f"{COMP} · 9x16 (1080x1920, reflow)" in t and "1x1" in t and "4x5" in t and "layout QA: 3 comps" in t),
    ("resize_comp", {"comp": COMP, "sizes": ["1200x628"], "mode": "fit", "check": False}, lambda t: "(1200x628, fit)" in t and "layout QA" not in t),
    ("render_frame", {"comp": f"{COMP} · 9x16", "time_s": 0.5}, lambda t: ".png" in t),
    ("apply_preset", {"preset": "Surge Rise", "layers": ["Chip"], "comp": COMP, "duration": 1.5, "intensity": 0.7, "direction": "mirror vertical", "ease": "Settle"}, lambda t: "Chip" in t),
    ("apply_preset", {"preset": "Chars Ramp", "layers": ["Title"], "comp": COMP}, lambda t: "Title" in t),
    ("show_in_panel", {"kind": "motion", "name": "Surge Rise"}, lambda t: len(t) > 0),
    ("render_frame", {"comp": COMP, "time_s": 0.5}, lambda t: ".png" in t),
    ("check_layout", {"comps": [COMP]}, lambda t: t.startswith("layout QA")),
    ("apply_transition", {"preset": "Whip Pan", "outgoing": "Chip", "incoming": "Title", "comp": COMP, "at_s": 1.0}, lambda t: "leaves as" in t),
    ("solid_transition", {"energy": 4}, lambda t: "Color Stack" in t),
    ("solid_transition", {"look": "Slanted Bars", "at_s": 1.0, "comp": COMP, "brand": "motion-dna"}, lambda t: "covers the frame at 1" in t),
    ("solid_transition", {"type": "zoom", "at_s": 2.0, "comp": COMP, "outgoing": "Chip", "incoming": "Title"}, lambda t: "Chip → Title (zoom)" in t),
    ("add_element", {"kind": "lower_third", "text": "Dana Ruiz", "sub": "Head of Design", "comp": COMP, "t": 0.5, "out": 3.0, "brand": "motion-dna"}, lambda t: "EL · lower third" in t),
    ("add_element", {"kind": "underline", "layer": "Title", "comp": COMP, "t": 0.5}, lambda t: "EL · underline" in t),
    ("list_kit", {"kind": "element", "energy": 4}, lambda t: "kinetic" in t),
    ("add_shape", {"kind": "impact", "comp": COMP, "t": 0.3, "spread": 90, "brand": "motion-dna"}, lambda t: "SH · impact" in t),
    ("add_element", {"kind": "counter", "comp": COMP, "t": 0.2, "start": 0, "value": 1200, "prefix": "$"}, lambda t: "EL · counter" in t),
    ("add_look", {"kind": "grain", "comp": COMP}, lambda t: "LK · grain" in t),
    ("add_look", {"kind": "dots", "comp": COMP, "brand": "motion-dna"}, lambda t: "BG · dots" in t),
    ("add_look", {"kind": "network", "comp": COMP, "brand": "motion-dna"}, lambda t: "BG · network" in t),
    ("add_look", {"kind": "glass", "comp": COMP}, lambda t: "BG · glass" in t),
    ("add_element", {"kind": "glass_card", "text": "Glass card", "sub": "Frosted and smoky", "comp": COMP, "t": 0.3}, lambda t: "GL · rim" in t),
    ("add_shape", {"kind": "blob", "comp": COMP, "t": 0.2}, lambda t: "SH · blob" in t),
    ("add_element", {"kind": "end_card", "text": "Motion DNA", "sub": "The motion library", "comp": COMP, "t": 0.1}, lambda t: "EL · end card" in t),
    ("add_element", {"kind": "end_card", "style": "horizontal", "comp": COMP, "t": 0.1}, lambda t: "EL · end card" in t),
    ("solid_transition", {"look": "Liquid Wipe", "at_s": 2.5, "comp": COMP}, lambda t: "covers the frame" in t),
    ("solid_transition", {"look": "Ink Drop", "at_s": 3.5, "comp": COMP}, lambda t: "covers the frame" in t),
    ("add_behavior", {}, lambda t: "fill · bubbles" in t and "modifier · line_boil" in t),
    ("add_behavior", {"behavior": "bubbles", "target": "shape", "comp": COMP, "t": 0.3, "brand": "motion-dna"}, lambda t: "BH · bubbles" in t),
    ("add_behavior", {"behavior": "voronoi", "target": "background", "comp": COMP}, lambda t: "BG · voronoi" in t),
    ("add_behavior", {"behavior": "flow", "target": "background", "comp": COMP}, lambda t: "BG · flow" in t),
    ("add_behavior", {"behavior": "bubbles", "target": "text", "layer": "Title", "comp": COMP, "t": 0.2}, lambda t: "matte for Title" in t),
    ("add_behavior", {"behavior": "spring", "target": "box", "element": "EL · lower third 1", "comp": COMP}, lambda t: "spring box" in t),
    ("add_behavior", {"behavior": "rope", "target": "shape", "layer": "Title", "comp": COMP, "t": 0.4}, lambda t: "BH · rope" in t),
    ("add_behavior", {"behavior": "grow", "target": "shape", "comp": COMP, "t": 0.2, "origin": "bottom"}, lambda t: "BH · grow" in t),
    ("add_behavior", {"behavior": "bubbles", "target": "transition", "at_s": 1.5, "comp": COMP}, lambda t: "covers the frame at 1.5" in t),
    ("add_behavior", {"behavior": "line_boil", "target": "layer", "layers": ["Chip"], "comp": COMP}, lambda t: "line boil on 3s" in t),
    ("add_behavior", {"behavior": "flock", "target": "background", "comp": COMP}, lambda t: "does not pass" in t),
    ("solid_transition", {"look": "Shatter", "at_s": 2.0, "comp": COMP}, lambda t: "covers the frame" in t),
    ("move", {"move": "hinge", "layers": ["Chip"], "comp": COMP, "t": 0.2, "edge": "left"}, lambda t: "hinge in" in t),
    ("animate_text", {"layers": ["Title"], "comp": COMP, "unit": "chars", "channels": ["fade", "rise"], "ease": "Pop", "t": 0.2}, lambda t: "SS Text" in t),
    ("add_captions", {"comp": COMP, "words": [{"w": "Motion", "s": 0.2, "e": 0.5}, {"w": "DNA", "s": 0.5, "e": 0.9}], "style": "highlight"}, lambda t: "caption lines" in t),
    ("keyframes", {"action": "ease", "layers": ["Chip"], "comp": COMP, "type": "Settle"}, lambda t: t.startswith("eased")),
    ("keyframes", {"action": "stagger", "layers": ["Chip", "Title"], "comp": COMP, "frames": 4}, lambda t: t.startswith("staggered 2 layers")),
    ("keyframes", {"action": "mirror_out", "layers": ["Chip"], "comp": COMP}, lambda t: t.startswith("mirrored")),
    ("keyframes", {"action": "copy_to", "source": "Chip", "layers": ["Title"], "comp": COMP}, lambda t: t.startswith("copied")),
    ("anchor_point", {"where": "bottom-left", "layers": ["Chip"], "comp": COMP}, lambda t: "anchor" in t),
    ("remove_animation", {"layers": ["Chip", "Title"], "comp": COMP}, lambda t: "cleared" in t),
    ("apply_pack", {"pack": "Calm Modern", "comp": COMP}, lambda t: "→" in t or "->" in t),
    ("list_brands", {}, lambda t: "motion-dna" in t),
    ("get_brand", {"slug": "motion-dna"}, lambda t: "## Layout" in t and "Snap" in t),
    ("remove_animation", {"layers": ["Chip", "Title"], "comp": COMP}, lambda t: "cleared" in t),
    ("apply_brand", {"slug": "motion-dna", "comp": COMP}, lambda t: "Motion DNA: style Playful" in t),
    ("apply_pack", {"pack": "Collage", "comp": COMP, "layers": ["Title"]}, lambda t: "line boil" in t),
    ("add_asset", {"name": "Swoosh Transition 28", "type": "sfx", "comp": COMP, "time_s": 0.2}, lambda t: "added" in t),
    ("add_asset", {"name": "Explosion02HD", "type": "vfx", "comp": COMP, "time_s": 0.5, "scale": 60}, lambda t: "added VFX" in t or "not found" in t),
    ("add_brand_note", {"slug": "mcp-test", "rule": "Product shots glide in, never pop", "category": "motion", "why": "test"},
     lambda t: "Product shots glide in" in t),
    ("matte", {"source": str(PHOTO), "out": str(TMP / "product_cutout.png")}, lambda t: t.startswith("matte:") or NO_GPU in t),
    ("run_jsx", {"code": f'''var c = null; for (var i = 1; i <= app.project.numItems; i++) if (app.project.item(i).name === "{COMP}") c = app.project.item(i);
var L = c.layers.add(app.project.importFile(new ImportOptions(new File({json.dumps(PHOTO.as_posix())})))); L.name = "Product"; L.moveToEnd();
c.layer("Title").moveToBeginning(); return "photo ok";'''}, lambda t: "photo ok" in t),
    ("text_behind", {"subject": "Product", "text": "Title", "comp": COMP}, lambda t: "is behind Product" in t or NO_GPU in t),
    ("run_jsx", {"code": f'for (var i = app.project.numItems; i >= 1; i--) {{ var it = app.project.item(i); if (it.name === "{COMP}" || it.name.indexOf("{COMP} · ") === 0 || (it instanceof FootageItem && it.file && (it.file.fsName.indexOf("_mcp_test") >= 0 || it.file.fsName.indexOf("assets.free") >= 0)) || (it instanceof FootageItem && /^(TR · |BG · |LK · )/.test(it.name))) it.remove(); }} return "removed";'}, lambda t: "removed" in t),
]
report, ok_n = [], 0
for name, args, check in checks:
    ok, text = call(name, args)
    good = ok and check(text)
    ok_n += good
    report.append({"tool": name, "ok": good, "args": args if name != "run_jsx" else {"code": "…"}, "answer": text[:300]})
    skip = NO_GPU in text
    print(("SKIP " if skip else "PASS " if good else "FAIL ") + name + ("  (no local GPU matte here)" if skip else "" if good else "  ->  " + text[:200].replace("\n", " ")))
tested = {c[0] for c in checks} | {"render_comp"}
print(f"{ok_n}/{len(checks)} calls passed · tools listed: {len(tools)} · not exercised: {sorted(set(tools) - tested) or 'none'} (render_comp skipped: it blocks AE)")
(ROOT / "research/tests").mkdir(parents=True, exist_ok=True)
json.dump(report, open(ROOT / "research/tests/mcp_report.json", "w", encoding="utf-8"), indent=1, ensure_ascii=False)
p.terminate()
# leave nothing behind: the temporary brand's registry entry and its folder
sys.path.insert(0, str(ROOT / "tools")); import brand as _b  # noqa: E402
reg = _b.LOCAL / "_registry.json"
if reg.exists():
    d = json.loads(reg.read_text(encoding="utf-8"))
    d["external"] = [x for x in d.get("external", []) if "_mcp_test" not in x]
    reg.write_text(json.dumps(d, indent=1) + "\n", encoding="utf-8")
shutil.rmtree(ROOT / "research/_mcp_test", ignore_errors=True)
