"""Renders a code-rendered video template (a page using runtime/mdna.js) to video, frame by frame.

Each frame calls MDNA.frame(t) and screenshots the stage, so the result does not depend on the machine's speed:
frame N is always the same picture. Opaque scenes give an H.264 MP4; scenes with `alpha: true` give a ProRes 4444
MOV with transparency (for AE overlays and transitions). A poster PNG (middle frame) is written next to the video.

Usage: python research/video_prompts/html_to_mp4.py templates/t01_showreel.html [out.mp4] [--fps 30] [--scale 1] [--notext] [--mblur 4]
Needs: pip install playwright && python -m playwright install chromium; ffmpeg on PATH.
"""
import argparse, io, json, os, subprocess, sys, time
import numpy as np
from PIL import Image
from playwright.sync_api import sync_playwright

HERE = os.path.dirname(os.path.abspath(__file__))


def render(src, out=None, fps=None, scale=1.0, notext=False, mblur=1, shutter=0.5):
    src = os.path.abspath(src if os.path.exists(src) else os.path.join(HERE, src))
    name = os.path.splitext(os.path.basename(src))[0] + ("_plate" if notext else "")
    os.makedirs(os.path.join(HERE, "renders"), exist_ok=True)
    t_start = time.time()
    with sync_playwright() as p:
        b = p.chromium.launch(args=["--use-gl=angle", "--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--autoplay-policy=no-user-gesture-required"])
        pg = b.new_page(viewport={"width": 1920, "height": 1080}, device_scale_factor=scale)
        errors = []; pg.on("pageerror", lambda e: errors.append(str(e)))
        pg.goto("file:///" + src.replace("\\", "/") + "?render" + ("&notext" if notext else ""))
        pg.wait_for_function("window.MDNA_READY === true", timeout=30000)
        info = pg.evaluate("MDNA.info()")
        if not info: sys.exit("the page did not call MDNA.scene(...)")
        fps = fps or info["fps"]; w, h = int(info["w"] * scale), int(info["h"] * scale)
        pg.set_viewport_size({"width": info["w"], "height": info["h"]})
        alpha = bool(info.get("alpha"))
        out = out or os.path.join(HERE, "renders", name + (".mov" if alpha else ".mp4"))
        enc = (["-c:v", "prores_ks", "-profile:v", "4444", "-pix_fmt", "yuva444p10le"] if alpha
               else ["-c:v", "libx264", "-pix_fmt", "yuv420p", "-crf", "17", "-preset", "medium", "-movflags", "+faststart"])
        ff = subprocess.Popen(["ffmpeg", "-v", "error", "-y", "-f", "image2pipe", "-framerate", str(fps), "-i", "-", *enc, out], stdin=subprocess.PIPE)
        stage = pg.locator("#stage")
        n = int(round(info["duration"] * fps)); poster = None
        for i in range(n):
            if mblur <= 1:
                pg.evaluate("t => MDNA.frame(t)", i / fps)
                png = stage.screenshot(type="png", omit_background=alpha, animations="disabled")
            else:   # motion blur: average sub-frames spread over the shutter (0.5 = 180 degrees)
                acc = None
                for j in range(mblur):
                    pg.evaluate("t => MDNA.frame(t)", max(0, (i + (j / (mblur - 1) - 0.5) * shutter) / fps))
                    a = np.asarray(Image.open(io.BytesIO(stage.screenshot(type="png", omit_background=alpha, animations="disabled"))).convert("RGBA"), dtype=np.float32)
                    acc = a if acc is None else acc + a
                b_ = io.BytesIO(); Image.fromarray((acc / mblur).round().astype(np.uint8), "RGBA").save(b_, "PNG"); png = b_.getvalue()
            ff.stdin.write(png)
            if i == n // 2: poster = png
        ff.stdin.close(); ff.wait(); b.close()
    open(os.path.splitext(out)[0] + "_poster.png", "wb").write(poster)
    took = time.time() - t_start
    meta = {"template": os.path.relpath(src, HERE), "out": os.path.relpath(out, HERE), "w": w, "h": h, "fps": fps,
            "frames": n, "seconds": info["duration"], "alpha": alpha, "mblur": mblur, "render_s": round(took, 1), "page_errors": errors}
    print(json.dumps(meta))
    return meta


if __name__ == "__main__":
    a = argparse.ArgumentParser(); a.add_argument("src"); a.add_argument("out", nargs="?")
    a.add_argument("--fps", type=float); a.add_argument("--scale", type=float, default=1.0)
    a.add_argument("--mblur", type=int, default=1, help="sub-frames averaged per frame for motion blur (e.g. 4)")
    a.add_argument("--notext", action="store_true", help="hybrid templates: render the plate without text/UI (they go live in AE)")
    x = a.parse_args(); render(x.src, x.out, x.fps, x.scale, x.notext, x.mblur)
