"""Set a Motion Deck's colours and fonts from the source instead of the default Deck 2.0 palette.

Usage (in the deck folder):
  python palette.py --pptx source.pptx            colours and fonts from the PowerPoint theme
  python palette.py --image slide1.png [...]      colours from screenshots or brand images
  python palette.py --colors "#0A211F,#D8FF85,…"  colours you already know (darkest and lightest are found for you)
  python palette.py --preset superside            back to the Motion DNA / Superside Deck 2.0 palette
  add --fonts "Text Family,Accent Family"         Google Fonts to download into fonts/ (otherwise the PPTX theme fonts)
  add --dry                                       print the block without writing it
Rewrites the BRAND TOKENS block in deck.src.html and fonts/fonts.json (read by build.py). The deck keeps its ten
ground names: dark grounds (pine, sea, leaf, earth) carry light text, light grounds (cloud, stone, sky, mint, peach,
spark, lav) carry dark text, so every source palette is mapped onto those roles and contrast holds.
"""
import colorsys, json, re, sys, urllib.request, zipfile
from pathlib import Path

HERE = Path(__file__).parent
args = sys.argv[1:]
def opt(name, many=False):
    if name not in args:
        return [] if many else None
    i = args.index(name) + 1
    if not many:
        return args[i]
    out = []
    while i < len(args) and not args[i].startswith("--"):
        out.append(args[i]); i += 1
    return out

SUPERSIDE = dict(pine="#0A211F", leaf="#2A4E45", cloud="#F7F9F2", spark="#D8FF85", mint="#8DFDBA", stone="#E6D3B0",
                 sky="#A1D4FF", sea="#19546E", earth="#292423", peach="#FF9595", lav="#FFAFED")

def rgb(h):
    h = h.strip().lstrip("#"); return tuple(int(h[i:i + 2], 16) / 255 for i in (0, 2, 4))
def hexc(c):
    return "#" + "".join(f"{round(max(0, min(1, v)) * 255):02X}" for v in c)
def lum(c):
    f = lambda v: v / 12.92 if v <= .03928 else ((v + .055) / 1.055) ** 2.4
    r, g, b = map(f, c); return .2126 * r + .7152 * g + .0722 * b
def mix(a, b, t):
    return tuple(x + (y - x) * t for x, y in zip(a, b))
def sat(c):
    return colorsys.rgb_to_hls(*c)[2]
WHITE, BLACK = (1, 1, 1), (0, 0, 0)

def to_dark(c, target=.035):
    while lum(c) > target: c = mix(c, BLACK, .12)
    return c
def to_light(c, target=.55):
    while lum(c) < target: c = mix(c, WHITE, .12)
    return c

def from_colors(cols, dk=None, lt=None):
    """Map any palette onto the ten grounds: dark ones get light text, light ones dark text."""
    cols = [rgb(c) if isinstance(c, str) else c for c in cols]
    dk = rgb(dk) if isinstance(dk, str) else dk or min(cols, key=lum)
    lt = rgb(lt) if isinstance(lt, str) else lt or max(cols, key=lum)
    acc = sorted([c for c in cols if c not in (dk, lt)], key=sat, reverse=True) or [mix(dk, lt, .5)]
    acc = (acc * 6)[:6]
    pine = to_dark(dk) if lum(dk) > .035 else dk
    return {"pine": hexc(pine), "earth": hexc(to_dark(mix(pine, (.16, .14, .14), .5), .025)),
            "sea": hexc(to_dark(acc[1], .06)), "leaf": hexc(to_dark(mix(pine, acc[2], .45), .07)),
            "cloud": hexc(lt if lum(lt) > .85 else to_light(lt, .88)), "stone": hexc(to_light(mix(lt, acc[3], .25), .6)),
            "spark": hexc(to_light(acc[0], .6)), "mint": hexc(to_light(acc[1], .55)), "sky": hexc(to_light(acc[2], .5)),
            "peach": hexc(to_light(acc[3], .45)), "lav": hexc(to_light(acc[4], .5))}

def from_pptx(path):
    z = zipfile.ZipFile(path)
    theme = next(n for n in z.namelist() if re.match(r"ppt/theme/theme\d+\.xml", n))
    x = z.read(theme).decode("utf-8", "ignore")
    def slot(name):
        m = re.search(rf"<a:{name}>(.*?)</a:{name}>", x, re.S)
        v = re.search(r'(?:srgbClr val|lastClr)="([0-9A-Fa-f]{6})"', m.group(1)) if m else None
        return "#" + v.group(1) if v else None
    c = {k: slot(k) for k in ("dk1", "lt1", "dk2", "lt2", "accent1", "accent2", "accent3", "accent4", "accent5", "accent6")}
    fonts = [re.search(rf"<a:{k}>.*?<a:latin typeface=\"([^\"]+)\"", x, re.S) for k in ("minorFont", "majorFont")]
    dark = c["dk2"] if c["dk2"] and lum(rgb(c["dk2"])) < .1 else c["dk1"]
    pal = from_colors([v for k, v in c.items() if v and k.startswith("accent")] + [dark, c["lt1"]], dark, c["lt1"])
    return pal, [f.group(1) for f in fonts if f]

