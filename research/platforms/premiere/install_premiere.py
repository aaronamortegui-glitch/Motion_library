#!/usr/bin/env python3
"""Install, update or remove Motion DNA for Premiere (beta) on this machine (Windows or macOS).

  python research/platforms/premiere/install_premiere.py               # install / update
  python research/platforms/premiere/install_premiere.py --mcp-user    # also register the MCP for every folder
  python research/platforms/premiere/install_premiere.py --uninstall   # remove the plugin and the MCP registration
  python research/platforms/premiere/install_premiere.py --check       # only report what is installed

tools/setup.py calls this by itself when Premiere 2026 or newer is installed, so people never need to know it exists.

What it does:
  1. Finds Premiere (26.0 or newer: the UXP API it needs is documented from 26.2, keyframes from 25.6).
  2. Packs plugin/ into dist/motion-dna-premiere.ccx (a zip with manifest.json at its root).
  3. Starts the Creative Cloud app if it is not running: Adobe's installer (UPIA) fails with status -642 without it.
  4. Installs the .ccx with UPIA, removes the spike build (com.motiondna.premiere.spike) and checks the result in
     UXP's plugin list.
  5. Registers the MCP server motion-dna-premiere for Claude Code in this folder (and every folder with --mcp-user).
     The MCP starts the local helper itself; nothing else runs in the background.
The only steps left to the person: accept Adobe's install prompt if one appears, restart Premiere if it was open,
and open Window > UXP Plugins > Motion DNA once (dock it: Premiere brings it back).
"""
import json
import os
import pathlib
import re
import shutil
import subprocess
import sys
import time
import zipfile

HERE = pathlib.Path(__file__).resolve().parent
ROOT = HERE.parents[2]
MAC = sys.platform == "darwin"
OK, WARN = "  ok   ", "  !!   "
PLUGIN_ID = "com.motiondna.premiere"
OLD_IDS = {"com.motiondna.premiere.spike": "Motion DNA (spike)"}
MCP_NAME = "motion-dna-premiere"
UPIA = (pathlib.Path("/Library/Application Support/Adobe/Adobe Desktop Common/RemoteComponents/UPI/UnifiedPluginInstallerAgent/"
                     "UnifiedPluginInstallerAgent.app/Contents/MacOS/UnifiedPluginInstallerAgent") if MAC else
        pathlib.Path(r"C:\Program Files\Common Files\Adobe\Adobe Desktop Common\RemoteComponents\UPI\UnifiedPluginInstallerAgent"
                     r"\UnifiedPluginInstallerAgent.exe"))
UXP_INFO = ((pathlib.Path.home() / "Library/Application Support/Adobe/UXP/PluginsInfo/v1/premierepro.json") if MAC else
            pathlib.Path(os.environ.get("APPDATA", "")) / "Adobe/UXP/PluginsInfo/v1/premierepro.json")


def run(cmd, timeout=600, **kw):
    try:
        return subprocess.run(cmd, capture_output=True, text=True, encoding="utf-8", errors="replace", timeout=timeout, **kw)
    except subprocess.TimeoutExpired:
        return subprocess.CompletedProcess(cmd, 1, "", "timed out")


def flag(name):
    """UPIA takes /install on Windows and --install on macOS."""
    return ("--" if MAC else "/") + name


# ---------------------------------------------------------------- Premiere
def premieres():
    """[(version tuple, label, path)] of installed Premiere apps, newest first."""
    out = []
    if MAC:
        for app in pathlib.Path("/Applications").glob("Adobe Premiere*"):
            plist = app / "Contents/Info.plist" if app.suffix == ".app" else next(app.glob("*.app/Contents/Info.plist"), None)
            if not plist or not plist.exists():
                continue
            m = re.search(r"<key>CFBundleShortVersionString</key>\s*<string>([\d.]+)", plist.read_text(errors="replace"))
            if m:
                out.append((tuple(int(x) for x in m.group(1).split(".")[:3]), app.name, str(app)))
    else:
        base = pathlib.Path(os.environ.get("ProgramFiles", r"C:\Program Files")) / "Adobe"
        for d in base.glob("Adobe Premiere*"):
            exe = next(iter(sorted(d.glob("Adobe Premiere*.exe"))), None)
            if not exe:
                continue
            r = run(["powershell", "-NoProfile", "-Command", f"(Get-Item '{exe}').VersionInfo.ProductVersion"], timeout=30)
            v = re.match(r"([\d.]+)", r.stdout.strip() or "0")
            out.append((tuple(int(x) for x in v.group(1).split(".")[:3]), d.name, str(exe)))
    return sorted(out, reverse=True)


