# Kit API (`assets/kit/`) — for whoever builds frames

Loaded by the root `index.html` before any frame mounts: `kit.css` → `theme.css` → `song.js` → `glyphs.js`
→ `kit.js` → `theme.js`. Everything is deterministic: builders return HTML strings; helpers only add
tweens/sets to the timeline you pass. Insert markup with `innerHTML` first, then rig, then build the timeline.

## window.SONG (song.js)
`duration, bpm, beats[], downbeats[], words[{w,s,e}], lines[{s,e,t,cap,w[],section}], sections[{id,s,e}], hits{surge,drop,silences}` — all TRACK seconds.

## Timing helpers
- `KIT.beatsIn(t0, t1, {down?})` → frame-local beat (or downbeat) times inside [t0,t1).
- `KIT.wordsIn(t0, t1)` → `[{w, s, e}]` local — feed `s` values to `KIT.talk` for lip-sync.
- `KIT.onFrame(tl, fn(localTime))` → per-frame render callback (canvas/Three.js). Multiple allowed.
- `KIT.init(tl, sel, props)` → seek-safe starting state (applied now AND at t=0). Use it for everything that animates later.
- `KIT.now(tl, t => { KIT.face(t, id, "smug", 0); … })` → run helpers immediately and at t=0 (a mascot's starting face/pose/badge).
- `KIT.rng(seed)` → deterministic PRNG.

## Motion helpers (all seek-safe: set + to, never fromTo-from-visible)
`KIT.punch(tl, sel, t, scale=1.14, dur)` · `KIT.shake(tl, sel, t, amp, dur, seed)` · `KIT.flash(tl, "#flashEl", t, peak, dur)`
· `KIT.bounce(tl, sel, times[], amt)` · `KIT.count(tl, el, from, to, t, dur, fmt, ease)` · `KIT.typeOn(tl, el, text, t, cps)`
· `KIT.split(el)` → per-char `.k-ch` spans · `KIT.marks(tl, "#receipt .k-mark", t, stagger)` (highlighter sweep).

## Markup builders
- `KIT.mascot({id, size=520, body = KIT.AGENT_BODY (blue #3ec1d3, the default), ear, eye:"green", badge:"A.I.", accessory, style, cls})` — viewBox 400×480, feet at the bottom.
  Accessories: `beret shades headset crown party`. Then `KIT.rig(id)` → `{all, head, armL, armR, body, eyes, bulb}` selectors with pivots set.
  - `KIT.face(tl, id, expr, t)` — `idle happy nervous shock sad dead wink love side angry cry focus sleep smug`
  - `KIT.pose(tl, id, pose, t, dur)` — `down wave hype shrug point raise hip think cover flex cheer`
  - `KIT.talk(tl, id, wordTimes[])` · `KIT.blink(tl, id, t)` · `KIT.wave(tl, id, times[])` · `KIT.groove(tl, id, beats[], amt)`
  - `KIT.badge(tl, id, "si"|"ai", t, {pop})` swaps the badge for the yellow sticker with a pop; pass `{pop:false}` (inside `KIT.now`) to set it silently at a frame's start
  - `KIT.sweat(tl, id, t)` · `KIT.tears(tl, id, t, on)`
- `KIT.femme(id)` — the female AGENT for female-voice lines: build `KIT.mascot({ id })`, `KIT.rig(id)`, then `KIT.femme(id)`: it recolours her shirt + ears to `KIT.FEMME` (pink) itself, idempotently, whatever body the mascot was built with, and adds the pink antenna bow, lashes and blush. AGENT stays `KIT.AGENT_BODY` (blue). `SONG.lines[i].voice` = `"m" | "f" | "duet"` once `voice_cast.py --write` + `build_song.py` ran.
- `KIT.outfit(id, name, {color})` — scene outfit layered into the rig (moves with head/body; pure markup, call after the mascot is in the DOM, before or after `KIT.femme`). Presets (`KIT.OUTFITS`): `mechanic` (backwards cap, overall straps, tool belt) · `racing` (goggles up, checkered scarf, suit stripes + checkered sash) · `pitcrew` (headset + mic, team vest) · `star` (translucent neon shades, gold chain, jacket lapels) · `reader` (round gold readers) · `party` (tilted party hat, bow tie) · `royal` (tilted crown, ermine collar, cape) · `none`. Compose your own: `KIT.outfit(id, {hat, eyes, neck, torso, back}, {name, color})` with parts `hat: capBack goggles headset crown partyHat` · `eyes: shades readers` · `neck: chain bowtie collar scarf` · `torso: overalls racesuit vest lapels` · `back: cape` (or raw SVG strings in the 400×480 viewBox). Identity is protected by construction: torso layers sit UNDER the chest badge, the shirt colour stays visible, her bow and the bulb stay above any hat, eyewear is translucent.
  - `KIT.outfitSwap(tl, id, name, t)` — pops a different outfit on at `t` (built hidden at call time, then set + to: seek-safe). Swap at a scene cut or on a beat; keep one outfit per scene.
- `KIT.chonk({id, size=620, sash:"LE CHONK", horn:true})` + `KIT.chonkRig(id)` + `KIT.chonkHonk(tl, id, t)` — gag character template.
- `KIT.horn({id, size})` — bulb horn prop (`#id-bulb`).
- `KIT.receipt({id, shot, url, tag, width, crop:[x,y,w,h], marks:[[x,y,w,h]…], markColor:""|"pink"|"green"|"outline"|"under", tagColor, style})` —
  `shot` = jpg name in `assets/shots`; crop/marks in the 1920-wide jpg's pixels (from `rects.json`). Dark pages need `markColor:"outline"`.
  On 4K renders it automatically loads `<shot>@2x.jpg` (written by `shoot.mjs`); force with `hires:true|false`. Raw `<img>` tags in frames should
  use the `@2x` file too if you want them sharp at 4K.
- `KIT.calendar({id, dow, day, month, year, color, style})` — tear-off day card (360×410).
- `KIT.star({id, size, color, points, inner, text, textSize, style})` · `KIT.tail("bl"|"br"|"tl"|"tr")` (inside `.k-bubble`) · `KIT.logo(name)` → `assets/logos/<name>.svg`.
- `KIT.theme({ink, paper, font, pink, …})` — re-skin the SVG builders (call in `assets/theme.js`).

## CSS atoms (kit.css)
Grounds `.k-ground .bg-{black,white,off,pink,blue,green,yellow,cream,red}` · textures `.k-dots .k-dots-light .k-halftone .k-sunburst .k-grain .k-stripes .k-hazard`
· cards `.k-card .k-card-sm .k-card-xl .k-pill(.lg) .k-dot` · type `.k-disp .k-h-{xxl,xl,lg,md,sm} .k-sticker-text(.thin) .k-shadow-text .k-label .k-body .k-mono`
· UI `.k-win .k-win-bar .k-term .k-bubble .k-stamp .k-censor .k-logo .k-flash`. Tokens: `--k-ink --k-paper --k-{pink,blue,green,yellow,cream,off,red,screen} --k-font-{display,label,mono}`.

## 3D (kit3d.js — ES module)
```js
import * as K3 from "./assets/kit/kit3d.js"; const { THREE } = K3;
const tl = window.__timelines["07-chant"];               // registered by the classic script
const W = K3.setup(canvas, { w:1920, h:1080, fov:30, cam:[0,0,30], ambient, key });
const txt = K3.text3d("S.I.", { size:6, depth:2, colors:["yellow","white","pink","white"], outline:0.18 }); W.scene.add(txt.group);
const cl = K3.clawd({ scale: 1 }); cl.group.position.set(0, -6, 0); W.scene.add(cl.group);
KIT.onFrame(tl, (t) => { cl.animate(t, { beat: KIT.beatsIn(s0, s1), hop: 0.3, wave: 1 }); W.render(); });
```
- `text3d(str, {size, depth, color|colors[], outline, tracking, bevel, align})` → `{group, letters:[{obj, mesh, ch}], width}`; each letter animates on its own. Glyphs come from `glyphs.js` (Inter Display Black; regenerate with `scripts/glyphs.mjs` for another royalty-free font). Text outlines use a crack-free "flat hull"; don't add `shadowOf` to letters with counters.
- `clawd({scale})` → `.animate(t, {walk, bounce, beat:[], hop, hopRate, wave, waveL, look, blink:[], squint, turn})`; body 5.6×3.5, feet at y=0.
- `box/cyl/sphere/coin`, `toon(color)`, `flat(color)`, `outline(mesh, thickness)`, `solid(geo, color, {outline})`, `shadowOf(obj)`, `rng`. COLORS keys: `black white off pink blue green yellow cream red claude screen orange`.
- `setup()` follows the render's device pixel ratio (1 at 1080p, 2 at 4K) so 3D stays sharp in 4K; one canvas per frame, everything a pure function of `t`.
  Custom 2D canvases must do the same: size the backing store at `cssSize × devicePixelRatio` and `ctx.scale(dpr, dpr)`.
