"""The downloadable Motion DNA library: one HTML page in the deck's language (Gian's Motion_DNA_Deck: its grounds, type,
reveal system, interludes that the next section covers, the numbered menu and the curve readout), with everything in
the library: moves, text, curves, styles, techniques and the kit, each playing its own preview (WebM) and giving the
order to ask the agent. Built from the library's own data, so it is never out of date.

  python tools/build_library_guide.py      # -> library/guide.html (opens from the clone; media stay next to it)
Photos and panel clips in library/guide/; previews in library/webm, library/packs, library/techniques, library/gifs.
"""
import html
import json
import pathlib
import re
import sys

ROOT = pathlib.Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT / "tools"))
LIB = ROOT / "library"
OUT = LIB / "guide.html"


def slug(s):
    return re.sub(r"[^a-z0-9]+", "-", s.lower()).strip("-")


def media(kind, s):
    """(video, poster) of a preview, relative to library/: the WebM when there is one, else the GIF."""
    webm, gif = f"webm/{kind}/{s}.webm", f"gifs/{kind}/{s}.gif"
    poster = next((p for p in (f"posters/{kind}/{s}.jpg", f"posters/{kind}/{s}.png", f"gifs/{kind}/{s}_md.png") if (LIB / p).exists()), "")
    return (webm if (LIB / webm).exists() else gif if (LIB / gif).exists() else ""), poster


ENERGY = {"soft": 2, "medium": 3, "dynamic": 4, "explosive": 5, "calm": 1}
WORD = {1: "calm", 2: "soft", 3: "medium", 4: "dynamic", 5: "explosive"}


def energy(e):
    if isinstance(e, list): return WORD.get(round(sum(e) / len(e)), "medium")
    return e if isinstance(e, str) else WORD.get(e, "medium")


GUIDE_SKIP = {"Springs", "Shader transitions", "Physics"}   # react-spring / anime.js curves, Shot A/B shader wipes, sparse physics


def data():
    lib = json.loads((LIB / "library.json").read_text(encoding="utf-8"))["presets"]
    tags = {}
    try:
        for t in json.loads((LIB / "tags.json").read_text(encoding="utf-8")).get("presets", []): tags[t.get("name")] = t.get("tones", [])
    except Exception:
        pass
    def preset(p):
        v, po = media(p["kind"], p["slug"])
        verb = "Animate the text layer with" if p["kind"] == "text" else "Loop" if p["kind"] == "fx" else "Apply"
        return dict(name=p["name"], group={"own": "Motion DNA", "stylemap": "Style map", "classic": "Classics"}.get(p.get("family"), "Motion DNA") if p["kind"] == "motion" else "Loops" if p["kind"] == "fx" else "Text presets",
                    energy=energy(p.get("energy")), what=p.get("channels", ""), use=p.get("use", ""), video=v, poster=po,
                    ask=f"{verb} {p['name']} to the selected layers." if p["kind"] != "fx" else f"Loop {p['name']} on the selected layers.", call=p.get("call", ""))
    moves = [preset(p) for p in lib if p["kind"] in ("motion", "fx")]
    text = [preset(p) for p in lib if p["kind"] == "text"]
    kit = json.loads((LIB / "kit.json").read_text(encoding="utf-8"))["items"]
    trs = json.loads((LIB / "transitions.json").read_text(encoding="utf-8"))["transitions"]
    FAM = {"element": "Elements", "shape": "Shapes", "text": "Text animations", "look": "Looks", "background": "Backgrounds", "behavior": "Behaviours",
           "move": "Moves", "spring": "Springs", "physics": "Physics", "webfx": "Web FX", "gltransition": "Shader transitions"}
    def kitem(x, kind, group):
        v, po = media(f"kit-{kind}", slug(x["name"]))
        return dict(name=x["name"].replace("_", " "), group=group, energy=energy(x.get("energy")), what=", ".join(x.get("tones", [])[:3]),
                    use=x.get("use", ""), video=v, poster=po, ask=f"Add the {x['name'].replace('_', ' ')} {group.lower().rstrip('s')} from the Motion DNA kit to the open comp.",
                    call=x.get("call", ""))
    kitems = [kitem(x, "transition", "Transitions") for x in trs] + [kitem(x, x["kind"], FAM.get(x["kind"], x["kind"])) for x in kit]
    # curated: what reads as a developer test or a placeholder stays out of the guide (the agent still has it)
    kitems = [k for k in kitems if k["group"] not in GUIDE_SKIP]
    text += [k for k in kitems if k["group"] == "Text animations"]
    kitems = [k for k in kitems if k["group"] != "Text animations"]
    toks = json.loads((ROOT / "tokens/superside_motion_tokens.json").read_text(encoding="utf-8"))
    curves = [dict(name=c["name"], b=c["bezier"], use=c.get("use", "")) for c in toks["easings"]]
    packs = json.loads((LIB / "packs.json").read_text(encoding="utf-8"))["packs"]
    styles = [dict(name=p["name"], energy=p.get("energy", ""), use=p.get("desc", ""), video=f"packs/{p['slug']}.webm", poster=f"packs/{p['slug']}.png",
                   ask=f"Make the whole comp feel {p['name'].lower()}: apply the {p['name']} style.", tones=p.get("tones", [])) for p in packs]
    techs = json.loads((LIB / "techniques.json").read_text(encoding="utf-8"))["techniques"]
    import technique_clips
    def tclip(t):
        s = slug(t["name"]); v = f"techniques/{s}.webm"
        return dict(name=t["name"], use=re.sub(r"\s+", " ", t["what"]).strip(), ask=t.get("ask", ""), image=t.get("image", ""), poster=f"techniques/{s}_clip.jpg" if (LIB / f"techniques/{s}_clip.jpg").exists() else t.get("image", ""),
                    video=v if (LIB / v).exists() else "", sound=bool(technique_clips.JOBS.get(s, (0, 0, 0, 0, False))[4]))
    tech = [tclip(t) for t in techs if slug(t["name"]) not in technique_clips.HIDDEN | technique_clips.DUPLICATES]   # left out: not on every machine, or shown elsewhere
    prompts = [dict(name=x["prompt"], group=x["group"], what=x["uses"], use=x["uses"], video=x["preview"], poster=x["poster"], ask=x["prompt"], call=x["uses"])
               for x in json.loads((LIB / "prompts.json").read_text(encoding="utf-8"))["prompts"]]
    return dict(moves=moves, text=text, kit=kitems, curves=curves, styles=styles, tech=tech, prompts=prompts)


