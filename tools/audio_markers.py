"""Timing from sound, so cuts and keys land on it: the beat grid of a music track, the strong hits, and the phrases of a
voice-over (spoken spans between silences). Only ffmpeg and numpy (no librosa, no GPU). The MCP tool audio_markers puts
the result on the layer as markers and can duck a music layer under the voice.

Usage: python tools/audio_markers.py <audio or video file> [beats|hits|phrases]      (prints the times as JSON)
"""
import json
import subprocess
import sys

import numpy as np

SR = 22050


def load(path):
    """Mono float PCM at SR through ffmpeg (any format After Effects takes, video included)."""
    raw = subprocess.run(["ffmpeg", "-v", "error", "-i", str(path), "-vn", "-ac", "1", "-ar", str(SR), "-f", "f32le", "-"],
                         capture_output=True, check=True).stdout
    return np.frombuffer(raw, np.float32)


def phrases(y, threshold_db=-40.0, min_silence=0.12, min_phrase=0.15):
    """Spoken spans [[start, end], …]: silence is below threshold_db (relative to the loudest 10 ms) for min_silence s
    (ffmpeg silencedetect's rule, with the level relative so a quiet take still splits)."""
    hop = int(0.01 * SR); n = len(y) // hop
    if n == 0: return []
    rms = np.sqrt(np.mean(y[:n * hop].reshape(n, hop) ** 2, axis=1)) + 1e-9
    db = 20 * np.log10(rms / rms.max())
    on = db > threshold_db
    out, start, quiet = [], None, 0
    for i, a in enumerate(on):
        if a:
            if start is None: start = i
            quiet = 0
        elif start is not None:
            quiet += 1
            if quiet * 0.01 >= min_silence:
                end = i - quiet + 1
                if (end - start) * 0.01 >= min_phrase: out.append([round(start * 0.01, 3), round(end * 0.01, 3)])
                start, quiet = None, 0
    if start is not None and (n - start) * 0.01 >= min_phrase: out.append([round(start * 0.01, 3), round(n * 0.01, 3)])
    return out


def onset_env(y, n_fft=1024, hop=256):
    """Spectral flux on a log-magnitude spectrogram: how much new energy each frame brings."""
    n = 1 + max(0, (len(y) - n_fft) // hop)
    if n < 3: return np.zeros(1), hop / SR
    idx = np.arange(n_fft)[None, :] + hop * np.arange(n)[:, None]
    S = np.log1p(10 * np.abs(np.fft.rfft(y[idx] * np.hanning(n_fft), axis=1)))
    flux = np.maximum(np.diff(S, axis=0), 0).sum(axis=1)
    flux = np.concatenate([[0], flux]); flux -= np.convolve(flux, np.ones(16) / 16, mode="same")   # remove the slow swell
    return np.maximum(flux, 0) / (flux.max() + 1e-9), hop / SR


def hits(y, min_gap=0.18, limit=64):
    """Strong onsets (drum hits, accents), strongest first then sorted in time."""
    env, dt = onset_env(y)
    thr = np.convolve(env, np.ones(31) / 31, mode="same") * 1.5 + 0.08
    pk = [i for i in range(1, len(env) - 1) if env[i] > thr[i] and env[i] >= env[i - 1] and env[i] >= env[i + 1]]
    pk.sort(key=lambda i: -env[i]); keep = []
    for i in pk:
        if all(abs(i - j) * dt >= min_gap for j in keep): keep.append(i)
        if len(keep) >= limit: break
    return sorted(round(i * dt, 3) for i in keep)


def beats(y, bpm_range=(70, 180)):
    """A steady beat grid: the tempo from the onset envelope's autocorrelation, the phase that lands on the most energy.
    Returns (bpm, [times])."""
    env, dt = onset_env(y)
    if len(env) < 64: return 0.0, []
    ac = np.correlate(env, env, mode="full")[len(env) - 1:]
    lags = np.arange(int(60 / bpm_range[1] / dt), int(60 / bpm_range[0] / dt) + 1)
    lags = lags[lags < len(ac)]
    if not len(lags): return 0.0, []
    w = np.exp(-0.5 * (np.log2(60 / (lags * dt) / 120) / 0.9) ** 2)   # prefer tempi near 120 when two read alike
    lag = int(lags[np.argmax(ac[lags] * w)])
    if 0 < lag < len(ac) - 1:   # the peak between two frames (parabola), so the grid does not drift on long tracks
        a, b, c = ac[lag - 1], ac[lag], ac[lag + 1]; d = a - 2 * b + c
        lagf = lag + (0.5 * (a - c) / d if d else 0)
    else: lagf = float(lag)
    k = np.arange(int((len(env) - 1) / lagf) + 1)
    phase = max(range(lag), key=lambda p: env[np.minimum(np.round(p + k * lagf).astype(int), len(env) - 1)].sum())
    return round(60 / (lagf * dt), 1), [round((phase + i * lagf) * dt, 3) for i in k if phase + i * lagf < len(env)]


def main():
    y = load(sys.argv[1]); mode = sys.argv[2] if len(sys.argv) > 2 else "beats"
    if mode == "phrases": print(json.dumps(phrases(y)))
    elif mode == "hits": print(json.dumps(hits(y)))
    else: bpm, b = beats(y); print(json.dumps({"bpm": bpm, "beats": b}))


if __name__ == "__main__":
    main()
