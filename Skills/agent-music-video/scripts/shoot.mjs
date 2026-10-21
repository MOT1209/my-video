// Capture "receipts": real web pages as screenshots + the pixel rects of the headline and key phrases
// (so a highlighter can sweep exactly over the sung words later).
//
// Usage: node shoot.mjs <out_dir> <shots.json> [--chrome <path>] [--width 1920]
// shots.json: [{ "name":"mistral-large-4", "url":"https://…", "marks":["Le chonk"], "selector":"h1", "offset":420,
//               "wait":2500, "css":"…extra css to hide overlays…", "click":"Continue to article", "h":1000 }, …]
//   optional: "scrollText":"exact phrase" (scroll so that phrase sits `offset` px below the top, instead of `selector`),
//             "dark":true (emulate prefers-color-scheme: dark — docs/GitHub pages then render their dark theme),
//             "eval":"<js expression>" (run in the page after load/click and BEFORE the CSS + scrolling, then wait
//               `evalWait` ms, default 800 — e.g. expand collapsed blocks so their text can be marked:
//               "document.querySelectorAll('details').forEach(d => d.open = true)"; never use it to change text),
//             "settle":4000 (max ms to wait for the layout to stop moving before measuring + capturing; the marks are
//               re-measured after the screenshot and the shot is retried if they moved)
// Writes <out_dir>/<name>.jpg (scaled to --width; rects are in THIS image's pixels), <out_dir>/<name>@2x.jpg (full 2x
// capture, used automatically for 4K renders), and merges rects into <out_dir>/rects.json:
//   { name: { url, title, rects: { h1:[[x,y,w,h]], "<phrase>":[[x,y,w,h],…] } } }   (jpg pixel coords)
//
// Needs: puppeteer-core (npm i puppeteer-core in a scratch dir, run from there), ffmpeg on PATH,
// and a Chrome — default is HyperFrames' headless shell: `npx hyperframes browser path`.
// Consent / cookie / newsletter overlays are HIDDEN with CSS — never click "accept".
// `click` is only for harmless interstitials ("Continue to article").
import fs from "node:fs";
import { createRequire } from "node:module";
// resolve puppeteer-core from the CURRENT directory (install it in a scratch dir and run from there)
const puppeteer = createRequire(process.cwd() + "/")("puppeteer-core");
import { execSync, spawnSync } from "node:child_process";

