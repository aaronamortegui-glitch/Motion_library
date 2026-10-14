"""Records the CEP panel (panel/index.html) in a headless browser: short GIFs that each tell one thing it does.

The panel runs in its browser preview mode (host.js answers for After Effects; for the Agent, small Node stand-ins
answer for Claude Code), with a fictional demo brand (Vela), so the GIFs are the same on every machine. Each GIF is
~340 px wide and under 500 KB, in docs/screens/:
  cep-connect.gif        Agent > Connect: Claude and Figma, each one button, green by itself
  cep-create-modify.gif  Behaviors: no keyframes → Create; keyframes → Modify or Replace
  cep-curves.gif         Curves: drag a handle, pick a curve from the library
  cep-brand-learns.gif   a review note in the chat → a rule proposal → one click → the brand's rules
  cep-brand-share.gif    where the brand lives, Download to share, Import an update (rules merge, shown as new)
  cep-library.gif        Agent > Library: a style, a technique and a kit piece, its order, Use in chat
  cep-workspace.gif      the brand's own conversation (Start in Claude app) and a new project for a video
  cep-panel.gif          the tour: all of the above
Needs Playwright (pip install playwright) and Chrome or Edge.

  python tools/record_cep_panel.py            # → docs/screens/cep-*.gif
  python tools/record_cep_panel.py --png      # also keeps the frames in research/cep_frames/
"""
import functools
import http.server
import json
import pathlib
import shutil
import subprocess
import sys
import threading

from playwright.sync_api import sync_playwright

ROOT = pathlib.Path(__file__).resolve().parent.parent
FRAMES = ROOT / "research" / "cep_frames"
OUT = ROOT / "docs" / "screens"

# a fictional brand for the demo (no client data)
VELA = {"name": "Vela", "slug": "vela", "created": "2026-10-13", "by": "demo",
        "identity": {"colors": {"ink": "#101418", "teal": "#3DD6C6", "pearl": "#F3F1EC"}, "fonts": {"title": "Instrument Serif", "ui": "Inter Tight"}},
        "feel": {"energy": [1, 3], "tones": ["premium", "calm", "modern"], "style": "Elegant", "curve": "Coast"},
        "presets": {"prefer": {}, "avoid": []},
        "motion": {"curves": [{"name": "Vela Glide", "bezier": [0.3, 0.12, 0.1, 1], "use": "hero entrances, the car"}],
                   "timing": [{"element": "Title in", "value": 20, "unit": "frames", "curve": "Vela Glide", "stagger": 3},
                              {"element": "Car reveal", "value": 900, "unit": "ms", "curve": "Vela Glide"}]},
        "rules": [{"id": 1, "uid": "a1b2c3d4", "category": "typography", "rule": "Headlines in Instrument Serif, everything else Inter Tight",
                   "why": "the brand book", "updated": "2026-10-13", "source": {"project": "Vela One launch", "date": "2026-10-13", "by": "Aaron"}}],
        "removed": [], "projects": [{"name": "Vela One launch", "path": "D:/Clients/vela/projects/vela-one-launch", "date": "2026-10-13"}]}
# what a teammate sends back: one new rule and an edit
SHARED = json.loads(json.dumps(VELA))
SHARED["rules"].append({"id": 3, "uid": "e5f6a7b8", "category": "layout", "rule": "Specs sit on cards under the car, never on the paint",
                        "why": "client review", "updated": "2026-10-14", "source": {"project": "Vela One launch", "date": "2026-10-14", "by": "Gian"}})
SHARED["exported_by"] = "Gian"

# Node stand-ins so the Agent renders outside After Effects (nothing runs: the sign-in "succeeds" a moment later)
STANDINS = """
window.__previewAgent = true; window.process = { platform: 'win32', env: {} };
window.__signedIn = false;
window.require = (m) => ({
  fs: { readdirSync: () => { throw new Error('preview'); }, existsSync: () => false, statSync: () => { throw new Error('preview'); },
        mkdirSync() {}, appendFileSync() {}, writeFileSync() {} },
  path: { join: (...a) => a.join('/'), dirname: (p) => p },
  os: { homedir: () => 'C:/Users/you' },
  crypto: null,
  child_process: {
    execFile: (exe, args, opts, cb) => { cb = cb || opts; setTimeout(() => cb && cb(null,
      args[0] === 'auth' ? JSON.stringify({ loggedIn: window.__signedIn, authMethod: 'claude.ai' })
      : args[0] === 'mcp' && args[1] === 'list' ? (window.__figmaOn ? 'claude.ai Figma: https://mcp.figma.com/mcp - ✔ Connected' : 'plugin:figma:figma: https://mcp.figma.com/mcp (HTTP) - ! Needs authentication') : '', ''), 150); },
    exec: () => { setTimeout(() => { window.__signedIn = true; window.__figmaOn = window.__figmaWanted; }, 1200); },
    spawn: () => ({ stdout: { on() {} }, stderr: { on() {} }, on() {}, kill() {} }),
  },
}[m]);
"""


