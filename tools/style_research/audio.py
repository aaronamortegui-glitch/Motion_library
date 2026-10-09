"""Music / BPM analysis and its relation to the edit.

Uso: python -I audio.py <video> <energy.json from energy.py> <out_prefix>
Writes <out_prefix>.json and <out_prefix>.png, prints the JSON.

- tempo (BPM), beat times, pulse clarity (how strong the beat is)
- visual events: cuts / hard changes + motion-energy peaks (from energy.json)
- sync: share of events within ±tol of a beat, vs the share expected by chance
- shot lengths measured in beats
"""
import json
import math
import subprocess
import sys
import tempfile
from pathlib import Path

import librosa
import numpy as np
import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt

vid, ej, out = sys.argv[1], sys.argv[2], sys.argv[3]
E = json.load(open(ej))
fps = E["fps"]; d = np.array(E["diff"]); h = np.array(E["hist"]); fl = np.array(E["flow"])[:, 0]

# --- audio
tmp = Path(tempfile.gettempdir()) / ("_aud_" + Path(out).name + ".wav")
r = subprocess.run(["ffmpeg", "-v", "error", "-y", "-i", vid, "-vn", "-ac", "1", "-ar", "22050", str(tmp)])
if r.returncode != 0 or not tmp.exists():
    print(json.dumps({"audio": False})); sys.exit(0)
y, sr = librosa.load(str(tmp), sr=22050, mono=True)
tmp.unlink(missing_ok=True)
dur = len(y) / sr
rms = librosa.feature.rms(y=y)[0]
if rms.max() < 1e-4:
    print(json.dumps({"audio": False})); sys.exit(0)
hop = 512
onset = librosa.onset.onset_strength(y=y, sr=sr, hop_length=hop)
tempo, beats = librosa.beat.beat_track(onset_envelope=onset, sr=sr, hop_length=hop, units="time")
tempo = float(np.atleast_1d(tempo)[0])
# pulse clarity: autocorrelation peak of the onset envelope at the beat period (0..1)
ac = librosa.autocorrelate(onset - onset.mean())
ac = ac / (ac[0] + 1e-9)
lag = int(round(60 / max(tempo, 1) * sr / hop))
pulse = float(ac[max(lag - 2, 1):lag + 3].max()) if lag + 3 < len(ac) else 0.0
# tempo stability: spread of inter-beat intervals
ibi = np.diff(beats)
stability = float(1 - min(1, np.std(ibi) / (np.mean(ibi) + 1e-9))) if len(ibi) > 4 else 0.0
# percussive share
yh, yp = librosa.effects.hpss(y)
perc_share = float((yp ** 2).sum() / ((y ** 2).sum() + 1e-9))

# --- visual events
n = len(d); med = np.median(d) + 1e-6
cand = [i for i in range(1, n - 1) if (h[i] > 0.3) or (d[i] > max(20, 8 * med) and d[i] > 2 * max(d[i - 1], d[i + 1]))]
cuts = [c for k, c in enumerate(cand) if k == 0 or c - cand[k - 1] > 2]
# motion accents: local maxima of flow magnitude well above its median
fm = fl; thr = max(1.5, np.percentile(fm, 90))
acc = [i for i in range(2, n - 2) if fm[i] > thr and fm[i] == fm[i - 2:i + 3].max()]
acc = [a for k, a in enumerate(acc) if k == 0 or a - acc[k - 1] > int(fps * 0.25)]
cut_t = np.array(cuts) / fps; acc_t = np.array(acc) / fps

beat_period = 60 / tempo if tempo > 0 else 0
def sync(times, tol):
    if len(times) == 0 or len(beats) == 0: return None, None
    dist = np.array([np.min(np.abs(beats - t)) for t in times])
    hit = float((dist <= tol).mean())
    chance = min(1.0, 2 * tol / beat_period) if beat_period else None
    return round(hit, 3), round(chance, 3) if chance is not None else None
tol = max(0.07, 1.5 / fps)  # ~2 frames
chance = round(min(1.0, 2 * tol / beat_period), 3) if beat_period else None
cut_hit, _ = sync(cut_t, tol)
acc_hit, _ = sync(acc_t, tol)
# also check half-beats (cuts on the off-beat / eighth notes)
halfbeats = np.sort(np.concatenate([beats, beats[:-1] + np.diff(beats) / 2])) if len(beats) > 1 else beats
cut_hit_half = float(np.mean([np.min(np.abs(halfbeats - t)) <= tol for t in cut_t])) if len(cut_t) and len(halfbeats) else None

shots = np.diff(np.concatenate([[0], cut_t, [dur]]))
shots_beats = shots / beat_period if beat_period else shots * 0

def verdict():
    if pulse < 0.15 or (perc_share < 0.08 and pulse < 0.35):
        return "no clear beat (ambient / voiceover-led)"
    if cut_hit is not None and len(cut_t) >= 4 and chance is not None:
        lift = cut_hit / max(chance, 1e-6)
        if lift >= 1.8 and cut_hit >= 0.5: return "cut on the beat"
        if lift >= 1.3: return "loosely beat-aware"
    if acc_hit is not None and chance and acc_hit / chance >= 1.8:
        return "motion accents on the beat (cuts free)"
    return "edit independent of the beat"

res = {
    "audio": True, "duration_s": round(dur, 1),
    "bpm": round(tempo, 1), "beat_period_s": round(beat_period, 3),
    "pulse_clarity": round(pulse, 2), "tempo_stability": round(stability, 2), "percussive_share": round(perc_share, 2),
    "cuts": len(cut_t), "motion_accents": len(acc_t), "sync_tolerance_ms": round(tol * 1000),
    "cuts_on_beat": cut_hit, "cuts_on_half_beat": round(cut_hit_half, 3) if cut_hit_half is not None else None,
    "accents_on_beat": acc_hit, "chance_on_beat": chance,
    "avg_shot_beats": round(float(np.mean(shots_beats)), 2) if len(shots_beats) else None,
    "median_shot_beats": round(float(np.median(shots_beats)), 2) if len(shots_beats) else None,
    "loudness_dynamic_db": round(float(20 * np.log10((np.percentile(rms, 95) + 1e-9) / (np.percentile(rms, 20) + 1e-9))), 1),
    "verdict": verdict(),
}
json.dump(res, open(out + ".json", "w"), indent=1)

t_on = librosa.times_like(onset, sr=sr, hop_length=hop)
fig, ax = plt.subplots(2, 1, figsize=(16, 5), sharex=True)
ax[0].plot(t_on, onset, lw=0.6, color="#555"); ax[0].vlines(beats, 0, onset.max(), color="#2a78d6", lw=0.4, alpha=0.5)
ax[0].set_ylabel("onsets + beats"); ax[0].set_title(f"{res['bpm']} BPM · pulse {res['pulse_clarity']} · {res['verdict']}")
ax[1].plot(np.arange(n) / fps, fm, lw=0.6, color="#1baf7a"); ax[1].vlines(cut_t, 0, max(fm.max(), 1), color="#e34948", lw=0.8)
ax[1].vlines(beats, 0, max(fm.max(), 1) * 0.3, color="#2a78d6", lw=0.4, alpha=0.5); ax[1].set_ylabel("motion · cuts(red)")
ax[1].set_xticks(np.arange(0, dur + 1, max(1, int(dur // 30))))
for a in ax: a.grid(alpha=.3)
plt.tight_layout(); plt.savefig(out + ".png", dpi=70)
print(json.dumps(res))
