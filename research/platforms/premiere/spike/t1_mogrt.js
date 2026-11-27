// T1: three test sequences (23.976 / 25 / 29.97), a stock "Basic Title" MOGRT in each, and a dump of every
// component and parameter of the inserted item (names, keyframe support, start value type).
const major = parseInt(uxp.host.version, 10);            // 26 -> "2026", 27 -> "2027"
const APP = "C:/Program Files/Adobe/Adobe Premiere Pro 20" + major + "/";
const PRESETS = APP + "Settings/SequencePresets/HD 1080p/";
const MOGRT = APP + "Essential Graphics/Basic Title.mogrt";
const PROJ = "D:/motion category ai library - premiere/research/platforms/premiere/spike/_projects/spike_" + major + ".prproj";
let p = await ppro.Project.getActiveProject();
if (!p) p = await ppro.Project.createProject(PROJ);
const out = [];
for (const fps of ["23.976", "25", "29.97"]) {
  const name = "MDNA spike " + fps;
  let seq = null;
  for (const s of await p.getSequences()) if (s.name === name) seq = s;
  if (!seq) {
    // createSequenceWithPresetPath answers "Preset file is invalid" / "Path does not exist" for the stock .sqpreset
    // files on 26.5, so: default sequence, then set the frame rate through its settings.
    seq = await p.createSequence(name);
    const st = await seq.getSettings();
    await st.setVideoFrameRate(ppro.FrameRate.createWithValue({ "23.976": 24000 / 1001, "25": 25, "29.97": 30000 / 1001 }[fps]));
    p.lockedAccess(() => p.executeTransaction((ca) => ca.addAction(seq.createSetSettingsAction(st)), "MDNA frame rate"));
  }
  await p.openSequence(seq);
  const ed = ppro.SequenceEditor.getEditor(seq);
  const track = await seq.getVideoTrack(0);
  let items = await track.getTrackItems(ppro.Constants.TrackItemType.CLIP, false);
  if (!items.length) {
    p.lockedAccess(() => { ed.insertMogrtFromPath(MOGRT, ppro.TickTime.createWithSeconds(0), 0, 0); });
    items = await track.getTrackItems(ppro.Constants.TrackItemType.CLIP, false);
  }
  const it = items[0];
  const chain = await it.getComponentChain();
  const comps = [];
  for (let c = 0; c < chain.getComponentCount(); c++) {
    const comp = chain.getComponentAtIndex(c);
    const params = [];
    for (let i = 0; i < comp.getParamCount(); i++) {
      const prm = comp.getParam(i);
      let start = null, kf = null;
      try { kf = await prm.areKeyframesSupported(); } catch (e) { kf = "err"; }
      try { const v = await prm.getStartValue(); start = v && (v.constructor && v.constructor.name) + " " + JSON.stringify(v.value !== undefined ? v.value : v); } catch (e) { start = "err " + e; }
      params.push({ i, name: prm.displayName, kf, start });
    }
    comps.push({ c, name: await comp.getDisplayName(), match: await comp.getMatchName(), params });
  }
  const fr = await (await seq.getSettings()).getVideoFrameRate();
  out.push({ fps, seq: seq.name, frameRate: fr && fr.value, timebase: await seq.getTimebase(), items: items.length, comps });
}
return out;
