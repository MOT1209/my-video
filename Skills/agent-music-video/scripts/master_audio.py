"""Master a song for YouTube: ~-14 LUFS integrated, true peak <= -1 dBTP *after AAC encoding*,
sample-aligned with the source (limiter latency compensated). Verifies everything it claims.

Usage: python master_audio.py <in_audio> <out.wav> [--lufs -14] [--tp -1.0]
Prints: integrated loudness + true peak of the WAV and of a 320k AAC test encode, and the
cross-correlation lag vs the source (must be 0 samples).

Why: AI music generators often deliver ~-16 LUFS with peaks above 0 dBFS. YouTube normalises
DOWN to -14 but never up, so a quiet master plays quieter than every other video; and AAC
re-encoding adds ~0.3–0.6 dB of overshoot, so peaks must be limited below the target.
"""
import json, re, subprocess, sys
import numpy as np
sys.stdout.reconfigure(encoding="utf-8", errors="replace")
args = sys.argv[1:]
def opt(name, d):
    if name in args:
        i = args.index(name); v = float(args[i + 1]); del args[i:i + 2]; return v
    return d
target, tp = opt("--lufs", -14.0), opt("--tp", -1.0)
src, out = args[0], args[1]

def measure(path):
    r = subprocess.run(["ffmpeg", "-hide_banner", "-i", path, "-af", "ebur128=peak=true", "-f", "null", "-"], capture_output=True, text=True)
    I = float(re.findall(r"I:\s+(-?[\d.]+) LUFS", r.stderr)[-1]); P = float(re.findall(r"Peak:\s+(-?[\d.]+) dBFS", r.stderr)[-1])
    return I, P

def master(gain_db, limit_lin):
    af = (f"aresample=192000:filter_size=64:cutoff=0.97,volume={gain_db:.2f}dB,"
          f"alimiter=limit={limit_lin:.4f}:attack=0.4:release=60:level=disabled:latency=1,"
          f"aresample=48000:filter_size=64:cutoff=0.97")
    subprocess.run(["ffmpeg", "-v", "error", "-y", "-i", src, "-af", af, "-c:a", "pcm_s24le", out], check=True)
    subprocess.run(["ffmpeg", "-v", "error", "-y", "-i", out, "-c:a", "aac", "-b:a", "320k", "-ar", "48000", out + ".test.m4a"], check=True)
    return measure(out), measure(out + ".test.m4a")

I0, P0 = measure(src)
print(f"source: {I0:.1f} LUFS, true peak {P0:.1f} dBTP")
gain, limit_db = target - I0 + 0.3, tp - 0.6          # first guess: AAC adds ~0.5 dB
for it in range(4):
    (Iw, Pw), (Ia, Pa) = master(gain, 10 ** (limit_db / 20))
    print(f"pass {it + 1}: gain {gain:+.2f} dB, limit {limit_db:.2f} dBFS → wav {Iw:.1f} LUFS/{Pw:.1f} dBTP | AAC {Ia:.1f} LUFS/{Pa:.1f} dBTP")
    if Pa <= tp + 0.05 and abs(Ia - target) <= 0.3:
        break
    if Pa > tp + 0.05: limit_db -= (Pa - tp) + 0.1
    gain += target - Ia

# alignment check (first 30 s)
def pcm(path):
    raw = subprocess.run(["ffmpeg", "-v", "error", "-i", path, "-t", "30", "-f", "f32le", "-ac", "1", "-ar", "48000", "-"], capture_output=True).stdout
    return np.frombuffer(raw, dtype=np.float32)
a, b = pcm(out), pcm(src)
n = 1 << int(np.ceil(np.log2(len(a) + len(b))))
cc = np.fft.irfft(np.fft.rfft(a, n) * np.conj(np.fft.rfft(b, n)), n)
lag = int(np.argmax(cc)); lag = lag if lag < n // 2 else lag - n
print(f"alignment vs source: {lag} samples ({lag / 48:.2f} ms) {'✓' if lag == 0 else '✗ — check limiter latency'}")
import os; os.remove(out + ".test.m4a")
print(json.dumps({"out": out, "lufs_aac": Ia, "true_peak_aac": Pa, "lag_samples": lag}))