def serve():
    class Quiet(http.server.SimpleHTTPRequestHandler):
        def log_message(self, *a):
            pass
    srv = http.server.ThreadingHTTPServer(("127.0.0.1", 0), functools.partial(Quiet, directory=str(ROOT)))
    threading.Thread(target=srv.serve_forever, daemon=True).start()
    return srv


def gif(frames, out, width=340, colors=112):
    """frames: PNG paths in order → out (its own palette, 8 fps)."""
    lst = FRAMES / (out.stem + ".txt")
    lst.write_text("".join(f"file '{f.as_posix()}'\nduration 0.125\n" for f in frames) + f"file '{frames[-1].as_posix()}'\n", encoding="utf-8")
    pal, vf = FRAMES / (out.stem + "_pal.png"), f"fps=8,scale={width}:-1:flags=lanczos"
    base = ["ffmpeg", "-v", "error", "-y", "-f", "concat", "-safe", "0", "-i", str(lst)]
    subprocess.run(base + ["-vf", vf + f",palettegen=max_colors={colors}", str(pal)], check=True)
    subprocess.run(base + ["-i", str(pal), "-lavfi", vf + "[x];[x][1:v]paletteuse=dither=bayer:bayer_scale=4", str(out)], check=True)
    print(f"{out.relative_to(ROOT)}: {len(frames)} frames, {out.stat().st_size // 1024} KB")


