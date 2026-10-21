"""Render caption-free, full-resolution stills of chosen moments and export YouTube thumbnails.

Usage (from the project root):
  python clean_stills.py <out_dir> <spec> [<spec> …] [--css "<temporary CSS for these stills>"]
  spec = "<track_time>[:<name>][@x,y,w,h]"   e.g.  55.45:shh@80,30,1720,967   15.35:title   112.95:oh-no
Writes <out_dir>/thumbnail-<n>_<name>.jpg (1280x720, JPEG q92, < 2 MB) and keeps the full PNGs in analysis/thumb-stills/.

How: temporarily adds `data-hidden` to the captions overlay in index.html (karaoke bars don't belong on a
thumbnail), renders the exact frames with the project's pinned `npx hyperframes@X.Y.Z snapshot` (from package.json), then ALWAYS restores index.html.
Crop boxes are in 1920x1080 pixels; keep them 16:9 (w/h ≈ 1.778) — use them to drop edge clutter and push in on faces.
"""
import os, re, shutil, subprocess, sys
from PIL import Image
sys.stdout.reconfigure(encoding="utf-8", errors="replace")
args = sys.argv[1:]
# --css "<rules>": temporary CSS for these stills only (e.g. force a frame's ground colour so a same-coloured mascot reads on
# the thumbnail: '#t-root { background-color: #f7cb46 !important; }'; !important beats GSAP's inline styles). Root-level CSS
# does not reach a sub-composition's own elements, so the rules are appended to the first <style> of every frame file under
# compositions/ and ALL files are restored byte-for-byte afterwards (the video and frames are never changed).
extra_css = None
if "--css" in args:
    i = args.index("--css"); extra_css = args[i + 1]; del args[i:i + 2]
out_dir, specs = args[0], args[1:]
items = []
for s in specs:
    m = re.match(r"^([\d.]+)(?::([\w-]+))?(?:@(\d+),(\d+),(\d+),(\d+))?$", s)
    if not m:
        sys.exit(f"bad spec: {s}")
    t, name = float(m.group(1)), m.group(2) or f"t{m.group(1).replace('.', '_')}"
    crop = tuple(int(m.group(i)) for i in range(3, 7)) if m.group(3) else None
    items.append((t, name, crop))
stills = os.path.join("analysis", "thumb-stills"); os.makedirs(stills, exist_ok=True)   # full PNGs stay out of renders/final
idx = open("index.html", encoding="utf-8").read()
backup = idx
frame_backups = {}
try:
    tmp = idx.replace('id="el-captions"', 'id="el-captions" data-hidden', 1)
    open("index.html", "w", encoding="utf-8").write(tmp)
    if extra_css:
        for dp, _, fns in os.walk("compositions"):
            for fn in fns:
                fp = os.path.join(dp, fn)
                if fn.endswith(".html"):
                    raw = open(fp, "rb").read(); txt = raw.decode("utf-8", "replace")
                    if "</style>" in txt:
                        frame_backups[fp] = raw
                        open(fp, "w", encoding="utf-8", newline="").write(txt.replace("</style>", "\n" + extra_css + "\n</style>", 1))
    times = ",".join(f"{t:g}" for t, _, _ in items)
    shell = os.name == "nt"
    # use the project's pinned CLI (package.json scripts pin "hyperframes@X.Y.Z"); a bare `npx hyperframes` can resolve
    # to a newer, broken or unpublished version. Override with HF_CLI="hyperframes@X.Y.Z".
    pin = os.environ.get("HF_CLI")
    if not pin and os.path.exists("package.json"):
        m = re.search(r"hyperframes@\d+\.\d+\.\d+", open("package.json", encoding="utf-8").read())
        pin = m.group(0) if m else None
    subprocess.run(["npx", "--yes", pin or "hyperframes", "snapshot", ".", "--at", times, "--no-end", "--describe", "false", "-o", stills], check=True, shell=shell)
finally:
    open("index.html", "w", encoding="utf-8").write(backup)
    for fp, raw in frame_backups.items(): open(fp, "wb").write(raw)
# match each requested time to ITS still by timestamp (snapshot names files frame-NN-at-<t>s.png in time order,
# which is not necessarily the order the specs were given in)
shot = {float(re.search(r"at-([\d.]+)s", f).group(1)): f for f in os.listdir(stills) if f.endswith(".png") and "at-" in f}
for n, (t, name, crop) in enumerate(items, 1):
    png = shot[min(shot, key=lambda k: abs(k - t))]
    im = Image.open(os.path.join(stills, png)).convert("RGB")
    if crop:
        x, y, w, h = crop; im = im.crop((x, y, x + w, y + h))
    out = os.path.join(out_dir, f"thumbnail-{n}_{name}.jpg")
    im.resize((1280, 720), Image.LANCZOS).save(out, quality=92)
    print(f"{t:8.2f}s → {out}  ({os.path.getsize(out) // 1024} KB)")
print("index.html restored (captions visible again).")
