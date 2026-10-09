"""Writes library/tags.json: the tags that let Claude match a reference (a brand or video analysed into an energy
range and tones) against the library, and mix moves, curves and timings by tags.

Every preset is described on independent axes, so they can be recombined:
  move    role (enter | exit | emphasis | loop | transition), target (title, text, shape, icon, logo, ui, media,
          footage, background), channels, direction (up, down, left, right, in-place; the panel/MCP can mirror it)
  feel    energy [min, max] on 1 calm · 2 soft · 3 medium · 4 dynamic · 5 explosive, and tone (open vocabulary:
          modern, elegant, playful, bold, technical, organic, cinematic, corporate, retro, luxury… add new ones freely)
  curve   each token easing has a family (decelerate, accelerate, overshoot, anticipation, ramp, linear), an energy
          range and tones, so any move can be re-eased with a curve that fits the reference (SSP.tune ease)
  timing  token durations by energy (calm → Stage/Sweep … explosive → Tick/Blink)
Techniques (script workflows) carry the same feel tags plus what they need (footage, matte, tracks…).

Add a row here when you add a preset, curve or technique, then: python tools/tag_library.py
"""
import json
import pathlib
import re

ROOT = pathlib.Path(__file__).resolve().parent.parent

# name: (roles, targets, direction, energy [min, max], tones)
P = {
    # --- own moves ---
    "Fade": (["enter", "exit"], ["title", "text", "ui", "media", "shape", "background"], "in-place", [1, 2], ["modern", "corporate", "elegant"]),
    "Fade Up": (["enter", "exit"], ["title", "text", "ui"], "up", [1, 3], ["modern", "corporate", "elegant"]),
    "Scale Pop": (["enter"], ["icon", "ui", "shape"], "in-place", [3, 4], ["playful", "bold"]),
    "Blur In": (["enter", "exit"], ["media", "title", "background"], "in-place", [1, 2], ["elegant", "cinematic", "luxury"]),
    "Slide Land": (["enter", "exit"], ["media", "ui", "shape"], "left", [2, 3], ["modern", "corporate"]),
    "Rotate Settle": (["enter"], ["logo", "icon", "shape"], "in-place", [2, 3], ["playful", "modern"]),
    "Squash Warp": (["enter", "transition"], ["shape", "icon"], "in-place", [4, 5], ["playful", "bold"]),
    "Wipe Reveal": (["enter", "exit"], ["shape", "ui"], "right", [2, 3], ["modern", "corporate", "technical"]),
    "Organic Draw": (["enter"], ["shape"], "in-place", [2, 3], ["organic", "playful"]),
    "Organic Stroke": (["enter", "emphasis"], ["shape"], "in-place", [3, 4], ["organic", "bold"]),
    "Line Draw": (["enter"], ["shape", "icon"], "in-place", [2, 3], ["technical", "modern"]),
    "Slam In": (["enter"], ["title", "text"], "in-place", [4, 5], ["bold", "cinematic"]),
    "Flip In": (["enter"], ["ui", "media"], "in-place", [2, 3], ["modern", "playful"]),
    "Spin Pop": (["enter"], ["icon", "logo", "shape"], "in-place", [4, 5], ["playful", "bold"]),
    "Drop Bounce": (["enter"], ["icon", "shape", "ui"], "down", [3, 4], ["playful"]),
    "Stretch Slide": (["enter"], ["ui", "shape"], "left", [3, 4], ["modern", "playful"]),
    "Ramp Slide": (["enter", "transition"], ["media", "ui", "title"], "left", [3, 4], ["cinematic", "modern"]),
    "Ramp Zoom": (["enter"], ["logo", "media"], "in-place", [3, 4], ["cinematic", "bold"]),
    "Ramp Spin": (["enter"], ["icon", "logo"], "in-place", [3, 5], ["bold", "playful"]),
    "Whip Pan": (["transition", "enter"], ["media", "footage"], "left", [4, 5], ["cinematic", "bold"]),
    "Surge Rise": (["enter"], ["title", "ui", "media"], "up", [2, 3], ["elegant", "cinematic", "modern"]),
    "Speed Ramp": (["transition", "emphasis"], ["footage"], "in-place", [3, 5], ["cinematic", "bold"]),
    "Punch Zoom": (["emphasis"], ["footage", "media"], "in-place", [3, 4], ["cinematic", "bold"]),
    # --- classics (animate.css 4.1.1, MIT) ---
    "Back In Down": (["enter"], ["ui", "media"], "down", [4, 5], ["playful", "bold", "retro"]),
    "Back In Left": (["enter"], ["ui"], "right", [4, 5], ["playful", "bold"]),
    "Bounce In": (["enter"], ["icon", "ui"], "in-place", [4, 4], ["playful", "retro"]),
    "Bounce In Up": (["enter"], ["ui", "icon"], "up", [4, 4], ["playful"]),
    "Rubber Band": (["emphasis"], ["ui", "logo"], "in-place", [4, 4], ["playful", "retro"]),
    "Jello": (["emphasis"], ["shape", "icon"], "in-place", [4, 4], ["playful"]),
    "Heart Beat": (["emphasis"], ["icon", "ui"], "in-place", [3, 3], ["playful", "modern"]),
    "Tada": (["emphasis"], ["ui", "logo"], "in-place", [4, 4], ["playful", "retro"]),
    "Wobble": (["emphasis"], ["ui", "icon"], "in-place", [4, 4], ["playful", "retro"]),
    "Swing Hinge": (["emphasis"], ["ui", "shape"], "in-place", [3, 3], ["playful", "retro"]),
    "Flip In X": (["enter"], ["ui", "title"], "in-place", [2, 3], ["modern", "technical"]),
    "Light Speed In": (["enter"], ["title", "ui"], "left", [4, 5], ["bold", "retro"]),
    "Roll In": (["enter"], ["icon", "shape"], "left", [3, 4], ["playful"]),
    "Zoom In Down": (["enter"], ["title"], "down", [3, 3], ["bold", "retro"]),
    "Jack In The Box": (["enter"], ["icon"], "in-place", [4, 5], ["playful"]),
    "Back Out Up": (["exit"], ["ui", "media"], "up", [4, 5], ["playful", "bold"]),
    "Zoom Out": (["exit"], ["title", "text", "ui", "media", "shape"], "in-place", [1, 2], ["modern", "elegant", "corporate"]),
    # --- loops ---
    "Float": (["loop"], ["icon", "ui", "background"], "in-place", [1, 2], ["modern", "organic"]),
    "Wiggle Rotate": (["loop"], ["icon", "shape"], "in-place", [2, 3], ["playful", "organic"]),
    "Pulse": (["loop", "emphasis"], ["ui", "icon"], "in-place", [2, 3], ["modern", "playful"]),
    "Jitter": (["loop"], ["text", "shape"], "in-place", [4, 5], ["bold", "technical", "retro"]),
    "Breathe": (["loop"], ["background", "shape"], "in-place", [1, 1], ["elegant", "organic"]),
    "Swing": (["loop"], ["ui", "shape"], "in-place", [1, 2], ["playful", "organic"]),
    "Orbit": (["loop"], ["icon", "shape"], "in-place", [1, 2], ["technical", "playful"]),
    "Shake": (["emphasis", "loop"], ["footage", "title"], "in-place", [4, 5], ["bold"]),
    "Holo Flicker": (["loop"], ["ui", "text"], "in-place", [3, 3], ["technical", "retro"]),
    # --- text ---
    "Chars Rise": (["enter", "exit"], ["title"], "up", [2, 3], ["modern", "elegant"]),
    "Words Fade Up": (["enter", "exit"], ["text", "title"], "up", [1, 2], ["corporate", "modern", "elegant"]),
    "Blur Words": (["enter", "exit"], ["text", "title"], "in-place", [1, 2], ["elegant", "cinematic", "luxury"]),
    "Tracking Settle": (["enter", "exit"], ["title"], "in-place", [2, 3], ["elegant", "luxury", "cinematic"]),
    "Chars Pop": (["enter"], ["title", "text"], "in-place", [4, 5], ["playful", "bold"]),
    "Typewriter": (["enter"], ["text", "ui"], "in-place", [2, 3], ["technical", "retro"]),
    "Scramble": (["enter"], ["title", "ui"], "in-place", [4, 4], ["technical", "bold"]),
    "Count Up": (["enter"], ["text"], "in-place", [2, 3], ["corporate", "technical", "modern"]),
    "Chars Ramp": (["enter"], ["title"], "up", [2, 4], ["cinematic", "elegant"]),
    "Words Slam": (["enter"], ["title", "text"], "in-place", [4, 5], ["bold", "cinematic"]),
}

