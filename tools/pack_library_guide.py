"""Packs the library guide to share with people who do not have the repo: library/guide.html plus every file it
plays or shows (previews, posters, sounds, fonts), kept in the repo's folder layout, and an "Open me.html" at the top
that opens the guide. guide.html alone opens with empty cards: its previews live next to it in library/.

Usage: python tools/pack_library_guide.py [out.zip]            (default: dist/Motion_DNA_Library.zip, git-ignored)
       python tools/pack_library_guide.py --single [out.html]  (one file, every preview inside: dist/Motion_DNA_Library.html)
"""
import os
import re
import sys
import zipfile

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
GUIDE = os.path.join(ROOT, "library", "guide.html")
EXT = "webm|png|jpg|jpeg|gif|webp|ogg|wav|mp3|mp4|glb|json|woff2?|ttf|otf|svg|css|js"
OPEN_ME = ('<!doctype html><meta charset="utf-8"><title>Motion DNA Library</title>'
           '<meta http-equiv="refresh" content="0; url=library/guide.html"><a href="library/guide.html">Open the library</a>')


def assets():
    """Every relative file the guide references, as repo-relative paths (missing ones are names, not files)."""
    s = open(GUIDE, encoding="utf-8").read(); out, missing = set(), []
    for ref in set(re.findall(rf'["\'(]((?:\.\./|\./)?[A-Za-z0-9_\-./ %\[\]]+\.(?:{EXT}))["\')]', s)):
        p = os.path.normpath(os.path.join(ROOT, "library", ref))
        if os.path.isfile(p) and p.startswith(ROOT): out.add(os.path.relpath(p, ROOT))
        else: missing.append(ref)
    return sorted(out), missing


MIME = {"webm": "video/webm", "png": "image/png", "jpg": "image/jpeg", "jpeg": "image/jpeg", "gif": "image/gif",
        "webp": "image/webp", "ogg": "audio/ogg", "ttf": "font/ttf", "otf": "font/otf", "woff2": "font/woff2",
        "svg": "image/svg+xml", "mp4": "video/mp4", "wav": "audio/wav", "mp3": "audio/mpeg"}


def single(dst):
    """One HTML file with every preview inside it as a data URI, to send on its own (Slack, Drive). Cards that play a
    video drop their poster (the video's first frame shows instead), which keeps the file a third smaller."""
    import base64
    s = open(GUIDE, encoding="utf-8").read()
    s = re.sub(r'("video": "[^"]+", )"poster": "[^"]+"', r'\1"poster": ""', s)
    cache = {}
    def data(m):
        ref = m.group(2); p = os.path.normpath(os.path.join(ROOT, "library", ref)); ext = ref.rsplit(".", 1)[1].lower()
        if ext not in MIME or not os.path.isfile(p): return m.group(0)
        if p not in cache: cache[p] = f"data:{MIME[ext]};base64," + base64.b64encode(open(p, "rb").read()).decode()
        return m.group(1) + cache[p] + m.group(3)
    s = re.sub(rf'(["\'(])((?:\.\./|\./)?[A-Za-z0-9_\-./ %\[\]]+\.(?:{EXT}))(["\')])', data, s)
    s = s.replace("it.video.endsWith('.webm')", "/(\\.webm$|^data:video\\/webm)/.test(it.video)")   # data URIs have no extension
    open(dst, "w", encoding="utf-8").write(s)
    print(f"{len(cache)} files inside, {os.path.getsize(dst) / 1e6:.1f} MB -> {dst}")


def main():
    if "--single" in sys.argv:
        args = [a for a in sys.argv[1:] if a != "--single"]
        dst = args[0] if args else os.path.join(ROOT, "dist", "Motion_DNA_Library.html")
        os.makedirs(os.path.dirname(os.path.abspath(dst)), exist_ok=True); return single(dst)
    dst = sys.argv[1] if len(sys.argv) > 1 else os.path.join(ROOT, "dist", "Motion_DNA_Library.zip")
    os.makedirs(os.path.dirname(os.path.abspath(dst)), exist_ok=True)
    files, missing = assets()
    with zipfile.ZipFile(dst, "w", zipfile.ZIP_STORED) as z:   # the media are already compressed
        z.writestr("Motion DNA Library/Open me.html", OPEN_ME)
        z.write(GUIDE, "Motion DNA Library/library/guide.html")
        for f in files: z.write(os.path.join(ROOT, f), "Motion DNA Library/" + f.replace(os.sep, "/"))
    print(f"{len(files)} files, {os.path.getsize(dst) / 1e6:.1f} MB -> {dst}")
    if missing: print("not files (labels in the text):", ", ".join(sorted(missing)))


if __name__ == "__main__":
    main()
