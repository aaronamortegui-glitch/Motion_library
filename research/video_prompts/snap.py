"""Quick check of a template: renders a few frames at given times and tiles them into one JPG.
Usage: python research/video_prompts/snap.py templates/t06_storybook_explainer.html out.jpg 1 3.5 6 8 11 13.5
"""
import io, os, sys
from PIL import Image
from playwright.sync_api import sync_playwright

src, out, times = os.path.abspath(sys.argv[1]), sys.argv[2], [float(x) for x in sys.argv[3:]]
with sync_playwright() as p:
    b = p.chromium.launch(args=["--use-gl=angle", "--use-angle=swiftshader", "--enable-unsafe-swiftshader"])
    pg = b.new_page(viewport={"width": 1920, "height": 1080}); errs = []; pg.on("pageerror", lambda e: errs.append(str(e)))
    pg.goto("file:///" + src.replace("\\", "/") + "?render"); pg.wait_for_function("window.MDNA_READY === true", timeout=30000)
    shots = []
    for t in times:
        pg.evaluate("t => MDNA.frame(t)", t)
        shots.append(Image.open(io.BytesIO(pg.locator("#stage").screenshot(type="png", omit_background=True))).convert("RGBA"))
    b.close()
cols = 3 if len(shots) > 4 else len(shots); rows = (len(shots) + cols - 1) // cols
sheet = Image.new("RGB", (cols * 640, rows * 360), (136, 136, 136))
for i, s in enumerate(shots): sheet.paste(s.resize((640, 360)), ((i % cols) * 640, (i // cols) * 360), s.resize((640, 360)))
sheet.save(out, quality=88); print(out, "errors:", errs)
