// T4: import a still, overwrite it onto V2 of the 25 fps sequence at 0 s, then export frames (does the export render?)
const p = await ppro.Project.getActiveProject();
const seq = (await p.getSequences()).find((s) => s.name === "MDNA spike 25");
await p.openSequence(seq);
// importFiles needs forward slashes (backslashes are dropped: "D:motion ..."); exportSequenceFrame needs backslashes
const file = "D:/motion category ai library - premiere/research/platforms/premiere/spike/_projects/test_card.png";
const root = await p.getRootItem();
let item = (await root.getItems()).find((i) => i.name === "test_card.png");
let imported = null;
if (!item) { imported = await p.importFiles([file], true, root, false); item = (await root.getItems()).find((i) => i.name === "test_card.png"); }
const v2 = await seq.getVideoTrack(1);
if (!(await v2.getTrackItems(1, false)).length) {
  const ed = ppro.SequenceEditor.getEditor(seq);
  p.lockedAccess(() => p.executeTransaction((ca) => ca.addAction(ed.createOverwriteItemAction(ppro.ClipProjectItem.cast(item), ppro.TickTime.createWithSeconds(0), 1, 0)), "MDNA place card"));
}
const clips = await v2.getTrackItems(1, false);
const dir = "D:\motion category ai library - premiere\research\platforms\premiere\spike\_projects\frames\\";
const ok = await ppro.Exporter.exportSequenceFrame(seq, ppro.TickTime.createWithSeconds(1), "card_1s.png", dir, 960, 540);
return { imported, item: item && item.name, v2: clips.length, inPoint: clips[0] && (await clips[0].getInPoint()).seconds, ok };
