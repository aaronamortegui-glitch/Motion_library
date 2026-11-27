// T5: an After Effects-authored Motion DNA MOGRT in Premiere: insert it on V3 of the 25 fps sequence and list its controls
const p = await ppro.Project.getActiveProject();
const seq = (await p.getSequences()).find((s) => s.name === "MDNA spike 25");
await p.openSequence(seq);
const MOGRT = "D:/motion category ai library - premiere/research/platforms/premiere/spike/_projects/mdna_title_spike.mogrt/MDNA Title (spike).mogrt";
while ((await seq.getVideoTrackCount()) < 3) break;
const v3 = await seq.getVideoTrack(2);
let items = v3 ? await v3.getTrackItems(1, false) : [];
let inserted = null;
if (!items.length) {
  p.lockedAccess(() => { inserted = ppro.SequenceEditor.getEditor(seq).insertMogrtFromPath(MOGRT, ppro.TickTime.createWithSeconds(0), 2, 0); });
  items = await (await seq.getVideoTrack(2)).getTrackItems(1, false);
}
const it = items[0];
const chain = await it.getComponentChain();
const comps = [];
for (let c = 0; c < chain.getComponentCount(); c++) {
  const comp = chain.getComponentAtIndex(c);
  const params = [];
  for (let i = 0; i < comp.getParamCount(); i++) {
    const prm = comp.getParam(i);
    let start; try { const v = await prm.getStartValue(); start = (v && v.constructor && v.constructor.name) + " " + JSON.stringify(v && v.value !== undefined ? v.value : v); } catch (e) { start = "err " + e.message; }
    let txt = null; try { const v = await prm.getStartValue(); if (v && v.getText) txt = await v.getText(); } catch (e) {}
    params.push({ i, name: prm.displayName, start, txt });
  }
  comps.push({ c, name: await comp.getDisplayName(), match: await comp.getMatchName(), params });
}
return { inserted: inserted && inserted.length, name: await it.getName(), comps };
