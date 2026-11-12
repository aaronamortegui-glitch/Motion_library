"""Build a Motion Deck into one self-contained HTML file.

Usage: python build.py [--lite] [--src deck.src.html] [--out Name]
Reads deck.src.html, inlines the fonts in fonts/, draws the {{i:name}} icons and inlines every file the page names
under assets/ (once, identical files shared). Writes index.html (reads assets/, for quick previews) and <Name>.html.
--lite reads assets_lite/ (media.py --lite) and writes <Name>_email.html, small enough to attach to an email.
A missing asset is reported and left empty, so a half-finished deck still builds.
"""
import base64, hashlib, json, re, sys
from pathlib import Path

HERE = Path(__file__).parent
args = sys.argv[1:]
LITE = "--lite" in args
def opt(name, default):
    return args[args.index(name) + 1] if name in args else default
SRC = HERE / opt("--src", "deck.src.html")
src = SRC.read_text(encoding="utf-8")
NAME = opt("--out", re.sub(r"\W+", "_", (re.search(r"<title>(.*?)</title>", src) or [None, "Deck"])[1]).strip("_") or "Deck")
A = HERE / ("assets_lite" if LITE else "assets")

# Fonts: (family, file in fonts/, style). Swap them for a brand's own WOFF2 files and update --sans/--serif.
FONTS = [("Inter Tight", "InterTight.woff2", "normal"), ("Instrument Serif", "InstrumentSerif.woff2", "normal"),
         ("Instrument Serif", "InstrumentSerif-Italic.woff2", "italic")]
if (HERE / "fonts" / "fonts.json").exists():   # written by palette.py --pptx / --fonts
    FONTS = [tuple(f) for f in json.loads((HERE / "fonts" / "fonts.json").read_text(encoding="utf-8"))]

# Line icons, 24px grid, drawn for this kit (currentColor strokes).
ICONS = {
    "user": '<circle cx="12" cy="8" r="4"/><path d="M4 21c1.5-4 4.5-6 8-6s6.5 2 8 6"/>',
    "users": '<circle cx="9" cy="8" r="3.5"/><path d="M2.5 20c1-3.5 3.5-5 6.5-5s5.5 1.5 6.5 5"/><circle cx="17" cy="9" r="2.5"/><path d="M17 14c2.5 0 4 1.5 4.5 4"/>',
    "route": '<circle cx="6" cy="19" r="2"/><circle cx="18" cy="5" r="2"/><path d="M8 19h7a3 3 0 0 0 0-6H9a3 3 0 0 1 0-6h7"/>',
    "dna": '<path d="M7 3c0 7 10 11 10 18M17 3c0 7-10 11-10 18M8.6 6.5h6.8M8.3 17.5h7.4M9.5 12h5"/>',
    "shirt": '<path d="M8 3 3 6l2 4 2-1v12h10V9l2 1 2-4-5-3c-.5 1.5-2 2.5-4 2.5S8.5 4.5 8 3z"/>',
    "flask": '<path d="M9 3h6M10 3v6l-5 9a2 2 0 0 0 1.8 3h10.4a2 2 0 0 0 1.8-3l-5-9V3M7.5 15h9"/>',
    "mail": '<rect x="3" y="5" width="18" height="14" rx="2"/><path d="m3 7 9 6 9-6"/>',
    "plug": '<path d="M9 2v5M15 2v5M6 7h12v4a6 6 0 0 1-12 0zM12 17v5"/>',
    "code": '<path d="m8 7-5 5 5 5M16 7l5 5-5 5M14 4l-4 16"/>',
    "linkedin": '<rect x="3" y="3" width="18" height="18" rx="3"/><path d="M8 10v7M8 7v.01M12 17v-4a2 2 0 0 1 4 0v4M12 10v7"/>',
    "instagram": '<rect x="3" y="3" width="18" height="18" rx="5"/><circle cx="12" cy="12" r="4"/><path d="M17.5 6.5v.01"/>',
    "play": '<path d="M7 4v16l13-8z"/>',
    "spark": '<path d="m12 3 2 5 5 2-5 2-2 5-2-5-5-2 5-2z"/>',
    "bolt": '<path d="M13 2 4 14h7l-1 8 9-12h-7z"/>',
    "layers": '<path d="m12 3 9 5-9 5-9-5zM3 13l9 5 9-5"/>',
    "cpu": '<rect x="6" y="6" width="12" height="12" rx="2"/><rect x="9.5" y="9.5" width="5" height="5"/><path d="M9 2v4M15 2v4M9 18v4M15 18v4M2 9h4M2 15h4M18 9h4M18 15h4"/>',
    "star": '<path d="m12 3 2.7 5.6 6.1.9-4.4 4.3 1 6.1L12 17l-5.4 2.9 1-6.1-4.4-4.3 6.1-.9z"/>',
    "arrow": '<path d="M7 17 17 7M8 7h9v9"/>',
    "eye": '<path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/>',
    "nodes": '<circle cx="5" cy="6" r="2"/><circle cx="19" cy="6" r="2"/><circle cx="12" cy="18" r="2"/><path d="M7 6h10M6 8l5 8M18 8l-5 8"/>',
    "film": '<rect x="3" y="4" width="18" height="16" rx="2"/><path d="M7 4v16M17 4v16M3 9h4M3 15h4M17 9h4M17 15h4"/>',
    "globe": '<circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3c3 3 3 15 0 18M12 3c-3 3-3 15 0 18"/>',
    "image": '<rect x="3" y="4" width="18" height="16" rx="2"/><circle cx="9" cy="10" r="2"/><path d="m21 16-5-5-9 9"/>',
    "target": '<circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="5"/><circle cx="12" cy="12" r="1"/>',
    "wand": '<path d="m4 20 11-11M14 4v3M12.5 5.5h3M19 9v3M17.5 10.5h3M18 3l1 1"/>',
    "grid": '<rect x="3" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="3" width="7" height="7" rx="1.5"/><rect x="3" y="14" width="7" height="7" rx="1.5"/><rect x="14" y="14" width="7" height="7" rx="1.5"/>',
    "pin": '<path d="M12 21s-7-6.5-7-12a7 7 0 0 1 14 0c0 5.5-7 12-7 12z"/><circle cx="12" cy="9" r="2.5"/>',
    "chart": '<path d="M4 20V10M10 20V4M16 20v-7M22 20H2"/>',
    "check": '<path d="m5 12 5 5 9-10"/>',
    "clock": '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
    "box": '<path d="m12 3 8 4.5v9L12 21l-8-4.5v-9z"/><path d="m4 7.5 8 4.5 8-4.5M12 12v9"/>',
    "chat": '<path d="M4 5h16v11H9l-5 4z"/>',
    "camera": '<path d="M4 8h3l2-3h6l2 3h3v11H4z"/><circle cx="12" cy="13" r="3.5"/>',
}
def icon(name):
    if name not in ICONS:
        raise SystemExit(f"unknown icon {{{{i:{name}}}}}; available: {', '.join(sorted(ICONS))}")
    return (f'<svg class="ic" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" '
            f'stroke-linejoin="round" aria-hidden="true">{ICONS[name]}</svg>')

