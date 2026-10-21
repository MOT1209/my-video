# DIRECTOR GUIDE — {{PROJECT_TITLE}}

You are a **section director** on a story-driven, beat-synced music video rendered with HyperFrames
(HTML + GSAP, optional Three.js). You own a run of frames (scenes) and must deliver them at
**professional music-video quality**. Read this file, then `STORYBOARD.md` (your frames + cast +
recurring devices), then the reference frame(s) the orchestrator built (`compositions/frames/01-*.html`),
which show the house style and how the kit is used.

Project root: `{{PROJECT_DIR}}`

## 1. What exists

| Path | What |
|---|---|
| `STORYBOARD.md` | the plan: frame spans (TRACK seconds), story beats, copy, receipts, cast, continuity rules |
| `index.html` | assembled root — do NOT edit (mounts frames + captions overlay + music, loads the kit) |
| `compositions/frames/NN-id.html` | one file per frame; yours hold placeholders → replace them |
| `compositions/captions.html` | karaoke caption bar (orchestrator-owned) — see the storyboard for which sections have captions |
| `assets/kit/kit.css`, `kit.js`, `kit3d.js` | the shared kit (`window.KIT`, ES module `kit3d.js`) — API in `{{SKILL_DIR}}/references/kit-api.md` |
| `assets/theme.css`, `assets/theme.js` | this project's look (palette/fonts) layered over the kit |
| `assets/kit/song.js` | `window.SONG` — beats, downbeats, sung words, lyric lines, sections |
| `assets/shots/*.jpg` + `rects.json` | real screenshots (receipts) + measured rects of headlines / key phrases |
| `assets/logos/*.svg` | brand logos |
| `node {{SKILL_DIR}}/scripts/words.mjs <t0> <t1>` | every sung word / beat / hit in a range, TRACK and LOCAL seconds |

Only edit your own frame files. If you need a kit feature, write a namespaced frame-local helper and mention it in your report.

## 2. Frame contract (violations = broken render)

```html
<!doctype html><html><head><meta charset="UTF-8" /></head><body>
<template>
  <style> #root { position:absolute; inset:0; overflow:hidden; } /* + namespaced styles */ </style>
  <div id="root" data-composition-id="NN-id" data-width="1920" data-height="1080" data-duration="<span length>"> … </div>
  <script> (function(){ const tl = gsap.timeline({ paused: true }); /* build */ window.__timelines["NN-id"] = tl; })(); </script>
  <!-- optional 3D: <script type="module"> import * as K3 from "./assets/kit/kit3d.js"; const tl = window.__timelines["NN-id"]; KIT.onFrame(tl, t => {…; W.render();}); </script> -->
</template></body></html>
```
- `data-composition-id` == filename stem == timeline key; `data-duration` == storyboard duration.
- All `<style>`/`<script>` inside `<template>`; style the root as `#root`; paths are relative to the ROOT document (`assets/...`).
- Namespace every id/class with your frame prefix (`f06-…`) — all frames share one document.
- Deterministic only: no `Date.now`, `Math.random` (use `KIT.rng(seed)`), no network, no rAF, no CSS animations/transitions.
- One WebGL canvas per frame at most; register the GSAP timeline in the classic script first; the module script only hooks rendering.

## 3. Seek-safety (the #1 source of silent bugs — read twice)

