// Motion DNA panel (CEP) — UI. Reads the library straight from the repo (library/*.json, thumbnails, GIFs) and asks
// After Effects (host/host.jsx) only to apply or remove. Sections: Behaviors · Curves · Styles · Brands · Techniques.
"use strict";

const $ = (sel, el = document) => el.querySelector(sel);
const h = (tag, attrs = {}, ...kids) => {   // tiny element builder
  const e = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (k === "class") e.className = v; else if (k === "html") e.innerHTML = v;
    else if (k.startsWith("on")) e.addEventListener(k.slice(2), v); else if (v !== false && v != null) e.setAttribute(k, v === true ? "" : v);
  }
  for (const kid of kids.flat()) if (kid != null) e.append(kid.nodeType ? kid : document.createTextNode(kid));
  return e;
};
const store = {   // per-user conveniences (section, filters, favorites); the panel works without it
  get(k, d) { try { const v = localStorage.getItem("mdna." + k); return v == null ? d : JSON.parse(v); } catch (e) { return d; } },
  set(k, v) { try { localStorage.setItem("mdna." + k, JSON.stringify(v)); } catch (e) {} },
};

const S = {
  root: "", url: "", lib: [], recipes: [], tags: { presets: [], tones: [] }, tagOf: {}, packs: [], techniques: [],
  sec: store.get("section", "behaviors"), cat: store.get("cat", "Moves"), sel: null, phase: "in",
  favs: new Set(store.get("favs", [])), filters: {},
};
// search / energy / tone belong to each section: a filter set in Behaviors must not hide brands or curves
function curFilters() { return S.filters[S.sec] || (S.filters[S.sec] = { q: "", energy: 0, tone: "" }); }
for (const k of ["q", "energy", "tone"]) Object.defineProperty(S, k, { get: () => curFilters()[k], set: (v) => { curFilters()[k] = v; } });
const CATS = ["Moves", "Classics", "Text", "Loops", "Transitions", "Recipes", "★ Favorites"];
const EASES = ["Preset curve", "Land", "Coast", "Settle", "Launch", "Cruise", "Surge", "Ramp", "Whip", "Flat"];
const ENERGY_WORD = { s: "soft", m: "medium", d: "dynamic" };
const RANGE_OF = { soft: [1, 2], medium: [3, 3], dynamic: [4, 5] };

function asset(rel) { return S.url + rel; }
function slug(s) { return s.toLowerCase().replace(/__/g, "-").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, ""); }
function toast(msg, err) {
  const t = $("#toast"); t.textContent = msg; t.className = "toast" + (err ? " err" : ""); t.hidden = false;
  clearTimeout(toast.t); toast.t = setTimeout(() => (t.hidden = true), err ? 5000 : 2600);
}

// ---------- boot ----------
async function boot() {
  let info;
  if (IN_AE) {
    // re-read the host script on every load, so an updated host.jsx applies without restarting After Effects
    await evalHost(`try { $.evalFile(new File(${JSON.stringify(extensionPath() + "/host/host.jsx")})); "ok" } catch (e) { "ERR " + e }`);
    info = parse(await call("mdna_boot", extensionPath()));
    if (info.error) { $("#boot").textContent = info.error; return; }
    S.root = info.root; S.url = fileUrl(info.root) + "/";
    const f = new FontFace("Inter Tight", `url("${S.url}assets/fonts/InterTight%5Bwght%5D.ttf")`, { weight: "100 900" });
    f.load().then((ff) => document.fonts.add(ff)).catch(() => {});
  } else {
    S.url = new URL("../", location.href).href;
  }
  const [lib, tags, rec, packs, tech] = await Promise.all([
    readJSON(asset("library/library.json")), readJSON(asset("library/tags.json")).catch(() => ({ presets: [], tones: [] })),
    readJSON(asset("library/recipes.json")).catch(() => ({ recipes: [] })), readJSON(asset("library/packs.json")).catch(() => ({ packs: [] })),
    readJSON(asset("library/techniques.json")).catch(() => ({ techniques: [] })),
  ]);
  S.lib = lib.presets; S.tags = tags; S.packs = packs.packs; S.techniques = tech.techniques;
  for (const t of tags.presets || []) S.tagOf[t.name] = t;
  S.recipes = rec.recipes.map((r) => ({ name: r.id, slug: slug(r.id), kind: "recipe", channels: (r.channels || []).join(" & "),
    energy: ENERGY_WORD[r.energy] || r.energy, use: "Measured reference · " + (r.section || "") }));
  await loadCurves();
  $("#boot").remove();
  header(); tabs(); renderAll(); status(); setInterval(status, 4000);
}

// ---------- header ----------
async function status() {
  const s = parse(await call("mdna_status")), pill = $("#mcp");
  pill.classList.toggle("on", !!s.bridge); pill.classList.toggle("off", !s.bridge);
  const last = s.minutes >= 0 && s.minutes <= 1 ? " · active now" : (s.minutes > 1 && s.minutes < 60 ? ` · last ${s.minutes} min ago` : "");
  pill.title = s.bridge ? "Claude connected through MCP" + last : "Claude offline: click to connect";
}
function header() {
  $("#mcp").onclick = async () => { await call("mdna_connect"); status(); };
  $("#visualizer").onclick = () => call("mdna_open", S.root + "/library/index.html");
  $("#help").onclick = () => alert("Motion DNA is connected to Claude through MCP.\n\nIn Claude Code, open the repo folder (" + (S.root || "the Motion DNA clone") +
    ").\nClaude can list presets, apply them and styles to your selected layers, add assets and render frames to check its work.\n\nTry: \"Apply the Elegant style to this comp and show me a frame.\"");
}

// ---------- sections ----------
function tabs() {
  for (const b of document.querySelectorAll("#tabs button")) b.onclick = () => { S.sec = b.dataset.sec; store.set("section", S.sec); showSection(); };
  showSection();
}
function showSection() {
  for (const b of document.querySelectorAll("#tabs button")) b.classList.toggle("on", b.dataset.sec === S.sec);
  for (const s of document.querySelectorAll("#main > .section")) s.hidden = s.id !== "sec-" + S.sec;   // only the five sections, not the stacks inside them
  $("#main").scrollTop = 0;
}
function renderAll() { behaviors(); curves(); styles(); brands(); techniques(); if (typeof agent === "function") agent(); }

// ---------- shared: filters, preview, controls, apply row ----------
function inRange(r) { return !S.energy || !r || (r[0] <= S.energy && S.energy <= r[1]); }
function filtersBar(withCat, onChange) {
  const bar = h("div", { class: "filters" });
  if (withCat) {
    const cat = h("select", { class: "field", onchange: (e) => { S.cat = e.target.value; store.set("cat", S.cat); onChange(); } },
      CATS.map((c) => h("option", { value: c, selected: c === S.cat }, c)));
    bar.append(cat);
  }
  const q = h("input", { class: "field", type: "search", placeholder: "Search", value: S.q, oninput: (e) => { S.q = e.target.value.toLowerCase(); onChange(); } });
  if (!withCat) q.style.gridColumn = "1 / -1";
  bar.append(q);
  return bar;
}

