"""Genera research/style_map/style_map.html a partir de research/style_map/catalog.json.

Uso: python -I tools/style_research/build_map.py
"""
import base64
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
MAP = ROOT / "research" / "style_map"
cat = json.loads((MAP / "catalog.json").read_text(encoding="utf-8"))


def rhythm(parts):
    if parts["motion"] > parts["cuts"] + 1:
        return "Flow"
    if parts["cuts"] > parts["motion"] + 1:
        return "Cut-driven"
    return "Mixed"


for v in cat["videos"]:
    thumb = MAP / v["thumb"]
    if thumb.exists():  # embebida para que el HTML funcione suelto
        v["thumb"] = "data:image/jpeg;base64," + base64.b64encode(thumb.read_bytes()).decode()
    v["tone_score"] = round(sum(s[0] for s in v["tone"].values()), 1)
    v["energy"] = v["metrics"]["energy_score"]
    v["rhythm"] = rhythm(v["metrics"]["energy_parts"])

TEMPLATE = r"""<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Motion Style Map</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link href="https://fonts.googleapis.com/css2?family=Inter+Tight:wght@400;500;600;700&family=Instrument+Serif&display=swap" rel="stylesheet">
<style>
/* Superside Essentials (assets/figma_essentials/palette.json) · same system as library/index.html */
:root{
  --pine:#0A211F; --sea:#174A46; --cloud:#F7F9F2; --spark:#D8FF85; --coral:#FF9595; --grey:#818C88;
  --bg:var(--pine); --surface:#10302D; --card:var(--sea); --text:var(--cloud); --muted:#A9B5B0; --line:#24504B;
  --eyebrow:var(--spark); --chip-on-bg:var(--spark); --chip-on-text:var(--pine);
  /* family colors, validated for normal vision + CVD on the dark surface */
  --fam-1:var(--grey); --fam-2:var(--spark); --fam-3:var(--coral); --fam-4:#B39DFF;
}
@media (prefers-color-scheme: light){
  :root:not([data-theme="dark"]){ --bg:#F7F9F2; --surface:#ECF0E4; --card:#FFFFFF; --text:#0A211F; --muted:#4F5F5A; --line:#D7DECF;
    --eyebrow:#2F6B2A; --fam-1:#0A211F; --fam-2:#4E8A1E; --fam-3:#E25C5C; --fam-4:#7B3FC4; }
}
:root[data-theme="light"]{ --bg:#F7F9F2; --surface:#ECF0E4; --card:#FFFFFF; --text:#0A211F; --muted:#4F5F5A; --line:#D7DECF;
  --eyebrow:#2F6B2A; --fam-1:#0A211F; --fam-2:#4E8A1E; --fam-3:#E25C5C; --fam-4:#7B3FC4; }
*{box-sizing:border-box}
body{margin:0;background:var(--bg);color:var(--text);font-family:"Inter Tight",system-ui,sans-serif;line-height:1.45}
.wrap{max-width:1240px;margin:0 auto;padding:40px 16px 80px}
.eyebrow{color:var(--eyebrow);font-weight:600;letter-spacing:.02em}
h1{font-family:"Instrument Serif",serif;font-weight:400;font-size:clamp(44px,7vw,84px);line-height:1;margin:.25em 0 .3em}
h2{font-family:"Instrument Serif",serif;font-weight:400;font-size:36px;margin:56px 0 12px}
p.lead{max-width:760px;color:var(--muted);font-size:18px;margin:0}
.bar{display:flex;flex-wrap:wrap;gap:10px;align-items:center;margin:32px 0 20px}
.chip{border:1px solid var(--line);background:transparent;color:var(--text);border-radius:999px;padding:8px 16px;font:inherit;font-weight:500;cursor:pointer;display:inline-flex;align-items:center;gap:8px}
.chip[aria-pressed="true"]{background:var(--chip-on-bg);color:var(--chip-on-text);border-color:var(--chip-on-bg)}
.chip .sw{width:10px;height:10px;border-radius:50%;flex:none;box-shadow:0 0 0 1.5px var(--card)}
.grid{display:grid;grid-template-columns:minmax(0,1fr) 360px;gap:12px}
@media (max-width:900px){.grid{grid-template-columns:1fr}}
.card{background:var(--card);border:1px solid var(--line);border-radius:14px;padding:18px}
.chart-wrap{position:relative;background:var(--surface)}
svg{display:block;width:100%;height:auto;overflow:visible}
.axis text{fill:var(--muted);font-size:11px;font-family:"Inter Tight",system-ui,sans-serif}
.axis-title{fill:var(--muted);font-size:12px;font-weight:600;font-family:"Inter Tight",system-ui,sans-serif}
.gridline{stroke:var(--line);stroke-width:1}
.zone{stroke-width:1.5;stroke-dasharray:5 4;fill-opacity:.08}
.zone-label{font-size:11.5px;font-weight:600;font-family:"Inter Tight",system-ui,sans-serif}
.pt{cursor:pointer;outline:none}
.pt .mark{stroke:var(--surface);stroke-width:2}
.pt .halo{stroke:var(--text);stroke-width:1.5;fill:none}
.pt:focus-visible .hit{stroke:var(--text);stroke-width:1;stroke-dasharray:2 2}
.pt text{fill:var(--text);font-size:12.5px;font-weight:600;font-family:"Inter Tight",system-ui,sans-serif;paint-order:stroke;stroke:var(--surface);stroke-width:4px;stroke-linejoin:round}
.tip{position:absolute;pointer-events:none;background:var(--surface);border:1px solid var(--line);border-radius:14px;padding:8px;width:230px;box-shadow:0 10px 30px rgba(0,0,0,.25);font-size:12.5px;display:none;z-index:5}
.tip img{width:100%;aspect-ratio:16/9;object-fit:cover;border-radius:10px;display:block;margin-bottom:6px}
.tip b{font-size:14px}
.tip .m{color:var(--muted)}
.legend{display:flex;flex-wrap:wrap;gap:6px 16px;margin-top:12px;color:var(--muted);font-size:12.5px}
.legend span{display:inline-flex;align-items:center;gap:6px}
.legend svg{width:auto;flex:none}
.detail img{width:100%;aspect-ratio:16/9;object-fit:cover;border-radius:10px;display:block;margin-bottom:12px;background:var(--pine)}
.detail h3{font-family:"Instrument Serif",serif;font-weight:400;font-size:30px;line-height:1.05;margin:0 0 6px}
.badge{font-size:11px;font-weight:600;border-radius:999px;padding:3px 10px;white-space:nowrap;display:inline-block}
.fambadge{color:var(--pine)}
.kv{display:grid;grid-template-columns:110px 1fr;gap:5px 10px;font-size:13px;margin:12px 0}
.kv dt{color:var(--muted)}
.kv dd{margin:0}
.meter{height:6px;border-radius:3px;background:var(--surface);margin:4px 0 0;overflow:hidden}
.meter i{display:block;height:100%;border-radius:3px;background:var(--muted)}
.sec{font-size:12px;color:var(--eyebrow);font-weight:600;letter-spacing:.02em;margin:16px 0 6px}
.rub{font-size:13px;margin:0;padding:0;list-style:none}
.rub li{margin:0 0 6px}
.rub .s{font-variant-numeric:tabular-nums;font-weight:600;display:inline-block;width:30px}
.rub .r{color:var(--muted)}
.sig{font-size:13.5px;margin:0}
.detail a{color:var(--text)}
.empty{color:var(--muted);padding:24px 0;margin:0}
.tablecard{overflow-x:auto;padding:6px 6px}
table{width:100%;border-collapse:collapse;font-size:13px}
th,td{text-align:left;padding:10px 12px;border-bottom:1px solid var(--line);vertical-align:top}
tr:last-child td{border-bottom:0}
th{color:var(--muted);font-weight:600;font-size:12px}
td.n{font-variant-numeric:tabular-nums}
tbody tr{cursor:pointer}
tbody tr:hover,tbody tr.sel{background:var(--surface)}
.note{color:var(--muted);font-size:12.5px;margin:10px 0 0}
footer{margin-top:64px;color:var(--muted);font-size:13px}
</style>
</head>
<body>
<div class="wrap">
  <div class="eyebrow">Superside · AI Native Studio</div>
  <h1>Motion Style Map</h1>
  <p class="lead" id="lead"></p>
  <div class="bar" id="filters" role="toolbar" aria-label="Filter by style family"></div>
  <div class="grid">
    <div class="card chart-wrap">
      <svg id="chart" viewBox="0 0 760 560" role="img" aria-label="Map of reference videos by measured energy and scored tone"></svg>
      <div class="tip" id="tip"></div>
      <div class="legend" id="legend"></div>
      <p class="note">Energy is measured from the video (cuts, % of time in motion, speed). Tone is scored with the rubric in taxonomy.md. Dashed zones show the observed range of each family (min–max of its videos).</p>
    </div>
    <div class="card detail" id="detail"><p class="empty">Select a video on the map or in the table to see its profile.</p></div>
  </div>
  <h2>References</h2>
  <div class="card tablecard">
    <table>
      <thead><tr><th>Video</th><th>Family</th><th>Format</th><th>Mood</th><th>Cast</th><th>Motion</th><th>Rhythm</th><th>Energy</th><th>Tone</th><th>Cuts/min</th><th>% moving</th><th>Music</th></tr></thead>
      <tbody id="rows"></tbody>
    </table>
  </div>
  <footer>Generated by tools/style_research/build_map.py · taxonomy in research/style_map/taxonomy.md · <span id="count"></span></footer>
</div>
<script>
const DATA = __DATA__;
const FAM = {"01 Elegant":"--fam-1","02 Playful reel":"--fam-2","03 Character":"--fam-3","04 Mixed media (proposed)":"--fam-4"};
// zones = observed range of each family (min–max of its videos, padded), recomputed from the data
const ZONES = Object.keys(FAM).map(fam=>{
  const vs=DATA.videos.filter(v=>v.family===fam); if(!vs.length) return null;
  const xs=vs.map(v=>v.energy), ys=vs.map(v=>v.tone_score), pad=0.35;
  return {fam, n:vs.length, x0:Math.max(0,Math.min(...xs)-pad), x1:Math.min(10,Math.max(...xs)+pad), y0:Math.max(0,Math.min(...ys)-pad), y1:Math.min(10,Math.max(...ys)+pad)};
}).filter(Boolean);
const SHAPES = {"Abstract shapes":"circle","Typography":"square","Product / UI":"triangle","Characters":"diamond","Live footage":"hex","Mixed":"cross"};
const W=760,H=560,M={l:56,r:20,t:20,b:52};
const sx=v=>M.l+(v/10)*(W-M.l-M.r), sy=v=>H-M.b-(v/10)*(H-M.t-M.b);
const NS="http://www.w3.org/2000/svg";
const el=(t,a={},p)=>{const e=document.createElementNS(NS,t);for(const k in a)e.setAttribute(k,a[k]);if(p)p.appendChild(e);return e};
const col=f=>`var(${FAM[f]||"--muted"})`;
let active=new Set(Object.keys(FAM)), selected=null;

function shapePath(s,r){
  switch(s){
    case "square": return `M${-r*.85},${-r*.85}h${r*1.7}v${r*1.7}h${-r*1.7}z`;
    case "triangle": return `M0,${-r*1.1}L${r},${r*.75}L${-r},${r*.75}z`;
    case "diamond": return `M0,${-r*1.15}L${r*1.15},0L0,${r*1.15}L${-r*1.15},0z`;
    case "hex": {let p="";for(let i=0;i<6;i++){const a=Math.PI/3*i;p+=(i?"L":"M")+(r*Math.cos(a)).toFixed(2)+","+(r*Math.sin(a)).toFixed(2)}return p+"z"}
    case "cross": return `M${-r*.35},${-r}h${r*.7}v${r*.65}h${r*.65}v${r*.7}h${-r*.65}v${r*.65}h${-r*.7}v${-r*.65}h${-r*.65}v${-r*.7}h${r*.65}z`;
    default: return `M${-r},0a${r},${r} 0 1,0 ${r*2},0a${r},${r} 0 1,0 ${-r*2},0`;
  }
}

function drawChart(){
  const svg=document.getElementById("chart"); svg.innerHTML="";
  const ax=el("g",{class:"axis"},svg);
  for(let i=0;i<=10;i+=2){
    el("line",{x1:sx(i),x2:sx(i),y1:sy(0),y2:sy(10),class:"gridline"},ax);
    el("line",{x1:sx(0),x2:sx(10),y1:sy(i),y2:sy(i),class:"gridline"},ax);
    el("text",{x:sx(i),y:sy(0)+18,"text-anchor":"middle"},ax).textContent=i;
    el("text",{x:sx(0)-10,y:sy(i)+4,"text-anchor":"end"},ax).textContent=i;
  }
  el("text",{x:sx(0),y:H-10,class:"axis-title"},svg).textContent="← Calm";
  el("text",{x:sx(10),y:H-10,class:"axis-title","text-anchor":"end"},svg).textContent="High-paced →";
  el("text",{x:sx(5),y:H-10,class:"axis-title","text-anchor":"middle"},svg).textContent="Energy (measured)";
  const yt=el("text",{class:"axis-title","text-anchor":"middle",transform:`translate(16 ${sy(5)}) rotate(-90)`},svg); yt.textContent="Tone (rubric)";
  el("text",{class:"axis-title","text-anchor":"start",transform:`translate(16 ${sy(0)}) rotate(-90)`},svg).textContent="Restrained";
  el("text",{class:"axis-title","text-anchor":"end",transform:`translate(16 ${sy(10)}) rotate(-90)`},svg).textContent="Expressive";
  for(const z of ZONES){
    if(!active.has(z.fam)) continue;
    el("rect",{x:sx(z.x0)+2,y:sy(z.y1)+2,width:sx(z.x1)-sx(z.x0)-4,height:sy(z.y0)-sy(z.y1)-4,rx:10,class:"zone",fill:col(z.fam),stroke:col(z.fam)},svg);
    const t=el("text",{x:sx(z.x0)+10,y:sy(z.y1)+18,class:"zone-label",fill:col(z.fam)},svg); t.textContent=z.fam.replace(" (proposed)","")+` · ${z.n} video${z.n>1?"s":""}`+(z.fam.includes("(proposed)")?" (proposed)":"");
  }
  const vis=DATA.videos.filter(v=>active.has(v.family));
  for(const v of vis){
    const g=el("g",{class:"pt"+(selected===v.id?" sel":""),transform:`translate(${sx(v.energy)} ${sy(v.tone_score)})`,tabindex:0,role:"button","aria-label":`${v.title}: energy ${v.energy}, tone ${v.tone_score}`},svg);
    el("circle",{r:16,fill:"transparent"},g);
    if(selected===v.id) el("circle",{r:13,class:"halo"},g);
    el("path",{d:shapePath(SHAPES[v.cast]||"circle",8),fill:col(v.family),class:"mark"},g);
    const lbl=el("text",{x:13,y:4,class:"lbl"},g); let short=v.title.split(" — ")[0].split(" · ")[0].replace(/["“”]/g,""); lbl.textContent=short.length>16?short.slice(0,15)+"…":short;
    g.addEventListener("mouseenter",e=>showTip(v,g));
    g.addEventListener("mouseleave",hideTip);
    g.addEventListener("focus",()=>showTip(v,g));
    g.addEventListener("blur",hideTip);
    g.addEventListener("click",()=>select(v.id));
    g.addEventListener("keydown",e=>{if(e.key==="Enter"||e.key===" "){e.preventDefault();select(v.id)}});
  }
  // keep labels readable: hide a label when it overlaps one already placed (selected point wins)
  const lbls=[...svg.querySelectorAll(".pt")].sort((a,b)=>(b.classList.contains("sel"))-(a.classList.contains("sel"))).map(g=>g.querySelector(".lbl"));
  const placed=[], marks=[...svg.querySelectorAll(".pt .mark")].map(m=>m.getBoundingClientRect());
  const hit=(a,b)=>!(a.right<b.left||b.right<a.left||a.bottom<b.top||b.bottom<a.top);
  for(const t of lbls){ const r=t.getBoundingClientRect();
    if(placed.some(p=>hit(p,r))||marks.some(m=>hit(m,r))) t.style.display="none"; else placed.push(r); }
}

function showTip(v,g){
  const tip=document.getElementById("tip"), wrap=tip.parentElement, r=g.getBoundingClientRect(), wr=wrap.getBoundingClientRect();
  tip.innerHTML=`<img src="${v.thumb}" alt=""><b>${v.title}</b><div class="m">${v.family} · ${v.substyle||""}</div><div>Energy ${v.energy} · Tone ${v.tone_score} · ${v.rhythm}</div><div class="m">${v.music&&v.music.audio?v.music.bpm+" BPM · "+v.music.verdict:""}</div><div class="m">${v.mood.join(", ")}</div>`;
  tip.style.display="block";
  let x=r.left-wr.left+20, y=r.top-wr.top-10;
  if(x+230>wr.width) x=r.left-wr.left-240;
  tip.style.left=x+"px"; tip.style.top=Math.max(0,y)+"px";
}
function hideTip(){document.getElementById("tip").style.display="none"}

function bar(label,val,max,unit=""){
  return `<dt>${label}</dt><dd>${val}${unit}<div class="meter"><i style="width:${Math.min(100,val/max*100)}%"></i></div></dd>`;
}
function musicBlock(v){
  const a=v.music; if(!a||!a.audio) return "";
  const pct=x=>x==null?"—":Math.round(x*100)+"%";
  return `<div class="sec">Music & edit</div>
    <dl class="kv">
      <dt>Tempo</dt><dd>${a.bpm} BPM · pulse ${a.pulse_clarity}</dd>
      <dt>Edit vs beat</dt><dd>${a.verdict}</dd>
      <dt>Cuts on beat</dt><dd>${pct(a.cuts_on_beat)} (chance ${pct(a.chance_on_beat)}) · half-beat ${pct(a.cuts_on_half_beat)}</dd>
      <dt>Shot length</dt><dd>${a.median_shot_beats==null?"—":a.median_shot_beats+" beats (median)"}</dd>
    </dl>${a.summary?`<p class="sig">${a.summary}</p>`:""}`;
}
function select(id){
  selected=id; const v=DATA.videos.find(x=>x.id===id); const m=v.metrics;
  const rub=Object.entries(v.tone).map(([k,[s,r]])=>`<li><span class="s">${s}</span>${k.replace("_"," / ").replace("_"," ")} <span class="r">— ${r}</span></li>`).join("");
  document.getElementById("detail").innerHTML=`
    <img src="${v.thumb}" alt="Frame from ${v.title}">
    <h3>${v.title}</h3>
    <span class="badge fambadge" style="background:${col(v.family)};color:var(--bg)">${v.family}${v.substyle?" · "+v.substyle:""}</span>
    <dl class="kv">
      <dt>Format</dt><dd>${v.format}</dd>
      <dt>Mood</dt><dd>${v.mood.join(", ")}</dd>
      <dt>Cast</dt><dd>${v.cast}</dd>
      <dt>Space</dt><dd>${v.space}</dd>
      <dt>Motion</dt><dd>${v.motion_language}</dd>
      <dt>Transitions</dt><dd>${v.transitions.join(", ")}</dd>
      <dt>Rhythm</dt><dd>${v.rhythm}</dd>
    </dl>
    <div class="sec">Measured</div>
    <dl class="kv">
      ${bar("Energy",v.energy,10)}
      ${bar("Cuts / min",m.cuts_per_min,120)}
      ${bar("% moving",m.motion_pct,100,"%")}
      ${bar("Speed",m.speed_pct_width_per_s,60,"% w/s")}
      ${bar("Colorfulness",m.colorfulness,80)}
      <dt>Avg shot</dt><dd>${m.avg_shot_s}s</dd>
      <dt>Median hold</dt><dd>${m.hold_median_s}s (max ${m.hold_max_s}s)</dd>
      <dt>Duration</dt><dd>${m.duration_s}s @ ${m.fps}fps</dd>
    </dl>
    ${musicBlock(v)}
    <div class="sec">Tone ${v.tone_score} / 10</div>
    <ul class="rub">${rub}</ul>
    <div class="sec">Signature</div>
    <p class="sig">${v.signature}</p>
    <p class="note"><a href="../../${v.analysis}">Full analysis</a></p>`;
  drawChart(); drawRows();
}

function drawRows(){
  const tb=document.getElementById("rows"); tb.innerHTML="";
  for(const v of DATA.videos.filter(v=>active.has(v.family))){
    const tr=document.createElement("tr"); if(selected===v.id) tr.className="sel";
    tr.innerHTML=`<td><b>${v.title}</b></td><td><span style="color:${col(v.family)}">●</span> ${v.family}${v.substyle?" · "+v.substyle:""}</td><td>${v.format}</td><td>${v.mood.join(", ")}</td><td>${v.cast}</td><td>${v.motion_language}</td><td>${v.rhythm}</td><td class="n">${v.energy}</td><td class="n">${v.tone_score}</td><td class="n">${v.metrics.cuts_per_min}</td><td class="n">${v.metrics.motion_pct}%</td><td>${v.music&&v.music.audio?v.music.bpm+" BPM · "+v.music.verdict:"—"}</td>`;
    tr.addEventListener("click",()=>select(v.id)); tb.appendChild(tr);
  }
}

function drawFilters(){
  const f=document.getElementById("filters");
  for(const fam of Object.keys(FAM)){
    const n=DATA.videos.filter(v=>v.family===fam).length;
    const b=document.createElement("button"); b.className="chip"; b.setAttribute("aria-pressed","true");
    b.innerHTML=`<span class="sw" style="background:${col(fam)}"></span>${fam} (${n})`;
    b.addEventListener("click",()=>{active.has(fam)?active.delete(fam):active.add(fam);b.setAttribute("aria-pressed",active.has(fam));drawChart();drawRows()});
    f.appendChild(b);
  }
}
function drawLegend(){
  const lg=document.getElementById("legend"); let h="";
  for(const fam of Object.keys(FAM)) h+=`<span><svg width="12" height="12" viewBox="-6 -6 12 12"><circle r="5" fill="${col(fam)}"/></svg>${fam}</span>`;
  for(const [c,s] of Object.entries(SHAPES)) h+=`<span><svg width="14" height="14" viewBox="-7 -7 14 14"><path d="${shapePath(s,5)}" fill="var(--muted)"/></svg>${c}</span>`;
  lg.innerHTML=h;
}
document.getElementById("lead").textContent="Every reference video placed by how much energy it carries (measured from the video) and how expressive its tone is (scored with the rubric). Each point opens its profile: tags, measurements, tone score and motion signature.";
document.getElementById("count").textContent=`${DATA.videos.length} videos`;
drawFilters(); drawLegend(); drawChart(); drawRows();
</script>
</body>
</html>
"""

out = MAP / "style_map.html"
out.write_text(TEMPLATE.replace("__DATA__", json.dumps(cat, ensure_ascii=False)), encoding="utf-8")
print(out)
