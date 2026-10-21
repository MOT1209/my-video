"""Word-level timestamps for SUNG vocals with faster-whisper (large-v3).

Usage: python transcribe_lyrics.py <audio> <out.json> [--prompt "names, jargon, hook words"] [--device cuda|cpu]

- Whisper on a full mix is usually good enough for timing (±80 ms). Text will be mis-heard in places —
  that's fine: align_lyrics.py takes TEXT from the lyric sheet and only TIMING from here.
- --prompt biases recognition toward proper nouns / invented words in the lyrics (product names, the hook).
- Tries CUDA first; falls back to CPU int8 if the CUDA runtime (cuBLAS/cuDNN) isn't installed.
  CPU large-v3 on a 3–4 min song takes a few minutes; run it in the background.
"""
import json, os, sys
sys.stdout.reconfigure(encoding="utf-8", errors="replace")
args = sys.argv[1:]
prompt, device = "", None
if "--prompt" in args:
    i = args.index("--prompt"); prompt = args[i + 1]; del args[i:i + 2]
if "--device" in args:
    i = args.index("--device"); device = args[i + 1]; del args[i:i + 2]
audio, out = args[0], args[1]

from faster_whisper import WhisperModel

def run(dev):
    model = WhisperModel("large-v3", device=dev, compute_type="float16" if dev == "cuda" else "int8",
                         cpu_threads=max(4, (os.cpu_count() or 8) // 2))
    segments, _ = model.transcribe(audio, language=os.environ.get("LYRICS_LANG", "en"), word_timestamps=True,
                                   beam_size=5, initial_prompt=prompt or None,
                                   condition_on_previous_text=False, vad_filter=False, no_speech_threshold=0.9)
    res = []
    for s in segments:   # generator: errors (e.g. missing cuBLAS) surface here
        ws = [{"w": w.word.strip(), "s": round(w.start, 3), "e": round(w.end, 3), "p": round(w.probability, 3)} for w in (s.words or [])]
        res.append({"start": round(s.start, 3), "end": round(s.end, 3), "text": s.text.strip(), "words": ws})
        print(f"[{s.start:7.2f} -> {s.end:7.2f}] {s.text.strip()}", flush=True)
    return res

res = None
for dev in ([device] if device else ["cuda", "cpu"]):
    try:
        res = run(dev); break
    except Exception as e:  # noqa: BLE001
        print(f"device {dev} failed: {e}", file=sys.stderr)
if res is None:
    sys.exit("transcription failed on all devices")
json.dump(res, open(out, "w", encoding="utf-8"), indent=1, ensure_ascii=False)
print(f"wrote {out}: {sum(len(s['words']) for s in res)} words")
