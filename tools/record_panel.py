"""Records the Motion DNA panel in use → docs/screens/ae-panel.gif (CONTRIBUTING §7).

Opens the panel as a floating palette (a bridge job with #targetengine keeps it alive), drives it through the
SS_PANEL hook with timed bridge jobs dropped in bridge/inbox (category, selections, controls), and captures the
palette window with a DPI-aware PrintWindow at 8 fps. Windows only, AE open with the bridge.
  python tools/record_panel.py [--seconds 13] [--keep-frames]
Edit SCRIPT below to change what the recording shows.
"""
import argparse
import ctypes
import ctypes.wintypes as W
import pathlib
import shutil
import subprocess
import tempfile
import time

ROOT = pathlib.Path(__file__).resolve().parent.parent
TITLE = "Motion DNA · recording"
# (seconds from the start of the capture, SS_PANEL call)
SCRIPT = [
    (0.5, 'SS_PANEL.tab("Moves")'),
    (1.0, 'SS_PANEL.select("motion", "Coast Rise")'),
    (3.0, 'SS_PANEL.select("motion", "Wind-up Slide")'),
    (5.0, 'SS_PANEL.select("motion", "Snap Scale")'),
    (6.5, 'SS_PANEL.controls({ease: "Coast"})'),
    (7.0, 'SS_PANEL.select("motion", "Wordmark Reveal")'),
    (9.0, 'SS_PANEL.tab("Styles")'),
    (9.5, 'SS_PANEL.select("pack", "Editorial")'),
    (11.0, 'SS_PANEL.select("pack", "Storybook")'),
    (12.5, 'SS_PANEL.controls({ease: "Preset curve"})'),
]

ctypes.windll.user32.SetProcessDPIAware()   # otherwise the capture is cropped on scaled displays (LEARNINGS)
u32, g32 = ctypes.windll.user32, ctypes.windll.gdi32


def find_window(title, timeout=30):
    found = []
    cb_t = ctypes.WINFUNCTYPE(W.BOOL, W.HWND, W.LPARAM)

    def cb(h, _):
        n = u32.GetWindowTextLengthW(h)
        if n:
            b = ctypes.create_unicode_buffer(n + 1); u32.GetWindowTextW(h, b, n + 1)
            if b.value == title and u32.IsWindowVisible(h):
                found.append(h)
        return True
    t0 = time.time()
    while time.time() - t0 < timeout:
        found.clear(); u32.EnumWindows(cb_t(cb), 0)
        if found:
            return found[0]
        time.sleep(0.5)
    raise SystemExit(f"window '{title}' not found")


def grab(hwnd, path):
    from PIL import Image
    r = W.RECT(); u32.GetWindowRect(hwnd, ctypes.byref(r))
    w, h = r.right - r.left, r.bottom - r.top
    hdc = u32.GetWindowDC(hwnd); mdc = g32.CreateCompatibleDC(hdc); bmp = g32.CreateCompatibleBitmap(hdc, w, h)
    g32.SelectObject(mdc, bmp); u32.PrintWindow(hwnd, mdc, 2)

    class BMIH(ctypes.Structure):
        _fields_ = [("biSize", W.DWORD), ("biWidth", W.LONG), ("biHeight", W.LONG), ("biPlanes", W.WORD), ("biBitCount", W.WORD),
                    ("biCompression", W.DWORD), ("biSizeImage", W.DWORD), ("biXPelsPerMeter", W.LONG), ("biYPelsPerMeter", W.LONG),
                    ("biClrUsed", W.DWORD), ("biClrImportant", W.DWORD)]
    bi = BMIH(ctypes.sizeof(BMIH), w, -h, 1, 32, 0, 0, 0, 0, 0, 0)
    buf = ctypes.create_string_buffer(w * h * 4)
    g32.GetDIBits(mdc, bmp, 0, h, buf, ctypes.byref(bi), 0)
    Image.frombuffer("RGBA", (w, h), buf, "raw", "BGRA", 0, 1).convert("RGB").save(path)
    g32.DeleteObject(bmp); g32.DeleteDC(mdc); u32.ReleaseDC(hwnd, hdc)


def main():
    ap = argparse.ArgumentParser(); ap.add_argument("--seconds", type=float, default=15); ap.add_argument("--keep-frames", action="store_true")
    a = ap.parse_args()
    job = ROOT / "tools/_job_record_panel.jsx"
    job.write_text(f"""#targetengine "ss_panel_recording"
var SS_PANEL_TITLE = "{TITLE}";
(function () {{
    $.evalFile(new File(SS_ROOT + "/tools/ss_panel.jsx"));
    return "recording";
}})();
""", encoding="utf-8")
    try:
        subprocess.Popen(["bash", "tools/bridge.sh", "tools/_job_record_panel.jsx", "60"], cwd=ROOT)
        hwnd = find_window(TITLE)
        t_found = time.time()
        while time.time() - t_found < 1.0:
            time.sleep(0.1)
        frames = pathlib.Path(tempfile.mkdtemp())
        inbox = ROOT / "bridge/inbox"
        t0, i, steps = time.time(), 0, list(SCRIPT)
        while time.time() - t0 < a.seconds:
            while steps and time.time() - t0 >= steps[0][0]:   # the bridge polls every second: steps land within ~1 s
                _, call = steps.pop(0)
                (inbox / f"{int(time.time() * 1000)}_rec_step.jsx").write_text(call + ";\n", encoding="utf-8")
            grab(hwnd, frames / f"f{i:04d}.png"); i += 1
            time.sleep(max(0, t0 + i / 8 - time.time()))
        out = ROOT / "docs/screens/ae-panel.gif"
        # the palette grows when a category has more rows (Styles): crop every frame to the first frame's size
        from PIL import Image
        W0, H0 = Image.open(frames / "f0000.png").size
        for fp in sorted(frames.glob("f*.png")):
            im = Image.open(fp)
            if im.size != (W0, H0):
                canvas = Image.new("RGB", (W0, H0), (30, 30, 30)); canvas.paste(im.crop((0, 0, min(im.width, W0), min(im.height, H0))), (0, 0)); canvas.save(fp)
        subprocess.run(["ffmpeg", "-v", "error", "-y", "-framerate", "8", "-i", str(frames / "f%04d.png"), "-vf",
                        "fps=5,scale=250:-1:flags=lanczos,split[a][b];[a]palettegen=max_colors=48:stats_mode=diff[p];[b][p]paletteuse=dither=none:diff_mode=rectangle",
                        str(out)], check=True)
        print(f"{i} frames -> {out} ({out.stat().st_size // 1024} KB)")
        if a.keep_frames:
            print("frames kept in", frames)
        else:
            shutil.rmtree(frames, ignore_errors=True)
        u32.PostMessageW(hwnd, 0x0010, 0, 0)   # WM_CLOSE the recording palette
    finally:
        job.unlink(missing_ok=True)


if __name__ == "__main__":
    main()
