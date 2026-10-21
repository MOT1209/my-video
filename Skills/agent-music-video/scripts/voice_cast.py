"""Who sings each line? Cast the male AGENT or the female AGENT per lyric line, from SPEAKER EMBEDDINGS of the vocal stem.

Usage (project root, after align_lyrics.py has written analysis/lines.json):
  python voice_cast.py --male 2.0-10.0 --male 57.5-61.0 --female 11.9-15.8     # reference spans you KNOW (track s, repeatable)
                       [--audio assets/bgm.mp3] [--lines analysis/lines.json] [--vocals <vocals.wav>]
                       [--demucs-python <python.exe>] [--keep gang] [--f-margin 0.15] [--f-min 0.45]
                       [--method embed|pitch] [--write]

Why embeddings, and why male-by-default (learned on an earlier song): the old pitch method tagged ~24 of 57 sung lines
female, the user heard most of them as the MALE singer. A man singing a melody sits at ~200–330 Hz, right inside a female
range, so pitch cannot tell them apart (the 57.56 s line "You don't need a toolbox, boss…" is male at ~247 Hz). A speaker-
recognition model (SpeechBrain ECAPA-TDNN, speechbrain/spkrec-ecapa-voxceleb) compares the voice's timbre instead, and it
showed the whole sung pre-chorus/chorus/bridge clustering with the confirmed male sung line, while only the one known female line
matched the female reference. Generated songs often have the female voice only in a hook line or ad-libs, so this script does
NOT force a 2-cluster split: every line is MALE unless the female reference clearly wins.

1. Separates the vocals with Demucs (htdemucs, two stems) unless --vocals is given (the full mix is useless for this).
   Demucs + SpeechBrain need torch: keep them in their own venv (the script re-runs itself in it automatically). The app
   folder is %LOCALAPPDATA%/agent-music-video on Windows, ~/.local/share/agent-music-video elsewhere:
     python -m venv <app folder>/demucs-venv
     <venv>/Scripts/python -m pip install torch torchaudio --index-url https://download.pytorch.org/whl/cpu   (bin/python off Windows)
     <venv>/Scripts/python -m pip install demucs soundfile librosa speechbrain
   CPU is fine (Demucs ~1–3 min per song; embeddings ~1 min). The ECAPA model (~80 MB) downloads once to
   <app folder>/models/.
2. Anchors: each --male / --female span is embedded in ~2 s chunks → one centroid PER SPAN. Give several male spans that cover
   the male voice's different modes (spoken intro, rap verse, sung melody) — a voice's spoken and sung embeddings can be as far
   apart as two different people, so the male score is the BEST match over the male spans, not a single average.
3. Each line (voiced audio only, silence trimmed) is embedded and scored: F = cosine to the female anchors, M = best cosine to a
   male anchor, margin = F − M. It is "f" only if margin ≥ --f-margin AND F ≥ --f-min (a clear AND strong match to the female
   reference); otherwise "m". Halves of longer lines are scored too: one half clearly female, the other male → "duet". 1 s
   windows inside male lines that clearly match the female voice → note "female backing?" (the lead still lip-syncs: "m").
   Too little voiced audio → "?". Lines already labelled with a --keep label (default "gang": shouted gang chants) keep it.
   Pitch is only a tie-breaker for close calls (median f0 < 200 Hz → m, > 350 Hz → f, otherwise the male default stands).
4. It prints a table (time · voice · F · M · margin · line) and a LOW-CONFIDENCE list (close margins, weak matches, little
   audio, tie-breaks) to spot-check BY EAR, then fix any line by hand ("voice": "m" | "f" | "duet" | "gang").
5. --write stores "voice" + "f0" (+ "voice_margin") on every line in lines.json; re-run build_song.py so SONG.lines[i].voice
   reaches the frames. Writes analysis/voices.json either way.
--method pitch = the old pitch-only method (nearest reference median in log-pitch); the automatic fallback if SpeechBrain is
missing. Treat its "f" tags with suspicion for high male singing.
"""
import json, math, os, subprocess, sys
sys.stdout.reconfigure(encoding="utf-8", errors="replace")
os.environ.setdefault("HF_HUB_DISABLE_SYMLINKS_WARNING", "1")
import numpy as np

args = sys.argv[1:]
def opt(name, default=None, multi=False):
    vals, i = [], 0
    while i < len(args):
        if args[i] == name and i + 1 < len(args): vals.append(args[i + 1]); i += 2
        else: i += 1
    return vals if multi else (vals[-1] if vals else default)
