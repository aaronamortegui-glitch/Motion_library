"""Installs the Motion DNA window in Cavalry (Window › Scripts › Motion DNA): copies `Motion DNA.js` into Cavalry's
Scripts folder with this clone's path written in, so the presets and curves are read from the clone.
Usage: python research/platforms/cavalry/install.py            (--uninstall removes it)
"""
import pathlib
import sys

HERE = pathlib.Path(__file__).resolve().parent
ROOT = HERE.parents[2]
if sys.platform == "darwin":
    SCRIPTS = pathlib.Path.home() / "Library/Application Support/Cavalry/Scripts"
else:
    import os
    SCRIPTS = pathlib.Path(os.environ.get("APPDATA", pathlib.Path.home() / "AppData/Roaming")) / "Cavalry/Scripts"
target = SCRIPTS / "Motion DNA.js"

if "--uninstall" in sys.argv:
    target.unlink(missing_ok=True)
    print(f"removed {target}")
else:
    SCRIPTS.mkdir(parents=True, exist_ok=True)
    src = (HERE / "Motion DNA.js").read_text(encoding="utf-8")
    target.write_text(src.replace("__MDNA_ROOT__", ROOT.as_posix()), encoding="utf-8")
    # hover previews: Cavalry's UI shows PNGs, not GIFs, so the library's preview GIFs become frame sequences
    import json
    try:
        from PIL import Image
        anim, index = HERE / "thumbs_anim", {}
        for d in ("motion", "fx", "text"):
            for gif in sorted((ROOT / "library/gifs" / d).glob("*.gif")):
                out = anim / d / gif.stem
                im = Image.open(gif); n = getattr(im, "n_frames", 1); step = max(1, n // 24)
                if not (out / "f_00.png").exists() or (out / "f_00.png").stat().st_mtime < gif.stat().st_mtime:
                    out.mkdir(parents=True, exist_ok=True)
                    for k, i in enumerate(range(0, n, step)):
                        im.seek(i); im.convert("RGB").resize((224, 126)).save(out / f"f_{k:02d}.png")
                index[f"{d}/{gif.stem}"] = len(range(0, n, step))
        (anim / "index.json").write_text(json.dumps(index), encoding="utf-8")
        print(f"hover previews: {len(index)} animated thumbnails")
    except ImportError:
        print("hover previews skipped (pip install pillow)")
    print(f"installed {target}\nIn Cavalry: Window › Scripts › Motion DNA (no restart needed).")
