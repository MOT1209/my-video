"""Build assets/kit/song.js (window.SONG) — the single timing source every frame reads.

Inputs:
  --audiomap   audiomap.json from music-to-video's analyze-beatgrid.py (beats, downbeats, key moments)
  --transcript transcript.json from transcribe_lyrics.py (word onsets)
  --lines      lines.json from align_lyrics.py (hand-edit it first: delete stage directions, fix text)
  --frames     optional frames.json [{"id":"01-intro","s":0,"e":11.935}, ...] — if omitted, sections are
               derived from the lyric section tags: each section starts on the beat at/just before its first
               sung word (first section at 0, last ends at the track end).
  --out        output path (default assets/kit/song.js)
Also writes <out_dir>/sections.json so you can paste/adjust frame spans into STORYBOARD.md.

Usage: python build_song.py --audiomap audiomap.json --transcript analysis/transcript.json --lines analysis/lines.json
"""
import argparse, json, os, re, sys
sys.stdout.reconfigure(encoding="utf-8", errors="replace")

ap = argparse.ArgumentParser()
ap.add_argument("--audiomap", required=True)
ap.add_argument("--transcript", required=True)
ap.add_argument("--lines", required=True)
ap.add_argument("--frames")
ap.add_argument("--out", default="assets/kit/song.js")
ap.add_argument("--keep-unmatched", action="store_true", help="keep lines with match==0 (default: drop them)")
a = ap.parse_args()

am = json.load(open(a.audiomap, encoding="utf-8"))
segs = json.load(open(a.transcript, encoding="utf-8"))
words = [w for s in segs for w in s.get("words", [])]
lines = json.load(open(a.lines, encoding="utf-8"))
if not a.keep_unmatched:
    lines = [l for l in lines if l.get("match", 1) > 0]
lines.sort(key=lambda l: l["s"])
dur = am["audio"]["duration_sec"]
beats = [round(b, 3) for b in am["grid"]["beats_sec"]]

def beat_before(t, max_lead=0.6):
    cands = [b for b in beats if t - max_lead <= b <= t + 0.02]
    return max(cands) if cands else round(max(0.0, t - 0.05), 3)

if a.frames:
    sections = json.load(open(a.frames, encoding="utf-8"))
else:
    sections, last = [], None
    for l in lines:
        sec = l.get("section", "song")
        if sec != last:
            sections.append({"id": sec, "s": 0.0 if not sections else beat_before(l["s"])})
            last = sec
    # make ids unique + filename-friendly, and close spans
    seen = {}
    for i, s in enumerate(sections):
        base = re.sub(r"[^a-z0-9]+", "-", s["id"].lower()).strip("-") or "part"
        seen[base] = seen.get(base, 0) + 1
        s["id"] = f"{i + 1:02d}-{base}" + (f"{seen[base]}" if seen[base] > 1 else "")
        s["e"] = sections[i + 1]["s"] if i + 1 < len(sections) else dur
    sections[-1]["e"] = dur

song = {
    "duration": dur,
    "bpm": am["tempo"]["bpm"],
    "beats": beats,
    "downbeats": [round(b, 3) for b in am["grid"]["downbeats_sec"]],
    "words": [{"w": re.sub(r"[^\w'.\-]", "", w["w"]), "s": w["s"], "e": w["e"]} for w in words],
    "lines": [{"s": l["s"], "e": l["e"], "t": l["t"], "cap": bool(l.get("cap", True)), "w": l["w"], "section": l.get("section", ""), **({"voice": l["voice"]} if l.get("voice") else {})} for l in lines],
    "sections": [{"id": s["id"], "s": round(s["s"], 3), "e": round(s["e"], 3)} for s in sections],
    "hits": {
        "surge": [k["t"] for k in am.get("key_moments", []) if k["kind"] == "SURGE"],
        "drop": [k["t"] for k in am.get("key_moments", []) if k["kind"] == "DROP"],
        "silences": am.get("silences", []),
    },
}
os.makedirs(os.path.dirname(a.out) or ".", exist_ok=True)
with open(a.out, "w", encoding="utf-8") as f:
    f.write("window.SONG = " + json.dumps(song, separators=(",", ":"), ensure_ascii=False) + ";\n")
json.dump(song["sections"], open(os.path.join(os.path.dirname(a.out) or ".", "sections.json"), "w"), indent=1)
print(f"song.js: {len(song['lines'])} lines, {len(song['words'])} words, {len(beats)} beats, {song['bpm']} BPM, {dur}s")
for s in song["sections"]:
    print(f"  {s['id']:<22} {s['s']:8.3f} → {s['e']:8.3f}  ({s['e'] - s['s']:.2f}s)")
