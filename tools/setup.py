"""Install, update or uninstall Motion DNA on this machine (Windows or macOS): everything a designer or Claude needs.

  python tools/setup.py               # install: panel + library + fonts + local asset previews + checks
  python tools/setup.py --update      # update: git pull (never over local changes), clean what is old, install the new
  python tools/setup.py --uninstall   # remove the panel loaders, the MCP registration and the fonts it installed
  add --mcp-user to register the MCP server for Claude Code in every folder (claude mcp add -s user motion-dna)

Install / update:
  1. Cleans what an older version left: the pre-rename panel loader ("SS Motion.jsx"), loaders of other clones or old
     paths, loose copies of the panel script, the old MCP name (ss-motion), stale bridge jobs, previews of assets that
     no longer exist.
  2. Installs File > Scripts > Motion DNA (opens the panel) and a Startup script (starts the Claude bridge when AE
     opens) in every AE version found, and removes the old Window > Motion DNA.jsx entry. The panel reads the library
     straight from THIS clone, so the whole library comes with it. Loading the panel also starts the Claude bridge.
  3. Installs the fonts in assets/fonts (OFL) for the current user, and links the CEP panel (panel/, Window >
     Extensions > Motion DNA) into the user's CEP extensions folder so it also runs from this clone.
  4. If Animation Composer asset packs are installed, indexes them and builds their previews (local only, never in git).
  5. Checks the library files and the tools Claude uses, and prints the steps only the user can do in After Effects.
"""
import os
import pathlib
import re
import shutil
import subprocess
import sys

ROOT = pathlib.Path(__file__).resolve().parent.parent
MAC = sys.platform == "darwin"
OK, WARN = "  ok   ", "  !!   "
OLD_LOADERS = ["SS Motion.jsx", "ss_panel.jsx", "SS_Motion.jsx"]   # names older versions or manual copies used
LOADER = "Motion DNA.jsx"


def run(cmd, **kw):
    return subprocess.run(cmd, capture_output=True, text=True, encoding="utf-8", errors="replace", **kw)


def git(*a):
    return run(["git", "-C", str(ROOT), *a])


def head():
    r = git("rev-parse", "--short", "HEAD")
    return r.stdout.strip() if r.returncode == 0 else "?"


def scripts_dirs():
    """The per-user Scripts folder of every After Effects version on this machine: File > Scripts > Motion DNA.jsx (opens
    the panel) and Startup/Motion DNA.jsx (starts the Claude bridge when AE opens) live there."""
    if MAC:
        base = pathlib.Path.home() / "Library/Preferences/Adobe/After Effects"
        return [d / "Scripts" for d in base.glob("*") if d.is_dir() and d.name[:1].isdigit()]
    base = pathlib.Path(os.environ.get("APPDATA", "")) / "Adobe/After Effects"
    return [d / "Scripts" for d in base.glob("*") if d.is_dir() and re.match(r"^\d+(\.\d+)?$", d.name)]


def panel_dirs():
    """(folder, needs admin) for every 'ScriptUI Panels' folder: where older versions put Window > Motion DNA.jsx, a
    dockable entry that opened a second, empty window. Only cleaned now, never installed into."""
    out = [(d / "ScriptUI Panels", False) for d in scripts_dirs()]
    if MAC:
        out += [(d / "Scripts/ScriptUI Panels", True) for d in pathlib.Path("/Applications").glob("Adobe After Effects 20*")]
    else:
        out += [(d / "Support Files/Scripts/ScriptUI Panels", True) for d in pathlib.Path("C:/Program Files/Adobe").glob("Adobe After Effects*")]
    return out


def loader_root(f):
    try:
        m = re.search(r'var SS_ROOT = "([^"]+)"', f.read_text(encoding="utf-8", errors="replace"))
        return m.group(1) if m else None
    except OSError:
        return None


def ae_running():
    try:
        if MAC:
            return run(["pgrep", "-f", "Adobe After Effects"]).returncode == 0
        return "afterfx" in run(["tasklist", "/FI", "IMAGENAME eq AfterFX.exe"]).stdout.lower()
    except OSError:
        return False


