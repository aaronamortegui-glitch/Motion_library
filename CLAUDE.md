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
   loader points to this clone. Last, and never in the way of the rest, they link the repo's Claude skills
   (`motion-dna`, `video-templates`) into `~/.claude/skills`, so Claude knows Motion DNA in any folder (a user's own
   folder with the same name is left alone; `--uninstall` removes only our links). If it warns that a loader in Program Files / Applications needs admin, tell the user to
   delete that file (AE could load an old panel).
3. Tell them the steps only they can do: tick *Preferences › Scripting & Expressions › Allow Scripts to Write Files and
   Access Network*; restart After Effects and open *Window › Extensions › Motion DNA* (also *File › Scripts › Motion
   DNA*) and dock it: it reopens with After Effects, and a silent Startup script starts the bridge when AE opens. setup.py installs the panel **signed** (self-signed .zxp made on the
   machine), so no developer mode is needed. `--dev` installs a link to the clone instead and asks the person at the
   terminal before turning on Adobe's developer mode: never answer that prompt or set it yourself. For the Agent:
   *Project › Connect* (the first tab; one sign-in for Claude; Figma comes from their Claude account connectors).
4. With AE open and the panel docked, confirm the connection with the MCP tool `ae_status` (the panel header's MCP dot is green).
5. To remove it: `python tools/setup.py --uninstall` (loaders, MCP registration, fonts; the clone stays).

## Before you start
1. Read `CONTRIBUTING.md` (how to add presets, open-source effects, packs, case studies and learnings).
2. Skim `docs/LEARNINGS.md`: every pitfall already solved (ExtendScript, rendering, Flora/AI video, likeness, tracking, audio, costs). Do not rediscover them.
3. `docs/USER_GUIDE.md` › *For Claude* has the order of work and recipes that worked; `docs/use-cases/` has the tests.
   To pick or apply presets, read only `library/INDEX.txt`. The skill `.claude/skills/motion-dna/SKILL.md` explains the bridge and the API.
4. **Feeding the plugin** (a new preset, kit piece, technique, style or resource) follows one route: CONTRIBUTING §11, and `python tools/check_previews.py` is its gate.
5. **Choose by tags.** Every preset, curve, technique and style is tagged in `library/tags.json` / `library/packs.json`:
   roles, targets, channels, direction, an energy range (1 calm · 2 soft · 3 medium · 4 dynamic · 5 explosive) and
   tones. Use `list_tags` / `suggest_mix` to combine a move, a token curve and a duration for the feel you need.
6. **When you get a reference analysis** (a brand or video placed in an energy range and tones, e.g. "calm, modern"):
   write it as `library/references/<slug>.json`, run `match_reference`, build what fits from existing presets, and
   **create everything that does not exist yet** — moves, curves, transitions, techniques — tag it, render its
   samples and add a style for it. The full procedure is CONTRIBUTING §8. The library grows with every reference.
7. **Working for a brand or a project?** Read its profile first (`get_brand` / `python tools/brand.py show <slug>`),
   follow its rules, and save **every review note** the user gives as a rule in it (`add_brand_note` /
   `python tools/brand.py note`). Each brand learns on its own (CONTRIBUTING §10).
8. **Videos made as code** (showreels, launch films, explainers, particle loops, shader shots, transitions rendered to
   MP4/MOV, or rebuilt natively in AE): the research skill `.claude/skills/video-templates/SKILL.md` and
   `research/video_prompts/` (not part of the plugin yet; its REPORT says what works).
9. **Prefer the MCP server** (`motion-dna`, registered in `.mcp.json`): `list_presets`, `apply_preset`, `apply_pack`, `add_asset`, `render_frame`, `run_jsx`… It drives the open After Effects through the file bridge (started by the Motion DNA panel). Check your work with `render_frame` and look at the PNG.

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

## Before every render (video edits)
Every item below cost a review round once; check them all, then render (details: CONTRIBUTING §9, rules 16-24).
1. `tools/qa_hidden.jsx` (`QA_HIDDEN("<comp>")` via `run_jsx`): no overlay under an opaque full-frame plate, no
   footage that ends before its layer (the plate "goes dark"), no disabled or zero-opacity overlay left by mistake.
   Explain each remaining line (e.g. a word behind a cut-out is meant to be covered).
2. `check_layout` on the edit and every scene comp: fix every warning or say why it stays.
3. `render_frame` the key beats and **look** at them: supers, UI blocks, callouts, overlays that cross a cut.
4. Measure each voice line (ebur128) and level them to within ~1.5 LU; then normalise the master (~−14 LUFS) and run
   `blackdetect -vf blackdetect=d=0.04` on the result (one black frame counts).
6. Nested comps run on their own clock: when a cursor drives something inside a panel comp, key it on the nested time.
5. New problem found in review? Add it to `docs/LEARNINGS.md` (symptom → cause → fix) and, if it is a rule, here too.

## Where things go
| You made… | Put it in… |
|---|---|
| A preset (our own) | `tools/ss_presets.jsx` (motion `P`, text `TX`, loops `FX`) + run the library pipeline |
| A kit piece (transition, element, shape, background, look, text animation, move, behaviour) | its builder `tools/ss_<family>.jsx` + `library/kit.json` or `library/transitions.json` + the MCP tool + `tools/kit_gifs.py` preview — the full route is CONTRIBUTING §11 |
| A technique | `tools/` scripts + `library/techniques.json` + `TECH` in `tools/tag_library.py` + its card (CONTRIBUTING §11) |
| Our logo or its use | `assets/brand/` (`tools/logo_to_shape.py`, `tools/logo_parts.py`); manual in Figma *motion-adn › 01 · Foundations › logo*; it only closes Motion DNA's own videos |
| An effect translated from an open-source project | `library/css_presets.json` (or a new data file of the same shape) with source, version and license |
| A style pack | `library/packs.json` + a demo (`tools/pack_demos.jsx` → `library/packs/<slug>.gif/.png/_sm.png`) |
| A new MCP tool | `tools/mcp/ss_motion_mcp.py` (`TOOLS_DEF`), documented in README |
| A new curve or duration | `tokens/superside_motion_tokens.json` (bezier + AE influence/speed) |
| A test video / case study | `media/<case>/` (specs + final assets), `docs/case-studies/<case>.md` (from `_TEMPLATE.md`), GIFs in `docs/examples/`, a section at the end of `README.md` |
| A handoff of a video project (so someone else, or Claude, can resume) | `tools/collect_project.jsx` into a git-ignored `media/<case>/handoff_<v>/` with `HANDOFF.md` (context, build chain, QA, pitfalls) and a `CLAUDE.md` pointing to it |
| A reference analysis | `library/references/<slug>.json`, then CONTRIBUTING §8 (match, create the gaps, add a style) |
| A review note while working for a brand | the brand's own folder (`library/brands.local/<slug>/` or the folder it was created in, never the repo) via `tools/brand.py note` or MCP `add_brand_note` (CONTRIBUTING §10) |
| Tags for a new preset, curve or technique | `tools/tag_library.py` → `python tools/tag_library.py` (writes `library/tags.json`) |
| Something you learned | `docs/LEARNINGS.md`, in the matching section, as *symptom → cause → fix* |
| A reusable script | `tools/` with a header comment (what, usage) and an entry in the README tools table |
| A character (mascot, presenter, robot) | `library/characters/<slug>/character.json`: traits pasted verbatim into every brief, `never`, palette, styles (photoreal refs; pixel rig drawn by `research/video_prompts/runtime/pixel_rig.js`), emotions, poses, acts, acting rules; its sheet is rendered from the file (`t14_pixel_character.html?sheet`), never drawn apart |
| A code-rendered video template (research) | `research/video_prompts/templates/` + a card in `templates/catalog.json` (+ `library/intake.json`) + an animated WebP in `previews/` from `make_previews.py` (see the `video-templates` skill) |