# token easings: family, energy range, tones (re-ease any move with these through SSP.tune({ease}))
CURVES = {
    "Flat": ("linear", [1, 5], ["technical"]),
    "Land": ("decelerate", [2, 4], ["modern", "corporate"]),
    "Settle": ("decelerate", [1, 3], ["elegant", "modern", "corporate"]),
    "Cruise": ("decelerate", [1, 3], ["modern", "corporate", "elegant"]),
    "Launch": ("accelerate", [3, 5], ["bold", "cinematic"]),
    "Pop": ("overshoot", [3, 5], ["playful", "bold"]),
    "Recoil": ("anticipation", [3, 5], ["playful", "bold"]),
    "Ramp": ("ramp", [3, 5], ["cinematic", "bold"]),
    "Surge": ("ramp", [2, 4], ["elegant", "cinematic", "luxury"]),
    "Whip": ("ramp", [3, 5], ["cinematic", "bold"]),
}
# durations that fit each energy level (token names)
TIMING = {"1": ["Stage", "Sweep"], "2": ["Sweep", "Arrive"], "3": ["Arrive", "Glide"], "4": ["Glide", "Blink"], "5": ["Blink", "Tick"]}

# techniques (library/techniques.json): energy, tones, what they need
TECH = {
    "Tracked labels": ([2, 4], ["technical", "modern", "cinematic"], ["footage", "tracks"]),
    "Text behind people": ([2, 4], ["cinematic", "bold", "modern"], ["footage", "matte"]),
    "Roto breakdown": ([2, 3], ["technical"], ["footage", "matte"]),
    "HUD overlays": ([3, 4], ["technical", "retro"], ["footage", "tracks"]),
    "Speed ramps": ([3, 5], ["cinematic", "bold"], ["footage"]),
    "Freeze frame + kinetic type": ([4, 5], ["bold", "cinematic"], ["footage", "matte"]),
    "Shape-wipe transitions": ([3, 5], ["bold", "modern", "playful"], []),
    "Marker timing": ([1, 5], [], []),
    "Styles": ([1, 5], [], []),
    "Cut on the voice": ([1, 5], [], ["voiceover"]),
    "Face refinement": ([1, 5], [], ["footage", "real people"]),
}