def clean_old():
    print("1. Clean what an older version left")
    sys.path.insert(0, str(ROOT / "tools"))
    from check_previews import missing
    miss = missing()
    print((OK if not miss else WARN) + ("every preset, style and technique has its preview" if not miss else
          f"{len(miss)} previews missing (the panel shows a placeholder): python tools/check_previews.py"))
    here = str(ROOT).replace("\\", "/").lower()
    found = 0
    for d, admin in panel_dirs():
        if not d.exists():
            continue
        for name in OLD_LOADERS + [LOADER]:
            f = d / name
            if not f.exists():
                continue
            txt = f.read_text(encoding="utf-8", errors="replace")
            ours = name == LOADER or "SS_ROOT" in txt or "SS Motion" in txt or "Motion DNA" in txt
            if not ours:
                continue
            root = (loader_root(f) or "").replace("\\", "/").lower()
            found += 1   # the Window-menu entry is gone for good: it opened a second window next to the panel
            try:
                f.unlink()
                print(OK + f"removed {f}" + (f" (pointed to {root})" if root and root != here else ""))
            except OSError:
                print(WARN + f"cannot remove {f} (needs admin). Delete it by hand, or AE may load an old panel.")
    for d in scripts_dirs():   # File > Scripts and Startup loaders of another clone or path
        for f in (d / LOADER, d / "Startup" / LOADER):
            root = (loader_root(f) or "").replace("\\", "/").lower() if f.exists() else ""
            if f.exists() and root and root != here:
                f.unlink(); found += 1; print(OK + f"removed {f} (pointed to {root})")
    if not found:
        print("      no old panel loaders")
    # the MCP server's old name
    if shutil.which("claude"):
        lst = run(["claude", "mcp", "list"]).stdout
        if re.search(r"^ss-motion\b", lst, re.M):
            for scope in ("user", "local", "project"):
                run(["claude", "mcp", "remove", "ss-motion", "-s", scope])
            print(OK + "removed the old MCP registration 'ss-motion' (now 'motion-dna')")
    # stale bridge jobs (a job left in the inbox would run when AE starts). Only with AE closed: while AE runs the marker
    # means "bridge active", and deleting it makes the next MCP call start the bridge again, which toggles it off.
    if ae_running():
        print("      After Effects is open: bridge files left as they are")
    else:
        n = 0
        for f in list((ROOT / "bridge/inbox").glob("*.jsx")) + [ROOT / "bridge/outbox/_bridge_started.txt"]:
            if f.exists():
                f.unlink(); n += 1
        if n:
            print(OK + f"cleared {n} stale bridge file(s)")
    # previews of assets no longer in the local index
    cache, idx = ROOT / "library/assets_cache", ROOT / "library/assets.local.json"
    if cache.exists() and idx.exists():
        import json
        keep = {re.sub(r"[^a-z0-9]+", "-", a["name"].lower()).strip("-") for a in json.load(open(idx, encoding="utf-8"))["assets"]}
        gone = [p for p in cache.glob("*/*.png") if p.stem not in keep]
        for p in gone:
            p.unlink()
        if gone:
            print(OK + f"removed {len(gone)} previews of assets that are gone")
    return True


def update():
    print("0. Update the repo")
    if not (ROOT / ".git").exists():
        print(WARN + "not a git clone: download the new version and run this again"); return False
    dirty = [l for l in git("status", "--porcelain", "--untracked-files=no").stdout.splitlines() if l.strip()]
    if dirty:
        print(WARN + f"{len(dirty)} local change(s) to tracked files; not pulling over them. Commit or stash them, then run --update again:")
        for l in dirty[:8]:
            print("        " + l)
        return False
    before = head()
    r = git("pull", "--ff-only")
    if r.returncode != 0:
        print(WARN + "git pull failed: " + (r.stderr.strip() or r.stdout.strip())[:300]); return False
    after = head()
    print(OK + (f"updated {before} → {after}" if before != after else f"already up to date ({after})"))
    if before != after:
        log = git("log", "--oneline", f"{before}..{after}").stdout.strip().splitlines()
        for l in log[:10]:
            print("        " + l)
    return True


