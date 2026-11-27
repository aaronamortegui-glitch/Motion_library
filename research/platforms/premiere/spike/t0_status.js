// T0: what Premiere, project and sequence the plugin sees.
const p = await ppro.Project.getActiveProject();
if (!p) return { host: uxp.host.version, project: null };
const s = await p.getActiveSequence();
let seq = null;
if (s) {
  const tb = await s.getTimebase();
  seq = { name: s.name, timebase: tb, videoTracks: await s.getVideoTrackCount(), frame: await s.getFrameSize() };
}
return { host: uxp.host.name + " " + uxp.host.version, project: p.name, path: p.path, sequence: seq };
