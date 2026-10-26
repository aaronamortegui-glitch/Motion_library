// Motion DNA sound kit: sound effects made in code for After Effects comps (MCP add_sound) and code-rendered videos.
// Built on Tone.js 15.1.22 (MIT, tools/sound/tone-15.1.22). Every sound is synthesised, so it is ours to ship: no
// samples, no third-party packs.
//
// A sound track is data:   { duration, cues: [{ t, sfx, dur, gain, pitch, pan }], bed: { bpm, bars, mood, gain } }
//   t     the moment the sound LANDS, in seconds. Whooshes and risers peak on t (they start before it), so a cue
//         written on a cut or a hit sounds on that frame.
//   sfx   a name from KIT below. dur scales the long ones (whoosh, riser, type). gain in dB (0 = kit level),
//         pitch in semitones, pan -1..1. take 0, 1, 2... gives a slightly different take of the same sound, so a
//         repeated sound never repeats exactly (the same whoosh on every cut is the first thing that reads as a template).
//   bed   an optional music bed under the cues: bpm and mood ("pulse" | "ambient" | "tick"); bars default to fill.
// MDNA_AUDIO.render(track) renders it offline (faster than real time, same samples every run) and returns
// { sr, ch: [Float32Array left, Float32Array right] }. tools/sound_kit.py writes that to WAV and muxes it with a render.
(function () {
  const T = window.Tone;
  const db = v => T.dbToGain(v || 0);
  const NOTE = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };
  const hz = (n, st = 0) => { const m = /^([A-G])(#?)(\d)$/.exec(n); const midi = 12 * (+m[3] + 1) + NOTE[m[1]] + (m[2] ? 1 : 0) + st; return 440 * Math.pow(2, (midi - 69) / 12); };

  // seeded random while a track renders: Tone fills its noise buffers with Math.random
  function seeded(seed) { let s = seed >>> 0 || 1; return () => ((s = Math.imul(s ^ (s >>> 15), 2246822519) ^ Math.imul(s ^ (s >>> 13), 3266489917)) >>> 0) / 4294967296; }

  function noiseHit(out, t, { type = "pink", attack = 0.005, release = 0.1, filter = "bandpass", from = 1000, to = from, q = 1, sweep = attack + release, level = 0 }) {
    const n = new T.Noise(type), f = new T.Filter(from, filter), e = new T.AmplitudeEnvelope({ attack, decay: 0, sustain: 1, release });
    f.Q.value = q; n.chain(f, e, out); n.volume.value = level;
    f.frequency.setValueAtTime(from, t); f.frequency.exponentialRampToValueAtTime(Math.max(20, to), t + sweep);
    n.start(t); e.triggerAttackRelease(attack, t); n.stop(t + attack + release + 0.05);
  }

  // Each entry: (out, t = landing time, o = { dur, pitch }) -> schedules nodes. Levels are matched by ear to sit
  // around -18 LUFS before the master, so a cue at gain 0 is already balanced against the others.
  const KIT = {
    whoosh(out, t, o) { const d = o.dur || 0.6; const p = new T.Panner(-0.6); p.connect(out); p.pan.setValueAtTime(-0.6, t - d * 0.6); p.pan.linearRampToValueAtTime(0.6, t + d * 0.4);
      noiseHit(p, t - d * 0.6, { attack: d * 0.6, release: d * 0.4, from: 350, to: 2600 * Math.pow(2, (o.pitch || 0) / 12), q: 1.4, sweep: d * 0.6, level: -6 }); },
    swish(out, t, o) { const d = o.dur || 0.25; noiseHit(out, t - d * 0.5, { type: "white", attack: d * 0.5, release: d * 0.5, filter: "highpass", from: 1500, to: 7000, q: 0.7, sweep: d * 0.5, level: -14 }); },
    pop(out, t, o) { const s = new T.MembraneSynth({ pitchDecay: 0.03, octaves: 3, envelope: { attack: 0.001, decay: 0.12, sustain: 0, release: 0.05 } }).connect(out);
      s.volume.value = -8; s.triggerAttackRelease(hz("C5", o.pitch), 0.08, t); },
    tick(out, t, o) { const s = new T.Synth({ oscillator: { type: "sine" }, envelope: { attack: 0.001, decay: 0.03, sustain: 0, release: 0.01 } }).connect(out);
      s.volume.value = -16; s.triggerAttackRelease(hz("C7", o.pitch), 0.02, t); },
    click(out, t, o) { noiseHit(out, t, { type: "white", attack: 0.001, release: 0.012, filter: "highpass", from: 3000, level: -10 }); KIT.tick(out, t, { pitch: -12 + (o.pitch || 0) }); },
    hit(out, t, o) { const s = new T.MembraneSynth({ pitchDecay: 0.08, octaves: 4, envelope: { attack: 0.001, decay: 0.5, sustain: 0, release: 0.2 } }).connect(out);
      s.volume.value = -4; s.triggerAttackRelease(hz("C2", o.pitch), 0.3, t);
      noiseHit(out, t, { attack: 0.002, release: 0.25, filter: "lowpass", from: 2500, to: 300, sweep: 0.25, level: -12 }); },
    riser(out, t, o) { const d = o.dur || 2; const s = new T.Oscillator({ type: "sawtooth", frequency: hz("C3", o.pitch) }), f = new T.Filter(400, "lowpass"), g = new T.Gain(0);
      s.chain(f, g, out); s.volume.value = -20; s.start(t - d); s.stop(t + 0.02);
      s.frequency.setValueAtTime(hz("C3", o.pitch), t - d); s.frequency.exponentialRampToValueAtTime(hz("C5", o.pitch), t);
      f.frequency.setValueAtTime(400, t - d); f.frequency.exponentialRampToValueAtTime(6000, t);
      g.gain.setValueAtTime(0, t - d); g.gain.linearRampToValueAtTime(1, t - 0.01); g.gain.linearRampToValueAtTime(0, t + 0.02);
      noiseHit(out, t - d, { type: "white", attack: d, release: 0.02, filter: "highpass", from: 500, to: 8000, sweep: d, level: -18 }); },
    sub(out, t, o) { const s = new T.Oscillator({ type: "sine", frequency: 62 }), g = new T.Gain(0); s.chain(g, out); s.volume.value = -2;
      s.frequency.setValueAtTime(62 * Math.pow(2, (o.pitch || 0) / 12), t); s.frequency.exponentialRampToValueAtTime(34, t + 0.7);
      g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(1, t + 0.01); g.gain.exponentialRampToValueAtTime(0.001, t + 0.9); s.start(t); s.stop(t + 1); },
    chime(out, t, o) { const s = new T.PolySynth(T.FMSynth, { harmonicity: 3.01, modulationIndex: 6, envelope: { attack: 0.002, decay: 1.2, sustain: 0, release: 0.8 },
        modulationEnvelope: { attack: 0.002, decay: 0.4, sustain: 0, release: 0.3 } }).connect(out);
      s.volume.value = -16; s.triggerAttackRelease([hz("E5", o.pitch), hz("B5", o.pitch)], 0.4, t); s.triggerAttackRelease(hz("E6", o.pitch), 0.3, t + 0.09); },
    shimmer(out, t, o) { const s = new T.PolySynth(T.FMSynth, { harmonicity: 2, modulationIndex: 3, envelope: { attack: 0.01, decay: 0.6, sustain: 0, release: 0.6 } }).connect(out);
      s.volume.value = -22; ["C6", "E6", "G6", "B6", "D7"].forEach((n, i) => s.triggerAttackRelease(hz(n, o.pitch), 0.15, t + i * 0.045)); },
    type(out, t, o) { const d = o.dur || 0.8, r = seeded(Math.round(t * 1000) + 7); for (let x = t; x < t + d; x += 0.045 + r() * 0.05)
      noiseHit(out, x, { type: "white", attack: 0.001, release: 0.01 + r() * 0.01, from: 2500 + r() * 2500, q: 2, level: -16 - r() * 4 }); },
    glitch(out, t, o) { const d = o.dur || 0.3, c = new T.BitCrusher(3), s = new T.Oscillator({ type: "square", frequency: hz("A4", o.pitch) }), g = new T.Gain(0), r = seeded(Math.round(t * 1000) + 3);
      s.chain(c, g, out); s.volume.value = -22; s.start(t); s.stop(t + d);
      for (let x = t; x < t + d; x += 0.03) { g.gain.setValueAtTime(r() > 0.45 ? 1 : 0, x); s.frequency.setValueAtTime(hz("A4", (o.pitch || 0) + Math.floor(r() * 24) - 12), x); }
      g.gain.setValueAtTime(0, t + d); },
  };

  // music beds: quiet, loopable, tempo-locked so cuts can sit on the beat (beat n at n * 60 / bpm)
  function bed(out, b, duration) {
    const spb = 60 / (b.bpm || 100), end = duration, g = new T.Gain(db((b.gain ?? 0) - 6)).connect(out), mood = b.mood || "pulse";
    const pad = new T.PolySynth(T.Synth, { oscillator: { type: "fatsawtooth", count: 3, spread: 18 }, envelope: { attack: spb * 2, decay: 0, sustain: 1, release: spb * 2 } });
    const lp = new T.Filter(mood === "ambient" ? 900 : 1400, "lowpass"); pad.chain(lp, g); pad.volume.value = -24;
    const chords = [["A3", "C4", "E4", "G4"], ["F3", "A3", "C4", "E4"], ["C3", "E3", "G3", "B3"], ["G3", "B3", "D4", "F#4"]];
    for (let bar = 0, x = 0; x < end; bar++, x += spb * 4) pad.triggerAttackRelease(chords[bar % 4].map(n => hz(n)), Math.min(spb * 4, end - x), x);
    if (mood === "ambient") return;
    const kick = new T.MembraneSynth({ pitchDecay: 0.05, octaves: 5, envelope: { attack: 0.001, decay: 0.3, sustain: 0, release: 0.1 } }).connect(g); kick.volume.value = -10;
    for (let i = 0, x = 0; x < end - 0.05; i++, x += spb) {
      if (mood === "pulse") { if (i % 2 === 0) kick.triggerAttackRelease(hz("C1"), 0.1, x); noiseHit(g, x + spb / 2, { type: "white", attack: 0.001, release: 0.04, filter: "highpass", from: 7000, level: -22 }); }
      else KIT.tick(g, x, { pitch: i % 4 ? -5 : 0 });
    }
  }

  async function render(track) {
    const sr = track.sampleRate || 48000, duration = track.duration, rnd = Math.random;
    Math.random = seeded(track.seed || 1);
    try {
      const buf = await T.Offline(async () => {
        const master = new T.Limiter(-1).toDestination(), comp = new T.Compressor(-20, 3).connect(master);
        const verb = new T.Reverb({ decay: 1.6, wet: 0.16 }); await verb.ready; verb.connect(comp);
        if (track.bed) bed(verb, track.bed, duration);
        for (const c of track.cues || []) {
          const fx = KIT[c.sfx]; if (!fx) throw new Error("unknown sfx: " + c.sfx + " (kit: " + Object.keys(KIT).join(", ") + ")");
          const k = (c.take || 0) % 3, o = Object.assign({}, c, { pitch: (c.pitch || 0) + [0, -0.7, 0.6][k], dur: c.dur && c.dur * [1, 1.08, 0.93][k] });
          // sounds that build up before they land (whoosh, swish, riser) are shortened to start at 0 s at the earliest
          const pre = { whoosh: [0.6, 0.6], swish: [0.5, 0.25], riser: [1, 2] }[c.sfx];
          if (pre) { const d = o.dur || pre[1]; if (c.t < d * pre[0]) { o.dur = c.t / pre[0]; if (o.dur < 0.08) continue; } }
          const g = new T.Gain(db((c.gain || 0) + [0, -1, -0.5][k])), p = new T.Panner(c.pan || 0); g.chain(p, verb); fx(g, c.t, o);
        }
      }, duration, 2, sr);
      return { sr, ch: [buf.getChannelData(0), buf.getChannelData(1)] };
    } finally { Math.random = rnd; }
  }

  // for tools/sound_kit.py: channel data as base64 float32, so a 30 s track crosses the bridge in one call
  async function renderB64(track) {
    const r = await render(track);
    const enc = a => { const u = new Uint8Array(a.buffer, a.byteOffset, a.byteLength); let s = ""; for (let i = 0; i < u.length; i += 0x8000) s += String.fromCharCode.apply(null, u.subarray(i, i + 0x8000)); return btoa(s); };
    return { sr: r.sr, left: enc(r.ch[0]), right: enc(r.ch[1]) };
  }

  window.MDNA_AUDIO = { KIT, render, renderB64, version: "tone " + T.version };
})();