def panel():
    print("2. After Effects entry points (File > Scripts > Motion DNA, Startup bridge)")
    r = run(["bash", str(ROOT / "tools/install_panel.sh")]) if MAC else \
        run(["powershell", "-NoProfile", "-ExecutionPolicy", "Bypass", "-File", str(ROOT / "tools/install_panel.ps1")])
    for line in (r.stdout + r.stderr).splitlines():
        if line.strip():
            print("      " + line.strip())
    return r.returncode == 0


CEP_ID = "com.motiondna.panel"


def cep_dir():
    if MAC:
        return pathlib.Path.home() / "Library/Application Support/Adobe/CEP/extensions"
    return pathlib.Path(os.environ.get("APPDATA", "")) / "Adobe/CEP/extensions"


def cep_debug_versions():
    """CSXS versions with PlayerDebugMode=1 (unsigned extensions only load with it)."""
    on = []
    for v in range(9, 14):
        if MAC:
            r = run(["defaults", "read", f"com.adobe.CSXS.{v}", "PlayerDebugMode"])
            if r.stdout.strip() == "1":
                on.append(v)
        else:
            r = run(["reg", "query", rf"HKCU\Software\Adobe\CSXS.{v}", "/v", "PlayerDebugMode"])
            if r.returncode == 0 and re.search(r"PlayerDebugMode\s+REG_SZ\s+1", r.stdout):
                on.append(v)
    return on


SIGNER_URL = "https://raw.githubusercontent.com/Adobe-CEP/CEP-Resources/master/ZXPSignCMD/4.1.3/" + \
    ("macOS/ZXPSignCmd" if MAC else "x64/ZXPSignCmd.exe")   # Adobe's official signing tool (CEP-Resources)
CACHE = ROOT / "tools/.cache"   # git-ignored: the signer, this machine's self-signed certificate, the built .zxp


def remove_ext(path):
    """Removes the installed panel: a link (junction / symlink) only loses the link, never the files it points to."""
    if not (path.exists() or path.is_symlink()):
        return
    if path.is_symlink():
        os.unlink(path)
    elif os.path.isjunction(path):
        os.rmdir(path)
    else:
        shutil.rmtree(path)


def signer():
    exe = CACHE / ("ZXPSignCmd" if MAC else "ZXPSignCmd.exe")
    if not exe.exists():
        import urllib.request
        CACHE.mkdir(parents=True, exist_ok=True)
        print(f"      downloading Adobe's ZXPSignCmd (once) from {SIGNER_URL}")
        urllib.request.urlretrieve(SIGNER_URL, exe)
        if MAC:
            exe.chmod(0o755)
    return exe


def sign_panel():
    """Builds a signed .zxp of panel/ with a self-signed certificate made on this machine. Returns the .zxp path."""
    import secrets
    exe = signer()
    cert, pw_file = CACHE / "motiondna_selfsigned.p12", CACHE / "motiondna_selfsigned.txt"
    if not cert.exists():
        pw_file.write_text(secrets.token_urlsafe(18), encoding="utf-8")
        r = run([str(exe), "-selfSignedCert", "US", "NA", "Motion DNA", "Motion DNA panel",
                 pw_file.read_text(encoding="utf-8").strip(), str(cert), "-validityDays", "3650"])
        if not cert.exists():
            raise RuntimeError("could not create the certificate: " + (r.stdout + r.stderr).strip())
    stage = CACHE / "zxp" / CEP_ID
    if stage.exists():
        shutil.rmtree(stage)
    shutil.copytree(ROOT / "panel", stage, ignore=shutil.ignore_patterns(".debug", ".DS_Store", "__MACOSX"))
    (stage / ".root").write_text(str(ROOT).replace("\\", "/"), encoding="utf-8")   # the panel reads the library from this clone
    zxp = CACHE / "MotionDNA.zxp"
    zxp.unlink(missing_ok=True)
    r = run([str(exe), "-sign", str(stage), str(zxp), str(cert), pw_file.read_text(encoding="utf-8").strip()])
    v = run([str(exe), "-verify", str(zxp)])
    if not zxp.exists() or v.returncode != 0:
        raise RuntimeError("signing failed: " + (r.stdout + r.stderr + v.stdout + v.stderr).strip())
    return zxp