const PV = {};   // the preview card of each section: { stage, name, energy, info, fav }
function previewCard(sec) {
  const stage = h("div", { class: "stage" }, h("span", { class: "empty" }, "Pick a preset to preview it"));
  const name = h("span", { class: "name" }, "Pick a preset"), energy = h("span", { class: "energy" });
  const fav = h("button", { class: "fav", title: "Add to / remove from favorites", onclick: toggleFav }, "☆");
  const info = h("div", { class: "info" });
  PV[sec] = { stage, name, energy, info, fav };
  return h("div", { class: "preview" }, stage, h("div", { class: "sel" }, h("span", { class: "name-wrap", style: "flex:1;min-width:0;display:flex;gap:6px" }, name, energy), fav), info);
}
// the slim version of the preview card: what is selected, its energy, the favorite star (channels and use in the tooltip)
function selectionBar(sec) {
  const name = h("span", { class: "name" }, "Nothing picked yet"), energy = h("span", { class: "energy" });
  const fav = h("button", { class: "fav", title: "Add to / remove from favorites", onclick: toggleFav, hidden: true }, "☆");
  const clear = h("button", { class: "fav clear", title: "Clear the selection", hidden: true, onclick: () => clearSelection(sec) }, "✕");
  const info = h("span", { hidden: true });
  const bar = h("div", { class: "selbar" }, h("span", { class: "dot" }), name, energy, fav, clear);
  PV[sec] = { stage: null, name, energy, info, fav, bar, clear };
  return bar;
}
function clearSelection(sec) {
  S.sel = null;
  for (const c of document.querySelectorAll(`#sec-${sec} .card.sel`)) c.classList.remove("sel");
  const p = PV[sec]; if (!p || !p.bar) return;
  p.bar.classList.remove("picked"); p.bar.title = "";
  p.name.textContent = "Nothing picked yet"; p.energy.textContent = "";
  p.fav.hidden = true; p.clear.hidden = true;
}
function showPreview(sec, it) {
  const p = PV[sec]; if (!p) return;
  if (p.bar) { p.bar.classList.add("picked"); p.bar.title = [it.channels, it.use].filter(Boolean).join(" — "); if (p.clear) p.clear.hidden = false; }
  if (p.stage) p.stage.replaceChildren(it.img ? h("img", { src: it.img, alt: "" }) : h("span", { class: "empty" }, "(no preview)"));
  p.name.textContent = it.title || it.name; p.energy.textContent = it.energy ? "· " + it.energy : "";
  p.info.textContent = [it.channels, it.use].filter(Boolean).join(" — ");
  p.fav.hidden = !it.favKey; p.fav.classList.toggle("on", S.favs.has(it.favKey)); p.fav.textContent = S.favs.has(it.favKey) ? "★" : "☆";
}
function toggleFav() {
  const k = S.sel && S.sel.favKey; if (!k) return;
  S.favs.has(k) ? S.favs.delete(k) : S.favs.add(k); store.set("favs", [...S.favs]);
  showPreview(S.sec, S.sel); if (S.cat === "★ Favorites") behaviors.refresh();
}

const CTL = { speed: 1, intensity: 1, dir: 0, ease: 0, stagger: 4, markers: true, open: store.get("controlsOpen", false) };
function controlsCard() {
  const d = h("details", { class: "controls", open: CTL.open, ontoggle: () => store.set("controlsOpen", (CTL.open = d.open)) });
  const sum = h("span", { class: "sum" });
  const summary = () => {
    const a = [];
    if (Math.abs(CTL.speed - 1) > 0.01) a.push(CTL.speed.toFixed(2) + "×");
    if (Math.abs(CTL.intensity - 1) > 0.01) a.push(Math.round(CTL.intensity * 100) + "%");
    if (CTL.dir) a.push(["", "Mirror H", "Mirror V", "Mirror both"][CTL.dir]);
    if (CTL.ease) a.push(EASES[CTL.ease]);
    for (const s of document.querySelectorAll(".controls .sum")) s.textContent = a.length ? a.join(" · ") : "defaults";
  };
  const slider = (label, key, min, max, fmt) => {
    const out = h("output", {}, fmt(CTL[key]));
    const r = h("input", { type: "range", min, max, step: 0.01, value: CTL[key], oninput: (e) => { CTL[key] = +e.target.value; out.textContent = fmt(CTL[key]); syncControls(); summary(); } });
    r.dataset.key = key;
    return h("div", { class: "ctl" }, h("label", {}, label), r, out);
  };
  const sel = (label, key, opts) => {
    const s = h("select", { class: "field", onchange: (e) => { CTL[key] = +e.target.value; syncControls(); summary(); } }, opts.map((o, i) => h("option", { value: i, selected: i === CTL[key] }, o)));
    s.dataset.key = key;
    return h("div", { class: "ctl wide" }, h("label", {}, label), s);
  };
  d.append(h("summary", {}, "Controls", sum),
    slider("Duration", "speed", 0.5, 2, (x) => x.toFixed(2) + "×"), slider("Intensity", "intensity", 0.25, 2, (x) => Math.round(x * 100) + "%"),
    sel("Direction", "dir", ["As designed", "Mirror horizontal", "Mirror vertical", "Mirror both"]), sel("Easing", "ease", EASES),
    h("div", { class: "ctl-foot" },
      h("label", {}, "Stagger ", h("input", { class: "field", type: "number", min: 0, value: CTL.stagger, "data-key": "stagger", oninput: (e) => { CTL.stagger = +e.target.value || 0; syncControls(); } }), " frames"),
      h("label", { title: "Drag the SS in / SS out markers to retime" }, h("input", { type: "checkbox", checked: CTL.markers, "data-key": "markers", onchange: (e) => { CTL.markers = e.target.checked; syncControls(); } }), " Marker timing"),
      h("button", { class: "btn", onclick: () => { Object.assign(CTL, { speed: 1, intensity: 1, dir: 0, ease: 0 }); syncControls(true); summary(); } }, "Reset")));
  setTimeout(summary);
  return d;
}
function syncControls(all) {   // the same controls live in several sections: keep their widgets in step
  for (const el of document.querySelectorAll(".controls [data-key]")) {
    const k = el.dataset.key; if (!all && document.activeElement === el) continue;
    if (el.type === "checkbox") el.checked = CTL[k]; else el.value = CTL[k];
    if (el.type === "range") el.parentElement.querySelector("output").textContent = k === "speed" ? CTL[k].toFixed(2) + "×" : Math.round(CTL[k] * 100) + "%";
  }
}
function tuning() {
  return { speed: CTL.speed, intensity: CTL.intensity, flipX: CTL.dir === 1 || CTL.dir === 3, flipY: CTL.dir === 2 || CTL.dir === 3, ease: CTL.ease ? EASES[CTL.ease] : null };
}
function actionsRow(onApply) {
  const radios = ["in", "out", "both"].map((p) => h("label", { title: { in: "Animate the entrance", out: "Animate the exit (ends at the layer's out point)", both: "Entrance and exit" }[p] },
    h("input", { type: "radio", name: "phase-" + Math.random(), value: p, checked: S.phase === p, onchange: () => { S.phase = p; syncPhase(); } }), p[0].toUpperCase() + p.slice(1)));
  return h("div", { class: "actions" }, h("div", { class: "phases" }, radios),
    h("div", { class: "buttons" },
      h("button", { class: "solid apply", title: "Apply to the selected layers", onclick: onApply }, "Apply"),
      h("button", { class: "solid remove", title: "Remove Motion DNA animation from the selected layers", onclick: removeAnim }, "Remove")));
}
function syncPhase() { for (const r of document.querySelectorAll(".phases input")) r.checked = r.value === S.phase; }
async function removeAnim() {
  if (!confirm("Remove the keyframes, expressions and markers Motion DNA added to the selected layers?\nAnimated properties keep their resting value.")) return;
  report(await call("mdna_remove"));
}
function report(r) { r = String(r); r.startsWith("ERR") ? toast(r.replace(/^ERR\s*/, ""), true) : toast(r.replace(/^OK\s*/, "")); }

