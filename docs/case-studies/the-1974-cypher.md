# Case study: *The 1974 Cypher* (speed-ramp test)

A 32 s test of the new speed-ramp curves (`Ramp`, `Surge`, `Whip`) on AI footage of the two project collaborators as 1970s Bronx hip-hop crew: orbital moves around the outfit details, ramped slow → fast → slow on the beat, with tracked labels on each detail. Final video: [`docs/examples/cypher_1974.mp4`](../examples/cypher_1974.mp4).

| Ramp on the sneakers | Wide orbit + title | Tracked details |
|---|---|---|
| ![](../examples/cypher-sneakers.gif) | ![](../examples/cypher-wide.gif) | ![](../examples/cypher-details.gif) |

## Steps
| # | Step | Tool / file |
|---|---|---|
| 1 | Identity photos uploaded to Flora (real photos only) | `flora_create_asset(signed-url)` + `tools/signed_upload.py` |
| 2 | Close-ups per person, real photo as the only identity reference, traits described in the prompt | Nano Banana Pro / **Nano Banana 2.1** (`is2i-elote-gateway`) |
| 3 | Likeness QA against the real photos; rejected takes regenerated | `tools/face_check.py` → `research/face_check_*.png` |
| 4 | Master two-shot built from real photos + approved close-ups (never from the old master) | Nano Banana 2.1 |
| 5 | Detail stills (sneakers, chains/watch) from the master | Nano Banana Pro |
| 6 | Video: A/B on the hardest shot (orbit around a face) | Seedance 2.5 vs MiniMax H3 Max → Seedance for the face hero, MiniMax for the wide and Gian, Kling 3.0 Pro for the shots without faces |
| 7 | Normalize to 1920×1080 @ 24 fps (MiniMax upscaled from 768p) | `ffmpeg` |
| 8 | Tracking (5 regions per clip) | `tools/track_points.py --regions media/cypher/clipNN_regions.json` |
| 9 | Music: 95 BPM breakbeat, bars 0–7 joined to bars 14–20 on the downbeat (drops a 5 s silence) | ElevenLabs Music + `ffmpeg atrim/acrossfade` |
| 10 | Scenes: tracked callouts, brackets, chips, meters, kickers | `media/cypher/scenes.json` → `tools/build_scene.jsx` |
| 11 | Edit: speed ramps per shot, whooshes on the bursts (local asset packs), lower-third titles, end card | `media/cypher/edit.json` → `tools/build_edit.jsx` (`speed`, `texts`) |

## Speed ramps used
Each shot is two bars (5.05 s at 95 BPM): slow-mo (≈0.5×) → a `Ramp` burst through most of the clip (whoosh: *Swoosh Transition 23*) → slow-mo landing. The last beat replays the wide orbit **in reverse** on a single `Ramp` curve (a rewind whip). Pixel-motion frame blending smooths the slow parts.

## On screen
`BRONX · 1974` (*Tracking Settle*) · **The Cypher.** (*Words Slam*) with a *Scramble* kicker · tracked labels: shell-toes, high-tops, boombox, bucket hat, amber glasses, rope chain, velour tracksuit, six-panel cap, aviators, leather bomber, nameplate, gold watch · **Speed ramps.** (*Chars Ramp*) · end card.

## What went wrong first (and the fix)
- The first master and close-ups did not look like the collaborators (younger, slimmer, different beard and hair): the Boardroom close-ups had been used as extra identity references. Fix: real photos only, traits in the prompt, QA sheet before video. One collaborator only read as himself without aviators on his face and with a cap like his real one.
- Passing the old master as a "scene reference" made the model copy its faces. Fix: describe the scene in text.
- Titles in the centre covered the faces once the orbit moved the people across the frame. Fix: soft lower-third band (`"band": true`).
- Seedance 2.5 billed USD 6.05 for one 5 s clip (estimate 2.48).

All prices, brands and the nameplate are fictional. The subjects are project collaborators who agreed to appear in tests.
