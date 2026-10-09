"""Face refinement pass for videos with real people: MiniMax H3 head inpainting (SAM3-tracked head mask).

Every clip that shows a real person (Aaron, Gian) goes through this before it is used in an edit: generated video
drifts away from the real face, and this pass puts the real face back while the plate (wardrobe, background, camera,
light) stays untouched. See docs/LEARNINGS.md and docs/case-studies/faceswap-refine.md.

Requires a local ComfyUI with MiniMax H3 and the h3 CLI scripts (D:/minimax documents the install). Override the
install with SS_COMFY_PORTABLE. Runs one job at a time (one GPU).

  python tools/faceswap_refine.py media/faceswap/jobs.json            # all jobs not done yet
  python tools/faceswap_refine.py media/faceswap/jobs.json --only gian_cypher04 --force

jobs.json: {"refs": {"aaron": "media/faceswap/refs/aaron_color.png", ...},
            "jobs": [{"id", "src", "out", "passes": [{"ref", "detect", "prompt", "denoise"?, "object"?}],
                      "start"?, "seconds"?}]}
A job with several passes feeds each pass with the previous result (one person per pass). The output keeps the
source resolution, frame rate and audio. References: one colour photo per person, background cut out
(the colorized refs are made from the real B&W portraits; a B&W reference turns the face grey).
"""
import argparse, json, os, shutil, subprocess, sys, time

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
PORTABLE = os.environ.get("SS_COMFY_PORTABLE", r"D:\ComfyUI_windows_portable_nvidia\ComfyUI_windows_portable")
PY = os.path.join(PORTABLE, "python_embeded", "python.exe")
H3 = os.path.join(PORTABLE, "h3")
WORK = os.path.join(ROOT, "media", "faceswap", "work")
FPS = 24


def run(cmd, log=None):
    print("  $", " ".join(cmd[:6]), "...", flush=True)
    with open(log, "a", encoding="utf-8") if log else open(os.devnull, "w") as fh:
        r = subprocess.run(cmd, stdout=fh, stderr=subprocess.STDOUT, cwd=H3)
    if r.returncode:
        sys.exit("failed (%d): %s  (log: %s)" % (r.returncode, cmd[1] if len(cmd) > 1 else cmd[0], log))


def probe(path, entries):
    out = subprocess.run(["ffprobe", "-v", "error", "-select_streams", "v:0", "-show_entries", entries, "-of", "csv=p=0", path],
                         capture_output=True, text=True).stdout.strip()
    return out.split(",")


