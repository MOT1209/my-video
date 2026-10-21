"""YouTube subtitle file (SRT) from song.js lyric lines (all lines, including choruses).
Usage: python make_srt.py [assets/kit/song.js] [out.srt]
Each cue starts at the line's first sung word (or its start, whichever is earlier), ends 0.3 s after the line
(but 0.05 s before the next cue), and lines longer than 42 characters are split into two balanced lines.
"""
import json, sys
sys.stdout.reconfigure(encoding="utf-8", errors="replace")
song = sys.argv[1] if len(sys.argv) > 1 else "assets/kit/song.js"
out = sys.argv[2] if len(sys.argv) > 2 else "renders/final/lyrics.en.srt"
S = json.loads(open(song, encoding="utf-8").read().replace("window.SONG = ", "").rstrip().rstrip(";"))
MAX = 42
def ts(t):
    ms = int(round(max(0, t) * 1000)); h, ms = divmod(ms, 3600000); m, ms = divmod(ms, 60000); s, ms = divmod(ms, 1000)
    return f"{h:02d}:{m:02d}:{s:02d},{ms:03d}"
def wrap(text):
    if len(text) <= MAX: return text
    words = text.split(" ")
    best = min(range(1, len(words)), key=lambda k: abs(len(" ".join(words[:k])) - len(" ".join(words[k:]))))
    return " ".join(words[:best]) + "\n" + " ".join(words[best:])
L = sorted(S["lines"], key=lambda l: l["s"])
start = [min(l["s"], (l.get("w") or [l["s"]])[0]) for l in L]
cues = []
for i, l in enumerate(L):
    nxt = start[i + 1] if i + 1 < len(L) else S["duration"]
    a = max(start[i], (start[i - 1] + 0.05) if i else 0)
    cues.append(f"{len(cues) + 1}\n{ts(a)} --> {ts(min(l['e'] + 0.3, nxt - 0.05))}\n{wrap(l['t'])}\n")
open(out, "w", encoding="utf-8").write("\n".join(cues)); print(len(cues), "cues →", out)
