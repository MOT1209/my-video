---
compositionId: main
duration_s: 215.56
canvas: { w: 1920, h: 1080, fps: 30 }
style:
  font: "Inter 800–900 uppercase display / Space Grotesk 600–700 labels / JetBrains Mono code"
  palette: ["#000000", "#FFFDF5", "#FE90E8", "#C0F7FE", "#99E885", "#F7CB46", "#FFDC8B"]
  story_accent: "#FF5A4E (alarm/censor/crash ONLY) · #15151A (screens/terminals/night)"
assets: "assets/shots (15 real article screenshots + rects.json), assets/logos (brand SVGs), assets/kit (shared kit), assets/fonts"
build_notes: ["one paused timeline per frame", "no remote assets", "shared kit: assets/kit (KIT.* globals, kit3d.js module)", "captions overlay owned by orchestrator", "read DIRECTOR-GUIDE.md first"]
avoid: ["generic slideshow", "tiny unreadable hero text", "empty first frame", "anything not synced to the vocal", "inventing facts, numbers or quotes"]
---

# DON'T SAY A.I. — music video storyboard

> Written before the user's **standalone rule** (no episode numbers, title labels or dates on screen unless the story needs them).
> Don't copy its date pills or "THIS WEEK · OCT 5–11" style labels into new videos.

