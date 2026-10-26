"""WebM previews (VP9, 640 px, no sound) next to every rendered MP4: far lighter than the GIFs and true to the photos,
for the visualizer and the downloadable library. GIFs stay for GitHub (the README cannot play WebM), PNG stills for the
panel (ScriptUI cannot play video).

  library/mp4/<kind>/<slug>.mp4  ->  library/webm/<kind>/<slug>.webm
  library/packs/<slug>.mp4       ->  library/packs/<slug>.webm
  kit pieces also get library/posters/kit-<kind>/<slug>.jpg, a frame mid-animation (the guide's still)
Usage: python tools/make_webm.py [--force]      (only missing or older WebMs are made unless --force)
"""
import pathlib, subprocess, sys

ROOT = pathlib.Path(__file__).resolve().parent.parent


def jobs():
    for mp4 in sorted((ROOT / "library/mp4").glob("*/*.mp4")):
        yield mp4, ROOT / "library/webm" / mp4.parent.name / (mp4.stem + ".webm")
    for mp4 in sorted((ROOT / "library/packs").glob("*.mp4")):
        yield mp4, mp4.with_suffix(".webm")


def main():
    force, n, size = "--force" in sys.argv, 0, 0
    for src, out in jobs():
        if not force and out.exists() and out.stat().st_mtime >= src.stat().st_mtime:
            continue
        out.parent.mkdir(parents=True, exist_ok=True)
        subprocess.run(["ffmpeg", "-v", "error", "-y", "-i", str(src), "-vf", "scale=640:-2:flags=lanczos", "-c:v", "libvpx-vp9", "-b:v", "0",
                        "-crf", "36", "-row-mt", "1", "-deadline", "good", "-an", str(out)], check=True)
        n += 1; size += out.stat().st_size
        if src.parent.name.startswith("kit-"):   # a poster mid-animation (a transition shows both scenes), for the library guide
            poster = ROOT / "library/posters" / src.parent.name / (src.stem + ".jpg"); poster.parent.mkdir(parents=True, exist_ok=True)
            subprocess.run(["ffmpeg", "-v", "error", "-y", "-ss", "1.42" if src.parent.name == "kit-transition" else "1.3", "-i", str(src),
                            "-frames:v", "1", "-vf", "scale=480:-2", "-q:v", "4", str(poster)], check=True)
    print(f"webm: {n} made, {size // 1024} KB")


if __name__ == "__main__":
    main()
