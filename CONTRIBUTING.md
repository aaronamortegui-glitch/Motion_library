# Contributing to Motion DNA

This guide is for people **and** for AI agents (Claude Code or others) working on the repo. Following it keeps the library consistent and makes sure every test leaves something reusable behind. Start with [`CLAUDE.md`](CLAUDE.md) for the non-negotiable rules.

## The loop we follow
Every piece of work should end with three things in the repo:
1. **Something new in the library**: a preset, a curve, a pack, a tool.
2. **Evidence**: a GIF or video and the specs that rebuild it.
3. **What we learned**: lines in `docs/LEARNINGS.md`.

## Setup
Windows or macOS · After Effects 2025/2026 · Python 3 (`numpy`, `opencv-python`, `scipy`, `Pillow`) · `ffmpeg` · Git LFS. Fonts from `assets/fonts/`. AE needs *Allow Scripts to Write Files and Access Network*. Install the panel with `tools/install_panel.ps1` (Windows) or `tools/install_panel.sh` (macOS). Drive AE with `bash tools/bridge.sh tools/<job>.jsx`, which works on both systems, (see the skill in `.claude/skills/ss-motion-library`).

---

## 1. Add a preset of our own
1. **Write it** in `tools/ss_presets.jsx`:
   - motion → `P["Name"] = { channels, energy, use, in(L, t), out(L, t) }`
   - text → `TX` (text animators; the exit is shared)
   - loops → `FX` with `build(L)` and slider controls
2. **Use tokens, never raw numbers for timing**: `SSM.animate(prop, t, v0, v1, "Arrive", "Land")`. If no token fits, add one to `tokens/superside_motion_tokens.json` (bezier + AE influence/speed per the `ae_conversion` note) instead of hard-coding a curve.
3. **Metadata matters**:
   - `channels` says what moves.
   - `energy` is `soft` / `medium` / `dynamic`.
   - `use` says where it shines, in a few words.
   LLMs choose presets from this text alone.
   - **Tag it** in `tools/tag_library.py` (roles, targets, direction, energy range 1–5, tones) and run
     `python tools/tag_library.py`. An untagged preset is invisible to `match_reference`, `suggest_mix`, the
     Tone filter and the styles; the script prints the ones you forgot.
4. **Test it** with a throwaway job (`tools/_test_x.jsx`, deleted afterwards): apply it in a temp comp, read values back with `valueAtTime`, remove the comp.
5. **Run the library pipeline** (AE open):
   ```bash
   bash tools/bridge.sh tools/gif_comps.jsx 900          # one comp per preset, on the neutral sample arrow
   bash tools/bridge.sh tools/render_queue_only.jsx 120  # queue the missing previews and save the project
   bash tools/render_queue_aerender.sh                   # aerender renders the queue (fast, never stalls)
   SKIP_RENDER=1 bash tools/render_gifs.sh
   bash tools/make_previews_stills.sh                    # posters, panel thumbnails, style stills
   bash tools/bridge.sh tools/export_library.jsx 120
   python tools/build_library_html.py
   python tools/readme_catalog.py      # docs/CATALOG.md
   ```
   If the poster of your preset catches an empty frame, adjust its time in `tools/make_previews_stills.sh`.
   Never use a brand logo as the sample: the library is neutral. Every non-text preview uses the Spark arrow
   (`assets/motion_dna/sample_shape.json`), so direction and rotation read at a glance.
6. **Look at the GIF** before committing. If the thumbnail does not show the idea, fix the preset or the sample in `tools/gif_comps.jsx`.