audio = opt("--audio", "assets/bgm.mp3")
lines_path = opt("--lines", "analysis/lines.json")
vocals = opt("--vocals")
spans = lambda xs: [tuple(map(float, x.split("-"))) for x in xs]
ref_f, ref_m = spans(opt("--female", multi=True)), spans(opt("--male", multi=True))
keep = set(x for x in opt("--keep", "gang").split(",") if x)
F_MARGIN, F_MIN = float(opt("--f-margin", 0.15)), float(opt("--f-min", 0.45))
method = opt("--method", "embed")
APPDIR = os.path.join(os.environ.get("LOCALAPPDATA") or os.path.join(os.path.expanduser("~"), ".local", "share"), "agent-music-video")
venv_py = os.path.join(APPDIR, "demucs-venv", *(("Scripts", "python.exe") if os.name == "nt" else ("bin", "python")))
dpy = opt("--demucs-python", venv_py if os.path.exists(venv_py) else sys.executable)

def has_speechbrain():
    try:
        import speechbrain  # noqa: F401
        return True
    except Exception:
        return False
if method == "embed" and not has_speechbrain():
    me, venv = os.path.abspath(sys.executable).lower(), os.path.abspath(dpy).lower()
    if os.path.exists(dpy) and me != venv and not os.environ.get("VOICE_CAST_REEXEC"):
        r = subprocess.run([dpy, os.path.abspath(__file__), *args], env=dict(os.environ, VOICE_CAST_REEXEC="1"))
        sys.exit(r.returncode)
    print("WARNING: SpeechBrain not available — falling back to the pitch method (unreliable for high male singing).\n"
          f"  install: {dpy} -m pip install speechbrain", flush=True)
    method = "pitch"
if method == "embed" and not (ref_f and ref_m):
    print("WARNING: the embedding method needs at least one --male and one --female span — falling back to pitch.", flush=True)
    method = "pitch"

if not vocals:
    stem_dir = "analysis/stems"
    name = os.path.splitext(os.path.basename(audio))[0]
    vocals = os.path.join(stem_dir, "htdemucs", name, "vocals.wav")
    if not os.path.exists(vocals):
        print(f"separating vocals with demucs ({dpy}) …", flush=True)
        r = subprocess.run([dpy, "-m", "demucs", "--two-stems=vocals", "-n", "htdemucs", "-o", stem_dir, audio])
        if r.returncode != 0 or not os.path.exists(vocals):
            sys.exit("demucs failed — install it in its own venv (see the docstring) or pass --vocals")

import librosa
SR = 16000
y, _ = librosa.load(vocals, sr=SR, mono=True)
L = json.load(open(lines_path, encoding="utf-8"))

def f0_of(s, e):
    seg = y[int(max(0, s) * SR):int(e * SR)]
    if len(seg) < int(0.12 * SR): return []
    f0, vf, vp = librosa.pyin(seg, fmin=70, fmax=900, sr=SR, frame_length=1024, hop_length=160)
    return [float(v) for v, ok, p in zip(f0, vf, vp) if ok and p > 0.55 and not math.isnan(v)]
med = lambda xs: float(np.median(xs)) if len(xs) else float("nan")
st = lambda hz: 12 * math.log2(hz / 440.0) if hz and hz > 0 else float("nan")
line_span = lambda l: (min(l["s"], (l.get("w") or [l["s"]])[0]), l["e"])

