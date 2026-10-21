# Phase 7 — Audio master, final export, YouTube package

## Audio
`python <skill>/scripts/master_audio.py assets/bgm.mp3 assets/master/master.wav`
→ ~−14 LUFS integrated, ≤ −1 dBTP measured **after** a 320k AAC test encode, 0-sample alignment with the
source (printed). Then mux it over every render (video stream copied, never re-encoded):
```bash
ffmpeg -i renders/vN-raw.mp4 -i assets/master/master.wav -map 0:v -map 1:a -c:v copy -c:a aac -b:a 320k -ar 48000 -shortest -movflags +faststart renders/final/<Title>_4K60_YouTube.mp4
```
Verify: `ffprobe` (3840×2160, 60 fps, duration == song), `ebur128=peak=true` on the MP4's audio.

## Final render: 4K upload master
Compositions are authored at 1920×1080; HyperFrames renders them at 3840×2160 with a 2× device pixel ratio, so all
HTML/SVG/text is re-rasterised natively sharp (no upscaling). Worth it: YouTube gives 4K uploads its higher-quality
VP9/AV1 encodes, which look better even for 1080p viewers.
```bash
HF_SEGMENTED_CAPTURE=true npx hyperframes@<pinned> render . --resolution landscape-4k -q delivery --crf 12 --fps 60 -w 12 -o renders/final-4k-raw.mp4
# 4K 60 fps is the default master. Before it: free the GPU (nvidia-smi: another app holding VRAM once made a 4K60 render
# crawl at ~2 fps); 8–12 workers was the plateau on an RTX 5090 (≈ 4.8 fps on a full 3D-heavy timeline ≈ 66 min for 4:50);
# run `npx hyperframes benchmark .` on other machines. Add --resume after any interruption.
```
- **Restart-proof:** with `HF_SEGMENTED_CAPTURE=true` finished segments are kept in `renders/.hf-segments/<hash>/`; rerun the SAME
  command + `--resume` after a crash/restart and only the missing segments render. Once the NVIDIA driver reset mid-render
  (Windows System log `nvlddmkm` event 153, a GPU timeout/TDR → "Page.captureScreenshot: Unable to capture screenshot"); 4 of 6
  segments survived and `--resume` redid the other two. If a reset repeats, resume at `-w 8` (no speed loss vs 12 on the 5090).
- Log every delivery step to `renders/final/PROGRESS.txt` (step · DONE/FAILED · time) so an interrupted session resumes from the log.
- Measured (RTX 5090 + 32 threads, a 4:50 3D-heavy song, GPU free, segmented, `-w 12`): ≈ 13 fps ≈ 22 min of capture for 17,422 frames; the same render
  with another app holding 23 GB of VRAM crawled at ~2 fps (≈ 2 h). Check `nvidia-smi` first.
- The kit is 4K-ready: `kit3d.setup()` follows `devicePixelRatio` (3D drawn at full res), `KIT.receipt` swaps in the
  `@2x` screenshots, logos/fonts/mascots are vector. Check any custom canvas/raster image a director added (it must
  scale with `devicePixelRatio` / use 2x sources) — snapshot a 1:1 crop of the 4K frame to confirm sharpness.
- Cost: a much bigger file (CRF 12 at 4K60); keep drafts and critic rounds at 1080p30 and render 4K60 once, for the final.
- Mux the master audio exactly as below; name it `<Title>_4K60_YouTube.mp4`. Make a 1080p60 downscale (`<Title>_1080p60.mp4`, for the critic's regression
  check and other platforms), the phone preview and the
  thumbnails from it as usual (thumbnails stay 1280×720).

## Deliverables (`renders/final/`)
| File | How |
|---|---|
| `<Title>_4K60_YouTube.mp4` | THE upload: final 4K 60 fps render (CRF 12; the default master) + mastered AAC 320k, faststart |
| `<Title>_1080p60.mp4` | downscaled copy: the critic's regression check + platforms where 4K is overkill |
| `<Title>_preview720.mp4` | phone copy < 30 MB so it reaches the user's phone/web app: `-vf scale=1280:720,fps=30 -c:v h264_nvenc -b:v 900k -maxrate 1500k -c:a aac -b:a 96k` (use libx264 if no NVENC) |
| `<Title>.en.srt` | `python <skill>/scripts/make_srt.py assets/kit/song.js renders/final/<Title>.en.srt` (all lines incl. choruses) |
| `thumbnail-1..3_<name>.jpg` | the **top 3 thumbnail moments**, caption-free 1280×720 stills via `scripts/clean_stills.py` (rules below); optional text-overlay variant via `scripts/thumbnail.py` |
| `social-metadata.md` | 5 titles · description (SEO paragraph → chapters → sources → disclaimer → hashtags) · comma-separated tags · upload checklist — template `assets/templates/social-metadata.md`, rules below |

## Thumbnails — select the top 3 moments (collected throughout the edit)
Thumbnail hunting starts at the storyboard, not at the end: plan at least one thumbnail-worthy beat per section,
and have every builder log candidates in `analysis/thumbnail-moments.md` (time · frame · what · why · crop).
At delivery:
1. **Gather**: the log + your own scan of the final cut (grab ~20–30 stills of the hook moments, gags, reveals, the
   climax; a 5-wide contact sheet makes comparison easy).