## 2. Add effects from an open-source project
1. **Check the license**: MIT, BSD, Apache-2.0 or CC0 only, and use the exact version. Example: animate.css switched to the Hippocratic License after 4.1.1, so we use 4.1.1.
2. **Translate the behavior into data**, not code. `library/css_presets.json` holds CSS keyframes as `stops`:
   - `p`: 0–1
   - `tx` / `ty`: px
   - `txp` / `typ`: % of the layer box
   - `s` / `sx` / `sy`: scale factor
   - `r`: degrees
   - `rx`: 3D X rotation
   - `skx`: skew
   - `o`: opacity factor
   - `e`: cubic-bezier of the segment that starts at this stop

   Each preset also has a `role`: `enter`, `exit` or `attention`.
3. **Record attribution** in the file's `source` field and in the README.
4. Run the pipeline from §1. The presets join the motion catalog with `family: "classic"`.

## 3. Add a style
`library/packs.json`: a style maps layer roles (`title`, `subtitle`, `body`, `shape`, `media`, `logo`) to presets, with a
`stagger` in frames, an optional `delay` and an optional `fx` loop per role. It is **tagged like the presets** —
`tones`, `energy_range` [1–5], `energy` word — and can carry its own `curve` (a token easing that re-eases every move
of the style), the `transition` preset it uses between scenes, and its `source` (`handmade` or `reference:<slug>`).
`SSP.applyPack(comp, name)` classifies the layers and applies them. Its preview is a **2×2 grid** (title · text ·
shapes · media): `bash tools/rebuild_previews.sh` renders it (`tools/pack_demos.jsx`) and makes the panel stills.

## 4. Add a case study (a test video)
1. **Folder** `media/<case>/`:
   - final stills (JPG) and normalized clips (1920×1080 @ 24 fps)
   - `*_regions.json` / `*_tracks.json`
   - music
   - `scenes.json` and `edit.json`

   Candidates, A/B takes and raw downloads stay out (add them to `.gitignore`).
2. **Rebuild script** `tools/build_<case>.jsx` that sets `SCENE_SPEC` / `EDIT_SPEC` and runs `build_scene.jsx` + `build_edit.jsx`. Anyone should be able to regenerate the video from the repo.
3. **With real people**:
   - real photos as the only identity references
   - `python tools/face_check.py --ref <photo> --out research/face_check_<case>.png <stills or clips>` before and after video
   - keep the sheet
   - **face refinement pass on every clip with a person**: add a job to `media/faceswap/jobs.json` (one pass per person: `ref`, `detect` "the head of the man", `object` 0/1 when two people share the shot, a short head prompt that keeps hats and glasses) and run `python tools/faceswap_refine.py media/faceswap/jobs.json`. Check the before/after frames, then `bash tools/bridge.sh tools/footage_relink_release.jsx`, `python tools/faceswap_apply.py media/faceswap/jobs.json`, `bash tools/bridge.sh tools/footage_relink_restore.jsx` (originals go to `media/faceswap/preswap/`, git-ignored), and rebuild the edit
4. **QA before calling it done**:
   - contact sheet
   - stills at the key moments (`comp.saveFrameToPng`)
   - loudness about −16 LUFS (`ffmpeg -af ebur128`)
   - text never on faces
5. **Docs**:
   - `docs/case-studies/<case>.md` from [`docs/case-studies/_TEMPLATE.md`](docs/case-studies/_TEMPLATE.md)
   - 2–3 GIFs under 2 MB in `docs/examples/`
   - a compressed MP4 (`crf 26`)
   - a short entry under *Showcases* in `README.md` (the newest first; older ones go inside the `<details>` block)
6. **Promote what you built**: if the video needed a new move, title style or overlay, turn it into a preset (§1) or a tool. Add it to the README's *Latest additions*.

## 5. Record what you learned
`docs/LEARNINGS.md` is the team's memory. Add to the matching section; create one only if nothing fits.
- Write *symptom → cause → fix* in one or two lines, with the exact file, flag or value.
- Add real costs to §8 (model, length, resolution, USD charged; note when it differs from the estimate).
- Never delete a learning because it was fixed. The fix is the learning.

