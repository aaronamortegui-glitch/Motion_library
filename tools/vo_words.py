"""Word timings for a voiceover, to cut scenes and land supers on the spoken word.

Uses faster-whisper (SYSTRAN, MIT, CTranslate2: about 4x faster than openai-whisper on the CPU, same models) with
voice-activity filtering, and falls back to openai-whisper when it is not installed. The default model is `medium`:
`small` can drop the first words of a line said under room noise (docs/LEARNINGS.md). Check brand names in the
transcript before you cut on them: whisper can mishear them.

Usage: python tools/vo_words.py in.mp3 out.json [--model small|medium|large-v3] [--lang en|es|...]
Output: [{"w": word, "s": start, "e": end}, ...] (seconds), the shape add_captions reads.
Install: pip install faster-whisper (the model downloads once, into the Hugging Face cache).
"""
import argparse, json, subprocess, sys

a = argparse.ArgumentParser(); a.add_argument("src"); a.add_argument("out")
a.add_argument("--model", default="medium"); a.add_argument("--lang", default="en")
x = a.parse_args()
try:
    from faster_whisper import WhisperModel
    import numpy as np
    # decoded by ffmpeg, not PyAV: a PyAV that does not match faster-whisper fails on open() (metadata_errors)
    pcm = subprocess.run(["ffmpeg", "-v", "error", "-i", x.src, "-f", "s16le", "-ac", "1", "-ar", "16000", "-"], capture_output=True, check=True).stdout
    audio = np.frombuffer(pcm, np.int16).astype(np.float32) / 32768
    def run(device):
        segs, _ = WhisperModel(x.model, device=device, compute_type="int8").transcribe(audio, language=x.lang, word_timestamps=True, vad_filter=True)
        return list(segs)
    try: segs = run("auto")
    except RuntimeError as e:   # an NVIDIA card without CUDA 12's cuBLAS/cuDNN: the CPU is fast enough for a VO
        print(f"GPU not usable ({str(e)[:80]}): on the CPU", file=sys.stderr); segs = run("cpu")
    words = [{"w": w.word.strip(), "s": round(w.start, 3), "e": round(w.end, 3)} for s in segs for w in s.words]
    text = "".join(s.text for s in segs).strip()
except ImportError:
    import whisper
    r = whisper.load_model(x.model).transcribe(x.src, word_timestamps=True, language=x.lang)
    words = [{"w": w["word"].strip(), "s": round(w["start"], 3), "e": round(w["end"], 3)} for seg in r["segments"] for w in seg["words"]]
    text = r["text"].strip()
json.dump(words, open(x.out, "w", encoding="utf-8"), indent=0, ensure_ascii=False)
print(text)