def from_images(paths):
    from PIL import Image
    cols = []
    for p in paths:
        im = Image.open(p).convert("RGB"); im.thumbnail((200, 200))
        q = im.quantize(colors=8, method=Image.Quantize.MEDIANCUT)
        pal = q.getpalette()[:24]; counts = sorted(q.getcolors(), reverse=True)
        cols += [tuple(v / 255 for v in pal[i * 3:i * 3 + 3]) for _, i in counts]
    uniq = []
    for c in cols:   # drop near duplicates
        if all(sum(abs(a - b) for a, b in zip(c, u)) > .18 for u in uniq): uniq.append(c)
    return from_colors(uniq[:10])

GF = "https://fonts.googleapis.com/css2?family={}&display=swap"
UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Safari/537.36"
def fetch_font(family, italic=False):
    """Download the latin WOFF2 of a Google Font (variable weight when there is one) into fonts/."""
    q = family.replace(" ", "+") + (":ital,wght@0,100..900;1,100..900" if italic else ":wght@100..900")
    try:
        css = urllib.request.urlopen(urllib.request.Request(GF.format(q), headers={"User-Agent": UA}), timeout=20).read().decode()
    except Exception:
        try:   # fixed-weight families
            q = family.replace(" ", "+") + (":ital@0;1" if italic else "")
            css = urllib.request.urlopen(urllib.request.Request(GF.format(q), headers={"User-Agent": UA}), timeout=20).read().decode()
        except Exception as e:
            print(f"  {family}: not on Google Fonts ({e}); put its WOFF2 in fonts/ and list it in fonts/fonts.json"); return []
    out = []
    for sub, block in re.findall(r"/\* (\S+) \*/\s*@font-face \{(.*?)\}", css, re.S):
        if sub != "latin": continue
        style = re.search(r"font-style: (\w+)", block).group(1)
        fn = re.sub(r"\W+", "", family) + ("-Italic" if style == "italic" else "") + ".woff2"
        if any(f[1] == fn for f in out): continue
        urllib.request.urlretrieve(re.search(r"url\((\S+?)\)", block).group(1), HERE / "fonts" / fn)
        out.append([family, fn, style]); print(f"  font {fn}")
    return out

pal, fonts = None, []
if opt("--preset") == "superside" or not any(a in args for a in ("--pptx", "--image", "--colors")):
    pal, fonts = dict(SUPERSIDE), []
if opt("--pptx"):
    pal, fonts = from_pptx(opt("--pptx"))
if opt("--image", True):
    pal = from_images(opt("--image", True))
if opt("--colors"):
    pal = from_colors([c for c in re.split(r"[,\s]+", opt("--colors")) if c])
if opt("--fonts"):
    fonts = [f.strip() for f in opt("--fonts").split(",") if f.strip()]

text_face, accent_face = (fonts + ["Inter Tight", "Instrument Serif"])[:2] if fonts else ("Inter Tight", "Instrument Serif")
block = ("/* BRAND TOKENS — palette.py rewrites this block from a deck's PPTX theme, images or a preset.\n"
         "   The ten grounds keep their Deck 2.0 names; map a brand's colours onto them (dark grounds: pine, sea, leaf, earth;\n"
         "   light grounds: cloud, stone, sky, mint, peach, spark, lav). --sans is the text face, --serif the accent face. */\n:root{\n"
         f"  --pine:{pal['pine']}; --leaf:{pal['leaf']}; --cloud:{pal['cloud']}; --spark:{pal['spark']}; --mint:{pal['mint']};\n"
         f"  --stone:{pal['stone']}; --sky:{pal['sky']}; --sea:{pal['sea']}; --earth:{pal['earth']}; --peach:{pal['peach']}; --lav:{pal['lav']};\n"
         f'  --sans:"{text_face}","Helvetica Neue",Arial,sans-serif;\n'
         f'  --serif:"{accent_face}","Times New Roman",Georgia,serif;\n}}\n/* END BRAND TOKENS */')
print(block)
for k in ("pine", "sea", "leaf", "earth"):
    r = (lum(rgb(pal["cloud"])) + .05) / (lum(rgb(pal[k])) + .05)
    if r < 4.5: print(f"  warning: text on {k} reaches only {r:.1f}:1")
if "--dry" in args:
    sys.exit()
page = HERE / "deck.src.html"
src = page.read_text(encoding="utf-8")
src = re.sub(r"/\* BRAND TOKENS.*?/\* END BRAND TOKENS \*/", lambda m: block, src, count=1, flags=re.S)
page.write_text(src, encoding="utf-8")
if (text_face, accent_face) != ("Inter Tight", "Instrument Serif"):
    (HERE / "fonts").mkdir(exist_ok=True)
    spec = fetch_font(text_face) + fetch_font(accent_face, italic=True)
    if spec:
        (HERE / "fonts" / "fonts.json").write_text(json.dumps(spec, indent=1), encoding="utf-8")
print("deck.src.html updated; run python build.py")
