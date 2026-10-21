// Regenerate assets/kit/glyphs.js (window.KIT_GLYPHS) for kit3d.text3d() from any TTF/OTF.
// Usage: node glyphs.mjs <font.ttf> <out glyphs.js> [chars]
// Needs opentype.js (npm i opentype.js@1.3.4 in a scratch dir; run from there).
// IMPORTANT: use a STATIC font with overlaps removed (e.g. the official release TTFs). Instances cut from
// variable fonts (Google Fonts' static TTF endpoints) keep overlapping contours — "A", "4", "R" come out
// self-intersecting and triangulate into broken 3D letters. The bundled assets/fonts/InterDisplay-Black.ttf is clean.
import fs from "node:fs";
import { createRequire } from "node:module";
const opentype = createRequire(process.cwd() + "/")("opentype.js"); // install in a scratch dir, run from there
const [fontPath, out, charsArg] = process.argv.slice(2);
const font = opentype.loadSync(fontPath);
const chars = charsArg || "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789.,'!?$%-+:#&*/";
const G = { unitsPerEm: font.unitsPerEm, ascender: font.ascender, descender: font.descender,
  capHeight: (font.tables.os2 && font.tables.os2.sCapHeight) || Math.round(font.unitsPerEm * 0.72), glyphs: {} };
const r = (n) => Math.round(n * 10) / 10;
for (const ch of chars) {
  const g = font.charToGlyph(ch), p = g.getPath(0, 0, font.unitsPerEm);
  G.glyphs[ch] = { adv: g.advanceWidth, cmds: p.commands.map((c) => { const o = { t: c.type }; for (const k of ["x", "y", "x1", "y1", "x2", "y2"]) if (k in c) o[k] = r(c[k]); return o; }) };
}
G.glyphs[" "] = { adv: font.charToGlyph(" ").advanceWidth, cmds: [] };
fs.writeFileSync(out, "window.KIT_GLYPHS = " + JSON.stringify(G) + ";\n");
console.log("glyphs", Object.keys(G.glyphs).length, "upm", G.unitsPerEm, "cap", G.capHeight, "→", out);