## 6. Commits and pull requests
- English, imperative subject (`Add Flip In preset`, `Fix pack role detection`). The body says what changed and why. End with the co-author line your harness provides.
- One topic per commit when possible: library, tool, case study, docs.
- Large binaries go through Git LFS (`.mp4`, `.mov`, `.aep`, `.wav`, `.mp3`, `.ttf`, `.webm`). Keep GIFs under ~2 MB and stills as JPG.
- For a PR, include:
  - what was added to the library
  - how you verified it (sheet, loudness, face check)
  - costs spent
  - which LEARNINGS lines you added

## 7. Interfaces always ship with a GIF
Any UI (the AE panel, the visualizer, a new tool window) must have an animated GIF in `docs/screens/` showing it in use, linked from the README. When the UI changes, re-record it in the same commit.
- **AE panel:** open it, drive it with its scripting hook (`SS_PANEL.tab("Classics")`, `SS_PANEL.select("motion", "Tada")`) from scheduled tasks, record the window with `PrintWindow` at 8 fps (DPI-aware), then:
  ```bash
  ffmpeg -framerate 8 -i f%04d.png -vf "scale=380:-1:flags=lanczos,split[a][b];[a]palettegen=max_colors=96:stats_mode=diff[p];[b][p]paletteuse=dither=bayer:bayer_scale=5:diff_mode=rectangle" docs/screens/ae-panel.gif
  ```
- **Web pages:** headless Edge or Chrome screenshots per state (`--screenshot`, URL params such as `?kind=text`), assembled the same way.
- Keep them under ~500 KB.

## 8. Grow the library from a reference (brands, videos, another Claude's analysis)
References are analysed into a feel (an energy range on 1 calm … 5 explosive, and tones) plus the moves, curves and
techniques they use. This is how the library learns new identities:
1. **Write the profile** `library/references/<slug>.json` (format: [`library/references/_schema.md`](library/references/_schema.md)).
   One file per reference; keep the sources and who analysed it.
2. **Compare it with the library:** `python tools/match_reference.py library/references/<slug>.json` (or the MCP tool
   `match_reference`). Read `research/references/<slug>.md`: what fits, how to build each move (preset + curve +
   duration), and the **gaps** (`<slug>.gaps.json`).
