# Brief: analyzing a reference video for the Motion Ontology

You're helping build a **motion ontology**: a structured map of motion-design styles measured from reference videos.
Read these first (short): `research/style_analysis_framework.md`, `research/style_map/taxonomy.md`,
`research/styles/_cross_family_patterns.md`, and one finished example: `research/styles/03_character_animation/ref05_opentoscana.md`.
Skim the family syntheses in `research/styles/*/_synthesis.md` to know the families.

Repo root: `C:\Documentos\Trabajos Clientes\Superside\R+D\Motion Library Claude` (use Bash with POSIX paths: `/c/Documentos/...`).
Python: `/c/Users/gianc/AppData/Local/Programs/Python/Python312/python.exe -I` (opencv, numpy, scipy, matplotlib, librosa installed). ffmpeg on PATH.

## Inputs already computed for your video `<id>` (don't recompute)
- Video: `references/_inbox/<id>.mp4`
- `research/batch/<id>/metrics.json`: energy, cuts/min, % moving, speed, holds, colorfulness
- `research/batch/<id>/audio.json` + `audio.png`: BPM, pulse clarity, percussive share, cuts/accents on beat vs chance, shot length in beats, verdict
- `research/batch/<id>/energy.png`: per-frame pixel diff, histogram change (cuts), optical flow
- `research/batch/<id>/ov_1.png` (`ov_2.png`): overview contact sheets with frame numbers and timestamps

## Your job, per video
1. **Look**: Read the overview sheets and the energy/audio plots. Then make **3–6 zoomed contact sheets** of key moments
   (entrances, transitions, text builds, logo, beat hits):
   `python -I tools/style_research/sheet.py references/_inbox/<id>.mp4 <out.png> <start_s> <end_s> <step_frames> <cols> <tile_width>`
   Write your sheets to `research/contact_sheets/<id>/` (create it); keep each sheet ≤ ~48 tiles.
2. **Measure** at least one clean motion curve when an element moves clearly on its own (position / scale / area over frames → normalized progress → fit):
   `import sys; sys.path.insert(0,'tools'); from fit_samples import fit, nearest_token` → `fit(progress_array)` returns `(bezier, rmse)`, `nearest_token(bezier)` returns `(token, distance)`.
   See `tools/style_research/measure_ref05.py` and `tools/style_research/blob.py` for color-mask tracking examples. Put any script you write in `research/batch/<id>/`.
   If nothing is clean enough, say so: never invent numbers.
3. **Music & edit**: use audio.json. Say what the music is doing (BPM, how clear the beat is, percussive or ambient/voiceover-led) and how the edit relates:
   cuts on beat vs chance, motion accents on beat, shot length in beats (e.g. "cuts every 2 beats"), builds/drops matching visual peaks (compare the plots).
   You can't hear the audio; describe only what the numbers and the plots support. Mention voiceover only if obvious (e.g. no beat + long holds + talking-head visuals).
4. **Classify** with the fixed vocabularies in taxonomy.md and score the **tone rubric** (5 criteria × 0–2, with a reason each).
   Families: `01 Elegant` (sub-styles Cinematic / Editorial / Warm editorial), `02 Playful reel`, `03 Character`, `04 Mixed media (proposed)`.
   If none fits, propose a family or sub-style and justify it. It's fine to say "between X and Y".
5. **Write outputs** (only these files; don't edit catalog.json, behaviors.json, the map or other videos' files):
   - **Analysis text: put it in your final message** (subagents can't write .md files here; the lead writes `analysis.md`). Same structure as the ref05 example, *light depth*: Verdict, Structure table, Elements, Lifecycle (highlights),
     Measured, Secondary animation, Transitions, **Music & edit** (new section), Speed and rhythm, Look, What defines it (5–8 bullets).
     Frame numbers as `f123 @fps`. Name the brand/product if visible.
   - `research/batch/<id>/entry.json`:
     ```json
     {"id":"<id>","title":"<Brand/subject — format>","family":"...","substyle":"...","format":"...","mood":["..."],
      "cast":"...","space":"...","motion_language":"...","transitions":["..."],
      "tone":{"secondary_motion":[n,"reason"],"color":[n,"reason"],"typography":[n,"reason"],"shape_language":[n,"reason"],"character_humor":[n,"reason"]},
      "signature":"one sentence",
      "music":{"summary":"one sentence on music + edit relation"},
      "family_note":"why this family (and doubts)",
      "thumb_time_s": <representative frame time>,
      "behaviors":[ {behavior records, 5–10, schema below} ]}
     ```
   - Behavior record schema (same as `research/ontology/behaviors.json`):
     `{"id":"<id>-<slug>","video":"<id>","family":"...","substyle":"...","element_type":"abstract shape|text|character|object/icon|UI|background|camera|logo|photo",
       "phase":"enter|move|hold|exit|secondary|transition|text-build","mechanism":"...","channels":[...],
       "timing":{"duration_f":n|null,"fps":n,"duration_ms":n|null,"stagger_f":n|null},
       "curve":{"kind":"tween|snap|spring|linear|stepped|physics|loop","bezier":[x1,y1,x2,y2]|null,"overshoot":n,...},
       "measured":true|false,"nearest_token":[name,dist]|null,"preset":null|"<closest preset in library/INDEX.txt>","notes":"..."}`
     Include **music-sync behaviors** when relevant (e.g. "cut on every downbeat", "scale hit on snare").
6. Finish with a 5-line summary in your final message: id · title · family/sub-style · energy/tone guess · music verdict · 1 key finding.

Be concrete and evidence-based; mark anything read from sheets (not measured) as such. Work through all your assigned videos without stopping.
