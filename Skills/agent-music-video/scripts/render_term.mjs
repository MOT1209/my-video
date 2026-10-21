// Replay recorded terminal streams (.ansi) in xterm.js inside headless Chrome and screenshot the screen.
// Usage (run from the tools dir): node render_term.mjs <dir with .ansi> <cols> <rows> [--font path.woff2] [--chrome exe] [--scale 2]
import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";
const require = createRequire(process.cwd() + "/");
const puppeteer = require("puppeteer-core");
const argv = process.argv.slice(2);
const flag = (n, d) => { const i = argv.indexOf(`--${n}`); return i >= 0 ? argv[i + 1] : d; };
const [dir, cols, rows] = argv;
const font = flag("font");
const exe = flag("chrome");
const scale = Number(flag("scale", 2));
const xtermJs = fs.readFileSync(path.resolve("node_modules/@xterm/xterm/lib/xterm.js"), "utf8");
const xtermCss = fs.readFileSync(path.resolve("node_modules/@xterm/xterm/css/xterm.css"), "utf8");
const fontCss = font ? `@font-face{font-family:"JBM";src:url(data:font/woff2;base64,${fs.readFileSync(font).toString("base64")}) format("woff2");font-weight:100 800}` : "";
const html = `<!doctype html><html><head><meta charset="utf-8"><style>${xtermCss}${fontCss}
 html,body{margin:0;background:#15151a} #t{display:inline-block;padding:18px 22px;background:#15151a}</style></head>
 <body><div id="t"></div><script>${xtermJs}</script></body></html>`;
const browser = await puppeteer.launch({ executablePath: exe, headless: true, args: ["--no-sandbox"] });
const page = await browser.newPage();
await page.setViewport({ width: 2400, height: 1600, deviceScaleFactor: scale });
await page.setContent(html, { waitUntil: "load" });
await page.evaluate(() => document.fonts.ready);
for (const f of fs.readdirSync(dir).filter((x) => x.endsWith(".ansi"))) {
  const data = fs.readFileSync(path.join(dir, f), "utf8");
  await page.evaluate(async (data, cols, rows) => {
    document.getElementById("t").innerHTML = "";
    const term = new Terminal({ cols: +cols, rows: +rows, fontFamily: "JBM, monospace", fontSize: 18, lineHeight: 1.18, allowProposedApi: true,
      theme: { background: "#15151a", foreground: "#e6e6ee", cursor: "#e6e6ee" }, scrollback: 0 });
    term.open(document.getElementById("t"));
    await new Promise((r) => term.write(data, r));
    await new Promise((r) => setTimeout(r, 300));
    window.__term = term;
  }, data, cols, rows);
  const rowsTxt = await page.evaluate(() => { const b = window.__term.buffer.active, out = []; for (let i = 0; i < window.__term.rows; i++) { const l = b.getLine(b.viewportY + i); out.push(String(i).padStart(2) + " | " + (l ? l.translateToString(true) : "")); } return out.join(String.fromCharCode(10)); });
  fs.writeFileSync(path.join(dir, f.replace(/\.ansi$/, ".txt")), rowsTxt);
  const el = await page.$("#t");
  const out = path.join(dir, f.replace(/\.ansi$/, ".png"));
  await el.screenshot({ path: out });
  console.log("wrote", out);
}
await browser.close();