def cep(remove=False, dev=False):
    """Installs the CEP panel (Window > Extensions > Motion DNA) in the user's CEP extensions folder.
    Default: a signed copy (self-signed .zxp made on this machine, unpacked there), which After Effects loads without
    developer mode; --update signs it again. --dev: a link to panel/ instead (edits show with F5), which needs Adobe's
    developer mode: setup asks, and only the person at the terminal can say yes (never Claude or a script)."""
    target = cep_dir() / CEP_ID
    if remove:
        try:
            remove_ext(target); print(OK + f"removed {target}")
        except OSError as e:
            print(WARN + f"cannot remove {target}: {e}")
        return True
    print("3b. CEP panel (Window > Extensions > Motion DNA)" + (" · developer link" if dev else " · signed"))
    (ROOT / "panel/.root").write_text(str(ROOT).replace("\\", "/"), encoding="utf-8")
    target.parent.mkdir(parents=True, exist_ok=True)
    if not dev:
        try:
            zxp = sign_panel()
        except Exception as e:   # no network, blocked download...: fall back to the developer link
            print(WARN + f"could not sign the panel ({e}); installing the developer link instead")
            return cep(dev=True)
        import zipfile
        remove_ext(target)
        with zipfile.ZipFile(zxp) as z:
            z.extractall(target)
        print(OK + f"signed panel installed in {target} (no developer mode needed; restart After Effects)")
        return True
    linked = False
    if target.exists() or target.is_symlink():
        try:
            linked = (target.is_symlink() or os.path.isjunction(target)) and target.resolve() == (ROOT / "panel").resolve()
        except OSError:
            linked = False
        if not linked:
            remove_ext(target)
    if not linked:
        r = run(["ln", "-s", str(ROOT / "panel"), str(target)]) if MAC else run(["cmd", "/c", "mklink", "/J", str(target), str(ROOT / "panel")])
        if r.returncode != 0:
            print(WARN + f"could not link {target}: {(r.stdout + r.stderr).strip()}"); return False
    print(OK + f"linked {target} -> {ROOT / 'panel'}")
    if not cep_debug_versions():
        cmd = ["defaults", "write", "com.adobe.CSXS.12", "PlayerDebugMode", "1"] if MAC else \
              ["reg", "add", r"HKCU\Software\Adobe\CSXS.12", "/v", "PlayerDebugMode", "/t", "REG_SZ", "/d", "1", "/f"]
        print(WARN + "the developer link needs Adobe's developer mode (it lets After Effects load unsigned panels).")
        ans = ""
        if sys.stdin.isatty():   # only a person at the terminal can say yes; Claude and scripts never set it
            ans = input("        Turn it on now for this user? [y/N] ").strip().lower()
        if ans in ("y", "yes", "s", "si", "sí"):
            r = run(cmd)
            print((OK + "developer mode on (restart After Effects)") if r.returncode == 0 else (WARN + (r.stdout + r.stderr).strip()))
        else:
            print("        Left off. To turn it on yourself: " + " ".join(f'"{c}"' if " " in c else c for c in cmd))
    return True


def font_files():
    return [f for f in (ROOT / "assets/fonts").iterdir() if f.suffix.lower() in (".ttf", ".otf")]