def prep_ref(src, dst):
    """Background cut out (subject on white), as the MiniMax notes require."""
    if os.path.exists(dst):
        return dst
    code = ("from rembg import remove; from PIL import Image; im = Image.open(r'%s').convert('RGB'); "
            "fg = remove(im); bg = Image.new('RGB', fg.size, 'white'); bg.paste(fg, mask=fg.split()[3]); bg.save(r'%s')" % (src, dst))
    subprocess.run([PY, "-c", code], check=True)
    return dst


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("jobs")
    ap.add_argument("--only", nargs="*")
    ap.add_argument("--force", action="store_true")
    ap.add_argument("--seed", type=int, default=2)
    a = ap.parse_args()
    spec = json.load(open(a.jobs, encoding="utf-8"))
    os.makedirs(WORK, exist_ok=True)
    refs = {k: prep_ref(os.path.join(ROOT, v), os.path.join(WORK, "ref_%s_white.png" % k)) for k, v in spec["refs"].items()}
    for job in spec["jobs"]:
        if a.only and job["id"] not in a.only:
            continue
        out = os.path.join(ROOT, job["out"])
        if os.path.exists(out) and not a.force:
            print("skip (done):", job["id"]); continue
        print("job", job["id"], flush=True)
        t0 = time.time()
        log = os.path.join(WORK, job["id"] + ".log")
        src = os.path.join(ROOT, job["src"])
        w, h = probe(src, "stream=width,height")
        dur = float(subprocess.run(["ffprobe", "-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", src],
                                   capture_output=True, text=True).stdout)
        start = job.get("start", 0.0)
        span = min(job.get("seconds", dur - start), dur - start)
        # one generation holds 124 frames (5.17 s); longer clips run as two overlapping chunks, joined by a cross-fade
        chunks = [(start, min(span, 5.17))]
        if span > 5.2:
            chunks = [(start, 5.17), (start + span - 5.17, 5.17)]
        results = []
        for ci, (c0, secs) in enumerate(chunks):
            tag = "%s_c%d" % (job["id"], ci) if len(chunks) > 1 else job["id"]
            # 24 fps segment with an audio track (VHS_LoadVideo needs one)
            cur = os.path.join(WORK, tag + "_p0.mp4")
            subprocess.run(["ffmpeg", "-v", "error", "-y", "-ss", str(c0), "-t", str(secs), "-i", src, "-f", "lavfi",
                            "-i", "anullsrc=r=48000:cl=stereo", "-shortest", "-r", str(FPS), "-c:v", "libx264", "-crf", "12",
                            "-pix_fmt", "yuv420p", "-c:a", "aac", cur], check=True)
            for i, p in enumerate(job["passes"], 1):
                pf = os.path.join(WORK, "%s_p%d.txt" % (tag, i))
                open(pf, "w", encoding="utf-8").write(p["prompt"])
                nxt = os.path.join(WORK, "%s_p%d.mp4" % (tag, i))
                if os.path.exists(nxt) and not a.force:   # resume: keep finished passes
                    cur = nxt; continue
                cmd = [PY, "h3_swap.py", "--video", cur, "--detect", p["detect"], "-p", pf, "--img", refs[p["ref"]],
                       "--seconds", "%.3f" % secs, "--denoise", str(p.get("denoise", 0.9)), "--expand", str(p.get("expand", 25)),
                       "--feather", "20", "--det-thr", str(p.get("det_thr", 0.3)), "--steps", "8", "--seed", str(p.get("seed", a.seed)),
                       "--ref-size", "max", "-o", nxt]
                if "object" in p:
                    cmd += ["--object-indices", str(p["object"])]
                if "upscale_mp" in p:
                    cmd += ["--upscale-mp", str(p["upscale_mp"])]
                run(cmd, log)
                cur = nxt
            results.append(cur)
        if len(results) > 1:
            # cross-fade 0.5 s in the middle of the overlap
            b0 = span - 5.17                       # where chunk 2 starts in the clip
            off = (b0 + 5.17) / 2 - 0.25           # fade centred in the overlap
            cur = os.path.join(WORK, job["id"] + "_joined.mp4")
            # chunk 2 is trimmed so its first kept frame lines up with the fade start
            subprocess.run(["ffmpeg", "-v", "error", "-y", "-i", results[0], "-i", results[1], "-filter_complex",
                            "[0:v]settb=AVTB,fps=24[a];[1:v]trim=start=%.3f,setpts=PTS-STARTPTS,settb=AVTB,fps=24[b];"
                            "[a][b]xfade=transition=fade:duration=0.5:offset=%.3f,format=yuv420p" % (off - b0, off),
                            "-an", "-c:v", "libx264", "-crf", "12", cur], check=True)
        # back to the source size and frame rate, silent like the source clips
        sfps = probe(src, "stream=r_frame_rate")[0]
        os.makedirs(os.path.dirname(out), exist_ok=True)
        subprocess.run(["ffmpeg", "-v", "error", "-y", "-i", cur, "-vf", "scale=%s:%s:flags=lanczos,fps=%s" % (w, h, sfps), "-an",
                        "-c:v", "libx264", "-crf", "14", "-pix_fmt", "yuv420p", out], check=True)
        print("  done %s in %.1f min" % (job["out"], (time.time() - t0) / 60), flush=True)


if __name__ == "__main__":
    main()