// ---------- 1. Behaviors ----------
function presetItem(p) {
  return { name: p.name, kind: p.kind, energy: p.energy, channels: p.channels, use: p.use, favKey: p.kind + "/" + p.name,
    thumb: asset(`library/thumbs/${p.kind}/${p.slug}.png`), img: asset(`library/gifs/${p.kind}/${p.slug}.gif`) };
}
function behaviorItems() {
  let src;
  const tr = new Set((S.tags.presets || []).filter((t) => t.kind === "motion" && (t.roles || []).includes("transition")).map((t) => t.name));
  if (S.cat === "Moves") src = S.lib.filter((p) => p.kind === "motion" && p.family !== "classic");
  else if (S.cat === "Classics") src = S.lib.filter((p) => p.kind === "motion" && p.family === "classic");
  else if (S.cat === "Text") src = S.lib.filter((p) => p.kind === "text");
  else if (S.cat === "Loops") src = S.lib.filter((p) => p.kind === "fx");
  else if (S.cat === "Transitions") src = S.lib.filter((p) => tr.has(p.name));
  else if (S.cat === "Recipes") src = S.recipes;
  else src = S.lib.concat(S.recipes).filter((p) => S.favs.has(p.kind + "/" + p.name));
  return src.filter((p) => {
    const tg = S.tagOf[p.name];
    if (!inRange(tg ? tg.energy : RANGE_OF[p.energy])) return false;
    if (S.tone && (!tg || !(tg.tones || []).includes(S.tone))) return false;
    return !S.q || (p.name + " " + (p.channels || "") + " " + (p.use || "")).toLowerCase().includes(S.q);
  }).map(presetItem);
}
function behaviors() {
  const sec = $("#sec-behaviors"); sec.replaceChildren();
  const grid = h("div", { class: "grid" }), count = h("div", { class: "count" });
  const refresh = () => {
    const items = behaviorItems();
    count.textContent = items.length ? `${items.length}` : (S.cat === "★ Favorites" ? "No favorites yet: pick a preset and press ☆." : "None match");
    count.title = items.length ? `${items.length} ${S.cat === "★ Favorites" ? "favorites" : "presets"}` : "";
    grid.replaceChildren(...items.map((it) => {
      const img = h("img", { src: it.thumb, alt: "", loading: "lazy" });
      const c = h("button", { class: "card" + (S.sel && S.sel.favKey === it.favKey ? " sel" : ""), title: `${it.name} · ${it.energy || ""}\n${it.use || ""}` },
        h("span", { class: "thumb" }, img), h("span", { class: "label" }, (S.favs.has(it.favKey) ? "★ " : "") + it.name));
      // hover plays the preset's real motion (its GIF, from the start) right on the thumbnail
      c.onmouseenter = () => { img.src = it.img + "?t=" + Date.now(); c.classList.add("playing"); };
      c.onmouseleave = () => { img.src = it.thumb; c.classList.remove("playing"); };
      img.onerror = () => { if (img.src.indexOf(it.thumb) < 0) img.src = it.thumb; };   // no GIF: keep the still
      c.onclick = () => { S.sel = it; for (const x of grid.children) x.classList.remove("sel"); c.classList.add("sel"); showPreview("behaviors", it); };
      return c;
    }));
  };
  behaviors.refresh = refresh;
  // energy tabs (library/tags.json scale): pick one to rotate the gallery to the presets that cover it
  const ENERGY_TABS = ["All", "Calm", "Soft", "Medium", "Dynamic", "Explosive"];
  const etabs = h("div", { class: "etabs" }, ...ENERGY_TABS.map((label, i) => h("button", {
    class: S.energy === i ? "on" : "", title: i ? `Energy ${i} · ${label.toLowerCase()}` : "Every energy",
    onclick: (e) => { S.energy = i; for (const b of etabs.children) b.classList.toggle("on", b === e.currentTarget); refresh(); },
  }, label)));
  const cat = h("select", { class: "field big", title: "The type of behavior: moves, classics, text, loops, transitions, recipes or your favorites",
    onchange: (e) => { S.cat = e.target.value; store.set("cat", S.cat); clearSelection("behaviors"); refresh(); } },
    CATS.map((c) => h("option", { value: c, selected: c === S.cat }, c)));
  const search = h("input", { class: "field", type: "search", placeholder: "Search presets", value: S.q, oninput: (e) => { S.q = e.target.value.toLowerCase(); refresh(); } });
  const step = (n, text) => h("div", { class: "step" }, h("span", { class: "num" }, String(n)), h("span", {}, text));
  const gallery = h("div", { class: "gallery" }, h("div", { class: "gallery-body" }, h("div", { class: "gallery-head" }, search, count), grid), etabs);
  sec.append(step(1, "Choose a type of behavior from the menu"), cat,
    step(2, "Pick a preset (hover a thumbnail to preview it)"), gallery, selectionBar("behaviors"),
    step(3, "Adjust the controls, choose In / Out / Both, then Apply"), controlsCard(), actionsRow(applyBehavior));
  refresh();
}
async function applyBehavior() {
  if (!S.sel || !S.sel.kind) return toast("Pick a preset in the gallery first.", true);
  report(await call("mdna_apply", { kind: S.sel.kind, name: S.sel.name, phase: S.phase, tune: tuning(), stagger: CTL.stagger, markers: CTL.markers }));
}

