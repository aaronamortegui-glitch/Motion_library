"""Makes Blender-safe copies of the token fonts: Inter Tight's glyphs are drawn with overlapping contours, which
Blender fills with holes, so the overlaps are merged (fontTools removeOverlaps, needs skia-pathops). The copies are made
on each machine into blender/fonts/ (git-ignored); the repo keeps the original OFL files untouched.
Usage: python research/platforms/blender/fix_fonts.py      (install.py runs it; needs: pip install skia-pathops)
"""
import pathlib
import sys

HERE = pathlib.Path(__file__).resolve().parent
ROOT = HERE.parents[2]
OUT = HERE / "fonts"


def main():
    try:
        from fontTools.ttLib import TTFont
        from fontTools.ttLib.removeOverlaps import removeOverlaps
    except ImportError:
        print("fontTools / skia-pathops missing: pip install fonttools skia-pathops"); return 1
    OUT.mkdir(exist_ok=True)
    src = sorted((ROOT / "assets/fonts/static").glob("*.ttf")) + sorted((ROOT / "assets/fonts").glob("InstrumentSerif-*.ttf"))
    for f in src:
        dst = OUT / f.name
        if dst.exists() and dst.stat().st_mtime >= f.stat().st_mtime:
            continue
        font = TTFont(str(f))
        if "glyf" in font:
            removeOverlaps(font)
        font.save(str(dst))
        print(f"blender-safe {dst.name}")
    print(f"{len(src)} fonts in {OUT}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
