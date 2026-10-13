// Talks to After Effects (panel/host/host.jsx) through CEP's evalScript. Outside After Effects (a browser, for
// design work) the calls are answered by a small stand-in so the UI can be previewed with a local web server:
//   python -m http.server 8765   (from the repo root)  →  http://localhost:8765/panel/index.html
const IN_AE = !!(window.__adobe_cep__);

function evalHost(src) {
  return new Promise((resolve) => {
    if (IN_AE) window.__adobe_cep__.evalScript(src, (r) => resolve(r));
    else resolve(browserStandIn(src));
  });
}
// call("mdna_apply", {kind, name}) → evaluates mdna_apply("{...}") in After Effects; objects travel as JSON strings
function call(fn, ...args) {
  const a = args.map((x) => JSON.stringify(typeof x === "string" ? x : JSON.stringify(x)));
  return evalHost(`${fn}(${a.join(",")})`);
}
function parse(r) { try { return JSON.parse(r); } catch (e) { return { error: String(r) }; } }

// the extension folder as a plain path (CEP returns a file URL)
function extensionPath() {
  if (!IN_AE) return "";
  let p = decodeURI(window.__adobe_cep__.getSystemPath("extension"));
  return p.replace(/^file:\/{2,3}/, navigator.platform.startsWith("Win") ? "" : "/");
}
function fileUrl(path) { return "file:///" + encodeURI(path.replace(/\\/g, "/").replace(/^\//, "")).replace(/#/g, "%23"); }

// reads a repo file (library JSON): XHR, because fetch() cannot read file:// URLs in CEP
function readJSON(url) {
  return new Promise((resolve, reject) => {
    const x = new XMLHttpRequest();
    x.open("GET", url);
    x.onload = () => { try { resolve(JSON.parse(x.responseText)); } catch (e) { reject(e); } };
    x.onerror = () => reject(new Error("cannot read " + url));
    x.send();
  });
}

function browserStandIn(src) {
  const fn = src.slice(0, src.indexOf("("));
  if (fn === "mdna_boot") return JSON.stringify({ root: "(browser preview)", presets: 0, bridge: true });
  if (fn === "mdna_status") return JSON.stringify({ bridge: true, minutes: 3 });
  if (fn === "mdna_apply") return "OK (browser preview: nothing applied)";
  if (fn === "mdna_remove") return "OK (browser preview: nothing removed)";
  if (fn === "mdna_brands") return JSON.stringify(window.__demoBrands || []);
  if (fn === "mdna_comp_info") return JSON.stringify({ fps: 30, project: "C:/projects/demo.aep" });
  if (fn === "mdna_capture") return JSON.stringify({ frames: 18, bz: [0.18, 0.28, 0, 0.9], layer: "Title", prop: "Position", stagger: 3, fps: 30 });
  if (fn === "mdna_brand_save") { const a = JSON.parse(JSON.parse(src.slice(src.indexOf("(") + 1, -1))); const b = JSON.parse(a.text); const L = (window.__demoBrands = window.__demoBrands || []); const i = L.findIndex((x) => x.b.slug === b.slug); if (i >= 0) L[i].b = b; else L.push({ local: true, b }); return "OK saved"; }
  if (fn === "mdna_read_curve") return "[0.25,0.1,0.25,1]";
  return "OK";
}
