// Motion DNA panel (CEP) — UI. Reads the library straight from the repo (library/*.json, thumbnails, GIFs) and asks
// After Effects (host/host.jsx) only to apply or remove. Sections, left to right: Project (step 1: connections and the
// project folder) · Behaviors · Curves · Brands · Agent (agent.js), whose Library holds the Styles and Techniques.
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
const kids = (...a) => a.flat().filter((x) => x != null && x !== false);   // append()/replaceChildren() print "null" otherwise
// Previews never show the broken-image icon: an image tries each source in turn, then becomes a named placeholder;
// a hover GIF replaces the still only once it has loaded. tools/check_previews.py lists what is missing.
function safeImg(srcs, label, attrs = {}) {
  const list = srcs.filter(Boolean); let i = 0;
  const img = h("img", Object.assign({ alt: "" }, attrs, { src: list[0] || "" }));
  img.addEventListener("error", () => {
    if (list[++i]) { img.src = list[i]; return; }
    img.replaceWith(h("span", { class: "noprev", title: "No preview yet (python tools/check_previews.py)" }, h("b", {}, String(label || "?").slice(0, 1)), "no preview"));
  });
  img.rest = img.src;
  return img;
}
function hoverPlay(card, img, gif) {
  let on = false;
  card.addEventListener("mouseenter", () => { on = true; const t = new Image(); t.onload = () => { if (on && img.isConnected) img.src = t.src; }; t.src = gif + "?t=" + Date.now(); card.classList.add("playing"); });
  card.addEventListener("mouseleave", () => { on = false; if (img.isConnected && img.src !== img.rest) img.src = img.rest; card.classList.remove("playing"); });
}
const store = {   // per-user conveniences (section, filters, favorites); the panel works without it
  get(k, d) { try { const v = localStorage.getItem("mdna." + k); return v == null ? d : JSON.parse(v); } catch (e) { return d; } },
  set(k, v) { try { localStorage.setItem("mdna." + k, JSON.stringify(v)); } catch (e) {} },
};

const S = {
  root: "", url: "", lib: [], recipes: [], tags: { presets: [], tones: [] }, tagOf: {}, packs: [], techniques: [],
  sec: ({ styles: "agent", techniques: "agent" })[store.get("section", "project")] || store.get("section", "project"),   // first run: Project, step 1
  cat: store.get("cat", "Moves"), sel: null, phase: "in",
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
    // re-read the host script on every load, so an updated host.jsx applies without restarting After Effects. A panel
    // docked in the workspace opens while After Effects is still starting, before its scripting answers: retry for a
    // minute instead of staying blank until someone presses F5.
    for (let tries = 0; ; tries++) {
      await evalHost(`try { $.evalFile(new File(${JSON.stringify(extensionPath() + "/host/host.jsx")})); "ok" } catch (e) { "ERR " + e }`);
      info = parse(await call("mdna_boot", extensionPath()));
      // the After Effects side comes from the clone too (the installed host.jsx is the copy made at install time)
      if (info.root && window.__base) await evalHost(`$.evalFile(new File(${JSON.stringify(info.root + "/panel/host/host.jsx")}))`);
      if (!info.error) break;
      if (tries >= 40 || /Repo not found/.test(info.error)) { bootMsg("Motion DNA could not start: " + info.error + " (F5 retries)", false); return; }
      bootMsg("Waiting for After Effects…");
      await new Promise((r) => setTimeout(r, 1500));
    }
    S.root = info.root; S.url = fileUrl(info.root) + "/";
    const f = new FontFace("Inter Tight", `url("${S.url}assets/fonts/InterTight%5Bwght%5D.ttf")`, { weight: "100 900" });
    f.load().then((ff) => document.fonts.add(ff)).catch(() => {});
  } else {
    S.url = new URL("../", location.href).href;
  }
  const [lib, tags, rec, packs, tech, kit, trs, fam] = await Promise.all([
    readJSON(asset("library/library.json")), readJSON(asset("library/tags.json")).catch(() => ({ presets: [], tones: [] })),
    readJSON(asset("library/recipes.json")).catch(() => ({ recipes: [] })), readJSON(asset("library/packs.json")).catch(() => ({ packs: [] })),
    readJSON(asset("library/techniques.json")).catch(() => ({ techniques: [] })),
    readJSON(asset("library/kit.json")).catch(() => ({ items: [] })), readJSON(asset("library/transitions.json")).catch(() => ({ transitions: [] })),
    readJSON(asset("library/kit_groups.json")).catch(() => ({ groups: [] })),
  ]);
  S.lib = lib.presets; S.tags = tags; S.packs = packs.packs; S.techniques = tech.techniques;
  // the kit Claude builds through MCP (transitions, elements, shapes, backgrounds, looks, text, moves, behaviours)
  const CLIP = ["zoom", "spin", "stretch", "slide", "flash", "dip", "shake", "twirl", "slices", "glitch"];
  const GROUP = { element: "Elements", shape: "Shapes", background: "Backgrounds", look: "Looks", text: "Text engine", move: "Moves", behavior: "Behaviours" };
  S.kit = trs.transitions.map((x) => ({ kind: "transition", group: CLIP.includes(x.type) ? "Clip transitions" : "Solid transitions", name: x.name, energy: x.energy, use: x.use, call: `solid_transition(look="${x.name}")` }))
    .concat(kit.items.map((x) => ({ kind: x.kind, group: GROUP[x.kind] || x.kind, name: x.name, energy: x.energy, use: x.use, call: x.call })));
  // one card per family (library/kit_groups.json); its variants are listed as text in the detail
  const byKey = {}; for (const k of S.kit) byKey[k.kind + "/" + k.name] = k;
  S.kitFamilies = (fam.groups || []).map((g) => ({ category: g.category, name: g.name, desc: g.desc,
    members: g.members.map((m) => byKey[m.kind + "/" + m.name]).filter(Boolean) })).filter((g) => g.members.length);
  for (const t of tags.presets || []) S.tagOf[t.name] = t;
  S.recipes = rec.recipes.map((r) => ({ name: r.id, slug: slug(r.id), kind: "recipe", channels: (r.channels || []).join(" & "),
    energy: ENERGY_WORD[r.energy] || r.energy, use: "Measured reference · " + (r.section || "") }));
  await loadCurves();
  $("#boot").remove();
  header(); tabs(); renderAll(); status(); setInterval(() => { status(); selHint(); }, 4000);
}

