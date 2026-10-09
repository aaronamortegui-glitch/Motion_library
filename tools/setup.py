"""One-step install of Motion DNA on this machine (Windows or macOS): everything a designer or Claude needs.

  python tools/setup.py              # panel + library + fonts + local asset previews + checks
  python tools/setup.py --mcp-user   # also register the MCP server for Claude Code in every folder (claude mcp add -s user)

What it does:
  1. Installs the After Effects panel (Window > Motion DNA.jsx) in every AE version found. The panel reads the library
     straight from THIS clone of the repo, so the whole library comes with it and `git pull` updates it.
     Loading the panel also starts the Claude bridge.
  2. Installs the fonts in assets/fonts (OFL) for the current user.
  3. If Animation Composer asset packs are installed, indexes them and builds their previews (local only, never in git).
  4. Checks the library files (presets, tags, styles, techniques, previews) and the tools Claude uses (python, ffmpeg).
  5. Prints the two steps only the user can do in After Effects (restart; allow scripts to write files).
The MCP server (motion-dna) is registered for Claude Code in .mcp.json when Claude works inside this folder.
"""
import os
import pathlib
import shutil
import subprocess
import sys

ROOT = pathlib.Path(__file__).resolve().parent.parent
MAC = sys.platform == "darwin"
OK, WARN = "  ok   ", "  !!   "


def run(cmd, **kw):
    return subprocess.run(cmd, capture_output=True, text=True, encoding="utf-8", errors="replace", **kw)


def panel():
    print("1. After Effects panel")
    r = run(["bash", str(ROOT / "tools/install_panel.sh")]) if MAC else \
        run(["powershell", "-NoProfile", "-ExecutionPolicy", "Bypass", "-File", str(ROOT / "tools/install_panel.ps1")])
    for line in (r.stdout + r.stderr).splitlines():
        if line.strip():
            print("      " + line.strip())
    return r.returncode == 0


def fonts():
    print("2. Fonts (assets/fonts, OFL)")
    files = [f for f in (ROOT / "assets/fonts").iterdir() if f.suffix.lower() in (".ttf", ".otf")]
    if MAC:
        dst = pathlib.Path.home() / "Library/Fonts"
        dst.mkdir(parents=True, exist_ok=True)
        for f in files:
            shutil.copy2(f, dst / f.name)
        print(OK + f"{len(files)} fonts in {dst}")
        return True
    import winreg   # per-user install: no admin needed
    dst = pathlib.Path(os.environ["LOCALAPPDATA"]) / "Microsoft/Windows/Fonts"
    dst.mkdir(parents=True, exist_ok=True)
    key = winreg.CreateKey(winreg.HKEY_CURRENT_USER, r"Software\Microsoft\Windows NT\CurrentVersion\Fonts")
    for f in files:
        target = dst / f.name
        if not target.exists():
            shutil.copy2(f, target)
        winreg.SetValueEx(key, f.stem.replace("[wght]", "") + " (TrueType)", 0, winreg.REG_SZ, str(target))
    winreg.CloseKey(key)
    print(OK + f"{len(files)} fonts for this user (restart After Effects to see them)")
    return True


def assets():
    print("3. Local asset packs (Animation Composer, licensed: indexed on this machine only)")
    packs = pathlib.Path.home() / "Library/Application Support/MisterHorse/ProductManager/AssetPacks" if MAC else \
        pathlib.Path(os.environ.get("LOCALAPPDATA", "")) / "MisterHorse/ProductManager/AssetPacks"
    packs = pathlib.Path(os.environ.get("SS_ASSET_PACKS", packs))
    if not packs.exists():
        print("      none found (optional: the Assets tab stays empty)")
        return True
    r1 = run([sys.executable, str(ROOT / "tools/index_assets.py")])
    r2 = run([sys.executable, str(ROOT / "tools/asset_previews.py")])
    print(OK + (r1.stdout.strip().splitlines() or ["indexed"])[-1])
    print(OK + (r2.stdout.strip().splitlines() or ["previews"])[-1])
    return r1.returncode == 0


def checks():
    print("4. Library and tools")
    good = True
    for rel, what in [("library/library.json", "presets"), ("library/tags.json", "tags"), ("library/packs.json", "styles"),
                      ("library/techniques.json", "techniques"), ("library/preview_curves.json", "panel previews"),
                      ("library/thumbs_sm", "panel thumbnails"), ("library/INDEX.txt", "LLM index"), (".mcp.json", "MCP server for Claude Code")]:
        ok = (ROOT / rel).exists()
        good &= ok
        print((OK if ok else WARN) + f"{what}: {rel}")
    for tool, why in [("ffmpeg", "previews, GIFs, renders"), ("git", "updates (git pull)")]:
        ok = shutil.which(tool) is not None
        print((OK if ok else WARN) + f"{tool} ({why})" + ("" if ok else " not found: install it for the full pipeline"))
    return good


def mcp_user():
    print("5. MCP server for Claude Code in every folder")
    if not shutil.which("claude"):
        print(WARN + "Claude Code CLI not found; inside this repo .mcp.json already registers motion-dna")
        return False
    r = run(["claude", "mcp", "add", "-s", "user", "motion-dna", "--", sys.executable, str(ROOT / "tools/mcp/ss_motion_mcp.py")])
    print((OK if r.returncode == 0 else WARN) + (r.stdout.strip() or r.stderr.strip() or "registered"))
    return r.returncode == 0


def main():
    print(f"Motion DNA setup · repo {ROOT} · {'macOS' if MAC else 'Windows'}\n")
    results = [panel(), fonts(), assets(), checks()]
    if "--mcp-user" in sys.argv:
        results.append(mcp_user())
    print("\nLast steps in After Effects (only you can do these):")
    print("  - Restart After Effects, then open Window > Motion DNA.jsx and dock it.")
    pref = "Settings" if MAC else "Edit > Preferences"
    print(f"  - {pref} > Scripting & Expressions > tick 'Allow Scripts to Write Files and Access Network'.")
    print("  - Claude: open this folder in Claude Code; the panel header shows 'Claude connected' once the bridge runs.")
    print("\nDone." if all(results) else "\nDone, with warnings above.")


if __name__ == "__main__":
    main()
