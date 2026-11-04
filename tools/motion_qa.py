"""Motion QA on a rendered video or GIF: the faults a still frame cannot show.

  jumps   a region that is still, moves in ONE frame, then is still again (a pop, a missing tween, a wrong key)
  holds   the whole frame frozen for longer than --hold s (our rule: a hold is never static; something keeps drifting)
  seam    for loops: the last frame against the first, compared with an ordinary step between frames
  poster  the frame that tells the story: settled (no change mid-way) and full of detail, never caught mid-change

Rebuilt in our own code from ideas in Stageshow (github.com/benjitaylor/skills, MIT, ccb6a38): its jump detector, loop
check and poster frame. Only ffmpeg and numpy.

Usage: python tools/motion_qa.py <video or gif> [--loop] [--hold 3] [--json]
"""
import argparse
import json
import subprocess
import sys

import numpy as np

W = 192   # analysis width: big enough for a UI element, small enough to be quick


def frames(path):
    probe = subprocess.run(["ffprobe", "-v", "error", "-select_streams", "v:0", "-show_entries", "stream=width,height,r_frame_rate",
                            "-of", "json", str(path)], capture_output=True, text=True, check=True)
    s = json.loads(probe.stdout)["streams"][0]
    num, den = (int(x) for x in s["r_frame_rate"].split("/"))
    fps = num / den if den else 24.0
    h = max(2, round(s["height"] * W / s["width"] / 2) * 2)
    raw = subprocess.run(["ffmpeg", "-v", "error", "-i", str(path), "-vf", f"scale={W}:{h}:flags=area,format=gray", "-f", "rawvideo", "-"],
                         capture_output=True, check=True).stdout
    return np.frombuffer(raw, np.uint8).reshape(-1, h, W).astype(np.float32) / 255, fps


def blocks(d, b=12):
    """Mean change per b x b block of a frame difference."""
    h, w = d.shape[0] // b * b, d.shape[1] // b * b
    return d[:h, :w].reshape(h // b, b, w // b, b).mean(axis=(1, 3))


def analyse(path, loop=False, hold=3.0, still=0.004, moved=0.06):
    F, fps = frames(path)
    n = len(F)
    if n < 4: return {"file": str(path), "frames": n, "error": "too few frames"}
    D = [blocks(np.abs(F[i + 1] - F[i])) for i in range(n - 1)]   # D[i]: change from frame i to i+1
    out = {"file": str(path), "frames": n, "fps": round(fps, 3), "seconds": round(n / fps, 2), "jumps": [], "holds": [], "seam": None, "poster": None}
    # jumps: a block still before and after, with one big change between
    k = max(3, round(fps * 0.15))   # still for ~0.15 s on both sides: animation on twos (a pose held 2 frames) is not a jump
    for i in range(k, n - 1 - k):
        before, after = np.max(D[i - k:i], axis=0), np.max(D[i + 1:i + 1 + k], axis=0)
        hit = (D[i] > moved) & (before < still) & (after < still)
        if hit.sum() >= 2:   # one block alone is grain or a blink of a pixel
            ys, xs = np.nonzero(hit)
            out["jumps"].append({"t": round((i + 1) / fps, 3), "frame": i + 1, "blocks": int(hit.sum()),
                                 "where": [round(float(xs.mean() + 0.5) / D[i].shape[1], 2), round(float(ys.mean() + 0.5) / D[i].shape[0], 2)]})
    # holds: the whole frame frozen
    total = np.array([d.mean() for d in D])
    run = 0
    for i, v in enumerate(list(total) + [1]):
        if v < still * 0.25: run += 1; continue
        if run / fps >= hold: out["holds"].append({"from": round((i - run) / fps, 2), "to": round(i / fps, 2)})
        run = 0
    # seam: last → first, against the median step
    step = float(np.median(total)) or 1e-6
    if loop:
        s = float(np.abs(F[0] - F[-1]).mean())
        out["seam"] = {"last_to_first": round(s, 4), "median_step": round(step, 4), "ratio": round(s / step, 1), "ok": s <= 3 * step + 0.002}
    # poster: settled (little change on both sides) and detailed (edges), away from the first and last 10%
    lo, hi = max(1, int(n * 0.1)), min(n - 2, int(n * 0.9))
    best, bi = -1, lo
    for i in range(lo, hi):
        calm = 1 - min(1, (total[i - 1] + total[i]) / (2 * step * 4))
        g = F[i]; detail = float(np.abs(np.diff(g, axis=1)).mean() + np.abs(np.diff(g, axis=0)).mean())
        sc = calm * detail
        if sc > best: best, bi = sc, i
    out["poster"] = {"t": round(bi / fps, 2), "frame": bi}
    return out


def main():
    a = argparse.ArgumentParser(); a.add_argument("src"); a.add_argument("--loop", action="store_true", help="also check the loop seam")
    a.add_argument("--hold", type=float, default=3.0, help="longest frozen stretch allowed, in seconds"); a.add_argument("--json", action="store_true")
    o = a.parse_args()
    r = analyse(o.src, o.loop, o.hold)
    if o.json: print(json.dumps(r, indent=1)); return
    if "error" in r: print(r["error"]); sys.exit(1)
    print(f"{r['file']}: {r['frames']} frames, {r['fps']} fps, {r['seconds']} s")
    for j in r["jumps"]: print(f"  JUMP   {j['t']:6.2f} s  frame {j['frame']}  ({j['blocks']} blocks at x {j['where'][0]}, y {j['where'][1]}): still, one-frame move, still")
    for h in r["holds"]: print(f"  HOLD   {h['from']:6.2f}-{h['to']:.2f} s  the whole frame is frozen (keep something drifting)")
    if r["seam"]: print(f"  SEAM   last-to-first is {r['seam']['ratio']}x a normal step: " + ("ok" if r["seam"]["ok"] else "the loop visibly jumps"))
    print(f"  POSTER {r['poster']['t']} s (frame {r['poster']['frame']}): the calmest, most detailed frame")
    if not r["jumps"] and not r["holds"] and (not r["seam"] or r["seam"]["ok"]): print("  OK no jumps, no frozen holds" + (", the loop closes" if r["seam"] else ""))


if __name__ == "__main__":
    main()
