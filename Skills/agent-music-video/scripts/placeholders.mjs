// Write one placeholder sub-composition per STORYBOARD frame that doesn't exist yet, so the project always
// assembles and renders while frames are being built. Each placeholder = a coloured ground, the frame id, the owner
// and the frame's lyric lines (from song.js), plus an empty registered timeline. Never overwrites an existing file.
//
// Usage (from the project root): node <skill>/scripts/placeholders.mjs [--storyboard STORYBOARD.md] [--song assets/kit/song.js]
import fs from "node:fs";
import path from "node:path";

const argv = process.argv.slice(2);
const flag = (n, d) => { const i = argv.indexOf(`--${n}`); return i >= 0 ? argv[i + 1] : d; };
const sb = fs.readFileSync(flag("storyboard", "STORYBOARD.md"), "utf8");
const songPath = flag("song", "assets/kit/song.js");
const S = fs.existsSync(songPath) ? JSON.parse(fs.readFileSync(songPath, "utf8").replace(/^window\.SONG = /, "").replace(/;\s*$/, "")) : { lines: [] };
const COLORS = ["#FE90E8", "#C0F7FE", "#99E885", "#F7CB46", "#FFDC8B", "#FFFDF5"];
const esc = (s) => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

const blocks = sb.split(/^## Frame /m).slice(1);
let made = 0;
blocks.forEach((b, i) => {
  const id = (b.match(/^\d+\s*[—-]\s*(\S+)/) || [])[1];
  const src = (b.match(/- src:\s*(\S+)/) || [])[1];
  const span = (b.match(/- span_sec:\s*\[([\d.]+),\s*([\d.]+)\]/) || []).slice(1).map(Number);
  const dur = Number((b.match(/- duration:\s*([\d.]+)/) || [])[1]);
  const owner = ((b.match(/- owner:\s*(.+)/) || [])[1] || "").trim();
  if (!id || !src) return;
  if (fs.existsSync(src)) { console.log("keep", src); return; }
  const [t0, t1] = span.length === 2 ? span : [0, dur];
  const lines = S.lines.filter((l) => l.s < t1 && l.e > t0);
  const p = id.split("-")[0];
  const html = `<!doctype html>
<html>
<head><meta charset="UTF-8" /></head>
<body>
<template>
<style>
  #ph${p}-root { position: absolute; inset: 0; overflow: hidden; background: ${COLORS[i % COLORS.length]}; }
  #ph${p}-id { position: absolute; left: 80px; top: 70px; }
  #ph${p}-lines { position: absolute; left: 80px; top: 260px; right: 80px; display: flex; flex-direction: column; gap: 14px; }
  .ph${p}-l { font: 700 34px/1.2 "Space Grotesk", sans-serif; }
  .ph${p}-l b { font-family: "JetBrains Mono", monospace; font-weight: 700; margin-right: 18px; opacity: .55; }
</style>
<div id="ph${p}-root" data-composition-id="${id}" data-width="1920" data-height="1080" data-duration="${dur}">
  <div class="k-dots"></div>
  <div id="ph${p}-id"><span class="k-pill lg">${esc(id)} · placeholder${owner ? " · " + esc(owner) : ""}</span></div>
  <div id="ph${p}-lines">${lines.map((l) => `<div class="ph${p}-l"><b>${l.s.toFixed(2)}</b>${esc(l.t)}</div>`).join("")}</div>
</div>
<script>
(function () {
  const tl = gsap.timeline({ paused: true });
  tl.to({}, { duration: ${dur} }, 0);
  window.__timelines["${id}"] = tl;
})();
</script>
</template>
</body>
</html>
`;
  fs.mkdirSync(path.dirname(src), { recursive: true });
  fs.writeFileSync(src, html);
  made++;
  console.log("placeholder", src);
});
console.log(`${made} placeholder(s) written`);
