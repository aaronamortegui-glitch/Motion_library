# CLAUDE.md — read this first

You are working in **SS Motion Library**, Superside's own motion library for After Effects, built to be driven by an LLM. Several people (and their Claude sessions) contribute to it, so follow the conventions below exactly; they exist so nothing we learned gets lost.

## Before you start
1. Read `CONTRIBUTING.md` (how to add presets, open-source effects, packs, case studies and learnings).
2. Skim `docs/LEARNINGS.md`: every pitfall already solved (ExtendScript, rendering, Flora/AI video, likeness, tracking, audio, costs). Do not rediscover them.
3. To pick or apply presets, read only `library/INDEX.txt`. The skill `.claude/skills/ss-motion-library/SKILL.md` explains the bridge and the API.
4. **Prefer the MCP server** (`ss-motion`, registered in `.mcp.json`): `list_presets`, `apply_preset`, `apply_pack`, `add_asset`, `render_frame`, `run_jsx`… It drives the open After Effects through the file bridge (started by the SS Motion panel). Check your work with `render_frame` and look at the PNG.

## Non-negotiable rules
- **Everything in the repo is English**: code, comments, metadata, docs, commit messages. Chat with the user can be in their language.
- **Animation Composer and other paid tools are behavioral references only.** Never decrypt, unpack or modify them, and never commit their files. Their asset packs are indexed locally (`library/ASSETS.local.txt`, git-ignored).
- **Open-source sources only with permissive licenses** (MIT, BSD, Apache-2.0, CC0) and with the exact version and license recorded next to the data (see `library/css_presets.json`). If a project changed license, use the last permissive release and say so.
- **Real people** appear only with their consent; check likeness with `tools/face_check.py` before spending on video. Brands, prices and names on screen are fictional.
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
| Something you learned | `docs/LEARNINGS.md`, in the matching section, as *symptom → cause → fix* |
| A reusable script | `tools/` with a header comment (what, usage) and an entry in the README tools table |