CHANNELS = [("opacity", r"fade|opacity"), ("position", r"position"), ("scale", r"scale|zoom|squash"), ("rotation", r"rotat|spin"),
            ("blur", r"blur"), ("skew", r"skew|warp"), ("3d", r"3d|rotate x|rotate y"), ("trim", r"trim"), ("mask", r"mask"),
            ("time", r"time remap"), ("per-char", r"\(char"), ("per-word", r"\(word"), ("text-source", r"source text|tracking&")]


def channels_of(s):
    s = s.lower()
    return [c for c, rx in CHANNELS if re.search(rx, s)]


def main():
    lib = {p["name"]: p for p in json.load(open(ROOT / "library/library.json", encoding="utf-8"))["presets"]}
    presets, missing = [], []
    for name, meta in lib.items():
        if meta.get("kind") == "recipe":
            continue   # measured references (AC calibration), not part of the vocabulary
        if name not in P:
            missing.append(name); continue
        roles, targets, direction, energy, tones = P[name]
        presets.append({"name": name, "kind": meta["kind"], "family": meta.get("family", "own"), "roles": roles, "targets": targets,
                        "channels": channels_of(meta.get("channels", "")), "direction": direction, "energy": energy, "tones": tones})
    techs = json.load(open(ROOT / "library/techniques.json", encoding="utf-8"))["techniques"]
    techniques = [{"name": t["name"], "energy": TECH.get(t["name"], ([1, 5], [], []))[0], "tones": TECH.get(t["name"], ([1, 5], [], []))[1],
                   "needs": TECH.get(t["name"], ([1, 5], [], []))[2]} for t in techs]
    styles = json.load(open(ROOT / "library/packs.json", encoding="utf-8"))["packs"]
    tones = sorted({t for p in presets for t in p["tones"]} | {t for c in CURVES.values() for t in c[2]} | {t for st in styles for t in st.get("tones", [])})
    out = {
        "version": 1,
        "note": "Generated by tools/tag_library.py. Energy: 1 calm · 2 soft · 3 medium · 4 dynamic · 5 explosive.",
        "energy_scale": {"1": "calm", "2": "soft", "3": "medium", "4": "dynamic", "5": "explosive"},
        "tones": tones,
        "presets": presets,
        "curves": [{"name": n, "family": c[0], "energy": c[1], "tones": c[2]} for n, c in CURVES.items()],
        "timing": TIMING,
        "techniques": techniques,
    }
    json.dump(out, open(ROOT / "library/tags.json", "w", encoding="utf-8"), indent=1, ensure_ascii=False)
    print(f"tags: {len(presets)} presets, {len(CURVES)} curves, {len(techniques)} techniques, tones: {', '.join(tones)}")
    if missing:
        print("UNTAGGED (add them to tools/tag_library.py):", ", ".join(missing))


if __name__ == "__main__":
    main()
