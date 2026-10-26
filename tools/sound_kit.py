"""Renders a Motion DNA sound track (tools/sound/mdna_audio.js, Tone.js) to WAV, and can lay it under a rendered video.
Used by the MCP tool add_sound (After Effects), research/video_prompts templates and research/hyperframes.

A track is JSON: {"duration": 8, "cues": [{"t": 1.0, "sfx": "whoosh"}, ...], "bed": {"bpm": 100, "mood": "pulse"}}
(see the header of tools/sound/mdna_audio.js). A template can carry its own track as `sound` in MDNA.scene({...}).
Every sound is synthesised, so the result can ship anywhere. Same track in, same sound out (renders match to within 1 bit).

Usage:
  python tools/sound_kit.py track.json out.wav
  python tools/sound_kit.py --template research/video_prompts/templates/t05_kinetic_type.html [out.wav]
  ... --mux research/video_prompts/renders/t05_kinetic_type.mov      writes <video>_sound.<ext>, the mix aimed at -14 LUFS / -1 dBTP (a sparse
      SFX-only track lands lower: the peak limit wins, and it prints what it measured)
Needs: playwright (pip install playwright); it uses the installed Chrome or Edge, else its own Chromium
(python -m playwright install chromium). ffmpeg for --mux.
"""
import argparse, base64, json, os, subprocess, sys, wave
import numpy as np
from playwright.sync_api import sync_playwright

HERE = os.path.dirname(os.path.abspath(__file__))
HOST = os.path.join(HERE, "sound", "kit.html")
TEMPLATES = os.path.join(HERE, "..", "research", "video_prompts")


def url(path, q): return "file:///" + os.path.abspath(path).replace("\\", "/") + q


def browser(p, *args):
    """The installed Chrome, else Edge, else Playwright's own Chromium: nothing extra to download on most machines."""
    for ch in ("chrome", "msedge", None):
        try: return p.chromium.launch(channel=ch, args=["--allow-file-access-from-files", "--autoplay-policy=no-user-gesture-required", *args]) if ch else                     p.chromium.launch(args=["--allow-file-access-from-files", "--autoplay-policy=no-user-gesture-required", *args])
        except Exception as e: err = e
    raise RuntimeError(f"no browser for the sound kit ({err}): install Chrome, or run  python -m playwright install chromium")


def track_of(template):
    """The `sound` a template declares in MDNA.scene, with the scene's duration when it gives none."""
    with sync_playwright() as p:
        b = browser(p); pg = b.new_page()
        pg.goto(url(template, "?render")); pg.wait_for_function("window.MDNA_READY === true", timeout=30000)
        info = pg.evaluate("MDNA.info()"); b.close()
    if not info or not info.get("sound"): sys.exit("this template declares no `sound` in MDNA.scene")
    return {"duration": info["duration"], **info["sound"]}


def render(track, out, verbose=False):   # quiet by default: the MCP server talks JSON-RPC on stdout
    with sync_playwright() as p:
        b = browser(p); pg = b.new_page()
        errors = []; pg.on("pageerror", lambda e: errors.append(str(e)))
        pg.goto(url(HOST, "?render")); pg.wait_for_function("window.MDNA_AUDIO", timeout=30000)
        r = pg.evaluate("t => MDNA_AUDIO.renderB64(t)", track); b.close()
    if errors: sys.exit("page errors: " + "; ".join(errors))
    left, right = (np.frombuffer(base64.b64decode(r[k]), dtype=np.float32) for k in ("left", "right"))
    pcm = (np.clip(np.stack([left, right], 1), -1, 1) * 32767).astype("<i2")
    os.makedirs(os.path.dirname(os.path.abspath(out)), exist_ok=True)
    with wave.open(out, "wb") as w: w.setnchannels(2); w.setsampwidth(2); w.setframerate(r["sr"]); w.writeframes(pcm.tobytes())
    peak = float(np.abs(pcm).max()) / 32767
    if verbose: print(json.dumps({"out": out, "seconds": round(len(left) / r["sr"], 3), "sr": r["sr"], "peak_dbfs": round(20 * np.log10(max(peak, 1e-9)), 1),
                      "cues": len(track.get("cues", [])), "bed": bool(track.get("bed"))}))
    return out


