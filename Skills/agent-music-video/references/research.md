# Phase 1 — Research (when the song is about real events)

Goal: a short, verified list of stories worth singing about, each with a source you can put on screen.
Skip this phase when the user brings their own topic notes, lyrics or a finished track.

## Scope it
- **Timeframe**: pin exact dates ("this week" = Monday → today; state it back: "Mon 5 – Sun 11 Oct 2026").
- **Beat**: what counts (model releases, coding tools, policy, funding, a company's launches, a sports season…).
- **Audience**: who's watching decides which stories are "big" (developers care about harness changes; a general audience cares about the funny/viral ones).

## Gather — parallel, long-lived research agents
Split by beat, one agent each (e.g. frontier labs · open-source labs · coding tools · industry/buzz/viral).
Brief each with: exact date window, "only items published inside it (list spillover separately)", "every
item needs a URL you actually saw", "label rumours", and a fixed return format:
`headline | org | exact date | 2–3 factual sentences with numbers | why it matters / buzz | URLs`, ending with
their own top 3. Ask the buzz agent for **memes, catchphrases and viral moments** — those become lyric gold.
Weekly newsletters and Techmeme/Hacker News front pages are good ways to find the week's real top stories.
X/Twitter usually needs a login: don't sign in. Verify posts through the public `https://api.fxtwitter.com/status/<id>` JSON
(text, date, likes, views), screenshot them via the official embed `https://platform.twitter.com/embed/Tweet.html?id=<id>&theme=dark`
(no login), find them with `site:x.com` searches, and fall back to coverage that quotes posts. For "what are people actually using
X for", read the replies-worthy posts' text, then verify the repos on GitHub (`gh api repos/<owner>/<repo>`).

## Verify before you write a single lyric
Re-fetch the primary source for every story that will be named in the song (the claim, the number, the date).
Agents occasionally conflate or embellish (e.g. an extra detail that's in no source). Drop or soften anything
you can't confirm. Keep `research.md` with: the top-N table (✔ = verified by you), honourable mentions, and
source URLs — it becomes the YouTube description's source list and the critic's accuracy reference.

## Pick the top 5–10 for a song
Favour stories that are (a) genuinely important, (b) visual or funny, (c) easy to say in a line. One absurd
story can become the **running gag/hook** (in the worked example: "say 'AI' and you're THE ENEMY" → "Don't Say A.I.").

## Receipts (capture during or right after research)
For every story in the song, capture the real page with `scripts/shoot.mjs` — screenshot + rects of the
headline and the exact phrases you'll highlight when they're sung. Then LOOK at each image: ads,
newsletter pop-ups, "continue to article" interstitials and blank SPA pages are common. Fix with
`selector`/`offset` (scroll to the h1), extra `css` (hide overlays), `click` (harmless interstitials only),
or a longer `wait`. Hide cookie/consent banners with CSS — never click "accept".
**Real CLI receipts** (for songs about developer tools): drive the actual program in a Windows pseudo-terminal and render
its real output stream with xterm.js — `scripts/pty_capture.py <script.json> <out>` (steps: wait / send / sleep / snap / auto;
`pip install pywinpty`) then `node scripts/render_term.mjs <out> <cols> <rows> --font <JetBrainsMono.woff2> --chrome <exe>`
(needs `puppeteer-core` + `@xterm/xterm` in the scratch dir). Gotchas: ConPTY sends spaces as cursor moves (match text with
whitespace removed — the script does); interactive dialogs often default to the safe choice (Claude Code's trust dialog
defaults to "No, exit": arrow down first); a nested `claude` inside the desktop app has no login of its own — never sign in
for the user; capture what works logged-out (`claude plugin validate`, the startup screen with a mod's band) or ask the user.
Crop out status lines that would mislead ("Not logged in"). Label these "REAL CLAUDE CODE" (ours) vs the vendor's own screenshots.
Logos: `scripts/fetch_logos.py` (Simple Icons, then LobeHub for AI brands).
Screenshots and logos are used as news commentary/identification — show them as-is, credited with the outlet's name (dates stay in research.md and the description, not on screen — every video is standalone); don't alter them to say something they don't.
