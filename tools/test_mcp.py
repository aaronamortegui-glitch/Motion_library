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
    ("run_jsx", {"code": setup}, lambda t: "ok" in t),
    ("list_layers", {"comp": COMP}, lambda t: "Title" in t and "Chip" in t),
    ("apply_preset", {"preset": "Surge Rise", "layers": ["Chip"], "comp": COMP, "duration": 1.5, "intensity": 0.7, "direction": "mirror vertical", "ease": "Settle"}, lambda t: "Chip" in t),
    ("apply_preset", {"preset": "Chars Ramp", "layers": ["Title"], "comp": COMP}, lambda t: "Title" in t),
    ("show_in_panel", {"kind": "motion", "name": "Surge Rise"}, lambda t: len(t) > 0),
    ("render_frame", {"comp": COMP, "time_s": 0.5}, lambda t: ".png" in t),
    ("check_layout", {"comps": [COMP]}, lambda t: t.startswith("layout QA")),
    ("apply_transition", {"preset": "Whip Pan", "outgoing": "Chip", "incoming": "Title", "comp": COMP, "at_s": 1.0}, lambda t: "leaves as" in t),
    ("remove_animation", {"layers": ["Chip", "Title"], "comp": COMP}, lambda t: "cleared" in t),
    ("apply_pack", {"pack": "Calm Modern", "comp": COMP}, lambda t: "→" in t or "->" in t),
    ("list_brands", {}, lambda t: "motion-dna" in t),
    ("get_brand", {"slug": "motion-dna"}, lambda t: "## Layout" in t and "Snap" in t),
    ("remove_animation", {"layers": ["Chip", "Title"], "comp": COMP}, lambda t: "cleared" in t),
    ("apply_brand", {"slug": "motion-dna", "comp": COMP}, lambda t: "Motion DNA: style Playful" in t),
    ("add_asset", {"name": "Swoosh Transition 28", "type": "sfx", "comp": COMP, "time_s": 0.2}, lambda t: "added" in t),
    ("add_brand_note", {"slug": "mcp-test", "rule": "Product shots glide in, never pop", "category": "motion", "why": "test"},
     lambda t: "Product shots glide in" in t),
    ("matte", {"source": str(PHOTO), "out": str(TMP / "product_cutout.png")}, lambda t: t.startswith("matte:") or NO_GPU in t),
    ("run_jsx", {"code": f'''var c = null; for (var i = 1; i <= app.project.numItems; i++) if (app.project.item(i).name === "{COMP}") c = app.project.item(i);
var L = c.layers.add(app.project.importFile(new ImportOptions(new File({json.dumps(PHOTO.as_posix())})))); L.name = "Product"; L.moveToEnd();
c.layer("Title").moveToBeginning(); return "photo ok";'''}, lambda t: "photo ok" in t),
    ("text_behind", {"subject": "Product", "text": "Title", "comp": COMP}, lambda t: "is behind Product" in t or NO_GPU in t),
    ("run_jsx", {"code": f'for (var i = app.project.numItems; i >= 1; i--) {{ var it = app.project.item(i); if (it.name === "{COMP}" || (it instanceof FootageItem && it.file && it.file.fsName.indexOf("_mcp_test") >= 0)) it.remove(); }} return "removed";'}, lambda t: "removed" in t),
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