// ---------- 2. Curves: a Flow-style editor (drag the handles, type the values) and the token library ----------
const SVGNS = "http://www.w3.org/2000/svg";
const sv = (tag, attrs = {}) => { const e = document.createElementNS(SVGNS, tag); for (const [k, v] of Object.entries(attrs)) e.setAttribute(k, v); return e; };
const CV = { bz: [0.18, 0.28, 0, 0.9], name: "Coast", easings: [] };
const R0 = -0.2, R1 = 1.2;   // both axes show -0.2..1.2: the 0..1 square stays square, with room for overshoot
const X = (u) => u * 100, Y = (v) => 100 - v * 100;   // value → SVG units (the unit square is 0..100)
const bzText = (bz) => bz.map((v) => (Math.round(v * 100) / 100).toFixed(2)).join(", ");
const curvePath = (bz) => `M0,100 C${X(bz[0])},${Y(bz[1])} ${X(bz[2])},${Y(bz[3])} 100,0`;
function brandCurves() { const b = typeof activeBrand === "function" ? activeBrand() : null; return b && b.motion ? (b.motion.curves || []).map((c) => Object.assign({ brand: b.name }, c)) : []; }
function curveName(bz) {
  const m = brandCurves().concat(CV.easings).find((e) => e.bezier.every((v, i) => Math.abs(v - bz[i]) < 0.005));
  return m ? m.name : "";
}
const isUserCurve = (nm) => { const e = CV.easings.find((x) => x.name === nm); return !!e && String(e.source || "").startsWith("panel"); };
async function loadCurves() {
  const tk = await readJSON(asset("tokens/superside_motion_tokens.json") + "?t=" + Date.now()).catch(() => ({ easings: [] }));
  CV.easings = (tk.easings || []).filter((e) => e.bezier && e.bezier.length === 4);
}
function curves() {
  const sec = $("#sec-curves"); sec.replaceChildren();
  // the editor
  const svg = sv("svg", { viewBox: `${R0 * 100} ${(1 - R1) * 100} ${(R1 - R0) * 100} ${(R1 - R0) * 100}`, class: "editor" });
  const g = sv("g", { class: "grid" });
  for (let i = 0; i <= 4; i++) { g.append(sv("line", { x1: i * 25, y1: 0, x2: i * 25, y2: 100 }), sv("line", { x1: 0, y1: i * 25, x2: 100, y2: i * 25 })); }
  svg.append(g, sv("line", { x1: 0, y1: 100, x2: 100, y2: 0, class: "diag" }), sv("path", { d: "M0,0 V100 H100", class: "axes" }));
  const h1 = sv("line", { class: "arm" }), h2 = sv("line", { class: "arm" }), path = sv("path", { class: "curve" });
  const p1 = sv("circle", { r: 3.4, class: "handle" }), p2 = sv("circle", { r: 3.4, class: "handle" });
  svg.append(h1, h2, path, sv("circle", { cx: 0, cy: 100, r: 2.2, class: "end" }), sv("circle", { cx: 100, cy: 0, r: 2.2, class: "end" }), p1, p2);
  const nameEl = h("span", { class: "cname" }), vals = h("input", { class: "field mono", title: "cubic-bezier(x1, y1, x2, y2): type values and press Enter" });
  const del = h("button", { class: "btn", title: "Delete this curve (only curves saved from the panel)" }, "Delete");
  const draw = () => {
    const b = CV.bz;
    path.setAttribute("d", curvePath(b));
    h1.setAttribute("x1", 0); h1.setAttribute("y1", 100); h1.setAttribute("x2", X(b[0])); h1.setAttribute("y2", Y(b[1]));
    h2.setAttribute("x1", 100); h2.setAttribute("y1", 0); h2.setAttribute("x2", X(b[2])); h2.setAttribute("y2", Y(b[3]));
    p1.setAttribute("cx", X(b[0])); p1.setAttribute("cy", Y(b[1])); p2.setAttribute("cx", X(b[2])); p2.setAttribute("cy", Y(b[3]));
    CV.name = curveName(b); nameEl.textContent = CV.name || "Custom curve";
    if (document.activeElement !== vals) vals.value = bzText(b);
    del.disabled = !isUserCurve(CV.name);
    for (const c of lib.children) c.classList.toggle("sel", c.dataset.name === CV.name);
  };
  // dragging a handle: pointer capture keeps the drag even outside the editor; values clamp to the visible range
  const drag = (idx) => (e) => {   // moves are followed on the whole window, so the drag survives leaving the editor
    e.preventDefault();
    const move = (ev) => {
      const pt = svg.createSVGPoint(); pt.x = ev.clientX; pt.y = ev.clientY;
      const q = pt.matrixTransform(svg.getScreenCTM().inverse());
      CV.bz[idx * 2] = Math.round(Math.max(0, Math.min(1, q.x / 100)) * 100) / 100;
      CV.bz[idx * 2 + 1] = Math.round(Math.max(R0, Math.min(R1, (100 - q.y) / 100)) * 100) / 100;
      draw();
    };
    const up = () => { window.removeEventListener("pointermove", move); window.removeEventListener("pointerup", up); };
    window.addEventListener("pointermove", move); window.addEventListener("pointerup", up);
  };
  p1.addEventListener("pointerdown", drag(0)); p2.addEventListener("pointerdown", drag(1));
  vals.addEventListener("change", () => {
    const n = (vals.value.match(/-?\d*\.?\d+/g) || []).map(Number);
    if (n.length >= 4) CV.bz = [Math.max(0, Math.min(1, n[0])), n[1], Math.max(0, Math.min(1, n[2])), n[3]];
    draw();
  });
  // actions
  const applyBtn = h("button", { class: "solid apply", onclick: async () => report(await call("mdna_apply_curve", { bz: CV.bz, name: CV.name })) }, "Apply to keyframes");
  const readBtn = h("button", { class: "btn", title: "Load the curve between the first two selected keyframes", onclick: async () => {
    const r = await call("mdna_read_curve"); if (String(r).startsWith("ERR")) return report(r); CV.bz = JSON.parse(r); draw(); } }, "Read keys");
  const revBtn = h("button", { class: "btn", title: "Mirror the curve (an ease in becomes an ease out)", onclick: () => { const b = CV.bz; CV.bz = [1 - b[2], 1 - b[3], 1 - b[0], 1 - b[1]].map((v) => Math.round(v * 100) / 100); draw(); } }, "Reverse");
  // save: an inline form (CEP has no prompt())
  const saveName = h("input", { class: "field", placeholder: "Name (one or two words)" }), saveUse = h("input", { class: "field", placeholder: "What is it for? (optional)" });
  const form = h("div", { class: "saveform", hidden: true }, saveName, saveUse,
    h("div", { class: "row" },
      h("button", { class: "solid apply", onclick: async () => {
        const nm = saveName.value.trim(); if (!nm) return saveName.focus();
        const r = await call("mdna_save_curve", { name: nm, use: saveUse.value.trim(), bz: CV.bz }); report(r);
        if (String(r).startsWith("OK")) { form.hidden = true; await loadCurves(); library(); draw(); }
      } }, "Save"),
      h("button", { class: "btn", onclick: () => (form.hidden = true) }, "Cancel")));
  const saveBtn = h("button", { class: "btn", title: "Add this curve to the library (tokens/superside_motion_tokens.json)", onclick: () => {
    form.hidden = !form.hidden; saveName.value = isUserCurve(CV.name) ? CV.name : ""; saveUse.value = ""; if (!form.hidden) saveName.focus(); } }, "Save curve…");
  del.onclick = async () => {
    const nm = CV.name; if (!isUserCurve(nm) || !confirm(`Delete the curve "${nm}" from the library?`)) return;
    const r = await call("mdna_delete_curve", nm); report(r); if (String(r).startsWith("OK")) { await loadCurves(); library(); draw(); }
  };
  // the library: square thumbnails of every token curve
  const lib = h("div", { class: "grid curves" }), libCount = h("div", { class: "count" });
  const library = () => {
    const shown = brandCurves().concat(CV.easings).filter((e) => !S.q || (e.name + " " + (e.use || "")).toLowerCase().includes(S.q));
    libCount.textContent = `Library · ${shown.length} curves`;
    lib.replaceChildren(...shown.map((e) => {
      const t = sv("svg", { viewBox: `${R0 * 100} ${(1 - R1) * 100} ${(R1 - R0) * 100} ${(R1 - R0) * 100}` });
      t.append(sv("path", { d: "M0,0 V100 H100", class: "axes" }), sv("path", { d: curvePath(e.bezier), class: "curve" }));
      const c = h("button", { class: "card" + (e.brand ? " brand" : ""), title: e.name + (e.brand ? " · " + e.brand + " curve" : "") + (e.use ? "\n" + e.use : "") }, h("span", { class: "thumb sq" }, t), h("span", { class: "label" }, (e.brand ? "\u25c6 " : isUserCurve(e.name) ? "\u2022 " : "") + e.name));
      c.dataset.name = e.name;
      c.onclick = () => { CV.bz = e.bezier.slice(); draw(); };
      return c;
    }));
  };
  curves.refresh = () => { library(); draw(); };
  const search = h("input", { class: "field", type: "search", placeholder: "Search curves", value: S.q, oninput: (e) => { S.q = e.target.value.toLowerCase(); library(); draw(); } });
  sec.append(search, h("div", { class: "editor-wrap" }, svg),
    h("div", { class: "crow" }, nameEl, vals),
    h("div", { class: "crow" }, applyBtn, readBtn, revBtn),
    h("div", { class: "crow" }, saveBtn, del, h("button", { class: "btn tobrand", title: "Save this curve to the active brand", onclick: () => toBrand() }, "Save to brand")), form, libCount, lib);
  const toBrand = async () => {
    const b = activeBrand(); if (!b) return toast("Activate a brand first (Brands > open one > Activate).", true);
    BR.view = "kit"; BR.slug = b.slug; BR.tab = "motion"; S.sec = "brands"; store.set("section", "brands"); showSection(); brands.render();
    setTimeout(() => { const btn = [...document.querySelectorAll("#sec-brands .btn")].find((x) => x.textContent === "+ Add curve"); if (btn) btn.click(); }, 0);
  };
  library(); draw();
}

