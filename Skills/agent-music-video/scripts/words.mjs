// Print sung words, lyric lines, beats, strong hits and energy inside a track-time range,
// in TRACK seconds and FRAME-LOCAL seconds (local = track - t0). Run from the project root.
// Usage: node words.mjs <t0> <t1> [--song assets/kit/song.js] [--audiomap audiomap.json]
import { readFileSync } from "node:fs";
const argv = process.argv.slice(2);
const flag = (n, d) => { const i = argv.indexOf(`--${n}`); return i >= 0 ? argv[i + 1] : d; };
const [t0, t1] = argv.slice(0, 2).map(Number);
const S = JSON.parse(readFileSync(flag("song", "assets/kit/song.js"), "utf8").replace(/^window\.SONG = /, "").replace(/;\s*$/, ""));
const am = JSON.parse(readFileSync(flag("audiomap", "audiomap.json"), "utf8"));
const f = (x) => x.toFixed(2).padStart(7);
console.log(`range ${t0}–${t1} (len ${(t1 - t0).toFixed(3)}s)\n\nLINES (track | local):`);
for (const l of S.lines) if (l.s < t1 && l.e > t0) console.log(`${f(l.s)} | ${f(l.s - t0)}  ${l.cap ? "[cap] " : "[no-cap] "}${l.t}`);
console.log("\nWORDS (track | local):");
for (const w of S.words) if (w.s >= t0 && w.s < t1) console.log(`${f(w.s)} | ${f(w.s - t0)}  ${w.w}`);
console.log("\nBEATS (local):", S.beats.filter((b) => b >= t0 && b < t1).map((b) => (b - t0).toFixed(3)).join(" "));
console.log("DOWNBEATS (local):", S.downbeats.filter((b) => b >= t0 && b < t1).map((b) => (b - t0).toFixed(3)).join(" "));
console.log("\nSTRONG KICK/SNARE HITS e>=0.3 (track | local):");
for (const e of am.events) if (e.t >= t0 && e.t < t1 && e.energy >= 0.3 && (e.drum === "kick" || e.drum === "snare")) console.log(`${f(e.t)} | ${f(e.t - t0)}  ${e.drum} e=${e.energy}`);
console.log("\nENERGY PHASES:");
for (const p of am.energy_phases) if (p.start < t1 && p.end > t0) console.log(`${f(p.start)}–${f(p.end)} ${p.level} e=${p.energy}`);