def main():
    if FRAMES.exists():
        shutil.rmtree(FRAMES)
    FRAMES.mkdir(parents=True)
    srv = serve()
    parts, cur, n = {}, [], [0]
    with sync_playwright() as p:
        browser = p.chromium.launch(channel="chrome")
        page = browser.new_page(viewport={"width": 400, "height": 760}, device_scale_factor=1)
        page.add_init_script(STANDINS + f"window.__demoBrands = [{{ where: 'local', dir: 'D:/Clients/vela', b: {json.dumps(VELA)} }}];"
                             + f"window.__demoImport = {json.dumps(SHARED)};"
                             + "try { localStorage.clear(); } catch (e) {}")
        page.goto(f"http://127.0.0.1:{srv.server_port}/panel/index.html")
        page.wait_for_timeout(1800)

        def shot(hold=1):
            for _ in range(hold):
                f = FRAMES / f"f{n[0]:04d}.png"; page.screenshot(path=str(f)); cur.append(f); n[0] += 1

        def js(code, wait=300, hold=4):
            page.evaluate(code); page.wait_for_timeout(wait); shot(hold)

        def section(name):
            nonlocal cur
            parts[name] = cur; cur = []

        go = "S.sec = '{0}'; store.set('section', '{0}'); showSection();"
        tab = "AG.tab = '{0}'; store.set('agentTab', '{0}'); agent.render();"

        # 1 · Connect: Claude, then Figma, each one button
        js(go.format("agent") + "AG.logged = false; AG.figma = 'auth'; agent.render(); agent.showSetup(); document.querySelector('#main').scrollTop = 0", wait=600, hold=8)
        js("[...document.querySelectorAll('.setup button')].find(b => b.textContent === 'Connect Claude').click()", wait=200, hold=3)
        page.wait_for_timeout(5200); shot(6)
        js("window.__figmaWanted = true; [...document.querySelectorAll('.setup button')].find(b => b.textContent === 'Connect Figma').click()", wait=200, hold=3)
        page.wait_for_timeout(7000); shot(10)
        section("connect")

        # 2 · Create / Modify / Replace
        js(go.format("behaviors") + "document.querySelector('#main').scrollTop = 0", hold=3)
        cards = page.locator("#sec-behaviors .card")
        cards.nth(4).hover(); page.wait_for_timeout(300)
        for _ in range(10):
            shot(); page.wait_for_timeout(90)
        cards.nth(4).click(); shot(2)
        js("window.__demoSel = { layers: 2, own: 0, ours: 0 }; selHint(); document.querySelector('#main').scrollTop = 99999", hold=9)
        js("window.__demoSel = { layers: 1, own: 1, ours: 0 }; selHint()", hold=9)
        js("document.querySelector('.existing button[data-existing=replace]').click()", hold=7)
        js("document.querySelector('.existing button[data-existing=modify]').click()", hold=3)
        section("create-modify")

        # 3 · Curves
        js(go.format("curves") + "document.querySelector('#main').scrollTop = 0", hold=4)
        h = page.locator("svg.editor circle.handle").first
        box = h.bounding_box()
        page.mouse.move(box["x"] + 3, box["y"] + 3); page.mouse.down()
        for i in range(12):
            page.mouse.move(box["x"] + 3 + i * 6, box["y"] + 3 - i * 4); page.wait_for_timeout(40); shot()
        page.mouse.up(); shot(3)
        js("[...document.querySelectorAll('#sec-curves .grid.curves .card')][2].click()", hold=6)
        section("curves")

        # 4 · A review note becomes a brand rule
        js("setActive('vela');" + go.format("agent") + tab.format("chat") + "AG.log = []; saveLog(); agent.draw();", wait=500, hold=3)
        js("push('you', 'The car bounces at the end. Make it glide in and settle, no overshoot.')", hold=4)
        js("push('step', 'get_brand · vela'); push('step', 'apply_preset · Coast Rise on Car (modified, values kept)')", hold=4)
        js("""push('agent', 'Done: the car keeps its keyframes and now glides in on Vela Glide over 27 frames, with no overshoot.');
              push('rule', 'The car never bounces: it glides in and settles, no overshoot', { rule: { category: 'motion', rule: 'The car never bounces: it glides in and settles, no overshoot', why: 'review: a bounce reads cheap' }, state: null });
              push('done', 'Done in 14s · 6 turns · 38k tokens · ≈ $0.12 (estimate)')""", hold=12)
        js("[...document.querySelectorAll('.msg.rule button')].find(b => b.textContent === 'Vela').click()", wait=500, hold=8)
        js("BR.view = 'kit'; BR.slug = 'vela'; BR.tab = 'rules';" + go.format("brands") + "brands.render(); document.querySelector('#main').scrollTop = 0", wait=400, hold=14)
        section("brand-learns")

        # 5 · Where it lives, share, import an update
        js("BR.tab = 'overview'; brands.render(); document.querySelector('#main').scrollTop = 0", hold=12)
        js("[...document.querySelectorAll('#sec-brands button')].find(b => b.textContent === 'Download to share').click()", wait=500, hold=9)
        js("[...document.querySelectorAll('#sec-brands button')].find(b => b.textContent === 'Import an update').click()", wait=900, hold=14)
        section("brand-share")

        # 6 · Library: a style, a technique and a kit piece, with their orders
        js(go.format("agent") + tab.format("library") + "document.querySelector('#main').scrollTop = 0", wait=500, hold=4)
        js("document.querySelectorAll('#sec-agent .lib-grid .card')[1].click(); document.querySelector('#main').scrollTop = 0", hold=8)
        js("[...document.querySelectorAll('#sec-agent .seg button')].find(b => b.textContent === 'Techniques').click()", hold=3)
        js("document.querySelectorAll('#sec-agent .lib-grid .card')[1].click(); document.querySelector('#main').scrollTop = 0", hold=8)
        js("[...document.querySelectorAll('#sec-agent .seg button')].find(b => b.textContent === 'Kit').click(); document.querySelector('#main').scrollTop = 0", hold=6)
        js("[...document.querySelectorAll('#sec-agent .lib-grid .card')].find(c => c.dataset.key === 'kit/transition/Liquid Wipe').click(); document.querySelector('#main').scrollTop = 0", hold=8)
        js("[...document.querySelectorAll('#sec-agent button')].find(b => b.textContent === 'Use in chat').click()", wait=500, hold=10)
        section("library")

        # 7 · The brand's own conversation and a project per video
        js("BR.view = 'kit'; BR.slug = 'vela'; BR.tab = 'claude';" + go.format("brands") + "brands.render(); document.querySelector('#main').scrollTop = 0", wait=400, hold=14)
        js(go.format("agent") + tab.format("project") + "document.querySelector('#main').scrollTop = 0", wait=500, hold=14)
        section("workspace")
        browser.close()
    srv.shutdown()
    OUT.mkdir(parents=True, exist_ok=True)
    for name, frames in parts.items():
        gif(frames, OUT / f"cep-{name}.gif")
    gif([f for k in parts for f in parts[k][::4]], OUT / "cep-panel.gif", 280, 56)   # the tour: a third of the frames, lighter
    if "--png" not in sys.argv:
        shutil.rmtree(FRAMES)


if __name__ == "__main__":
    main()
