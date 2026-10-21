"""Align a lyric sheet to Whisper word timings → lines.json (+ a section list).

The lyric sheet is the source of truth for TEXT (Whisper mishears sung words);
Whisper is the source of truth for TIMING. Alignment is a word-sequence diff,
so small mishearings and ad-libs are tolerated.

Lyric sheet format (markdown is fine):
  [Intro – spoken]            <- section tag on its own line ([...]); text after "–"/"-" is ignored
  Yo boss, it's your agent.   <- one sung line per line
  *(record scratch)*          <- a line that is only a parenthetical/stage direction is kept but usually won't match
Headings (#), blank lines, '---', tables and "**Suggested style:**"-type lines are skipped.

Usage:
  python align_lyrics.py <lyrics.md> <transcript.json> <out_lines.json> [--nocap "chorus|hook|chant|breakdown|post"]

Output lines.json: [{"s","e","t","cap","section","w":[word onset per token],"match":0..1}, ...]
Lines with match==0 had no recognisable sung words (stage directions, inaudible ad-libs): their
times are interpolated and they are flagged in the printed report so you can delete or fix them.
"""
import difflib, json, re, sys
sys.stdout.reconfigure(encoding="utf-8", errors="replace")

args = sys.argv[1:]
nocap = r"chorus|hook|chant|breakdown|post|drop"
if "--nocap" in args:
    i = args.index("--nocap"); nocap = args[i + 1]; del args[i:i + 2]
lyr_path, tr_path, out_path = args[:3]

def norm_tokens(text):
    text = text.lower().replace("’", "'")
    text = re.sub(r"[—–/]", " ", text)
    toks = []
    for raw in text.split():
        for part in raw.split("-"):
            t = re.sub(r"[^a-z0-9']", "", part).strip("'")
            if t:
                toks.append(t)
    return toks

# ---- parse lyric sheet ----
lines, section = [], "intro"
for raw in open(lyr_path, encoding="utf-8").read().splitlines():
    s = raw.strip()
    if not s or s.startswith("#") or s.startswith("---") or s.startswith("|") or s.startswith(">"):
        continue
    if re.match(r"^\*\*[^*]+:\*\*", s):          # **Label:** prose
        continue
    m = re.match(r"^\[([^\]]+)\]", s)
    if m:
        section = re.split(r"\s[–-]\s|\s\(", m.group(1))[0].strip().lower()
        rest = s[m.end():].strip()
        if not rest:
            continue
        s = rest
    text = re.sub(r"\*+", "", s).strip()
    if not text:
        continue
    lines.append({"t": text, "section": section, "toks": norm_tokens(text)})

# ---- transcript words ----
segs = json.load(open(tr_path, encoding="utf-8"))
words = [w for sg in segs for w in sg.get("words", [])]
tw, tw_idx = [], []
for wi, w in enumerate(words):
    for t in norm_tokens(w["w"]):
        tw.append(t); tw_idx.append(wi)

ly, ly_line = [], []
for li, L in enumerate(lines):
    for t in L["toks"]:
        ly.append(t); ly_line.append(li)

# ---- global monotonic alignment (Needleman–Wunsch) — robust to repeated choruses ----
_simc = {}
def sim(a, b):
    if a == b:
        return 3
    key = (a, b)
    if key not in _simc:
        r = difflib.SequenceMatcher(None, a, b).ratio() if abs(len(a) - len(b)) <= 3 else 0
        _simc[key] = 1 if r >= 0.72 else -2
    return _simc[key]

GAP = -1
n, m = len(ly), len(tw)
score = [[0] * (m + 1) for _ in range(n + 1)]
move = [[0] * (m + 1) for _ in range(n + 1)]   # 1 diag, 2 up (skip lyric token), 3 left (skip transcript token)
for i in range(1, n + 1):
    score[i][0] = i * GAP; move[i][0] = 2
for j in range(1, m + 1):
    score[0][j] = j * GAP * 0.5; move[0][j] = 3     # skipping transcript (ad-libs, chants) is cheaper
