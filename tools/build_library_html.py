"""Generates library/index.html (SS Motion library viewer) from library.json and the tokens.

Usage: python tools/build_library_html.py
The data is embedded in the HTML so it works by opening the file directly (no server).
"""
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
lib = json.loads((ROOT / "library/library.json").read_text(encoding="utf-8"))
tok = json.loads((ROOT / "tokens/superside_motion_tokens.json").read_text(encoding="utf-8"))
# Harvested recipes → "recipe" entries (thumbnail = our reimplementation)
import re
EN = {"s": "soft", "m": "medium", "d": "dynamic"}
rp = ROOT / "library/recipes.json"
for r in (json.loads(rp.read_text(encoding="utf-8"))["recipes"] if rp.exists() else []):
    s = re.sub(r"[^a-z0-9]+", "-", r["id"].lower()).strip("-")
    lib["presets"].append({"name": r["name"] or r["id"], "slug": s, "kind": "recipe", "id": r["id"],
                           "channels": " & ".join(r["channels"]) + (" (loop)" if r["kind"] == "fx" else ""),
                           "energy": EN.get(r["energy"], r["energy"]), "use": (r["name"] + " · " if r["name"] else "") + "AC ref · " + (r["section"] or "?"),
                           "gif": f"gifs/recipe/{s}.gif", "call": f'SSP.applyRecipe(layer, "{r["id"]}", "both")'})
data = json.dumps({"presets": lib["presets"], "tokens": tok}, ensure_ascii=False)

