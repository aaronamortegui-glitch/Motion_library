# Motion DNA teaser · script v8 (~75 s, for review)

Same shape as v7, rewritten with every note so far: the review meeting of Oct 14 (Gian Orsi, Aaron Amortegui),
leadership's direction of Oct 12, the reviews of the promo cuts (v1–v5) and the side-by-side test of Oct 14. The panel
is now a set of Figma components (*motion-adn › 02 · Components / 03 · Screens*), so every pillar shows the real UI
animating the way *04 · Motion map* describes it, and explains what it does.

---

**1. The problem (office)**
Dana sits at her CRT, watching the same fade loop again and again.
Dana: "I can't stop making the same animation. Every. Single. Time."
Super: EVERY. / SINGLE. / TIME. (one word per beat, on her voice, Snap curve)

**2. Rex arrives (office)**
The door bursts open and Rex walks in. Freeze: Rex in colour, the office in black and white.
Rex: "That's no longer a problem!"
Super: REX VALANCE · Motion salesman since 1985

**3. The product (office)**
Rex holds up the Motion DNA box (plain: the retro box art is kept for the end card).
Rex: "Meet Motion DNA: the motion MCP that powers up your animation."
Super: MOTION DNA · motion MCP

**4. The three pillars (office)**
Three quick cuts on the beat, one per word: Rex's hand on the Rolodex, the binder, the robot's screen face lighting up.
Rex: "Moves. Guidelines. Agent mode."
Super: MOVES. / GUIDELINES. / AGENT MODE.

**5. Moves (office → the panel)**
Rex spins a Rolodex, and each card is a move with its thumbnail. Dana hands him a handwritten card, and he slots it in.
Push into Dana's CRT: the panel builds itself. The header fades up, the MCP, Claude and Figma dots light up one after the
other, the three steps slide in, and the move cards pop in reading order. The cursor hovers *Fade Up*: its preview plays
inside the thumbnail. Apply: the button presses, a toast says it is done, and the layer on screen animates.
Cut to *Curves*: the axes draw, the S curve traces itself, the handles pop. The cursor drags a handle; the curve bends
and the same layer re-times with it. *Apply to keyframes.*
Rex: "Eighty moves and a kit of a hundred and fifty pieces. Pick one, shape its curve, and add your own."
Super: 80 MOVES · 159 PIECES · + YOURS

**6. Guidelines (office → the panel)**
Wide: Rex lifts a huge "BRAND MOTION GUIDELINES" binder.
Close-up: the binder slams onto the desk, and a coffee mug tips over and spills across the papers.
Reaction: Marcus jumps in his chair, terrified.
Wide: every CRT in the office starts playing the same curve, in sync.
On Dana's CRT, *Brands*: the brands slide in from the left and "Vela" pops as the active one. In the Agent chat, a review
note ("The car never bounces") turns into a rule card; one click and the rule flies into the brand chip in the header.
Rex: "Load your brand's motion guidelines. Every note you give becomes a rule, and every project moves the way you decided."
Super: YOUR CURVES · YOUR RULES

**7. Agent mode (conference room → the panel)**
Rex, Dana and Marcus around the CRT on an AV cart. On screen, *Agent › Library*: the Styles cards pop in; the cursor
hovers *Elegant* and its preview plays. Then the chat: the cursor pastes a Figma link and sends it. The steps type
themselves one by one (*read the brand · import the storyboard · apply Elegant*). Six storyboard frames of a blue 1980s
hatchback land, line up as a timeline, and the car glides through them in the Elegant style.
Rex: "Agent mode: paste your storyboard, pick a style, and it builds the timeline."
Super: FIGMA → AFTER EFFECTS

**8. Real keyframes (conference room)**
Marcus sits at the table taking notes on a small notepad. He raises his hand.
Marcus: "And it's real keyframes?"
Rex: "Real keyframes. Right inside After Effects."
Insert: the After Effects timeline: the keyframes are there, the graph shows the curve.
Super: NATIVE KEYFRAMES

**9. Make it pop (conference room)**
The round robot rolls in with a tray of coffee. Dana reads an email from the client and sighs.
Dana: "The client says… make it pop."
The robot's screen face blinks. On the CRT, *Library › Kit*: a family card opens, its variants show as chips, one goes
to the chat. The same animation comes back alive: an overshoot on the title, a stagger, a liquid wipe on the cut.
Dana leans in, nudges the curve handle.
Dana: "A bit less."
It updates. The robot hands her a coffee.
Super: YOU DIRECT · IT ACCELERATES

**10. The reaction (office)**
Dana and Marcus jump out of their chairs at their desks, like in Aaron's current cut.
Both: "YES!"

