---
name: motion-dna-premiere
description: Install and use Motion DNA in Adobe Premiere (beta) - Claude drives the Premiere project the user has open through the Motion DNA UXP plugin and the motion-dna-premiere MCP. Use when someone wants to edit in Premiere with Claude, connect Claude to Premiere, apply Motion DNA moves or curves to Premiere clips, add titles, music or a speed ramp in Premiere, turn a 16:9 sequence into 9:16 / 1:1 / 4:5 that follows the person, or export several formats from Premiere - even if they never say "MCP" or "plugin".
---

# Motion DNA in Premiere (beta)

Claude edits the Premiere project the user has open: sequences, clips, the library's moves on exact curves,
titles, music, speed ramps, reformatting that follows the person, export. Premiere 2026 (26.0) or newer.

```
Claude ── MCP motion-dna-premiere ── helper (localhost, started by the MCP) ── UXP plugin in Premiere ── Premiere
```
Code and full notes: `research/platforms/premiere/` (README.md has every API rule learned; read it before changing code).

## Install (say what you do; the person only clicks where noted)
1. `python tools/setup.py` installs it with everything else when Premiere 2026+ is present (or on its own:
   `python research/platforms/premiere/install_premiere.py`; add `--mcp-user` for every folder; `--check` reports;
   `--uninstall` removes it).
2. It starts the Creative Cloud app if needed (Adobe's installer fails with -642 without it), installs the plugin
   with Adobe's UPIA and registers the MCP. If Adobe shows an install prompt, **the person** clicks Install.
3. Tell the person, in these words: "Restart Premiere if it was open, open your project, then **Window › UXP
   Plugins › Motion DNA** and dock it." Then call `ppro_status`.

## Use
- Always start with `ppro_status`. If it is not connected it says exactly why (not installed, Premiere closed, panel
  not open); relay that one step to the person, plainly. A call that times out means **Premiere is showing a dialog**:
  ask the person to close it.
- Tools: `create_sequence`, `open_sequence`, `list_clips`, `import_media` (files or Flora/Krea URLs, into a bin),
  `place_clip` (`after: true` = no gap), `list_presets` / `apply_preset` (37 library moves, baked: exact on every
  frame; full-frame footage is overscaled so no edge shows), `animate` (one property on a token curve),
  **`list_titles` / `add_title`** (Motion DNA kit titles: the text is stamped into the template so it survives export,
  placed clear of faces), `speed_ramp`, `reformat_sequence` (+ `reframe_follow`; re-places titles), `add_music`
  (alone -> -14 LUFS, under a voice -16 dB), `export_sequence` (inside Premiere, H.264 Match Source), `render_frame`,
  `run_script` (last resort). Never `set_mogrt_text` for anything that must export (Premiere drops API-set text).
- Choose moves, curves and durations the Motion DNA way: `library/INDEX.txt`, tags and styles (the `motion-dna`
  skill); a brand's rules come first (`get_brand` in the AE MCP or `python tools/brand.py show <slug>`).
- Editable by default: keyframes on the clips, MOGRTs with live text. Only what Premiere cannot do natively is
  rendered (speed ramps: that one clip, into `Motion DNA renders/` next to the project).
- Never save the Premiere project unless asked.

## Check your work
- `render_frame` shows footage and stills but **not titles** (Premiere's frame export skips graphics): to check titles,
  `export_sequence` and look at frames of the MP4 (ffmpeg). Then loudness (ebur128) and blackdetect, as in CLAUDE.md.
- Feed rules for vertical: content inside y 270–1440 of 1920, music about 15–16 dB under the voice.

## Known limits (beta)
No time-remapping API (speed ramps are rendered), no Bezier handles (curves are baked, one key per frame), MOGRT
sliders stop at 100, frame export skips graphics, objects go stale after each edit (the tools handle it).
