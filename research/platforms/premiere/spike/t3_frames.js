// T3: export still frames so Claude can look at them. On Windows the folder must use backslashes: with forward
// slashes exportSequenceFrame returns false and writes nothing (26.5.2).
const A = (typeof ARGS !== "undefined") ? ARGS : { seq: "MDNA spike 25", frames: [0, 2, 4, 8, 12], fps: 25 };
const p = await ppro.Project.getActiveProject();
const seq = (await p.getSequences()).find((s) => s.name === A.seq);
await p.openSequence(seq);
const dir = "D:/motion category ai library - premiere/research/platforms/premiere/spike/_projects/frames/".split("/").join("\\");
const out = [];
for (const f of A.frames) {
  const t0 = Date.now();
  const name = "f" + A.fps + "_" + String(f).padStart(2, "0") + ".png";
  const ok = await ppro.Exporter.exportSequenceFrame(seq, ppro.TickTime.createWithSeconds(f / A.fps), name, dir, 960, 540);
  out.push({ f, name, ok, ms: Date.now() - t0 });
}
return out;
