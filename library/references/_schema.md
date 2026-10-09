# Reference profile

A **reference profile** is the analysis of a brand's or a video's motion, written as JSON so Claude can compare it
with the library (`python tools/match_reference.py library/references/<slug>.json`, or the MCP tool
`match_reference`). Whoever analyses a reference, a person or another Claude session, fills one file per reference
in `library/references/`. Example: [`google-calm-modern.json`](google-calm-modern.json).

```jsonc
{
  "name": "Google — product motion",          // what was analysed
  "slug": "google-calm-modern",
  "sources": ["…urls or files of the videos analysed…"],
  "analysed_by": "Gian Orsi + Claude",
  "energy": [1, 2],                            // range on 1 calm · 2 soft · 3 medium · 4 dynamic · 5 explosive
  "tones": ["modern", "friendly"],             // open vocabulary; new tones are welcome (see library/tags.json "tones")
  "avoid": ["overshoot", "shake", "retro"],    // curve families, tones or preset names that break the reference
  "moves": [                                   // the recurring moves, most frequent first
    { "describe": "cards rise a little while fading in",
      "role": "enter",                         // enter | exit | emphasis | loop | transition
      "target": "ui",                          // title | text | shape | icon | logo | ui | media | footage | background
      "channels": ["opacity", "position"],     // see tools/tag_library.py CHANNELS
      "direction": "up",                       // up | down | left | right | in-place
      "duration_ms": 300,
      "bezier": [0.2, 0, 0, 1],                // measured or published curve, if known
      "frequency": "often" }                   // often | sometimes | once
  ],
  "curves": [ { "name": "emphasized decelerate", "bezier": [0.05, 0.7, 0.1, 1], "use": "elements entering" } ],
  "techniques": [ { "name": "shape morph", "describe": "a chip grows into a card", "needs": [] } ],
  "notes": "anything that does not fit the fields above"
}
```

`match_reference.py` answers four questions and writes `research/references/<slug>.md` and `<slug>.gaps.json`:

1. **What already fits** — presets whose energy overlaps the reference and whose tones match, minus anything in `avoid`.
2. **Each observed move → the closest preset** (role, target, channels, direction, energy), with the token curve
   and duration to apply it with (`SSP.tune`). Moves without a good match are **gaps**.
3. **Each observed curve → the closest token easing.** Curves that are too far from every token are **gaps**: add them to
   `tokens/superside_motion_tokens.json`.
4. **Techniques** that the library does not have yet are **gaps**.

It also proposes a **style** for the reference (one preset per layer role) that can go into `library/packs.json`.
What to do with the gaps is in `CONTRIBUTING.md` §8.
