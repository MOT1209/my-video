// Install the agent-music-video kit into a HyperFrames project (after `npx hyperframes init`).
// Usage: node setup_project.mjs <project_dir> [--duration <sec>]   (duration defaults to audiomap.json)
// Copies: assets/kit/* (kit.css, kit.js, kit3d.js, glyphs.js), assets/fonts/*, assets/vendor/{gsap,three},
//         compositions/captions.html (karaoke overlay, duration filled in), and an empty assets/theme.css + theme.js.
// Safe to re-run: it overwrites kit files but never touches your frames, storyboard or theme files.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const SKILL = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const argv = process.argv.slice(2);
const proj = path.resolve(argv[0] || ".");
const di = argv.indexOf("--duration");
let dur = di >= 0 ? Number(argv[di + 1]) : null;
if (!dur && fs.existsSync(path.join(proj, "audiomap.json"))) dur = JSON.parse(fs.readFileSync(path.join(proj, "audiomap.json"), "utf8")).audio.duration_sec;
if (!dur) { console.error("✗ need --duration or audiomap.json in the project"); process.exit(1); }

const copyDir = (src, dst, filter = () => true) => {
  fs.mkdirSync(dst, { recursive: true });
  for (const f of fs.readdirSync(src)) if (filter(f)) fs.copyFileSync(path.join(src, f), path.join(dst, f));
};
copyDir(path.join(SKILL, "assets/kit"), path.join(proj, "assets/kit"));
copyDir(path.join(SKILL, "assets/fonts"), path.join(proj, "assets/fonts"), (f) => /\.(woff2|txt|md)$/.test(f)); // fonts + OFL licences
copyDir(path.join(SKILL, "assets/vendor"), path.join(proj, "assets/vendor"));
fs.mkdirSync(path.join(proj, "compositions/frames"), { recursive: true });
const cap = fs.readFileSync(path.join(SKILL, "assets/templates/captions.html"), "utf8").replaceAll("__DURATION__", String(dur));
fs.writeFileSync(path.join(proj, "compositions/captions.html"), cap);
const themeCss = path.join(proj, "assets/theme.css"), themeJs = path.join(proj, "assets/theme.js");
if (!fs.existsSync(themeCss)) fs.writeFileSync(themeCss, `/* Project theme: override kit tokens here (loaded after kit.css).\n:root { --k-ink:#000; --k-paper:#fff; --k-pink:#fe90e8; --k-font-display:"Inter", sans-serif; }\nAdd @font-face rules for any new font files you drop into assets/fonts. */\n`);
if (!fs.existsSync(themeJs)) fs.writeFileSync(themeJs, `// Project theme for SVG builders (loaded after kit.js). Mirror theme.css values.\n// KIT.theme({ ink: "#000", paper: "#fff", font: "Inter", pink: "#fe90e8" });\n`);
for (const d of ["analysis", "renders", "assets/shots", "assets/logos"]) fs.mkdirSync(path.join(proj, d), { recursive: true });
console.log(`kit installed in ${proj} (captions duration ${dur}s). Next: build song.js, write STORYBOARD.md, placeholders, assemble, finalize_index.`);
