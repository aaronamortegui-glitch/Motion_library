# Case study: *Motion DNA · promo* (67 s)

The promotional cut of the internal explainer. The first explainer ([ss-motion-explainer.md](ss-motion-explainer.md)) read like slides. This one follows the style of the fashion PDP use-case video: full-screen footage, oversized type, hard cuts on the spoken word, big shape wipes, one continuous voice read and an upbeat pop bed. **Every element is still animated by an Motion DNA preset.** Final video: [`docs/examples/ss_motion_promo.mp4`](../examples/ss_motion_promo.mp4).

## Script (one continuous read)
> Motion made with AI all looks the same. Same curves. Same moves. Same template.
> So we built our own. Superside timing, sixty-eight presets, and five styles.
> One click, and the whole video gets an identity. Dynamic. Elegant. Playful.
> It lives right inside After Effects. Pick a move, watch it live, and apply it in, out, or both. Drag a marker, and the curve follows.
> And Claude can drive it too. It reads the library, applies a pack, and checks its own work, frame by frame.
> Every project leaves a technique behind. Tracking. Roto. Kinetic type. Speed ramps.
> All real keyframes, so designers keep the final touch.
> Motion that looks like Superside. Not like AI.
> The Motion DNA.

## Scenes
| # | Time | Visual | Type |
|---|---|---|---|
| S01 | 0.0–5.6 | wall of identical tiles | "Motion made with AI / all looks the same." then each "Same …" alone, full width |
| S02 | 5.6–9.6 | The Cypher, full screen, slow push (music drop) | "So we built" kicker, "our own." 320 px |
| S03 | 9.6–12.6 | Pine | counters 68 / 5, the five pack names |
| S04 | 12.6–19.1 | pack demos in a big card, hard cut per word | "One click." then Dynamic. / Elegant. / Playful. |
| S05 | 19.1–26.4 | the panel recording | "After Effects." then In. / Out. / Both. |
| S06 | 26.4–29.8 | AE timeline, marker sliding | "Drag a marker. The curve follows." |
| S07 | 29.8–37.3 | chat card, three technique frames flipping in | "Claude drives it too." and checks |
| S08 | 37.3–49.1 | full-screen hard cuts: tracking, roto, kinetic type, speed ramp | one word per cut |
| S09 | 49.1–54.0 | AE with keyframes | "All real keyframes." |
| S10 | 54.0–59.4 | the Boardroom, full screen, then Pine | "Superside." then "Not like AI." |
| S11 | 59.4–67.4 | the empty Boardroom (clean plate) under Pine | "Motion DNA" end card |

Transitions are big two-colour wipes (Spark + Pine bars, same colours on both sides of the cut, Launch in / Land out). The closing bars cover the last frames, so the cut happens under a solid colour.

## How it is built
| Step | Tool / file |
|---|---|
| VO | ElevenLabs Multilingual v2, voice Chris, stability 0.45, one take (Flora `t2a-elevenlabs-tts`) → `media/promo/vo/chris_c.wav` (v2: the hook now says *made with AI*, so it is not read as motion in general) |
| Word times | `python tools/vo_words.py vo.mp3 words.json` (openai-whisper, word timestamps) |
| Music | ElevenLabs Music, pop 118 BPM; the track is shifted so its drop (measured at 16.3 s) lands on "So we built our own" → `media/promo/music_promo_cut.wav` |
| Specs | `python media/promo/make_promo.py` → `promo.json` (scenes, cut times from the word times) + `edit.json` |
| Scenes + edit | `bash tools/bridge.sh tools/build_promo_all.jsx 900` (`build_explainer.jsx` with the new `wipe` element, full-screen `media` with `push`, rect `opacity`, text `until`; then `build_edit.jsx`) |
| Faces | every clip with Aaron or Gian goes through `tools/faceswap_refine.py` first (see LEARNINGS §3b) |
| QA | `tools/qa_frames.jsx` → `research/promo_qa/` contact sheets; loudness normalized to −16 LUFS |

## Costs (USD)
| Item | Count | Cost |
|---|---|---|
| ElevenLabs Multilingual v2, full read | 3 takes | 0.36 |
| ElevenLabs Music | 1 | 0.36 |
| Nano Banana 2.1, colorized reference photos | 2 | 0.07 |
| MiniMax H3 face refinement | local GPU | 0 |

## Notes
- **Feedback round 2:** tracked scenes instead of bare clips (CY_WIDE chips and callouts on both of them, CY_SNEAKERS labels on the shoes, its title hidden in a private duplicate); per-character type animation on every hero (Chars Ramp / Rise / Pop); slow drifting lines instead of the tile pattern; transitions on every cut with matching colours and one continuous move; SFX raised to be audible; breaths in the VO so short beats and the speed ramp stay on screen.
- **Feedback round 1:** transitions felt too fast (bars now 0.85 s in / 0.45 s out on the Surge curve, the opening bars staggered 0.14 s); the hook read as "motion in general" (new line); stacked lines of similar size fought each other (now one huge hero per beat with a small kicker, and technique labels on their own Pine band); the end card showed titles of the footage underneath (now a clean plate, `media/whisky/clip04.mp4`).
- Demo footage with its own text (the pack demos) fights a full-screen title. Put it in a big card next to the word.
- Text color follows the scene background. A Cloud scene with a Pine panel needs explicit Cloud text, or it disappears.
