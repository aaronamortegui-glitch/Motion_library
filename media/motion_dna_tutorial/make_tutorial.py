"""Assembles the install tutorial: the code-rendered animation (research/video_prompts/templates/t13_install_tutorial.html,
rendered with html_to_mp4.py) with Rex's two teaser shots cut in, his six cloned lines, UI clicks and the teaser music
ducked under the voice. Output: media/motion_dna_tutorial/video/tutorial_install.mp4 (≈ −14 LUFS).
Usage: python media/motion_dna_tutorial/make_tutorial.py
"""
import os, subprocess

ROOT = os.path.abspath(os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", ".."))
TPL = ROOT + "/research/video_prompts/renders/t13_install_tutorial.mp4"
TEASER = ROOT + "/media/motion_dna_teaser/"
OUT = ROOT + "/media/motion_dna_tutorial/video/"; os.makedirs(OUT, exist_ok=True)
VO = ROOT + "/media/motion_dna_tutorial/audio/cloned/"
CLICK = ROOT + "/assets.free/kenney-audio/kenney_ui-audio/Audio/click2.wav"
MUSIC = TEASER + "audio/music_teaser_v1.mp3"

# Rex's shots cut into the animation at template times (skipped if the file is missing): his entrance and his intro after
# the opening line, a reaction after Claude installs it, another once everything is green, "now make it pop" before the end
INSERTS = [(3, TEASER + "video/G7_rex_entrance_b.mp4", 0, 4.0), (3, OUT + "R0_rex_intro.mp4", 0, 5.0), (23, OUT + "R1_rex_coffee_break.mp4", 0, 5.0),
           (49, OUT + "R2_rex_in_business.mp4", 0, 4.0), (55, TEASER + "video/G10_make_it_pop_b.mp4", 0, 3.2)]
INSERTS = [x for x in INSERTS if os.path.exists(x[1])]
SLOT = [3, 7.5, 14.5, 23, 28.8, 35.6, 49]                 # template step starts (keep in sync with the template)
LINES = ["vo_t1b_app", "vo_t2b_folder", "vo_t2_paste", "vo_t3_scripts", "vo_t4_panel", "vo_t5_connect", "vo_t6_ask"]
CLICKS = [3.7, 4.05, 5.75, 8.0, 10.4, 12.3, 14.65, 24.15, 25.8, 27.2, 30.05, 31.5, 36.55, 38.15, 39.55, 45.3, 46.4, 47.5, 52.55]   # template seconds
END = 59
CUT, prev = [], 0
for at, src, a, b in INSERTS:
    if at > prev: CUT.append((TPL, prev, at))
    CUT.append((src, a, b)); prev = at
CUT.append((TPL, prev, END))

def out_time(t):   # template seconds → output seconds (each insert before t pushes it later)
    return t + sum(b - a for at, _, a, b in INSERTS if at <= t)

total = sum(b - a for _, a, b in CUT)
inputs, vf, af = [], [], []
for i, (src, a, b) in enumerate(CUT):
    inputs += ["-ss", str(a), "-t", str(b - a), "-i", src]
    vf.append(f"[{i}:v]scale=1920:1080:force_original_aspect_ratio=decrease,pad=1920:1080:(ow-iw)/2:(oh-ih)/2:color=0x0A211F,fps=30,setsar=1,format=yuv420p[v{i}]")
n = len(CUT)
vf.append("".join(f"[v{i}]" for i in range(n)) + f"concat=n={n}:v=1:a=0[vout]")
# dialogue of Rex's two clips at their place in the edit
clip_audio = []
for i, (src, a, b) in enumerate(CUT):
    if src != TPL:
        start = sum(bb - aa for _, aa, bb in CUT[:i])
        af.append(f"[{i}:a]loudnorm=I=-16:TP=-2,adelay={int(start * 1000)}|{int(start * 1000)},apad=whole_dur={total}[ca{i}]"); clip_audio.append(f"[ca{i}]")
k = n
for j, name in enumerate(LINES):
    inputs += ["-i", VO + name + ".wav"]; d = int(out_time(SLOT[j] + 0.3) * 1000)
    af.append(f"[{k}:a]silenceremove=start_periods=1:start_threshold=-45dB,loudnorm=I=-15:TP=-2,adelay={d}|{d},apad=whole_dur={total}[vo{j}]"); k += 1
clicks = []
for j, t in enumerate(CLICKS):
    inputs += ["-i", CLICK]; d = int(out_time(t) * 1000)
    af.append(f"[{k}:a]volume=-14dB,adelay={d}|{d},apad=whole_dur={total}[ck{j}]"); clicks.append(f"[ck{j}]"); k += 1
inputs += ["-i", MUSIC]; mi = k
voices = "".join(f"[vo{j}]" for j in range(len(LINES))) + "".join(clip_audio)
af.append(f"{voices}amix=inputs={len(LINES) + len(clip_audio)}:normalize=0,asplit=2[dlg][sc]")
af.append(f"[{mi}:a]atrim=0:{total},volume=-13dB,afade=t=in:d=0.6,afade=t=out:st={total - 1.5}:d=1.5[mus0]")
af.append("[mus0][sc]sidechaincompress=threshold=0.03:ratio=8:attack=20:release=350[mus]")
af.append(f"[dlg][mus]{''.join(clicks)}amix=inputs={2 + len(clicks)}:normalize=0,loudnorm=I=-15.5:TP=-1.5:LRA=11,volume=1.5dB,alimiter=limit=0.89[aout]")
fc = ";".join(vf + af)
fcfile = OUT + "_tutorial_filter.txt"; open(fcfile, "w", encoding="utf-8").write(fc)
dst = OUT + "tutorial_install.mp4"
subprocess.run(["ffmpeg", "-v", "error", "-y", *inputs, "-/filter_complex", fcfile, "-map", "[vout]", "-map", "[aout]",
                "-c:v", "libx264", "-crf", "18", "-preset", "medium", "-c:a", "aac", "-b:a", "192k", "-ar", "48000", "-movflags", "+faststart", "-t", str(total), dst], check=True)
os.remove(fcfile); print(dst, round(total, 2), "s")