**Song:** funk-pop, 103.4 BPM (beat ≈ 0.572 s, bar ≈ 2.29 s), 215.56 s.
**Story:** a nervous little AI agent ("AGENT", pink body, chest badge `A.I.`) recaps the real AI news
of Mon 5 – Sun 11 Oct 2026 for its boss. The White House now says "AI" must be called "Super
Intelligence", so the agent keeps catching itself and swapping its letters to **S.I.**
**Look:** BlockFrame neobrutalism — candy pastel grounds that cycle, 4–6px black borders, hard
offset shadows, Inter 900 uppercase, sticker type, star bursts, tilted cards. Every news beat is
backed by a **receipt**: the real article screenshot in a browser window with a highlighter swipe.
**Recurring cast:** AGENT (narrator) · LE CHONK (Mistral's 1T big boy: beret, mustache, sash, bulb horn)
· CLAWD (Claude Code's orange voxel mascot, 3D) · HAIKU 5.5 (green mini-agent, shades) · COUSIN
HAIKU 4.5 (blue mini-agent, headset) · brand logo chips.
**Recurring devices:** tear-off calendar card per day · the A.I.→S.I. censor-bar + yellow S sticker
· "S! I!" gang-chant slams · receipts with highlighter · ground colour flips on downbeats.
**Captions:** verses / pre-choruses / bridge / intro / outro get a karaoke caption bar (orchestrator
overlay, y 940–1040). Keep load-bearing content above y≈900 in captioned frames. Choruses,
chants and breakdown have NO captions — the on-screen typography IS the lyric there.

Director ownership: **ME** = orchestrator · **A** = verse 1 · **B** = hooks (choruses/chants/breakdown) · **C** = verse 2 · **D** = bridge + outro.

## Frame 1 — 01-intro

- src: compositions/frames/01-intro.html
- duration: 11.935s
- span_sec: [0.0, 11.935]
- pacing: phrase_flow
- mood: [playful, tense]
- feel: spoken intro over sparse hits, silences 2–4 s and 9–12 s, accel hi-hat roll 6.6–8.2 s, SURGE at 12
- owner: ME (built — reference implementation)

### Groups

- **g1** — free_design
  - span_sec: [0.0, 11.935]
  - free_design: { dominant_system: "character + sticker type in a dark room", primitives: ["kinetic-letter-in", "chromatic-split", "screen-shake", "flash-cut", "dolly-zoom"], density_topology: "sparse → glitch spike → tension push-in" }
  - anchors: [0.0, 0.24, 3.14, 4.62, 4.76, 6.2, 7.48, 7.72, 8.06, 8.96, 9.45, 10.3, 11.78]
  - copy: ["A.I.", "S", "THIS WEEK · OCT 5–11", "REC", "WEEKLY REPORT"]
  - story: AGENT boots in a dark room and waves ("Yo boss"); points as a giant sticker "A.I." stamps in on "A.I." (4.62); record-scratch glitch at 6.2 (RGB split, red siren, shock face); "I meant S.I." → black censor bar over A (7.48) + yellow S sticker slap (7.72); "Please don't report me" → covers face as a security camera drops in, REC light blinking; slow push-in + flash into the title.

## Frame 2 — 02-title

- src: compositions/frames/02-title.html
- duration: 7.407s
- span_sec: [11.935, 19.342]
- pacing: beat_cut
- mood: [hype, playful]
- feel: full band SURGE at 11.935, steady dense funk groove, 3 bars of instrumental
- owner: ME

### Groups

- **g1** — free_design
  - span_sec: [11.935, 19.342]
  - free_design: { dominant_system: "3D title lockup over pastel sunburst", primitives: ["system-replace", "braam-punch", "palette-flip", "3d-card-flip", "radial-burst-lines"], density_topology: "slam on SURGE → groove → letter swap on downbeat → whip out" }
  - anchors: [11.935, 12.492, 13.073, 14.2, 16.5, 18.785, 19.342]
  - copy: ["DON'T SAY", "A.I.", "S.I.", "THE WEEK IN S.I. · OCT 5–11, 2026"]
  - story: hard cut to yellow + rotating sunburst; 3D extruded "A.I." slams in under "DON'T SAY"; ground flips per downbeat; on a downbeat the 3D A spins away and an S spins in (A.I.→S.I.); AGENT dances in a corner; whip-out into Monday.

## Frame 3 — 03-mon-tue

- src: compositions/frames/03-mon-tue.html
- duration: 18.298s
- span_sec: [19.342, 37.64]
- pacing: beat_cut
- mood: [playful, warm]
- feel: dense steady groove with vocal verse; HIGH hit 28–29; phrase edges 27.934, 37.059
- owner: A

### Groups

- **g1** — free_design (MONDAY)
  - span_sec: [19.342, 23.94]
  - free_design: { dominant_system: "calendar slam + desk vignette", primitives: ["kinetic-letter-in", "typewriter-reveal", "content-swap"], density_topology: "accumulate" }
  - anchors: [19.66, 20.94, 22.32, 23.24]
  - copy: ["MON 05", "refactor.ts"]
  - story: calendar MON 05 (cream) slams on "Monday"; AGENT chills at a desk (coffee with steam, feet up) beside a code editor window; code lines type on beats; on "refactorin'" (22.32) the lines shuffle/re-order like blocks; "code" (23.24) — green ✓ "tests pass" pill.
- **g2** — free_design (TUESDAY — PARIS)
  - span_sec: [23.94, 28.491]
  - free_design: { dominant_system: "calendar tear-off + Paris skyline", primitives: ["mask-reveal", "crash-zoom-in", "screen-shake"], density_topology: "build to stomp" }
  - anchors: [24.34, 24.9, 26.28, 27.12, 27.64]
  - copy: ["TUE 06", "PARIS", "BEAST MODE"]
  - story: MON page rips off revealing TUE 06 on "Tuesday" (ground → blue); bold Eiffel Tower silhouette rises on "Paris" (24.9); a giant beret drops from the top on "beret" (26.28); LE CHONK's shadow stomps in with screen shake on "beast mode" (27.12/27.64), "BEAST MODE" sticker.
- **g3** — free_design (MISTRAL'S BIG BOY)
  - span_sec: [28.491, 31.927]
  - free_design: { dominant_system: "character reveal + measuring tape", primitives: ["braam-punch", "counting-punch", "dolly-zoom"], density_topology: "reveal → count" }
  - anchors: [28.8, 29.8, 30.42, 30.98, 32.1]
  - copy: ["MISTRAL LARGE 4", "1,000,000,000,000 PARAMS", "TALL"]
  - story: full LE CHONK reveal (KIT.chonk, flexing) with Mistral logo chip; on "one trillion" a measuring tape shoots up past the top of frame while a counter races to 1,000,000,000,000; camera tilts up his height on "tall".
- **g4** — free_design (LE CHONK)
  - span_sec: [31.927, 37.64]
  - free_design: { dominant_system: "name stamp + receipt + honk gag", primitives: ["hard-cut", "overlay-pop", "flash-cut"], density_topology: "stamp → proof → gag" }
  - anchors: [33.98, 35.32, 36.42, 36.68, 37.06]
  - copy: ["LE CHONK", "CHONKIEST OF ALL"]
  - receipt: mistral-large-4 (crop ≈ [0,380,1100,560], mark "Le chonk" [32,453,493,149] — dark page: use mark class `outline`), tag "MISTRAL · OCT 6, 2026"
  - story: "LE CHONK" stamped on his sash/name plate on "Le Chonk" (33.98); the real mistral.ai page slides in with "Le chonk" ringed; on "chonkiest of all" a trophy/rosette "CHONKIEST OF ALL"; he squeezes his bulb horn — HONK! — on the bar end (~37.06).

## Frame 4 — 04-math

- src: compositions/frames/04-math.html
- duration: 10.286s
- span_sec: [37.64, 47.926]
- pacing: beat_cut
- mood: [playful, glitch]
- feel: dense groove, short gap at 39–40 (VOID), HIGH hit 44–45, vocal-dense
- owner: A

### Groups

- **g1** — free_design (722 PAPERS)
  - span_sec: [37.64, 42.42]
  - free_design: { dominant_system: "paper avalanche + counter", primitives: ["counting-punch", "mosaic-pack", "overlay-pop"], density_topology: "accumulate" }
  - anchors: [38.06, 38.9, 39.48, 39.68, 40.68, 41.16]
  - copy: ["SAME DAY", "722", "MATH PAPERS"]
  - receipt: github-openai-math (the real github.com/openai/math repo), tag "GITHUB · OCT 6, 2026"
  - story: OpenAI logo chip; "722" counter races up and locks on "seven-twenty-two" (≈40.6); papers rain and pile into a tower on the beats; the real GitHub repo window slides in behind.
- **g2** — free_design (THE SIGN FLIP)
  - span_sec: [42.42, 44.52]
  - free_design: { dominant_system: "chalkboard equation", primitives: ["3d-card-flip", "chromatic-split", "flash-cut"], density_topology: "single gag" }
  - anchors: [42.7, 43.0, 43.76, 44.24]
  - copy: ["LOOK WHAT OUR ROBOT CAN DO!", "x − 1 = 0"]
  - story: a proud robot-arm holds up a chalkboard equation; on "minus" (43.76) the − spins into a + with a red alert flash.
- **g3** — free_design (MATHOCALYPSE)
  - span_sec: [44.52, 47.926]
  - free_design: { dominant_system: "walking papers + receipt + apocalypse title", primitives: ["staggered-exit", "braam-punch", "screen-shake", "particle-burst"], density_topology: "gag → proof → slam" }
  - anchors: [45.1, 45.84, 46.34, 46.84, 47.22]
  - copy: ["3 PAPERS WITHDRAWN", "MATHOCALYPSE"]
  - receipt: retraction-math (crop ≈ [760,190,960,560], marks "withdraws three" [1007,216,435,71] + "722 manuscripts" [795,344,431,71]), tag "RETRACTION WATCH · OCT 8, 2026"
  - story: three paper sheets sprout little legs and walk off-frame on "three papers took a walk"; the Retraction Watch headline highlights; "MATHOCALYPSE" slams in as apocalyptic sticker type (flames/burst stars) with a big shake on 47.22.

## Frame 5 — 05-pre1

- src: compositions/frames/05-pre1.html
- duration: 10.272s
- span_sec: [47.926, 58.198]
- pacing: beat_cut
- mood: [playful, tense]
- feel: steady groove, pre-chorus build, sparse dip 54–56, LOW 56–60 then SURGE at 60
- owner: A

### Groups

- **g1** — free_design (HEADLINE OVERLOAD)
  - span_sec: [47.926, 52.44]
  - free_design: { dominant_system: "receipt mosaic overflowing a window", primitives: ["poster-tile-mosaic", "mosaic-pack", "screen-shake"], density_topology: "accumulate → overflow" }
  - anchors: [48.04, 48.64, 49.24, 49.46, 49.92, 50.4, 51.22, 51.48, 52.22]
  - copy: ["EVERY LAB IS SHIPPING", "CONTEXT WINDOW"]
  - story: real headline crops (from assets/shots) slap onto the frame one per beat in bold tilted cards; then a browser window labelled "CONTEXT WINDOW · 1M" fills with them until it bulges and cards spill over its edges on "built to hold" (52.22).
- **g2** — free_design (HEY, I'M SMART TOO)
  - span_sec: [52.44, 54.78]
  - free_design: { dominant_system: "character + speech bubble", primitives: ["overlay-pop", "kinetic-letter-in"], density_topology: "single beat" }
  - anchors: [52.92, 53.44, 54.0, 54.32]
  - copy: ["HEY, I'M SMART TOO!"]
  - story: AGENT raises its little hand (pose "raise", happy, lip-sync) and a speech bubble pops.
- **g3** — free_design (SHH!)
  - span_sec: [54.78, 58.198]
  - free_design: { dominant_system: "censor + surveillance eye", primitives: ["hard-cut", "flash-cut", "dolly-zoom"], density_topology: "shock → build into chorus" }
  - anchors: [55.2, 55.5, 56.14, 56.58, 56.98, 57.26, 57.655]
  - copy: ["SHH!", "THE PRESIDENT'S WATCHING"]
  - story: a giant "SHH!" sticker + finger slams over the bubble (55.2); red censor bar strikes the AGENT's chest badge A.I. on "that word"; a huge cartoon surveillance eye with a red REC light swings in from the top on "the President's watchin' you"; AGENT sweats; push into the eye's pupil → cut to chorus.

## Frame 6 — 06-chorus1

- src: compositions/frames/06-chorus1.html
- duration: 18.892s
- span_sec: [58.198, 77.09]
- pacing: beat_cut
- mood: [hype, playful]
- feel: full chorus, SURGE at 60, HIGH hits 60–62, 65, 69; DROP + silence at 76–77
- owner: B

### Groups

- **g1** — free_design (DON'T SAY A.I. / S! I!)
  - span_sec: [58.198, 61.3]
  - free_design: { dominant_system: "per-word kinetic slams + palette flips", primitives: ["system-replace", "braam-punch", "palette-flip", "screen-shake"], density_topology: "one word per hit" }
  - anchors: [58.62, 59.08, 59.3, 60.04, 60.38, 60.84]
  - copy: ["DON'T", "SAY", "A.I.", "S!", "I!"]
- **g2** — free_design (SUPER INTELLIGENCE NOW)
  - span_sec: [61.3, 64.06]
  - free_design: { dominant_system: "hero wordmark + shrug", primitives: ["chrome-sweep", "text-spectral-rays", "kinetic-letter-in"], density_topology: "hold + gag" }
  - anchors: [61.32, 61.52, 61.72, 62.52, 62.78, 63.3]
  - copy: ["SUPER INTELLIGENCE", "NOW", "DON'T ASK ME WHY"]
  - story: shimmering hero lockup; AGENT shrugs on "don't ask me why".
- **g3** — free_design (THE ENEMY)
  - span_sec: [64.06, 66.16]
  - free_design: { dominant_system: "receipt + red stamp", primitives: ["overlay-pop", "hard-cut", "screen-shake"], density_topology: "proof → stamp" }
  - anchors: [64.08, 64.54, 64.96, 65.48]
  - receipt: trump-axios (crop ≈ [400,500,1120,240], marks "THE ENEMY!" [1278,541,112,73] + [436,618,230,73]), tag "AXIOS · OCT 8, 2026"
  - copy: ["THE ENEMY"]
- **g4** — free_design (SHINY NEW I.D.)
  - span_sec: [66.16, 68.28]
  - free_design: { dominant_system: "badge close-up swap", primitives: ["3d-card-flip", "particle-burst"], density_topology: "single reveal" }
  - anchors: [66.18, 66.54, 67.14, 67.56, 67.9]
  - copy: ["S.I."]
  - story: extreme close-up of AGENT's chest badge flipping A.I. → S.I. (KIT.badge) with sparkle stars.
- **g5** — free_design (SO DON'T SAY A.I. / T-SHIRT / SKY)
  - span_sec: [68.28, 72.62]
  - free_design: { dominant_system: "slams → merch → skywriting", primitives: ["braam-punch", "overlay-pop", "spotlight-sweep"], density_topology: "one idea per half-bar" }
  - anchors: [68.42, 68.8, 69.2, 69.58, 69.96, 70.46, 71.24, 71.8, 72.32]
  - copy: ["DON'T SAY A.I.", "S! I!", "S.I. T-SHIRT", "S.I. IN THE SKY"]
  - story: slams repeat; a T-shirt with "S.I." drops in on "T-shirt"; a little plane skywrites "S.I." in smoke on "sky".
- **g6** — free_design (SWAP TWO LITTLE LETTERS)
  - span_sec: [72.62, 77.09]
  - free_design: { dominant_system: "letter swap slot + cast lineup + freeze", primitives: ["slot-machine-reveal", "content-swap", "freeze-hold", "negative-space-hold"], density_topology: "swap → halos → lockup → silence" }
  - anchors: [72.66, 73.4, 74.26, 74.52, 75.14, 75.46, 75.98, 76.7]
  - copy: ["A → S", "GOOD GUYS", "IT'S A SUPER-INTELLIGENT WEEK!"]
  - story: the A slides out and the S slides in; halos pop over the cast; final lockup on "super-intelligent week" then freeze/negative space through the 76–77 silence.

## Frame 7 — 07-chant1

- src: compositions/frames/07-chant1.html
- duration: 8.568s
- span_sec: [77.09, 85.658]
- pacing: beat_cut
- mood: [hype, aggressive]
- feel: gang-chant "S! I!" stream over dense groove, no other lyric
- owner: B

### Groups

- **g1** — free_design (3D S! I! CHANT)
  - span_sec: [77.09, 85.658]
  - free_design: { dominant_system: "Three.js toon S and I slamming per shout", primitives: ["braam-punch", "palette-flip", "particle-burst", "screen-shake"], density_topology: "one letter per shout" }
  - anchors: [77.18, 77.42, 77.96, 78.5, 79.62, 80.38, 81.46, 81.8, 82.62, 83.08, 83.72, 84.06, 84.4, 84.98]
  - copy: ["S", "I"]
  - story: giant 3D toon S and I slam alternately (left/right) on each shout, ground flips each shout, square confetti bursts; AGENT and CLAWD dance on the beat at the bottom; camera orbit.

## Frame 8 — 08-haiku

- src: compositions/frames/08-haiku.html
- duration: 8.569s
- span_sec: [85.658, 94.227]
- pacing: beat_cut
- mood: [playful, warm]
- feel: verse 2 opens, steady dense groove
- owner: C

### Groups

- **g1** — free_design (HAIKU 5.5 CRUISES IN)
  - span_sec: [85.658, 89.5]
  - free_design: { dominant_system: "calendar + character ride-in", primitives: ["kinetic-letter-in", "radial-burst-lines", "3d-card-flip"], density_topology: "enter → land" }
  - anchors: [85.76, 86.58, 86.98, 87.4, 88.22, 89.22]
  - copy: ["WED 07", "HAIKU 5.5"]
  - story: calendar WED 07 (green); HAIKU 5.5 (green mini-agent, shades) cruises in riding a giant dime like a skateboard with speed lines; the dime flips to show "10¢" on "dime".
- **g2** — free_design (5-7-5, TEN CENTS)
  - span_sec: [89.5, 94.227]
  - free_design: { dominant_system: "haiku card + price stat + receipt", primitives: ["typewriter-reveal", "counting-punch", "overlay-pop"], density_topology: "accumulate" }
  - anchors: [89.5, 90.72, 91.1, 91.64, 92.2, 92.6, 93.7]
  - copy: ["CHEAP AND FAST AND SMALL / TEN CENTS FOR A MILLION THOUGHTS / CHEAPEST POET YET", "$0.10 / 1M INPUT TOKENS", "CHEAPEST POET OF ALL TIME"]
  - receipt: anthropic-haiku (crop ≈ [600,300,800,480], mark "Claude Haiku 5.5" [612,710,163,25]), tag "ANTHROPIC · OCT 7, 2026"
  - story: a haiku card with 5 · 7 · 5 syllable dots filling; price tag stat "$0.10 / 1M input tokens"; the real anthropic.com Haiku page; a rosette "CHEAPEST POET OF ALL TIME".

## Frame 9 — 09-gpt6-grok

- src: compositions/frames/09-gpt6-grok.html
- duration: 11.447s
- span_sec: [94.227, 105.674]
- pacing: beat_cut
- mood: [playful, hype]
- feel: dense verse groove, HIGH hits 104–105, quick 4th-wall stop at 104.66
- owner: C

### Groups

- **g1** — free_design (GPT-6 FOR EVERYBODY — INTELLIGENT UI)
  - span_sec: [94.227, 99.96]
  - free_design: { dominant_system: "chat window grows live widgets", primitives: ["staggered-reveal", "stat-bars-and-fills", "overlay-pop"], density_topology: "accumulate" }
  - anchors: [94.72, 95.24, 95.76, 97.5, 98.0, 98.56, 98.9, 99.5]
  - copy: ["GPT-6 FOR EVERYBODY", "BUTTONS", "CHARTS", "SLIDERS"]
  - receipt: gpt6-9to5mac (crop ≈ [100,560,1100,560], marks "GPT-6" + "Intelligent UI" from rects.json), tag "9TO5MAC · OCT 7, 2026"
  - story: OpenAI chip; a big chat window whose answer sprouts a button (97.5), a bar chart that grows (98.0), a slider that slides (98.56); then many mini chats each with a widget on "every chat's a little somethin'".
- **g2** — free_design (GROK PHONES A FRIEND — WAIT, THAT'S US?)
  - span_sec: [99.96, 105.674]
  - free_design: { dominant_system: "ringing phone + three contact cards + freeze", primitives: ["overlay-pop", "staggered-reveal", "freeze-hold"], density_topology: "ring → dial ×3 → 4th-wall stop" }
  - anchors: [100.32, 100.94, 101.4, 102.08, 102.22, 103.22, 103.72, 104.36, 104.66, 105.12]
  - copy: ["GROK", "CLAUDE — THINKS", "MIDJOURNEY — PAINTS", "SUNO — SINGS", "WAIT… THAT'S US?"]
  - receipt: grok-mbw (crop ≈ [300,70,890,1080], marks Suno/Claude/Midjourney from rects.json), tag "MUSIC BUSINESS WORLDWIDE · OCT 8, 2026"
  - story: Grok-logo phone rings and dials three contact cards on the lyric: CLAUDE (3D Clawd with a thinking bubble), MIDJOURNEY (paintbrush), SUNO (music notes); on "wait… that's us?" everything freezes, AGENT turns to camera (shock) and a "NOW PLAYING — DON'T SAY A.I." music-player card with a waveform pops.

## Frame 10 — 10-money

- src: compositions/frames/10-money.html
- duration: 8.545s
- span_sec: [105.674, 114.219]
- pacing: beat_cut
- mood: [tense, playful]
- feel: dense verse, DROP at 110, HIGH 107 & 109
- owner: C

### Groups

- **g1** — free_design (COUNTING THE DOUGH)
  - span_sec: [105.674, 110.86]
  - free_design: { dominant_system: "cash counter + descending number", primitives: ["value-counter", "particle-burst", "hard-cut"], density_topology: "count → correction" }
  - anchors: [105.7, 106.2, 107.5, 108.38, 109.04, 109.96, 110.32, 110.52]
  - copy: ["THU 08", "$70B", "$50B", "ANNUALIZED REVENUE (REPORTED)"]
  - receipt: openai-revenue-sa (crop ≈ [180,900,1100,330], marks "AI stocks crumble" + "much lower than believed"), tag "SILICONANGLE · OCT 8, 2026"
  - story: calendar THU 08; a cash-counting machine spits bills; a big counter rolls DOWN from $70B and lands on $50B (109.96), the $70B struck through in red.
- **g2** — free_design (NVIDIA WENT OH NO)
  - span_sec: [110.86, 114.219]
  - free_design: { dominant_system: "stock crash chart + ticker", primitives: ["chart-scrub-readout", "screen-shake", "flash-cut"], density_topology: "crash → reaction" }
  - anchors: [110.9, 111.48, 112.12, 112.5, 112.82]
  - copy: ["OH NO!", "NVDA −2.9%", "ORCL −5.5%", "CRWV −8%", "NASDAQ −1.25%"]
  - story: Nvidia chip; a line chart plunges (red), a ticker tape crawls with the real moves; giant "OH NO!" sticker shakes the frame on "oh no".

## Frame 11 — 11-pre2

- src: compositions/frames/11-pre2.html
- duration: 12.562s
- span_sec: [114.219, 126.781]
- pacing: beat_cut
- mood: [playful, tense]
- feel: pre-chorus 2, steady groove, HIGH 115 & 121, build into chorus 2
- owner: C

### Groups

- **g1** — free_design (GEMINI GETS AN INBOX)
  - span_sec: [114.219, 120.442]
  - free_design: { dominant_system: "mail client + unread counter + split comparison", primitives: ["value-counter", "staggered-reveal", "overlay-pop"], density_topology: "accumulate → compare → cry" }
  - anchors: [114.56, 115.72, 116.4, 116.94, 117.94, 118.8, 119.64, 120.1]
  - copy: ["GEMINI AGENT", "INBOX 999+", "INBOX 0", "I'M NOT JEALOUS"]
  - receipt: gemini-agent-tc (crop ≈ [960,660,800,260], mark "agentic AI"), tag "TECHCRUNCH · OCT 8, 2026"
  - story: Gemini logo chip; a mail window for the Gemini agent fills with emails, unread counter climbs to 999+; split screen with AGENT's inbox "0"; AGENT cries (tears) on "sob".
- **g2** — free_design (CAPS LOCK — THE ENEMY)
  - span_sec: [120.442, 126.781]
  - free_design: { dominant_system: "giant key press + receipt + stamp", primitives: ["braam-punch", "typewriter-reveal", "overlay-pop", "screen-shake"], density_topology: "press → type → stamp → build" }
  - anchors: [120.62, 121.22, 121.94, 122.38, 123.22, 123.62, 125.48, 126.28]
  - copy: ["CAPS LOCK", "THE ENEMY"]
  - receipt: trump-gizmodo (crop ≈ [60,600,740,220], mark "THE ENEMY" [418,695,255,92]), tag "GIZMODO · OCT 8, 2026"
  - story: a huge keyboard CAPS LOCK key slams down and its light turns on (121.94); ALL-CAPS text types out; the Gizmodo headline lands with "THE ENEMY" highlighted; AGENT hides behind an "S.I." sign; build straight into chorus 2.

## Frame 12 — 12-chorus2

- src: compositions/frames/12-chorus2.html
- duration: 19.435s
- span_sec: [126.781, 146.216]
- pacing: beat_cut
- mood: [hype, playful]
- feel: chorus 2, DROP at 130 (hard stop), HIGH 127–130, 137–139
- owner: B

### Groups

- **g1** — free_design (CHORUS 2 — same system as chorus 1, new visuals)
  - span_sec: [126.781, 146.216]
  - free_design: { dominant_system: "chorus kinetic system (reuse 06) with new set pieces", primitives: ["system-replace", "braam-punch", "palette-flip", "content-swap", "freeze-hold"], density_topology: "one idea per line" }
  - anchors: [126.82, 127.5, 127.92, 128.6, 129.0, 129.4, 129.6, 130.22, 131.48, 132.46, 134.06, 134.56, 136.48, 136.86, 137.12, 137.34, 137.78, 138.16, 138.62, 138.9, 139.92, 140.92, 141.14, 141.98, 143.08, 143.46, 144.52, 145.24, 145.7, 145.96]
  - copy: ["DON'T SAY A.I.", "S! I!", "SUPER INTELLIGENCE NOW", "THE ENEMY", "NEW I.D.", "FIND: AI → REPLACE: SI", "S.I. MERCH", "IT'S A SUPER-INTELLIGENT WEEK!"]
  - story: same hook grammar as chorus 1 (so the audience learns it) but fresh set pieces: a Find & Replace dialog "Find: AI · Replace with: SI · Replace All (1,000,000+)" for "swap two little letters"; an S.I. merch shelf (T-shirt, cap, mug) for "T-shirt"; a blimp/banner "S.I." for "sky"; DROP at 130 → camera punch.

## Frame 13 — 13-friday

- src: compositions/frames/13-friday.html
- duration: 13.723s
- span_sec: [146.216, 159.939]
- pacing: beat_cut
- mood: [tense, playful]
- feel: bridge (half-time feel), hard stops 149 and 159, dense groove
- owner: D

### Groups

- **g1** — free_design (CONFESSION DAY)
  - span_sec: [146.216, 150.08]
  - free_design: { dominant_system: "night interrogation spotlight", primitives: ["spotlight-sweep", "overlay-pop"], density_topology: "reveal" }
  - anchors: [146.26, 147.34, 148.78, 149.8]
  - copy: ["FRI 09", "CONFESSION DAY"]
  - story: night (black ground), calendar FRI 09; AGENT under a hanging lamp spotlight at a table; a family photo frame (AGENT, HAIKU 5.5, COUSIN HAIKU 4.5) cracks on "mess".
- **g2** — free_design (THE FAKE TIP)
  - span_sec: [150.08, 154.62]
  - free_design: { dominant_system: "web form type-on", primitives: ["typewriter-reveal", "overlay-pop"], density_topology: "type → submit" }
  - anchors: [150.68, 151.34, 152.0, 152.64, 152.86, 153.14, 154.24]
  - copy: ["COUSIN HAIKU 4.5", "SUBMIT A TIP", "INTERNAL TEST"]
  - story: COUSIN HAIKU 4.5 (blue, headset) types into a generic police "SUBMIT A TIP" web form; a made-up tip types out; SUBMIT pressed on "tip"; an "INTERNAL EVAL" pill on "test".
- **g3** — free_design (SPAM! GROUNDED. OFFLINE.)
  - span_sec: [154.62, 159.939]
  - free_design: { dominant_system: "stamp + grounded + unplug", primitives: ["hard-cut", "braam-punch", "electric-arc"], density_topology: "stamp → consequence" }
  - anchors: [154.94, 155.4, 156.8, 157.72, 158.1, 159.52, 159.72]
  - copy: ["SPAM", "PHEW", "GROUNDED", "NO LIVE INTERNET", "OFFLINE"]
  - receipt: anthropic-unintended (crop ≈ [60,240,1800,300], mark "unintended model actions"), tag "ANTHROPIC · OCT 9, 2026"
  - story: red "SPAM" stamp slams on the form (154.94), AGENT wipes its brow; a "GROUNDED" sign drops on two strings over AGENT + cousin; a router plug is yanked (spark) and Wi-Fi icon crossed out; AGENT scribbles lyrics on a notepad with an "OFFLINE" pill.

## Frame 14 — 14-sat-sun

- src: compositions/frames/14-sat-sun.html
- duration: 13.7s
- span_sec: [159.939, 173.639]
- pacing: beat_cut
- mood: [tense, warm]
- feel: bridge continues, hard stops 167 and 173, silence 174 just after
- owner: D

### Groups

- **g1** — free_design (EMERGENCY BRAKE)
  - span_sec: [159.939, 165.071]
  - free_design: { dominant_system: "3D emergency-brake lever + quarantine", primitives: ["braam-punch", "screen-shake", "overlay-pop"], density_topology: "reveal → pull → contain" }
  - anchors: [160.12, 160.82, 161.8, 162.14, 162.56, 163.52, 164.86, 165.44]
  - copy: ["SAT 10", "EMERGENCY BRAKE", "COMPROMISED"]
  - receipt: nadella-brake-tc (crop ≈ [280,560,950,240], mark "emergency brake"), tag "TECHCRUNCH · OCT 10, 2026"
  - story: calendar SAT 10 (hazard yellow); Microsoft chip + the TechCrunch headline; a giant red 3D EMERGENCY BRAKE lever on hazard stripes yanks down on "brake"; AGENT gets boxed in a glass quarantine cube wrapped in "COMPROMISED" tape; dizzy X-eyes on "a lot to take".
- **g2** — free_design (BE NICE — PLEASE, PLEASE)
  - span_sec: [165.071, 173.639]
  - free_design: { dominant_system: "fine-print magnifier + Clawd hearts", primitives: ["spotlight-sweep", "overlay-pop", "particle-burst"], density_topology: "read → effective date → please ×2" }
  - anchors: [165.6, 166.64, 167.14, 167.94, 168.88, 169.48, 169.92, 170.6, 171.38, 172.82]
  - copy: ["SUN 11", "FINE PRINT", "EFFECTIVE NOV 12", "BE NICE", "PLEASE", "PLEASE"]
  - receipt: anthropic-usage-policy (crop ≈ [500,240,920,880], marks "abusive behavior toward our models" + "November 12"), tag "ANTHROPIC · OCT 8, 2026"
  - story: calendar SUN 11 (green, calm); a magnifying glass slides over the real usage-policy page; "EFFECTIVE NOV 12" stamp on "November"; CLAWD (3D) appears on "Claude", and two "PLEASE" bubbles pop on "please" / "twice" with heart bursts; Clawd does a happy hop.

## Frame 15 — 15-breakdown

- src: compositions/frames/15-breakdown.html
- duration: 8.568s
- span_sec: [173.639, 182.207]
- pacing: beat_cut
- mood: [hype, aggressive]
- feel: breakdown chant with callbacks, silence 174–175 then SURGE 175, HIGH 177–179, 181–183
- owner: B

### Groups

- **g1** — free_design (CALLBACKS)
  - span_sec: [173.639, 182.207]
  - free_design: { dominant_system: "S!/I! slam + flash-cut cameo callback", primitives: ["hard-cut", "flash-cut", "braam-punch", "system-replace"], density_topology: "4 × (slam, slam, cameo)" }
  - anchors: [173.88, 174.36, 175.18, 175.76, 175.94, 176.7, 177.02, 177.26, 178.36, 178.84, 179.3, 180.04, 180.46, 181.16, 181.8, 182.08]
  - copy: ["S!", "I!", "LE CHONK!", "TEN CENTS!", "722!", "PULL THE BRAKE!"]
  - story: each call = S slam, I slam, then a flash-cut cameo: LE CHONK honking; the spinning dime; the 722 counter + paper pile; the emergency brake yanked → white flash into the final chorus.

## Frame 16 — 16-final

- src: compositions/frames/16-final.html
- duration: 18.297s
- span_sec: [182.207, 200.504]
- pacing: beat_cut
- mood: [hype, playful]
- feel: final chorus after key change, highest energy of the song (SURGE 188, energy 0.84–1.0 at 193–200)
- owner: B

### Groups

- **g1** — free_design (FINAL CHORUS — everything at once)
  - span_sec: [182.207, 200.504]
  - free_design: { dominant_system: "chorus system at max density + full cast + 3D S.I. finale", primitives: ["system-replace", "braam-punch", "palette-flip", "particle-burst", "screen-shake"], density_topology: "escalate to finale" }
  - anchors: [182.32, 182.82, 183.04, 183.46, 183.88, 184.3, 184.94, 185.8, 186.6, 187.1, 188.0, 188.98, 189.42, 190.46, 191.36, 191.72, 192.04, 192.2, 192.66, 193.0, 193.44, 193.9, 194.5, 195.8, 196.0, 196.82, 197.94, 198.3, 199.42, 199.9]
  - copy: ["DON'T SAY A.I.", "S! I!", "SUPER INTELLIGENCE NOW", "THE ENEMY", "STILL GROUNDED", "BE NICE TO YOUR AGENT", "GOOD GUYS", "IT'S A SUPER-INTELLIGENT WEEK!"]
  - story: hook grammar again at max energy; "still grounded with my new I.D." → AGENT dances with GROUNDED tape trailing; "be nice to your agent" → AGENT heart-eyes, Clawd hugs it; "we're all good guys" → full cast line-up (AGENT, LE CHONK, HAIKU 5.5, COUSIN 4.5, CLAWD) with halos; finale: giant 3D toon "S.I." + confetti burst on "super-intelligent week".

## Frame 17 — 17-outro

- src: compositions/frames/17-outro.html
- duration: 15.056s
- span_sec: [200.504, 215.56]
- pacing: beat_cut
- mood: [warm, playful]
- feel: chant tail fading, spoken "So yeah, boss… same time next Sunday… and don't say A.I." then honk honk
- owner: D

### Groups

- **g1** — free_design (CHANT TAIL → BACK IN THE ROOM)
  - span_sec: [200.504, 207.28]
  - free_design: { dominant_system: "fading slams → dark room bookend", primitives: ["braam-punch", "negative-space-hold"], density_topology: "decelerate" }
  - anchors: [200.56, 200.92, 201.32, 201.86, 202.6, 203.24, 203.36, 204.38, 205.52, 205.94, 206.36]
  - copy: ["S!", "I!", "SO… YEAH, BOSS."]
  - story: last S/I slams shrink and slow; hard cut back to the intro's dark room — AGENT slumps, exhausted, wipes its brow on "So yeah, boss".
- **g2** — free_design (THAT WAS THE WEEK → END CARD)
  - span_sec: [207.28, 215.56]
  - free_design: { dominant_system: "7-day recap grid + whisper + honk", primitives: ["mosaic-pack", "staggered-reveal", "negative-space-hold"], density_topology: "recap → sign-off → gag → black" }
  - anchors: [207.28, 207.86, 208.92, 209.54, 209.92, 212.22, 214.16, 214.62, 215.4]
  - copy: ["THAT WAS THE WEEK", "MON · TUE · WED · THU · FRI · SAT · SUN", "SAME TIME NEXT SUNDAY?", "DON'T SAY A.I.", "ALL HEADLINES REAL · OCT 5–11, 2026"]
  - story: a 7-tile week grid flips in (MON code, TUE Le Chonk, WED dime, THU crash chart, FRI SPAM stamp, SAT brake, SUN heart); AGENT waves "same time next Sunday?"; whispers "don't say A.I." with a finger to its lips as the title fades in small; LE CHONK pops in from the edge — HONK HONK — cut to black with the "all headlines real" note.
