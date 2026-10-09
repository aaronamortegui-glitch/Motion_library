# CLAUDE.md — read this first

You are working in **Motion DNA**, a motion library for After Effects (moves, techniques, scripts and styles that give AI-made motion its own identity), built to be driven by an LLM. Never put a brand logo in the library or its demos; colours and fonts come from the tokens. Several people (and their Claude sessions) contribute to it, so follow the conventions below exactly; they exist so nothing we learned gets lost.

## When someone asks you to install or update Motion DNA
Install everything, library included — the panel reads the library from the repo clone, so never copy it elsewhere:
1. **New machine:** clone the repo (`git clone https://github.com/aaronamortegui-glitch/Motion_library`) and run
   `python tools/setup.py`. **Existing clone ("update it"):** run `python tools/setup.py --update`; it pulls only if no
   tracked file has local changes (otherwise it stops and lists them: ask the user, never discard them).
   Add `--mcp-user` if they want Claude to drive AE from any folder.
2. Both paths first remove what an older version left (the pre-rename "SS Motion.jsx" loader, loaders pointing to other
   clones or paths, the old MCP name `ss-motion`, stale bridge jobs when AE is closed, previews of assets that are gone),
   then install the panel in every AE version, the fonts, the local asset-pack index and previews, and check that every
   loader points to this clone. If it warns that a loader in Program Files / Applications needs admin, tell the user to
   delete that file (AE could load an old panel).
3. Tell them the two steps only they can do: restart After Effects and open *Window › Motion DNA.jsx*, and tick
   *Preferences › Scripting & Expressions › Allow Scripts to Write Files and Access Network*.
4. With AE open and the panel docked, confirm the connection with the MCP tool `ae_status` (the panel header shows "Claude connected").
5. To remove it: `python tools/setup.py --uninstall` (loaders, MCP registration, fonts; the clone stays).

## Before you start
1. Read `CONTRIBUTING.md` (how to add presets, open-source effects, packs, case studies and learnings).
2. Skim `docs/LEARNINGS.md`: every pitfall already solved (ExtendScript, rendering, Flora/AI video, likeness, tracking, audio, costs). Do not rediscover them.
3. To pick or apply presets, read only `library/INDEX.txt`. The skill `.claude/skills/motion-dna/SKILL.md` explains the bridge and the API.
4. **Choose by tags.** Every preset, curve, technique and style is tagged in `library/tags.json` / `library/packs.json`:
   roles, targets, channels, direction, an energy range (1 calm · 2 soft · 3 medium · 4 dynamic · 5 explosive) and
   tones. Use `list_tags` / `suggest_mix` to combine a move, a token curve and a duration for the feel you need.
5. **When you get a reference analysis** (a brand or video placed in an energy range and tones, e.g. "calm, modern"):
   write it as `library/references/<slug>.json`, run `match_reference`, build what fits from existing presets, and
   **create everything that does not exist yet** — moves, curves, transitions, techniques — tag it, render its
   samples and add a style for it. The full procedure is CONTRIBUTING §8. The library grows with every reference.
6. **Prefer the MCP server** (`motion-dna`, registered in `.mcp.json`): `list_presets`, `apply_preset`, `apply_pack`, `add_asset`, `render_frame`, `run_jsx`… It drives the open After Effects through the file bridge (started by the Motion DNA panel). Check your work with `render_frame` and look at the PNG.

## Non-negotiable rules
- **Everything in the repo is English**: code, comments, metadata, docs, commit messages. Chat with the user can be in their language.
- **Animation Composer and other paid tools are behavioral references only.** Never decrypt, unpack or modify them, and never commit their files. Their asset packs are indexed locally (`library/ASSETS.local.txt`, git-ignored).
- **Open-source sources only with permissive licenses** (MIT, BSD, Apache-2.0, CC0) and with the exact version and license recorded next to the data (see `library/css_presets.json`). If a project changed license, use the last permissive release and say so.
- **Real people** appear only with their consent; check likeness with `tools/face_check.py` before spending on video. Brands, prices and names on screen are fictional.
- **Every clip with a real person gets the face refinement pass** before it goes into an edit: `python tools/faceswap_refine.py media/faceswap/jobs.json` (MiniMax H3 head inpainting with the real photo; wardrobe, background and camera stay). Add a job per new clip, then run `face_check.py` on the result. Generated video drifts from the real face; this pass is not optional.
- **Generation costs**: quote USD before generating with Flora (or similar) unless the user already approved the spend, and record real costs in `docs/LEARNINGS.md` §8.
- **Commit or push only when the user asks.** End commit messages with the co-author line your harness gives you.
- **Every user interface has an animated GIF in the repo** (`docs/screens/`, under ~500 KB) showing it in use. If you change the panel, the visualizer or any UI, re-record its GIF (see CONTRIBUTING §7) in the same commit.
- Never commit temporary jobs (`tools/_*.jsx`), candidates, A/B tests or raw downloads (see `.gitignore`).

## Where things go
| You made… | Put it in… |
|---|---|
| A preset (our own) | `tools/ss_presets.jsx` (motion `P`, text `TX`, loops `FX`) + run the library pipeline |
| An effect translated from an open-source project | `library/css_presets.json` (or a new data file of the same shape) with source, version and license |
| A style pack | `library/packs.json` + a demo (`tools/pack_demos.jsx` → `library/packs/<slug>.gif/.png/_sm.png`) |
| A new MCP tool | `tools/mcp/ss_motion_mcp.py` (`TOOLS_DEF`), documented in README |
| A new curve or duration | `tokens/superside_motion_tokens.json` (bezier + AE influence/speed) |
| A test video / case study | `media/<case>/` (specs + final assets), `docs/case-studies/<case>.md` (from `_TEMPLATE.md`), GIFs in `docs/examples/`, a section at the end of `README.md` |
| A reference analysis | `library/references/<slug>.json`, then CONTRIBUTING §8 (match, create the gaps, add a style) |
| Tags for a new preset, curve or technique | `tools/tag_library.py` → `python tools/tag_library.py` (writes `library/tags.json`) |
| Something you learned | `docs/LEARNINGS.md`, in the matching section, as *symptom → cause → fix* |
| A reusable script | `tools/` with a header comment (what, usage) and an entry in the README tools table |
