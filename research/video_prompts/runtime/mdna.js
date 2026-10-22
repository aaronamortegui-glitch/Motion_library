// Motion DNA runtime for code-rendered video templates (research; not part of the plugin yet).
// A template is a page that defines   MDNA.scene({ w, h, duration, fps, alpha, render(t) })   where render(t) draws the
// frame at time t (seconds) as a pure function of t: no timers, no Math.random without a seed, no real clock.
// That makes every frame reproducible: tools render it frame by frame (html_to_mp4.py) and a browser previews it live.
// Colours, fonts, curves and durations come from tokens/superside_motion_tokens.json (copied below; keep in sync).
(function () {
  const TOKENS = {
    color: { pine: "#0A211F", spark: "#D8FF85", cloud: "#F7F9F2", sea: "#174A46", ink: "#04120F", mint: "#9FD8C2", coral: "#FF8A6B", sky: "#7FB8FF" },
    font: { display: "'Instrument Serif', Georgia, serif", ui: "'Inter Tight', Arial, sans-serif" },
    // name: cubic-bezier, from the token file
    ease: { Flat: [0, 0, 1, 1], Land: [0.12, 0.9, 0.28, 1], Launch: [0.55, 0, 0.9, 0.6], Settle: [0.3, 0, 0.1, 1],
            Cruise: [0.5, 0, 0.15, 1], Pop: [0.34, 1.45, 0.64, 1], Recoil: [0.6, 0, 0.75, -0.4], Ramp: [0.87, 0, 0.13, 1],
            Surge: [0.7, 0, 0.3, 1], Whip: [0.75, 0, 0.05, 1], Coast: [0.18, 0.28, 0, 0.9], Nudge: [0.22, 0.38, 0.05, 1.08],
            "Wind-up": [0.53, -0.25, 0.28, 0.89], Snap: [0, 1.17, 0, 0.91] },
    dur: { Tick: 0.133, Blink: 0.2, Glide: 0.3, Arrive: 0.467, Sweep: 0.7, Stage: 1.1 },
  };

  // fonts from the repo (OFL), relative to research/video_prompts/templates/<file>.html
  const css = document.createElement("style");
  css.textContent = `
    @font-face { font-family: 'Inter Tight'; src: url('../../../assets/fonts/InterTight[wght].ttf') format('truetype'); font-weight: 100 900; }
    @font-face { font-family: 'Instrument Serif'; src: url('../../../assets/fonts/InstrumentSerif-Regular.ttf') format('truetype'); }
    @font-face { font-family: 'Instrument Serif'; font-style: italic; src: url('../../../assets/fonts/InstrumentSerif-Italic.ttf') format('truetype'); }
    html, body { margin: 0; padding: 0; overflow: hidden; background: transparent; }
    #stage { position: relative; overflow: hidden; transform-origin: 0 0; }
  `;
  document.head.appendChild(css);

  function bezier(x1, y1, x2, y2) {   // cubic-bezier(x1,y1,x2,y2) as y(x), Newton + bisection
    const A = (a, b) => 1 - 3 * b + 3 * a, B = (a, b) => 3 * b - 6 * a, C = a => 3 * a;
    const f = (t, a, b) => ((A(a, b) * t + B(a, b)) * t + C(a)) * t, d = (t, a, b) => 3 * A(a, b) * t * t + 2 * B(a, b) * t + C(a);
    return x => {
      if (x <= 0) return 0; if (x >= 1) return 1;
      let t = x;
      for (let i = 0; i < 8; i++) { const s = d(t, x1, x2); if (Math.abs(s) < 1e-6) break; t -= (f(t, x1, x2) - x) / s; }
      if (t < 0 || t > 1) { let lo = 0, hi = 1; t = x; for (let i = 0; i < 30; i++) { const v = f(t, x1, x2); if (v < x) lo = t; else hi = t; t = (lo + hi) / 2; } }
      return f(t, y1, y2);
    };
  }
  const EASE = {}; for (const k in TOKENS.ease) EASE[k] = bezier(...TOKENS.ease[k]);

  const clamp = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v));
  const lerp = (a, b, p) => a + (b - a) * p;
  // progress of t through [a, b], eased with a token curve
  const seg = (t, a, b, ease = "Cruise") => EASE[ease](clamp((t - a) / (b - a)));
  // tween a value: k(t, [[t0, v0], [t1, v1, "Land"], ...]) (each key's ease drives the move into it)
  function k(t, keys) {
    if (t <= keys[0][0]) return keys[0][1];
    for (let i = 1; i < keys.length; i++) {
      const [t1, v1, e] = keys[i], [t0, v0] = keys[i - 1];
      if (t <= t1) { const p = seg(t, t0, t1, e || "Cruise"); return Array.isArray(v0) ? v0.map((x, j) => lerp(x, v1[j], p)) : lerp(v0, v1, p); }
    }
    return keys[keys.length - 1][1];
  }
  function rng(seed) { let s = seed >>> 0 || 1; return () => ((s = Math.imul(s ^ (s >>> 15), 2246822519) ^ Math.imul(s ^ (s >>> 13), 3266489917)) >>> 0) / 4294967296; }
  const noise = (x, seed = 1) => { const i = Math.floor(x), f = x - i, h = n => { const r = rng(n * 7919 + seed * 104729); return r(); }; const u = f * f * (3 - 2 * f); return lerp(h(i), h(i + 1), u); };

  // 2D canvas helpers shared by the templates
  function draw(canvas) {
    const g = canvas.getContext("2d");
    return {
      g,
      txt(s, x, y, size, col, w = 700, fam = TOKENS.font.ui, align = "center", track = 0, base = "middle") {
        g.font = `${w} ${size}px ${fam}`; g.fillStyle = col; g.textAlign = align; g.textBaseline = base; g.letterSpacing = track + "px"; g.fillText(s, x, y); g.letterSpacing = "0px";
      },
      width(s, size, w = 700, fam = TOKENS.font.ui, track = 0) { g.font = `${w} ${size}px ${fam}`; g.letterSpacing = track + "px"; const m = g.measureText(s).width; g.letterSpacing = "0px"; return m; },
      rr(x, y, w, h, r) { g.beginPath(); g.roundRect(x, y, w, h, Math.max(0, Math.min(r, w / 2, h / 2))); },
      fill(c) { g.fillStyle = c; g.fill(); },
      bg(c, W = canvas.width, H = canvas.height) { g.fillStyle = c; g.fillRect(0, 0, W, H); },
      alpha(a, fn) { const o = g.globalAlpha; g.globalAlpha = o * clamp(a); fn(); g.globalAlpha = o; },
      at(x, y, s, r, fn) { g.save(); g.translate(x, y); if (r) g.rotate(r); if (s !== undefined && s !== 1) g.scale(s, s); fn(); g.restore(); },
      cursor(x, y, press = 0) {   // a clean arrow cursor; press 0..1 squashes it and draws a click ring
        g.save(); g.translate(x, y); if (press > 0) { g.beginPath(); g.arc(0, 0, 18 + 30 * press, 0, 7); g.strokeStyle = TOKENS.color.spark; g.globalAlpha = 1 - press; g.lineWidth = 4; g.stroke(); g.globalAlpha = 1; }
        g.scale(1 - 0.12 * Math.sin(press * Math.PI), 1 - 0.12 * Math.sin(press * Math.PI));
        g.beginPath(); g.moveTo(0, 0); g.lineTo(0, 46); g.lineTo(12, 35); g.lineTo(21, 54); g.lineTo(29, 50); g.lineTo(20, 32); g.lineTo(36, 32); g.closePath();
        g.fillStyle = "#fff"; g.fill(); g.lineWidth = 3; g.strokeStyle = TOKENS.color.ink; g.stroke(); g.restore();
      },
    };
  }
  // finish: the layer that makes code-drawn frames feel produced (grain, vignette, glow, light leaks, rich type)
  const GRAIN = (() => { const c = document.createElement("canvas"); c.width = c.height = 256; const x = c.getContext("2d"), d = x.createImageData(256, 256), r = rng(77);
    for (let i = 0; i < d.data.length; i += 4) { const v = r() * 255; d.data[i] = d.data[i + 1] = d.data[i + 2] = v; d.data[i + 3] = 255; } x.putImageData(d, 0, 0); return c; })();
  // o.light: a light background (paper, cloud): a soft pine-tinted vignette instead of black, which greys white out
  function finish(g, t, o = {}) {
    const W = g.canvas.width, H = g.canvas.height;
    if (o.vignette !== 0) { const a = o.vignette ?? (o.light ? 0.12 : 0.45), tint = o.light ? "10,33,31" : "0,0,0";
      const v = g.createRadialGradient(W / 2, H / 2, H * 0.35, W / 2, H / 2, H * 0.95); v.addColorStop(0, `rgba(${tint},0)`); v.addColorStop(1, `rgba(${tint},${a})`); g.fillStyle = v; g.fillRect(0, 0, W, H); }
    if (o.grain !== 0) { g.save(); g.globalAlpha = o.grain ?? 0.06; g.globalCompositeOperation = "overlay"; const f = Math.floor(t * 30), ox = (f * 97) % 256, oy = (f * 61) % 256;
      g.fillStyle = g.createPattern(GRAIN, "repeat"); g.translate(-ox, -oy); g.fillRect(ox, oy, W, H); g.restore(); }
  }
  // light = true for light backgrounds: additive light washes a pale page out to a white smudge, so it paints normally
  function glow(g, x, y, r, col, a = 1, light = false) { const gr = g.createRadialGradient(x, y, 0, x, y, r); gr.addColorStop(0, col); gr.addColorStop(1, col.length === 7 ? col + "00" : "rgba(0,0,0,0)");
    const o = g.globalAlpha; g.save(); g.globalAlpha = o * a * (light ? 0.35 : 1); g.globalCompositeOperation = light ? "source-over" : "lighter"; g.fillStyle = gr; g.fillRect(x - r, y - r, 2 * r, 2 * r); g.restore(); }
  // rich line: "Give your agent *taste.*" → sans words + serif italic accent in another colour; returns the width
  function rich(D, s, x, y, size, col, accent, align = "center", w = 700) {
    const parts = s.split(/(\*[^*]+\*)/).filter(Boolean).map(p => p.startsWith("*") ? { t: p.slice(1, -1), it: true } : { t: p, it: false });
    const fam = p => p.it ? "italic 400 " + (size * 1.12) + "px " + TOKENS.font.display : w + " " + size + "px " + TOKENS.font.ui, g = D.g;
    const ws = parts.map(p => { g.font = fam(p); g.letterSpacing = p.it ? "0px" : (-size * 0.02) + "px"; return g.measureText(p.t).width; }), total = ws.reduce((a, b) => a + b, 0);
    let cx = align === "center" ? x - total / 2 : align === "right" ? x - total : x;
    parts.forEach((p, i) => { g.font = fam(p); g.letterSpacing = p.it ? "0px" : (-size * 0.02) + "px"; g.fillStyle = p.it ? accent : col; g.textAlign = "left"; g.textBaseline = "alphabetic"; g.fillText(p.t, cx, y); cx += ws[i]; });
    g.letterSpacing = "0px"; return total;
  }
  function kicker(D, s, x, y, col, align = "center", size = 24) { size = Math.max(24, size);   // 24 px is the smallest that reads at 1080p
    D.txt(s.toUpperCase(), x, y, size, col, 600, TOKENS.font.ui, align, size * 0.32); }

  // true when the page was opened with ?notext: hybrid templates draw the plate only (text and UI go live in AE)
  const NOTEXT = /[?&]notext\b/.test(location.search);

  let SCENE = null;
  function scene(def) {
    SCENE = Object.assign({ w: 1920, h: 1080, fps: TOKENS.fps || 30, duration: 5, alpha: false }, def);
    const stage = document.getElementById("stage") || document.body.appendChild(Object.assign(document.createElement("div"), { id: "stage" }));
    stage.style.width = SCENE.w + "px"; stage.style.height = SCENE.h + "px";
    if (!SCENE.alpha) stage.style.background = SCENE.background || TOKENS.color.pine;
    if (SCENE.setup) SCENE.setup(stage);
    const preview = !/[?&]render\b/.test(location.search);
    if (preview) {   // live preview: scale to the window and loop
      const fit = () => { const s = Math.min(innerWidth / SCENE.w, innerHeight / SCENE.h); stage.style.transform = `scale(${s})`; };
      addEventListener("resize", fit); fit();
      const t0 = performance.now(); const loop = () => { SCENE.render(((performance.now() - t0) / 1000) % SCENE.duration); requestAnimationFrame(loop); }; loop();
    }
    // ready once the fonts and any images the template declares (def.images: [Image]) have loaded
    Promise.all([document.fonts.ready, ...(SCENE.images || []).map(im => im.decode ? im.decode().catch(() => {}) : Promise.resolve())]).then(() => { window.MDNA_READY = true; });
  }
  TOKENS.fps = 30;
  window.MDNA = { T: TOKENS, EASE, clamp, lerp, seg, k, rng, noise, scene, draw, NOTEXT, finish, glow, rich, kicker,
                  // used by html_to_mp4.py
                  info: () => SCENE && { w: SCENE.w, h: SCENE.h, fps: SCENE.fps, duration: SCENE.duration, alpha: SCENE.alpha },
                  frame: t => SCENE.render(t) };
})();
