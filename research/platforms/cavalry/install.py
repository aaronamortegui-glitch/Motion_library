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
    print(f"installed {target}\nIn Cavalry: Window › Scripts › Motion DNA (no restart needed).")
