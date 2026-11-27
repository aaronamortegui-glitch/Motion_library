#!/usr/bin/env python3
"""End-to-end test of Motion DNA in Premiere: builds a small edit through the MCP tools and checks the exports.

Needs Premiere 2026+ open with a project and the Motion DNA panel connected. It adds sequences named
"MDNA test <time>" to the open project (it never saves the project and never deletes anything).

  python research/platforms/premiere/test_premiere.py [--premiere 27] [--footage a.mp4 b.mp4]

Checks: connection, sequence creation, import + placement with no gap, a library preset (keys + no edges), a kit
title, music level, the 9:16 reformat (size, people followed, title re-placed), exports from Premiere (size, frame
rate, title pixels present, loudness around -14 LUFS, at most one black frame).
"""
import argparse
import json
import pathlib
import re
import subprocess
import sys
import time

HERE = pathlib.Path(__file__).resolve().parent
ROOT = HERE.parents[2]
sys.path.insert(0, str(HERE))
import mcp_premiere as m  # noqa: E402

RESULTS = []


def check(name, ok, detail=""):
    RESULTS.append((name, bool(ok), detail))
    print(f"  {'PASS' if ok else 'FAIL'}  {name}" + (f"  ({detail})" if detail else ""), flush=True)
    return ok


def tool(tool_name, **args):
    fn = {t[0]: t[1] for t in m.TOOLS_DEF}[tool_name]
    return fn(**args)


def synthetic_clip(out, seconds=4, colour="0x2e6b5e"):
    """A clip with no person (for machines without the test footage): a coloured field with a moving square."""
    subprocess.run(["ffmpeg", "-v", "error", "-y", "-f", "lavfi", "-i", f"color=c={colour}:s=1920x1080:r=24:d={seconds}",
                    "-vf", "drawbox=x='200+t*200':y=400:w=300:h=300:color=0xd8ff85:t=fill", "-c:v", "libx264", "-pix_fmt",
                    "yuv420p", str(out)], check=True)
    return out


def probe(path):
    r = subprocess.run(["ffprobe", "-v", "error", "-select_streams", "v:0", "-show_entries", "stream=width,height,r_frame_rate",
                        "-of", "json", str(path)], capture_output=True, text=True)
    s = json.loads(r.stdout)["streams"][0]
    return s["width"], s["height"], s["r_frame_rate"]


def lufs(path):
    r = subprocess.run(["ffmpeg", "-nostats", "-i", str(path), "-filter_complex", "ebur128=peak=true", "-f", "null", "-"],
                       capture_output=True, text=True, encoding="utf-8", errors="replace")
    i = re.findall(r"I:\s+(-?[\d.]+) LUFS", r.stderr)
    return float(i[-1]) if i else None


def black_frames(path):
    r = subprocess.run(["ffmpeg", "-nostats", "-i", str(path), "-vf", "blackdetect=d=0.04:pix_th=0.05", "-an", "-f", "null", "-"],
                       capture_output=True, text=True, encoding="utf-8", errors="replace")
    spans = re.findall(r"black_start:([\d.]+) black_end:([\d.]+)", r.stderr)
    return sum(float(b) - float(a) for a, b in spans)


