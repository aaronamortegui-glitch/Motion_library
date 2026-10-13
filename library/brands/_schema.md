# Brand profiles (`<brand folder>/brand.json`)

A brand profile is a **custom style that learns**. Every review note given while animating for a brand or project is
saved here as a rule, so the next piece for that brand (by Claude, another agent or a designer) starts where the last
one ended. Brands are independent: each grows its own rules. Create and grow them with `tools/brand.py` or the MCP
tools `list_brands`, `get_brand`, `add_brand_note`, `apply_brand`; the panel shows them under **Brands**.

```jsonc
{
 "name": "Acme",                 // display name
 "slug": "acme",                 // folder name
 "created": "2026-10-10", "by": "who started it",
 "identity": {
  "colors": {"ink": "#101010", "accent": "#FF5A1F"},          // first colour = the dark base (cards, thumbs)
  "fonts": {"title": "PostScriptName-Bold", "text": "…", "accent": "…"},
  "logo": "assets/brand/acme_mark.svg"                       // optional; tools/trace_mark.py can trace one from an image
 },
 "feel": {
  "energy": [2, 3],              // 1 calm … 5 explosive (same scale as library/tags.json)
  "tones": ["modern", "corporate"],
  "style": "Modern",             // a style in library/packs.json: what apply_brand applies, layer role by layer role
  "curve": "Coast",              // a token easing that overrides the style's curve (optional)
  "transition": "Color Wipe"     // the brand's default transition (optional)
 },
 "presets": {
  "prefer": {"title": ["Chars Blur"], "logo": ["Wordmark Reveal"]},   // by role or use
  "avoid": ["Jello", "anything that bounces"]
 },
 "motion": {                     // the client's motion spec (panel: Brands > brand > Motion)
  "curves": [                    // the brand's own easing curves, as cubic-bezier, with when to use them
   {"name": "Acme Glide", "bezier": [0.3, 0.15, 0.1, 1], "use": "hero entrances", "source": {"date": "YYYY-MM-DD", "by": "panel"}}
  ],
  "timing": [                    // speed benchmarks per element: unit "frames", "ms" or "%" (% needs "of": base frames or text)
   {"element": "Title in", "value": 18, "unit": "frames", "curve": "Acme Glide", "stagger": 3, "note": "…", "source": {…}},
   {"element": "Transition", "value": 400, "unit": "ms"},
   {"element": "Logo hold", "value": 25, "unit": "%", "of": "72"}
  ]
 },
 "rules": [                      // learned in reviews; edit or remove them in the panel (Brands › Rules)
  {"id": 1, "uid": "3fa2c91b", "category": "layout", "rule": "…what to do…", "why": "…what went wrong / why…",
   "updated": "YYYY-MM-DD", "source": {"project": "…", "date": "YYYY-MM-DD", "by": "who said it"}}
 ],
 "removed": [{"uid": "…", "rule": "…", "date": "YYYY-MM-DD", "by": "…"}],   // so a removal travels when shared
 "inbox": ["uid", "…"],          // rules that came in from a shared copy, shown as new until marked as read
 "shared": [{"date": "…", "by": "…", "from": "…"}],                       // import history
 "claude": {"session": "<id>", "sessions": [{"id": "…", "title": "…", "started": "…"}]},   // this computer's
                                 // conversations for the brand (Claude Code session ids); never exported
 "projects": [{"name": "…", "path": "media/…", "date": "YYYY-MM-DD"}]
}
```

Categories: `layout`, `typography`, `motion`, `effects`, `color`, `audio`, `edit`, `process`.

**Timing units:** the panel shows every benchmark in frames at the comp's frame rate (`ms` converts; `%` converts
when `of` is a number of frames, otherwise it is shown but not applied). Apply retimes the selected keyframe pairs to
that duration and eases them with the row's curve (a brand curve first, then the token library).

**Where brands live:** never in the repo, except templates. `library/brands/<slug>/` holds templates only (Motion DNA;
add a `!library/brands/<slug>/` line to `.gitignore` to commit a new one). Your brands live in
`library/brands.local/<slug>/` (git-ignored, the default) or in any folder you choose, listed in
`library/brands.local/_registry.json`. A copy of a slug on your machine hides the template of the same slug.

**Sharing:** `python tools/brand.py export <slug>` (or the panel's Export) writes `<slug>.motiondna-brand.json` with the
thumb; `import` (or the panel's Import) adds it, or merges it into your copy. Rules match by `uid` (older rules get one
from their text, the same in Python and the panel): new rules are added, the newer edit wins, a removal is applied when
it is newer than your copy of the rule; curves and timing rows are added by name; identity and feel stay yours.

**How a rule is written:** one instruction a person or an agent can follow without the context ("Labels go into the
negative space, never against the frame edges"), plus *why* in a few words. If a rule is general (true for every brand),
also add it to CONTRIBUTING §9 or `tools/check_layout.jsx`; the brand keeps its own copy with its own wording.

Seed example: [`motion-dna/brand.json`](motion-dna/brand.json), the 22 rules learned while making the Motion DNA promo.