// ---------- 3. Styles ----------
function styles() {
  const sec = $("#sec-styles"); sec.replaceChildren();
  const grid = h("div", { class: "grid", style: "grid-template-columns:repeat(auto-fill,minmax(180px,1fr))" });
  let whole = true;
  const refresh = () => {
    const shown = S.packs.filter((pk) => {
      const tones = pk.tones || [];
      if (S.q && !(pk.name + " " + pk.desc + " " + tones.join(" ")).toLowerCase().includes(S.q)) return false;
      if (S.tone && !tones.includes(S.tone)) return false;
      return inRange(pk.energy_range);
    });
    grid.replaceChildren(...shown.map((pk) => {
      const it = { name: pk.name, title: "Style: " + pk.name, kind: "pack", energy: pk.energy, use: pk.desc, favKey: "pack/" + pk.name,
        img: asset(`library/packs/${pk.slug}.gif`), thumb: asset(`library/packs/${pk.slug}_md.png`) };
      const c = h("button", { class: "card" + (S.sel && S.sel.favKey === it.favKey ? " sel" : ""), title: pk.desc },
        h("span", { class: "thumb" }, h("img", { src: it.thumb, alt: "", loading: "lazy" })),
        h("span", { class: "label" }, `${pk.name} · ${pk.energy}${pk.energy_range ? " " + pk.energy_range.join("–") : ""}`));
      c.onclick = () => { S.sel = it; for (const x of grid.children) x.classList.remove("sel"); c.classList.add("sel"); showPreview("styles", it); };
      return c;
    }));
  };
  const scope = h("label", {}, h("input", { type: "checkbox", checked: true, onchange: (e) => (whole = e.target.checked) }), " Whole comp (otherwise only the selected layers)");
  const apply = async () => {
    if (!S.sel || S.sel.kind !== "pack") return toast("Pick a style first.", true);
    report(await call("mdna_apply_style", { name: S.sel.name, phase: S.phase, whole, tune: tuning(), markers: CTL.markers }));
  };
  sec.append(filtersBar(false, refresh), previewCard("styles"), controlsCard(), actionsRow(apply),
    h("div", { class: "note", style: "padding:0" }, "Each style animates a whole comp (or the selected layers): every layer gets the preset of its role, with the style's own curve."), scope, grid);
  refresh();
}

// ---------- 4. Brands: a workspace per client ----------
// A brand keeps its motion spec (curves, timing benchmarks in frames / ms / %), the rules learned in reviews and its
// projects. One brand can be active per After Effects project: a chip in the header opens its kit from any section,
// the Curves library shows its curves first, and Apply uses its style and curve. Brands are saved in the repo
// (library/brands/<slug>/brand.json, schema in library/brands/_schema.md). The repo is public: keep client names
// anonymised unless it is private. Older local-only brands (library/brands.local) still load.
let BRANDS = [];   // [{local, b}]
const BR = { view: "list", slug: null, tab: "overview", fps: 30, project: "" };
const brandOf = (slug) => BRANDS.find((x) => x.b.slug === slug);
const activeMap = () => store.get("activeBrands", {});
function activeSlug() { const m = activeMap(); return m[BR.project || "(unsaved)"] || null; }
function setActive(slug) { const m = activeMap(); const k = BR.project || "(unsaved)"; if (slug) m[k] = slug; else delete m[k]; store.set("activeBrands", m); brandChip(); if (curves.refresh) curves.refresh(); }
function activeBrand() { const x = brandOf(activeSlug()); return x ? x.b : null; }
function ensureMotion(b) { b.motion = b.motion || {}; b.motion.curves = b.motion.curves || []; b.motion.timing = b.motion.timing || []; return b; }
const today = () => new Date().toISOString().slice(0, 10);
const slugify = (s) => s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
async function saveBrand(x) {
  const r = await call("mdna_brand_save", { slug: x.b.slug, local: x.local, text: JSON.stringify(x.b, null, 1) + "\n" });
  if (String(r).startsWith("ERR")) report(r);
  else { brandChip(); if (curves.refresh) curves.refresh(); }   // the Curves library shows the active brand's curves
  return r;
}
// a timing row in frames at the comp's frame rate (ms converts; % needs a base in frames)
function timingFrames(row) {
  const v = +row.value; if (!isFinite(v)) return null;
  if (row.unit === "frames") return Math.round(v);
  if (row.unit === "ms") return Math.round(v / 1000 * (BR.fps || 30));
  if (row.unit === "%") { const base = +row.of; return isFinite(base) && base > 0 ? Math.round(v / 100 * base) : null; }
  return null;
}
const timingText = (row) => row.unit === "frames" ? `${row.value} f` : row.unit === "ms" ? `${row.value} ms` : `${row.value}% of ${row.of || "?"}`;
function curveByName(nm) {   // brand curves first, then the token library
  const b = activeBrand(), own = b && b.motion ? (b.motion.curves || []).find((c) => c.name === nm) : null;
  return own || CV.easings.find((e) => e.name === nm) || null;
}
function miniCurve(bz) {
  const t = sv("svg", { viewBox: `${R0 * 100} ${(1 - R1) * 100} ${(R1 - R0) * 100} ${(R1 - R0) * 100}`, class: "mini" });
  t.append(sv("path", { d: "M0,0 V100 H100", class: "axes" }), sv("path", { d: curvePath(bz), class: "curve" }));
  return t;
}

async function loadBrands() {
  const info = parse(await call("mdna_comp_info"));
  BR.fps = info.fps || BR.fps; BR.project = info.project || "";
  const r = parse(await call("mdna_brands"));
  BRANDS = Array.isArray(r) ? r.filter((x) => x && x.b && x.b.slug) : [];
  for (const x of BRANDS) ensureMotion(x.b);
  brandChip();
}
function brandChip() {
  const chip = $("#brandchip"), b = activeBrand();
  chip.hidden = !b; if (!b) return;
  const c = Object.values((b.identity || {}).colors || {})[1] || "#d8ff85";
  chip.replaceChildren(h("i", { class: "swatch", style: `background:${c}` }), h("span", {}, b.name));
  chip.title = `Active brand for this project: ${b.name}. Click to open its kit.`;
  chip.onclick = () => { S.sec = "brands"; store.set("section", "brands"); BR.view = "kit"; BR.slug = b.slug; showSection(); brands.render(); };
}

