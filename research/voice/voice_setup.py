"""Installs Chatterbox (resemble-ai, MIT; TTS and voice conversion with a reference voice) for local, free voices,
in its own environment outside the repo and outside ComfyUI, so nothing else is touched:
  Windows  %LOCALAPPDATA%/MotionDNA/voice-venv        macOS  ~/Library/Application Support/MotionDNA/voice-venv

Chatterbox pins torch 2.6, which has no kernels for the newest NVIDIA cards (RTX 50xx, sm_120); this installs a
torch that matches the machine (CUDA 12.8 wheels on NVIDIA, the default wheels elsewhere, MPS on Apple Silicon) and
Chatterbox without its torch pin. About 3-4 GB with CUDA; the models (~2 GB) download on the first voice.

Usage: python research/voice/voice_setup.py            (needs Python 3.10-3.12 available as `py -3.11` / python3.11, and git)
Then:  python research/voice/voice_local.py ...        (it finds this environment by itself)
Real voices only with the person's consent (CLAUDE.md); Chatterbox watermarks its output (Perth).
"""
import os, pathlib, shutil, subprocess, sys

HOME = pathlib.Path(os.environ.get("LOCALAPPDATA") or pathlib.Path.home() / "Library" / "Application Support") / "MotionDNA"
VENV = HOME / "voice-venv"
PY = VENV / ("Scripts/python.exe" if os.name == "nt" else "bin/python")
DEPS = ["numpy<2", "librosa==0.11.0", "s3tokenizer", "transformers==5.2.0", "diffusers==0.29.0", "conformer==0.3.2", "safetensors==0.5.3",
        "pyloudnorm", "omegaconf", "pykakasi==2.3.0", "spacy-pkuseg", "resemble-perth @ git+https://github.com/resemble-ai/Perth.git@master"]


def base_python():
    for cmd in (["py", "-3.11"], ["py", "-3.12"], ["py", "-3.10"], ["python3.11"], ["python3.12"], ["python3.10"]):
        if shutil.which(cmd[0]) and subprocess.run(cmd + ["-c", "pass"], capture_output=True).returncode == 0: return cmd
    sys.exit("needs Python 3.10, 3.11 or 3.12 (Chatterbox's dependencies have no wheels for newer ones yet)")


def pip(*args): subprocess.run([str(PY), "-m", "pip", "install", "--quiet", *args], check=True)


if __name__ == "__main__":
    if not PY.exists():
        HOME.mkdir(parents=True, exist_ok=True); subprocess.run(base_python() + ["-m", "venv", str(VENV)], check=True)
    pip("--upgrade", "pip")
    nvidia = shutil.which("nvidia-smi") is not None
    print("torch for " + ("NVIDIA (CUDA 12.8)" if nvidia else "this machine"))
    pip("torch==2.7.1", "torchaudio==2.7.1", *(["--index-url", "https://download.pytorch.org/whl/cu128"] if nvidia else []))
    print("Chatterbox's dependencies"); pip(*DEPS)
    print("Chatterbox (without its torch pin)"); pip("--no-deps", "chatterbox-tts @ git+https://github.com/resemble-ai/chatterbox.git@master")
    r = subprocess.run([str(PY), "-c", "import torch, chatterbox; print('torch', torch.__version__, 'cuda', torch.cuda.is_available(), 'mps', torch.backends.mps.is_available())"],
                       capture_output=True, text=True)
    print(r.stdout.strip() or r.stderr.strip()[-500:]); print("voice environment:", VENV)