3. **Create every gap — nothing observed is left out:**
   - a move → a new preset (§1), named for what it does, not for the brand; tag it with the suggested tags.
   - a curve → a new token easing in `tokens/superside_motion_tokens.json` (bezier + AE influence/speed) and a row in
     `CURVES` in `tools/tag_library.py`.
   - a technique → an entry in `library/techniques.json` (what, how, what to ask Claude) and in `TECH` in
     `tools/tag_library.py`; the scripts that implement it go in `tools/`.
   - a transition → a preset with the role `transition` (it shows up in the panel's Transitions).
   - a new tone → just use it in the tags; the vocabulary is open.
4. **Re-run the match** until the gaps are empty or explained in the report.
5. **Add the proposed style** (from the report) to `library/packs.json` with its tags, curve and transition, under a
   neutral name (no brand names, no logos).
6. **Render the samples:** `bash tools/rebuild_previews.sh` (new presets, the style's 2×2 grid, stills, visualizer,
   catalog in `docs/CATALOG.md`), then `python tools/tag_library.py`.
7. **Commit** the profile, the new presets/curves/techniques, the style and the samples together, and add what you
   learned to `docs/LEARNINGS.md`.

## 9. Layout and edit rules (every video, every comp)
These came out of reviewing the Motion DNA promo; `tools/check_layout.jsx` checks rules 1-5 and 13 on the built comps
(`bash tools/bridge.sh tools/check_layout.jsx`, report in `research/tests/layout_report.json`). Fix every warning.
1. **No text on text.** Two text boxes never overlap on screen (titles, labels, HUD, a scene title over the HUD inside
   its footage comp). Callout title and body are spaced from their sizes.
2. **Nothing leaves the frame.** Keep text 40 px inside the edges. When a label does not fit sideways, **stack it into up
   to 3 short lines** (`wrap` on callouts, a `label` array on brackets, `labelSide` "top" / "bottom" / "left" / "right")
   instead of forcing one long line.
3. **Readable size and time.** At least 32 px on screen (36+ preferred), and each line holds long enough to be read.
4. **Contrast.** White on white does not work. Either place the text where the plate is dark and calm, or put it on a
   **card** (`"card": true`: translucent pine, thin cloud border) or give it a shadow.
5. **Never on a face.** HUD dots, line ends and text stay off faces: anchor callouts on the torso or an object and lead
   the line away from the face (`tools/face_boxes.py` → `"faces"` in the scene spec lets the check catch it).
6. **Never cut a phrase.** No cut inside a spoken word (`make_*.py` prints a warning); dialogue audio runs ~0.35 s past
   its cut and fades (J/L cut) so breaths and room tone are not chopped.
7. **Plates end one frame before a detected cut** (scene-detect times are the first frame of the next shot).
8. **Music leads the key moments** (Motion Style Map, `research/styles/_music_and_edit.md`): beat grid with librosa,
   reveals and the logo on a beat / downbeat; cut rate in beats from the style.
9. **Highlight with weight, not more words:** `"bold": [words]` on a text element sets key words in bold.
10. **Use the negative space.** Labels and cards go *inward*, into the empty wall or floor between the subjects, not
    pushed against the frame edges; leader lines run away from faces.
11. **A label sits beside or above what it names, never on it** (a bracket's label must not cover the screen it frames).
12. **A name stays close to its person** (freeze titles hug the silhouette, they do not drift to the frame edges).
13. **Fonts are never substituted** (`ae_status` and `check_layout.jsx` stop on it; restart AE). Titles are sans
    (Inter Tight), the serif is for the italic accent line only.
14. **Effects stay tasteful:** halos rotate slowly and stay thin (no line sticking out of the silhouette), bursts are
    solid colour, one technique per beat.

## 10. Work for a brand: its profile learns
Every brand or project gets a profile in `library/brands/<slug>/brand.json` (schema: `library/brands/_schema.md`).
1. **Before animating**, read it: `python tools/brand.py show <slug>` or the MCP tool `get_brand`. No profile yet?
   `python tools/brand.py new <slug> --name "…" --style <style> --curve <token> --tones … --energy a,b`, fill its
   identity (colours, fonts, logo) and run `python tools/brand.py thumb <slug>` for its panel card.
2. **Follow its rules** together with §9. Its base style and curve are what `apply_brand` (MCP) and the panel's
   *Brands* category apply.
3. **Every review note becomes a rule**: `python tools/brand.py note <slug> "…" --cat layout --why "…" --project … --by …`
   or `add_brand_note`. One instruction anyone can follow without the context, plus why. A note that is true for every
   brand also goes into §9 (and `tools/check_layout.jsx` when it can be checked).
4. Add the project to its `projects` list, and re-run `python tools/build_library_html.py` so `INDEX.txt` lists it.
Brands are independent: never copy one brand's rules into another without being asked.

## Checklist before you push
- [ ] `python tools/test_all.py` passes (AE open): engine, panel, MCP and the mosaics. A new preset must animate, respond to the controls and be removable.
- [ ] Everything in English, no temporary jobs or candidates in the diff
- [ ] New presets have metadata, a GIF, a poster and a panel thumb; `INDEX.txt`, visualizer and `docs/CATALOG.md` regenerated
- [ ] Open-source data has source, version and license recorded
- [ ] Case study: specs + rebuild script + doc + GIFs + README section
- [ ] Any UI you touched has a fresh GIF in `docs/screens/`
- [ ] Videos: `tools/check_layout.jsx` reports no warnings (or each one is explained)
- [ ] Work for a brand: its review notes are saved in `library/brands/<slug>/brand.json`
- [ ] LEARNINGS updated; costs recorded
