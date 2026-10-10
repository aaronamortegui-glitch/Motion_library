# Brand profiles (`library/brands/<slug>/brand.json`)

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
 "rules": [                      // learned in reviews; never delete one without the brand owner, edit it instead
  {"id": 1, "category": "layout", "rule": "…what to do…", "why": "…what went wrong / why…",
   "source": {"project": "…", "date": "YYYY-MM-DD", "by": "who said it"}}
 ],
 "projects": [{"name": "…", "path": "media/…", "date": "YYYY-MM-DD"}]
}
```

Categories: `layout`, `typography`, `motion`, `effects`, `color`, `audio`, `edit`, `process`.

**How a rule is written:** one instruction a person or an agent can follow without the context ("Labels go into the
negative space, never against the frame edges"), plus *why* in a few words. If a rule is general (true for every brand),
also add it to CONTRIBUTING §9 or `tools/check_layout.jsx`; the brand keeps its own copy with its own wording.

Seed example: [`motion-dna/brand.json`](motion-dna/brand.json), the 22 rules learned while making the Motion DNA promo.