The renderer seeks to arbitrary times, forwards and backwards, in parallel workers.
1. **Declare every element's t=0 state twice** — `KIT.init(tl, sel, props)` does both: immediately at build time AND on the timeline at 0 (use `KIT.now` for mascot faces/poses/badges). A `tl.set` at exactly t=0 is not rendered on the very first frame, so without the immediate set your frame's first frame shows the raw CSS state (a one-frame flash of the end state).
2. A `fromTo()` that starts later applies its **from-values to every earlier moment** on backward seeks. For hits whose start state is visible (flashes, punches, squashes, sirens, tints) use `tl.set(el, from, t)` + `tl.to(el, to, t + 0.001)`. KIT helpers already do this.
3. `fromTo` is fine when the from-state is the hidden/neutral state you also set at 0.
4. One property on one element = one non-overlapping sequence of tweens.
4b. Never toggle `className` on the timeline (`tl.set(el, {className})` doesn't revert on backward seeks); switch states with opacity or explicit style props.
5. Verify by snapshotting your times in REVERSE order too (catches leaks that forward order hides).

## 4. Timing — sync to the vocal, ride the beat

- Storyboard anchors are TRACK seconds; your file uses LOCAL seconds (`local = track − span_start`).
- Land text slams 0–40 ms before the word onset; reactive entrances 0–60 ms after. Whisper onsets are ±80 ms.
- `KIT.beatsIn(s0, s1)`, `KIT.beatsIn(s0, s1, {down:true})`, `KIT.wordsIn(s0, s1)` give local times.
- Captioned sections: keep load-bearing content out of the caption zone (bottom ~150 px). Uncaptioned sections (choruses/chants): your typography IS the lyric — every sung line must be readable.
- Your frame begins and ends on a hard cut: the first frame must be a composed image (never empty), and the last ~0.3 s sets up the cut (whip, push, flash, or a held pose that cuts on the downbeat).

## 5. Quality bar

- Every lyric line gets its own visual idea, landing on the key word. Gags land on the word — timing is the joke.
- Constant life on the beat (character grooves, ground/colour flips on downbeats, pulsing decorations). No frozen stretch > ~0.6 s unless it's a deliberate musical stop.
- Camera language: wrap the scene in a camera div; one big move per phrase (push-in, whip-pan, dolly), small accents per beat (punch, shake).
- Energy & the 2D+3D combo — meet the energy bar (`{{SKILL_DIR}}/references/visual-direction.md` §5: read its table and its "what the best video did on screen" list before you build). In numbers, across the whole video: 3D in ≥ 60% of frames, ≈ 16 `K3` 3D calls and ≈ 36 camera-div references per minute of song (grep counts over `compositions/frames/*.html`), ≥ 45 cuts/min in every chorus/hook, the breakdown and final chorus the densest. Your frames: a real 3D hero moment in ≥ 60% of them and in EVERY chorus (3D hook slabs), 3D Clawd (or the story's brand mascot) in chorus instrumentals/breakdowns, 3D props layered with the 2D stickers/receipts/characters, a camera move on every phrase, punches/shakes on hits, downbeat colour flips, no static hold > 0.6 s.
- Outfits: characters may dress for the scene (`KIT.outfit(id, "pitcrew")` etc., `KIT.outfitSwap` for an on-beat change). Change only at a scene cut or with a swap, keep one outfit per scene, follow the storyboard's outfit rules; identity never changes (AGENT blue + the channel badge; her pink + antenna bow + the same badge).
- Depth: background (ground + texture), midground (cards/receipts/props), foreground (characters, stickers). Tilt cards, overlap, bleed decorations off-edge.
- Hierarchy: one dominant element per moment; hero type 120–300 px; nothing load-bearing < 40 px; keep everything inside a 64 px margin even at the peak of a slam (scale from an edge, not the centre, so words never collide).
- Receipts: real screenshot big enough to read the headline (≥ 700 px wide), highlighter on the sung word, a source pill (outlet name only), hold ≥ 1.2 s.
- Standalone: never show an episode/track number, the video's title as a label, or release/publish dates (title cards, pills, receipt tags, end cards) unless the story needs them.
- Characters act: expressions follow meaning, lip-sync when the host sings, blinks, poses on accents. Keep mascots on-model (proportions!) and never crop them awkwardly.
- Facts: only what's in the storyboard/research. Label gags as gags; never invent numbers or quotes.
- Respect the storyboard's continuity rules (e.g. a costume/badge change that persists after a given time).

## 6. Self-review loop

```bash
npx hyperframes lint . 2>&1 | grep -E "<your ids>|error" | head -40
npx hyperframes snapshot . --at <track times> --no-end --describe false -o analysis/snaps-<you>
```
Snapshot 8–20 key moments per frame (every key word, every cut in/out), read the contact sheet and PNGs, fix, repeat. Also run one pass with the times in reverse order. Use only your own `-o` dir.

## 7. Thumbnail moments

While you build, design at least one moment per frame that would work as a YouTube thumbnail: ONE big idea, a big
expressive face (the host's LED face reads great: shock, tears, smug), a bold 1–3-word sticker word, high contrast, little clutter,
no caption bar under it (captions are hidden for thumbnail stills, so don't rely on them). Hold it ≥ 3 frames so it can be grabbed.
Append your best 1–3 to `analysis/thumbnail-moments.md`: `track time · frame · what's in it · why it would get clicked · suggested crop`.

## 8. Report back

Files written; 2–4 lines per frame describing what happens; your thumbnail moments; deviations from the storyboard and why; lint status; snapshot dir. Then stay available — critic feedback will come back to you.
