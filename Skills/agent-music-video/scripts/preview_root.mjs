// Write a temporary root composition that plays only the start of the song (track time 0 → --until), for quick
// early preview clips. Keeps the frames that start before --until, the captions overlay and the BGM, clipped.
// Usage (project root): node <skill>/scripts/preview_root.mjs --until 23.266 [--out preview.html]
//   npx hyperframes render . -c preview.html -o renders/preview.mp4 --fps 30 -w 16
// DELETE preview.html afterwards (two root compositions = lint error).
import fs from "node:fs";
const argv = process.argv.slice(2);
const flag = (n, d) => { const i = argv.indexOf(`--${n}`); return i >= 0 ? argv[i + 1] : d; };
const until = Number(flag("until"));
const out = flag("out", "preview.html");
if (!until) { console.error("need --until <seconds>"); process.exit(1); }
let html = fs.readFileSync("index.html", "utf8");
html = html.replace(/<div[^>]*class="frame"[^>]*><\/div>\s*/g, (tag) => {
  const id = (tag.match(/data-composition-id="([^"]+)"/) || [])[1];
  const st = Number((tag.match(/data-start="([\d.]+)"/) || [])[1]);
  const du = Number((tag.match(/data-duration="([\d.]+)"/) || [])[1]);
  if (id === "captions") return tag.replace(/data-duration="[\d.]+"/, `data-duration="${until}"`);
  if (st >= until - 1e-6) return "";
  return st + du > until ? tag.replace(/data-duration="[\d.]+"/, `data-duration="${(until - st).toFixed(3)}"`) : tag;
});
html = html.replace(/(<audio[^>]*data-duration=")[\d.]+/, `$1${until}`);
html = html.replace(/(id="root"[^>]*data-duration=")[\d.]+/, `$1${until}`);
fs.writeFileSync(out, html);
console.log(`${out}: 0 → ${until}s`);