# ───────────────────────────── pitch method (legacy / fallback) ─────────────────────────────
def cast_pitch():
    rows = []
    for li, l in enumerate(L):
        ws = l.get("w") or [l["s"]]
        ends = ws[1:] + [l["e"]]
        words = []
        for a, b in zip(ws, ends):
            fs = f0_of(a, min(b, a + 0.9))
            words.append(med(fs) if len(fs) >= 3 else float("nan"))
        allf = f0_of(*line_span(l))
        rows.append({"i": li, "s": l["s"], "e": l["e"], "t": l["t"], "section": l.get("section", ""), "f0": med(allf), "n": len(allf), "words": words})
    def ref_median(sp):
        fs = []
        for a, b in sp: fs += f0_of(a, b)
        return med(fs)
    fm, mm = (ref_median(ref_f) if ref_f else None), (ref_median(ref_m) if ref_m else None)
    vals = np.array([st(r["f0"]) for r in rows if not math.isnan(r["f0"]) and r["n"] >= 8])
    if fm and mm: cf, cm = st(fm), st(mm)
    elif fm or mm:
        known = st(fm or mm); other = vals[np.abs(vals - known) > 4]
        oc = float(np.median(other)) if len(other) else known + (-6 if fm else 6)
        cf, cm = (known, oc) if fm else (oc, known)
    else:
        c = np.percentile(vals, [25, 75]) if len(vals) else np.array([0, 0])
        for _ in range(20):
            lab = np.abs(vals - c[0]) > np.abs(vals - c[1])
            c = np.array([vals[~lab].mean() if (~lab).any() else c[0], vals[lab].mean() if lab.any() else c[1]])
        cm, cf = float(min(c)), float(max(c))
    split, mid = abs(cf - cm) >= 4, (cf + cm) / 2
    who = lambda hz: None if math.isnan(hz) else ("f" if st(hz) > mid else "m")
    for r in rows:
        if L[r["i"]].get("voice") in keep: r["voice"] = L[r["i"]]["voice"]
        elif not split: r["voice"] = "m"
        elif math.isnan(r["f0"]) or r["n"] < 8: r["voice"] = "?"
        else:
            r["voice"] = who(r["f0"])
            ws = [who(w) for w in r["words"] if not math.isnan(w)]
            if len(ws) >= 4 and 0.3 <= ws.count("f") / len(ws) <= 0.7: r["voice"] = "duet"
        r.update(F=None, M=None, margin=None, low=[], notes=[])
    print(f"[pitch] centres: male ≈ {440 * 2 ** (cm / 12):.0f} Hz, female ≈ {440 * 2 ** (cf / 12):.0f} Hz, split {'yes' if split else 'NO'}")
    return rows