// ---------- header ----------
// The bridge is restarted only when someone is there: a click or key in the panel in the last 10 s, or an Agent order
// running (host.jsx mdna_bridge_heal). A timer alone would restart it into a dialog that is still open.
let lastTouch = 0;
for (const ev of ["pointerdown", "keydown"]) document.addEventListener(ev, () => { lastTouch = Date.now(); }, true);
async function status() {
  const present = Date.now() - lastTouch < 10000 || (typeof AG !== "undefined" && !!AG.proc);
  const s = parse(await call("mdna_status", present ? "1" : "0")), pill = $("#mcp");
  pill.classList.toggle("on", !!s.bridge); pill.classList.toggle("off", !s.bridge);
  const last = s.minutes >= 0 && s.minutes <= 1 ? " · active now" : (s.minutes > 1 && s.minutes < 60 ? ` · last ${s.minutes} min ago` : "");
  pill.title = s.bridge ? "Claude connected through MCP" + last : "Claude offline: click to connect";
}
// The bridge can look started yet stop answering: the MCP dot (and "reconnect" in the Agent chat) restarts it from here,
// with no Claude involved. Requests that waited too long are answered as skipped (host.jsx mdna_reconnect).
async function reconnectAE() {
  const r = parse(await call("mdna_reconnect"));
  const msg = r.ok ? "After Effects reconnected" + (r.skipped ? ` · ${r.skipped} old request${r.skipped > 1 ? "s" : ""} skipped: send ${r.skipped > 1 ? "them" : "it"} again` : "") + "."
    : "Could not reconnect: " + (r.error || "restart After Effects.");
  toast(msg, !r.ok); status(); return { ok: !!r.ok, msg };
}
function header() {
  $("#mcp").onclick = () => reconnectAE();
  $("#visualizer").onclick = () => call("mdna_open", S.root + "/library/index.html");
  $("#help").onclick = () => alert("Motion DNA is connected to Claude through MCP.\n\nIn Claude Code, open the repo folder (" + (S.root || "the Motion DNA clone") +
    ").\nClaude can list presets, apply them and styles to your selected layers, add assets and render frames to check its work.\n\nTry: \"Apply the Elegant style to this comp and show me a frame.\"");
}

// ---------- sections ----------
// Project is the first section. An installed index.html older than it lacks its tab and section: add them here, so a
// panel updated through git shows it before setup.py reinstalls the page.
const PROJECT_TAB = '<svg viewBox="0 0 24 24"><path d="M2.5 6.5A1.5 1.5 0 0 1 4 5h5l2 2.2h9A1.5 1.5 0 0 1 21.5 8.7V18a1.5 1.5 0 0 1-1.5 1.5H4A1.5 1.5 0 0 1 2.5 18z" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round"/><path d="M12 10.5v6M9 13.5h6" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/></svg><span>Project</span>';
function ensureProjectSection() {
  if (!$("#sec-project")) $("#main").insertBefore(h("section", { id: "sec-project", class: "section", hidden: true }), $("#sec-behaviors"));
  if (!$('#tabs button[data-sec="project"]')) {
    const b = h("button", { "data-sec": "project", title: "Project: step 1. Connect Claude and your apps, and set up the project folder; then move left to right" });
    b.innerHTML = PROJECT_TAB; $("#tabs").prepend(b);
  }
}
function tabs() {
  ensureProjectSection();
  for (const b of document.querySelectorAll("#tabs button")) b.onclick = () => { S.sec = b.dataset.sec; store.set("section", S.sec); showSection(); };
  showSection();
}
function showSection() {
  for (const b of document.querySelectorAll("#tabs button")) b.classList.toggle("on", b.dataset.sec === S.sec);
  for (const s of document.querySelectorAll("#main > .section")) s.hidden = s.id !== "sec-" + S.sec;   // only the five sections, not the stacks inside them
  $("#main").scrollTop = 0;
}
function renderAll() { behaviors(); curves(); brands(); if (typeof agent === "function") agent(); }

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