2. **Judge each at phone size** (~320 px wide): one big idea; a big, expressive face (the host's LED face — shock,
   tears, smug — is the channel's signature); a bold 1–3-word sticker word; high contrast; little clutter; no caption
   bar; no tiny text; the emotion is readable in half a second. Busy frames lose even if they're the funniest gag.
   **Every thumbnail must contain something instantly recognisable**: a known brand mascot (3D Clawd), a product
   logo, or the AGENT host's face. People scan the feed for familiar characters; picks of fuzzy dice and an `rm -rf`
   gag had nothing familiar and were rejected, while the one with Clawd on a car won.
3. **Complement, don't repeat, the title**: the thumbnail shows the emotion/twist, the title tells the story (e.g. title
   "Don't Say A.I. (Or You're the Enemy)" + the shocked host under a giant "SHH!").
4. **Pick 3 different flavours** — e.g. the hook/emotion shot, the brand lockup (title card), the drama shot — so the user can
   A/B test. Keep the channel host the lead; brand mascots can co-star, but don't make the channel read as one provider's.
5. **Export clean**: `python <skill>/scripts/clean_stills.py renders/final 55.45:shh@80,30,1720,967 15.35:title 112.95:oh-no`
   (hides the caption overlay, renders exact full-res frames, crops 16:9 to drop edge clutter / push in, writes 1280×720 JPEGs).
   Try 2–3 times ±0.2 s around each moment to catch the peak expression; LOOK at the exports.
6. **Thumbnail review + staging pause (before calling the package done).** Put the exports side by
   side at full size and at ~320 px wide on both a white and a dark background (YouTube light/dark mode), and fix
   what doesn't read with STILL-ONLY staging that never touches the video:
   `clean_stills.py … --css "<rules>"` temporarily injects CSS into the frames for the export and restores every file
   byte-for-byte (verify hashes). Typical fixes: swap a background colour for contrast (e.g. an orange Clawd vanished
   on an orange downbeat ground → the title's own pale cyan), add a thick white sticker outline to the 3D title and
   mascot (stacked `drop-shadow(±6px 0 0 #fff)` filters on the 3D canvas), a slight saturation boost, nudge or hide a
   clashing element, or stage in a recognisable character/logo (a 2D mascot from `assets/props.js`, `assets/logos/*.svg`,
   the host's face). Keep everything on-model and true to the video: an accurate pale-cyan still was preferred over an
   AI-regenerated dark-blue redraw that had more pop but off-model letters, characters and text. Borrow ideas (white
   outlines, saturation) from such redraws, not their pixels.
7. List them in `social-metadata.md` with the title each pairs best with, and show them to the user.

## Social metadata (`renders/final/social-metadata.md`) — write it after the final cut exists
Also paste the description and the tag list into your reply so the user can copy them straight away.

**Channel framing:** titles must NOT announce the format ("a song", "a music video") or the channel's own topic
(on a channel that is all AI news, "about AI" says nothing). The title leads with the **funny angle of one story**
(often the song's hook). The workspace AGENTS.md may add the channel's own title rules or series shape.

**Titles — give 5 recommendations**, each:
- under 60 characters (show the count);
- simple, universal language — Grade-A readability, words a 7–8-year-old knows;
- a superlative when possible ("The Wildest Week Yet", "The Funniest…");
- written for humans, not algorithms (no keyword stuffing, no "| AI News Ep. 12");
- exaggeration is fine, clickbait is not — every promise must be true of the video;
- avoid violent/graphic words (e.g. "murder") — they can limit ads; keep that angle for the thumbnail.
Mix angles: the hook, a superlative + hook, a second story's gag, a roundup ("Le Chonk, Fake Tips & More"),
a character/mascot line. Star your pick and suggest an A/B pair. For a recurring series, keep one shape
(e.g. "The Wildest Week Yet: <hook>") so viewers recognise it.
Example set (the worked example in `assets/examples/`, a week of AI news, Oct 5–11, 2026): "Don't Say A.I. (Or You're the Enemy)" · "The Wildest Week Yet: Don't Say A.I." ·
"Saying "AI" Makes You the Enemy Now" · "The Craziest Week Yet: Le Chonk, Fake Tips & More" · "Be Nice to Claude. It's the Rule Now."

**Description**, in this order:
1. **SEO paragraph first** — one or two short lines on what the video is about: the week + the biggest
   stories in plain words, funny angle first, searchable names (companies, models, products) up front.
2. Chapters — first at 00:00, ≥ 3, each ≥ 10 s (merge short sections); label what's on screen at that time.
3. **Sources** — every receipt shown on screen plus the key research links: articles, official posts,
   GitHub repos, docs. `Outlet: Headline: URL`, one per line, in story order (pull from research.md / rects.json).
4. One-line disclaimer (real headlines; parody characters; logos/screenshots as commentary; made with AI tools).
5. 3 hashtags (YouTube shows them above the title).

**Pinned comment** — give a ⭐ pick + 2 alternatives, each 2–3 short lines, written in AGENT's voice:
- line 1 is the hook (only ~2 lines show before "Read more"): an in-joke dare from the song's hook works best
  (e.g. "Reminder: it's S.I. now 🤫 Anyone who says "AI" in the replies gets reported to the boss. 🤖" — people
  reply just to break the rule), else a pick-one poll of 3–4 stories with emoji, or "which line is stuck in your head?" + a quoted lyric;
- "Every headline is real (sources in the description)" — no links needed, the description has them;
- end by asking which story/launch should get the next song (it feeds the next episode);
- no begging for likes/subs, no clickbait, provider-neutral. Pin it as soon as the video is live and answer
  early replies in AGENT's voice.

**Tags** — one comma-separated line, ≤ 500 characters total including any tags the channel's upload defaults add
(count it; the workspace AGENTS.md lists them): broad → specific, e.g. for a news song "AI news, AI news
this week, weekly AI news, AI news roundup", the hook phrase, companies, products/models, mascots/characters,
themes (agentic coding, AI agents…), "<Month> <Year>".

Offer the user cleanup of draft renders (they're GBs) — never delete without asking.
