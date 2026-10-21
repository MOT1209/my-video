"""Sticker-style YouTube thumbnail: a frame from the video + bold outlined headline lines.

Usage: python thumbnail.py <video.mp4> <time_s> <out.jpg> "LINE ONE|#ffffff|190|2" "LINE TWO|#f7cb46|120|-2" [--cx 1060] [--y 20] [--font path.ttf]
Each line spec = "text|fill|size_px_at_1080p|rotation_deg". Lines stack from --y downward, centred on --cx.
Pick a frame where the characters are big and the place you put text is calm (sky/ground), not a busy cut.
Output is 1280x720 JPEG. Check it at small size too — it must read at phone-thumbnail scale.
"""
import os, subprocess, sys, tempfile
from PIL import Image, ImageDraw, ImageFont
args = sys.argv[1:]
def opt(n, d):
    if n in args:
        i = args.index(n); v = args[i + 1]; del args[i:i + 2]; return v
    return d
cx, y0 = int(opt("--cx", 960)), int(opt("--y", 30))
font = opt("--font", os.path.join(os.path.dirname(__file__), "..", "assets", "fonts", "InterDisplay-Black.ttf"))
video, t, out, specs = args[0], args[1], args[2], args[3:]
tmp = os.path.join(tempfile.gettempdir(), "thumb_frame.png")
subprocess.run(["ffmpeg", "-v", "error", "-y", "-ss", str(t), "-i", video, "-frames:v", "1", tmp], check=True)
im = Image.open(tmp).convert("RGB"); d = ImageDraw.Draw(im); y = y0
for spec in specs:
    text, fill, size, rot = (spec.split("|") + ["#fff", "120", "0"])[:4]
    size, rot = int(size), float(rot); stroke = max(6, size // 13); shadow = stroke
    f = ImageFont.truetype(font, size)
    l, t_, r, b = d.textbbox((0, 0), text, font=f, stroke_width=stroke)
    layer = Image.new("RGBA", (r - l + shadow + 60, b - t_ + shadow + 60), (0, 0, 0, 0)); ld = ImageDraw.Draw(layer)
    ld.text((30 - l + shadow, 30 - t_ + shadow), text, font=f, fill="black", stroke_width=stroke, stroke_fill="black")
    ld.text((30 - l, 30 - t_), text, font=f, fill=fill, stroke_width=stroke, stroke_fill="black")
    layer = layer.rotate(rot, expand=True, resample=Image.BICUBIC)
    im.paste(layer, (int(cx - layer.size[0] / 2), y), layer); y += int((b - t_) * 0.95)
im.resize((1280, 720), Image.LANCZOS).save(out, quality=92); print("→", out)
