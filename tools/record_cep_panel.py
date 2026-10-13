"""Records the CEP panel (panel/index.html) in a headless browser and writes its GIFs to docs/screens/.

The panel runs in its browser preview mode (host.js answers for After Effects), so the tours are the same on every
machine. One GIF per section plus the full tour (each ~320 px wide, under 500 KB):
  cep-behaviors.gif   pick a preset (hover preview), the "If a layer already moves: Modify / Replace" choice
  cep-curves.gif      drag a handle of the curve editor, the library
  cep-brands.gif      a brand: where it lives, Share (download / import), rules, its Claude conversation
  cep-agent.gif       Agent › Library (styles and techniques with ready orders) and Connect (Claude, Figma)
  cep-panel.gif       all of the above in one tour (the README's main GIF)
Needs Playwright (pip install playwright) and Chrome or Edge.

  python tools/record_cep_panel.py            # → docs/screens/cep-*.gif
  python tools/record_cep_panel.py --png      # also keeps the frames in research/cep_frames/
"""
import functools
import http.server
import pathlib
import shutil
import subprocess
import sys
import threading

from playwright.sync_api import sync_playwright

ROOT = pathlib.Path(__file__).resolve().parent.parent
FRAMES = ROOT / "research" / "cep_frames"
OUT = ROOT / "docs" / "screens"


def serve():
    class Quiet(http.server.SimpleHTTPRequestHandler):
        def log_message(self, *a):
            pass
    srv = http.server.ThreadingHTTPServer(("127.0.0.1", 0), functools.partial(Quiet, directory=str(ROOT)))
    threading.Thread(target=srv.serve_forever, daemon=True).start()
    return srv


def gif(frames, out):
    """frames: list of PNG paths, in order → out (palette per GIF, 8 fps)."""
    lst = FRAMES / (out.stem + ".txt")
    lst.write_text("".join(f"file '{f.as_posix()}'\nduration 0.125\n" for f in frames), encoding="utf-8")
    pal, vf = FRAMES / (out.stem + "_pal.png"), "fps=8,scale=320:-1:flags=lanczos"
    base = ["ffmpeg", "-v", "error", "-y", "-f", "concat", "-safe", "0", "-i", str(lst)]
    subprocess.run(base + ["-vf", vf + ",palettegen=max_colors=96", str(pal)], check=True)
    subprocess.run(base + ["-i", str(pal), "-lavfi", vf + "[x];[x][1:v]paletteuse=dither=bayer:bayer_scale=4", str(out)], check=True)
    print(f"{out.relative_to(ROOT)}: {len(frames)} frames, {out.stat().st_size // 1024} KB")


def main():
    if FRAMES.exists():
        shutil.rmtree(FRAMES)
    FRAMES.mkdir(parents=True)
    srv = serve()
    parts, cur = {}, []
    n = [0]
    with sync_playwright() as p:
        browser = p.chromium.launch(channel="chrome")
        page = browser.new_page(viewport={"width": 400, "height": 760}, device_scale_factor=1)
        page.goto(f"http://127.0.0.1:{srv.server_port}/panel/index.html")
        page.wait_for_timeout(1500)

        def shot(hold=1):
            for _ in range(hold):
                f = FRAMES / f"f{n[0]:04d}.png"; page.screenshot(path=str(f)); cur.append(f); n[0] += 1

        def js(code, wait=250, hold=4):
            page.evaluate(code); page.wait_for_timeout(wait); shot(hold)

        def section(name):
            nonlocal cur
            parts[name] = cur; cur = []

        # Behaviors: hover a preset, pick it, the "already moves" choice and what Apply will do
        shot(5)
        cards = page.locator("#sec-behaviors .card")
        cards.nth(2).hover(); page.wait_for_timeout(300)
        for _ in range(12):
            shot(); page.wait_for_timeout(90)
        cards.nth(2).click(); shot(3)
        js("document.querySelector('#main').scrollTop = 99999", hold=8)
        js("document.querySelector('.existing button[data-existing=replace]').click()", hold=5)
        js("document.querySelector('.existing button[data-existing=modify]').click(); document.querySelector('#main').scrollTop = 0", hold=3)
        section("behaviors")
        # Curves: drag a handle
        js("document.querySelector('[data-sec=curves]').click()", hold=4)
        h = page.locator("svg.editor circle.handle").first
        box = h.bounding_box()
        page.mouse.move(box["x"] + 3, box["y"] + 3); page.mouse.down()
        for i in range(12):
            page.mouse.move(box["x"] + 3 + i * 6, box["y"] + 3 - i * 4); page.wait_for_timeout(40); shot()
        page.mouse.up(); shot(4)
        section("curves")
        # Brands: the kit, where it lives and share, rules, the Claude tab
        js("document.querySelector('[data-sec=brands]').click()", wait=600, hold=5)
        js("document.querySelector('#sec-brands .card').click()", hold=9)
        js("[...document.querySelectorAll('#sec-brands .seg button')].find(b => b.textContent.startsWith('Rules')).click()", hold=7)
        js("[...document.querySelectorAll('#sec-brands .seg button')].find(b => b.textContent.startsWith('Claude')).click()", hold=5)
        section("brands")
        # Agent: Library (a technique and its order), then Connect
        js("document.querySelector('[data-sec=agent]').click()", hold=4)
        js("[...document.querySelectorAll('#sec-agent .seg button')].find(b => b.textContent === 'Techniques').click()", hold=3)
        js("document.querySelectorAll('#sec-agent .lib-grid .card')[1].click(); document.querySelector('#main').scrollTop = 0", hold=9)
        js("""window.process = { platform: 'win32' }; AG.exe = 'claude'; AG.logged = false; AG.figma = 'auth';
              const sec = document.querySelector('#sec-agent'); sec.replaceChildren(); const box = h('div', { class: 'card-box setup' });
              sec.append(box); showSetup(box)""", hold=12)
        section("agent")
        browser.close()
    srv.shutdown()
    OUT.mkdir(parents=True, exist_ok=True)
    for name, frames in parts.items():
        gif(frames, OUT / f"cep-{name}.gif")
    gif([f for k in ("behaviors", "curves", "brands", "agent") for f in parts[k]], OUT / "cep-panel.gif")
    if "--png" not in sys.argv:
        shutil.rmtree(FRAMES)


if __name__ == "__main__":
    main()
