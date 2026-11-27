#!/usr/bin/env python3
"""T2: Motion DNA curves in Premiere, measured.

On the MOGRT clip of each spike sequence (23.976 / 25 / 29.97) it animates Motion > Position x from off-screen to the
centre over the token "Arrive" duration on the token curve "Land", two ways:
  baked  - one Linear keyframe per frame, value read from the token bezier (what the plan proposes)
  simple - two keyframes with Premiere's own Bezier interpolation (what an editor gets by hand / the API alone)
Then it reads the value back at every frame and half frame and reports the error against the token curve, in pixels
of a 1920-wide frame.

Usage: python spike/t2_bake.py [--target 26|27] [--curve Land] [--mode baked|simple|both] [--track 1|2]
"""
import json
import pathlib
import sys

sys.path.insert(0, str(pathlib.Path(__file__).resolve().parent.parent))
import ppro  # noqa: E402

ROOT = pathlib.Path(__file__).resolve().parents[4]
TOK = json.loads((ROOT / "tokens" / "superside_motion_tokens.json").read_text(encoding="utf-8"))


def bezier_y(x1, y1, x2, y2, x):
    """y on a CSS cubic-bezier for progress x (solve x(t) by bisection)."""
    lo, hi = 0.0, 1.0
    for _ in range(60):
        t = (lo + hi) / 2
        xt = 3 * (1 - t) ** 2 * t * x1 + 3 * (1 - t) * t ** 2 * x2 + t ** 3
        lo, hi = (t, hi) if xt < x else (lo, t)
    t = (lo + hi) / 2
    return 3 * (1 - t) ** 2 * t * y1 + 3 * (1 - t) * t ** 2 * y2 + t ** 3


JS = r"""
const A = __ARGS__;
const p = await ppro.Project.getActiveProject();
const report = [];
for (const fps of A.fpsList) {
  const seq = (await p.getSequences()).find((s) => s.name === "MDNA spike " + fps);
  if (!seq) { report.push({ fps, error: "no sequence" }); continue; }
  await p.openSequence(seq);
  const fr = await (await seq.getSettings()).getVideoFrameRate();
  const rate = fr.value;
  const item = (await (await seq.getVideoTrack(A.track)).getTrackItems(ppro.Constants.TrackItemType.CLIP, false))[0];
  if (!item) { report.push({ fps, error: "no clip on V" + (A.track + 1) }); continue; }
  const chain = await item.getComponentChain();
  let motion = null;
  for (let c = 0; c < chain.getComponentCount(); c++) { const k = chain.getComponentAtIndex(c); if ((await k.getMatchName()) === "AE.ADBE Motion") motion = k; }
  const pos = motion.getParam(0);
  const frames = Math.round(A.seconds * rate);
  // keyframe times are in the clip's own time, which starts at its in-point (a MOGRT starts at 01:00:00:00 = 3600 s)
  const inS = (await item.getInPoint()).seconds;
  const at = (f) => ppro.TickTime.createWithSeconds(inS + f / rate);
  const res = { fps, rate, frames, inPoint: inS, modes: {} };
  for (const mode of A.modes) {
    const t0 = Date.now();
    // clear: switch time-varying off (drops keys), then on
    p.lockedAccess(() => p.executeTransaction((ca) => { ca.addAction(pos.createSetTimeVaryingAction(false)); }, "MDNA clear"));
    p.lockedAccess(() => p.executeTransaction((ca) => { ca.addAction(pos.createSetTimeVaryingAction(true)); }, "MDNA tv"));
    const keys = mode === "baked" ? A.values.map((v, i) => [i, v]) : [[0, A.values[0]], [frames, A.values[A.values.length - 1]]];
    // the token curve is defined over `frames` frames at this rate: resample the progress table
    const val = (f) => { const u = f / frames; const n = A.values.length - 1; const k = u * n; const i = Math.min(Math.floor(k), n - 1); return A.values[i] + (A.values[i + 1] - A.values[i]) * (k - i); };
    const list = mode === "baked" ? Array.from({ length: frames + 1 }, (_, f) => [f, val(f)]) : keys.map(([f, v]) => [f === 0 ? 0 : frames, v]);
    p.lockedAccess(() => p.executeTransaction((ca) => {
      for (const [f, x] of list) {
        const kf = pos.createKeyframe(new ppro.PointF(x, 0.5));
        kf.position = at(f);
        ca.addAction(pos.createAddKeyframeAction(kf));
      }
    }, "MDNA keys " + mode));
    const interp = mode === "baked" ? ppro.Constants.InterpolationMode.LINEAR : ppro.Constants.InterpolationMode.BEZIER;
    p.lockedAccess(() => p.executeTransaction((ca) => {
      for (const [f] of list) ca.addAction(pos.createSetInterpolationAtKeyframeAction(at(f), interp, false));
    }, "MDNA interp " + mode));
    const writeMs = Date.now() - t0;
    const nKeys = pos.getKeyframeListAsTickTimes().length;
    let maxErr = 0, worst = null; const samples = [];
    for (let h = 0; h <= frames * 2; h++) {
      const f = h / 2;
      const got = (await pos.getValueAtTime(at(f))).value[0];
      const want = val(f);
      const err = Math.abs(got - want) * 1920;
      samples.push([f, +got.toFixed(5), +want.toFixed(5)]);
      if (err > maxErr) { maxErr = err; worst = f; }
    }
    res.modes[mode] = { keys: nKeys, writeMs, maxErrPx: +maxErr.toFixed(2), worstFrame: worst, samples };
  }
  report.push(res);
}
return report;
"""


def main():
    a = sys.argv[1:]
    opt = lambda k, d: a[a.index(k) + 1] if k in a else d  # noqa: E731
    target, curve, mode = opt("--target", None), opt("--curve", "Land"), opt("--mode", "both")
    track = int(opt("--track", "1")) - 1   # V1 = MOGRT, V2 = the test card
    ez = next(e for e in TOK["easings"] if e["name"].lower() == curve.lower())
    dur = next(d for d in TOK["durations"] if d["name"] == "Arrive")
    x0, x1 = -0.3, 0.5
    steps = 400   # a fine progress table; the plugin resamples it at each sequence's frame rate
    values = [x0 + (x1 - x0) * bezier_y(*ez["bezier"], i / steps) for i in range(steps + 1)]
    args = {"fpsList": ["23.976", "25", "29.97"], "seconds": dur["ms"] / 1000, "values": values,
            "modes": ["baked", "simple"] if mode == "both" else [mode], "track": track}
    r = ppro.run(JS.replace("__ARGS__", json.dumps(args)), 300, target)
    out = pathlib.Path(__file__).parent / "_projects" / f"t2_{curve.lower()}_{r.get('premiere')}.json"
    out.write_text(json.dumps(r, indent=1), encoding="utf-8")
    if not r.get("ok"):
        print("error:", r.get("error")); return
    print(f"Premiere {r['premiere']}  curve {curve} {ez['bezier']}  {dur['name']} {dur['ms']} ms  -> {out.name}")
    for s in r["result"]:
        if "error" in s:
            print(s); continue
        line = "  ".join(f"{m}: {v['keys']} keys, max error {v['maxErrPx']} px (frame {v['worstFrame']}), {v['writeMs']} ms"
                         for m, v in s["modes"].items())
        print(f"  {s['fps']:>6} fps ({s['frames']} frames)  {line}")


if __name__ == "__main__":
    main()