def logo():
    """The Motion DNA mark, its eleven parts as groups (strands rise, lines snap across, the arrow lands)."""
    svg = (ROOT / "assets/brand/motion_dna_mark_parts.svg").read_text(encoding="utf-8")
    inner = svg[svg.index(">") + 1:svg.rindex("</svg>")]
    inner = re.sub(r'<g id="(strand|line|arrow) (\d+)"', lambda m: f'<g class="lp lp-{m[1]}" style="--k:{m[2]}"', inner)
    return f'<svg class="mark" viewBox="-558 -605.5 1116 1211" aria-label="Motion DNA">{inner}</svg>'


CATS = [("moves", "Moves", "Moves that", "feel made", "office.jpg", "g-cloud", "Pop"),
        ("text", "Text", "Words that", "arrive", "robot.jpg", "g-stone", "Land"),
        ("curves", "Curves", "Curves you", "can feel", "studio.jpg", "g-pine", "Settle"),
        ("styles", "Styles", "One click,", "a whole feel", "dana-robot.jpg", "g-earth", "Coast"),
        ("tech", "Techniques", "Whole", "workflows", "office.jpg", "g-sea", "Whip"),
        ("kit", "Kit", "The pieces", "Claude builds", "studio.jpg", "g-cloud", "Pop"),
        ("prompts", "Prompts", "Just", "ask for it", "dana-robot.jpg", "g-leaf", "Land"),
        ("use", "Use it", "Three ways", "to ask", "robot.jpg", "g-mint", "Land")]


