# Bundled fonts — all royalty-free (SIL Open Font License 1.1)

| File | Family | Source | Licence |
|---|---|---|---|
| `Inter-latin.woff2` | Inter (variable, 100–900) — display + body | Google Fonts / rsms/inter | OFL 1.1 (`OFL-Inter.txt`) |
| `InterDisplay-Black.ttf` | Inter Display Black (static, overlaps removed) — used to generate `glyphs.js` for 3D lettering | rsms/inter release 4.1 | OFL 1.1 (`OFL-Inter.txt`) |
| `SpaceGrotesk-latin.woff2` | Space Grotesk (variable, 300–700) — labels / pills | Google Fonts | OFL 1.1 (`OFL-SpaceGrotesk.txt`) |
| `JetBrainsMono-latin.woff2` | JetBrains Mono (variable) — code / terminals / URLs | Google Fonts | OFL 1.1 (`OFL-JetBrainsMono.txt`) |

OFL fonts may be used free of charge in videos, thumbnails and commercial work, embedded in projects,
and redistributed (keep the licence text alongside). You may not sell the font files on their own.

## Choosing other fonts for a new look
Only use fonts whose licence clearly allows commercial use and embedding at no cost:
- **OK:** SIL OFL 1.1, Apache 2.0, MIT, Ubuntu Font Licence, CC0 / public domain. Almost every family on
  Google Fonts qualifies — check the family's licence on its Google Fonts page (or `ofl/`, `apache/`, `ufl/`
  folders in github.com/google/fonts) and save its licence file next to the font in `assets/fonts/`.
- **Not OK:** fonts that are "free for personal use", system fonts copied from an OS (Helvetica, SF Pro,
  Segoe), Adobe Fonts / Monotype / commercial foundry fonts, anything with an unclear licence, and
  brand fonts of the companies you're covering.
- Download: `curl -A "<modern browser UA>" "https://fonts.googleapis.com/css2?family=<Family>:wght@400;700;900"`
  returns woff2 URLs (take the `latin` subset). For **3D glyphs** you need a STATIC TTF/OTF with overlaps
  removed — prefer the family's official GitHub release over Google's on-the-fly static instances.
- Record every font + licence in this file (or the project's `assets/fonts/FONTS.md`).
