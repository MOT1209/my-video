# Phase 4 — Visual direction & storyboard

Decide the look, the cast and the recurring devices BEFORE anyone builds a frame. Directors working in
parallel only produce one coherent film if these are pinned down in `STORYBOARD.md`.

## 1. The look — match the song, not the last project
The kit's default skin is **BlockFrame neobrutalism** (pastel grounds, thick black borders, hard offset
shadows, Inter 900 uppercase, sticker type). It suited a comedic funk-pop song. For other genres, re-theme:

| Song feel | Look ideas | Theme moves |
|---|---|---|
| comedic pop / funk / novelty | neobrutalist stickers (default), zine, toy packaging | default kit |
| synthwave / electronic | neon on night grounds, grids, chrome type | `--k-ink` → near-white glow, dark grounds, a mono or wide display font |
| lo-fi / chill | paper textures, muted palette, slow pans, handwritten labels | softer palette, thinner borders, slower camera, phrase-flow pacing |
| rock / punk | photocopy grain, ransom-note type, red/black/yellow | high contrast, rough textures, more shake |
| corporate / launch | clean product UI, one brand colour, calm motion | brand palette in theme.css; keep characters but tone down gags |

Browse `<skills>/hyperframes-creative/frame-presets/` for ready palettes + font pairings (read only the
preset's colours and fonts). Theme via `assets/theme.css` (CSS vars) + `assets/theme.js` (`KIT.theme({...})`
for SVG characters). **Fonts must be royalty-free** (OFL/Apache/MIT — see `assets/fonts/FONTS.md`).
Keep one accent colour reserved for alarms/censor/crash moments so it keeps its meaning.

## 2. The cast
- **The host — AGENT** (`KIT.mascot`): a boxy robot with an LED screen face (14 expressions), lip-sync, poses,
  grooves, sweat/tears, a chest badge (any short text — "A.I.", a team name, a version number) and
  accessories (beret, shades, headset, crown, party hat) or whole scene outfits (`KIT.outfit`, §6). Variants via `body`/`ear`/`eye` colours and
  `badge` make cousins and sidekicks (in the worked example: HAIKU 5.5 = green + shades; COUSIN 4.5 = blue + headset).
  Use it as narrator whenever the song has a narrator voice; it is the reusable identity across videos.
- **The female AGENT** (`KIT.mascot({ id })` + `KIT.femme(id)`, which recolours her pink itself: pink shirt and ears, pink antenna bow,
  lashes, blush, same rig and expressions). **Casting rule: whoever sings a line on screen matches the voice.** Run
  `scripts/voice_cast.py` in phase 3; lines marked `voice:"f"` are sung by her, `"m"` by AGENT, `"duet"` by both. Never have AGENT
  lip-sync a female voice (viewers notice at once, even in an intro). Give her real moments, not a cameo, when she sings.
