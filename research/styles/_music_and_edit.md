# Music & edit: how the soundtrack relates to the pace

Measured with `tools/style_research/audio.py` on every reference (librosa beat tracking + the visual cut/motion data).
Fields per video in `catalog.json › music`: BPM, pulse clarity (0–1, how strong the beat is), percussive share,
cuts on beat vs chance (±70 ms), cuts on half-beats, motion accents on beat, median shot length **in beats**, verdict.

> Limits: the audio is never heard, only measured. Beat trackers sometimes lock to half or double tempo. With fewer than ~10 cuts the sync numbers are weak evidence.

## Findings (20 references, 19 with audio)

### 1. Hard beat-locking is rare
Only **ref10** (self-promo reel, 129 BPM) cuts strictly on the beat: 64% of cuts on beat vs 30% by chance, 100% on half-beats, sections every 4/8 beats, words every half beat.
Everything else sits at or near chance on the beat. Some cut **below** chance (ref07 Vercel 15% vs 23%; ref12 Blueprint 14% vs 24%): those montages cut faster than the beat and deliberately off it.

### 2. The music shapes the edit at three other levels
| Level | How | Seen in |
|---|---|---|
| **Macro structure** | quiet intro → full track; dense sections in the loud parts; music decays under the logo | ref07, ref15, ref18, ref16 |
| **Key moments on musical events** | the logo lands one beat before the drop (ref15); the hero reveal sits on the music peak (ref18 TEAMWORK); a montage starts exactly on a beat after a cut-free build (ref09) | ref09, ref15, ref18 |
| **Subdivision / syncopation** | cuts on dotted or off-beat subdivisions (ref09: cards every 0.76 beat); half-beat preference (ref18 70%, ref19 7/8, ref14 67%) | ref09, ref14, ref18, ref19 |

### 3. Shot length *in beats* separates the styles better than BPM
| Shot length (median) | Videos | Style |
|---|---|---|
| **≤ 1 beat** | ref02 (1.1), ref07 (0.7), ref09 (0.6), ref10 (1.0), ref12 (0.6) | montages / sizzles / hype: Editorial snap, Hype montage, Kinetic type, Technical collage |
| **~1.5–5 beats** | ref06 (4.3), ref13 (4.0), ref14 (2.0), ref15 (4.2), ref16 (1.4), ref18 (5.1), ref19 (5.4), ref20 (3.8) | statement-per-shot pieces, product launches, character spots |
| **> 5 beats** | ref01 (8.8), ref03 (6.0), ref04 (22), ref05 (25), ref08 (30), ref17 (5.0, narration-led) | continuous / voiceover-led / camera-travel pieces |

BPM itself spans 89–144 in every family, so tempo doesn't identify a style. The **ratio of edit rate to tempo** does.

### 4. Pulse clarity tracks how "music-driven" a piece is
- No clear beat (pulse < 0.2): ref01 (ambient), ref05 (voiceover explainer), ref13 (trailer drone), ref17 (narrated infographic). The pacing follows the copy or the voice.
- Clear pulse (≥ 0.5): ref07, ref09, ref10, ref12, ref14, ref18, ref03, ref20 (tonal ostinato, camera moves through the beat). But a clear pulse doesn't mean beat-locked cuts (ref07, ref12 cut off-beat on purpose).

### 5. Per family (draft)
| Family | Music use |
|---|---|
| 01 Elegant | ambient or melodic beds; the edit follows the copy (shots of 4–9 beats). Exception: Editorial montages cut under one beat but off-grid. Logo lands on a musical event. |
| 02 Playful reel | clear pulse; the shortest shots (≤ 2 beats); the only true beat-locked edit (ref10); builds → drops (ref09). |
| 03 Character | voiceover or melodic bed; long shots (5+ beats); the hero reveal on the music peak (ref18). |
| 04 Mixed media | percussive tracks; either very fast off-beat montage (ref12) or continuous travel loosely on beat (ref04). |

## How to use it when animating a storyboard
1. Choose the **edit rate in beats** from the style (≤ 1 / 2–5 / > 5).
2. Place **key moments** (logo, reveal, product hero) on musical events (drop, peak, downbeat), even when the cuts are free.
3. Lock to the beat only for Kinetic-type / promo-reel pieces; otherwise cut by reading time and let the macro structure follow the track.