function brands() {
  const sec = $("#sec-brands");
  const render = () => { sec.replaceChildren(BR.view === "kit" && brandOf(BR.slug) ? brandKit(brandOf(BR.slug)) : (BR.view === "new" ? newBrandForm() : brandList())); };
  brands.render = render;
  render();
  loadBrands().then(render);
}
function brandList() {
  const wrap = h("div", { class: "stack" });
  const grid = h("div", { class: "grid", style: "grid-template-columns:repeat(auto-fill,minmax(180px,1fr))" });
  const act = activeSlug();
  const shown = BRANDS.filter((x) => {
    const b = x.b, f = b.feel || {};
    if (S.q && !(b.name + " " + (f.tones || []).join(" ") + " " + (b.rules || []).map((r) => r.rule).join(" ")).toLowerCase().includes(S.q)) return false;
    if (S.tone && !(f.tones || []).includes(S.tone)) return false;
    return inRange(f.energy);
  });
  grid.replaceChildren(...shown.map((x) => {
    const b = x.b, m = b.motion || {};
    const c = h("button", { class: "card" + (b.slug === act ? " sel" : ""), title: `Open ${b.name}` },
      h("span", { class: "thumb" }, h("img", { src: asset(`library/brands${x.local ? ".local" : ""}/${b.slug}/thumb.png`), alt: "", loading: "lazy", onerror: (e) => e.target.replaceWith(h("span", { class: "initial" }, b.name.slice(0, 1))) })),
      h("span", { class: "label" }, b.name, x.local ? h("em", { class: "badge" }, "local") : null, b.slug === act ? h("em", { class: "badge on" }, "active") : null),
      h("span", { class: "label dim" }, `${(m.curves || []).length} curves · ${(m.timing || []).length} timings · ${(b.rules || []).length} rules`));
    c.onclick = () => { BR.view = "kit"; BR.slug = b.slug; BR.tab = "overview"; brands.render(); $("#main").scrollTop = 0; };
    return c;
  }));
  const bar = filtersBar(false, () => brands.render());
  wrap.append(bar, h("div", { class: "crow" }, h("button", { class: "solid apply", onclick: () => { BR.view = "new"; brands.render(); } }, "+ New brand")),
    BRANDS.length ? grid : h("div", { class: "note" }, "No brands yet. Create one for each client: its curves, timing and rules stay with it, in the repo."));
  return wrap;
}
function newBrandForm() {
  const name = h("input", { class: "field", placeholder: "Client or brand name" });
  const style = h("select", { class: "field" }, [h("option", { value: "" }, "Base style (optional)"), ...S.packs.map((pk) => h("option", { value: pk.name }, pk.name))]);
  const curve = h("select", { class: "field" }, [h("option", { value: "" }, "Main curve (optional)"), ...CV.easings.map((e) => h("option", { value: e.name }, e.name))]);
  const tones = h("input", { class: "field", placeholder: "Tones, comma separated (e.g. calm, modern)" });
  const create = async () => {
    const nm = name.value.trim(); if (!nm) return name.focus();
    const slug = slugify(nm); if (brandOf(slug)) return toast(`"${nm}" already exists.`, true);
    const b = { name: nm, slug, created: today(), by: "panel", identity: { colors: {}, fonts: {} },
      feel: { energy: [2, 3], tones: tones.value.split(",").map((s) => s.trim()).filter(Boolean), style: style.value, curve: curve.value },
      presets: { prefer: {}, avoid: [] }, motion: { curves: [], timing: [] }, rules: [], projects: [] };
    const x = { local: false, b };
    if (String(await saveBrand(x)).startsWith("OK")) { BRANDS.push(x); BR.view = "kit"; BR.slug = slug; BR.tab = "motion"; brands.render(); toast(`${nm} created in library/brands/${slug}.`); }
  };
  return h("div", { class: "stack" }, backBar("New brand"), h("div", { class: "saveform" }, name, style, curve, tones,
    h("div", { class: "row" }, h("button", { class: "solid apply", onclick: create }, "Create"), h("button", { class: "btn", onclick: () => { BR.view = "list"; brands.render(); } }, "Cancel"))),
    h("div", { class: "note", style: "padding:0" }, "Saved in the repo (library/brands). It reaches the team when it is committed and pushed. The repo is public: use an anonymised name for clients under NDA."));
}
function backBar(title, extra) {
  return h("div", { class: "kit-top" }, h("button", { class: "icon back", title: "All brands", onclick: () => { BR.view = "list"; brands.render(); } }, "\u2039"), h("span", { class: "kit-title" }, title), extra || null);
}

function brandKit(x) {
  const b = x.b, isActive = activeSlug() === b.slug;
  const colors = Object.values((b.identity || {}).colors || {});
  const activeBtn = h("button", { class: "btn" + (isActive ? " on" : ""), title: "Make this the brand of the current After Effects project",
    onclick: () => { setActive(isActive ? null : b.slug); brands.render(); } }, isActive ? "\u2713 Active" : "Activate");
  const top = backBar(b.name, activeBtn);
  const strip = h("div", { class: "swatches" }, ...colors.map((c) => h("i", { style: `background:${c}`, title: c })), x.local ? h("em", { class: "badge" }, "local") : null);
  const tabsEl = h("div", { class: "seg" }, ...["overview", "motion", "rules", "projects"].map((k) =>
    h("button", { class: BR.tab === k ? "on" : "", onclick: () => { BR.tab = k; brands.render(); } }, k[0].toUpperCase() + k.slice(1))));
  const body = BR.tab === "motion" ? kitMotion(x) : BR.tab === "rules" ? kitRules(x) : BR.tab === "projects" ? kitProjects(x) : kitOverview(x);
  return h("div", { class: "stack" }, top, strip, tabsEl, body);
}

