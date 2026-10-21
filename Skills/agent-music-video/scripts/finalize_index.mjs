// Post-process the index.html written by music-to-video's assemble-index.mjs.
// Usage (from project root): node finalize_index.mjs [--no-captions] [--volume 1]
//  - swaps CDN gsap for the vendored copy (offline, deterministic renders)
//  - loads the kit (kit.css, theme.css, song.js, glyphs.js, kit.js, theme.js) before any frame mounts
//  - mounts compositions/captions.html above the frames (z-index 50) for the whole duration
//  - loads assets/props.js (optional, project-specific shared props built on the kit, e.g. a car rig) after theme.js
//  - sets the BGM volume (default 1; final audio is replaced by the mastered track at mux time anyway)
// Re-run it every time you re-run assemble-index.mjs.
import { readFileSync, writeFileSync, existsSync } from "node:fs";

const argv = process.argv.slice(2);
const vi = argv.indexOf("--volume");
const vol = vi >= 0 ? argv[vi + 1] : "1";
let html = readFileSync("index.html", "utf8");
const dur = (html.match(/id="root"[^>]*data-duration="([\d.]+)"/) || html.match(/data-duration="([\d.]+)"/))[1];

const head = [
  `<script src="assets/vendor/gsap.min.js"></script>`,
  `    <link rel="stylesheet" href="assets/kit/kit.css" />`,
  existsSync("assets/theme.css") ? `    <link rel="stylesheet" href="assets/theme.css" />` : "",
  `    <script src="assets/kit/song.js"></script>`,
  `    <script src="assets/kit/glyphs.js"></script>`,
  `    <script src="assets/kit/kit.js"></script>`,
  existsSync("assets/theme.js") ? `    <script src="assets/theme.js"></script>` : "",
].filter(Boolean).join("\n");
if (!html.includes("assets/kit/kit.js")) html = html.replace(/<script src="https:\/\/cdn\.jsdelivr\.net\/npm\/gsap[^>]*><\/script>/, head);
if (existsSync("assets/props.js") && !html.includes("assets/props.js"))
  html = html.replace(/(<script src="assets\/(?:theme|kit\/kit)\.js"><\/script>)(?![\s\S]*<script src="assets\/theme\.js">)/, `$1
    <script src="assets/props.js"></script>`);

if (!argv.includes("--no-captions") && !html.includes('data-composition-id="captions"')) {
  html = html.replace(/(\s*<!-- BGM -->)/, `\n      <div id="el-captions" class="frame" data-composition-id="captions" data-composition-src="compositions/captions.html"` +
    ` data-start="0" data-duration="${dur}" data-track-index="5" data-track-kind="captions"></div>\n$1`);
  html = html.replace("background: #000; }", "background: #000; }\n      #el-captions { z-index: 50; }");
}
html = html.replace(/(<audio id="el-bgm"[^>]*data-volume=")[\d.]+/, `$1${vol}`);
writeFileSync("index.html", html);
console.log("index.html finalized:", html.includes("assets/kit/kit.js") ? "kit ✓" : "KIT MISSING", html.includes('"captions"') ? "captions ✓" : "no captions", `duration ${dur}s`);
