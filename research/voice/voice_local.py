"""Local, free voices with Chatterbox (resemble-ai, MIT), on this machine's GPU (environment: research/voice/voice_setup.py).

  say    text to speech: English (Turbo, with tags like [chuckle]) or 23 languages (multilingual: --lang es, fr, de...),
         in a reference voice when --ref gives a 5-15 s clean clip of it
  convert  speech-to-speech: a read (any voice) re-voiced as the reference, timing and intonation kept; the same job
         fal's chatterboxhd/speech-to-speech did for the teaser characters (docs/LEARNINGS.md), now without cost

Usage:
  python research/voice/voice_local.py say "Motion with its own DNA." out.wav [--ref voice.wav] [--lang en] [--exaggeration 0.5] [--cfg 0.5]
  python research/voice/voice_local.py convert read.wav out.wav --ref voice.wav
Real people only with their consent (CLAUDE.md). Output is watermarked by Chatterbox (Perth). Then level it with the
other lines (ebur128, within ~1.5 LU) before it goes into an edit.
"""
import argparse, os, pathlib, subprocess, sys

HOME = pathlib.Path(os.environ.get("LOCALAPPDATA") or pathlib.Path.home() / "Library" / "Application Support") / "MotionDNA"
PY = HOME / "voice-venv" / ("Scripts/python.exe" if os.name == "nt" else "bin/python")

if pathlib.Path(sys.executable).resolve() != PY.resolve():   # run inside the voice environment
    if not PY.exists(): sys.exit("the local voice environment is not installed: python research/voice/voice_setup.py")
    sys.exit(subprocess.run([str(PY), __file__, *sys.argv[1:]]).returncode)

import torch, torchaudio as ta

a = argparse.ArgumentParser(); a.add_argument("cmd", choices=["say", "convert"]); a.add_argument("src"); a.add_argument("out")
a.add_argument("--ref"); a.add_argument("--lang", default="en"); a.add_argument("--exaggeration", type=float, default=0.5); a.add_argument("--cfg", type=float, default=0.5)
x = a.parse_args()
dev = "cuda" if torch.cuda.is_available() else "mps" if torch.backends.mps.is_available() else "cpu"
if x.cmd == "convert":
    from chatterbox.vc import ChatterboxVC
    if not x.ref: sys.exit("convert needs --ref (the target voice)")
    m = ChatterboxVC.from_pretrained(dev); wav = m.generate(x.src, target_voice_path=x.ref)
elif x.lang == "en":
    from chatterbox.tts_turbo import ChatterboxTurboTTS
    m = ChatterboxTurboTTS.from_pretrained(device=dev); wav = m.generate(x.src, audio_prompt_path=x.ref) if x.ref else m.generate(x.src)
else:
    from chatterbox.mtl_tts import ChatterboxMultilingualTTS
    m = ChatterboxMultilingualTTS.from_pretrained(device=dev, t3_model="v3")
    kw = dict(language_id=x.lang, exaggeration=x.exaggeration, cfg_weight=x.cfg); wav = m.generate(x.src, audio_prompt_path=x.ref, **kw) if x.ref else m.generate(x.src, **kw)
pathlib.Path(x.out).parent.mkdir(parents=True, exist_ok=True); ta.save(x.out, wav, m.sr)
print(f"{x.out} ({wav.shape[-1] / m.sr:.2f} s, {dev})")