function kitOverview(x) {
  const b = x.b, f = b.feel || {}, pr = b.presets || {};
  const style = h("select", { class: "field", onchange: async (e) => { f.style = e.target.value; b.feel = f; await saveBrand(x); } },
    [h("option", { value: "" }, "—"), ...S.packs.map((pk) => h("option", { value: pk.name, selected: pk.name === f.style }, pk.name))]);
  const curve = h("select", { class: "field", onchange: async (e) => { f.curve = e.target.value; b.feel = f; await saveBrand(x); } },
    [h("option", { value: "" }, "—"), ...CV.easings.map((e) => h("option", { value: e.name, selected: e.name === f.curve }, e.name))]);
  let whole = true;
  const apply = async () => report(await call("mdna_apply_brand", { slug: b.slug, phase: S.phase, whole, tune: tuning(), markers: CTL.markers }));
  const prefer = Object.entries(pr.prefer || {}).map(([role, list]) => h("div", { class: "kv" }, h("span", {}, role), h("span", {}, list.join(", "))));
  return h("div", { class: "stack" },
    h("div", { class: "card-box" },
      h("div", { class: "ctl wide" }, h("label", {}, "Style"), style),
      h("div", { class: "ctl wide" }, h("label", {}, "Curve"), curve),
      h("div", { class: "kv" }, h("span", {}, "Energy"), h("span", {}, (f.energy || []).join("–") || "—")),
      h("div", { class: "kv" }, h("span", {}, "Tones"), h("span", {}, (f.tones || []).join(", ") || "—")),
      (b.identity && b.identity.fonts && Object.keys(b.identity.fonts).length) ? h("div", { class: "kv" }, h("span", {}, "Fonts"), h("span", {}, Object.values(b.identity.fonts).join(", "))) : null),
    h("div", { class: "subhead" }, "Animate in this brand"),
    controlsCard(), actionsRow(apply),
    h("label", {}, h("input", { type: "checkbox", checked: true, onchange: (e) => (whole = e.target.checked) }), " Whole comp (otherwise only the selected layers)"),
    prefer.length || (pr.avoid || []).length ? h("div", { class: "subhead" }, "Presets") : null,
    prefer.length ? h("div", { class: "card-box" }, ...prefer) : null,
    (pr.avoid || []).length ? h("div", { class: "card-box avoid" }, h("div", { class: "kv" }, h("span", {}, "Avoid"), h("span", {}, pr.avoid.join(", ")))) : null);
}

function kitMotion(x) {
  const b = ensureMotion(x.b), wrap = h("div", { class: "stack" });
  // curves
  const curveRows = b.motion.curves.map((c, i) => h("div", { class: "row-item" }, miniCurve(c.bezier),
    h("div", { class: "row-text" }, h("b", {}, c.name), h("span", {}, c.use || bzText(c.bezier))),
    h("div", { class: "row-act" },
      h("button", { class: "btn", title: "Ease the selected keyframe pairs with this curve", onclick: async () => report(await call("mdna_apply_curve", { bz: c.bezier, name: c.name })) }, "Apply"),
      h("button", { class: "btn", title: "Open it in the Curves editor", onclick: () => { CV.bz = c.bezier.slice(); S.sec = "curves"; store.set("section", "curves"); showSection(); curves.refresh(); } }, "Edit"),
      h("button", { class: "btn ghost", title: "Remove from this brand", onclick: async () => { if (!confirm(`Remove "${c.name}" from ${b.name}?`)) return; b.motion.curves.splice(i, 1); await saveBrand(x); brands.render(); } }, "\u2715"))));
  const cName = h("input", { class: "field", placeholder: "Curve name" }), cUse = h("input", { class: "field", placeholder: "When to use it" });
  const cVals = h("input", { class: "field mono", placeholder: "x1, y1, x2, y2", value: bzText(CV.bz) });
  const cForm = h("div", { class: "saveform", hidden: true }, cName, cUse, cVals, h("div", { class: "row" },
    h("button", { class: "solid apply", onclick: async () => {
      const n = (cVals.value.match(/-?\d*\.?\d+/g) || []).map(Number); if (!cName.value.trim() || n.length < 4) return cName.focus();
      b.motion.curves.push({ name: cName.value.trim(), bezier: n.slice(0, 4), use: cUse.value.trim(), source: { date: today(), by: "panel" } });
      await saveBrand(x); brands.render(); toast("Curve saved to " + b.name + ".");
    } }, "Save to brand"), h("button", { class: "btn", onclick: () => (cForm.hidden = true) }, "Cancel")));
  wrap.append(h("div", { class: "subhead" }, `Curves · ${b.motion.curves.length}`), ...curveRows,
    h("button", { class: "btn", title: "Add a curve (prefilled with the one in the Curves editor)", onclick: () => { cVals.value = bzText(CV.bz); cForm.hidden = !cForm.hidden; cName.focus(); } }, "+ Add curve"), cForm);

  // timing benchmarks
  const fpsNote = h("span", { class: "dim" }, ` · frames at ${BR.fps} fps`);
  const tRows = b.motion.timing.map((r, i) => {
    const fr = timingFrames(r), cv = r.curve ? curveByName(r.curve) : null;
    return h("div", { class: "row-item" },
      h("div", { class: "frames" }, fr == null ? "—" : fr, h("small", {}, "f")),
      h("div", { class: "row-text" }, h("b", {}, r.element), h("span", {}, [timingText(r), r.curve || null, r.stagger ? `stagger ${r.stagger} f` : null, r.note || null].filter(Boolean).join(" · "))),
      h("div", { class: "row-act" },
        h("button", { class: "btn", disabled: fr == null, title: fr == null ? "Give the % a base in frames to apply it" : `Set the selected keyframe pairs to ${fr} f${cv ? " with " + cv.name : ""}`,
          onclick: async () => report(await call("mdna_apply_timing", { frames: fr, bz: cv ? cv.bezier : null, name: r.element })) }, "Apply"),
        h("button", { class: "btn ghost", title: "Remove", onclick: async () => { if (!confirm(`Remove "${r.element}"?`)) return; b.motion.timing.splice(i, 1); await saveBrand(x); brands.render(); } }, "\u2715")));
  });
  const el = h("input", { class: "field", placeholder: "Element (e.g. Title in, Transition, Logo)" });
  const val = h("input", { class: "field", type: "number", step: "any", placeholder: "Value" });
  const unit = h("select", { class: "field" }, ["frames", "ms", "%"].map((u) => h("option", { value: u }, u)));
  const of = h("input", { class: "field", placeholder: "% of… (frames, or text like 'shot length')" });
  const cur = h("select", { class: "field" }, [h("option", { value: "" }, "Curve (optional)"), ...b.motion.curves.map((c) => h("option", { value: c.name }, c.name + " (brand)")), ...CV.easings.map((e) => h("option", { value: e.name }, e.name))]);
  const stg = h("input", { class: "field", type: "number", min: 0, placeholder: "Stagger f" });
  const note = h("input", { class: "field", placeholder: "Note: when and how to use it" });
  unit.onchange = () => (of.hidden = unit.value !== "%"); of.hidden = true;
  const tForm = h("div", { class: "saveform", hidden: true }, el, h("div", { class: "row" }, val, unit), of, h("div", { class: "row" }, cur, stg), note, h("div", { class: "row" },
    h("button", { class: "solid apply", onclick: async () => {
      if (!el.value.trim() || val.value === "") return el.focus();
      b.motion.timing.push({ element: el.value.trim(), value: +val.value, unit: unit.value, of: unit.value === "%" ? of.value.trim() : undefined,
        curve: cur.value || undefined, stagger: +stg.value || undefined, note: note.value.trim() || undefined, source: { date: today(), by: "panel" } });
      await saveBrand(x); brands.render(); toast("Benchmark saved to " + b.name + ".");
    } }, "Save to brand"), h("button", { class: "btn", onclick: () => (tForm.hidden = true) }, "Cancel")));
  const capture = async () => {   // the selected keyframes become a prefilled benchmark
    const r = await call("mdna_capture"); if (String(r).startsWith("ERR")) return report(r);
    const c = JSON.parse(r); BR.fps = c.fps || BR.fps;
    el.value = c.layer ? `${c.layer} · ${c.prop}` : c.prop; val.value = c.frames; unit.value = "frames"; of.hidden = true; stg.value = c.stagger || "";
    const nm = curveNameIn(c.bz, b);
    if (nm) cur.value = nm; else { b.motion.curves.push({ name: `${b.name} captured ${b.motion.curves.length + 1}`, bezier: c.bz, use: "Captured from the timeline", source: { date: today(), by: "panel" } }); await saveBrand(x); toast("Its curve was new: saved to the brand's curves too."); brands.render(); return; }
    tForm.hidden = false; el.focus();
  };
  wrap.append(h("div", { class: "subhead" }, `Timing · ${b.motion.timing.length}`, fpsNote), ...tRows,
    h("div", { class: "crow" },
      h("button", { class: "btn", title: "Read the selected keyframes (duration, curve, stagger) as a benchmark", onclick: capture }, "\u2316 Capture from selection"),
      h("button", { class: "btn", onclick: () => { tForm.hidden = !tForm.hidden; el.focus(); } }, "+ Add timing")), tForm);

  // everything
  const allCur = h("select", { class: "field" }, [...b.motion.curves.map((c) => h("option", { value: c.name }, c.name + " (brand)")), ...CV.easings.map((e) => h("option", { value: e.name, selected: e.name === (b.feel || {}).curve }, e.name))]);
  let selOnly = false;
  wrap.append(h("div", { class: "subhead" }, "Apply to everything"),
    h("div", { class: "card-box" },
      h("div", { class: "note", style: "padding:0 0 6px" }, "Re-ease every keyframe in the comp with one curve (holds and markers are left alone). Undo restores it."),
      allCur,
      h("label", {}, h("input", { type: "checkbox", onchange: (e) => (selOnly = e.target.checked) }), " Only the selected layers"),
      h("button", { class: "solid apply", style: "margin-top:6px;width:100%", onclick: async () => {
        const c = curveByName(allCur.value) || b.motion.curves.find((k) => k.name === allCur.value); if (!c) return;
        if (!confirm(`Re-ease every keyframe ${selOnly ? "of the selected layers" : "in this comp"} with ${c.name}?`)) return;
        report(await call("mdna_reease", { bz: c.bezier, name: c.name, selectedOnly: selOnly }));
      } }, "Re-ease all keyframes")));
  return wrap;
}
function curveNameIn(bz, b) {
  const near = (c) => c.bezier.every((v, i) => Math.abs(v - bz[i]) < 0.02);
  const own = (b.motion.curves || []).find(near); if (own) return own.name;
  const tk = CV.easings.find(near); return tk ? tk.name : "";
}