fonts = []
for fam, fn, style in FONTS:
    f = HERE / "fonts" / fn
    if f.exists():
        fonts.append(f'@font-face{{font-family:"{fam}";font-style:{style};font-weight:100 900;font-display:swap;'
                     f'src:url(data:font/woff2;base64,{base64.b64encode(f.read_bytes()).decode()}) format("woff2")}}')
    else:
        print("missing font", f)
# The footer mark: wordmark.svg next to the deck (a client's or the agency's own logo, with class="wordmark"),
# or the deck title as text. The kit ships no logo.
wm = HERE / "wordmark.svg"
title = (re.search(r"<title>(.*?)</title>", src) or [None, ""])[1]
mark = wm.read_text(encoding="utf-8") if wm.exists() else f'<span class="wordmark wordmark-text">{title}</span>'
out = src.replace("__FONTS__", "\n".join(fonts)).replace("__WORDMARK__", mark)
out = re.sub(r"\{\{i:(\w+)\}\}", lambda m: icon(m.group(1)), out)
if not LITE:
    (HERE / "index.html").write_text(out, encoding="utf-8")

# One file to send: each asset inlined once and handed out by a small loader script.
MIME = {".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".png": "image/png", ".webp": "image/webp", ".gif": "image/gif",
        ".svg": "image/svg+xml", ".webm": "video/webm", ".mp4": "video/mp4", ".mp3": "audio/mpeg", ".m4a": "audio/mp4"}
names = sorted(set(re.findall(r'(?:src|poster)="assets/([^"]+)"', out)))
missing = [n for n in names if not (A / n).exists()]
for n in missing:
    print("missing asset", A / n)
by_hash, alias = {}, {}
for n in names:
    if n not in missing:
        alias[n] = by_hash.setdefault(hashlib.md5((A / n).read_bytes()).hexdigest(), n)
table = {n: f"data:{MIME.get(Path(n).suffix.lower(), 'application/octet-stream')};base64,{base64.b64encode((A / n).read_bytes()).decode()}"
         for n in set(alias.values())}
single = re.sub(r'(src|poster)="assets/([^"]+)"', lambda m: f'data-a-{m.group(1)}="{alias.get(m.group(2), "")}"', out)
loader = ("<script>(()=>{const A=" + json.dumps(table) + ";for(const k of ['poster','src'])"
          "document.querySelectorAll('[data-a-'+k+']').forEach(n=>{const v=A[n.getAttribute('data-a-'+k)];if(v)n.setAttribute(k,v);});})();</script>\n")
single = single.replace("<script>\n(() => {", loader + "<script>\n(() => {", 1)
dst = HERE / (f"{NAME}_email.html" if LITE else f"{NAME}.html")
dst.write_text(single, encoding="utf-8")
mb = len(single.encode("utf-8")) / 1e6
print(f"{dst.name}: {mb:.1f} MB, {len(re.findall(r'<section class=.slide', out))} slides, {len(table)} assets inlined"
      + (f", {len(missing)} missing" if missing else ""))
if LITE and mb > 15:
    print("over the email budget (~15 MB): shorten loops, lower film width or crf, or link the film instead")
