# {{CHANNEL}} — workspace guide for agents

<!-- Copy this file to the root of your music-video workspace as AGENTS.md (and add a CLAUDE.md containing just
     "@AGENTS.md" so Claude Code reads it too). Fill in the {{…}} fields once; delete what doesn't apply.
     The agent-music-video skill reads this file at the start of every run: anything written here overrides
     the skill's defaults. -->

This folder is the production workspace for **{{CHANNEL}}** (@{{HANDLE}}): {{TAGLINE, e.g. "AI launches, tools & ideas,
turned into songs"}}, hosted by **AGENT** (the boxy robot with an LED face).
{{If the channel covers many companies: "Branding stays provider-neutral: other companies' mascots and logos appear
only inside episodes as commentary, never as the channel's identity."}}

## Making a video → use the `agent-music-video` skill
All song and video work goes through the **`agent-music-video`** skill. Invoke it, read its `SKILL.md`, and read
`references/lessons.md` before building. It covers the whole pipeline and lets you enter at any point: research →
lyrics + style prompt (the user generates the track) → track analysis → storyboard → HyperFrames production with the kit
(AGENT, receipts, 3D, captions) → section directors → critic loop → mastering → YouTube package.
Don't hand-roll a parallel process; if the skill is missing something, improve the skill.

## Folder layout
```
<workspace>/
├── AGENTS.md / CLAUDE.md       ← this guide
├── branding/                   ← channel-level art + copy (banner, avatars, watermark, logos, description). Not episode files.
└── videos/
    └── <YYYY-MM-DD>-<song-slug>/   ← ONE folder per video, self-contained (a HyperFrames project)
```
**Naming:** `<YYYY-MM-DD>-<song-slug>` — the date the video is made/released, then the song title in kebab-case
(e.g. `2026-10-18-model-mayhem`). Sorting by name = sorting by release order. For a Short cut of a video, add
`-short` (e.g. `2026-10-18-model-mayhem-short`).

**Create a new video folder** (`<skill>` = where the skill is installed, e.g. `~/.claude/skills/agent-music-video`):
```bash
npx hyperframes init "videos/<YYYY-MM-DD>-<song-slug>" --non-interactive --example=blank
node <skill>/scripts/setup_project.mjs "videos/<YYYY-MM-DD>-<song-slug>"
```

**Inside each video folder** (skill conventions):
| Path | What |
|---|---|
| `research.md`, `lyrics.md` | phases 1–2: verified stories + sources; lyrics, style prompt, fact key |
| `assets/bgm.mp3` | the generated track; `assets/master/` the mastered audio |
| `audiomap.json`, `analysis/` | beat map, transcript, aligned lines, review sheets, critic reports, thumbnail moments |
| `STORYBOARD.md`, `frame.md`, `DIRECTOR-GUIDE.md` | the plan, the look, the brief for section directors |
| `compositions/`, `assets/` | HyperFrames frames + the kit, fonts, screenshots (`assets/shots`), logos |
| `renders/` | draft renders (large — offer cleanup, never delete without asking) |
| `renders/final/` | **deliverables**: `<Title>_4K60_YouTube.mp4` (the 4K 60 fps master) + a 1080p60 copy, phone preview, `.srt`, `thumbnail-1..3_*.jpg`, `social-metadata.md` |

Work only inside the current video's folder; never modify another video unless the user asks.
Each video folder also has its own HyperFrames `CLAUDE.md`/`AGENTS.md` (framework rules) — follow both.

## Branding (`branding/`)
| File | Use |
|---|---|
| `logo_wordmark.png` | transparent channel logo for end cards and thumbnails |
| `logo_lockup.png` | transparent AGENT + wordmark, for the closing card |
| `avatar_*.png`, `banner_*.png`, `watermark_*.png` | channel art (not used inside videos) |

AGENT's chest badge reads **{{BADGE, 2–4 characters, e.g. the channel's initials}}**.
{{Brand colours/fonts if they differ from the kit's defaults.}}

## Channel settings for the YouTube package
- **Upload defaults** (YouTube Studio → Settings → Upload defaults): {{the footer they add to every description, or "none"}}
- **Tags the upload defaults add**: {{e.g. "<channel name>, AI song, AI music video" — the per-video tag line must stay under 500 characters including these}}
- **Playlists**: {{the all-tracks playlist (+ link) and the topic playlists a video can go in}}
- **Title shape for a recurring series**: {{optional, e.g. "The Wildest Week Yet: <hook>"}}

## How the user likes to work
<!-- The skill's defaults are listed below; edit them to match your own preferences. -->
- **Bar:** professional, energetic, funny, story-driven; every line synced to the vocal; real screenshot "receipts" for every claim; nothing invented.
- **Standalone videos:** no episode/track numbers, video-title labels or release dates on screen (title card, pills, receipt tags, end card) unless the story itself needs them. Track numbers below are internal bookkeeping only.
- **Agents (every video):** the main thread orchestrates; a few long-lived domain agents do the building (1 builder for a Short, 3–4 section directors for a full song) and stay alive for fixes. Then a **critic agent** scores the finished video out of 10 in a loop of **up to 3 rounds**; below 8 is not acceptable.
- **Flow:** when the user says "keep going", stop asking questions and use judgement. Send early previews (live Studio, short clips, phone copies < 30 MB).
- **Hardware:** {{GPU + CPU threads, e.g. "RTX 5090 + 32 threads — GPU WebGL capture, many render workers, NVENC for previews"}}
- **Final master:** 4K 60 fps.
- **Fonts:** royalty-free only (SIL OFL / Apache / MIT); licences live next to the font files.
- **Titles:** < 60 characters, simple words a 7–8-year-old knows, superlatives where possible, exaggeration but no clickbait — never announce the format ("a song about…"): lead with the funniest true angle of one story. Give 5 options.
- **Packaging:** `renders/final/social-metadata.md` = 5 titles + description (1–2 line SEO paragraph first, then chapters and every source link incl. GitHub repos) + comma-separated tags; also paste description + tags in the chat. Pick the **top 3 thumbnail moments** throughout the edit and export them caption-free.
- Brand mascots must stay on-model (proportions matter) and get real hero moments when they appear.

## Videos
| Folder | Track | Title | Status |
|---|---|---|---|
| `videos/{{YYYY-MM-DD}}-{{slug}}` | 01 | {{title (topic, dates)}} | {{e.g. final cut + package in renders/final/ (critic 8.6/10)}} |

Add a row for every new video.