KIT = ["whoosh", "swish", "pop", "tick", "click", "hit", "riser", "sub", "chime", "shimmer", "type", "glitch"]
RANK = {"hit": 6, "riser": 5, "whoosh": 4, "sub": 4, "pop": 3, "chime": 3, "shimmer": 3, "swish": 2, "glitch": 2, "type": 1, "click": 1, "tick": 0}


def cues_from_events(events, w=1920, fps=30, density="few"):
    """What happens on screen -> sound cues, on the rule 'every sound has a cause on screen, and few': a cut or a large
    fast move whooshes, a medium move swishes, a scale-up pops, a text arriving ticks, a marker 'sfx: <name>' is obeyed
    as written. A cue lands one frame after its picture (light before sound), cues closer than 0.1 s keep the
    strongest, and a repeated sound rotates takes. density: few (default; ticks at most one per 0.3 s) | all.
    events: [{t, kind: cut|move|pop|text|marker, value, layer}] (value: travel in px for a move, the sfx for a marker)."""
    cues = []
    for e in events:
        k, t, who = e["kind"], float(e["t"]) + 1.0 / fps, e.get("layer", "comp")
        if k == "marker":
            name = str(e["value"]).strip().lower()
            if name in KIT: cues.append({"t": float(e["t"]), "sfx": name, "why": "marker on " + who})
        elif k == "cut": cues.append({"t": t, "sfx": "whoosh", "dur": 0.5, "why": "cut to " + who})
        elif k == "move":
            travel = float(e.get("value") or 0)
            if travel > 0.3 * w: cues.append({"t": t, "sfx": "whoosh", "dur": 0.45, "gain": -2, "why": who + " crosses the frame"})
            elif travel > 0.08 * w: cues.append({"t": t, "sfx": "swish", "why": who + " moves in"})
        elif k == "pop": cues.append({"t": t, "sfx": "pop", "why": who + " pops in"})
        elif k == "text": cues.append({"t": t, "sfx": "tick", "gain": -2, "why": who + " arrives"})
    cues.sort(key=lambda c: c["t"]); kept = []
    for c in cues:   # one sound per moment: the strongest wins
        if kept and c["t"] - kept[-1]["t"] < 0.1:
            if RANK[c["sfx"]] > RANK[kept[-1]["sfx"]]: kept[-1] = c
            continue
        kept.append(c)
    if density == "few":
        out, last = [], -9.0
        for c in kept:
            if c["sfx"] == "tick":
                if c["t"] - last < 0.3: continue
                last = c["t"]
            out.append(c)
        kept = out
    n = {}
    for c in kept: c["take"] = n.get(c["sfx"], 0); n[c["sfx"]] = c["take"] + 1
    return kept


def mux(video, wav, verbose=False):
    base, ext = os.path.splitext(video); out = base + "_sound" + ext   # a ProRes .mov overlay stays a .mov
    subprocess.run(["ffmpeg", "-v", "error", "-y", "-i", video, "-i", wav, "-map", "0:v", "-map", "1:a", "-c:v", "copy",
                    "-af", "loudnorm=I=-14:TP=-1:LRA=11", "-c:a", "aac", "-b:a", "192k", "-ar", "48000", "-shortest", out], check=True)
    m = subprocess.run(["ffmpeg", "-hide_banner", "-i", out, "-map", "0:a", "-af", "ebur128=peak=true", "-f", "null", "-"], capture_output=True, text=True).stderr
    lufs = [l.split()[1] for l in m.splitlines() if l.strip().startswith("I:")]
    if verbose: print(json.dumps({"muxed": out, "lufs": float(lufs[-1]) if lufs else None}))
    return out


if __name__ == "__main__":
    a = argparse.ArgumentParser(); a.add_argument("src", nargs="?"); a.add_argument("out", nargs="?")
    a.add_argument("--template"); a.add_argument("--mux", help="a rendered video to lay the track under")
    x = a.parse_args()
    if x.template:
        tpl = x.template if os.path.exists(x.template) else next((c for c in (os.path.join(TEMPLATES, x.template), os.path.join(TEMPLATES, "templates", x.template)) if os.path.exists(c)), x.template)
        track, out = track_of(tpl), x.src or os.path.join(TEMPLATES, "renders", os.path.splitext(os.path.basename(tpl))[0] + ".wav")
    else:
        if not x.src: a.error("give a track .json or --template")
        track, out = json.load(open(x.src, encoding="utf-8")), x.out or os.path.splitext(x.src)[0] + ".wav"
    render(track, out, True)
    if x.mux: mux(x.mux, out, True)
