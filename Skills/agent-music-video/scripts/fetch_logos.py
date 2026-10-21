"""Fetch monochrome brand logos (SVG) for logo chips.

Usage: python fetch_logos.py <out_dir> openai anthropic claude mistralai nvidia github googlegemini …
Tries Simple Icons first (<slug>.svg, monochrome, great for sticker chips), then LobeHub AI icons
(lobe-<slug>.svg; has AI brands Simple Icons lacks: grok, xai, midjourney, plus "-color" variants
like gemini-color, claude-color, mistral-color, nvidia-color). Prints what was found / missing.
SVGs that use fill="currentColor" render black in <img>; colour them via CSS filter or inline them.
Logos are for news commentary/identification; don't alter them into fake brand assets.
"""
import os, sys, urllib.request
sys.stdout.reconfigure(encoding="utf-8", errors="replace")
out, slugs = sys.argv[1], sys.argv[2:]
os.makedirs(out, exist_ok=True)
SRC = [("simple-icons", "https://cdn.jsdelivr.net/npm/simple-icons@latest/icons/{}.svg", "{}.svg"),
       ("lobehub", "https://cdn.jsdelivr.net/npm/@lobehub/icons-static-svg@latest/icons/{}.svg", "lobe-{}.svg")]
for slug in slugs:
    got = False
    for name, url, fname in SRC:
        try:
            with urllib.request.urlopen(url.format(slug), timeout=20) as r:
                data = r.read()
            if b"<svg" in data[:400]:
                open(os.path.join(out, fname.format(slug)), "wb").write(data)
                print(f"ok   {slug:<16} ← {name}"); got = True; break
        except Exception:
            pass
    if not got:
        print(f"MISS {slug} (try another slug, a '-color' variant, or Wikimedia Commons)")
