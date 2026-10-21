---
name: agent-music-video
description: Turn news, a topic, a product launch or any story into a song AND a story-driven, beat-synced music video hosted by "AGENT" (the boxy robot mascot with an LED face) — researching and verifying stories, writing lyrics with a narrative, humour and a chantable hook plus a style prompt for Suno/Udio, analysing the generated track (beats, quiet moments, word-level lyric timing), then building the video in HyperFrames with real screenshot "receipts", brand logos, animated brand-mascot cameos (e.g. 3D Clawd), 3D toon lettering and karaoke captions, using a few long-lived section-director agents and an end-of-pipeline critic loop, and delivering a YouTube-ready package (4K 60 fps MP4 with a −14 LUFS master, SRT, thumbnails, and a social-metadata.md with 5 titles, an SEO description with chapters and source links, tags, and a pinned comment). Use this whenever the user wants a song or music video about this week's AI/tech news (or any news), a recap/explainer/launch as a song, a music video for a track they generated, lyrics with a hook about a topic, a 60-second Short version, or mentions the AGENT avatar/mascot or their song/music-video channel — even if they only ask for one phase (just research + lyrics, or just the video for an existing track).
---

# Agent Music Video

Make songs and music videos that tell a story: real events (or the user's topic) → lyrics with a hook →
the user's generated track → a professional, energetic, beat-synced video starring the AGENT mascot,
with real receipts on screen. A worked example (a week of AI news as a funk-pop song, 3:36, critic score
8.8/10: its lyrics, research, storyboard and four frames) is in `assets/examples/` for inspiration, not as a
template to copy.

Be flexible. The phases below are a menu, not a checklist: enter wherever the user is, skip what they
already have, and adapt the look, length and tone to the song. What doesn't change is the bar —
everything synced to the vocal, every claim backed by a receipt, constant life on the beat, a
first 10 seconds that hook, and **the energy bar** (`references/visual-direction.md` §5): 3D hero moments in ≥ 60% of
frames and every chorus, 3D layered with the 2D world, a camera move per phrase, hooks ≥ 45 cuts/min, no static
hold over 0.6 s. Those numbers were measured on the best-scoring video so far; §5 also describes what that video did on screen,
so every brief can aim at it without anyone having seen it.

## Non-negotiable: long-lived agents + the critic loop (every run)
These two apply whenever the skill builds a video — the user expects them in play every time:
1. **Long-lived agents do the building, not the main thread.** You orchestrate (plan, kit, the reference/opening
   frame, assembly, renders, audio, packaging) and hand the frames to a few long-lived domain agents — 1 builder for a
   Short, 2 for 1–2 min, 3–4 section directors for a full song — who stay alive to apply every round of fixes. Never
   do the whole edit yourself, and never fan out into many small single-task agents (it wastes time and usage).
   Protect your own context: one more long-lived **production agent** takes the output-heavy chores (receipts and CLI
   captures, renders, review sheets, phone copies, cut-density measurements, the delivery package); you keep conclusions.
2. **A critic agent scores the finished video out of 10 in a loop of up to 3 rounds.** Below 8 is not acceptable.
   It checks fidelity to the lyrics and script, the song's theme and hook, energy, animation quality and polish —
   the bar is a professional YouTube music video. You turn its feedback into fixes (via the same long-lived agents),
   re-render, and resume the same critic until it scores ≥ 8. Don't call a video finished before that; if round 3
   still misses, tell the user the score and what's left. Details: `references/directors-and-critic.md`.

## 1. Find the entry point (don't re-do what exists)

| The user has… | Start at | Notes |
|---|---|---|
| a topic + timeframe ("this week's AI news") | Phase 1 research | full pipeline |
| notes / a brief / a product | Phase 2 songwriting | their notes replace research; still verify facts |
| lyrics | Phase 2 polish → hand-off | tighten the hook, add a style prompt |
| a finished track (+ lyrics or not) | Phase 3 analysis | no lyrics? transcribe, then reconstruct the sheet |
| a half-built project | wherever its files say | read STORYBOARD.md, renders/, analysis/critic-round-*.md |
| "just a Short" | any phase, 9:16, ≤ 60 s | one long-lived builder agent + the critic loop, bigger captions |

Where things live — one workspace folder for the channel (or the user's songs), one self-contained folder per video:
```
<workspace>/
├── AGENTS.md        ← the channel's rules: name, handle, badge text, playlists, upload defaults, standing rules, a
│                      list of videos (start from assets/templates/WORKSPACE-AGENTS.md; CLAUDE.md can hold just "@AGENTS.md")
├── branding/        ← optional channel art: logo_wordmark.png + logo_lockup.png (transparent, for end cards and
│                      thumbnails), avatar, banner, watermark. Not episode files.
└── videos/
    └── <YYYY-MM-DD>-<song-slug>/   ← one HyperFrames project per video (research.md, lyrics.md, analysis/,
                                       STORYBOARD.md, compositions/, assets/, renders/; deliverables in renders/final/)
```
Name video folders by date then song title in kebab-case so they sort in release order; add `-short` for a Short
cut of a video. Work only inside the current video's folder. Read the workspace's AGENTS.md/CLAUDE.md first and
follow it. If there is no workspace yet, use the current folder, create `videos/` there, and offer to set up
AGENTS.md from the template (ask for the channel name once; skip it if the user has no channel).

Defaults — state them, don't ask: author 16:9 at 1920×1080, 60 fps; drafts at 1080p30, **final master at 4K 60 fps**
(don't downgrade it to save time; make the render fast instead, see `references/production.md` › Rendering)
(`--resolution landscape-4k`; 9:16 for Shorts/Reels/TikTok); video length =
the track; the look chosen to fit the song; captions on verses, none on choruses; royalty-free fonts only;
use the GPU and many render workers; the critic loop on the finished video (≥ 8/10, up to 3 rounds). Ask at most one or two
questions, and only when the input is genuinely missing (e.g. no topic). When the user says "keep going",
stop asking and use judgement.

## 2. The phases

### Phase 1 — Research (news songs) → `research.md`
Parallel long-lived research agents by beat; strict date window; URLs for everything; then **verify every
story the song will name against its primary source yourself**. Pick 5–10 stories: important, visual or
funny, singable — and spot the absurd one that can become the running gag. Capture receipts (screenshots +
phrase rects) and logos now or in phase 5. → `references/research.md`

### Phase 2 — Song → `lyrics.md`
A narrator with a voice (usually AGENT talking to "the boss"), a spine (days of the week, countdown,
journey), a chantable hook built on the running gag, escalation (pre-chorus → chorus → bridge twist →
breakdown call-backs → bigger final chorus → bookend outro), humour from real specifics. Section tags in
`[brackets]`, one sung line per line, a style prompt without artist names, and a fact key.
**Then hand off**: the user generates the track (Suno/Udio/…) — tell them exactly what to paste. → `references/songwriting.md`

### Phase 3 — Track analysis → `audiomap.json`, `analysis/lines.json`, `assets/kit/song.js`
Beat/energy map with music-to-video's `analyze-beatgrid.py`; word timing with `scripts/transcribe_lyrics.py`;
`scripts/align_lyrics.py` (lyric sheet = text, Whisper = timing; robust to repeated choruses); review its
flags; `scripts/voice_cast.py` (who sings each line: Demucs vocal stem + speaker embeddings vs known reference spans, male unless the female reference clearly wins — never pitch alone → male AGENT / female AGENT / duet — the
character lip-syncing on screen must always match the voice); `scripts/build_song.py` → `song.js` + beat-snapped sections. Then read the song like an editor with
`scripts/words.mjs`: drops, silences, instrumental gaps, the words that deserve hits. → `references/track-analysis.md`

### Phase 4 — Visual direction & storyboard → `STORYBOARD.md`
Choose the look to fit the genre (default skin = BlockFrame neobrutalism; re-theme via `theme.css`/`theme.js`),
the cast (AGENT host + variants, brand-mascot cameos like 3D Clawd, a gag character born from the lyrics),
the recurring devices (receipts, a structural card, the hook's visual gag, colour flips on downbeats), the
chorus arc (same grammar, re-staged each time, final chorus biggest), continuity rules and caption policy.
Plan one frame per section (split long sections at story changes), each lyric line with its own visual idea.
Turn the song's central metaphor into a **shared prop library** (`assets/props.js`, e.g. for a song about tool add-ons, `CAR`: a car whose
parts bolt on as each feature is sung, state keyed by track time) so continuity holds across directors. Cast every line by voice
(phase 3's `voice_cast.py`): male lines → AGENT (blue), female lines → the female AGENT (pink).
→ `references/visual-direction.md`, example `assets/examples/STORYBOARD-example.md`

### Phase 5 — Production → a renderable project
`npx hyperframes init`, `scripts/setup_project.mjs` (kit, fonts + licences, vendor libs, captions overlay,
theme stubs), validate + placeholders + music-to-video's `assemble-index.mjs` + `scripts/finalize_index.mjs`.
**Build the opening frame(s) yourself first** to the full bar — it proves the pipeline and sets the house
style directors will match. Start the Studio preview for the user and send early clips.
→ `references/production.md`, `references/kit-api.md`, examples in `assets/examples/`

### Phase 6 — Directors + critic → finished cut
For songs over ~1 minute, a few long-lived section directors in parallel (verses · all hooks · bridge/outro),
briefed with `assets/templates/DIRECTOR-GUIDE.md` + specific creative direction; relay user feedback to them
mid-flight. Everyone logs **thumbnail-worthy moments** as they build (`analysis/thumbnail-moments.md`).
Render, mux the master, build review sheets, then the critic (`assets/templates/CRITIC-BRIEF.md`)
— only once the full video exists; fix → re-render → resume the same critic; ≥ 8/10, up to 3 rounds. Measure every
render's **3D coverage, camera moves and cuts/min per section** against the energy bar (hooks ≥ 45 cuts/min, the breakdown
and final chorus the densest) → `references/directors-and-critic.md`, `references/visual-direction.md` §5

### Phase 7 — Delivery → `renders/final/`
`scripts/master_audio.py` (−14 LUFS, ≤ −1 dBTP after AAC, sample-aligned), CRF 12 / 60 fps render muxed with the
4K master (`--resolution landscape-4k`), phone copy < 30 MB, SRT (`scripts/make_srt.py`), the **top 3 thumbnail moments** (each with a recognisable character/logo; then a review + still-only staging pause, `delivery.md` › Thumbnails; picked from the
log + a scan of the final cut, exported caption-free with `scripts/clean_stills.py`, each paired with a title), and
`social-metadata.md`: 5 titles (under 60 chars, simple words, superlatives, exaggeration not clickbait — and never
announce the format ("a song about…"): lead with the funniest true story angle), a description that opens with a 1–2 line SEO
paragraph then chapters and every source link (articles, official posts, GitHub repos), and a comma-separated
tag list ≤ 500 chars, plus a pinned comment (⭐ pick + 2 alternatives in AGENT's voice: an in-joke dare or poll,
"every headline is real", and "which story should get the next song?"). Paste the description, tags and pinned comment into your reply too. Offer to clean up draft renders; never delete unasked.
→ `references/delivery.md`

## 3. Working with the user
- Keep them in the loop with short status lines and things they can watch: the live Studio preview, a
  20-second early clip, a phone-sized full cut each round. Big files don't reach phones — always send a < 30 MB copy.
- Treat their reactions as direction ("love the dancing Clawd" → more Clawd moments; "Clawd looks wide" → fix the kit, re-render).
- Never invent facts, quotes or numbers; label rounding and gags. Logos/screenshots are commentary — shown as-is, credited.
- Royalty-free fonts only (`assets/fonts/FONTS.md`). Brand mascots are affectionate cameos, kept on-model.
- **The channel's own rules come from the workspace AGENTS.md** (name and handle, badge text, branding files, playlists,
  upload defaults, title rules, anything the user has decided). Where it's silent, use these defaults:
  - **Provider-neutral branding** for a channel that covers many companies: other companies' mascots/logos appear only
    inside episodes as commentary, never as channel identity.
  - **Every video stands alone**: no episode/track numbers, video-title labels or release dates on screen (title card,
    pills, receipt tags, end card) unless the story itself needs them (e.g. a date that is sung). Numbering lives only
    in the workspace's AGENTS.md and the platform's playlists.
  - **AGENT's canonical look**: smug eyes + smile, a yellow tilted chest badge with the channel's short initials
    (2–4 characters; `KIT.badge(tl, id, "si", at)` then set the badge text; the kit's default badge reads "A.I." when
    there is no channel), right arm waving, head tipped ~5°, **blue shirt** (body `#3ec1d3`, the kit default
    `KIT.AGENT_BODY`), a cap or prop per episode.
  - **The cast has two hosts** (casting rule: whoever is heard is who's seen singing; `scripts/voice_cast.py` tags each
    line): **AGENT** (male) takes the male-voice lines (raps, spoken intros/outros); **the female AGENT** takes the
    female-voice lines (often hooks and sung pre-choruses) and co-hosts, never a cameo. Her design: the same boxy robot
    and rig, **pink shirt and pink ears** (`KIT.FEMME`), a pink bow on the antenna, three lashes over each LED eye, pink
    blush on the screen, the same yellow tilted badge, no cap (`KIT.mascot({ body: KIT.FEMME.body, ear: KIT.FEMME.ear })` +
    `KIT.femme(id)`). Duets: both sing; gang shouts: everyone.
  - **Outro**: a closing card with just the channel's logo lockup (`branding/logo_lockup.png` or `logo_wordmark.png`,
    transparent PNGs, also used on thumbnails) — no track number, title or date. No branding folder? End on AGENT with
    the channel name (or the song's hook) in the kit's 3D lettering.

## 4. Adapting
- **Shorts (9:16, ≤ 60 s)**: hook in the first second; one or two big ideas; captions larger and higher (out of the UI zone); one long-lived builder agent (still not the main thread) and the critic loop.
- **Non-news topics** (launch, team recap, birthday, explainer): research → the user's notes; receipts → product screenshots, photos, docs; keep the host + hook craft.
- **Brand/corporate**: theme to the brand palette, tone down slapstick, keep receipts and sync.
- **Instrumental**: no lyrics/captions; story via on-screen text and characters; pace by phrases/energy.
- **Other languages**: set `LYRICS_LANG` for transcription; make sure the display font covers the script (royalty-free, e.g. Noto).
- **No GPU / slow machine**: 30 fps drafts, fewer workers, 3D only for hero moments.
- **New style**: pick a preset from `<skills>/hyperframes-creative/frame-presets/`, put fonts/colours in `theme.css`/`theme.js`; regenerate 3D glyphs for a new font with `scripts/glyphs.mjs` (static, overlap-free TTF).

## 5. Before you build — read `references/lessons.md`
It lists the traps that cost time on earlier runs (seek-safety, the stale first frame, broken 3D glyphs, outline
cracks, screenshot overlays, the AAC true-peak overshoot, review-sheet offsets, what the critic always flags).

## 6. What's in this skill
| Path | Purpose |
|---|---|
| `assets/kit/` | `kit.css` (atoms, themeable), `kit.js` (AGENT mascot + her + scene outfits, LE CHONK, receipts, calendar, stars, bubbles, motion + timing helpers), `kit3d.js` (toon 3D, text3d, Clawd, props), `glyphs.js` |
| `assets/fonts/` | Inter, Inter Display Black (3D/thumbnails), Space Grotesk, JetBrains Mono — all OFL, licences + `FONTS.md` |
| `assets/vendor/` | gsap 3.14.2, three 0.170 (local copies for deterministic offline renders) |
| `assets/templates/` | `captions.html` (karaoke overlay), `DIRECTOR-GUIDE.md`, `CRITIC-BRIEF.md`, `social-metadata.md`, `WORKSPACE-AGENTS.md` (the channel's rules + folder layout, copied to the workspace root) |
| `assets/examples/` | the worked example: frames (intro, 3D title, Clawd dance break, receipts + 3D lever), `STORYBOARD-example.md`, `lyrics-example.md`, `research-example.md`, a still of AGENT + Clawd |
| `scripts/` | `transcribe_lyrics.py`, `align_lyrics.py`, `build_song.py`, `words.mjs`, `shoot.mjs`, `fetch_logos.py`, `setup_project.mjs`, `finalize_index.mjs`, `master_audio.py`, `review_sheets.py`, `clean_stills.py`, `make_srt.py`, `thumbnail.py`, `glyphs.mjs`, `voice_cast.py` (who sings each line), `pty_capture.py` + `render_term.mjs` (real CLI screenshots from a pseudo-terminal), `placeholders.mjs` (placeholder frames from the storyboard), `preview_root.mjs` (render just the opening for an early clip) |
| `references/` | one file per phase + `kit-api.md` + `lessons.md` |

Dependencies: HyperFrames CLI (`npx hyperframes`) and the `/hyperframes`, `/hyperframes-core`, `/music-to-video`
skills; ffmpeg; Python with `librosa numpy soundfile faster-whisper pillow`; Node with `puppeteer-core`
(screenshots) and `opentype.js` (only to regenerate glyphs) — install those two in a scratch dir and run the scripts from there.
Voice casting needs Demucs + SpeechBrain (torch) in their own venv, which `voice_cast.py` finds by itself at
`%LOCALAPPDATA%/agent-music-video/demucs-venv` on Windows or `~/.local/share/agent-music-video/demucs-venv` elsewhere
(CPU torch is enough) — see its docstring.