const CTL = { speed: 1, intensity: 1, dir: 0, ease: 0, stagger: 4, markers: true, open: store.get("controlsOpen", false), existing: store.get("existing", "modify") };
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
  // only when a selected layer already has keyframes: keep them (Modify) or start over (Replace)
  const ex = h("div", { class: "seg small existing", title: "A selected layer already has keyframes" }, ...[["modify", "Modify"], ["replace", "Replace"]].map(([k, l]) =>
    h("button", { class: CTL.existing === k ? "on" : "", "data-existing": k, title: k === "modify" ? "Keep its keyframes and values; give them this timing and curve" : "Swap its animation for this one on the channels the preset uses; the others stay",
      onclick: () => { CTL.existing = k; store.set("existing", k); for (const b of document.querySelectorAll(".existing button")) b.classList.toggle("on", b.dataset.existing === k); selHint(); } }, l)));
  const exRow = h("div", { class: "crow existing-row", hidden: true }, h("span", { style: "flex:none" }, "The layer already has keyframes:"), ex);
  const hint = h("span", { class: "dim sel-hint" }, "Select the layers to animate.");
  setTimeout(selHint, 0);
  return h("div", { class: "stack", style: "gap:6px" }, exRow, hint,
    h("div", { class: "actions" }, h("div", { class: "phases" }, radios),
    h("div", { class: "buttons" },
      h("button", { class: "solid apply apply-main", title: "Apply to the selected layers", onclick: onApply }, "Apply"),
      h("button", { class: "solid remove", title: "Remove Motion DNA animation from the selected layers", onclick: removeAnim }, "Remove"))));
}
// What Apply will do with the current selection (refreshed with the header status): no keyframes → Create; keyframes →
// the Modify / Replace choice shows and the button says which; a mix → both, in words.
let SELINFO = {};
async function selHint() {
  const els = document.querySelectorAll(".sel-hint"); if (!els.length) return;
  const i = parse(await call("mdna_sel_info")); SELINFO = i;
  const n = i.layers || 0, own = i.own || 0, ours = i.ours || 0, fresh = n - own - ours, mod = CTL.existing === "modify";
  let t, label = "Apply";
  if (!n) t = "Select the layers to animate.";
  else if (!own) {
    label = "Create";
    t = (n === 1 ? "The layer has" : `The ${n} layers have`) + " no keyframes: Apply creates the animation." + (ours ? ` (${ours} with an earlier Motion DNA move: redone.)` : "");
  } else {
    label = mod ? "Modify" : "Replace";
    const who = own === n ? (n === 1 ? "Its" : "Their") : `${own} layer${own > 1 ? "s have" : " has"} keyframes:`;
    t = mod ? `${who} keyframes stay; Apply changes their timing and curve (values kept).` : `${who} animation is swapped for the preset on the channels it uses; the rest stays.`;
    if (own !== n) t = mod ? `${who} they stay; Apply changes their timing and curve (values kept).` : `${who} swapped for the preset on the channels it uses; the rest stays.`;
    if (fresh || ours) { label = "Apply"; t += ` ${fresh + ours} without keyframes: created.`; }
  }
  for (const r of document.querySelectorAll(".existing-row")) {
    r.hidden = !own;
    const lab = r.querySelector("span"); if (lab) lab.textContent = own > 1 ? `${own} layers already have keyframes:` : "The layer already has keyframes:";
  }
  if (transitionMode()) {   // two layers in Transitions: one linked move, the first selected leaves as the second arrives
    label = "Transition"; t = `${i.names[0]} leaves as ${i.names[1]} arrives, at the playhead (select the outgoing layer first).`;
    for (const r of document.querySelectorAll(".existing-row")) r.hidden = true;
  }
  for (const b of document.querySelectorAll(".apply-main")) b.textContent = label;
  for (const e of els) e.textContent = t;
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
      const img = safeImg([it.thumb], it.name, { loading: "lazy" });
      const c = h("button", { class: "card" + (S.sel && S.sel.favKey === it.favKey ? " sel" : ""), title: `${it.name} · ${it.energy || ""}\n${it.use || ""}` },
        h("span", { class: "thumb" }, img), h("span", { class: "label" }, (S.favs.has(it.favKey) ? "★ " : "") + it.name));
      hoverPlay(c, img, it.img);   // hover plays the preset's real motion (its GIF, from the start) right on the thumbnail
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
function transitionMode() { return S.sec === "behaviors" && S.cat === "Transitions" && SELINFO.layers === 2 && S.sel && S.sel.kind === "motion"; }
async function applyBehavior() {
  if (!S.sel || !S.sel.kind) return toast("Pick a preset in the gallery first.", true);
  if (transitionMode()) { report(await call("mdna_transition", { name: S.sel.name, tune: tuning() })); return selHint(); }
  report(await call("mdna_apply", { kind: S.sel.kind, name: S.sel.name, phase: S.phase, tune: tuning(), stagger: CTL.stagger, markers: CTL.markers, existing: CTL.existing })); selHint();
}

// ---------- 2. Curves: a Flow-style editor (drag the handles, type the values) and the token library ----------
const SVGNS = "http://www.w3.org/2000/svg";
const sv = (tag, attrs = {}) => { const e = document.createElementNS(SVGNS, tag); for (const [k, v] of Object.entries(attrs)) e.setAttribute(k, v); return e; };
// the editor starts on the S curve (1, 0, 0, 1): a full ease in and out, the usual starting point to shape from
const S_CURVE = [1, 0, 0, 1];
const CV = { bz: S_CURVE.slice(), name: "S curve", easings: [] };
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
    CV.name = curveName(b) || (b.every((v, i) => v === S_CURVE[i]) ? "S curve" : ""); nameEl.textContent = CV.name || "Custom curve";
    if (document.activeElement !== vals) vals.value = bzText(b);
    del.disabled = !isUserCurve(CV.name);
    for (const c of lib.children) c.classList.toggle("sel", c.dataset.name === CV.name);
  };
  // Dragging a handle. A press anywhere in the editor takes the nearest handle (the dots are small, and a trackpad
  // misses them), the position comes from the editor's box and its viewBox (getScreenCTM is off on Retina screens in
  // CEP on macOS), mouse and pointer events both start it (a CEP build that drops one still has the other), and the
  // pointer is captured, so the drag survives leaving the editor. Values clamp to the visible range.
  const toCurve = (ev) => {
    const r = svg.getBoundingClientRect(), vb = svg.viewBox.baseVal;
    const qx = vb.x + (ev.clientX - r.left) / r.width * vb.width, qy = vb.y + (ev.clientY - r.top) / r.height * vb.height;
    return { x: qx / 100, y: (100 - qy) / 100 };
  };
  let dragging = false;
  const drag = (idx) => (e) => {
    if (dragging) return; dragging = true;
    e.preventDefault();
    try { if (e.pointerId != null) svg.setPointerCapture(e.pointerId); } catch (err) {}
    const move = (ev) => {
      let { x, y } = toCurve(ev);
      if (ev.shiftKey) {   // Shift: the arm snaps to 0°, 45°, 90°… from its end of the curve, keeping its length
        const ax = idx, ay = idx, dx = x - ax, dy = y - ay, len = Math.hypot(dx, dy), a = Math.round(Math.atan2(dy, dx) / (Math.PI / 4)) * (Math.PI / 4);
        x = ax + len * Math.cos(a); y = ay + len * Math.sin(a);
      }
      CV.bz[idx * 2] = Math.round(Math.max(0, Math.min(1, x)) * 100) / 100;
      CV.bz[idx * 2 + 1] = Math.round(Math.max(R0, Math.min(R1, y)) * 100) / 100;
      draw();
    };
    const up = () => { dragging = false;
      for (const [t, f] of [["pointermove", move], ["mousemove", move], ["pointerup", up], ["mouseup", up], ["pointercancel", up], ["blur", up]]) window.removeEventListener(t, f); };
    for (const [t, f] of [["pointermove", move], ["mousemove", move], ["pointerup", up], ["mouseup", up], ["pointercancel", up], ["blur", up]]) window.addEventListener(t, f);
    move(e);   // the handle jumps to where you pressed
  };
  const nearest = (e) => { const { x, y } = toCurve(e), b = CV.bz; return Math.hypot(x - b[0], y - b[1]) <= Math.hypot(x - b[2], y - b[3]) ? 0 : 1; };
  const press = (e) => { if (e.button !== undefined && e.button !== 0) return; drag(nearest(e))(e); };
  svg.addEventListener("pointerdown", press); svg.addEventListener("mousedown", press);
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
  sec.append(h("div", { class: "editor-wrap" }, svg),
    h("div", { class: "crow" }, nameEl, vals),
    h("div", { class: "crow" }, applyBtn, readBtn, revBtn),
    h("span", { class: "dim" }, "Hold Shift while dragging to snap a handle to 45°. No keyframes selected? It re-eases every keyframe of the selected layers (values kept), and gives a layer with no animation a Fade Up on this curve."),
    h("div", { class: "crow" }, saveBtn, del, h("button", { class: "btn tobrand", title: "Save this curve to the active brand", onclick: () => toBrand() }, "Save to brand")), form,
    h("div", { class: "lib-head" }, libCount, search), lib);
  const toBrand = async () => {
    const b = activeBrand(); if (!b) return toast("Activate a brand first (Brands > open one > Activate).", true);
    BR.view = "kit"; BR.slug = b.slug; BR.tab = "motion"; S.sec = "brands"; store.set("section", "brands"); showSection(); brands.render();
    setTimeout(() => { const btn = [...document.querySelectorAll("#sec-brands .btn")].find((x) => x.textContent === "+ Add curve"); if (btn) btn.click(); }, 0);
  };
  library(); draw();
}

