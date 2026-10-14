# Use cases: every tool, tested on real-looking work

We ran each Motion DNA tool on a small, realistic piece from five industries, with fictional brands and generated
assets. The aim was to find what breaks or confuses a designer. Every finding below was fixed and re-tested. The
[User guide](../USER_GUIDE.md) turns these results into instructions and tips.

![The test assets](img/assets.jpg)

Assets: Nano Banana 2.1 on Flora, 2K, 8 images for USD 0.42. Cut-outs: the local `matte` tool (InSPyReNet).
Brands: Maison Nord (fashion), Oku Optics (eyewear), Lumé (beauty), Orto (kitchen) and Vela (cars). All fictional.

| # | Industry | Tool | Result | Findings (all fixed) |
|---|---|---|---|---|
| UC01 | Fashion | Behaviors · Create | OK | F1 |
| UC02 | Eyewear | Behaviors · Modify / Replace | OK | F2 |
| UC03 | Beauty | Text presets | OK | — |
| UC04 | Kitchen | Loops and transitions | OK | F3 |
| UC05 | Cars | Curves | OK | — (layout redesigned) |
| UC06 | Beauty | Brands: create, apply, share | OK | F4, F5, F6 |
| UC06b | Beauty | Agent: a review note becomes a rule | OK | — |
| UC07 | Fashion | Agent: a style from the Library | OK | F7 |
| UC08 | Fashion | Agent: text behind a person | Works, slow | F8, F9, F10, F11 |
| UC09 | Cars | Agent: Figma frame → After Effects | OK | F12, F13, F14 |
| UC10 | All | Projects and conversations | OK | — |
| UC11 | All | MCP directly + layout QA | OK | QA false positives fixed |
| — | Panel | Reviews by Aaron and Gian | — | F15, F16, F17 |

Agent costs are Claude Code's own estimates. With a subscription they are not billed per order.

---

## UC01 · Fashion · Behaviors › Create
**Brief:** a campaign post for *The Coat Edit*: a title, the season, a call to action and the model.
**Steps:** select the four layers in reading order, then Behaviors › Moves › Slide Land › **Create**.

![UC01](img/uc01.jpg)

- **Worked:** "Slide Land: 4 animated". The stagger follows the order the layers were selected.
- **F1:** a text preset applied over a move replaced the move. A designer expects the two to combine: one moves the
  layer, the other moves the letters.
  **Fix:** Replace works channel by channel (`SSP.replaceWith`); whatever the new preset does not animate keeps its keys.

## UC02 · Eyewear · Modify and Replace
**Brief:** a product shot that already had a hand-made linear move, as a client file usually does.

![UC02](img/uc02.jpg)

- **Modify:** the keyframe values stayed and the move got the preset's timing and curve. Frame 2 shows the same pose,
  now eased.
- **Replace:** the move was swapped for Scale Pop (frame 3).
- **F2:** Replace also deleted the layer's own rotation, which Scale Pop does not use.
  **Fix:** the same channel-by-channel replace.
  The panel now says *replaced* (your own animation) or *redone* (an earlier Motion DNA move).

## UC03 · Beauty · Text presets
**Brief:** a serum ad with a headline, a claim and a price over a cream texture.

![UC03](img/uc03.jpg)

- **Worked:** headline in, claim in, claim out at 4.7 s.
- **Checked:** contrast over the texture. `check_layout` gave no warning, because the text sits on the light part.

## UC04 · Kitchen · Loops and transitions
**Brief:** a stand mixer launch: a whip-out from the kitchen photo, a push-in on the product, a float loop.

![UC04](img/uc04.jpg)

- **Worked:** Whip Pan out, Push Through in, Float on the product.
- **F3:** a transition only animated each layer on its own. The designer had to line up the exit of one layer and the
  entrance of the next by hand.
  **Fix:** select the two layers in Behaviors › Transitions and press **Transition**. The first one selected leaves
  while the second arrives, from the playhead.
  Also available as MCP `apply_transition`.

## UC05 · Cars · Curves
**Brief:** a spec reveal for the Vela One: a studio side shot with a slow push-in, and a spec card on the wall. The
client's file arrives with plain linear keys, and the note is "make it feel smoother, more premium".
**Steps:** select every layer, then Curves › S curve (1, 0, 0, 1) › Apply. No keyframes are selected, so it applies to
every key of those layers.

![UC05](img/uc05.jpg)

- **Worked:** "S curve on 7 keyframe pairs in 4 layers". The values stay; only the speed changes. At the same 0.55 s,
  the linear card has already half arrived, while the eased one is still waiting to glide in. The values read back
  exactly (100 % influence, speed 0).
- **Design note:** the first layout put the card over the front wheel, and a cut-out car on a road looked pasted. A
  full studio photo and a card on the empty wall read as one real piece.

