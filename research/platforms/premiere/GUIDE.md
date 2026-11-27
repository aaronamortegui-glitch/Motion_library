# Motion DNA in Premiere — guide (beta)

Motion DNA gives your edits its own motion identity: moves on exact curves, animated titles, formats for every
feed. In Premiere **you don't click through menus: you ask Claude in its chat**, and Claude edits the project you
have open. The Motion DNA panel in Premiere only shows that Claude is connected and what it is doing.

```
You (Claude chat)  ──►  Claude  ──►  Motion DNA panel in Premiere  ──►  your sequence
```

## What you need
- Premiere 2026 or newer (Windows; Mac is written but not tested yet).
- The Creative Cloud app, signed in.
- Claude: the Claude desktop app or Claude Code, with this repo cloned.
- You do **not** need After Effects or Media Encoder.

## Install (once)
1. Ask Claude: **"Install Motion DNA for Premiere."** Claude runs `python tools/setup.py` (or
   `research/platforms/premiere/install_premiere.py`). If Adobe shows an install prompt, click **Install**.
2. Restart Premiere if it was open.
3. In Premiere: **Window › UXP Plugins › Motion DNA**. Dock the panel next to Effect Controls: Premiere brings it back
   every time.
4. The panel looks like the After Effects one (same helix mark, colours and pills). Its **Claude** pill turns
   lime as soon as Claude does something; grey is fine: it connects the moment you ask Claude anything about
   Premiere. The **Project** pill is lime when a project is open. While Claude works, the helix spins next to what it is
   doing.

## Use it: talk to Claude
Open your project, keep the panel open, and ask in your own words. The panel's *Try asking Claude* list has
examples with a **Copy** button. More:

| You want | Ask Claude |
|---|---|
| Vertical and square versions | "Make 9:16 and 1:1 versions of *Sequence 01* that keep the person in frame, and export all three." |
| A title | "Add the title *Two voices* at 0:01, Motion DNA style." |
| A move on a clip | "Give the first clip a calm, elegant entrance." / "Make the logo pop in, playful." |
| A precise curve | "Slide the second clip in from the left on the Land curve, Arrive duration." |
| Slow motion | "Slow the second clip to a quarter speed for one second, then back." |
| Music | "Put a music bed under the edit and fade it out." |
| Footage | "Import the clips in D:\shoot\day1 into a bin called Footage and lay them out in order." |
| Generated footage | "Generate a 5-second shot of … with Flora and put it after the first clip." (Claude quotes the cost first.) |
| A brand's rules | "Work for *Conair*: follow its motion rules." |
| Export | "Export the three formats." (MP4, straight from Premiere, next to the project in *Motion DNA renders*.) |

More you can ask, all done by Claude in your project:

