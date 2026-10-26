"""The downloadable Motion DNA library: one HTML page in the deck's language (Gian's Motion_DNA_Deck: its grounds, type,
reveal system, interludes that the next section covers, the numbered menu and the curve readout) with everything
Motion DNA can do, each piece playing its own example and giving the words to ask for it. Gallery first. Built from
the library's own data, so it is never out of date; the plan and the rules are in docs/LIBRARY_GUIDE.md.

  Library    Moves · Text · Curves (+ springs and named eases) · Styles · Kit
  Create     Effects & 3D · Characters · Made in code · Sound
  Workflows  Techniques · Apps & panel
  Ask        Prompts · Glossary · Use it

  python tools/build_library_guide.py      # -> library/guide.html (opens from the clone; media stay next to it)
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


WORD = {1: "calm", 2: "soft", 3: "medium", 4: "dynamic", 5: "explosive"}


def energy(e):
    if isinstance(e, list): return WORD.get(round(sum(e) / len(e)), "medium")
    return e if isinstance(e, str) else WORD.get(e, "medium")


def rel(p):
    return p if (LIB / p).exists() else ""


def data():
    lib = json.loads((LIB / "library.json").read_text(encoding="utf-8"))["presets"]

    def preset(p):
        v, po = media(p["kind"], p["slug"])
        verb = "Animate the text layer with" if p["kind"] == "text" else "Apply"
        return dict(name=p["name"], group={"own": "Motion DNA", "stylemap": "Style map", "classic": "Classics"}.get(p.get("family"), "Motion DNA") if p["kind"] == "motion" else "Loops" if p["kind"] == "fx" else "Text presets",
                    energy=energy(p.get("energy")), what=p.get("channels", ""), use=p.get("use", ""), video=v, poster=po,
                    ask=f"{verb} {p['name']} to the selected layers." if p["kind"] != "fx" else f"Loop {p['name']} on the selected layers.", call=p.get("call", ""))
    moves = [preset(p) for p in lib if p["kind"] in ("motion", "fx")]
    text = [preset(p) for p in lib if p["kind"] == "text"]
    kit = json.loads((LIB / "kit.json").read_text(encoding="utf-8"))["items"]
    trs = json.loads((LIB / "transitions.json").read_text(encoding="utf-8"))["transitions"]
    FAM = {"element": "Elements", "shape": "Shapes", "text": "Text animations", "look": "Looks", "background": "Backgrounds", "behavior": "Behaviours", "move": "3D moves"}

    def kitem(x, kind, group, ask=None):
        v, po = media(f"kit-{kind}", slug(x["name"]))
        nm = x["name"].replace("_", " ")
        return dict(name=nm, group=group, energy=energy(x.get("energy")), what=", ".join(x.get("tones", [])[:3]), use=x.get("use", ""), video=v, poster=po,
                    ask=ask or f"Add the {nm} {group.lower().rstrip('s')} from the Motion DNA kit to the open comp.", call=x.get("call", ""))
    kitems = [kitem(x, "transition", "Transitions") for x in trs] + [kitem(x, x["kind"], FAM[x["kind"]]) for x in kit if x["kind"] in FAM]
    text += [k for k in kitems if k["group"] == "Text animations"]
    kitems = [k for k in kitems if k["group"] != "Text animations"]

    # Create › Effects & 3D: the open-source engines, rendered on this machine as After Effects assets
    FXG = {"confetti cannons": "Particles", "particle fireworks": "Particles", "sparks": "Particles", "scribble": "Hand-drawn",
           "flow field": "Generative", "living gradient": "Generative", "helix 3d": "3D in code", "drop 3d": "3D in code"}
    web = {f["name"]: f for f in json.loads((LIB / "web_fx.json").read_text(encoding="utf-8"))["fx"]}
    fx = []
    for x in kit:
        if x["kind"] == "webfx":
            f = web.get(x["name"], {}); g = FXG.get(x["name"], "Effects")
            fx.append(kitem(x, "webfx", g, f"Add {x['name']} ({f.get('lib', 'web')}) over the selected layer, rendered as an After Effects layer."))
            fx[-1]["what"] = f"{f.get('lib', '')} · {', '.join(x.get('tones', [])[:2])}"
        elif x["kind"] == "physics":
            fx.append(kitem(x, "physics", "Physics", f"Let these layers {x['name']} with real physics (matter.js), baked to keyframes."))
            fx[-1]["what"] = "matter.js · baked to keyframes"
        elif x["kind"] == "gltransition":
            fx.append(kitem(x, "gltransition", "Shader transitions", f"Join these two shots with the {x['name']} shader transition."))
            fx[-1]["what"] = "gl-transitions · luma matte"

    toks = json.loads((ROOT / "tokens/superside_motion_tokens.json").read_text(encoding="utf-8"))
    curves = [dict(name=c["name"], b=c["bezier"], use=c.get("use", ""), group="Motion DNA") for c in toks["easings"]]
    for c in json.loads((LIB / "springs.json").read_text(encoding="utf-8"))["curves"]:   # springs and named eases, drawn the same way
        nm = c["name"].replace("react-spring ", "").replace("anime ", "")
        curves.append(dict(name=nm, s=[round(v, 4) for v in c["samples"]], use=f"{c['source']} · overshoot {c.get('overshoot_pct', 0)} %, closest token {c.get('nearest_token', {}).get('name', '')}",
                           group="react-spring" if c["source"] == "react-spring" else "anime.js"))

    packs = json.loads((LIB / "packs.json").read_text(encoding="utf-8"))["packs"]
    styles = [dict(name=p["name"], energy=p.get("energy", ""), use=p.get("desc", ""), video=f"packs/{p['slug']}.webm", poster=f"packs/{p['slug']}.png",
                   ask=f"Make the whole comp feel {p['name'].lower()}: apply the {p['name']} style.", tones=p.get("tones", [])) for p in packs]

    import technique_clips
    techs = json.loads((LIB / "techniques.json").read_text(encoding="utf-8"))["techniques"]

    def tclip(t):
        s = slug(t["name"]); v = f"techniques/{s}.webm"
        return dict(name=t["name"], use=re.sub(r"\s+", " ", t["what"]).strip(), ask=t.get("ask", ""), image=t.get("image", ""),
                    poster=f"techniques/{s}_clip.jpg" if (LIB / f"techniques/{s}_clip.jpg").exists() else t.get("image", ""),
                    video=v if (LIB / v).exists() else "", sound=bool(technique_clips.JOBS.get(s, (0, 0, 0, 0, False))[4]))
    tech = [tclip(t) for t in techs if slug(t["name"]) not in technique_clips.HIDDEN | technique_clips.DUPLICATES]

    cat = json.loads((ROOT / "research/video_prompts/templates/catalog.json").read_text(encoding="utf-8"))
    code = []
    for t in cat.get("templates", cat):
        if not (LIB / f"templates/{t['id']}.webm").exists(): continue
        uses = ", ".join(u.replace("_", " ") for u in t.get("uses", [])[:3])
        code.append(dict(name=t["title"], group={"A": "Rendered", "B": "Rebuilt in AE"}.get(t.get("route"), "Rendered"), energy=energy(t.get("energy", [3])),
                         what=f"{t.get('duration_s', '')} s · {uses}", use=(t.get("prompt", "")[:220] + "…") if len(t.get("prompt", "")) > 220 else t.get("prompt", ""),
                         video=f"templates/{t['id']}.webm", poster=rel(f"templates/{t['id']}.jpg"), ask=f"Make a {t['title'].lower()} video for this, with the {t['id']} template.",
                         call=f"video-templates skill · {t['id']}"))

    SND = {"whoosh": "cuts and big moves", "swish": "medium moves", "pop": "things that scale up", "tick": "text arriving", "click": "buttons and UI",
           "hit": "a big landing, an sfx: hit marker", "riser": "the build before a reveal", "sub": "weight under a hit", "chime": "one payoff", "shimmer": "one sparkle",
           "type": "typing", "glitch": "tech, a cut that breaks"}
    sound = [dict(name=k, use=v, src=f"sound/{k}.ogg") for k, v in SND.items() if (LIB / f"sound/{k}.ogg").exists()]
    beds = [dict(name=f"{m} bed", use={"pulse": "a temp beat to cut on", "tick": "a clock that drives a countdown", "ambient": "a soft room tone"}[m], src=f"sound/bed-{m}.ogg")
            for m in ("pulse", "tick", "ambient") if (LIB / f"sound/bed-{m}.ogg").exists()]

    C = json.loads((LIB / "characters/the-agent/character.json").read_text(encoding="utf-8"))
    character = dict(name=C["name"], role=C["role"], emotions=[dict(name=e, use=v.get("use", ""), src=rel(f"characters/the-agent/kit/body_{e}.png")) for e, v in C["emotions"].items()],
                     visemes=[v for v in C.get("visemes", {}) if v not in ("note", "X")], video="characters/the-agent/examples/lipsync.webm",
                     poster="characters/the-agent/examples/lipsync.jpg", figma="characters/the-agent/examples/figma_kit.jpg",
                     poses=C.get("poses", []), acts=C.get("acts", []))

    A = lambda g, n, w, u, v, ask: dict(name=n, group=g, what=w, use=u, video=f"prompts/{v}.webm", poster=rel(f"prompts/{v}.jpg"), ask=ask, call=w)
    apps = [A("Agent", "Ask the agent", "Agent · chat", "One sentence in the chat; it runs the steps in After Effects and reports time and cost.", "agent-ask", "Grab this storyboard from Figma and animate it in an editorial style."),
            A("Figma", "Storyboard to timeline", "Figma → After Effects", "Figma frames become live layers and native keyframes on the library's curves.", "figma-storyboard", "Bring frames 1 to 6 from this Figma file into After Effects and animate them."),
            A("Figma", "Mark layers for AI video", "Figma · AI · layers", "A layer named AI · … in Figma arrives in After Effects marked for Flora, with its prompt.", "figma-ai-mark", "Bring this frame in and mark the AI layers for Flora."),
            A("Figma", "QA against Figma", "check_layout", "The comp checked against its Figma layout; what is off gets fixed.", "figma-qa", "QA this comp against its Figma layouts."),
            A("Agent", "Refine and render", "render_comp", "Ask for changes in plain words; it refines, then renders the spot.", "agent-render", "Tighten the transitions and render it."),
            A("Panel", "Create or modify", "Behaviors", "No keys: it creates them. Keys already there: modify or replace them.", "keyframes", "Re-ease the keys on these layers with Land."),
            A("Panel", "Shape a curve", "Curves", "Drag a handle or pick a curve; save it and reuse it on every project.", "curves", "Make me a curve between Land and Pop and save it."),
            A("Panel", "The prompt library", "Agent · Library", "Styles, techniques and the kit, each with its preview and its order.", "library", "Show me techniques for footage."),
            A("Brands", "Your brand, applied", "apply_brand", "Its curves, timings and rules on every move.", "brand-curves", "Use our brand's curves and timing on this comp."),
            A("Brands", "A note becomes a rule", "add_brand_note", "Say it once in review; every next project follows it.", "brand-note", "Remember: titles never bounce for this client."),
            A("Brands", "Share a brand", "Brands · file", "The whole brand travels as one file; updates merge their rules.", "brand-share", "Export this brand so the team can import it."),
            A("Agent", "One conversation per brand", "Project", "Each brand and each video keeps its chat, its files and what it made.", "workspace", "Start a new project for the Vela launch video."),
            A("Agent", "Connect your apps", "Project · Connect", "Claude, Figma, Krea and Flora in one click; Drive and Slack come from your Claude account.", "connect", "Connect Figma and Flora."),
            A("Agent", "Resize to every format", "resize_comp", "16:9, 1:1, 9:16 and 4:5 from one comp.", "resize", "Resize this comp into every social format."),
            A("Agent", "Check before render", "check_layout + render_frame", "Safe area, faces, overlaps; then the key frames to look at.", "check", "Check the layout and render the key frames.")]
    apps = [a for a in apps if a["poster"]]

    prompts = [dict(name=x["prompt"], group=x["group"], what=x["uses"], use=x["uses"], video=x["preview"], poster=x["poster"], ask=x["prompt"], call=x["uses"])
               for x in json.loads((LIB / "prompts.json").read_text(encoding="utf-8"))["prompts"]]
    glossary = json.loads((LIB / "glossary.json").read_text(encoding="utf-8"))["categories"]
    return dict(moves=moves, text=text, kit=kitems, fx=fx, curves=curves, styles=styles, tech=tech, code=code, sound=sound, beds=beds,
                character=character, apps=apps, prompts=prompts, glossary=glossary)


def logo():
    """The Motion DNA mark, its eleven parts as groups (strands rise, lines snap across, the arrow lands)."""
    svg = (ROOT / "assets/brand/motion_dna_mark_parts.svg").read_text(encoding="utf-8")
    inner = svg[svg.index(">") + 1:svg.rindex("</svg>")]
    inner = re.sub(r'<g id="(strand|line|arrow) (\d+)"', lambda m: f'<g class="lp lp-{m[1]}" style="--k:{m[2]}"', inner)
    return f'<svg class="mark" viewBox="-558 -605.5 1116 1211" aria-label="Motion DNA">{inner}</svg>'


# group: (title, the interlude's two lines, its photo)
GROUPS = [("Library", "The", "library", "office.jpg"), ("Create", "Make", "something new", "studio.jpg"),
          ("Workflows", "Whole", "workflows", "robot.jpg"), ("Ask", "Just", "ask for it", "dana-robot.jpg")]
# section: (id, title, heading, group index, ground, curve)
CATS = [("moves", "Moves", "Moves that feel made", 0, "g-cloud", "Pop"),
        ("text", "Text", "Words that arrive", 0, "g-stone", "Land"),
        ("curves", "Curves", "Curves you can feel", 0, "g-pine", "Settle"),
        ("styles", "Styles", "One click, a whole feel", 0, "g-earth", "Coast"),
        ("kit", "Kit", "The pieces Claude builds", 0, "g-cloud", "Pop"),
        ("fx", "Effects & 3D", "Code engines, as layers", 1, "g-pine", "Whip"),
        ("character", "Characters", "Characters that talk", 1, "g-sea", "Pop"),
        ("code", "Made in code", "Whole videos, written", 1, "g-stone", "Surge"),
        ("sound", "Sound", "Every move sounds", 1, "g-leaf", "Land"),
        ("tech", "Techniques", "Techniques, start to finish", 2, "g-sea", "Whip"),
        ("apps", "Apps & panel", "Figma, the agent, your brand", 2, "g-cloud", "Coast"),
        ("prompts", "Prompts", "What people ask", 3, "g-leaf", "Land"),
        ("glossary", "Glossary", "Words that move better", 3, "g-pine", "Coast"),
        ("use", "Use it", "Three ways to ask", 3, "g-mint", "Land")]
BROWSE = ("moves", "text", "kit", "fx", "code", "apps", "prompts")


def page():
    D = data()
    n = dict(moves=len(D["moves"]), text=len(D["text"]), curves=len(D["curves"]), styles=len(D["styles"]), kit=len(D["kit"]), fx=len(D["fx"]),
             character=len(D["character"]["emotions"]), code=len(D["code"]), sound=len(D["sound"]) + len(D["beds"]), tech=len(D["tech"]), apps=len(D["apps"]),
             prompts=len(D["prompts"]), glossary=sum(len(c["terms"]) for c in D["glossary"]), use=3)
    lede = {"moves": f"{n['moves']} moves and loops on the brand curves, as native keyframes.",
            "text": f"{n['text']} ways to bring words in: by character, word or line, typed, decoded, counted.",
            "curves": f"{n['curves']} curves: the library's 14, and the springs and named eases of react-spring and anime.js.",
            "styles": f"{n['styles']} styles. Each gives every layer of a comp its role and its move, on its own curve.",
            "kit": f"{n['kit']} pieces Claude builds in your comp: transitions, elements, shapes, looks, backgrounds, behaviours.",
            "fx": f"{n['fx']} effects from open-source engines, rendered on your machine into After Effects as layers.",
            "character": "A pixel character from one file: drawn in Figma, built in After Effects, lipsynced to any voice line.",
            "code": f"{n['code']} whole videos written as code, rendered to MP4 or rebuilt in After Effects.",
            "sound": f"{n['sound']} sounds made in code, ours to ship: the agent gives every move its sound. Click to listen.",
            "tech": f"{n['tech']} multi-step workflows the agent runs for you, start to finish.",
            "apps": f"{n['apps']} things the panel and the agent do with Figma, your brands and your projects.",
            "prompts": f"{n['prompts']} orders people use most, each with what it calls in the library.",
            "glossary": f"{n['glossary']} motion words. Use them in a prompt and the agent knows exactly what you mean.",
            "use": "Ask in the panel, in the agent's chat, or from Claude Code. The same library answers."}
    nav = "".join(f'<li><a href="#g{gi}" data-sec="g{gi} {" ".join(c[0] for c in CATS if c[3] == gi)}">{gi + 1:02d} {g[0]}</a></li>' for gi, g in enumerate(GROUPS))
    ix = ""
    for gi, g in enumerate(GROUPS):
        rows = "".join(f'<li><a href="#{c[0]}"><span class="ix-name">{c[1]}</span><span class="ix-n">{n[c[0]]}</span></a></li>' for c in CATS if c[3] == gi)
        ix += f'<div class="ixg r r-up" style="--d:{250 + gi * 120}ms"><p class="ixh"><span class="q">{gi + 1:02d}</span>{g[0]}</p><ul>{rows}</ul></div>'
    sec, num = [], 0
    for gi, g in enumerate(GROUPS):
        members = [c for c in CATS if c[3] == gi]
        inter = (f'<section class="slide g-pine interlude" id="g{gi}" data-label="{g[0]}" data-curve="Settle" data-dur="Stage 1100 ms">'
                 f'<div class="bg zoom"><img class="drift" src="guide/{g[3]}" alt=""></div><div class="scrim iscrim"></div><div class="band top"></div><div class="band bot"></div>'
                 f'<div class="stage ihead"><div><p class="inum serif it" data-split data-base="80">{gi + 1:02d} · {g[0]}</p>'
                 f'<h2 class="ititle"><span data-split data-base="150">{g[1]}</span> <span class="hl"><span class="serif it" data-split data-base="520">{g[2]}</span></span></h2>'
                 f'<p class="isub r r-fade" style="--d:900ms">{" · ".join(c[1] for c in members)}</p></div></div></section>')
        first = True
        for k, t, head_t, _, ground, curve in members:
            num += 1
            head = (f'<p class="abs eyebrow r r-fade" style="--x:50;--y:116">{num:02d} · {t}</p>'
                    f'<h2 class="abs h80" style="--x:50;--y:150;--w:1500" data-split>{head_t}</h2>'
                    f'<p class="abs t27 r r-up wrap" style="--x:50;--y:248;--w:1500;--d:350ms">{html.escape(lede[k])}</p>')
            bg = ""
            if k in BROWSE:
                body = (f'<div class="abs filters r r-fade" style="--x:50;--y:300;--w:1400;--d:500ms" data-for="{k}"></div>'
                        f'<div class="abs grid" style="--x:50;--y:362;--w:1720" data-grid="{k}"></div>'
                        f'<div class="abs pager r r-fade" style="--x:1500;--y:292;--w:320;--d:700ms" data-pager="{k}"><button class="pg prev" aria-label="Previous page">‹</button><span class="pgn">1 / 1</span><button class="pg next" aria-label="Next page">›</button></div>')
            elif k == "glossary":
                bg = '<div class="gbg" id="gbg"></div><div class="gscrim"></div>'
                body = ('<div class="abs gtabs r r-fade" style="--x:50;--y:300;--w:1820;--d:400ms" id="gtabs"></div>'
                        '<div class="abs ggrid" style="--x:50;--y:375;--w:1820" id="ggrid"></div>')
            elif k == "curves":
                body = ('<div class="abs filters r r-fade" style="--x:50;--y:300;--w:1400;--d:500ms" id="cfilters"></div>'
                        '<div class="abs curvegrid" style="--x:50;--y:362;--w:1420" id="curvegrid"></div>')
            elif k in ("styles", "tech"):
                body = (f'<ol class="abs plist" style="--x:50;--y:{330 if k == "styles" else 300};--w:{560 if k == "styles" else 640};{"" if k == "styles" else "--pad:5;--h3:24"}" data-player="{k}"></ol>'
                        f'<div class="abs pmedia r r-wipeL" style="--x:{690 if k == "styles" else 760};--y:{330 if k == "styles" else 300};--w:{1180 if k == "styles" else 1110};--d:200ms" data-pmedia="{k}"></div>')
            elif k == "character":
                body = ('<div class="abs cvid r r-wipeL" style="--x:50;--y:310;--w:1000;--d:200ms" id="cvid"></div>'
                        '<div class="abs cemo" style="--x:1100;--y:310;--w:770" id="cemo"></div>'
                        '<div class="abs csteps r r-up" style="--x:50;--y:900;--w:1820;--d:600ms" id="csteps"></div>')
            elif k == "sound":
                body = '<div class="abs sgrid" style="--x:50;--y:310;--w:1820" id="sgrid"></div>'
            else:
                body = ('<div class="panel r r-wipe" style="left:calc(160 * var(--s));--d:150ms"><video src="guide/panel-agent.webm" poster="guide/panel-agent.jpg" muted loop playsinline preload="metadata" data-auto></video></div>'
                        '<ul class="abs asklist" style="--x:783;--y:330;--w:1000">'
                        '<li class="rule r r-up" style="--d:250ms"><span class="q">1</span><span class="ptext"><b>In the panel</b><span class="ghost">Pick a move, a style or a curve and Apply it to the selected layers.</span><span data-type="Pick a move, a style or a curve and Apply it to the selected layers.">Pick a move, a style or a curve and Apply it to the selected layers.</span></span><span class="chip c-spark r r-pop" style="--d:1500ms">Behaviors</span></li>'
                        '<li class="rule r r-up" style="--d:350ms"><span class="q">2</span><span class="ptext"><b>In the agent’s chat</b><span class="ghost">“Make the whole comp feel playful and add a sound to every click.”</span><span data-type="“Make the whole comp feel playful and add a sound to every click.”">“Make the whole comp feel playful and add a sound to every click.”</span></span><span class="chip c-mint r r-pop" style="--d:3300ms">Agent</span></li>'
                        '<li class="rule r r-up" style="--d:450ms"><span class="q">3</span><span class="ptext"><b>From Claude Code</b><span class="ghost">Every card here has its order: copy it and paste it into Claude.</span><span data-type="Every card here has its order: copy it and paste it into Claude.">Every card here has its order: copy it and paste it into Claude.</span></span><span class="chip c-lav r r-pop" style="--d:5200ms">MCP</span></li></ul>')
                head = head.replace("--x:50;", "--x:783;", 3)
            cls = "slide " + ground + (" cover-up" if first else "")
            content = (f'<section class="{cls}" id="{k}" data-label="{t}" data-curve="{curve}" data-dur="Arrive 467 ms" data-rad="0">{bg}'
                       f'<div class="stage">{head}{body}</div></section>')
            sec.append(f'<div class="hold">{inter}{content}</div>' if first else content)
            first = False
    total = sum(n.values())
    cover = (f'<section class="slide g-pine" id="cover" data-label="Motion DNA Library" data-curve="Land" data-dur="Stage 1100 ms">'
             f'<div class="bg zoom"><img class="drift" src="guide/studio.jpg" alt=""></div><div class="scrim"></div><div class="band bot"></div>'
             f'<div class="stage">{logo().replace("<svg class=\"mark\"", "<svg class=\"mark abs\" style=\"--x:50;--y:70;--w:150\"")}'
             f'<h1 class="abs h160 cover-title" style="--x:50;--y:300" data-chars data-delay="900">The Library</h1>'
             f'<p class="abs h96" style="--x:50;--y:460" data-split data-base="1300">Motion DNA</p>'
             f'<p class="abs t27 r r-up wrap" style="--x:50;--y:600;--w:760;--d:1700ms">Everything Motion DNA can do, each with an example that plays and the words to ask for it.</p>'
             f'<div class="abs counts" style="--x:50;--y:780;--w:1400">'
             + "".join(f'<div class="r r-up" style="--d:{1900 + j * 110}ms"><span class="num" data-count="{v}">{v}</span><span class="t21">{lbl}</span></div>'
                       for j, (v, lbl) in enumerate([(n["moves"] + n["text"], "moves & text"), (n["curves"], "curves"), (n["kit"], "kit pieces"), (n["fx"], "effects & 3D"),
                                                     (n["code"], "videos in code"), (n["tech"], "techniques"), (total, "in all")]))
             + f'</div><p class="abs t21 hint r r-fade" style="--x:50;--y:960;--d:2600ms"><kbd>↓</kbd> Scroll or use the arrow keys</p></div></section>')
    index = (f'<section class="slide g-stone" id="index" data-label="Index" data-curve="Settle" data-dur="Stage 1100 ms"><div class="stage">'
             f'<p class="abs eyebrow r r-fade" style="--x:50;--y:116">Index</p><h2 class="abs h80" style="--x:50;--y:150;--w:1200" data-split>What’s inside</h2>'
             f'<div class="abs ixgrid" style="--x:50;--y:290;--w:1820">{ix}</div></div></section>')
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