function kitRules(x) {
  const b = x.b, CATS_R = ["layout", "typography", "motion", "effects", "color", "audio", "edit", "process"];
  let cat = "";
  const list = h("div", { class: "rules" });
  const draw = () => list.replaceChildren(...(b.rules || []).filter((r) => (!cat || r.category === cat) && (!S.q || (r.rule + " " + (r.why || "")).toLowerCase().includes(S.q)))
    .map((r) => h("div", { class: "rule" }, h("span", { class: "tag" }, r.category), " ", r.rule, r.why ? h("div", { class: "why" }, r.why) : null)));
  const filt = h("select", { class: "field", onchange: (e) => { cat = e.target.value; draw(); } }, [h("option", { value: "" }, "All categories"), ...CATS_R.map((c) => h("option", { value: c }, c))]);
  const rc = h("select", { class: "field" }, CATS_R.map((c) => h("option", { value: c, selected: c === "motion" }, c)));
  const rule = h("input", { class: "field", placeholder: "The rule: one instruction anyone can follow" }), why = h("input", { class: "field", placeholder: "Why (what went wrong, who asked)" });
  const form = h("div", { class: "saveform", hidden: true }, rc, rule, why, h("div", { class: "row" },
    h("button", { class: "solid apply", onclick: async () => {
      if (!rule.value.trim()) return rule.focus();
      b.rules = b.rules || [];
      b.rules.push({ id: (b.rules.reduce((m, r) => Math.max(m, r.id || 0), 0) + 1), category: rc.value, rule: rule.value.trim(), why: why.value.trim(), source: { project: BR.project.split(/[\\/]/).pop() || "", date: today(), by: "panel" } });
      await saveBrand(x); brands.render();
    } }, "Save rule"), h("button", { class: "btn", onclick: () => (form.hidden = true) }, "Cancel")));
  draw();
  return h("div", { class: "stack" }, h("div", { class: "crow" }, filt, h("button", { class: "btn", onclick: () => { form.hidden = !form.hidden; rule.focus(); } }, "+ Add rule")), form, list);
}
function kitProjects(x) {
  const b = x.b; b.projects = b.projects || [];
  const add = async () => {
    if (!BR.project) return toast("Save the After Effects project first.", true);
    if (b.projects.some((p) => p.path === BR.project)) return toast("This project is already listed.");
    b.projects.push({ name: BR.project.split(/[\\/]/).pop().replace(/\.aep$/i, ""), path: BR.project, date: today() });
    await saveBrand(x); brands.render();
  };
  return h("div", { class: "stack" }, h("button", { class: "btn", onclick: add }, "+ Add this project"),
    ...b.projects.map((p) => h("div", { class: "row-item" }, h("div", { class: "row-text" }, h("b", {}, p.name), h("span", {}, `${p.date || ""} · ${p.path || ""}`)))));
}

// ---------- 5. Techniques ----------
function techniques() {
  const sec = $("#sec-techniques"); sec.replaceChildren();
  const grid = h("div", { class: "grid", style: "grid-template-columns:repeat(auto-fill,minmax(180px,1fr))" });
  const TT = {}; for (const t of S.tags.techniques || []) TT[t.name] = t;
  const refresh = () => {
    grid.replaceChildren(...S.techniques.filter((t) => {
      const tg = TT[t.name] || { energy: [1, 5], tones: [] };
      if (S.q && !(t.name + " " + t.what + " " + tg.tones.join(" ")).toLowerCase().includes(S.q)) return false;
      if (S.tone && tg.tones.length && !tg.tones.includes(S.tone)) return false;
      return inRange(tg.energy);
    }).map((t) => {
      const s = slug(t.name), it = { name: t.name, title: "Technique: " + t.name, use: t.what + "\nHow: " + t.how + "\nWith Claude: “" + t.ask + "”",
        favKey: "technique/" + t.name, img: asset(`library/techniques/${s}_md.png`) };
      const c = h("button", { class: "card", title: t.what }, h("span", { class: "thumb" }, h("img", { src: asset(`library/techniques/${s}_md.png`), alt: "", loading: "lazy" })), h("span", { class: "label" }, t.name));
      c.onclick = () => {
        S.sel = it; for (const x of grid.children) x.classList.remove("sel"); c.classList.add("sel");
        detail.replaceChildren(h("div", { class: "rules-head" }, t.name), h("p", {}, t.what), h("p", {}, h("b", {}, "How: "), t.how),
          h("p", {}, h("b", {}, "With Claude: "), "“" + t.ask + "”"));
        detail.hidden = false;
      };
      return c;
    }));
  };
  const detail = h("div", { class: "detail", hidden: true });
  sec.append(filtersBar(false, refresh), detail, grid);
  refresh();
}

// F5 / Ctrl+R reloads the panel (after an update)
document.addEventListener("keydown", (e) => { if (e.key === "F5" || ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "r")) { e.preventDefault(); location.reload(); } });

boot().catch((e) => { const b = $("#boot"); if (b) b.textContent = "Motion DNA could not start: " + e.message; console.error(e); });