def premiere_running():
    if MAC:
        return run(["pgrep", "-f", "Adobe Premiere"], timeout=10).returncode == 0
    return "premiere" in run(["tasklist"], timeout=20).stdout.lower()


# ---------------------------------------------------------------- Creative Cloud + UPIA
def cc_running():
    if MAC:
        return run(["pgrep", "-f", "Creative Cloud"], timeout=10).returncode == 0
    t = run(["tasklist"], timeout=20).stdout
    return "Creative Cloud.exe" in t or "Adobe Desktop Service.exe" in t


def start_cc():
    if cc_running():
        return True
    print("  ..   starting the Creative Cloud app (Adobe's plugin installer needs it)")
    if MAC:
        run(["open", "-a", "Creative Cloud"], timeout=30)
    else:
        for p in [pathlib.Path(os.environ.get("ProgramFiles", r"C:\Program Files")) / "Adobe/Adobe Creative Cloud/ACC/Creative Cloud.exe",
                  pathlib.Path(os.environ.get("ProgramFiles(x86)", r"C:\Program Files (x86)")) / "Adobe/Adobe Creative Cloud/ACC/Creative Cloud.exe"]:
            if p.exists():
                subprocess.Popen([str(p)], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
                break
    for _ in range(40):
        time.sleep(3)
        if cc_running():
            time.sleep(15)   # its services come up a little after the window
            return True
    return False


def installed():
    """{plugin id: (name, version)} for Premiere, from UXP's own plugin list."""
    try:
        data = json.loads(UXP_INFO.read_text(encoding="utf-8"))
    except (OSError, ValueError):
        return {}
    return {p.get("pluginId"): (p.get("name"), p.get("versionString")) for p in data.get("plugins", [])}


def pack():
    man = json.loads((HERE / "plugin/manifest.json").read_text(encoding="utf-8"))
    out = HERE / "dist" / "motion-dna-premiere.ccx"
    out.parent.mkdir(exist_ok=True)
    with zipfile.ZipFile(out, "w", zipfile.ZIP_DEFLATED) as z:
        for p in sorted((HERE / "plugin").rglob("*")):
            if p.is_file():
                z.write(p, p.relative_to(HERE / "plugin").as_posix())
    return out, man


def upia(*args):
    if not UPIA.exists():
        return subprocess.CompletedProcess(args, 1, "", f"Adobe's plugin installer is missing ({UPIA}): install the Creative Cloud app")
    return run([str(UPIA), *args], timeout=600)


def install_plugin():
    ccx, man = pack()
    print(OK + f"packed {ccx.name} ({man['name']} {man['version']})")
    for old_id, old_name in OLD_IDS.items():   # the spike build
        if old_id in installed():
            upia(flag("remove"), old_name)
            print(OK + f"removed the old {old_name}")
    have = installed().get(man["id"])
    if have and have[1] == man["version"]:
        print(OK + f"plugin {have[0]} {have[1]} already installed")
        return True, False
    if not start_cc():
        print(WARN + "the Creative Cloud app did not start: open it, sign in, and run this again")
        return False, False
    r = upia(flag("install"), str(ccx))
    text = (r.stdout + r.stderr).strip()
    got = installed().get(man["id"])
    if got and got[1] == man["version"]:
        print(OK + f"plugin installed: {got[0]} {got[1]}")
        return True, True
    print(WARN + "plugin not installed: " + (text.splitlines()[-1] if text else "no answer from Adobe's installer"))
    if "-642" in text or "-641" in text:
        print("        Adobe's code for 'could not install': open the Creative Cloud app, sign in, and run this again.")
    return False, False


def remove_plugin():
    for pid, (name, _) in installed().items():
        if pid == PLUGIN_ID or pid in OLD_IDS:
            upia(flag("remove"), name)
            print(OK + f"removed {name}" if pid not in installed() else WARN + f"could not remove {name}: remove it in the Creative Cloud app > Plugins")


# ---------------------------------------------------------------- Claude
def claude_cli():
    sys.path.insert(0, str(ROOT / "tools"))
    try:
        import setup   # the same lookup the AE installer uses (PATH, ~/.local/bin, the desktop app's copy)
        return setup.claude_cli()
    except Exception:
        return shutil.which("claude")


def register_mcp(scope="local", remove=False):
    cli = claude_cli()
    server = str(HERE / "mcp_premiere.py")
    if not cli:
        print(WARN + f"Claude Code CLI not found. In Claude Code run: claude mcp add -s {scope} {MCP_NAME} -- {sys.executable} \"{server}\"")
        return remove
    run([cli, "mcp", "remove", MCP_NAME, "-s", scope], cwd=ROOT, timeout=60)
    if remove:
        print(OK + f"removed MCP {MCP_NAME} ({scope})")
        return True
    r = run([cli, "mcp", "add", "-s", scope, MCP_NAME, "--", sys.executable, server], cwd=ROOT, timeout=60)
    print((OK if r.returncode == 0 else WARN) + f"MCP {MCP_NAME} for Claude Code ({'every folder' if scope == 'user' else 'this folder'})")
    return r.returncode == 0


# ---------------------------------------------------------------- main
def report():
    ps = premieres()
    print("Premiere: " + (", ".join(f"{label} ({'.'.join(map(str, v))})" for v, label, _ in ps) or "not installed"))
    have = installed()
    print("Plugin:   " + (" / ".join(f"{n} {v}" for pid, (n, v) in have.items() if pid == PLUGIN_ID or pid in OLD_IDS) or "not installed"))
    print("Creative Cloud app running: " + ("yes" if cc_running() else "no"))
    return ps


def main(argv=None):
    argv = sys.argv[1:] if argv is None else argv
    for s in (sys.stdout, sys.stderr):
        try:
            s.reconfigure(encoding="utf-8", errors="replace")
        except Exception:
            pass
    print("Motion DNA for Premiere (beta)")
    if "--check" in argv:
        report()
        return 0
    if "--uninstall" in argv:
        remove_plugin()
        register_mcp("local", remove=True)
        register_mcp("user", remove=True)
        print("Removed. Restart Premiere.")
        return 0
    ps = premieres()
    usable = [p for p in ps if p[0] >= (26, 0, 0)]
    if not usable:
        found = ", ".join(f"{label} {'.'.join(map(str, v))}" for v, label, _ in ps) or "none"
        print(WARN + f"needs Premiere 2026 (26.0) or newer; found: {found}. Nothing installed.")
        return 1
    print(OK + "Premiere " + ", ".join(f"{label} ({'.'.join(map(str, v))})" for v, label, _ in usable))
    ok, fresh = install_plugin()
    ok = register_mcp("local") and ok
    if "--mcp-user" in argv:
        ok = register_mcp("user") and ok
    print("\nLast steps in Premiere (only you can do these):")
    if fresh and premiere_running():
        print("  - Restart Premiere: a plugin installed while it is open loads after a restart.")
    print("  - Open Window > UXP Plugins > Motion DNA and dock it (Premiere brings it back every time).")
    print("  - Then ask Claude in your own words, e.g. \"make a 9:16 version of my sequence that follows the person\".")
    print("\nDone." if ok else "\nDone, with warnings above.")
    return 0 if ok else 1


if __name__ == "__main__":
    sys.exit(main())
