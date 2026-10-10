# Motion DNA promo — story and characters (~40 s)

A parody of a 1980s TV infomercial. All three characters are fictional (generated, no real likeness, so no
face-refinement pass is needed). Brands, prices and names on screen are fictional.

## Characters
| Name | Role | Look |
|---|---|---|
| **Dana** | Designer, the one who complains | 1985 designer, glasses, big 80s wardrobe; bored, unimpressed |
| **Marcus** | Motion designer, her deskmate | 80s office look (mustache or gelled hair); half asleep at the screen |
| **Rex Valance** | Infomercial salesman | Shiny pastel suit, huge grin, bursts in with a blank product box |

Character sheets: `media/motion_dna_promo/characters/` (two options each, pick one per character).

## Story beats
1. **The problem (0–8 s).** A 1985 office: beige computers, green CRTs. On screen, flat animations: every title
   fades and slides the same way. Dana and Marcus are bored.
   Dana: "Claude makes the same animation every time."
2. **The pitch (8–18 s).** Rex Valance bursts through the door, infomercial style.
   Rex: "That's no longer a problem! Now there's **Motion DNA**. Techniques, animation curves and styles that give
   your motion its own feel: your model can animate in your brand's style."
3. **The install (18–26 s).** They cheer, install the plugin (floppy disk / setup screen parody). The CRTs switch on
   and the real Motion DNA examples play: styles grid, mix by tags, curves, techniques.
4. **The bridge (26–36 s).** Make it clear: Motion DNA is a bridge between the AI and After Effects. Claude takes
   control of AE, picks moves, curves and styles from the library, and the animation stops looking like everyone
   else's. Show the panel, "Claude connected", a layer being animated.
5. **Close (36–40 s).** Motion DNA title, tagline, repo.

## Shot list (draft, ~40 s)
| id | s | Frame | Camera | Source |
|---|---|---|---|---|
| s01 | 3 | Office wide: Dana and Marcus slumped at beige computers, fluorescent hum | slow push-in | keyframe → i2v |
| s02 | 3 | CRT close-up: a flat green title fades and slides in, the same way, again | static, screen fills frame | AE (flat animation on CRT) |
| s03 | 3 | Dana, close-up, to camera: "Claude makes the same animation every time." Marcus yawns behind | static | keyframe → i2v + VO |
| s04 | 3 | Back door bursts open: Rex Valance, arms wide, holding the Motion DNA box | whip/crash zoom | keyframe → i2v |
| s05 | 6 | Rex pitches to camera, infomercial lower-third and price-star parody: "Now there's Motion DNA! Techniques, curves and styles…" | medium, slight handheld | keyframe → i2v + VO + AE graphics |
| s06 | 3 | Dana and Marcus light up, cheer | medium two-shot | keyframe → i2v |
| s07 | 3 | Floppy into the drive, install screen on the CRT ("Installing Motion DNA… ▓▓▓") | insert close-up | keyframe → i2v + AE screen |
| s08 | 6 | CRTs switch on: the real library plays — styles grid, mix by tags, curves, techniques | screen inserts | AE (library mosaics in CRT frame) |
| s09 | 6 | The bridge: diagram AI ⇄ Motion DNA ⇄ After Effects; Claude takes control, the panel says "Claude connected", a layer animates | graphic | AE |
| s10 | 4 | End card: Motion DNA, tagline, repo | graphic | AE |

## Consistency pipeline (keeps the mood in every shot)
1. **Character sheets** (text-to-image, one per character: close-up, full body, 3/4) → pick one per character.
2. **Location sheet** (the 1985 office: wide, reverse angle, desk detail) and **props sheet** (beige computer with
   green CRT, floppy disks, the fictional Motion DNA box) → pick.
3. **Every shot is images-to-image** (Nano Banana 2.1 `is2i-elote-gateway`) with the chosen character, location and
   props sheets as references; never text-only. Same film look line in every prompt.
4. Shots become storyboard frames (Figma), then video (image-to-video) and AE.

Storyboard first (Figma), then animation.

## Generation log
| Item | Model | Run | Cost USD |
|---|---|---|---|
| 6 character sheets + office mood test | Nano Banana 2.1 t2i 2K | — | 0.371 |
| Location + props sheets | Nano Banana 2.1 is2i 2K | — | 0.106 |
| Keyframes s01 s03 s04 s05 s06 s07 | Nano Banana 2.1 is2i 2K (sheets as references) | — | 0.318 |
| Part 1 video (s01–s04, 15 s 720p) | Seedance 2.5 r2v, 6 references | run_m171bz1gy7tgkxe9gkaggan15x8fz1m6 | 7.325 |
| s07 re-do (label not mirrored) | Nano Banana 2.1 is2i | run_m17bd3yjdnqj1bgqqh4w6mxpyn8fzpy9 | 0.053 |
| Part 2 video (s05–s07, 15 s 720p) | Seedance 2.5 r2v, 6 references | run_m175w091q8thb4cfersgx2paq18fz95v | 7.325 |

Storyboard (Figma Slides): https://www.figma.com/slides/z2BSXVNVFhjYOlbBI1ZUy6

