# Phase 5 — Production setup and building frames

Read `/hyperframes` → `/hyperframes-core` (composition contract) and skim `/music-to-video` once per session;
this file covers what's specific to this workflow.

## Setup (≈10 minutes)
```bash
npx hyperframes init videos/<YYYY-MM-DD>-<song-slug> --non-interactive --example=blank     # if not done in phase 3
node <skill>/scripts/setup_project.mjs videos/<YYYY-MM-DD>-<song-slug>                       # kit, fonts(+licences), vendor libs, captions overlay, theme stubs
cp <skill>/assets/templates/DIRECTOR-GUIDE.md videos/<YYYY-MM-DD>-<song-slug>/        # fill the {{…}} placeholders
```
Write `STORYBOARD.md` (phase 4) and `frame.md` (the chosen preset/brand spec), then:
```bash
node <skills>/music-to-video/scripts/validate-plan.mjs --storyboard STORYBOARD.md --audiomap audiomap.json --templates <skills>/music-to-video/references/templates
node <skill>/scripts/placeholders.mjs     # one placeholder per frame (ground + id + its lyric lines + an empty timeline) so the project always renders
node <skills>/music-to-video/scripts/assemble-index.mjs --storyboard STORYBOARD.md --hyperframes . --audiomap audiomap.json
node <skill>/scripts/finalize_index.mjs        # local gsap, kit + theme includes, captions overlay — re-run after every assemble
```
Note: `setup_project.mjs` refreshes the kit's own files (kit.css/js, kit3d.js, glyphs.js) but never touches
`assets/kit/song.js`, your frames, storyboard or theme files — safe to re-run after updating the skill.

## Build the reference frame(s) yourself first
Before delegating, build the opening frame (and ideally the title) to the full bar. It proves the pipeline
(fonts, paths, kit, 3D) and gives directors a concrete example of the house style — they match what they see.
Examples from the worked example: `assets/examples/01-intro.html` (dark-room character intro, evidence
board of receipts, lip-sync, glitch, censor gag), `02-title.html` (3D title with letter swap),
`07-chant1.html` (3D Clawd dance break), `14-sat-sun.html` (receipts + 3D lever + Clawd stage).

## Checking work
- `npx hyperframes snapshot . --at <times> --no-end --describe false -o analysis/<dir>` → read the contact sheet + PNGs.
  (`--describe false` skips sending frames to an external vision API.)
- `npx hyperframes lint .` (0 errors before any render; warnings like file size / initial-hide are normal).
- `npx hyperframes preview --background` → live Studio at localhost with audio, auto-reloading — great for the
  user to watch progress. Stop it with `--stop` when done. Studio adds `data-hf-id` attributes to files it opens: harmless.
- Short preview clips: `node <skill>/scripts/preview_root.mjs --until <s>` writes a temp root with only the opening frames (or by hand: copy `index.html` keeping only the first frames, set root/caption/bgm
  durations), `npx hyperframes render . -c preview.html -o renders/preview.mp4 --fps 30`, mux the master audio, send it. Delete the temp file after (two root compositions = lint error).

## Rendering
**Speed + safety for the final master (measured on earlier videos; test these first on a new machine):**
- **The final master is 4K 60 fps by default.** Measured on an RTX 5090 (32 GB) with the GPU free: 4K60 capture
  plateaus at 8 workers (~20.8 fps on a 3D intro clip; 8, 12 and 16 identical; VRAM 8.5–13.5 GB); a full 3D-heavy timeline runs at
  ~0.23× the clip rate (≈ 4.8 fps → ~66 min for a 4:50 song). Use `-w 12` on that class of machine.
- Benchmark before the big render: `npx hyperframes benchmark .` finds the fastest worker count on this machine. The docs call
  ~4 workers "usually the sweet spot"; a 4K60 render at `-w 16` once ran at only ~2–2.6 frames/s (≈ 2 h for 17,422 frames)
  with GPU memory at 31/32 GB and compute at 37%: the workers were likely contending for VRAM, so more workers was slower.
- Make long renders restart-proof: set `HF_SEGMENTED_CAPTURE=true` (and `--resume` after an interruption) so finished segments are
  kept; a PC restart once cost a whole 4K render. Keep a `renders/final/PROGRESS.txt` step log for the delivery job.
- `--resolution` only scales the 1080p layout by whole numbers (1080p or 4K; 1440p is not possible). When time matters: 4K30 halves the
  frames, 1080p60 is ~4× faster than 4K60. Check GPU memory first (`nvidia-smi`): another app once held 23 GB of the 32 GB VRAM.
- Render the heavy master ONCE: critic rounds use 1080p30 drafts. Heavy 3D roughly doubles render time (drafts went 5 → 11 min).

Drafts and critic rounds: 1080p (fast). **Final upload master: 4K** (see delivery.md).
`npx hyperframes render . -q delivery --crf 12 --fps 60 -w 12 -o renders/vN-raw.mp4`
- Use the machine: WebGL capture runs on the GPU automatically; raise `-w` (workers) on a many-core CPU.
  A 3.6-min 60 fps render took ~7 min with 12 workers on an RTX 5090 + 32 threads.
- Flat graphics compress well: CRF 16 gave ~9 Mb/s, CRF 12 ~15 Mb/s (above YouTube's 12 Mb/s 1080p60 guide).
- Then mux the mastered audio over it (see delivery.md) — never ship the renderer's own audio mix.
