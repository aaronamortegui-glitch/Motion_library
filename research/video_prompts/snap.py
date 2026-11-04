"""Quick check of a template: renders a few frames at given times and tiles them into one JPG, each frame at its own
aspect (16:9, 1:1, 4:5, 9:16 are never squeezed). --safe draws the reel safe area on 9:16 frames (220 px from the top,
nothing below 1500 px, 100 px from the sides; docs/LEARNINGS.md section 10). --query passes page parameters.
Usage: python research/video_prompts/snap.py templates/t06_storybook_explainer.html out.jpg 1 3.5 6 8 11 13.5 [--safe] [--query mark=github]
"""
import io, os, sys
from PIL import Image, ImageDraw
from playwright.sync_api import sync_playwright

args = sys.argv[1:]
safe = "--safe" in args; args = [a for a in args if a != "--safe"]
query = ""
if "--query" in args: i = args.index("--query"); query = "&" + args[i + 1]; del args[i:i + 2]
src, out, times = os.path.abspath(args[0]), args[1], [float(x) for x in args[2:]]
with sync_playwright() as p:
    b = p.chromium.launch(args=["--use-gl=angle", "--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--allow-file-access-from-files"])
    pg = b.new_page(viewport={"width": 1920, "height": 1080}); errs = []; pg.on("pageerror", lambda e: errs.append(str(e)))
    pg.goto("file:///" + src.replace("\\", "/") + "?render" + query); pg.wait_for_function("window.MDNA_READY === true", timeout=30000)
    pg.evaluate("document.fonts.ready.then(() => 1)")   # first frame in the real font, not the fallback
    info = pg.evaluate("MDNA.info()"); W, H = info["w"], info["h"]
    pg.set_viewport_size({"width": W, "height": H})
    shots = []
    for t in times:
        pg.evaluate("t => MDNA.frame(t)", t)
        shots.append(Image.open(io.BytesIO(pg.locator("#stage").screenshot(type="png", omit_background=True))).convert("RGB"))
    b.close()
TH = 360 if W >= H else 640                                     # tile height; the width follows the frame's own aspect
TW = round(TH * W / H)
cols = 3 if len(shots) > 4 else len(shots); rows = (len(shots) + cols - 1) // cols
sheet = Image.new("RGB", (cols * TW + (cols - 1) * 8, rows * TH + (rows - 1) * 8), (136, 136, 136))
for i, s in enumerate(shots):
    s = s.resize((TW, TH), Image.LANCZOS)
    if safe and H > W:   # the reel safe area, scaled from 1080 x 1920
        d, k = ImageDraw.Draw(s), TW / 1080
        d.rectangle([100 * k, 220 * k, TW - 100 * k, 1500 * k], outline=(255, 80, 60), width=2)
    sheet.paste(s, ((i % cols) * (TW + 8), (i // cols) * (TH + 8)))
sheet.save(out, quality=88); print(out, f"{W}x{H}", "errors:", errs)