**Total generation spend: USD 15.498** (stills 0.848, video 14.65).

## Cut (After Effects)
- Specs: `python media/motion_dna_promo/make_dna_promo.py` → `scenes.json` + `edit.json`; build: `bash tools/bridge.sh tools/build_dna_promo.jsx 900`
  (scene builder `build_explainer.jsx` + `build_edit.jsx`, every graphic animated with Motion DNA presets).
- Final: `media/motion_dna_promo/motion_dna_promo.mp4` (v2, 40.4 s, 1080p, −14 LUFS); preview `docs/examples/dna-promo.gif`.
- v2 pacing fixes (after review of v1, 46.8 s): opening cut to one beat (2.2 s); the CRT gag to 1.8 s; Rex's shot ends on his freeze
  (the clip's last 2 s put Dana and Marcus at desks they never sat at); the cheer starts on the jump (the clip first shows them
  seated at other desks with the box already in hand); the library lands on Dana's CRT (corner-pinned on the desk plate) and the
  camera pushes into the screen to cut to the graphics, so the story leads into them; graphic scenes start on a full frame.
- Live action cut on the clips' own camera cuts; graphics timed to the dialogue word times (whisper); dialogue cut per
  shot so the CRT insert (S02) and Rex's freeze never shift it; music enters on Rex and drops on his freeze title.

## v3 (techniques + legibility, after review of v2)
- Techniques on the live plates (`scenes_fx.json`, built first by `build_dna_promo.jsx`): 2D tracked callouts (Dana, Marcus,
  the floppy), tracked brackets (Dana's CRT, the box), "1985" planar-tracked onto the back wall, roto (InSPyReNet mattes):
  god rays + a glowing contour halo around Rex with a synthesized choir (`audio/holy.wav`) on "no longer a problem", "YES!"
  behind Dana and Marcus with contour strokes and action-line bursts from the raised box.
- Rex's freeze: matte cut-out in colour over a black-and-white, defocused office; "Rex" (Inter Tight Bold) and "Valance."
  (Instrument Serif Italic) flank him, sub at the bottom (`build_edit.jsx` freeze `mono` + `split`).
- The CRT gag is now a "no creativity detected" screen with our own pixel dinosaur hopping a cactus.
- "EVERY. / SINGLE. / TIME." lands word by word on Dana's voice, 210 px bold with SFX hits.
- Legibility: nothing under 36 px; graphic scenes lengthened so every line can be read; end card opens behind a wipe.
- Final: `motion_dna_promo.mp4` (44.5 s, 1080p, −13.4 LUFS). No new generation cost.

## v4 (review notes + layout rules + Gian's Style Map)
- Layout rules now enforced by `tools/check_layout.jsx` (0 warnings on this cut): no text or card overlaps, safe area,
  size, contrast, no graphics on faces, no substituted fonts. Rules in CONTRIBUTING §9.
- Opening callouts hang from the torso and go inward (negative space by the door), on cards; the CRT label stacks into 3
  lines above the monitor; the box label stacks under the box; the floppy card sits toward the centre.
- Rex: rotating rays only (no contour); his freeze name hugs him. The CRT gag is a retro animation app (MOTION/85,
  fictional) on a close old monitor, readable.
- From Gian's Motion Style Map: Snap curve on EVERY. SINGLE. TIME.; end card = the mark lands first, the wordmark slides
  out from behind it (Wordmark Reveal); the bridge starts on a beat and the logo lands on a downbeat (117.5 BPM grid,
  `audio/music_beats.json`).
- The logo: traced from the box art (`tools/trace_mark.py` → `assets/brand/motion_dna_mark.svg`), closes the film.
- Dialogue cut with a 0.35 s tail (no phrase cut dead); a check prints any cut that lands inside a word.
- Final: `motion_dna_promo.mp4`, 45.2 s, 1080p, −14 LUFS. No new generation cost.

## v5
- CRT gag on a cleaned plate (`ae/crt_close_clean.png`): the UI sits inside the curved glass (lens bulge, add blend, glow). Rex: soft warm backlight glow instead of rays; "Valance." closer. Floppy label readable from the first frame (`instant` callout). Layout QA: 0 warnings. 45.2 s.
- v5.1: the glow is a radial gradient (no hard edge); "Valance." moved clear of Rex's leg.

## Rebuild on another machine
Committed: specs, the Seedance clips (`video/`), the 1080p plates (`shots/pNN.mp4`), tracks, contours, faces, planar
tracks, keyframes, sheets, the clean CRT plate, `audio/holy.wav` and `audio/music_beats.json`. Derived locally:
1. Mattes: `"<ComfyUI>/python_embeded/python.exe" tools/video_matte.py media/motion_dna_promo/shots/p03.mp4 media/motion_dna_promo/shots/p03_matte.mov`
   (same for p04 and p06).
2. `python media/motion_dna_promo/make_dna_promo.py` (re-cuts the dialogue and the music bed), then
   `bash tools/bridge.sh tools/build_dna_promo.jsx 900`, then `bash tools/bridge.sh tools/check_layout.jsx 900`.
