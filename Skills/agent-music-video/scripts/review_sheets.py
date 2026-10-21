"""Labelled review contact sheets from a rendered MP4 (for you and the critic).
Each tile = one frame, labelled with track time, section and the lyric being sung then.

Usage (from project root): python review_sheets.py <video.mp4> <out_dir> [step=0.5] [--song assets/kit/song.js]
One decode pass from t=0 with fps=1/step (round=near): tile k is the frame at k*step.
(Seeking with -ss before an fps filter shifts every label by up to one step — don't.)
"""
import json, os, shutil, subprocess, sys
from PIL import Image, ImageDraw, ImageFont
sys.stdout.reconfigure(encoding="utf-8", errors="replace")
args = sys.argv[1:]
song_path = "assets/kit/song.js"
if "--song" in args:
    i = args.index("--song"); song_path = args[i + 1]; del args[i:i + 2]
video, out_dir = args[0], args[1]
step = float(args[2]) if len(args) > 2 else 0.5
os.makedirs(out_dir, exist_ok=True)
S = json.loads(open(song_path, encoding="utf-8").read().replace("window.SONG = ", "").rstrip().rstrip(";"))
dur = S["duration"]
lyric_at = lambda t: next((l["t"] for l in S["lines"] if l["s"] - 0.05 <= t <= l["e"] + 0.15), "")
section_at = lambda t: next((s["id"] for s in S["sections"] if s["s"] <= t < s["e"]), S["sections"][-1]["id"])
TW, TH, COLS, ROWS = 640, 360, 4, 4
try:
    font, fontb = ImageFont.truetype("arial.ttf", 17), ImageFont.truetype("arialbd.ttf", 19)
except Exception:
    font = fontb = ImageFont.load_default()
fdir = os.path.join(out_dir, "_frames"); os.makedirs(fdir, exist_ok=True)
subprocess.run(["ffmpeg", "-v", "error", "-y", "-i", video, "-vf", f"fps=1/{step}:round=near,scale={TW}:{TH}", "-q:v", "3", os.path.join(fdir, "%05d.jpg")], check=True)
tiles, t, i = [], 0.0, 1
while t < dur and os.path.exists(os.path.join(fdir, f"{i:05d}.jpg")):
    tiles.append((round(t, 2), Image.open(os.path.join(fdir, f"{i:05d}.jpg")).convert("RGB"))); t += step; i += 1
per = COLS * ROWS
for si in range(0, len(tiles), per):
    chunk = tiles[si:si + per]
    sheet = Image.new("RGB", (COLS * TW, ROWS * (TH + 46)), (24, 24, 24)); d = ImageDraw.Draw(sheet)
    for k, (tt, im) in enumerate(chunk):
        x, y = (k % COLS) * TW, (k // COLS) * (TH + 46)
        sheet.paste(im, (x, y + 46))
        d.text((x + 6, y + 3), f"{tt:6.2f}s  [{section_at(tt)}]", fill=(255, 220, 90), font=fontb)
        d.text((x + 6, y + 25), lyric_at(tt)[:70], fill=(230, 230, 230), font=font)
    name = os.path.join(out_dir, f"sheet_{si // per:02d}_{chunk[0][0]:06.2f}-{chunk[-1][0]:06.2f}.jpg")
    sheet.save(name, quality=82); print(name)
shutil.rmtree(fdir, ignore_errors=True)
