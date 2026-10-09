# Style Analysis Framework

How reference videos are studied to define motion **styles** for the SS Motion Library.
A style sits on top of the existing tokens (`tokens/superside_motion_tokens.json`): it chooses
which durations, curves, text presets and transitions belong together, and adds new tokens only
when the references show something the current set can't express.

Unit of analysis: **the element**, not the frame. Every element on screen is tracked through its
lifecycle and described with the same fields, whatever kind of element it is.

---

## 1. Element type

Classify each element first; what to measure depends on it.

| Type | Examples | How it usually moves |
|---|---|---|
| **Abstract shape** | circles, blobs, lines, strokes, grids, particles, gradients | transforms, path morphs, stroke draw-on (trim), scale/mask reveals |
| **Text** | headlines, kickers, captions, numbers | per char / word / line / block; mask reveals, tracking, typewriter |
| **Character / human** | illustrated characters, footage of people, mascots | articulated (rig, limbs, lip sync), walk/loop cycles, acting |
| **Object / icon / illustration** | product shots, icons, illustrated props | rigid transforms + squash/stretch, pops |
| **UI / device** | screens, cards, buttons, cursors | slides, scale-ups, scroll, cursor clicks |
| **Background / environment** | color fields, textures, scenery | parallax, slow drift, color shifts |
| **Camera** | the virtual camera itself | push/pull, pan, rotate, shake, 2.5D/3D moves |

**Kind of motion.** This is how shapes are told apart from characters when footage is ambiguous:
- **Rigid transform:** position / scale / rotation / opacity only; the silhouette doesn't change.
- **Deformation:** the silhouette changes. This covers squash & stretch, shape morph and path animation.
- **Articulated:** parts move relative to each other around joints (character rig, walk cycle).
- **Reveal:** the element doesn't move. It is uncovered instead (mask, matte, trim path, wipe).
- **Generative / procedural:** particles, noise, wiggle, repetitions/echoes.

## 2. Element lifecycle

Each element is described in four phases. Each phase gets duration (frames @30fps → nearest
token), curve (fitted cubic-bezier → nearest token or new curve), and the channels involved.

| Phase | What is recorded |
|---|---|
| **Enter** | method (cut-in, fade, slide from edge, scale-up/pop, mask/wipe reveal, draw-on, morph from another element, burst/particles, from camera depth); direction; distance; duration; curve; overshoot % and number of bounces; anticipation |
| **Move** (main action) | path type (straight, arc, orbit, bezier path); peak speed (screen widths/s); acceleration profile; does it hand off motion to another element |
| **Hold** | duration of rest; is it fully still or does an idle/secondary loop run (float, breathe, wiggle, rotate) |
| **Exit** | method (cut-out, fade, slide out, scale-down, mask/wipe, morph into next element, pushed out by a transition); direction; duration; curve; anticipation (pull back before leaving); is it the mirror of the entry or different |

## 3. Secondary animation

Motion that follows from the main action rather than driving it. For each element: present? which? how strong?
- Overshoot / settle oscillation (springs) — % and number of bounces
- Squash & stretch on acceleration / impact
- Follow-through and overlapping action (parts that lag behind and catch up)
- Anticipation (small counter-move before the main move)
- Drag / lag between linked elements (delay in frames)
- Idle loops while holding (float, breathe, pulse, slow rotation)
- Motion blur, smears, echoes/trails
- Wiggle / jitter (amplitude, frequency)

## 4. Scene level

| Dimension | Measures |
|---|---|
| **Rhythm** | shot lengths; move vs hold ratio; beat sync (BPM, hits on cuts/impacts) |
| **Choreography** | how many elements move at once; lead element; stagger offset (frames) and order (left→right, center-out, random); overlap between one exit and the next entry |
| **Transitions** | hard cut, match cut, whip pan, push, mask/shape wipe, zoom-through, morph, color flash; duration; whether motion carries across the cut |
| **Space** | flat 2D, 2.5D parallax, full 3D; camera behavior |
| **Speed profile** | overall energy (suave / medio / dinámico), peak and average speed |

## 5. Method

1. **Cuts and rhythm.** ffmpeg scene detection → shot list and lengths.
2. **Motion energy.** OpenCV frame differencing / optical flow per frame → when things move vs hold, where transitions are.
3. **Element tracking.** On flat-color motion graphics, segment elements by color/connected components; otherwise track feature points. Per frame: centroid, bbox scale, rotation, area, silhouette change (rigid vs deformation).
4. **Curve fitting.** Normalize each phase to 0→1 progress and fit a cubic-bezier (`tools/fit_samples.py`) → duration, overshoot, nearest token.
5. **Visual reading.** Contact sheets of each key moment, to identify mechanisms (text unit, reveal type, transition type, secondary motion) that numbers alone can't.

Accuracy: curves are exact when one element moves clearly on its own; with camera motion or many
overlapping layers, the values are approximations and are marked as such.

## 6. Output: Style Card

One per style (`styles/<style-name>.json` + a readable summary):
- identity: name, energy, typical use, reference videos
- timing: duration tokens used per phase, stagger, hold lengths, rhythm
- curves: entry / move / exit curves (existing tokens or new ones with bezier values)
- per element type: typical enter / move / hold / exit + secondary animation
- text: unit, mechanism, stagger, exit
- transitions: types and durations
- mapping to presets in `tools/ss_presets.jsx` (existing or to be created)
