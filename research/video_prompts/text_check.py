"""Text QA for a template: samples frames and reports every visible text that leaves the frame's safe area (40 px) or
overflows the card it sits on (the last rounded rect drawn before it that contains its anchor point).
Usage: python research/video_prompts/text_check.py templates/<file>.html [step_seconds=0.5]
"""
import os, sys
from playwright.sync_api import sync_playwright

src, step = os.path.abspath(sys.argv[1]), float(sys.argv[2]) if len(sys.argv) > 2 else 0.5
# patch MDNA.draw before the template runs, so every D.rr / D.txt is measured in screen pixels
HOOK = r"""
(() => {
  let M; window.__log = [];
  Object.defineProperty(window, "MDNA", { configurable: true, get() { return M; }, set(v) { M = v; const D0 = v.draw;
    v.draw = function (cv) { const D = D0(cv), g = D.g; let rects = [];
      const rr = D.rr; D.rr = function (x, y, w, h, r) { const m = g.getTransform(); if (g.globalAlpha > 0.3) rects.push([m.a * x + m.e, m.d * y + m.f, m.a * w, m.d * h]); return rr.apply(this, arguments); };
      const txt = D.txt; D.txt = function (s, x, y, size, col, w = 700, fam, align = "center", track = 0) {
        const m = g.getTransform(), width = D.width(String(s), size, w, fam, track) * m.a, X = m.a * x + m.e, Y = m.d * y + m.f;
        const x0 = align === "center" ? X - width / 2 : align === "right" ? X - width : X;
        if (g.globalAlpha > 0.6 && String(s).trim()) {
          const card = rects.slice().reverse().find(r => X >= r[0] && X <= r[0] + r[2] && Y >= r[1] && Y <= r[1] + r[3] && r[2] < 1800);
          window.__log.push({ s: String(s).slice(0, 70), x0, x1: x0 + width, y: Y, card: card || null });
        }
        return txt.apply(this, arguments); };
      D.__reset = () => { rects = []; };
      (window.__Ds = window.__Ds || []).push(D); return D; };
  } });
})();
"""
issues = {}
with sync_playwright() as p:
    b = p.chromium.launch(args=["--use-gl=angle", "--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--allow-file-access-from-files"])
    pg = b.new_page(viewport={"width": 1920, "height": 1080}); pg.add_init_script(script=HOOK)
    pg.goto("file:///" + src.replace("\\", "/") + "?render"); pg.wait_for_function("window.MDNA_READY === true", timeout=30000)
    n = int(pg.evaluate("MDNA.info().duration") / step)
    for i in range(n):
        t = round(i * step, 3)
        for r in pg.evaluate("t => { window.__log = []; (window.__Ds || []).forEach(D => D.__reset()); MDNA.frame(t); return window.__log; }", t):
            why = []
            if r["x0"] < 40 or r["x1"] > 1880: why.append("leaves the frame")
            c = r["card"]
            if c and (r["x0"] < c[0] + 4 or r["x1"] > c[0] + c[2] - 4): why.append("overflows its card")
            if why: issues.setdefault((r["s"], ", ".join(why)), []).append(t)
    b.close()
for (s, why), ts in sorted(issues.items(), key=lambda kv: kv[1][0]):
    print(f"{ts[0]:6.2f}-{ts[-1]:6.2f}s  {why:30s}  {s}")
print(len(issues), "issues")