- **Brand mascot cameos** — real mascots of the companies in the story, rendered with affection and kept
  on-model (proportions matter: a Clawd drawn too wide was spotted immediately; his body is ~1.6:1). The kit ships **Clawd**
  (Claude Code's orange voxel critter, 3D, `K3.clawd`) — the element viewers loved most; give him real dance
  moments, not edge-of-frame cameos. Build others the same way (simple primitives + toon + outline).
- **Gag characters** born from the lyrics (the worked example's LE CHONK — Mistral's 1T "big boy" with beret,
  mustache, sash and bulb horn — `KIT.chonk`). Invent new ones per song; keep them simple SVG or 3D.

## 3. Recurring devices (the film's grammar)
- **Receipts**: the real screenshot in a browser window, tilted, with a highlighter sweeping the exact phrase
  on the sung word, plus a source pill (the outlet's name only). Use for every factual claim — it makes the jokes land as true.
- **Standalone rule:** every video stands on its own. No episode/track numbers, no video-title labels, no
  release or publish dates on screen (title card, pills, receipt tags, end card) unless the story needs them (a date the
  lyric sings, the days of a week the song is structured around). Dates live in research.md and the description.
- **A structural card** that orders the story (tear-off calendar per day, chapter cards, a scoreboard…).
- **The hook's visual gag** (e.g. A.I. → censor bar → yellow "S" sticker) that repeats and evolves each chorus.
- **Ground/colour flips on downbeats**, star bursts, dot grids — cheap, on-beat life.
- **Story-state continuity** (write these as explicit rules): e.g. "after 66.5 s the host's badge reads S.I. in every frame".

## 4. The chorus arc (lesson from three critic rounds)
Design the chorus grammar ONCE (word slams on the sung words, the hook gag, the shout) and then **re-stage it
each time**: chorus 1 = reference; chorus 2 = same timing inside new set pieces (a memo, a chat thread, a
Find & Replace dialog…); final chorus = its own look (e.g. a night stage with 3D letters and spotlights)
and clearly the biggest moment. Identical repeats were the critic's #1 complaint.
Same for the opening: the first 10–20 s must hook (a composed first frame, the host doing something, a
gag on the first spoken line), and the outro should bookend the intro.

## 5. Energy & the 2D+3D combo — the energy bar
Every video is held to one measurable bar. The "best" column was measured on the highest-scoring video so far (a 3:36
funk-pop recap of a week of AI news, 17 frames, four directors, critic 7.5 → 8.4 → 8.8/10). The "flat" column is a later
4:50 explainer song whose directors were briefed without these numbers: it scored 6.6, was judged "missing the energy, and
the combo of 2D with 3D", and every frame had to be rebuilt (the rebuild, at 32 cuts/min, was the version people loved).
Put this table in every director's brief and the critic's brief, and measure it on every render.

| Measure | Target | Best | Flat (6.6) |
|---|---|---|---|
| Frames with a real 3D hero moment | **≥ 60%**, and **every chorus** | 10 of 17 | 4 of 16 |
| 3D calls per minute of song | ≈ 16 | ≈ 16 | ≈ 2.5 |
| Camera-div references per minute (a camera move per phrase) | ≈ 36 | ≈ 36 | ≈ 13 |
| Cuts per minute, whole video | ≥ 27 | 27 (32 after the rebuild above) | 17.6 |
| Cuts per minute, each chorus/hook | **≥ 45** | 48–59 | 15–29 |
| Cuts per minute, breakdown | the densest section | 84 | 10 (its flattest) |
| Static holds | none > 0.6 s except a deliberate musical stop | — | many |

How to measure (M = song minutes, m = section minutes; the grep counts are proxies for what's on screen, so look at the
review sheets too):
```bash
grep -lE "K3\.(text3d|clawd|box|cyl|sphere|coin)\(" compositions/frames/*.html | wc -l   # frames with 3D
grep -oE "K3\.(text3d|clawd|box|cyl|sphere|coin)\(" compositions/frames/*.html | wc -l   # ÷ M = 3D calls/min
grep -oE '"#[A-Za-z0-9_-]*cam"' compositions/frames/*.html | wc -l                        # ÷ M = camera refs/min (camera div ids end in "cam")
ffmpeg -v info -ss <s0> -to <s1> -i renders/<render>.mp4 -vf "select='gt(scene,0.3)',showinfo" -f null - 2>&1 | grep -c pts_time   # ÷ m = cuts/min
```

Targets for every video:
- A real 3D hero moment in **≥ 60% of frames** and in **every chorus** (3D hook slabs / toon lettering), 3D Clawd (or the
  story's brand mascot) in chorus instrumentals and breakdowns.
- 3D props layered WITH the 2D world (stickers, receipts, characters in front of and behind them), not 3D in a separate box.
- A camera move on every phrase (push-in, whip-pan, dolly, orbit on 3D), punches/shakes on hits, ground/colour flips on downbeats.
- No static hold > 0.6 s (except a deliberate musical stop).
- The energy arc follows the song: it PEAKS in the breakdown and the final chorus, never in a verse. Hooks get one composition
  per sung hook word, every hook word full-frame with a colour flip; the breakdown is a run of full-frame 3D payoffs, one per
  call-back; the final chorus brings the whole cast back. Characters 25–40% of frame height in featured shots; never repeat
  the same cutaway angle more than twice.
Plan the 3D moment and the camera move per line in the storyboard, then count them before rendering.

**What the best video did on screen** (its critic's "keep exactly as is" list; aim every brief at this):
- **The first 10 seconds**: the very first frame is already a composed scene that states the premise (a dark room with an
  evidence board of real article thumbnails); a physical gag lands on the first spoken word (a WEEKLY REPORT folder slapped
  down on "agent"); the hook's visual gag appears at once (an A.I. stamp → glitch → censor bar → a yellow S sticker slapped
  over it); then a camera drop and a push-in on the line's last word.
- **Frame-accurate sync**: every hook word, gag and cameo lands on its word onset or beat (a lever pulled on the sung word,
  a number counting to its value on "two", a horn on the last beat); the climax lands on the final chorus's last key word.
- **A three-stage chorus arc**: chorus 1 is the reference staging in daylight colours; chorus 2 keeps the timing but moves into
  new set pieces (an office memo, a chat with "the boss"); the final chorus is its own world (a night stage after the key
  change, 3D letters, spotlights, the haloed cast, confetti), peaks on a full-frame 3D hook word, and the outro decelerates
  with the music (one spotlight dies per fading shout) into a bookend of the opening room and a short end card.
- **Characters with arcs, not cameos**: the host's full range of expressions; the brand mascot escalates through the video
  (a dance break in the chant, riding a blimp, hopping on a pedestal on sung words, hanging off a lever, riding a 3D letter
  in the finale); the gag character's sound (a bulb-horn HONK) runs from its verse to the end card.
- **Verses as witty, literal set pieces**, each line its own idea and backed by a receipt: product widgets popping in, a
  cash-counting machine re-counting a revenue figure, a "← THAT'S US?!" freeze-frame when the lyric mentions the song's own
  generator, a CAPS LOCK cufflink on a hand, a redacted document instead of an invented quote, an "offline" verse that starts with
  a plug being yanked, a quarantine cube, a fine-print magnifier, a 7-day recap grid at the end.
- **Honest receipts**: 15 real screenshots, each highlighted on the sung phrase and credited; rounding labelled on screen
  ("≈70 IN THE SONG").
- **Cohesion across four directors**: one palette per section, the continuity rules held (a badge change stays changed),
  no collisions or clipping at the peak of a slam.

The bundled frames in `assets/examples/` (intro, 3D title, chant dance break, receipts + 3D lever) come from that video:
read them for the level of craft, not to copy their content.

## 6. Outfits per scene
Characters may change outfits to match the scene (`KIT.outfit` / `KIT.outfitSwap`, see `kit-api.md`): pit crew at a pit stop,
shades at a neon night show, reading glasses for a lecture, a crown for a victory lap. Rules: change outfits at scene/section cuts or
with an on-beat swap (`KIT.outfitSwap`); an outfit stays the same for the whole scene (write it in the storyboard's continuity
rules); identity markers never change: AGENT = blue body + yellow tilted channel badge; her = pink body + antenna bow + the same badge.

## 7. STORYBOARD.md
Use music-to-video's storyboard format (frontmatter + `## Frame N — NN-id` blocks with `src`, `duration`,
`span_sec`, `pacing`, `mood`, `feel`, `### Groups`) so `validate-plan.mjs` and `assemble-index.mjs` work.
In each group write WHAT, not HOW: the lyric anchors (track seconds), the copy, the receipt (shot name,
crop, mark rects from `rects.json`), and a one-paragraph story beat. Mark the planned thumbnail beats (≥ 1 per section: a big face + one bold word, held a few frames —
see delivery.md › Thumbnails). Add the cast list, recurring devices,
continuity rules, caption policy (which sections have the karaoke bar) and an owner per frame.
Example: `assets/examples/STORYBOARD-example.md`.
