"""Renders a web FX page (tools/web_fx/<page>.html: tsParticles, paper.js, p5.js, OGL, three.js + Rapier, PixiJS) to a
video with alpha, frame by frame on a virtual clock, so libraries that animate in real time (requestAnimationFrame,
timers) give the same frames on any machine at any speed. Math.random is seeded too.

A page reads its options from location.hash (JSON), sets window.FX_READY = true once its libraries are loaded, and
starts its animation in window.FX_START(); before calling it the clock is paused, then it advances one frame at a
time and each frame is captured with transparency. Output: ProRes 4444 .mov with alpha
(alpha=true, default) or an H.264 .mp4; renders are cached in renders/web_fx/ by page + options.

Usage: python tools/web_capture.py <page> [--opts '{"colors": ["#D8FF85"]}'] [--w 1920 --h 1080 --fps 30 --dur 3] [--mp4] [out]
List the pages: python tools/web_capture.py list      (library/web_fx.json)
"""
import argparse, hashlib, json, os, subprocess, sys, urllib.parse

HERE = os.path.dirname(os.path.abspath(__file__)); ROOT = os.path.dirname(HERE)
PAGES = os.path.join(HERE, "web_fx"); CACHE = os.path.join(ROOT, "renders", "web_fx")
TOKENS = {"pine": "#0A211F", "spark": "#D8FF85", "cloud": "#F7F9F2", "sea": "#174A46", "ink": "#04120F", "mint": "#9FD8C2", "coral": "#FF8A6B", "sky": "#7FB8FF"}
SEED = """(() => { let s = %d >>> 0 || 1; Math.random = () => ((s = Math.imul(s ^ (s >>> 15), 2246822519) ^ Math.imul(s ^ (s >>> 13), 3266489917)) >>> 0) / 4294967296; })();"""


def capture(page, opts=None, w=1920, h=1080, fps=30, dur=3.0, alpha=True, out=None, seed=7, warmup=0.0):
    from playwright.sync_api import sync_playwright
    sys.path.insert(0, HERE); from sound_kit import browser, url
    opts = {**(opts or {}), "w": w, "h": h, "fps": fps, "dur": dur}   # each page has its own token palette by default
    src = open(os.path.join(PAGES, page + ".html"), "rb").read()   # the page itself is in the key: editing it renders again
    key = hashlib.sha1(json.dumps([page, opts, alpha, seed, warmup], sort_keys=True).encode() + src).hexdigest()[:10]
    os.makedirs(CACHE, exist_ok=True)
    out = out or os.path.join(CACHE, f"{page}_{key}" + (".mov" if alpha else ".mp4"))
    if os.path.exists(out): return out
    enc = (["-c:v", "prores_ks", "-profile:v", "4444", "-pix_fmt", "yuva444p10le"] if alpha
           else ["-c:v", "libx264", "-pix_fmt", "yuv420p", "-crf", "16", "-movflags", "+faststart"])
    with sync_playwright() as p:
        b = browser(p, "--use-gl=angle", "--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist")
        ctx = b.new_context(viewport={"width": w, "height": h}); ctx.add_init_script(SEED % seed); pg = ctx.new_page()
        errors = []; pg.on("pageerror", lambda e: errors.append(str(e)))
        pg.clock.install(time=0)
        pg.goto(url(os.path.join(PAGES, page + ".html"), "#" + urllib.parse.quote(json.dumps(opts))))
        for _ in range(600):   # loading scripts from the CDN runs on real time; the page's own clock waits
            if pg.evaluate("window.FX_READY === true") or errors: break
            pg.wait_for_timeout(100)
        if errors or not pg.evaluate("window.FX_READY === true"):
            b.close(); raise RuntimeError(f"{page} did not start: " + "; ".join(errors or ["FX_READY never set"]))
        pg.clock.pause_at(pg.evaluate("Date.now()") + 50); pg.clock.run_for(50)   # from here time moves only when we say so
        pg.evaluate("() => { if (window.FX_START) window.FX_START(); }")   # not awaited: its promises settle as the clock runs
        if warmup: pg.clock.run_for(int(warmup * 1000))
        ff = subprocess.Popen(["ffmpeg", "-v", "error", "-y", "-f", "image2pipe", "-framerate", str(fps), "-i", "-", *enc, out], stdin=subprocess.PIPE)
        stage = pg.locator("#stage")
        for i in range(round(dur * fps)):
            pg.clock.run_for(round(1000 / fps))
            ff.stdin.write(stage.screenshot(type="png", omit_background=alpha, animations="allow"))
        ff.stdin.close(); ff.wait(); b.close()
    if errors: raise RuntimeError("; ".join(errors))
    return out


if __name__ == "__main__":
    a = argparse.ArgumentParser(); a.add_argument("page"); a.add_argument("out", nargs="?"); a.add_argument("--opts", default="{}")
    a.add_argument("--w", type=int, default=1920); a.add_argument("--h", type=int, default=1080); a.add_argument("--fps", type=float, default=30)
    a.add_argument("--dur", type=float, default=3.0); a.add_argument("--mp4", action="store_true"); a.add_argument("--seed", type=int, default=7)
    x = a.parse_args()
    if x.page == "list":
        for f in json.load(open(os.path.join(ROOT, "library", "web_fx.json"), encoding="utf-8"))["fx"]: print(f"{f['name']:<12} {f['lib']:<22} {f['use']}")
    else: print(capture(x.page, json.loads(x.opts), x.w, x.h, x.fps, x.dur, not x.mp4, x.out, x.seed))
