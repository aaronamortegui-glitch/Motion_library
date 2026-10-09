# Case study: *<Title>* (<length> s · <what it tests>)

One paragraph: what this test proves about the library and what it added to it. Final video: [`docs/examples/<case>.mp4`](../examples/<case>.mp4).

| <Moment 1> | <Moment 2> | <Moment 3> |
|---|---|---|
| ![](../examples/<case>-1.gif) | ![](../examples/<case>-2.gif) | ![](../examples/<case>-3.gif) |

## Brief
What was asked, in the requester's words (translated to English), and any constraints (people, brand, length, platform).

## Added to the library
- Presets / curves / packs / tools created or promoted because of this test (with names).

## Steps (reproducible)
| # | Step | Tool / file |
|---|---|---|
| 1 | Inputs (photos, references) | … |
| 2 | Stills | model id, prompt below |
| 3 | Likeness QA (if real people) | `tools/face_check.py` → `research/face_check_<case>.png` |
| 4 | Video | model id, duration, resolution |
| 5 | Tracking | `tools/track_points.py --regions media/<case>/clipNN_regions.json` |
| 6 | Music / VO / SFX | … |
| 7 | Scenes and edit | `media/<case>/scenes.json`, `media/<case>/edit.json` → `tools/build_<case>.jsx` |
| 8 | Render + QA | `tools/render_comps.jsx`, contact sheet, loudness |

## Prompts
Key prompts verbatim (stills, video, music).

## Costs (USD)
| Item | Count | Cost |
|---|---|---|

## What went wrong first (and the fix)
- Symptom → cause → fix (also copied into `docs/LEARNINGS.md`).

All prices, brands and names on screen are fictional. People shown agreed to appear in tests.
