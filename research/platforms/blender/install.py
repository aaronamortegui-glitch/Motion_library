"""Installs the Motion DNA add-on in every Blender found (3D Viewport › Sidebar (N) › Motion DNA): a small loader in
Blender's user add-ons folder that runs motion_dna_addon.py from this clone (a git pull updates it), enabled and
saved in the preferences.
Usage: python research/platforms/blender/install.py            (--uninstall removes it)
"""
import os
import pathlib
import subprocess
import sys

HERE = pathlib.Path(__file__).resolve().parent
LOADER = f'''# Motion DNA loader: the add-on lives in the Motion DNA clone ({HERE.as_posix()})
import importlib.util, sys
_spec = importlib.util.spec_from_file_location("motion_dna_addon", r"{(HERE / "motion_dna_addon.py").as_posix()}")
_mod = importlib.util.module_from_spec(_spec); sys.modules["motion_dna_addon"] = _mod; _spec.loader.exec_module(_mod)
bl_info = _mod.bl_info
def register(): _mod.register()
def unregister(): _mod.unregister()
'''


def configs():   # user config folders, one per Blender version (5.0, 4.2…)
    base = pathlib.Path.home() / "Library/Application Support/Blender" if sys.platform == "darwin" else \
        pathlib.Path(os.environ.get("APPDATA", pathlib.Path.home())) / "Blender Foundation/Blender"
    return sorted(p for p in base.glob("[0-9]*.[0-9]*") if p.is_dir()) if base.exists() else []


def blenders():
    if sys.platform == "darwin":
        return [p / "Contents/MacOS/Blender" for p in pathlib.Path("/Applications").glob("Blender*.app")]
    return list(pathlib.Path(os.environ.get("ProgramFiles", "C:/Program Files")).glob("Blender Foundation/Blender */blender.exe"))


def main():
    remove = "--uninstall" in sys.argv
    if not remove:   # Blender-safe copies of the token fonts (Inter Tight's overlaps merged)
        subprocess.run([sys.executable, str(HERE / "fix_fonts.py")])
    exes = {e.parent.name.replace("Blender ", ""): e for e in blenders()}   # "5.0" → blender.exe (Windows)
    found = configs()
    for exe in exes.values():   # a Blender never opened has no config folder yet: let it make one
        ver = exe.parent.name.replace("Blender ", "")
        if sys.platform != "darwin" and not any(c.name == ver for c in found):
            found.append(pathlib.Path(os.environ["APPDATA"]) / "Blender Foundation/Blender" / ver)
    if not found:
        print("Blender not found (open it once, then run this again)"); return 1
    for cfg in found:
        target = cfg / "scripts/addons/motion_dna.py"
        if remove:
            target.unlink(missing_ok=True); print(f"removed {target}"); continue
        target.parent.mkdir(parents=True, exist_ok=True)
        target.write_text(LOADER, encoding="utf-8")
        exe = exes.get(cfg.name) or next(iter(exes.values()), None)
        if exe:
            # the user's own preferences are loaded (never --factory-startup: saving would replace them)
            r = subprocess.run([str(exe), "-b", "--python-expr",
                                "import bpy, addon_utils; addon_utils.enable('motion_dna', default_set=True, persistent=True); bpy.ops.wm.save_userpref()"],
                               capture_output=True, text=True, timeout=180)
            ok = r.returncode == 0 and "Error" not in r.stderr
            print(("installed and enabled" if ok else "installed (enable it in Preferences › Add-ons)") + f": {target}")
        else:
            print(f"installed {target}: enable Motion DNA in Blender's Preferences › Add-ons")
    print("In Blender: 3D Viewport › press N › Motion DNA tab.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