// ---------- 3. Brands: a workspace per client ----------
// A brand keeps its motion spec (curves, timing benchmarks in frames / ms / %), the rules learned in reviews and its
// projects. One brand can be active per After Effects project: a chip in the header opens its kit from any section,
// the Curves library shows its curves first, and Apply uses its style and curve.
// Where they live: only TEMPLATES are in the repo (library/brands/<slug>, e.g. Motion DNA). Your brands stay on this
// computer, in the plugin folder (library/brands.local) or in a folder you choose; to share one, Export it to a file
// and Import it on the other computer: the rules merge (new, edited and removed rules travel) and the ones that came in
// show as new. Same files and merge as tools/brand.py (schema: library/brands/_schema.md).
let BRANDS = [];   // [{where: "local"|"external"|"template", dir, b}]
const BR = { view: "list", slug: null, tab: "overview", fps: 30, project: "", where: "plugin", folder: "" };
const brandOf = (slug) => BRANDS.find((x) => x.b.slug === slug);
const activeMap = () => store.get("activeBrands", {});
function activeSlug() { const m = activeMap(); return m[BR.project || "(unsaved)"] || null; }
function setActive(slug) { const m = activeMap(); const k = BR.project || "(unsaved)"; if (slug) m[k] = slug; else delete m[k]; store.set("activeBrands", m); brandChip(); if (curves.refresh) curves.refresh(); if (typeof onBrandChange === "function") onBrandChange(slug); }
function activeBrand() { const x = brandOf(activeSlug()); return x ? x.b : null; }
function ensureMotion(b) { b.motion = b.motion || {}; b.motion.curves = b.motion.curves || []; b.motion.timing = b.motion.timing || []; b.rules = b.rules || []; b.removed = b.removed || []; return b; }
const today = () => new Date().toISOString().slice(0, 10);
const slugify = (s) => s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
const WHERE = { template: "template", local: "this computer", external: "own folder" };
function whoAmI() { try { return nodeReq() ? (process.env.USERNAME || process.env.USER || "") : ""; } catch (e) { return ""; } }

// rule ids that travel: a uid per rule (older rules get one from their text, the same way tools/brand.py does it)
async function sha8(text) {
  const t = text.trim().toLowerCase();
  try { if (nodeReq()) return nodeReq()("crypto").createHash("sha1").update(t, "utf8").digest("hex").slice(0, 8); } catch (e) {}
  const buf = await crypto.subtle.digest("SHA-1", new TextEncoder().encode(t));
  return [...new Uint8Array(buf)].map((x) => x.toString(16).padStart(2, "0")).join("").slice(0, 8);
}
async function ensureUids(b) { for (const r of b.rules || []) if (!r.uid) r.uid = await sha8(r.rule); }
const newUid = () => Math.random().toString(16).slice(2, 10).padEnd(8, "0");