def page():
    D = data()
    n = {"prompts": len(D["prompts"]), "moves": len(D["moves"]), "text": len(D["text"]), "curves": len(D["curves"]), "styles": len(D["styles"]), "tech": len(D["tech"]), "kit": len(D["kit"])}
    lede = {"moves": f"{n['moves']} moves and loops on the brand curves, as native keyframes. Pick one by its energy.",
            "text": f"{n['text']} ways to bring words in: by character, word or line, typed, decoded or counted.",
            "curves": f"{n['curves']} easing curves. Every move in the library runs on one of them; the dot shows its speed.",
            "styles": f"{n['styles']} styles. Each gives every layer of a comp its role and its move, on its own curve.",
            "tech": f"{n['tech']} techniques: multi-step workflows the agent runs for you, start to finish.",
            "kit": f"{n['kit']} pieces Claude builds in your comp: transitions, elements, shapes, looks and behaviours.",
            "prompts": f"{len(D['prompts'])} prompts people use most in Agent mode, each with what it calls in the library. Copy one, change the words.",
            "use": "Ask in the panel, in the agent's chat, or from Claude Code. The same library answers."}
    nav = "".join(f'<li><a href="#{k}" data-sec="i-{k} {k}">{i + 1:02d} {t}</a></li>' for i, (k, t, *_r) in enumerate(CATS))
    rows = "".join(
        f'<li class="rule r r-up" style="--d:{250 + i * 90}ms"><a href="#{k}"><span class="q">{i + 1:02d}</span><span class="ix-name">{t}</span>'
        f'<span class="ix-lede">{html.escape(lede[k])}</span><span class="ix-n num">{n.get(k, "")}</span></a></li>' for i, (k, t, *_r) in enumerate(CATS))
    sec = []
    for i, (k, t, a, b, photo, g, curve) in enumerate(CATS):
        inter = (f'<section class="slide g-pine interlude" id="i-{k}" data-label="{t}" data-curve="Settle" data-dur="Stage 1100 ms">'
                 f'<div class="bg zoom"><img class="drift" src="guide/{photo}" alt=""></div><div class="scrim iscrim"></div><div class="band top"></div><div class="band bot"></div>'
                 f'<div class="stage ihead"><div><p class="inum serif it" data-split data-base="80">{i + 1:02d}</p>'
                 f'<h2 class="ititle"><span data-split data-base="150">{a}</span> <span class="hl"><span class="serif it" data-split data-base="520">{b}</span></span></h2></div></div></section>')
        head = (f'<p class="abs eyebrow r r-fade" style="--x:50;--y:116">{i + 1:02d} · {t}</p>'
                f'<h2 class="abs h80" style="--x:50;--y:150;--w:1100" data-split>{a} {b}</h2>'
                f'<p class="abs t27 r r-up wrap" style="--x:50;--y:248;--w:1500;--d:350ms">{html.escape(lede[k])}</p>')
        if k in ("moves", "text", "kit", "prompts"):
            body = (f'<div class="abs filters r r-fade" style="--x:50;--y:300;--w:1400;--d:500ms" data-for="{k}"></div>'
                    f'<div class="abs grid" style="--x:50;--y:362;--w:1660" data-grid="{k}"></div>'
                    f'<div class="abs pager r r-fade" style="--x:1490;--y:292;--w:320;--d:700ms" data-pager="{k}"><button class="pg prev" aria-label="Previous page">‹</button><span class="pgn">1 / 1</span><button class="pg next" aria-label="Next page">›</button></div>')
        elif k == "curves":
            body = f'<div class="abs curvegrid" style="--x:50;--y:300;--w:1560" id="curvegrid"></div>'
        elif k in ("styles", "tech"):
            body = (f'<ol class="abs plist" style="--x:50;--y:{330 if k == "styles" else 300};--w:{560 if k == "styles" else 640};{"" if k == "styles" else "--pad:5;--h3:24"}" data-player="{k}"></ol>'
                    f'<div class="abs pmedia r r-wipeL" style="--x:{690 if k == "styles" else 760};--y:{330 if k == "styles" else 300};--w:{1180 if k == "styles" else 1110};--d:200ms" data-pmedia="{k}"></div>')
        else:
            body = ('<div class="panel r r-wipe" style="left:calc(160 * var(--s));--d:150ms"><video src="guide/panel-agent.webm" poster="guide/panel-agent.jpg" muted loop playsinline preload="metadata" data-auto></video></div>'
                    '<ul class="abs asklist" style="--x:783;--y:330;--w:1000">'
                    '<li class="rule r r-up" style="--d:250ms"><span class="q">1</span><span class="ptext"><b>In the panel</b><span class="ghost">Pick a move, a style or a curve and Apply it to the selected layers.</span><span data-type="Pick a move, a style or a curve and Apply it to the selected layers.">Pick a move, a style or a curve and Apply it to the selected layers.</span></span><span class="chip c-spark r r-pop" style="--d:1500ms">Behaviors</span></li>'
                    '<li class="rule r r-up" style="--d:350ms"><span class="q">2</span><span class="ptext"><b>In the agent’s chat</b><span class="ghost">“Make the whole comp feel playful and add a sound to every click.”</span><span data-type="“Make the whole comp feel playful and add a sound to every click.”">“Make the whole comp feel playful and add a sound to every click.”</span></span><span class="chip c-mint r r-pop" style="--d:3300ms">Agent</span></li>'
                    '<li class="rule r r-up" style="--d:450ms"><span class="q">3</span><span class="ptext"><b>From Claude Code</b><span class="ghost">Every card here has its order: copy it and paste it into Claude.</span><span data-type="Every card here has its order: copy it and paste it into Claude.">Every card here has its order: copy it and paste it into Claude.</span></span><span class="chip c-lav r r-pop" style="--d:5200ms">MCP</span></li></ul>')
        content = (f'<section class="slide {g} cover-up" id="{k}" data-label="{t}" data-curve="{curve}" data-dur="Arrive 467 ms" data-rad="0">'
                   f'<div class="stage">{head if k != "use" else head.replace("--x:50;", "--x:783;", 3)}{body}</div></section>')
        sec.append(f'<div class="hold">{inter}{content}</div>')
    cover = (f'<section class="slide g-pine" id="cover" data-label="Motion DNA Library" data-curve="Land" data-dur="Stage 1100 ms">'
             f'<div class="bg zoom"><img class="drift" src="guide/studio.jpg" alt=""></div><div class="scrim"></div><div class="band bot"></div>'
             f'<div class="stage">{logo().replace("<svg class=\"mark\"", "<svg class=\"mark abs\" style=\"--x:50;--y:70;--w:150\"")}'
             f'<h1 class="abs h160 cover-title" style="--x:50;--y:300" data-chars data-delay="900">The Library</h1>'
             f'<p class="abs h96" style="--x:50;--y:460" data-split data-base="1300">Motion DNA</p>'
             f'<p class="abs t27 r r-up wrap" style="--x:50;--y:600;--w:700;--d:1700ms">Every move, curve, style, technique and kit piece, playing its own preview, with the words to ask for it.</p>'
             f'<div class="abs counts" style="--x:50;--y:780;--w:1300">'
             + "".join(f'<div class="r r-up" style="--d:{1900 + j * 110}ms"><span class="num" data-count="{v}">{v}</span><span class="t21">{lbl}</span></div>'
                       for j, (v, lbl) in enumerate([(n["moves"], "moves & loops"), (n["text"], "text"), (n["curves"], "curves"), (n["styles"], "styles"), (n["tech"], "techniques"), (n["kit"], "kit pieces")]))
             + f'</div><p class="abs t21 hint r r-fade" style="--x:50;--y:960;--d:2600ms"><kbd>↓</kbd> Scroll or use the arrow keys</p></div></section>')
    index = (f'<section class="slide g-stone" id="index" data-label="Index" data-curve="Settle" data-dur="Stage 1100 ms"><div class="stage">'
             f'<p class="abs eyebrow r r-fade" style="--x:50;--y:116">Index</p><h2 class="abs h80" style="--x:50;--y:150;--w:1200" data-split>What’s inside</h2>'
             f'<ul class="abs ixlist" style="--x:50;--y:250;--w:1820">{rows}</ul></div></section>')
    closing = (f'<section class="slide g-leaf" id="end" data-label="End" data-curve="Land" data-dur="Stage 1100 ms"><div class="bg zoom"><img class="drift" src="guide/dana-robot.jpg" alt=""></div>'
               f'<div class="scrim" style="background:linear-gradient(20deg,rgba(42,78,69,.97) 0,rgba(42,78,69,.86) 30%,rgba(42,78,69,0) 56%)"></div>'
               f'<div class="stage">{logo().replace("<svg class=\"mark\"", "<svg class=\"mark abs\" style=\"--x:50;--y:560;--w:120\"")}'
               f'<h2 class="abs h160 closing-title" style="--x:50;--y:760;--w:1832" data-chars data-delay="900">Make it move.</h2>'
               f'<p class="abs t27 r r-up" style="--x:50;--y:920;--w:900;--d:1600ms">This page lives in your Motion DNA folder: library/guide.html.</p></div></section>')
    body = cover + index + "".join(sec) + closing
    return TEMPLATE.replace("{{NAV}}", nav).replace("{{BODY}}", body).replace("{{DATA}}", json.dumps(D, ensure_ascii=False).replace("</", "<\\/"))


TEMPLATE = (ROOT / "tools" / "library_guide.html").read_text(encoding="utf-8") if (ROOT / "tools" / "library_guide.html").exists() else ""

if __name__ == "__main__":
    OUT.write_text(page(), encoding="utf-8")
    print(OUT.relative_to(ROOT), f"{OUT.stat().st_size // 1024} KB")