def title_pixels(path, t, band):
    """Share of near-white pixels in a horizontal band (y0, y1 as 0-1) at time t: a title is there if > 0.2 %."""
    import numpy as np
    from PIL import Image
    tmp = HERE / "spike" / "_projects" / "test_frame.png"
    tmp.parent.mkdir(parents=True, exist_ok=True)
    subprocess.run(["ffmpeg", "-v", "error", "-y", "-ss", str(t), "-i", str(path), "-frames:v", "1", str(tmp)], check=True)
    a = np.asarray(Image.open(tmp).convert("RGB")).astype(int)
    h = a.shape[0]
    roi = a[int(band[0] * h):int(band[1] * h)]
    white = (roi.min(axis=2) > 235).mean()
    return white


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--premiere", default=None)
    ap.add_argument("--footage", nargs="*")
    a = ap.parse_args()
    P = a.premiere
    stamp = time.strftime("%H%M%S")
    seq, vseq = f"MDNA test {stamp}", f"MDNA test {stamp} 9x16"
    print(f"Motion DNA for Premiere: end-to-end test ({seq})")

    st = tool("ppro_status", premiere=P)
    if not check("Premiere connected", "premiere_connected" in st, st.splitlines()[0][:100]):
        print(st); return 1

    clips = a.footage or [str(p) for p in [ROOT / "media/faceswap/out/aaron_70s_1080.mp4", ROOT / "media/faceswap/out/cypher_clip04_gian.mp4"] if p.exists()]
    if len(clips) < 2:
        d = HERE / "spike" / "_projects"
        clips = [str(synthetic_clip(d / "synthetic_a.mp4")), str(synthetic_clip(d / "synthetic_b.mp4", colour="0x174a45"))]
        print("  (no test footage with people here: synthetic clips, so face tracking is not tested)")

    check("create_sequence", "Created" in tool("create_sequence", name=seq, fps=23.976, premiere=P))
    for c in clips[:2]:
        tool("import_media", source=c, bin="MDNA test", premiere=P)
    tool("place_clip", item=pathlib.Path(clips[0]).name, sequence=seq, track=1, time_s=0, premiere=P)
    tool("place_clip", item=pathlib.Path(clips[1]).name, sequence=seq, track=1, after=True, premiere=P)
    lc = json.loads(tool("list_clips", sequence=seq, premiere=P))
    v1 = lc["video"][0]["clips"]
    check("two clips, no gap", len(v1) == 2 and abs(v1[1]["start"] - v1[0]["end"]) < 0.05, f"{v1[0]['end']} -> {v1[1]['start']}")

    out = tool("apply_preset", preset="Glide In", sequence=seq, track=1, clip=0, phase="in", premiere=P)
    check("apply_preset Glide In (baked, edge guard)", "keyframes" in out, out.split(":")[1][:70] if ":" in out else out[:70])
    out = tool("add_title", text="Motion DNA test", sequence=seq, track=2, time_s=0.5, premiere=P)
    check("add_title from the kit", "exports with the text" in out, out[:90])
    music = next((str(q) for q in [ROOT / "assets.free/oga-music-loops/Just Saying Tho.wav", *(pathlib.Path(c).parents[3] / "assets.free/oga-music-loops/Just Saying Tho.wav" for c in clips if len(pathlib.Path(c).parents) > 3)] if q.exists()), None)
    if not music:
        music = str(HERE / "spike" / "_projects" / "tone.wav")
        subprocess.run(["ffmpeg", "-v", "error", "-y", "-f", "lavfi", "-i", "sine=f=220:d=15", "-ar", "48000", "-ac", "2", music], check=True)
    out = tool("add_music", source=music, sequence=seq, track=2, premiere=P)
    check("add_music levelled", "LUFS" in out or "dB" in out, out[:90])
    out = tool("reformat_sequence", target="9:16", sequence=seq, name=vseq, premiere=P)
    check("reformat 9:16", "1080x1920" in out, out.splitlines()[0][:90])
    check("  people followed", "follows the person" in out or "no tracking" in out, "")
    check("  title re-placed in the safe band", "text at y" in out, "")

    for s, size in [(seq, (1920, 1080)), (vseq, (1080, 1920))]:
        res = tool("export_sequence", sequence=s, premiere=P)
        f = pathlib.Path(res.split("-> ")[1].split(" (")[0]) if "-> " in res else None
        if not check(f"export {s}", f and f.exists(), res[:90]):
            continue
        time.sleep(2)
        w, h, fr = probe(f)
        check("  size and frame rate", (w, h) == size and fr in ("24000/1001",), f"{w}x{h} @ {fr}")
        band = (0.62, 0.95) if size[1] < size[0] else (0.05, 0.85)
        wp = title_pixels(f, 2.0, band)
        check("  title visible in the export", wp > 0.002, f"{wp:.2%} white pixels in the title band")
        L = lufs(f)
        check("  loudness about -14 LUFS", L is not None and -15.5 <= L <= -12.5, f"{L} LUFS")
        bl = black_frames(f)
        check("  at most one black frame", bl <= 0.05, f"{bl:.3f}s black")

    bad = [r for r in RESULTS if not r[1]]
    print(f"\n{len(RESULTS) - len(bad)}/{len(RESULTS)} passed." + ("" if not bad else " Failed: " + "; ".join(r[0] for r in bad)))
    print(f"Sequences left in the project: {seq}, {vseq} (delete them when you like; the project was not saved).")
    return 0 if not bad else 1


if __name__ == "__main__":
    sys.exit(main())
