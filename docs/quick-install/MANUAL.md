# Install Motion DNA by hand (manual install)

The same result as [the quick install](README.md), without asking Claude. Use it when you prefer the terminal, on a
machine without Claude Code, or to fix an install.

## What you need
- Windows or macOS, After Effects 2025 or 2026.
- Git with **Git LFS** (the fonts and media live in LFS), Python 3, `ffmpeg` on the PATH.
- Windows: run the commands in Git Bash or PowerShell. macOS: Terminal.

## 1. Get the repo
```
git clone https://github.com/aaronamortegui-glitch/Motion_library
cd Motion_library
git lfs pull
```
Clone it wherever you like: the panel reads the library from this folder, so keep it (do not copy the library
elsewhere). Downloading the ZIP from GitHub also works, but then updates are manual and LFS files may be missing.

## 2. Run the installer
```
python tools/setup.py
```
Or double-click `INSTALL-Windows.cmd` / `INSTALL-macOS.command`. It:
- removes what older versions left (the old "SS Motion.jsx" loader, loaders that point to other clones, the old
  `ss-motion` MCP name, stale bridge jobs, previews of assets that are gone);
- installs the panel **signed** with a self-signed certificate made on your machine (no Adobe developer mode, no admin),
  in every After Effects version it finds, plus *File › Scripts › Motion DNA* and a silent Startup script that starts the
  Claude bridge when After Effects opens;
- installs the fonts (Inter Tight, Instrument Serif, OFL), the local asset-pack index and its previews;
- registers the MCP server `motion-dna` for Claude Code in this folder.

Options:
| Flag | What it does |
|---|---|
| `--mcp-user` | Registers the MCP for every folder, so Claude can drive After Effects from anywhere. |
| `--update` | Pulls the latest version only if no tracked file has local changes (otherwise it lists them and stops), then reinstalls. |
| `--uninstall` | Removes loaders, the MCP registration and the fonts. The clone stays. |
| `--dev` | Installs a link to the clone instead (edits show with F5). Needs Adobe's developer mode: the installer asks you before turning it on. |

If it warns that a loader in *Program Files* / *Applications* needs admin, delete that file by hand: After Effects could
otherwise load an old panel.

## 3. After Effects, once
1. *Preferences › Scripting & Expressions* › tick **Allow Scripts to Write Files and Access Network**.
2. Restart After Effects › *Window › Extensions › Motion DNA* (also *File › Scripts › Motion DNA*), and dock it.

## 4. Connect
- **Claude:** *Project › Connect › Connect Claude*. A window and your browser open; sign in. If it shows a code, paste it in
  the window. The dot turns green by itself. By hand instead: `claude auth login` in a terminal.
- **Figma** (optional): *Connect Figma* in the same sheet, then **Allow** in Figma. By hand: `claude mcp login figma`,
  or claude.ai › Settings › Connectors › Figma › Connect.
- **Flora / Krea** (optional): claude.ai › Settings › Connectors › Flora or Krea › Connect › Allow. Krea in Claude Code:
  `claude mcp add --transport http krea https://api.krea.ai/mcp`, then `/mcp` to sign in.

## 5. Check it
- The panel header shows **MCP** and **Claude** green.
- In Claude Code, inside the repo folder: ask it to run the `ae_status` tool. It answers with your After Effects
  version, the open project and "panel: loaded".

## Troubleshooting
| Symptom | Fix |
|---|---|
| The panel is not in *Window › Extensions* | Run `python tools/setup.py` again, then restart After Effects. |
| MCP dot stays red | After Effects must be open with the panel docked (the bridge starts with it); then *Check again*. |
| "Allow Scripts…" was not ticked | Tick it in Preferences and restart After Effects. |
| Claude stays red | `claude auth login` in a terminal, then *Check again* in the panel. |
| Text falls back to Arial | Fonts are installed by setup; restart After Effects after the first install. |
| An old panel opens | A loader in Program Files / Applications is left from an old version: delete it (setup names it). |