## UC06 · Beauty · Brands (Lumé)
**Brief:** create the brand in its own folder, apply it, share it with a teammate, and merge their update.

![UC06](img/uc06.jpg)

- **Worked:** create in an external folder, apply its style and curve, *Download to share*, *Import an update*.
  The rules merged: new, edited and removed.
- **F4:** `brand.py new` did not make the folder a Claude folder.
  **Fix:** it writes `CLAUDE.md` and `.mcp.json`, like the panel does.
- **F5:** messages did not tell "animated" apart from "redone".
  **Fix:** they do now.
- **F6:** the import printed "1 new rules".
  **Fix:** plurals are correct.

![UC06b](img/uc06b.jpg)
*The same flow in the panel (Vela demo): the note, the rule it proposes, the rule kept in the brand.*

- **UC06b, Agent:** a review note on the piece came back as two `RULE:` lines. The panel asked
  where to keep them instead of saving them on its own. 53 s, about USD 0.45.

## UC07 · Fashion · A style from the Agent's Library
**Brief:** Library › Styles › Editorial › *Use in chat*.

![UC07](img/uc07.jpg)

- **Worked:** 37 s, about USD 0.36.
- **F7:** the order said "the open comp (or the selected layers)", which is ambiguous.
  **Fix:** the order now says "the selected layers (every layer of the open comp if none are selected)", and the
  context says how many layers are selected.

## UC08 · Fashion · Text behind a person (Agent, Full mode)
**Brief:** "COAT" in huge letters behind the model.

![UC08](img/uc08.jpg)

- **Worked, slowly:** 119 s, 34 turns, about USD 1.24.
- **F8:** the agent could not run the local matte, so it fell back to a rough GrabCut.
  **Fix:** the MCP tool `matte` (a still or a video, local GPU, no cost).
- **F9:** techniques had no tools, so the agent improvised.
  **Fix:** the MCP tool `text_behind` does it in one call, and each technique in `library/techniques.json` names its tool.
- **F10:** the agent saved the After Effects project without being asked.
  **Fix:** its context and the MCP instructions say never to save unless asked.
- **F11:** the "T" ran outside the safe area and nobody checked.
  **Fix:** the MCP tool `check_layout` runs before a build is called done.

## UC09 · Cars · Figma frame → After Effects (Agent, Full mode)
**Brief:** take the Figma frame *02 Specs* and rebuild it as editable layers, animated in Vela's style.

![UC09](img/uc09.jpg)

- **Worked:** native layers (a solid, the car cut-out, text in the brand fonts, rounded shape cards) placed as in Figma.
  191 s, 42 turns, about USD 1.99.
- **F12:** `apply_brand` used the style's default timing (a 700 ms car with overshoot), but Vela says 900 ms and no bounce.
  **Fix:** `SSP.brandTiming` applies the brand's own timing after the style.
- **F13:** after a retime, the marker expressions kept the old timing.
  **Fix:** `restyle` moves our marker expressions and the SS in / SS out markers too.
- **F14:** the comp was built in whichever project was open.
  **Fix:** the context names the project's own `.aep` and asks before building elsewhere.

## UC10 · Projects and conversations
- **Worked:** *Agent › Project › New project* made the folder tree, saved the open After Effects project in `05_ae`,
  and gave the project its own Claude conversation.
  *Open in Claude app* continued that same conversation in the Claude app.
- **Worked:** the cost of each order is logged to `<project>/claude/usage.csv`.

![UC10](img/uc10.jpg)
*Agent › Project and the brand's own conversation, as in the panel.*

## UC11 · MCP directly, plus layout QA
- **Worked:** `python tools/test_mcp.py` calls every tool the way Claude does: 23 of 23 passed.
- **`check_layout` on all nine comps:**
  - At first it raised four contrast warnings at 0 s. Three of them were false: it measured text that was still
    fading in, and text sitting on a shape card. It now judges contrast once the text has settled, and counts a shape
    card under the text as its plate.
  - One warning is real and stays: "COAT" in UC08, tan on cream, 1.6:1. That is a design choice the review should
    catch: use a darker tone or a shadow.

![UC11](img/uc11.jpg)

## Panel reviews
- **F15:** a style without its preview showed a broken image.
  **Fix:** the panel shows a placeholder, and `tools/check_previews.py` (run by setup and the tests) lists what is
  missing.
- **F16:** "Copy resume command" overflowed its button.
  **Fix:** it is now a compact `>_` button.
- **F17** (Gian): the chat had a big empty box you could not type in.
  **Fix:** the order field is now the main element, and the conversation appears with the first order.
- **Narrow docks:** every section was checked at 230, 300 and 420 px; nothing overflows.
- **The panel kept old screens after a push:** the signed install is now a shell that loads the code from the clone.
