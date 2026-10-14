"""Downloads the free (CC0) asset packs listed in library/resources.json (entries with a "fetch" block) into
assets.free/<folder>/ (git-ignored), unpacks them, converts OGG to WAV (AE does not import OGG) and writes a
LICENSE.txt per pack. Then run python tools/index_assets.py so Claude can find them (list_assets / add_asset).

Usage:  python tools/fetch_free_assets.py --list            what would be downloaded
        python tools/fetch_free_assets.py [--only unity-vfx kenney-audio …] [--keep-zips]
Only download with the user's approval (CLAUDE.md). Already unpacked packs are skipped.
"""
import argparse
import json
import pathlib
import shutil
import subprocess
import sys
import urllib.parse
import urllib.request
import zipfile

ROOT = pathlib.Path(__file__).resolve().parent.parent
DEST = ROOT / "assets.free"


def packs():
    data = json.loads((ROOT / "library/resources.json").read_text(encoding="utf-8"))
    return [(r, r["fetch"]) for r in data["resources"] if r.get("fetch")]


def download(url, to):
    req = urllib.request.Request(url, headers={"User-Agent": "Motion DNA asset fetcher"})
    with urllib.request.urlopen(req, timeout=120) as r, open(to, "wb") as f:
        shutil.copyfileobj(r, f)


def ogg_to_wav(folder):
    n = 0
    for f in folder.rglob("*.ogg"):
        wav = f.with_suffix(".wav")
        if not wav.exists():
            subprocess.run(["ffmpeg", "-v", "error", "-y", "-i", str(f), str(wav)], check=True)
        f.unlink(); n += 1
    return n


def tga_to_png(folder):
    """Uncompressed TGA sequences are ~6x larger than PNG; PNG keeps the alpha and AE imports it the same way."""
    try:
        from PIL import Image
    except ImportError:
        print("  (Pillow missing: TGA frames kept)"); return 0
    n = 0
    for f in folder.rglob("*.tga"):
        Image.open(f).save(f.with_suffix(".png"), optimize=False, compress_level=6)
        f.unlink(); n += 1
    return n


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--only", nargs="*")
    ap.add_argument("--list", action="store_true")
    ap.add_argument("--keep-zips", action="store_true")
    a = ap.parse_args()
    for r, fx in packs():
        if a.only and fx["folder"] not in a.only:
            continue
        print(f'{fx["folder"]}: {r["name"]} · {fx["license"]} · {len(fx["files"])} file(s)')
        if a.list:
            continue
        out = DEST / fx["folder"]; out.mkdir(parents=True, exist_ok=True)
        for url in fx["files"]:
            name = url.rsplit("/", 1)[-1]
            stem = name[:-4]
            target = out / stem.replace("-sequence-tga", "")
            if target.exists() and any(target.iterdir()):
                continue
            if not name.lower().endswith(".zip"):   # a single audio/image file: keep it as is (OGG becomes WAV below)
                single = out / urllib.parse.unquote(name)
                if not single.exists() and not single.with_suffix(".wav").exists():
                    print("  ↓", single.name); download(url, single)
                continue
            z = out / name
            if not z.exists():
                print("  ↓", name); download(url, z)
            with zipfile.ZipFile(z) as zf:
                zf.extractall(target)
            if not a.keep_zips:
                z.unlink()
        n = ogg_to_wav(out)
        if n:
            print(f"  {n} OGG converted to WAV")
        n = tga_to_png(out)
        if n:
            print(f"  {n} TGA frames converted to PNG")
        (out / "LICENSE.txt").write_text(f'{r["name"]}\nLicense: {fx["license"]}\nSource: {fx["source"]}\n'
                                         f'Downloaded by tools/fetch_free_assets.py from library/resources.json.\n', encoding="utf-8")
    if not a.list:
        print("Done. Next: python tools/index_assets.py")


if __name__ == "__main__":
    sys.exit(main())