HTML = r"""<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>SS Motion Library</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link href="https://fonts.googleapis.com/css2?family=Inter+Tight:wght@400;500;600;700&family=Instrument+Serif&display=swap" rel="stylesheet">
<style>
:root{
  --pine:#0A211F; --sea:#174A46; --cloud:#F7F9F2; --spark:#D8FF85; --coral:#FF9595; --grey:#818C88;
  --bg:var(--pine); --surface:#10302D; --card:var(--sea); --text:var(--cloud); --muted:#A9B5B0; --line:#24504B;
}
@media (prefers-color-scheme: light){
  :root:not([data-theme="dark"]){ --bg:#F7F9F2; --surface:#ECF0E4; --card:#FFFFFF; --text:#0A211F; --muted:#4F5F5A; --line:#D7DECF; }
}
:root[data-theme="light"]{ --bg:#F7F9F2; --surface:#ECF0E4; --card:#FFFFFF; --text:#0A211F; --muted:#4F5F5A; --line:#D7DECF; }
*{box-sizing:border-box}
body{margin:0;background:var(--bg);color:var(--text);font-family:"Inter Tight",system-ui,sans-serif;line-height:1.45}
.wrap{max-width:1240px;margin:0 auto;padding:40px 16px 80px}
.eyebrow{color:var(--spark);font-weight:600;letter-spacing:.02em}
:root[data-theme="light"] .eyebrow{color:#2F6B2A}
@media (prefers-color-scheme: light){:root:not([data-theme="dark"]) .eyebrow{color:#2F6B2A}}
h1{font-family:"Instrument Serif",serif;font-weight:400;font-size:clamp(44px,7vw,84px);line-height:1;margin:.25em 0 .3em}
h2{font-family:"Instrument Serif",serif;font-weight:400;font-size:36px;margin:56px 0 12px}
p.lead{max-width:760px;color:var(--muted);font-size:18px;margin:0}
.bar{display:flex;flex-wrap:wrap;gap:10px;align-items:center;margin:32px 0 20px}
.chip{border:1px solid var(--line);background:transparent;color:var(--text);border-radius:999px;padding:8px 16px;font:inherit;font-weight:500;cursor:pointer}
.chip[aria-pressed="true"]{background:var(--spark);color:var(--pine);border-color:var(--spark)}
.search{flex:1;min-width:200px;border:1px solid var(--line);background:var(--surface);color:var(--text);border-radius:999px;padding:9px 16px;font:inherit}
.sep{width:1px;height:28px;background:var(--line)}
.grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(180px,1fr));gap:12px}
.card{background:var(--card);border-radius:14px;overflow:hidden;display:flex;flex-direction:column;border:1px solid var(--line)}
.card img{display:block;width:100%;aspect-ratio:16/9;object-fit:cover;background:var(--pine)}
.body{padding:10px 12px 12px;display:flex;flex-direction:column;gap:4px;flex:1}
.row{display:flex;justify-content:space-between;align-items:center;gap:8px}
.name{font-weight:600;font-size:15px}
.badge{font-size:11px;font-weight:600;border-radius:999px;padding:3px 10px;white-space:nowrap}
.e-soft{background:#3B5C57;color:var(--cloud)} .e-medium{background:var(--spark);color:var(--pine)} .e-dynamic{background:var(--coral);color:var(--pine)}
.meta{color:var(--muted);font-size:12.5px}
code{font-family:ui-monospace,Consolas,monospace;font-size:10.5px}
.call{margin-top:auto;display:flex;gap:8px;align-items:center;background:var(--surface);border-radius:10px;padding:8px 10px}
.call code{flex:1;white-space:normal;word-break:break-word;line-height:1.35}
.copy{border:0;background:transparent;color:var(--muted);cursor:pointer;font:inherit;font-size:12px}
.tokens{display:grid;grid-template-columns:repeat(auto-fill,minmax(180px,1fr));gap:12px}
.tok{background:var(--surface);border-radius:16px;padding:14px}
.tok b{display:block;font-size:16px}
.tok svg{width:100%;height:70px;margin-top:6px}
.empty{color:var(--muted);padding:24px 0}
footer{margin-top:64px;color:var(--muted);font-size:13px}
</style>
</head>
<body>
<div class="wrap">
  <div class="eyebrow">Superside · AI Native Studio</div>
  <h1>SS Motion Library</h1>
  <p class="lead">Our own motion presets for After Effects, built with the Superside tokens. Each preset creates native keyframes and expressions: they are editable and do not depend on plugins.</p>

  <div class="bar" role="toolbar" aria-label="Filters">
    <button class="chip" data-kind="all" aria-pressed="true">All</button>
    <button class="chip" data-kind="motion" aria-pressed="false">Motion</button>
    <button class="chip" data-kind="fx" aria-pressed="false">Effects</button>
    <button class="chip" data-kind="text" aria-pressed="false">Text</button>
    <button class="chip" data-kind="recipe" aria-pressed="false">Recipes</button>
    <span class="sep"></span>
    <button class="chip" data-energy="soft" aria-pressed="false">Soft</button>
    <button class="chip" data-energy="medium" aria-pressed="false">Medium</button>
    <button class="chip" data-energy="dynamic" aria-pressed="false">Dynamic</button>
    <input class="search" type="search" placeholder="Search by name, channel or use…" aria-label="Search">
  </div>
  <div class="grid" id="grid"></div>

  <h2>Durations</h2>
  <div class="tokens" id="durs"></div>
  <h2>Easing curves</h2>
  <div class="tokens" id="eases"></div>

  <footer>Generated by tools/build_library_html.py · tokens v<span id="tv"></span></footer>
</div>
<script>
const DATA = __DATA__;
const QS = new URLSearchParams(location.search);
const POSTER = QS.get("poster") === "1";   // static mid-animation frames (for screenshots / video capture)
const state = { kind: QS.get("kind") || "all", energy: QS.get("energy"), q: "" };
const grid = document.getElementById("grid");
function card(p){
  const el = document.createElement("article");
  el.className = "card";
  el.innerHTML = `<img width="240" height="135" decoding="async" src="${POSTER ? p.gif.replace("gifs/", "posters/").replace(".gif", ".png") : p.gif}" alt="Preview of ${p.name}">
  <div class="body">
    <div class="row"><span class="name">${p.name}</span><span class="badge e-${p.energy}">${p.energy}</span></div>
    <div class="meta">${p.channels}</div>
    <div class="meta">${p.use}</div>
    <div class="call"><code>${p.call}</code><button class="copy">Copy</button></div>
  </div>`;
  el.querySelector(".copy").onclick = e => {
    try { navigator.clipboard.writeText(p.call); e.target.textContent = "Copied"; setTimeout(()=>e.target.textContent="Copy",1200); } catch(_){}
  };
  return el;
}
function render(){
  grid.innerHTML = "";
  const q = state.q.toLowerCase();
  const list = DATA.presets.filter(p =>
    (state.kind === "all" || p.kind === state.kind) &&
    (!state.energy || p.energy === state.energy) &&
    (!q || (p.name + " " + p.channels + " " + p.use).toLowerCase().includes(q)));
  if (!list.length) { grid.innerHTML = '<div class="empty">No preset matches the filter.</div>'; return; }
  list.forEach(p => grid.appendChild(card(p)));
}
document.querySelectorAll("[data-kind]").forEach(b => b.onclick = () => {
  state.kind = b.dataset.kind;
  document.querySelectorAll("[data-kind]").forEach(x => x.setAttribute("aria-pressed", x === b));
  render();
});
document.querySelectorAll("[data-energy]").forEach(b => b.onclick = () => {
  state.energy = state.energy === b.dataset.energy ? null : b.dataset.energy;
  document.querySelectorAll("[data-energy]").forEach(x => x.setAttribute("aria-pressed", x.dataset.energy === state.energy));
  render();
});
document.querySelector(".search").oninput = e => { state.q = e.target.value; render(); };
document.querySelectorAll("[data-kind]").forEach(x => x.setAttribute("aria-pressed", x.dataset.kind === state.kind));
document.querySelectorAll("[data-energy]").forEach(x => x.setAttribute("aria-pressed", x.dataset.energy === state.energy));

// Tokens
const T = DATA.tokens;
document.getElementById("tv").textContent = T.version;
document.getElementById("durs").innerHTML = T.durations.map(d =>
  `<div class="tok"><b>${d.name}</b><span class="meta">${d.frames} f · ${d.ms} ms</span><div class="meta">${d.use}</div></div>`).join("");
function curve(b){
  const [x1,y1,x2,y2] = b, W=160, H=60, pad=6;
  const X = v => pad + v*(W-2*pad), Y = v => H - pad - v*(H-2*pad)*0.8 - (H-2*pad)*0.1;
  return `<svg viewBox="0 0 ${W} ${H}" aria-hidden="true"><path d="M${X(0)} ${Y(0)} C${X(x1)} ${Y(y1)} ${X(x2)} ${Y(y2)} ${X(1)} ${Y(1)}" fill="none" stroke="currentColor" stroke-width="2.5"/></svg>`;
}
document.getElementById("eases").innerHTML = T.easings.map(e =>
  `<div class="tok"><b>${e.name}</b><code class="meta">${e.bezier.join(", ")}</code>${curve(e.bezier)}<div class="meta">${e.use}</div></div>`).join("");
render();
</script>
</body>
</html>
"""
# Ultra-compact index for LLMs: the only thing Claude needs to read (no HTML or images)
E = {"soft": "s", "medium": "m", "dynamic": "d"}
lines = [
    f"# SS Motion · {len(lib['presets'])} presets · tokens v{tok['version']} · energy s=soft m=medium d=dynamic",
    "# calls: motion SSP.apply(L,N,in|out|both) · fx SSP.applyFx(L,N) · text SSP.applyText(L,N,in|out|both) · recipe SSP.applyRecipe(L,ID,both) · include tools/ss_presets.jsx",
    "# dur(f@30): " + " ".join(f"{d['name']}{d['frames']}" for d in tok["durations"]),
    "# ease(bezier): " + "; ".join(f"{e['name']} {','.join(str(round(v, 2)) for v in e['bezier'])}" for e in tok["easings"]),
    "# packs: SSP.applyPack(comp, Dynamic|Elegant|Modern|Playful|Tech[, layers, in|out|both]) · roles title/subtitle/body/shape/media/logo · library/packs.json",
    "# markers: SSP.markerTiming(true) before apply → layer markers 'SS in'/'SS out' retime the animation when dragged · classics (family classic) = animate.css 4.1.1 MIT",
    "# mcp: .mcp.json → tools/mcp/ss_motion_mcp.py (list_presets, apply_preset, apply_pack, add_asset, render_frame, run_jsx…)",
    "# assets (local, licensed, not in repo): python tools/index_assets.py -> library/ASSETS.local.txt (sfx/overlays by category + loudness) · include tools/ss_assets.jsx · SSA.sfx(comp,name,t,gainDb[,len]) · SSA.overlay(comp,name,t[,blend,opacity])",
    "# hud: SSHUD.bracket/callout/meter/chip/contour/faceScan on TRK nulls · include tools/ss_hud.jsx · scenes: tools/build_scene.jsx + JSON (matte, behind text) · breakdown: tools/build_breakdown.jsx · edits: tools/build_edit.jsx + JSON · read docs/LEARNINGS.md",
    "# kind|name|channels|e|use",
]
lines += [f"{p['kind']}|{p.get('id', p['name'])}|{p['channels'].replace(' & ', '&').replace('Text · ', '')}|{E.get(p['energy'], p['energy'])}|{p['use']}" for p in lib["presets"]]
(ROOT / "library/INDEX.txt").write_text("\n".join(lines) + "\n", encoding="utf-8")
(ROOT / "library/index.html").write_text(HTML.replace("__DATA__", data), encoding="utf-8")
print("library/index.html", len(lib["presets"]), "presets")