| You want | Ask Claude |
|---|---|
| A tidy project | "Organize the project." (Bins by kind — Footage, Audio, Music, Voice, Generated, Graphics, Stills, Sequences, Placeholders, Renders — with colour labels.) |
| A hand-off folder | "Collect the project into D:\handoff." (Copies all media, saves the project there relinked; the open project becomes the copy, the original stays.) |
| Send the edit to another app | "Export this sequence as OTIO / Final Cut XML / AAF." |
| Another project's work | "Bring in the sequences from D:\old\launch.prproj." or an After Effects project (comps come in live). |
| A shot still to come | "Put a placeholder for the product hero shot after the second clip." Later: "Generate it with Flora and swap it in." |
| A voice-over | "Add the ElevenLabs line voice_01.wav at 0:02." (Levelled, music ducked under it; a file with sound on one channel only is fixed.) |
| An animation made in code | "Put the liquid wipe template over the cut." (Rendered with transparency, placed on top.) |
| Colour | "Grade the whole edit warm film." / "Teal and orange on the second clip, half strength." / "Exposure +0.5 on clip 1." |
| A mask | "Rounded mask on the first clip, revealing on Land." / "Cut the person out." (person cut-out: this machine only) |
| Transitions | "A dissolve between the clips." / "Something energetic on the cuts." |
| Cuts on the beat | "Put markers on the music's beats." |
| Edit an interview by its words | "Transcribe interview.mp4, keep sentences 1, 3 and 4, cut the pauses and the ums." (Premiere's own transcription; English, Spanish and more.) |
| Captions | "Add Motion DNA captions to the cut, four words per line." |

Claude picks moves, curves and durations from the Motion DNA library by feel (energy 1 calm … 5 explosive, and tones
like elegant, playful, corporate), so describe the feeling, not the keyframes.

## What Claude takes care of, every time
- **Exact curves**: every move is baked on the Motion DNA curve, one keyframe per frame (Premiere cannot ease keys).
- **No edges**: footage is enlarged just enough that a move never shows its borders.
- **People in frame**: reformats follow the person (face tracking), and titles stay clear of faces, inside the feed's
  safe area (9:16: between y 270 and 1440).
- **Titles that export**: Motion DNA titles keep their text in the MP4 (see *Limits*).
- **Sound**: music alone around −14 LUFS; under a voice, 16 dB lower.
- **Editable**: everything stays as clips, keyframes and titles you can change. Only slow motion is rendered (that one
  clip), because Premiere does not let plugins change speed.
- It never saves your project unless you ask.

## Colour: what Claude controls in Lumetri
Motion DNA has its own **look library** (`looks.json`: Clean Modern, Warm Film, Teal & Orange, Noir, Pastel Soft,
Golden Hour, Cool Tech, Vivid Pop, Muted Editorial, Retro 70s, Night Neon, Natural Fix), tagged by energy and tone
like the rest of the library. A look is applied as **Lumetri Color**, so you can open the Lumetri panel and keep
adjusting. Claude can also set any single Lumetri value, and animate it over time on the Motion DNA curves.

Premiere lets plugins reach most of Lumetri, but not all of it:

| Lumetri | Claude can set it? |
|---|---|
| Basic Correction: white balance, temperature, tint, exposure, contrast, highlights, shadows, whites, blacks, saturation | Yes |
| Creative: intensity, faded film, sharpen, vibrance, saturation, tint balance | Yes |
| Creative Look / Input LUT | Only Premiere's built-in list (by number); not your own .cube file |
| RGB curves, Hue/Sat curves (points) | **No** — Premiere does not expose curve points |
| Color wheels (shadows / midtones / highlights) | **No** in Lumetri — Claude does them with **Levels per channel** instead (same idea: lift, gamma, gain) |
| HSL Secondary (key colours, denoise, blur, correction) | Yes |
| Vignette | Yes |

So: for curves and custom LUTs, adjust by hand in the Lumetri panel after Claude's grade; everything else Claude
can do, and its looks that need wheels (Teal & Orange, Night Neon, Retro 70s, Golden Hour, Cool Tech) add a Levels
effect next to Lumetri.

## Sound, mono and stereo
A mono file plays centred on both sides of a stereo sequence: nothing to fix. A stereo file with sound on one channel
only (a lav mic recorded on the left) plays from one side: Claude makes a copy with that channel on both sides and
uses it (the original stays). Ask for "real stereo" if you want a mono file turned into a stereo file.

## Limits (beta)
- Premiere's API has no mask paths: masks are a matte clip on the track above + Track Matte Key (Claude sets it up).
- Premiere's quick frame preview skips titles and masks, so Claude checks frames through the exporter (exact).
- Titles come from the **Motion DNA title kit** (`kit/`). Titles you type into other templates through Claude show in
  Premiere but disappear from exports (a Premiere bug), so Claude uses the kit.
- Slow motion (speed ramps) is rendered; the clip has no audio yet.
- Premiere's frame preview does not draw titles: to check titles, Claude exports and looks at the MP4.
- Tested end to end on Premiere 2026 (26.5.3) and 2027 (27.0): both pass the full test.

## When something is off
| You see | Do this |
|---|---|
| **Claude** pill grey | Normal. Ask Claude anything; it connects. |
| **Claude** pill coral | Ask Claude to reinstall Motion DNA for Premiere; restart Premiere. |
| Claude says the plugin is not installed | Open the Creative Cloud app, sign in, then ask Claude to install again. |
| Claude waits and says Premiere shows a dialog | Look at Premiere: close the dialog (OK), then tell Claude to go on. |
| No *Motion DNA* under Window › UXP Plugins | Restart Premiere (a new install loads after a restart). |
| A title is missing in the export | Tell Claude; it re-adds it from the kit. |

## For maintainers
Code, every API rule learned (25+) and the test: `research/platforms/premiere/README.md`.
Run the end-to-end test with Premiere open and the panel connected:
`python research/platforms/premiere/test_premiere.py`.