const argv = process.argv.slice(2);
const flag = (n, d) => { const i = argv.indexOf(`--${n}`); return i >= 0 ? argv[i + 1] : d; };
const [outDir, listFile] = argv;
const W = Number(flag("width", 1920));
let exe = flag("chrome");
if (!exe) exe = execSync("npx hyperframes browser path", { encoding: "utf8" }).trim().split(/\r?\n/).pop().trim();
const items = JSON.parse(fs.readFileSync(listFile, "utf8"));
fs.mkdirSync(outDir, { recursive: true });
const HIDE = `[id*="cookie" i],[class*="cookie" i],[id*="consent" i],[class*="consent" i],[id*="onetrust" i],[class*="onetrust" i],
[id*="didomi" i],[class*="didomi" i],[id*="gdpr" i],[class*="gdpr" i],[aria-label*="cookie" i],[id*="sp_message" i],
[class*="newsletter-modal" i],[class*="paywall" i],[id*="piano" i],[class*="tp-modal" i],[class*="tp-backdrop" i],
[class*="popup" i][class*="overlay" i],
[id*="axeptio" i],[class*="axeptio" i],#CybotCookiebotDialog,[id*="cookiebot" i],[id*="usercentrics" i],[class*="usercentrics" i],
[class*="qc-cmp" i],[id*="qc-cmp" i],[id*="truste" i],[class*="truste" i],[class*="osano" i],[id*="iubenda" i],[class*="iubenda" i],
[id*="termly" i],[class*="termly" i],[class*="klaro" i],[id*="cmp" i][class*="banner" i],[aria-modal="true"][role="dialog"]{display:none!important;visibility:hidden!important} html,body{overflow:auto!important}`;
const CSS_W = 1440, S = W / CSS_W; // jpg px per css px
const rectsPath = `${outDir}/rects.json`;
const all = fs.existsSync(rectsPath) ? JSON.parse(fs.readFileSync(rectsPath, "utf8")) : {};
const browser = await puppeteer.launch({ executablePath: exe, headless: true, args: ["--no-sandbox", "--hide-scrollbars"] });
for (const it of items) {
  const page = await browser.newPage();
  await page.setUserAgent("Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0 Safari/537.36");
  await page.setViewport({ width: CSS_W, height: it.h || 1000, deviceScaleFactor: 2 });
  if (it.dark) await page.emulateMediaFeatures([{ name: "prefers-color-scheme", value: "dark" }]);
  try { await page.goto(it.url, { waitUntil: "networkidle2", timeout: 60000 }); } catch (e) { console.log("WARN load", it.name, e.message); }
  await new Promise((r) => setTimeout(r, it.wait || 2500));
  if (it.click) {
    const ok = await page.evaluate((txt) => { const re = new RegExp(txt, "i"); const el = [...document.querySelectorAll("a,button,div,span")].find((e) => re.test(e.textContent) && e.children.length === 0); if (el) { el.click(); return true; } return false; }, it.click);
    console.log("  click", it.click, ok);
    await new Promise((r) => setTimeout(r, 2000));
  }
  if (it.eval) {
    try { await page.evaluate(it.eval); } catch (e) { console.log("  WARN eval", it.name, e.message); }
    await new Promise((r) => setTimeout(r, it.evalWait ?? 800));
  }
  await page.addStyleTag({ content: HIDE + "*{backdrop-filter:none!important}" + (it.css || "") });
  if (it.selector) await page.evaluate((sel, off) => { const el = document.querySelector(sel); if (el) el.scrollIntoView({ block: "start" }); window.scrollBy(0, -off); }, it.selector, it.offset ?? 40);
  if (it.scrollText) {
    const ok = await page.evaluate((txt, off) => {
      const w = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT); let n;
      while ((n = w.nextNode())) { const i = n.textContent.indexOf(txt); if (i >= 0) { const rg = document.createRange(); rg.setStart(n, i); rg.setEnd(n, i + txt.length); const r = rg.getBoundingClientRect(); if (r.height > 0) { window.scrollBy(0, r.top - off); return true; } } }
      return false;
    }, it.scrollText, it.offset ?? 160);
    if (!ok) console.log("  WARN scrollText not found:", it.scrollText);
  }
  await new Promise((r) => setTimeout(r, 900));
  const measure = () => page.evaluate((marks) => {
    const out = {};
    const h1 = document.querySelector("h1");
    if (h1) { const r = h1.getBoundingClientRect(); out.h1 = [[r.x, r.y, r.width, r.height]]; }
    for (const m of marks || []) {
      const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
      let n, found = null;
      while ((n = walker.nextNode())) {
        const i = n.textContent.indexOf(m);
        if (i >= 0) {
          const rg = document.createRange(); rg.setStart(n, i); rg.setEnd(n, i + m.length);
          const rs = [...rg.getClientRects()].filter((r) => r.width > 2 && r.y > -50 && r.y < innerHeight);
          if (rs.length) { found = rs.map((r) => [r.x, r.y, r.width, r.height]); break; }
        }
      }
      out[m] = found;
    }
    return out;
  }, it.marks || []);
  // Lazy content / scroll anchoring can still move the text after scrolling (seen on GitHub issues: ~7 css px),
  // which leaves the marks off the words. Wait until the layout is stable, then measure → screenshot → re-measure,
  // and retry (up to 3×) if the marks moved during the capture.
  const settle = async () => {
    let last = "", same = 0; const t0 = Date.now();
    while (Date.now() - t0 < (it.settle ?? 4000)) {
      await new Promise((r) => setTimeout(r, 250));
      const p = JSON.stringify(await measure()) + (await page.evaluate(() => scrollY + "|" + document.documentElement.scrollHeight));
      same = p === last ? same + 1 : 0; last = p;
      if (same >= 3) return;
    }
    console.log("  WARN layout still moving after", it.settle ?? 4000, "ms");
  };
  const png = `${outDir}/${it.name}.png`;
  let rects;
  for (let attempt = 1; attempt <= 3; attempt++) {
    await settle();
    rects = await measure();
    await page.screenshot({ path: png });
    const again = await measure();
    if (JSON.stringify(again) === JSON.stringify(rects)) break;
    console.log(`  WARN marks moved during capture (attempt ${attempt}); ${attempt < 3 ? "re-shooting" : "keeping the last capture, CHECK the marks"}`);
    rects = again;
  }
  const conv = {};
  for (const [k, v] of Object.entries(rects)) conv[k] = v ? v.map((r) => r.map((x) => Math.round(x * S))) : null;
  const r = spawnSync("ffmpeg", ["-v", "error", "-y", "-i", png, "-vf", `scale=${W}:-2:flags=lanczos`, "-q:v", "3", `${outDir}/${it.name}.jpg`]);
  // full-resolution copy (2880 px wide = the 2x capture) for 4K renders; KIT.receipt picks it automatically when devicePixelRatio > 1
  const r2 = spawnSync("ffmpeg", ["-v", "error", "-y", "-i", png, "-q:v", "2", `${outDir}/${it.name}@2x.jpg`]);
  if (r.status === 0 && r2.status === 0) fs.unlinkSync(png);
  all[it.name] = { url: it.url, title: await page.title(), rects: conv };
  console.log("OK", it.name, "|", all[it.name].title, JSON.stringify(conv));
  await page.close();
}
fs.writeFileSync(rectsPath, JSON.stringify(all, null, 1));
await browser.close();
console.log("\nNow LOOK at every jpg (or a contact sheet): ads, interstitials and blank SPA pages are common — re-shoot with selector/offset/css/click/wait.");