async function saveBrand(x) {
  await ensureUids(x.b);
  const clean = Object.assign({}, x.b); for (const k of Object.keys(clean)) if (k.startsWith("_")) delete clean[k];
  const r = await call("mdna_brand_save", { dir: x.dir, external: x.where === "external", text: JSON.stringify(clean, null, 1) + "\n" });
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
  BRANDS = Array.isArray(r) ? r.filter((x) => x && x.b && x.b.slug).map((x) => Object.assign({ where: x.local ? "local" : "template" }, x)) : [];
  for (const x of BRANDS) { ensureMotion(x.b); await ensureUids(x.b); }   // uids from the text as loaded, the way tools/brand.py derives them
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
function brandCard(x, act) {
  const b = x.b, m = b.motion || {}, fresh = (b.inbox || []).length;
  const thumb = x.dir && IN_AE ? fileUrl(x.dir) + "/thumb.png" : "";
  const c = h("button", { class: "card" + (b.slug === act ? " sel" : ""), title: `Open ${b.name} · ${WHERE[x.where] || x.where}${x.dir ? "\n" + x.dir : ""}` },
    h("span", { class: "thumb" }, h("img", { src: thumb, alt: "", loading: "lazy", onerror: (e) => e.target.replaceWith(h("span", { class: "initial" }, b.name.slice(0, 1))) })),
    h("span", { class: "label" }, b.name, x.where === "template" ? h("em", { class: "badge" }, "template") : null,
      b.slug === act ? h("em", { class: "badge on" }, "active") : null, fresh ? h("em", { class: "badge new" }, `${fresh} new`) : null),
    h("span", { class: "label dim" }, `${(m.curves || []).length} curves · ${(m.timing || []).length} timings · ${(b.rules || []).length} rules`));
  c.onclick = () => { BR.view = "kit"; BR.slug = b.slug; BR.tab = fresh ? "rules" : "overview"; brands.render(); $("#main").scrollTop = 0; };
  return c;
}
function brandList() {
  const wrap = h("div", { class: "stack" }), act = activeSlug();
  const shown = BRANDS.filter((x) => {
    const b = x.b, f = b.feel || {};
    if (S.q && !(b.name + " " + (f.tones || []).join(" ") + " " + (b.rules || []).map((r) => r.rule).join(" ")).toLowerCase().includes(S.q)) return false;
    if (S.tone && !(f.tones || []).includes(S.tone)) return false;
    return inRange(f.energy);
  });
  const mine = shown.filter((x) => x.where !== "template"), tpl = shown.filter((x) => x.where === "template");
  const grid = (list) => h("div", { class: "grid", style: "grid-template-columns:repeat(auto-fill,minmax(180px,1fr))" }, ...list.map((x) => brandCard(x, act)));
  wrap.append(...kids(filtersBar(false, () => brands.render()),
    h("div", { class: "crow" },
      h("button", { class: "solid apply", onclick: () => { BR.view = "new"; brands.render(); } }, "+ New brand"),
      h("button", { class: "btn", title: "Load a brand someone shared with you (a .motiondna-brand.json file). If you already have it, its rules merge.", onclick: importBrand }, "Import brand file")),
    h("div", { class: "subhead" }, "Your brands ", h("span", { class: "dim" }, "· on this computer")),
    mine.length ? grid(mine) : h("div", { class: "note", style: "padding:0" }, "None yet. Create one per client: its curves, timing and rules stay with it, on your computer. Share it with Export."),
    tpl.length ? h("div", { class: "subhead" }, "Templates ", h("span", { class: "dim" }, "· in the repo, a starting point")) : null,
    tpl.length ? grid(tpl) : null));
  return wrap;
}
function newBrandForm() {
  const name = h("input", { class: "field", placeholder: "Client or brand name" });
  const style = h("select", { class: "field" }, [h("option", { value: "" }, "Base style (optional)"), ...S.packs.map((pk) => h("option", { value: pk.name }, pk.name))]);
  const curve = h("select", { class: "field" }, [h("option", { value: "" }, "Main curve (optional)"), ...CV.easings.map((e) => h("option", { value: e.name }, e.name))]);
  const tones = h("input", { class: "field", placeholder: "Tones (e.g. calm, modern)" });
  const from = h("select", { class: "field", title: "Start from a template: its curves, timing and rules are copied" },
    [h("option", { value: "" }, "Start empty"), ...BRANDS.map((x) => h("option", { value: x.b.slug }, "Start from " + x.b.name))]);
  const whereTxt = h("span", { class: "dim" });
  const drawWhere = () => { whereTxt.textContent = BR.where === "folder" ? (BR.folder ? BR.folder + "/<brand>" : "pick a folder…") : "On this computer (never in git)"; };
  const whereSeg = h("div", { class: "seg" }, ...[["plugin", "Plugin folder"], ["folder", "Choose folder…"]].map(([k, l]) => h("button", { class: BR.where === k ? "on" : "",
    onclick: async (e) => {
      if (k === "folder") { const f = await call("mdna_pick_folder", "Where should this brand live?"); if (!f || String(f).startsWith("ERR")) return; BR.folder = f; }
      BR.where = k; for (const b of whereSeg.children) b.classList.toggle("on", b === e.currentTarget); drawWhere();
    } }, l)));
  drawWhere();
  const create = async () => {
    const nm = name.value.trim(); if (!nm) return name.focus();
    const slug = slugify(nm); if (brandOf(slug)) return toast(`"${nm}" already exists.`, true);
    if (BR.where === "folder" && !BR.folder) return toast("Pick the folder first.", true);
    const base = from.value ? JSON.parse(JSON.stringify(brandOf(from.value).b)) : null;
    const b = { name: nm, slug, created: today(), by: whoAmI() || "panel", identity: { colors: {}, fonts: {} },
      feel: { energy: [2, 3], tones: tones.value.split(",").map((s) => s.trim()).filter(Boolean), style: style.value, curve: curve.value },
      presets: { prefer: {}, avoid: [] }, motion: { curves: [], timing: [] }, rules: [], removed: [], projects: [] };
    if (base) { b.motion = base.motion || b.motion; b.rules = (base.rules || []).map((r) => Object.assign({}, r)); b.presets = base.presets || b.presets;
      b.feel = Object.assign({}, base.feel, { tones: b.feel.tones.length ? b.feel.tones : (base.feel || {}).tones, style: style.value || (base.feel || {}).style, curve: curve.value || (base.feel || {}).curve }); b.from = base.slug; }
    const dir = BR.where === "folder" ? BR.folder + "/" + slug : S.root + "/library/brands.local/" + slug;
    const x = { where: BR.where === "folder" ? "external" : "local", dir, b: ensureMotion(b) };
    if (String(await saveBrand(x)).startsWith("OK")) {
      if (typeof ensureClaudeFolder === "function") await ensureClaudeFolder(dir, "brand", nm, slug);
      BRANDS.push(x); BR.view = "kit"; BR.slug = slug; BR.tab = "overview"; brands.render(); toast(`${nm} created in ${dir}.`);
    }
  };
  return h("div", { class: "stack" }, backBar("New brand"), h("div", { class: "saveform" }, name, from, style, curve, tones,
    h("div", { class: "subhead", style: "margin:2px 0 0" }, "Where it lives"), whereSeg, whereTxt,
    h("div", { class: "row" }, h("button", { class: "solid apply", onclick: create }, "Create"), h("button", { class: "btn", onclick: () => { BR.view = "list"; brands.render(); } }, "Cancel"))),
    h("div", { class: "note", style: "padding:0" }, "Stays on your computer. To share it: Download, then the other person imports it (rules merge)."));
}
function backBar(title, extra) {
  return h("div", { class: "kit-top" }, h("button", { class: "icon back", title: "All brands", onclick: () => { BR.view = "list"; brands.render(); } }, "‹"), h("span", { class: "kit-title" }, title), ...[].concat(extra || []));
}

// export / import: one file per brand; importing an existing brand merges it (same rules as tools/brand.py merge)
async function exportBrand(x) {
  await ensureUids(x.b);
  const out = Object.assign({}, x.b); delete out.inbox; delete out.claude; for (const k of Object.keys(out)) if (k.startsWith("_")) delete out[k];
  out.exported = today(); out.exported_by = whoAmI();
  const png = x.dir ? await call("mdna_b64_file", x.dir + "/thumb.png") : ""; if (png && !String(png).startsWith("ERR")) out.thumb_png = png;
  const path = await call("mdna_pick_save", x.b.slug + ".motiondna-brand.json"); if (!path) return;
  report(await call("mdna_write_file", { path: /\.json$/i.test(path) ? path : path + ".json", text: JSON.stringify(out, null, 1) + "\n" }));
}
async function mergeBrand(mine, theirs) {
  await ensureUids(mine); await ensureUids(theirs);
  const rules = new Map((mine.rules || []).map((r) => [r.uid, r])), removed = new Map((mine.removed || []).map((x) => [x.uid, x]));
  for (const x of theirs.removed || []) if (!removed.has(x.uid) || (x.date || "") > (removed.get(x.uid).date || "")) removed.set(x.uid, x);
  const n = { new: 0, updated: 0, removed: 0, curves: 0, timing: 0 }, inbox = [];
  const stamp = (r) => r.updated || (r.source || {}).date || "";
  for (const r0 of theirs.rules || []) {
    const r = Object.assign({}, r0), u = r.uid;
    if (removed.has(u) && (removed.get(u).date || "") >= stamp(r)) continue;
    if (!rules.has(u)) { r.id = Math.max(0, ...[...rules.values()].map((x) => x.id || 0)) + 1; rules.set(u, r); inbox.push(u); n.new++; }
    else if (stamp(r) > stamp(rules.get(u)) && (r.rule !== rules.get(u).rule || r.why !== rules.get(u).why)) { r.id = rules.get(u).id; rules.set(u, r); inbox.push(u); n.updated++; }
  }
  for (const [u, x] of removed) if (rules.has(u) && (x.date || "") >= stamp(rules.get(u))) { rules.delete(u); n.removed++; }
  mine.rules = [...rules.values()].sort((a, b) => (a.id || 0) - (b.id || 0)); mine.removed = [...removed.values()];
  ensureMotion(mine);
  for (const [key, nm] of [["curves", "name"], ["timing", "element"]]) {
    const have = new Set(mine.motion[key].map((c) => c[nm]));
    for (const c of ((theirs.motion || {})[key] || [])) if (!have.has(c[nm])) { mine.motion[key].push(c); n[key]++; }
  }
  mine.inbox = [...new Set((mine.inbox || []).concat(inbox))];
  (mine.shared = mine.shared || []).push({ date: today(), by: whoAmI(), from: theirs.exported_by || "" });
  return n;
}
async function importBrand() {
  const path = await call("mdna_pick_open", "Import a Motion DNA brand"); if (!path) return;
  let theirs; try { theirs = JSON.parse(await call("mdna_read_file", path)); } catch (e) { return toast("That file is not a Motion DNA brand.", true); }
  if (!theirs || !theirs.slug || !theirs.name) return toast("That file is not a Motion DNA brand.", true);
  const png = theirs.thumb_png; delete theirs.thumb_png;
  let x = brandOf(theirs.slug), n;
  if (x) n = await mergeBrand(ensureMotion(x.b), theirs);
  else {
    delete theirs.exported; delete theirs.claude; const from = theirs.exported_by; delete theirs.exported_by; await ensureUids(theirs);
    theirs.inbox = (theirs.rules || []).map((r) => r.uid); (theirs.shared = theirs.shared || []).push({ date: today(), by: whoAmI(), from: from || "" });
    x = { where: "local", dir: S.root + "/library/brands.local/" + theirs.slug, b: ensureMotion(theirs) }; BRANDS.push(x);
    n = { new: theirs.rules.length, updated: 0, removed: 0, curves: 0, timing: 0 };
  }
  if (!String(await saveBrand(x)).startsWith("OK")) return;
  if (png) await call("mdna_b64_write", { path: x.dir + "/thumb.png", b64: png });
  if (typeof ensureClaudeFolder === "function") await ensureClaudeFolder(x.dir, "brand", x.b.name, x.b.slug);
  BR.view = "kit"; BR.slug = x.b.slug; BR.tab = "rules"; brands.render();
  const pl = (k, one, many) => `${k} ${k === 1 ? one : many}`;
  toast(`${x.b.name}: ` + [pl(n.new, "new rule", "new rules"), n.updated ? pl(n.updated, "rule edited", "rules edited") : "", n.removed ? pl(n.removed, "rule removed", "rules removed") : "",
    n.curves ? pl(n.curves, "curve", "curves") : "", n.timing ? pl(n.timing, "timing", "timings") : ""].filter(Boolean).join(", ") + ".");
}

function brandKit(x) {
  const b = x.b, isActive = activeSlug() === b.slug;
  const colors = Object.values((b.identity || {}).colors || {});
  const activeBtn = h("button", { class: "btn" + (isActive ? " on" : ""), title: "Make this the brand of the current After Effects project",
    onclick: () => { setActive(isActive ? null : b.slug); brands.render(); } }, isActive ? "✓ Active" : "Activate");
  const top = backBar(b.name, [activeBtn]);
  const strip = h("div", { class: "swatches" }, ...colors.map((c) => h("i", { style: `background:${c}`, title: c })),
    h("em", { class: "badge", title: x.dir || "" }, WHERE[x.where] || x.where));
  const fresh = (b.inbox || []).length;
  const tabsEl = h("div", { class: "seg" }, ...["overview", "motion", "rules", "claude"].map((k) =>
    h("button", { class: BR.tab === k ? "on" : "", onclick: () => { BR.tab = k; brands.render(); } }, k[0].toUpperCase() + k.slice(1) + (k === "rules" && fresh ? ` · ${fresh} new` : ""))));
  const body = BR.tab === "motion" ? kitMotion(x) : BR.tab === "rules" ? kitRules(x) : BR.tab === "claude" ? kitClaude(x) : kitOverview(x);
  return h("div", { class: "stack" }, top, strip, x.where === "template" ? h("div", { class: "note", style: "padding:0" }, "A template from the repo: edits reach the team only when someone commits them. For a client, create a new brand and start from this one.") : null, tabsEl, body);
}

function kitOverview(x) {
  const b = x.b, f = b.feel || {}, pr = b.presets || {};
  const style = h("select", { class: "field", onchange: async (e) => { f.style = e.target.value; b.feel = f; await saveBrand(x); } },
    [h("option", { value: "" }, "—"), ...S.packs.map((pk) => h("option", { value: pk.name, selected: pk.name === f.style }, pk.name))]);
  const curve = h("select", { class: "field", onchange: async (e) => { f.curve = e.target.value; b.feel = f; await saveBrand(x); } },
    [h("option", { value: "" }, "—"), ...CV.easings.map((e) => h("option", { value: e.name, selected: e.name === f.curve }, e.name))]);
  let whole = true;
  const apply = async () => report(await call("mdna_apply_brand", { slug: b.slug, phase: S.phase, whole, tune: tuning(), markers: CTL.markers, existing: CTL.existing }));
  const prefer = Object.entries(pr.prefer || {}).map(([role, list]) => h("div", { class: "kv" }, h("span", {}, role), h("span", {}, list.join(", "))));
  return h("div", { class: "stack" }, ...kids(whereCard(x), shareCard(x),
    h("div", { class: "subhead" }, "Feel"),
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
    (pr.avoid || []).length ? h("div", { class: "card-box avoid" }, h("div", { class: "kv" }, h("span", {}, "Avoid"), h("span", {}, pr.avoid.join(", ")))) : null));
}
// where the brand's files are, in plain words
function whereCard(x) {
  const tpl = x.where === "template";
  const row = (f, what) => h("div", { class: "kv" }, h("span", {}, f), h("span", {}, what));
  return h("div", { class: "card-box" },
    h("div", { class: "kit-top" }, h("b", { class: "kit-title", style: "font-size:13px" }, "Where it lives"),
      x.dir ? h("button", { class: "btn", onclick: () => call("mdna_open", x.dir) }, "Open folder") : null),
    h("span", { class: "dim", style: "word-break:break-all" }, x.dir || "(browser preview)"),
    row("brand.json", "rules, curves, timing, style"), row("thumb.png", "its card in the panel"),
    tpl ? null : row("CLAUDE.md", "what Claude reads when it works in this folder"),
    tpl ? null : row("projects/", "one folder per video, each with its conversation"),
    h("span", { class: "dim" }, tpl ? "A template in the Motion DNA repo." : "On this computer only: never in the repo."));
}
// sharing: one file out, one file in
function shareCard(x) {
  return h("div", { class: "card-box" },
    h("b", {}, "Share this brand"),
    h("span", {}, `Download one file (${x.b.slug}.motiondna-brand.json) and send it. The other person opens Brands › Import brand file: they get the rules, curves and timing; if they already have the brand, new and edited rules merge into theirs.`),
    h("div", { class: "crow" },
      h("button", { class: "solid apply", onclick: () => exportBrand(x) }, "Download to share"),
      h("button", { class: "btn", onclick: importBrand }, "Import an update")),
    h("span", { class: "dim" }, "Conversations stay on each computer; the brand file carries what was learned."));
}
// the brand's own conversation (its workspace): controllable from the Claude app
function kitClaude(x) {
  if (x.where === "template") return h("div", { class: "note", style: "padding:0" }, "Templates have no conversation of their own. Create a brand from it (New brand › Start from…) to work on a client.");
  if (activeSlug() !== x.b.slug) return h("div", { class: "stack" },
    h("span", {}, `Activate ${x.b.name} to work with Claude in its folder: everything about this brand goes into one conversation, which you can also open in the Claude app.`),
    h("button", { class: "solid apply", onclick: () => { setActive(x.b.slug); brands.render(); } }, `Activate ${x.b.name}`));
  if (typeof ensureClaudeFolder === "function") ensureClaudeFolder(x.dir, "brand", x.b.name, x.b.slug);
  return h("div", { class: "stack" },
    h("div", { class: "note", style: "padding:0" }, "Everything about this brand in one conversation: here (Agent) or in the Claude app. Each video of the brand gets its own (the Project tab)."),
    typeof conversationCard === "function" ? conversationCard() : null,
    h("button", { class: "btn", onclick: () => { S.sec = "agent"; store.set("section", "agent"); AG.tab = "chat"; store.set("agentTab", "chat"); showSection(); agent.render(); } }, "Go to the chat"),
    h("div", { class: "subhead" }, "Videos of this brand"), kitProjects(x));
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

const RULE_CATS = ["layout", "typography", "motion", "effects", "color", "audio", "edit", "process"];
// a rule form: new (r = null) or editing r. onSave(rule fields) saves; the same form serves brands and projects
function ruleForm(r, onSave, onCancel) {
  const rc = h("select", { class: "field" }, RULE_CATS.map((c) => h("option", { value: c, selected: c === ((r && r.category) || "motion") }, c)));
  const rule = h("textarea", { class: "field agent-input", rows: 2, placeholder: "The rule: one instruction anyone can follow" }); rule.value = r ? r.rule : "";
  const why = h("input", { class: "field", placeholder: "Why (what went wrong, who asked)", value: r ? r.why || "" : "" });
  return h("div", { class: "saveform" }, rc, rule, why, h("div", { class: "row" },
    h("button", { class: "solid apply", onclick: () => { if (!rule.value.trim()) return rule.focus(); onSave({ category: rc.value, rule: rule.value.trim(), why: why.value.trim() }); } }, r ? "Save changes" : "Save rule"),
    h("button", { class: "btn", onclick: onCancel }, "Cancel")));
}
// the rules list: filter by category, add, edit, remove (a removal is kept, so it travels when the brand is shared)
function rulesEditor(owner, save, opts = {}) {
  const b = owner; b.rules = b.rules || []; b.removed = b.removed || [];
  let cat = "", editing = null, adding = false;
  const wrap = h("div", { class: "stack" });
  const draw = () => {
    const inbox = new Set(b.inbox || []);
    const list = b.rules.filter((r) => (!cat || r.category === cat) && (!S.q || (r.rule + " " + (r.why || "")).toLowerCase().includes(S.q)));
    const filt = h("select", { class: "field", onchange: (e) => { cat = e.target.value; draw(); } }, [h("option", { value: "" }, `All categories · ${b.rules.length}`), ...RULE_CATS.map((c) => h("option", { value: c, selected: c === cat }, c))]);
    const rows = list.map((r) => editing === r ? ruleForm(r, async (f) => {
      Object.assign(r, f, { updated: today() }); r.source = Object.assign({}, r.source, { edited_by: whoAmI() || "panel" }); editing = null; await save(); draw();
    }, () => { editing = null; draw(); }) : h("div", { class: "rule" + (inbox.has(r.uid) ? " fresh" : "") },
      h("div", { class: "rule-top" }, h("span", { class: "tag" }, r.category), inbox.has(r.uid) ? h("em", { class: "badge new" }, "new") : null, h("span", { class: "grow" }),
        h("button", { class: "btn ghost small", title: "Edit this rule", onclick: () => { editing = r; adding = false; draw(); } }, "Edit"),
        h("button", { class: "btn ghost small", title: "Remove this rule", onclick: async () => {
          if (!confirm(`Remove this rule?\n\n${r.rule}`)) return;
          b.rules.splice(b.rules.indexOf(r), 1);
          if (r.uid) b.removed.push({ uid: r.uid, rule: r.rule, date: today(), by: whoAmI() || "panel" });
          await save(); draw();
        } }, "✕")),
      h("div", { class: "rule-text" }, r.rule), r.why ? h("div", { class: "why" }, r.why) : null,
      h("div", { class: "why" }, [r.source && r.source.project, r.source && r.source.date, r.source && r.source.by].filter(Boolean).join(" · "))));
    const form = adding ? ruleForm(null, async (f) => {
      b.rules.push(Object.assign({ id: b.rules.reduce((m, r) => Math.max(m, r.id || 0), 0) + 1, uid: newUid() }, f,
        { updated: today(), source: { project: opts.project ? opts.project() : "", date: today(), by: whoAmI() || "panel" } }));
      adding = false; await save(); draw();
    }, () => { adding = false; draw(); }) : null;
    wrap.replaceChildren(...kids(h("div", { class: "crow" }, filt, h("button", { class: "btn", onclick: () => { adding = !adding; editing = null; draw(); } }, "+ Add rule")), form,
      inbox.size ? h("div", { class: "crow" }, h("span", { class: "dim" }, `${inbox.size} rule${inbox.size > 1 ? "s" : ""} came in from a shared copy.`),
        h("button", { class: "btn", style: "flex:none", onclick: async () => { b.inbox = []; await save(); draw(); } }, "Mark as read")) : null,
      list.length ? h("div", { class: "rules" }, ...rows) : h("div", { class: "note", style: "padding:0" }, opts.empty || "No rules yet. Review notes become rules: from the Agent, or + Add rule.")));
  };
  draw();
  return wrap;
}
function kitRules(x) {
  return rulesEditor(x.b, () => saveBrand(x), { project: () => (BR.project.split(/[\\/]/).pop() || "").replace(/\.aep$/i, "") });
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

// The Motion DNA helix (research/loaders, "DNA helix"): two strands of dots turning around each other. One animator draws
// every helix on screen with a shared phase: the header mark (tilted like the logo) and the Agent's "Working…" line
// (level). It turns slowly while the panel waits and speeds up while the Agent works; a helix element that is redrawn
// (the chat rebuilds its log) keeps turning without a jump, and one that leaves the page is dropped.
const HELIX = { items: new Set(), ph: 0, speed: 1 / 7, last: 0, running: false };
function helix(size, tilt = 0) {
  const dpr = Math.max(1, window.devicePixelRatio || 1), cv = document.createElement("canvas");
  cv.className = "helix"; cv.width = cv.height = Math.round(size * dpr); cv.style.width = cv.style.height = size + "px"; cv.setAttribute("aria-hidden", "true");
  HELIX.items.add({ cv, size, tilt, dpr });
  if (!HELIX.running) { HELIX.running = true; requestAnimationFrame(helixFrame); }
  return cv;
}
function helixDraw(g, S, ph, tilt) {
  g.rotate(tilt);
  const n = S < 20 ? 5 : 6, pts = [];
  for (let i = 0; i < n; i++) {
    const x = (-0.84 + 1.68 * i / (n - 1)) * S / 2, a = ph + i * 0.75, y = Math.sin(a) * S * 0.2, z = Math.cos(a);
    g.globalAlpha = 0.28; g.strokeStyle = "#9FD8C2"; g.lineWidth = 0.8; g.beginPath(); g.moveTo(x, y); g.lineTo(x, -y); g.stroke();
    pts.push([x, y, z, "#D8FF85"], [x, -y, -z, "#9FD8C2"]);
  }
  const r = S / 22;
  pts.sort((p, q) => p[2] - q[2]).forEach(([x, y, z, c]) => {
    g.globalAlpha = 0.5 + 0.5 * (z + 1) / 2; g.fillStyle = c; g.beginPath(); g.arc(x, y, (1.1 + 0.9 * (z + 1) / 2) * r, 0, 7); g.fill(); });
  g.globalAlpha = 1;
}
function helixFrame(now) {
  const dt = HELIX.last ? Math.min(0.1, (now - HELIX.last) / 1000) : 0; HELIX.last = now;
  const busy = typeof AG !== "undefined" && !!AG.proc;
  HELIX.speed += ((busy ? 1 / 1.4 : 1 / 7) - HELIX.speed) * Math.min(1, dt * 3);   // ease between rest and work
  HELIX.ph += dt * HELIX.speed * Math.PI * 2;
  for (const it of HELIX.items) {
    if (!it.cv.isConnected) { if (it.seen) HELIX.items.delete(it); continue; }
    it.seen = true; const g = it.cv.getContext("2d");
    g.setTransform(1, 0, 0, 1, 0, 0); g.clearRect(0, 0, it.cv.width, it.cv.height);
    g.setTransform(it.dpr, 0, 0, it.dpr, it.size * it.dpr / 2, it.size * it.dpr / 2); helixDraw(g, it.size, HELIX.ph, it.tilt);
  }
  setTimeout(() => requestAnimationFrame(helixFrame), 33);   // ~30 fps is plenty for marks this size
}
// anything that loads shows the helix next to its words (the boot note here; the Agent's checks in agent.js)
function loadingLabel(text, size = 14) { return h("span", { class: "loading" }, helix(size), text); }
function bootMsg(text, loading = true) { const b = $("#boot"); if (b) b.replaceChildren(loading ? loadingLabel(text, 18) : text); }
(function bootLoader() { const b = $("#boot"); if (b) bootMsg(b.textContent); })();
(function headerMark() {   // the header mark, tilted like the Motion DNA logo
  const title = document.querySelector(".top .title"); if (!title) return;
  const cv = helix(22, -0.72); cv.classList.add("mark"); title.parentNode.insertBefore(cv, title);
})();

// F5 / Ctrl+R reloads the panel (after an update)
document.addEventListener("keydown", (e) => { if (e.key === "F5" || ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "r")) { e.preventDefault(); location.reload(); } });

boot().catch((e) => { bootMsg("Motion DNA could not start: " + e.message, false); console.error(e); });