for i in range(1, n + 1):
    a, row, prow, mrow = ly[i - 1], score[i], score[i - 1], move[i]
    for j in range(1, m + 1):
        d = prow[j - 1] + sim(a, tw[j - 1])
        u = prow[j] + GAP
        l = row[j - 1] + GAP * 0.5
        if d >= u and d >= l:
            row[j] = d; mrow[j] = 1
        elif u >= l:
            row[j] = u; mrow[j] = 2
        else:
            row[j] = l; mrow[j] = 3
match = {}
i, j = n, m
while i > 0 and j > 0:
    mv = move[i][j]
    if mv == 1:
        if sim(ly[i - 1], tw[j - 1]) > 0:
            match[i - 1] = tw_idx[j - 1]
        i -= 1; j -= 1
    elif mv == 2:
        i -= 1
    else:
        j -= 1

# ---- per-line timing ----
pos = 0
for li, L in enumerate(lines):
    n = len(L["toks"])
    idxs = list(range(pos, pos + n)); pos += n
    hits = [(k - idxs[0], match[k]) for k in idxs if k in match]
    L["match"] = round(len(hits) / max(1, n), 2)
    if hits:
        L["s"] = words[hits[0][1]]["s"]
        L["e"] = words[hits[-1][1]]["e"]
        # word onsets: matched tokens get their time, others interpolate
        known = {j: words[wi]["s"] for j, wi in hits}
        w = []
        for j in range(n):
            if j in known:
                w.append(known[j]); continue
            prev = max([k for k in known if k < j], default=None)
            nxt = min([k for k in known if k > j], default=None)
            if prev is not None and nxt is not None:
                w.append(known[prev] + (known[nxt] - known[prev]) * (j - prev) / (nxt - prev))
            elif prev is not None:
                w.append(known[prev] + 0.18 * (j - prev))
            else:
                w.append(max(0.0, known[nxt] - 0.18 * (nxt - j)))
        L["w"] = [round(x, 3) for x in w]
    else:
        L["s"] = L["e"] = None
        L["w"] = []

# interpolate unmatched lines between neighbours
for li, L in enumerate(lines):
    if L["s"] is not None:
        continue
    prev_e = next((lines[k]["e"] for k in range(li - 1, -1, -1) if lines[k]["s"] is not None), 0.0)
    nxt_s = next((lines[k]["s"] for k in range(li + 1, len(lines)) if lines[k]["s"] is not None), prev_e + 2.0)
    L["s"], L["e"] = round(prev_e + 0.05, 3), round(max(prev_e + 0.3, nxt_s - 0.05), 3)
    n = max(1, len(L["toks"]))
    L["w"] = [round(L["s"] + (L["e"] - L["s"]) * j / n, 3) for j in range(n)]

out = []
for L in lines:
    toks_disp = L["t"].split()
    w = L["w"]
    # map token onsets onto display words (display words can contain hyphenated multi-tokens)
    disp_w, k = [], 0
    for word in toks_disp:
        nt = max(1, len(norm_tokens(word)))
        disp_w.append(w[min(k, len(w) - 1)] if w else L["s"])
        k += nt
    for j in range(1, len(disp_w)):
        disp_w[j] = round(max(disp_w[j], disp_w[j - 1] + 0.04), 3)
    out.append({"s": round(L["s"], 3), "e": round(L["e"], 3), "t": L["t"], "section": L["section"],
                "cap": not re.search(nocap, L["section"]), "w": disp_w, "match": L["match"]})

json.dump(out, open(out_path, "w", encoding="utf-8"), indent=1, ensure_ascii=False)
print(f"{len(out)} lines → {out_path}")
for L in out:
    flag = "  " if L["match"] >= 0.5 else ("!!" if L["match"] == 0 else "? ")
    print(f"{flag} {L['s']:7.2f}–{L['e']:7.2f} [{L['section']:<10}] {'cap' if L['cap'] else '   '} m={L['match']:.2f}  {L['t'][:70]}")
print("\n!! = no sung words matched (stage direction / inaudible) — delete or hand-time it.  ? = weak match — eyeball the timing.")
