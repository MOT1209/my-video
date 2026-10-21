# Phase 6 — Long-lived agents build the video; the critic loop polishes it

**Both parts are mandatory every time the skill builds a video.** The main thread is the
orchestrator: it plans, builds the shared kit/reference frame, assembles, renders, masters and coordinates — it does
NOT build the whole video alone. And no video is delivered until the critic has scored it ≥ 8/10.

## 1. Long-lived agents do the building
Spawn a handful of **long-lived domain agents** that each own a coherent chunk of the video for the whole project
(build → self-review → critic fixes in every round). Never split the work into many small single-task agents — it
wastes time and usage and loses context. Scale the team, but never to zero:

| Video | Team (orchestrator + …) |
|---|---|
| Short / Reel (≤ 60 s) | **1** long-lived builder agent for all frames |
| 1–2 min | **2** directors (e.g. verses · hooks) |
| 3–4 min | **3–4** directors: verse block(s) · a hooks director (every chorus/chant/breakdown/final chorus — one grammar, re-staged each time) · bridge + outro |
| any length | **+1 production agent** (long-lived): receipts + real-CLI captures, renders, review sheets, phone copies, cuts/min measurements, the delivery package; it protects the orchestrator's context |

The orchestrator still builds the **opening/reference frame** (it proves the pipeline and sets the house style)
plus captions, assembly, audio and packaging — everything else goes to the agents. If one agent's load is much
heavier, move a frame to a lighter one (once, a chant moved from the hooks director to the bridge/outro director in
round 2 — and became the favourite part of the video).

**Before the first brief (the costliest lesson so far):** put the measurable bar into the brief up front: the energy
bar's table (3D in ≥ 60% of frames and every chorus, a camera move per phrase, cuts/min per section; `visual-direction.md` §5)
plus its "what the best video did" list, the per-line singer from `voice_cast.py` (voiceprints, male by default), the
standalone rule and the character colours. A 16-frame video briefed without them had every frame rebuilt (energy) and
recast (twice) after its second version. Front-loading these is the single biggest time saver.

Dispatch with the Agent tool (general-purpose), `run_in_background: true`, all at once. Each brief:
role + frames owned (ids + durations) · read DIRECTOR-GUIDE.md, STORYBOARD.md, the reference frame, the kit
API · run `words.mjs` for their spans · which receipts/logos to look at · 1–2 paragraphs of creative direction
per frame (the gags, the characters, the hero moments) · "log 1–3 thumbnail moments in analysis/thumbnail-moments.md" · "only edit your files; self-review with snapshots;
report back; stay available — you'll get critic feedback". Keep every agent's id: fixes in later rounds go back to the
SAME agent with SendMessage (it keeps its context). Relay user feedback mid-flight the same way
(e.g. "the user loves the dancing Clawd — give him real dance moments").
While they work: captions, audio master, upload copy, previews for the user.

## 2. The critic loop — runs on the finished video, up to 3 rounds, pass mark 8/10
Once the full video is assembled and rendered (not per section, not on the plan), spawn ONE long-lived **critic
agent** briefed from `assets/templates/CRITIC-BRIEF.md` (paste the user's actual asks). Give it the MP4, labelled
review sheets (`scripts/review_sheets.py`), `STORYBOARD.md`, `lyrics.md`, `words.mjs` and ffprobe/ebur128.
It scores the video out of 10 and judges, at professional-YouTube-music-video standard:
- **fidelity to the lyrics and script** — every sung line has its visual, on-screen words match what is actually
  sung, the storyboard's story beats are all delivered, timing hits the words;
- **the theme of the song** — the hook/running gag and the story carry through; the look fits the genre and mood;
- **energy** — follows the song's arc (drops, silences, escalation to the final chorus), no dead stretches;
- **animations** — motion quality, easing, character acting, transitions, camera, 3D;
- **polish** — no clipping, collisions, ghosts, stale/empty frames, off-model characters; readable receipts and captions; technical delivery.
It writes `analysis/critic-round-<N>.md` (scores, top fixes, findings per frame/owner, what to keep).

**Below 8/10 is not acceptable.** The orchestrator's job is to turn the critic's feedback into fixes until the score
is ≥ 8, for at most **3 rounds** (the cap saves time and usage):
0. Freeze frame edits while the critic reviews a render (it scores what was rendered; one critic flagged that ten frames
   changed under it). While it reviews, directors may pre-fix gaps you already MEASURED (e.g. a low cuts/min section), then re-render.
1. Verify surprising claims yourself before acting (pull the exact frame — critics misread too; in round 1 two
   "missing" effects were actually present).
2. Fix your own items; SendMessage each long-lived agent its items + any new cross-cutting continuity rule.
3. Re-render, mux the master, new review sheets, resume the SAME critic (SendMessage) with a changelog → it
   re-scores from scratch, verifies each fix and checks for regressions.
Stop when it scores ≥ 8 (a final polish round on cheap, viewer-visible items is usually still worth it), or after
round 3 — then tell the user the score and exactly what's still below the bar. Never present a video under 8 as finished.
Typical arc: 7.5 → 8.4 → 8.8.

What the critic consistently flags (pre-empt these in the storyboard and director guide):
weak first 20 s · identical chorus repeats · a final chorus that isn't bigger · words colliding mid-slam ·
clipping at frame edges · ghost/hollow text · characters cropped or off-model · dead stretches (empty
windows, static holds) · a stale first frame · day/night palette cuts inside a section · captions with
orphan words or overlapping end cards · loose numbers vs the research.