def fonts(remove=False):
    print(("Remove fonts" if remove else "3. Fonts (assets/fonts, OFL)"))
    files = font_files()
    if MAC:
        dst = pathlib.Path.home() / "Library/Fonts"
        dst.mkdir(parents=True, exist_ok=True)
        for f in files:
            if remove:
                (dst / f.name).unlink(missing_ok=True)
            else:
                shutil.copy2(f, dst / f.name)   # overwrite: an update brings the new font files
        print(OK + f"{len(files)} fonts {'removed from' if remove else 'in'} {dst}")
        return True
    import ctypes
    import winreg   # per-user install: no admin needed
    dst = pathlib.Path(os.environ["LOCALAPPDATA"]) / "Microsoft/Windows/Fonts"
    dst.mkdir(parents=True, exist_ok=True)
    key = winreg.CreateKey(winreg.HKEY_CURRENT_USER, r"Software\Microsoft\Windows NT\CurrentVersion\Fonts")
    existing = {}   # registry value name -> file, so one font file is never registered twice under two names
    i = 0
    while True:
        try:
            n, v, _ = winreg.EnumValue(key, i); existing[n] = str(v); i += 1
        except OSError:
            break
    gdi = ctypes.windll.gdi32
    loaded = 0
    for f in files:
        target = dst / f.name
        ours = f.stem.replace("[wght]", "") + " (TrueType)"
        names = [n for n, v in existing.items() if pathlib.Path(v).name.lower() == f.name.lower()]
        if remove:
            for n in names or [ours]:
                try:
                    winreg.DeleteValue(key, n)
                except OSError:
                    pass
            gdi.RemoveFontResourceW(str(target))
            try:
                target.unlink(missing_ok=True)
            except OSError:
                pass   # in use: Windows removes it after a restart
            continue
        try:
            shutil.copy2(f, target)
        except OSError:
            pass   # the font is in use (AE open): the registered copy stays until AE closes
        # Duplicate registrations of the same file (e.g. "Inter Tight" by hand + "InterTight" by an older setup.py) made
        # Windows skip the font at the next logon, and After Effects fell back to Times. Keep exactly one value per file.
        keep = names[0] if names else ours
        for n in names[1:]:
            try:
                winreg.DeleteValue(key, n)
            except OSError:
                pass
        winreg.SetValueEx(key, keep, 0, winreg.REG_SZ, str(target))
        loaded += 1 if gdi.AddFontResourceW(str(target)) > 0 else 0   # usable now, without logging off
    winreg.CloseKey(key)
    if not remove:
        ctypes.windll.user32.SendMessageTimeoutW(0xFFFF, 0x001D, 0, 0, 0x0002, 2000, None)   # WM_FONTCHANGE to every app
    print((OK if remove or loaded == len(files) else WARN) +
          (f"{len(files)} fonts removed" if remove else f"{loaded}/{len(files)} fonts installed and loaded for this user (restart After Effects to see them)"))
    return remove or loaded == len(files)


def assets():
    print("4. Local asset packs (Animation Composer, licensed: indexed on this machine only)")
    packs = pathlib.Path.home() / "Library/Application Support/MisterHorse/ProductManager/AssetPacks" if MAC else \
        pathlib.Path(os.environ.get("LOCALAPPDATA", "")) / "MisterHorse/ProductManager/AssetPacks"
    packs = pathlib.Path(os.environ.get("SS_ASSET_PACKS", packs))
    if not packs.exists():
        print("      none found (optional: the Assets tab stays empty)")
        return True
    r1 = run([sys.executable, str(ROOT / "tools/index_assets.py")])
    r2 = run([sys.executable, str(ROOT / "tools/asset_previews.py")])
    print(OK + (r1.stdout.strip().splitlines() or ["indexed"])[-1][:160])
    print(OK + (r2.stdout.strip().splitlines() or ["previews"])[-1][:160])
    return r1.returncode == 0


