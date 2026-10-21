# Phase 3 — Track analysis (beats, quiet moments, what was sung when)

Everything downstream is timed from these files. Do them once, carefully.

1. **Project + music**: `npx hyperframes init videos/<YYYY-MM-DD>-<song-slug> --non-interactive --example=blank`, copy the track to
   `assets/bgm.mp3` (extract from video with ffmpeg if needed).
2. **Beat / energy map** (the music-to-video analyzer — the only beat analyzer you should use):
   `python <skills>/music-to-video/scripts/analyze-beatgrid.py assets/bgm.mp3 -o audiomap.json --print`
   (needs `pip install librosa numpy soundfile`). Read: tempo, `phrases`, `energy_phases`, `key_moments`
   (SURGE/DROP), `silences`, `hard_stops`. Trust beats only where the music is rhythmic.
3. **Sung-word timing**: `python <skill>/scripts/transcribe_lyrics.py assets/bgm.mp3 analysis/transcript.json --prompt "<names, invented words, the hook>"`
   (faster-whisper large-v3; CUDA, falls back to CPU — run in background). No source separation needed in practice.
4. **Align the lyric sheet**: `python <skill>/scripts/align_lyrics.py lyrics.md analysis/transcript.json analysis/lines.json`
   Global alignment, robust to repeated choruses. Review the report: delete `!!` lines that aren't sung
   (stage directions), hand-fix `?` lines, and edit text where the singer changed a lyric (trust the ear/transcript
   over the sheet when they disagree). Set `cap:false` on lines the on-screen typography will carry.
5. **Who sings each line (voice casting)**: `python <skill>/scripts/voice_cast.py --male 2-10 --male <a sung male line> --female 11.9-15.8`
   (review the table) then the same with `--write`. Generated tracks often mix a male and a female voice (a spoken hook, a duet
   line, ad-libs). The script separates the vocals with Demucs (own venv, CPU is fine) and compares each line's **speaker
   embedding** (SpeechBrain ECAPA) with the reference spans; it is male unless the female reference clearly wins, and writes
   `voice: "m" | "f" | "duet" | "?"` (keeps "gang"). **Don't cast by pitch**: on one song pitch tagged 24 high male melody lines
   (~250–330 Hz) female and the user heard the wrong character singing all over the video. Give several male spans (spoken, rap,
   sung) and every span the user confirms; spot-check its LOW-CONFIDENCE list by ear. The rule this feeds: **the character
   lip-syncing on screen must match the voice** (male AGENT for male lines, the female AGENT `KIT.femme` for female lines, both for duets).
6. **Song data**: `python <skill>/scripts/build_song.py --audiomap audiomap.json --transcript analysis/transcript.json --lines analysis/lines.json`
   → `assets/kit/song.js` (`window.SONG`) + `assets/kit/sections.json` (section starts snapped to the beat
   just before the first sung word). Re-run whenever lines change.
7. **Read the song like an editor** — `node <skill>/scripts/words.mjs <t0> <t1>` per section. Note: the drop
   points, silences (perfect for freezes / record-scratch gags), instrumental gaps (title cards, dance
   breaks), the energy curve (save the biggest visuals for the last chorus), and the words that deserve a
   visual hit.

Frame plan: one frame (sub-composition) per section is a good default; split sections longer than ~15 s
at a lyric/story change (e.g. one frame per news story). Each frame boundary = the beat at/just before the
first sung word of the new part. Frames must tile the whole track with no gaps.
