"""Builds a categorized index of the awesome-opus5-5-videos prompts (research, not part of the plugin yet).

The prompt texts are third-party (written by each creator on X; the repo is MIT but the curator's license does not
clearly cover them), so the source stays local in source/ (git-ignored) and the index keeps only metadata, links and
our own tags. Our templates (templates/) are rewritten from scratch as behavioral references.

Usage: python research/video_prompts/build_index.py   (writes index.json and INDEX.md next to this file)
Tags here are a first heuristic pass; `review` marks the ones a person or Claude should check.
"""
import json, os, re, collections

HERE = os.path.dirname(os.path.abspath(__file__))
SRC = json.load(open(os.path.join(HERE, "source", "data", "videos.json"), encoding="utf-8"))

USES = {   # our roles, matched on the prompt text (lower case)
    "product_launch": [r"product launch", r"launch video", r"saas", r"product film", r"product video", r"\bapp\b.*(promo|video|launch)", r"commercial", r"\bad\b"],
    "logo_reveal": [r"logo"],
    "kinetic_type": [r"typograph", r"kinetic", r"lyric", r"\bwords?\b.*(animat|appear)", r"title sequence", r"text animation"],
    "explainer": [r"explain", r"how .* works", r"tutorial", r"lesson", r"visuali[sz]e (the|how)", r"step by step"],
    "data_viz": [r"chart", r"graph", r"data", r"dashboard", r"infographic", r"statistic", r"\bmap\b"],
    "ui_demo": [r"\bui\b", r"interface", r"screen", r"website", r"landing page", r"mockup"],
    "transition": [r"transition", r"wipe", r"morph"],
    "background_loop": [r"background", r"loop", r"ambient", r"wallpaper", r"screensaver"],
    "music_sync": [r"music", r"beat", r"rhythm", r"audio", r"soundtrack", r"song"],
    "3d_scene": [r"\b3d\b", r"three\.?js", r"webgl"],
    "particles_fx": [r"particle", r"shader", r"liquid", r"fluid", r"smoke", r"fire", r"glitch", r"noise"],
    "game_interactive": [r"\bgame\b", r"playable", r"interactive", r"simulation", r"physics"],
}
REAL_BRAND = [r"find (a|some) saas", r"\bapple\b", r"\bnike\b", r"\btesla\b", r"\bspotify\b", r"\bfigma\b", r"\bnotion\b",
              r"\bgoogle\b", r"\bopenai\b", r"\banthropic\b", r"\bclaude\b.*(logo|brand)", r"\bstripe\b", r"\bairbnb\b"]


def route(tech, cat, uses):
    """A = render HTML to MP4/MOV as an asset · B = rebuild natively in AE from our presets · C = hybrid."""
    if cat == "interactive" or "game_interactive" in uses:
        return "A" if cat != "interactive" else "out"   # games need input: not a video template
    if cat == "3d" or {"threejs", "shader", "webgl", "particles"} & set(tech):
        return "A"
    if cat == "explainer" or "product_launch" in uses or "data_viz" in uses:
        return "C"
    if {"svg", "gsap", "css"} & set(tech) or {"kinetic_type", "logo_reveal", "transition", "ui_demo"} & set(uses):
        return "B"
    return "A"


def quality(e, p):
    if str(e.get("prompt_partial")) == "True": return "partial"
    if len(p) >= 400: return "full"
    if len(p) >= 120: return "medium"
    return "short"


rows, first = [], {}
for e in SRC:
    p = e.get("prompt") or ""; pl = p.lower()
    tech = e.get("tech_tags") or []
    if isinstance(tech, str): tech = re.findall(r"[a-z0-9-]+", tech)
    uses = [u for u, pats in USES.items() if any(re.search(x, pl) for x in pats)]
    lang = "cjk" if re.search(r"[぀-ヿ一-鿿가-힯]", p) else "en"
    q = quality(e, p)
    rows.append({
        "slug": e["slug"], "author": e.get("author"), "post_url": e.get("post_url"), "skillry_url": e.get("skillry_url"),
        "category": e.get("category"), "tech": tech, "uses": uses or ["unclear"], "route": route(tech, e.get("category"), uses),
        "quality": q, "chars": len(p), "lang": lang, "has_remake": str(e.get("has_remake")) == "True",
        "real_brand": any(re.search(x, pl) for x in REAL_BRAND), "added": e.get("added"),
        "review": q in ("short", "partial") or not uses,
        "dup_of": first.setdefault(re.sub(r"\s+", " ", pl).strip()[:600], e["slug"]) if len(p) > 80 else e["slug"],
    })
    if rows[-1]["dup_of"] == e["slug"]: rows[-1]["dup_of"] = None

json.dump({"source": "https://github.com/yihui-dev/awesome-opus5-5-videos (MIT collection; prompt texts by their creators)",
           "count": len(rows), "routes": {"A": "render HTML to MP4/MOV asset", "B": "native AE template from Motion DNA presets",
                                           "C": "hybrid: rendered plate + live AE text/UI", "out": "interactive, not a video template"},
           "entries": rows}, open(os.path.join(HERE, "index.json"), "w", encoding="utf-8"), indent=1, ensure_ascii=False)

c = lambda k: collections.Counter(x for r in rows for x in (r[k] if isinstance(r[k], list) else [r[k]]))
L = ["# Opus 5.5 video prompts · categorized index", "",
     f"{len(rows)} entries from awesome-opus5-5-videos. Heuristic first pass (see build_index.py). Prompt texts stay in "
     "`source/` (git-ignored, third-party).", ""]
for k, title in [("route", "Output route"), ("category", "Source category"), ("uses", "Use (ours)"), ("tech", "Tech"),
                 ("quality", "Prompt quality"), ("lang", "Language")]:
    L += [f"## {title}", "", "| value | count |", "|---|---|"] + [f"| {a} | {b} |" for a, b in c(k).most_common()] + [""]
L += ["## Pilot candidates (full prompt, remake exists, no real brand)", "", "| slug | category | route | uses | tech | chars |", "|---|---|---|---|---|---|"]
for r in sorted(rows, key=lambda r: -r["chars"]):
    if r["quality"] == "full" and r["has_remake"] and not r["real_brand"] and r["lang"] == "en" and r["route"] != "out" and not r["dup_of"]:
        L.append(f"| [{r['slug']}]({r['skillry_url']}) | {r['category']} | {r['route']} | {', '.join(r['uses'])} | {', '.join(r['tech'])} | {r['chars']} |")
open(os.path.join(HERE, "INDEX.md"), "w", encoding="utf-8").write("\n".join(L) + "\n")
print(len(rows), "entries ·", dict(c("route")), "·", dict(c("quality")))