def checks():
    print("5. Library and tools")
    good = True
    for rel, what in [("library/library.json", "presets"), ("library/tags.json", "tags"), ("library/packs.json", "styles"),
                      ("library/techniques.json", "techniques"), ("library/preview_curves.json", "panel previews"),
                      ("library/thumbs_sm", "panel thumbnails"), ("library/INDEX.txt", "LLM index"), (".mcp.json", "MCP server for Claude Code")]:
        ok = (ROOT / rel).exists()
        good &= ok
        print((OK if ok else WARN) + f"{what}: {rel}")
    for tool, why in [("ffmpeg", "previews, GIFs, renders"), ("git", "updates (python tools/setup.py --update)")]:
        ok = shutil.which(tool) is not None
        print((OK if ok else WARN) + f"{tool} ({why})" + ("" if ok else " not found: install it for the full pipeline"))
    here = str(ROOT).replace("\\", "/").lower()
    live = [f for d in scripts_dirs() for f in (d / LOADER, d / "Startup" / LOADER) if f.exists()]
    wrong = [f for f in live if (loader_root(f) or "").replace("\\", "/").lower() != here]
    print((OK if live and not wrong else WARN) + f"File > Scripts and Startup loaders pointing to this clone: {len(live) - len(wrong)}/{len(live)}")
    legacy = [d / LOADER for d, _ in panel_dirs() if (d / LOADER).exists()]
    if legacy:
        print(WARN + "an old Window > Motion DNA.jsx is still there (needs admin to remove): " + ", ".join(map(str, legacy)))
    print(OK + f"version {head()}")
    return good and not wrong


def mcp_user(remove=False):
    print("MCP server for Claude Code in every folder")
    if not shutil.which("claude"):
        print(WARN + "Claude Code CLI not found; inside this repo .mcp.json already registers motion-dna")
        return not remove
    run(["claude", "mcp", "remove", "motion-dna", "-s", "user"])   # re-register so the path is this clone's
    if remove:
        print(OK + "removed motion-dna (user scope)"); return True
    r = run(["claude", "mcp", "add", "-s", "user", "motion-dna", "--", sys.executable, str(ROOT / "tools/mcp/ss_motion_mcp.py")])
    print((OK if r.returncode == 0 else WARN) + (r.stdout.strip() or r.stderr.strip() or "registered"))
    return r.returncode == 0


def uninstall():
    print(f"Motion DNA uninstall · {ROOT}\n")
    for d in [x for x, _ in panel_dirs()] + scripts_dirs() + [x / "Startup" for x in scripts_dirs()]:
        for name in OLD_LOADERS + [LOADER]:
            f = d / name
            if f.exists() and ("SS_ROOT" in f.read_text(encoding="utf-8", errors="replace")):
                try:
                    f.unlink(); print(OK + f"removed {f}")
                except OSError:
                    print(WARN + f"cannot remove {f} (needs admin)")
    mcp_user(remove=True)
    fonts(remove=True)
    cep(remove=True)
    print("\nThe repo folder itself is untouched; delete it by hand if you want. Restart After Effects.")


def main():
    if "--uninstall" in sys.argv:
        return uninstall()
    upd = "--update" in sys.argv
    print(f"Motion DNA {'update' if upd else 'setup'} · repo {ROOT} · {'macOS' if MAC else 'Windows'}\n")
    results = []
    if upd:
        ok = update()
        if not ok:
            print("\nUpdate stopped: nothing was changed."); sys.exit(1)
        results.append(ok)
    results += [clean_old(), panel(), fonts(), cep(dev="--dev" in sys.argv), assets(), checks()]
    if "--mcp-user" in sys.argv:
        results.append(mcp_user())
    print("\nLast steps in After Effects (only you can do these):")
    print("  - Restart After Effects, then open Window > Extensions > Motion DNA and dock it: it comes back every time")
    print("    After Effects starts (File > Scripts > Motion DNA opens it too).")
    pref = "Settings" if MAC else "Edit > Preferences"
    print(f"  - {pref} > Scripting & Expressions > tick 'Allow Scripts to Write Files and Access Network' (once).")
    print("  - Claude: in the panel, Agent > Connect Claude (one sign-in). The MCP dot in its header turns green.")
    print("\nDone." if all(results) else "\nDone, with warnings above.")


if __name__ == "__main__":
    main()
