# Lessons learned

Gathered from the first videos made with this skill: a 3:36 funk-pop recap of a week of AI news (critic 7.5 → 8.4 → 8.8,
the source of the energy bar in `visual-direction.md` §5) and a 4:50 explainer song about a developer tool's add-ons
(6.6 on its second version → 8.5 after a full energy rebuild). Read this before building. Each lesson cost real time once.

## What made the difference to the people watching
- **Energy + story + humour, at a professional bar.** "Make it energetic. Tell the story." A slideshow of facts fails.
- **Real receipts.** Actual screenshots of the articles with the key phrase highlighted on the sung word — it makes the comedy credible.
- **Brand mascots, animated.** A dancing 3D Clawd got the biggest laugh. Give mascots hero moments (full body, centre, on the beat), keep them on-model ("Clawd looks a little wide" was spotted at once — fixed to a ~1.6:1 body).
- **Previews early.** Watching the live Studio preview fill in and getting a ~20-second clip early kept the user engaged. Send phone-sized copies (< 30 MB; bigger files don't reach phone/web viewers).
- **Standalone videos.** A title card carrying a track number, the video's title and the date was rejected ("that makes no sense"). No series
  metadata on screen: no episode/track numbers, title labels or dates (title, pills, receipt tags, end card) unless the story needs it.
- **The singer on screen must match the voice.** Generators like Suno mix male and female vocals. In one video AGENT lip-synced a female line and
  then the female AGENT lip-synced male lines everywhere: the user caught both. Pitch on the vocal stem FAILED (a male singing a
  melody at ~250 Hz reads as female, so she was over-cast); speaker voiceprints (`voice_cast.py`, SpeechBrain ECAPA on the Demucs
  stem, several male anchors + the user-confirmed female line, male by default) found she sang one line only. The user's ear is ground
  truth: seed the casting with any line they identify and show them the low-confidence lines. Characters: AGENT blue, her pink.
- **Explainer songs: lean on the useful examples.** For a feature explainer, show "the helpful, anti-useless examples" people
  actually built; toys get one line of contrast. Never put creators'/influencers' names on screen (crop X cards to the post body).
- **Process:** don't stop to ask once the user says "keep going"; long-lived agents do the building (never the main thread alone, never swarms of tiny agents); the critic loop runs on the finished video, up to 3 rounds, ≥ 8/10 (below 8 is not acceptable); use the GPU; royalty-free fonts only.

## Packaging
- Titles must not announce the format ("song", "music video") or the channel's own topic (on an all-AI-news channel, "about AI" says nothing). Lead with the funniest true angle of one story; follow the title rules in delivery.md (< 60 chars, simple words, superlatives, no clickbait). A first draft ("…AI News Song Ever") was rejected for being on the nose.
- Thumbnails: pick the top 3 moments from the whole video (logged during the edit), not just the title card. Winners: the shocked host under a giant "SHH!", the title lockup, the "OH NO!" crash. The funniest gag ("WAIT… THAT'S US?") lost because it's too busy at phone size. Always hide the caption bar for stills, and match stills to timestamps (not sort order).
- Every thumbnail needs something instantly recognisable (Clawd, a logo, the host's face), and
  the package isn't done until a review pause has fixed what doesn't read at phone size with still-only staging
  (`clean_stills.py --css`: background swaps, white sticker outlines, saturation, staged mascots). An accurate pale-cyan
  still beat a punchier but off-model AI redraw.
- Metadata goes in `social-metadata.md` (5 titles · SEO paragraph first · chapters · every source link incl. GitHub repos · comma-separated tags) and the description + tags are pasted into the reply too.

## Story & editing
- The first 20 s decide retention: a composed first frame, the host doing something on the first word, a visual gag on the first joke. v1's thin opening cost a full point.
- Re-stage every chorus (same timing, new set pieces); make the final chorus its own look and the biggest moment; bookend the intro in the outro. Identical repeats were the #1 critique.
- A dance break on a chant section is pure joy — characters dancing full-frame beats a repeated type slam.
- Fill musical stops on purpose (freeze, record scratch, "wait… that's us?" 4th-wall moment). Quiet ≠ empty.
- Story-state continuity across directors needs explicit rules (the host's badge flips to S.I. at 66.5 s and must stay flipped everywhere after).
- Day/night or palette changes inside one section read as mistakes; change looks at section cuts.
- Every on-screen word must stay inside a 64 px margin at the PEAK of its slam; scale from an edge (left for line starts) so neighbours never collide.
- **Meet the energy bar.** The explainer's second version, put side by side with the best video, was "missing the
  energy, and combo of 2D with 3D": too much flat 2D, too few camera moves. The best video used 3D in 10/17 frames (≈ 16 `K3`
  calls/min) and ≈ 36 camera-div refs/min (grep proxies; the flat version: 4/16 frames, ≈ 2.5 calls/min, ≈ 13 refs/min). Targets now: a 3D hero moment in ≥ 60% of frames and every chorus, 3D layered with 2D, a
  camera move per phrase, hits + downbeat flips, no static hold > 0.6 s (`visual-direction.md` §5); the critic scores against it.
- Characters may change outfits per scene (`KIT.outfit`), but only at cuts or on-beat swaps, and never their identity markers.
- **Measure the energy arc on every render** (`ffmpeg … select='gt(scene,0.3)'` per section, cuts/min). The flat version's arc ran backwards
  (verse 3 was the busiest, the breakdown the flattest at 10/min) and scored 6.6; the rebuild (overall 17.6 → 32.4, chorus 1 22 → 67, breakdown
  10 → 72) was the version people loved. Hooks: one composition per sung hook word, every hook word full-frame with a colour flip;
  the breakdown = a sequence of full-frame payoffs, one per call-back; the final chorus must be the densest and biggest.
- **Build the episode's metaphor as a shared prop library first** (the explainer: `assets/props.js` → `CAR.car({ at })`, `CAR.bolt`,
  `CAR.stateAt(t)`: a Claude Code "car" whose parts get bolted on as each add-on is sung). One rig with story state keyed by track time made
  continuity across four directors automatic, and gave every abstract feature a physical, funny image (brakes = Blast Radius, tint =
  secret redaction, gauge = Token Weather). Load it via `assets/props.js` (finalize_index adds it).
- Re-staging a chorus as a different UI (a racing-game upgrade menu: FUZZY DICE +0 SAFETY vs BRAKES +40) can MAKE the song's argument;
  the critic called it the clearest moment. Break out of the UI to full frame on the hook words, or it reads as a locked wide.
- Characters featured at 25–40% of frame height; never repeat the same cutaway angle more than about twice (a bolt-on insert repeated 9×
  was flagged).

## Facts
- Research agents occasionally add details no source contains (e.g. "20 visa applications"). Re-fetch the primary source for anything named in a lyric.
- Lyric rounding is fine if the screen is honest: "~$68B · ≈70 in the song".
- Show gags as gags (redaction bars instead of an invented tip text; a sleeve instead of a politician's likeness).

## HyperFrames / GSAP (seek-safety)
- `fromTo()` later in a timeline applies its from-values to all earlier times on backward seeks → siren glows, tints, squashed bulbs "leak" into earlier frames. Use `set` + `to` for any hit whose start state is visible.
- `tl.set(…, 0)` is NOT rendered on the very first frame (t=0) → the first frame shows raw CSS (a stale end-state flash). Apply initial states immediately at build time too (`gsap.set` + `tl.set(…,0)`); for mascot faces run the helpers on a throwaway timeline and `progress(1)`.
- `tl.set(el, { className: … })` does NOT revert on backward seeks in the HyperFrames runtime (a neon sign stayed lit at 0.3 s). Toggle states with opacity or explicit style props (two pre-built elements, or `color`/`backgroundColor`), never className.
- Snapshot in reverse time order as well as forward — it catches leaks forward order hides.
- Sub-composition rules: everything inside `<template>`; ids namespaced per frame; one WebGL canvas per frame; register the GSAP timeline in a classic script, then hook Three.js rendering from a module via `KIT.onFrame` (timeline `onUpdate` fires on seeks).
- A global stylesheet/scripts in the root `index.html` head apply to every sub-composition — that's how the kit is shared.
- Rotating an empty wrapper div rotates its absolutely-positioned children around the wrong origin — animate the element itself.

## 3D
- Glyphs from variable-font static instances have overlapping/self-intersecting contours (A, 4, R) → broken triangulation. Use static TTFs with overlaps removed (official releases); the bundled InterDisplay-Black is clean.
- Inverted-hull outlines with averaged normals crack along earcut bridges on letters with holes → use the kit's flat-hull mode for text (XY-only offset, hull kept inside the depth).
- Drop-shadow copies behind letters with counters show through as "artifacts" — skip them on text.
- Toon look: 2-step gradient map + strong ambient + black outlines matches 2D stickers.

## Assets
- Screenshot pages yourself (headless Chrome) and measure phrase rects at capture time — then highlights land exactly. Always look at every capture: ad overlays, newsletter modals, interstitials, blank SPAs.
- Hide consent/cookie UI with CSS; never click accept. Consent platforms vary per site and change between visits (a re-shot mistral.ai suddenly showed an axeptio modal) — shoot.mjs hides the common ones (axeptio, Cookiebot, Usercentrics, Quantcast, TrustArc, OneTrust, Didomi, Osano, iubenda, Termly, Klaro, generic aria-modal dialogs); still look at every capture. Clicking "Continue to article" interstitials is fine.
- X/Twitter is login-walled, but two public routes worked in Oct 2026: `https://api.fxtwitter.com/status/<id>` returns a post's text,
  date, likes and views as JSON (verification), and the official embed `https://platform.twitter.com/embed/Tweet.html?id=<id>&theme=dark`
  renders without login (receipt: crop below the name row). Mirrors can die; fall back to news coverage. Find posts with `site:x.com` searches.
- GitHub issue bodies hide text in collapsed `<details>`: use shoot.mjs `"eval"` to open them (but keep video players closed: their
  posters can show faces), and crop out commenter rows/avatars. shoot.mjs now waits for layout to settle and re-measures, after a page
  shift put every mark ~13 px below its words.
- **Real CLI receipts** beat vendor screenshots for tool songs: `pty_capture.py` + `render_term.mjs` drive the real program in a
  pseudo-terminal and render its true output in xterm.js. Gotchas: ConPTY sends spaces as cursor moves (match text with whitespace
  removed); dialogs default to the safe answer (Claude Code's trust prompt = "No, exit"; arrow down); a nested `claude` inside the desktop
  app has no login of its own: the USER signs in, never you; never auto-approve another agent's permission prompts blindly (approve
  only a scoped pattern, e.g. writes into `~/.claude/dev-mods`, decline the rest); read any third-party code (sample mods) before running
  it; crop out `C:/Users/<name>` paths and "Not logged in" lines. `claude plugin validate` works without a login and makes a great receipt.
- Short docs/demo clips used as `<video>` need a keyframe every second (re-encode with `-g <fps>`), or the renderer warns they can freeze.
- Simple Icons lacks some AI brands (xAI, Grok, Midjourney) — LobeHub icons has them.

## 4K
- 4K works by rendering the 1080p layout at devicePixelRatio 2 (`--resolution landscape-4k`): DOM/SVG/text come out
  natively sharp, but anything rasterised at a fixed size does not — the 3D layer (fixed `setPixelRatio(1)`) and the
  1920-wide screenshots were visibly soft until the kit started following `devicePixelRatio` and using `@2x` captures.
- The first video shipped at 1080p only because 4K wasn't considered — make 4K the final master by default.

## Audio
- Whisper large-v3 on the full mix (no stem separation) gave usable word timings; text is mis-heard (e.g. "Le Chonk" → "chomp the chunk") — always take text from the lyric sheet, timing from Whisper. A global alignment (DP) is needed because choruses repeat.
- The faster-whisper CUDA path may lack cuBLAS on Windows; CPU int8 large-v3 is fine in the background.
- Generated songs arrive ~−16 LUFS with peaks > 0 dBFS; AAC adds ~0.5 dB of overshoot → limit to ~−1.6 dBFS so the MP4 measures ≤ −1 dBTP. Compensate limiter latency and verify 0-sample alignment by cross-correlation.
- The renderer lowers its own audio to protect peaks; always mux the master over the rendered video instead.
- Generators sometimes SKIP a lyric line (one track dropped "Make the spinner count your tool calls…"). Spot it as a Whisper gap,
  confirm with a band-passed re-transcription of the crop (Whisper hallucinating "Thanks for watching!" = no vocal there), drop the line
  from lines.json, and turn the gap into a visual gag on the beat.
- Pitch tracking on the full mix returns nothing usable; separate vocals first (Demucs, CPU torch in its own venv, ~1 min per song).

## Tooling gotchas (Windows)
- Python prints with unicode arrows crash on cp1252 consoles → `sys.stdout.reconfigure(encoding="utf-8")`.
- Windows ffmpeg has no glob input; build contact sheets with PIL. No soxr resampler in some builds → use `aresample` with `filter_size`.
- Heredocs with fancy unicode can break the shell — write scripts to files.
- Review sheets: decode from t=0 with `fps=1/step:round=near`; seeking with `-ss` before an fps filter shifted every label 0.25 s and misled the critic.
- `snapshot --describe` sends frames to an external vision API when a key is set — pass `--describe false` for routine checks.
- Run the CLI version the project pins (`npx --yes hyperframes@<version from package.json>` or the npm scripts): once a fresh
  npm release (0.8.149) 404'd mid-project and plain `npx hyperframes` broke every lint/snapshot/render call.
- The Studio preview adds `data-hf-id` attributes to files it opens, so exact-string edits of markup fail; match tolerantly (regex) or edit the script part.
- The Bash tool can unescape backslashes inside heredocs (JSON `C:\\mods` arrived as `C:\mods`; a JS `"\\n"` became a real newline):
  write scripts and JSON with the Write tool, or build JSON in Python, and avoid backslashes in shell heredocs.
- In the Claude desktop app, `%LOCALAPPDATA%` is virtualised (`…\Packages\Claude_…\LocalCache\Local\…`); paths still resolve from inside the app.
- A 3D canvas that must draw ABOVE a 2D overlay can't live inside the camera div: put it outside and copy the camera transform onto it every frame.
- `KIT.init` with prefix selectors (`[id^=…]`) silently catches every element sharing the prefix; use exact ids.

## Why the explainer took ~2× as long (and how to avoid it)
- **Set the bar before building.** Its second version was briefed without the energy bar's measured targets, scored 6.6, and every
  frame was rebuilt for energy/3D. Put the energy bar's numbers and its "what the best video did" list (`visual-direction.md` §5)
  in the FIRST brief.
- **Cast by voice before the brief.** Pitch-based casting looked fine, was wrong, and forced two recasts of every director's frames;
  run `voice_cast.py` (voiceprints) and confirm the uncertain lines with the user before building.
- Lock the standing rules early (standalone, colours, no creator names, 4K60): each mid-build change costs a message round to 4 agents.
- Expect the longer song + heavier 3D to raise render time (drafts went 5 → 11 min); critic rounds on 1080p30 drafts, 4K60 once.

## Render pipeline (final master)
- 4K 60 fps is the default master. Free the GPU first (`nvidia-smi`: an app holding 23 GB of the 32 GB VRAM made the first 4K60 attempt crawl at
  ~2 fps / ~2 h); `-w 8–12` is the measured plateau; `HF_SEGMENTED_CAPTURE=true` + `--resume`; pinned CLI version; log steps to
  `renders/final/PROGRESS.txt`. Details: `delivery.md` › Final render.
- The NVIDIA driver can reset mid-render (Windows `nvlddmkm` event 153 / TDR → "Page.captureScreenshot: Unable to capture
  screenshot"). Segmented capture turned that from a lost render into a 2-segment resume; if it repeats, resume at `-w 8`.
- A PC restart killed an unsegmented 4K render outright: that's why segmented + PROGRESS.txt are now the default.

## Captions
- Captions must POP in (full opacity on their first frame, a small slide/scale), never fade: a 0.14 s opacity fade-in left frames
  with a half-transparent grey card that the critic called "the caption bar dims at line starts". Fixed in `templates/captions.html`.
- Caption highlight colour follows the singer (`SONG.lines[i].voice`): AGENT yellow, the female AGENT teal, duets pink.

## Running the team
- Usage/session limits can kill long-lived agents mid-task (HTTP 429 "session limit"). Their files stay; after the reset, lint,
  then resume the SAME agents with SendMessage ("you were cut off; check where you got to and finish …"): they keep their context.
- When the user says "stop your processes", kill renders, headless Chrome workers and helper scripts, stop background agents
  (TaskStop), and confirm nothing of yours is left on the GPU/CPU.
- Protect the orchestrator's context: besides the section directors and the critic, keep one long-lived **production agent** for
  receipts/CLI captures, renders, review sheets, phone copies, measurements (cuts/min) and the delivery package; you keep conclusions only.
- Subagents sometimes end without handing back a report: resume them with "please deliver your report" (SendMessage), and ask for compact reports.
- Relay mid-flight user feedback to every affected agent immediately; for a big direction change, write one shared brief file
  (e.g. `analysis/ENERGY-UPGRADE.md`: the quote, the measured gap, the targets) and point everyone at it instead of long messages.
- Shared-asset fixes (colours, props, kit) go in ONE place (`assets/theme.js`, `assets/props.js`) so no director has to touch their frames:
  the AGENT blue / her pink swap was a 20-line wrapper.
- Directors find cross-cutting bugs (the className seek bug, `#02` in a shared prop): grep every frame and fix at the source the same day.