**11. End card (office, Dana's desk)**
A floppy disk goes into the drive → INSTALLING → Dana's CRT plays the opening fade again, now with its own identity → the
retro Motion DNA box (old TV ad / Windows 95 look) turns to camera → our logo builds itself stroke by stroke and
MOTION / DNA rise under it.
Narrator: "Motion DNA. Your motion, with its own DNA."
Super: Directed by you. Accelerated by AI.

---

## Notes for the edit

**How the UI moves.** Every panel insert is built from the Figma components and follows *04 · Motion map* (Motion DNA
presets and curves, 30 fps): headers *Fade Up* on Land; status dots 4 f apart; steps *Slide Land* 3 f apart; cards *Scale
Pop* 2 f apart in reading order on Snap; hover plays the preview (Flat); buttons press 100 → 97 → 100 on Snap; toasts
*Fade Up* 12 px and hold 2.6 s; the segment highlight slides on Settle; chat steps type on (Flat); a rule card pops on Snap
and flies to the brand chip on Whip; *Use in chat* glides the order into the field. An animated cursor drives every
action. Screens are 400 px wide like the docked panel, shown inside the CRT glass (lens bulge, glow) and readable:
nothing under 36 px on the final frame.

**Look.** Clean: hard cuts, the real UI, clean graphics, supers in Inter Tight with subtle tracking. One channel flip at
most (office → conference room). No complex transitions or heavy effects on the film itself; the motion lives in the UI
and in the supers. The retro box only on the end card.

**Rhythm.** Every scene enters, lives and leaves: a slow push on the plates, nothing holds still, supers leave before the
cut. Dialogue scenes hold 5+ beats; the pillars cut on the beat; the logo lands on a downbeat.

**Feedback applied in this version**
| Note | Where it came from | What changed |
|---|---|---|
| Pillars are Moves (behaviors + curves), Guidelines (brand) and Agent mode | meeting, Oct 14 | scene 4; Styles now live inside Agent mode (scene 7) |
| Go from micro to macro: a curve and an icon → a brand → an agent doing a whole storyboard | meeting | scenes 5 → 6 → 7 |
| Show the UI on screen for the moves | meeting | scenes 5–7 and 9 are UI inserts built from the Figma components |
| Keep only numbers the tool really has | meeting | 80 moves (Behaviors) · 159 kit pieces in 48 families (Library › Kit) |
| The binder slams on the desk | meeting (Gian) | scene 6 |
| The round robot, and the client's "make it pop" to close | meeting | scene 9 |
| Agent mode imports a storyboard from a Figma link and animates it in a style, with a period car | meeting | scene 7 (a generic blue 1980s hatchback, no make or badge) |
| No complex transitions or excess effects; UI, clean graphics, an animated cursor, subtle tracking | meeting (Gian) | Notes › Look; the TV-dial and the "But wait, there's more" studio scenes are cut from the film |
| The retro box (old TV ad / Windows 95) only on the end card | meeting | scenes 3 and 11 |
| The designer directs, the AI accelerates; never "Claude", "AI animation", "one click", "open source" | leadership, Oct 12 | dialogue and supers ("one click" and "After Effects + AI" removed); Dana directs in scene 9 |
| "Every note becomes a rule" instead of "every reference becomes a style" | v7 review | scene 6 |
| Snap on EVERY. SINGLE. TIME.; the logo lands on a downbeat; nothing under 36 px; no graphics on faces | promo reviews v2–v5, Gian's Motion Style Map | scene 1, Notes |
| Every scene has an entrance, a living hold and an exit; no sparkles | side-by-side test, Oct 14 | Notes › Rhythm |
| Our logo closes Motion DNA's own videos, built stroke by stroke | logo review, Oct 14 | scene 11 |

**Social.** Cutdowns for Instagram and LinkedIn: 30 s (scenes 1, 3, 4, 7, 9, 11) and 15 s (1, 7, 9, 11), in 9:16 and 1:1.
The cut "But wait, there's more" studio beat (tracking, roto, speed ramps, Rex in front of a wrinkled green screen) can
live as its own short.

**Open decisions**
1. Say both numbers in scene 5 (80 moves and 159 pieces), or only "eighty moves"?
2. "Make it pop": Dana reading the client's email (as written), or a client on the speakerphone?
3. Does the robot speak, or only beep and react with its face (as written)?
4. A line for creative directors who are not motion designers (the demand noted in the meeting), e.g. Marcus: "Even I can do this?"
5. Who voices the end card: a narrator (as written) or Rex?
6. Length: ~75 s as written; for 60 s, merge scenes 7 and 8 and shorten the Curves insert in scene 5.

## Production plan, step by step
0. **Lock the script** (Gian + Aaron): the open decisions above; nothing is generated before the lock.
1. **What exists** (`media/motion_dna_components/4k`, Figma *motion-adn › 05 · Video assets (4K)*): Dana, Marcus, Rex and the
   round robot (turnarounds, expressions); the office, the conference room and the studio; the box, binder, mugs, Rolodex,
   floppy, computer, TV cart, VCR tape; reused footage for scenes 2, 10 and the floppy in 11.
2. **UI inserts** (Claude): the screens of *03 · Screens* animated in After Effects per *04 · Motion map*, with an animated
   cursor, as 4K sequences for the CRT glass: Behaviors (hover, apply, toast), Curves (drag a handle, apply), Brands (list,
   active brand), Agent chat (note → rule → brand chip; a Figma link → steps), Library (Styles, Kit family with variants).
3. **The storyboard demo** (Claude): a generic blue 1980s hatchback sheet and six storyboard frames in Figma (quote first),
   then the real agent path (Figma → `tools/build_figma_slides.jsx` → the Elegant style) rendered for scene 7.
4. **"Make it pop"** (Claude): the same comp flat and alive (`tools/build_compare.jsx` as the base) for scene 9.
5. **End card** (Claude): the retro box plate, then the logo close (`add_element(kind="end_card")`).
6. **Stills and video**: one storyboard frame per shot in Figma, approved; then Nano Banana 2.1 is2i stills with the sheets
   as references and Seedance 2.5 r2v in 15 s runs by location (office: 1, 3, 4, 5, 6; conference room: 7, 8, 9).
7. **Edit** in After Effects with the promo pipeline (`scenes.json`, `edit.json`, build script): plates, UI inserts corner-pinned
   into the CRTs, supers, music on the beat grid; `tools/check_layout.jsx` with 0 warnings; −14 LUFS.
8. **Deliver**: master 16:9 1080p (4K if the plates allow), the 30 s and 15 s cutdowns, Figma *05 · Video assets* and the
   README "Made with it" section updated.

**Cost estimate (USD, to approve before generating):** car sheet 3 × 0.053 = 0.16 · storyboard frames 6 × 0.053 = 0.32 ·
stills ~16 × 0.053 = 0.85 · video 4 runs × 7.325 = 29.30 · **total ≈ 30.60** (unit prices from `media/motion_dna_promo/story.md`;
re-runs are extra).

## Review notes after v8 (Gian, Oct 14, voice note)
- **No UI inside the monitors** (it distorts): the CRT is only the way in. The camera pushes into a CRT and the panel takes
  the full frame, flat and sharp, floating over the scene in soft blur (the characters working behind it).
- **Build the storyboard and correct on it**: frames in `media/motion_dna_teaser/storyboard/`.
- **More voice in Agent mode**, not only Figma → After Effects. Added lines for other things the agent does:
  Rex: "Agent mode: paste your storyboard, pick a style, and it builds the timeline. Ask it to check every shot against your
  brand, retime a whole sequence, or set up the project for your next video."
  Supers, one per beat: FIGMA → AFTER EFFECTS · BRAND CHECK · RETIME A SEQUENCE · NEW PROJECT
  (UI beats under them: the storyboard timeline; Check layout listing the brand rules on a comp; the keyframes tool
  restaggering a sequence; Project › New with its folders ticking on.)
- Decisions from Aaron: only "eighty moves"; Rex says "Make it pop" to the robot, which only beeps and answers with its eyes;
  no line for creative directors; Rex voices the end card; length can pass 75 s to give the UI room; the car is an old
  Renault 4 (no badge on screen) animated in a vintage style; the retro box only on the end card, as Gian proposed.

## Review notes on storyboard v2 (Aaron and Gian, Oct 14) → storyboard v3
- The storyboard lives in Figma *motion-adn › 06 - storyboard* (v3: 48 shots, ~95 s). UI shots are **components** built from the
  live screens of *02 · Components / 03 · Screens* (plate with layer blur, panel instances, supers as text, the Cursor
  component), never screenshots, so they rebuild in After Effects as native layers (`tools/build_figma_slides.jsx`) and
  animate with Motion DNA presets and curves. The teaser itself is made with the plugin.
- Real framing: close-ups and inserts (the robot's eyes, Dana's eyes, the CRT glass, the coffee macro, the card into the
  Rolodex, Rex's shoes), an ambience opener (the clock at 4:59), over-the-shoulder hands.
- Agent mode shows three live asks while the animation builds: "Animate this storyboard" (the R4 storyboard canvas in Figma,
  copy link, the chat, the vintage spot plays), "Add a sound to every click" (`list_assets` + `add_asset` sfx, CC0 packs),
  "Make the social resizes" (`run_jsx` in Full mode: 9:16, 1:1, 4:5). Then motion-graphics pills of real abilities
  (check the brand, captions, retime to the music, match a reference, text behind people, new project) and "Just ask."
- "Make it pop" uses a period-designed spot (Vela One 1985, fictional) before/after instead of the old same-slide demo.
- The end card makes the box the hero, like a mid-90s software launch ad (Win95 window → the box rising on a turntable
  with light beams → a light sweep → the logo build).
- Rejected: Marcus alone at a long table (the conference shots must keep the three characters in place); an old library
  screenshot as the After Effects insert (08c is a real AE timeline capture); supers baked into stills; supers touching
  the panels (a super keeps ≥100 px from the last panel and 80 px from the frame edge).