# ───────────────────────────── embedding method (default) ─────────────────────────────
def cast_embed():
    import torch
    from speechbrain.inference.speaker import EncoderClassifier
    try:
        from speechbrain.utils.fetching import LocalStrategy
        kw = {"local_strategy": LocalStrategy.COPY}          # no symlinks needed on Windows
    except Exception:
        kw = {}
    clf = EncoderClassifier.from_hparams(source="speechbrain/spkrec-ecapa-voxceleb", run_opts={"device": "cpu"},
                                         savedir=os.path.join(APPDIR, "models", "spkrec-ecapa-voxceleb"), **kw)
    def voiced(a, b):
        seg = y[int(max(0, a) * SR):int(max(a, b) * SR)]
        if len(seg) < SR // 10: return seg[:0]
        iv = librosa.effects.split(seg, top_db=30, frame_length=1024, hop_length=256)
        return np.concatenate([seg[s:e] for s, e in iv]) if len(iv) else seg[:0]
    @torch.no_grad()
    def emb(w):
        e = clf.encode_batch(torch.tensor(w, dtype=torch.float32).unsqueeze(0)).squeeze().numpy()
        return e / (np.linalg.norm(e) + 1e-9)
    def anchor(a, b):
        es, t = [], a
        while t < b - 0.8:
            w = voiced(t, min(b, t + 2.0))
            if len(w) >= 0.8 * SR: es.append(emb(w))
            t += 2.0
        if not es:
            w = voiced(a, b)
            if len(w) >= 0.5 * SR: es.append(emb(w))
        if not es: sys.exit(f"reference span {a}-{b} has no voiced audio")
        c = np.mean(es, axis=0); return c / np.linalg.norm(c)
    A_m = [(f"{a:g}-{b:g}", anchor(a, b)) for a, b in ref_m]
    A_f = [(f"{a:g}-{b:g}", anchor(a, b)) for a, b in ref_f]
    def score(a, b, min_s=0.5):
        w = voiced(a, b); act = len(w) / SR
        if act < min_s: return None, act
        e = emb(w)
        mname, M = max(((n, float(e @ c)) for n, c in A_m), key=lambda x: x[1])
        F = max(float(e @ c) for _, c in A_f)
        return {"F": F, "M": M, "margin": F - M, "anchor": mname}, act
    is_f = lambda sc: sc is not None and sc["margin"] >= F_MARGIN and sc["F"] >= F_MIN
    print("anchor similarity (male spans vs female):",
          ", ".join(f"{n}↔F {max(float(c @ fc) for _, fc in A_f):.2f}" for n, c in A_m))
    rows = []
    for li, l in enumerate(L):
        a, b = line_span(l)
        sc, act = score(a, b)
        f0 = med(f0_of(a, b))
        r = {"i": li, "s": l["s"], "e": l["e"], "t": l["t"], "section": l.get("section", ""), "f0": f0, "active": act,
             "F": sc and sc["F"], "M": sc and sc["M"], "margin": sc and sc["margin"], "anchor": sc and sc["anchor"],
             "low": [], "notes": [], "halves": []}
        if sc is None:
            r["voice"] = "?"; r["low"].append(f"only {act:.1f}s voiced")
        else:
            v = "f" if is_f(sc) else "m"
            ws = l.get("w") or []
            if len(ws) >= 4:                      # halves → duets
                h = ws[len(ws) // 2]
                if h - a >= 0.8 and b - h >= 0.8:
                    hs = [score(a, h)[0], score(h, b)[0]]
                    r["halves"] = [None if x is None else round(x["margin"], 2) for x in hs]
                    flags = [is_f(x) for x in hs if x is not None]
                    if len(flags) == 2 and flags[0] != flags[1]:
                        sure_m = [x for x in hs if x is not None and not is_f(x) and x["margin"] <= -0.05]
                        if sure_m: v = "duet"
            if v == "m":                          # female backing / ad-libs under a male lead
                t, hits = a, []
                while t < b - 0.5:
                    x, _ = score(t, min(b, t + 1.0), 0.4)
                    if is_f(x): hits.append(round(t, 1))
                    t += 0.5
                if hits: r["notes"].append(f"female backing? at {', '.join(map(str, hits[:4]))}s")
            if abs(sc["margin"]) < 0.10:          # close call → pitch may break the tie
                r["low"].append(f"close margin {sc['margin']:+.2f}")
                if not math.isnan(f0) and f0 > 350 and sc["F"] >= 0.35: v = "f"; r["notes"].append(f"pitch tie-break → f ({f0:.0f} Hz)")
                elif not math.isnan(f0) and f0 < 200: r["notes"].append(f"pitch agrees m ({f0:.0f} Hz)")
            if v in ("f", "duet") and sc["F"] < 0.6: r["low"].append(f"weak female match F={sc['F']:.2f}")
            if sc["M"] < 0.25 and sc["F"] < F_MIN: r["low"].append(f"weak match to every anchor (M={sc['M']:.2f})")
            if act < 1.0: r["low"].append(f"only {act:.1f}s voiced")
            if v == "m" and not math.isnan(f0) and f0 >= 300: r["low"].append(f"high for a male voice (f0 {f0:.0f} Hz)")
            r["voice"] = v
        if l.get("voice") in keep:
            r["voice"] = l["voice"]; r["low"] = []
        rows.append(r)
    return rows

rows = cast_embed() if method == "embed" else cast_pitch()
fmt = lambda v: "  —  " if v is None else f"{v:+.2f}"
fm2 = lambda v: "  —  " if v is None else f"{v:.2f}"
print(f"\n{'time':>7}  {'voice':>5}  {'F':>5} {'M':>5} {'margin':>6}  {'f0':>4}  line")
for r in rows:
    f0 = "  — " if math.isnan(r["f0"]) else f"{r['f0']:4.0f}"
    flag = " !" if r["low"] else "  "
    note = ("   ← " + "; ".join(r["notes"])) if r["notes"] else ""
    print(f"{r['s']:7.2f}{flag}{r['voice']:>5}  {fm2(r['F'])} {fm2(r['M'])} {fmt(r['margin']):>6}  {f0}  [{r['section']}] {r['t'][:56]}{note}")
lows = [r for r in rows if r["low"]]
if lows:
    print("\nLOW CONFIDENCE — check these by ear:")
    for r in lows: print(f"  {r['s']:7.2f}  {r['voice']:>4}  {'; '.join(r['low'])}  — {r['t'][:56]}")
from collections import Counter
print("\ncounts:", dict(Counter(r["voice"] for r in rows)))
out = {"method": method, "male_refs": [f"{a:g}-{b:g}" for a, b in ref_m], "female_refs": [f"{a:g}-{b:g}" for a, b in ref_f],
       "f_margin": F_MARGIN, "f_min": F_MIN,
       "lines": [{k: (None if isinstance(r.get(k), float) and math.isnan(r[k]) else r.get(k))
                  for k in ("s", "e", "t", "section", "voice", "F", "M", "margin", "anchor", "f0", "active", "halves", "low", "notes")} for r in rows]}
json.dump(out, open("analysis/voices.json", "w", encoding="utf-8"), indent=1, ensure_ascii=False)
if "--write" in args:
    for r in rows:
        L[r["i"]]["voice"] = r["voice"]
        L[r["i"]]["f0"] = None if math.isnan(r["f0"]) else round(r["f0"], 1)
        if r.get("margin") is not None: L[r["i"]]["voice_margin"] = round(r["margin"], 3)
    json.dump(L, open(lines_path, "w", encoding="utf-8"), indent=1, ensure_ascii=False)
    print(f"wrote voice + f0 into {lines_path} — re-run build_song.py")
print("wrote analysis/voices.json")
