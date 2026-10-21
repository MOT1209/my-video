/* ==========================================================================
   agent-music-video kit (window.KIT)
   Loaded by the root index.html BEFORE any frame mounts, so every frame
   script can call KIT.* synchronously. Everything here is deterministic:
   markup builders return strings; timeline helpers only add tweens/sets
   to the timeline you pass in. No clocks, no Math.random.
   ========================================================================== */
(function () {
  const K = {};
  const C = (K.C = {
    black: "#000000", white: "#ffffff", off: "#fffdf5", pink: "#fe90e8", blue: "#c0f7fe",
    green: "#99e885", yellow: "#f7cb46", cream: "#ffdc8b", red: "#ff5a4e", screen: "#15151a",
    ink: "#000000", paper: "#ffffff", font: "Inter",
  });
  /* KIT.theme({ ink, paper, font, pink, blue, … }) — call once (e.g. in assets/theme.js loaded after kit.js)
     to re-skin every SVG builder (mascot, chonk, star, tail, horn). Mirror the same values in CSS vars
     (--k-ink, --k-paper, --k-font-display, --k-pink …) so CSS atoms match. */
  K.theme = function (o) { Object.assign(C, o || {}); return C; };
  const col = (c) => (C[c] || c);

  /* ---------------- determinism helpers ---------------- */
  K.rng = function (seed) {
    let a = (seed >>> 0) || 1;
    return function () {
      a |= 0; a = (a + 0x6d2b79f5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  };

  /* Song timing (track seconds) lives in window.SONG (assets/kit/song.js).
     beatsIn(t0, t1) -> frame-LOCAL beat times inside [t0, t1)  (t0 = your frame's span start) */
  K.beatsIn = function (t0, t1, opts) {
    const S = window.SONG || { beats: [] };
    const src = opts && opts.down ? S.downbeats : S.beats;
    return src.filter((b) => b >= t0 - 1e-6 && b < t1 - 1e-6).map((b) => +(b - t0).toFixed(3));
  };
  /* word onsets (frame-local) for words whose track time is inside [t0,t1) */
  K.wordsIn = function (t0, t1) {
    const S = window.SONG || { words: [] };
    return S.words.filter((w) => w.s >= t0 - 1e-6 && w.s < t1 - 1e-6).map((w) => ({ w: w.w, s: +(w.s - t0).toFixed(3), e: +(w.e - t0).toFixed(3) }));
  };

  /* Seek-safe initial state: applies props NOW (so the very first rendered frame is right — a tl.set at
     exactly t=0 is not rendered on frame 0) AND at t=0 on the timeline (so backward seeks restore it). */
  K.init = function (tl, sel, props) {
    if (window.gsap) gsap.set(sel, props);
    tl.set(sel, props, 0);
  };
  /* Run any KIT timeline helper immediately (e.g. a mascot's starting face/pose/badge) and ALSO at t=0.
     Usage: KIT.now(tl, (t) => { KIT.face(t, id, "smug", 0); KIT.pose(t, id, "hip", 0, 0); }); */
  K.now = function (tl, fn) {
    if (window.gsap) { const pre = gsap.timeline({ paused: true }); fn(pre); pre.progress(1); }
    fn(tl);
  };

  /* Multiple per-frame render callbacks on one timeline (canvas / three layers). */
  K.onFrame = function (tl, fn) {
    if (!tl.__kitFns) {
      tl.__kitFns = [];
      tl.eventCallback("onUpdate", () => { const t = tl.time(); for (const f of tl.__kitFns) f(t); });
    }
    tl.__kitFns.push(fn);
    fn(0);
  };

  /* ---------------- text helpers ---------------- */
  /* Wrap each character of el in <span class="k-ch"> (words kept together). Returns array of char spans. */
  K.split = function (el) {
    if (typeof el === "string") el = document.querySelector(el);
    const text = el.textContent;
    el.textContent = "";
    const chars = [];
    text.split(" ").forEach((word, wi, arr) => {
      const w = document.createElement("span");
      w.className = "k-word";
      for (const ch of word) {
        const s = document.createElement("span");
        s.className = "k-ch";
        s.textContent = ch;
        w.appendChild(s);
        chars.push(s);
      }
      el.appendChild(w);
      if (wi < arr.length - 1) el.appendChild(document.createTextNode(" "));
    });
    return chars;
  };

  /* Count a number up/down inside el between at and at+dur (seek-safe via onUpdate of a proxy tween). */
  K.count = function (tl, el, from, to, at, dur, fmt, ease) {
    if (typeof el === "string") el = document.querySelector(el);
    const o = { v: from };
    const f = fmt || ((v) => Math.round(v).toString());
    el.textContent = f(from);
    tl.fromTo(o, { v: from }, { v: to, duration: dur, ease: ease || "power2.out", onUpdate: () => { el.textContent = f(o.v); } }, at);
    tl.set(el, { textContent: f(to) }, at + dur + 0.001);
  };

  /* Type text on character by character with 0ms sets (seek-safe). Returns end time. */
  K.typeOn = function (tl, el, text, at, cps) {
    if (typeof el === "string") el = document.querySelector(el);
    const step = 1 / (cps || 30);
    tl.set(el, { textContent: "" }, Math.max(0, at - 0.001));
    for (let i = 1; i <= text.length; i++) tl.set(el, { textContent: text.slice(0, i) }, at + (i - 1) * step);
    return at + text.length * step;
  };

  /* ---------------- motion helpers ---------------- */
  K.punch = function (tl, target, at, s, dur) {
    tl.set(target, { scale: s || 1.14 }, at);
    tl.to(target, { scale: 1, duration: dur || 0.32, ease: "power3.out" }, at);
  };
  /* Deterministic camera/screen shake on target (x/y/rotation jitter), returns to 0. */
  K.shake = function (tl, target, at, amp, dur, seed) {
    const r = K.rng(seed || 7), n = Math.max(3, Math.round((dur || 0.35) / 0.04)), A = amp || 18;
    for (let i = 0; i < n; i++) {
      const k = 1 - i / n;
      tl.to(target, { x: (r() * 2 - 1) * A * k, y: (r() * 2 - 1) * A * k, rotation: (r() * 2 - 1) * 1.2 * k, duration: 0.04, ease: "none" }, at + i * 0.04);
    }
    tl.to(target, { x: 0, y: 0, rotation: 0, duration: 0.05, ease: "none" }, at + n * 0.04);
  };
  /* White (or colored) flash: put <div class="k-flash"> top-most in your frame. */
  K.flash = function (tl, target, at, peak, dur) {
    tl.set(target, { opacity: peak == null ? 0.9 : peak }, at);
    tl.to(target, { opacity: 0, duration: dur || 0.28, ease: "power2.out" }, at + 0.001);
  };
  /* Squash-and-stretch bounce on each beat time (frame-local). transformOrigin should be bottom center. */
  K.bounce = function (tl, target, times, amt) {
    const a = amt || 0.05;
    times.forEach((t) => {
      tl.set(target, { scaleY: 1 - a, scaleX: 1 + a * 0.7 }, t);
      tl.to(target, { scaleY: 1, scaleX: 1, duration: 0.26, ease: "back.out(3)" }, t + 0.001);
    });
  };
  /* Highlighter marks inside a receipt: sweep each .k-mark left->right. */
  K.marks = function (tl, sel, at, each) {
    const els = typeof sel === "string" ? document.querySelectorAll(sel) : sel;
    Array.from(els).forEach((el, i) => {
      tl.fromTo(el, { scaleX: 0 }, { scaleX: 1, duration: 0.32, ease: "power2.inOut" }, at + i * (each == null ? 0.18 : each));
    });
  };

  /* ---------------- SVG atoms ---------------- */
  K.star = function (o) {
    o = o || {};
    const n = o.points || 10, R = 50, r = R * (o.inner || 0.62), pts = [];
    for (let i = 0; i < n * 2; i++) {
      const a = (Math.PI * i) / n - Math.PI / 2, rad = i % 2 ? r : R;
      pts.push((50 + rad * Math.cos(a)).toFixed(2) + "," + (50 + rad * Math.sin(a)).toFixed(2));
    }
    const s = o.size || 180;
    return `<svg ${o.id ? `id="${o.id}"` : ""} class="${o.cls || ""}" viewBox="-8 -8 120 120" width="${s}" height="${s}" style="${o.style || ""}">
      <polygon points="${pts.join(" ")}" transform="translate(7,7)" fill="${C.ink}"/>
      <polygon points="${pts.join(" ")}" fill="${col(o.color || "yellow")}" stroke="${C.ink}" stroke-width="${o.stroke || 4}" stroke-linejoin="round"/>
      ${o.text ? `<text x="50" y="${50 + (o.textSize || 18) * 0.36}" text-anchor="middle" font-family="Inter" font-weight="900" font-size="${o.textSize || 18}" fill="#000">${o.text}</text>` : ""}
    </svg>`;
  };

  /* Speech-bubble tail (place inside a .k-bubble, absolutely). dir: "bl" | "br" | "tl" | "tr" */
  K.tail = function (dir) {
    const flipX = dir === "br" || dir === "tr" ? -1 : 1, flipY = dir === "tl" || dir === "tr" ? -1 : 1;
    const pos = { bl: "left:60px;bottom:-58px", br: "right:60px;bottom:-58px", tl: "left:60px;top:-58px", tr: "right:60px;top:-58px" }[dir || "bl"];
    return `<svg class="k-bubble-tail" style="${pos};transform:scale(${flipX},${flipY})" viewBox="0 0 60 60"><path d="M0 -6 L0 56 L48 -6 Z" fill="${C.paper}" stroke="${C.ink}" stroke-width="5" stroke-linejoin="miter"/><rect x="2.5" y="-10" width="43" height="8" fill="${C.paper}"/></svg>`;
  };

  K.logo = function (name) { return "assets/logos/" + name + ".svg"; };

  /* ---------------- receipts (real screenshots) ----------------
     KIT.receipt({ id, shot:"mistral-large-4", url:"mistral.ai/news/…", tag:"MISTRAL · OCT 6, 2026",
                   width:900, crop:[x,y,w,h] (jpg px of the 1920-wide shot), marks:[[x,y,w,h],…], tagColor:"yellow" })
     Marks get ids `${id}-mark0..n` and class k-mark (animate with KIT.marks). */
  /* o.hires: true/false forces the @2x screenshot (default: automatic when devicePixelRatio > 1, i.e. 4K renders).
     Coordinates (crop/marks) always stay in the 1920-wide jpg's pixels. */
  K.receipt = function (o) {
    const W = o.width || 900, cr = o.crop || [0, 0, 1920, 1333], s = W / cr[2], H = Math.round(cr[3] * s);
    const marks = (o.marks || []).map((m, i) => `<div id="${o.id}-mark${i}" class="k-mark ${o.markColor || ""}" style="left:${Math.round((m[0] - cr[0]) * s - 6)}px;top:${Math.round((m[1] - cr[1]) * s - 2)}px;width:${Math.round(m[2] * s + 12)}px;height:${Math.round(m[3] * s + 4)}px"></div>`).join("");
    return `<div id="${o.id}" class="k-receipt ${o.cls || ""}" style="width:${W + 10}px;${o.style || ""}">
      <div class="k-receipt-bar"><i></i><i></i><i></i><div class="k-receipt-url">${o.url || ""}</div></div>
      <div class="k-receipt-view" style="width:${W}px;height:${H}px">
        <img src="assets/shots/${o.shot}${(o.hires ?? ((window.devicePixelRatio || 1) > 1)) ? "@2x" : ""}.jpg" style="width:${Math.round(1920 * s)}px;left:${Math.round(-cr[0] * s)}px;top:${Math.round(-cr[1] * s)}px"/>
        ${marks}
      </div>
      ${o.tag ? `<div class="k-receipt-tag"><span class="k-pill" style="background:${col(o.tagColor || "yellow")}">${o.tag}</span></div>` : ""}
    </div>`;
  };

  /* ---------------- calendar tear-off ---------------- */
  K.calendar = function (o) {
    return `<div id="${o.id}" class="k-cal" style="${o.style || ""}">
      <div class="k-cal-rings"><i></i><i></i><i></i></div>
      <div class="k-cal-top" style="background:${col(o.color || "pink")}"><span>${o.month || "OCT"}</span><span>${o.year || "2026"}</span></div>
      <div class="k-cal-num">${o.day}</div>
      <div class="k-cal-dow">${o.dow}</div>
    </div>`;
  };

  /* ==========================================================================
     THE AGENT — our narrator. SVG rig, viewBox 0 0 400 480 (feet at y≈466).
     KIT.mascot({ id, body:KIT.AGENT_BODY (blue, default), ear, badge:"A.I.", accessory:null|"beret"|"shades"|"headset"|"crown"|"party", size:520, eye:"green" })
     Then: const R = KIT.rig(id)  -> selectors + pivots (call after the markup is in the DOM)
       KIT.face(tl, id, expr, at)        expr: idle happy nervous shock sad dead wink love side angry cry focus sleep smug
       KIT.blink(tl, id, at)
       KIT.talk(tl, id, times[], hold)   lip-flap on each (frame-local) word time
       KIT.badge(tl, id, "si"|"ai", at)  swap the chest badge A.I. -> S.I.
       KIT.pose(tl, id, pose, at, dur)   arms: down wave hype shrug point raise hip think
       KIT.groove(tl, id, beats[], amt)  head-bob + body squash on beats
       KIT.sweat(tl, id, at, on) / KIT.tears(tl, id, at, on)
       KIT.outfit(id, "mechanic"|…) / KIT.outfitSwap(tl, id, name, at)   scene outfits (see OUTFITS below)
     ========================================================================== */
  const EYES = {
    idle: (c) => `<rect x="132" y="160" width="36" height="56" rx="9" fill="${c}"/><rect x="232" y="160" width="36" height="56" rx="9" fill="${c}"/>`,
    happy: (c) => `<path d="M128 204 Q150 166 172 204" stroke="${c}" stroke-width="13" fill="none" stroke-linecap="round"/><path d="M228 204 Q250 166 272 204" stroke="${c}" stroke-width="13" fill="none" stroke-linecap="round"/>`,
    small: (c) => `<rect x="140" y="176" width="22" height="30" rx="6" fill="${c}"/><rect x="238" y="176" width="22" height="30" rx="6" fill="${c}"/>`,
    shock: (c) => `<circle cx="150" cy="188" r="28" fill="none" stroke="${c}" stroke-width="10"/><circle cx="150" cy="188" r="8" fill="${c}"/><circle cx="250" cy="188" r="28" fill="none" stroke="${c}" stroke-width="10"/><circle cx="250" cy="188" r="8" fill="${c}"/>`,
    sad: (c) => `<path d="M128 178 Q150 206 172 178" stroke="${c}" stroke-width="13" fill="none" stroke-linecap="round"/><path d="M228 178 Q250 206 272 178" stroke="${c}" stroke-width="13" fill="none" stroke-linecap="round"/>`,
    x: (c) => `<path d="M130 166 L170 206 M170 166 L130 206" stroke="${c}" stroke-width="13" stroke-linecap="round"/><path d="M230 166 L270 206 M270 166 L230 206" stroke="${c}" stroke-width="13" stroke-linecap="round"/>`,
    wink: (c) => `<path d="M128 194 Q150 172 172 194" stroke="${c}" stroke-width="13" fill="none" stroke-linecap="round"/><rect x="232" y="160" width="36" height="56" rx="9" fill="${c}"/>`,
    heart: () => `<path d="M150 214 L124 186 A15 15 0 0 1 150 168 A15 15 0 0 1 176 186 Z" fill="${C.pink}"/><path d="M250 214 L224 186 A15 15 0 0 1 250 168 A15 15 0 0 1 276 186 Z" fill="${C.pink}"/>`,
    side: (c) => `<rect x="150" y="182" width="36" height="30" rx="7" fill="${c}"/><rect x="250" y="182" width="36" height="30" rx="7" fill="${c}"/><rect x="146" y="174" width="44" height="9" fill="${c}"/><rect x="246" y="174" width="44" height="9" fill="${c}"/>`,
    angry: (c) => `<path d="M128 168 L172 186 L172 212 L128 212 Z" fill="${c}"/><path d="M272 168 L228 186 L228 212 L272 212 Z" fill="${c}"/>`,
    focus: (c) => `<rect x="130" y="184" width="40" height="18" rx="5" fill="${c}"/><rect x="230" y="184" width="40" height="18" rx="5" fill="${c}"/>`,
    closed: (c) => `<rect x="128" y="190" width="44" height="9" rx="4" fill="${c}"/><rect x="228" y="190" width="44" height="9" rx="4" fill="${c}"/>`,
    smug: (c) => `<path d="M128 190 L172 190 L168 206 Q150 214 132 206 Z" fill="${c}"/><path d="M228 190 L272 190 L268 206 Q250 214 232 206 Z" fill="${c}"/>`,
  };
  const MOUTH = {
    line: (c) => `<rect x="178" y="238" width="44" height="9" rx="4" fill="${c}"/>`,
    smile: (c) => `<path d="M170 232 Q200 260 230 232" stroke="${c}" stroke-width="10" fill="none" stroke-linecap="round"/>`,
    grin: (c) => `<path d="M168 230 L232 230 Q228 262 200 262 Q172 262 168 230 Z" fill="${c}"/>`,
    o: (c) => `<circle cx="200" cy="246" r="13" fill="none" stroke="${c}" stroke-width="9"/>`,
    frown: (c) => `<path d="M172 254 Q200 230 228 254" stroke="${c}" stroke-width="10" fill="none" stroke-linecap="round"/>`,
    wobble: (c) => `<path d="M168 246 L180 238 L192 248 L204 238 L216 248 L228 238" stroke="${c}" stroke-width="8" fill="none" stroke-linejoin="round" stroke-linecap="round"/>`,
    flat: (c) => `<rect x="182" y="242" width="36" height="7" rx="3" fill="${c}"/>`,
  };
  const EXPR = {
    idle: ["idle", "line"], happy: ["happy", "grin"], nervous: ["small", "wobble"], shock: ["shock", "o"], sad: ["sad", "frown"],
    dead: ["x", "flat"], wink: ["wink", "smile"], love: ["heart", "smile"], side: ["side", "flat"], angry: ["angry", "frown"],
    cry: ["sad", "wobble"], focus: ["focus", "line"], sleep: ["closed", "flat"], smug: ["smug", "smile"],
  };
  K.EXPRESSIONS = Object.keys(EXPR);

  const ACC = {
    beret: `<g><ellipse cx="166" cy="96" rx="104" ry="30" fill="${C.ink}" transform="rotate(-10 166 96)"/><rect x="160" y="52" width="14" height="22" fill="${C.ink}" transform="rotate(-10 166 96)"/></g>`,
    shades: `<g><rect x="114" y="168" width="78" height="44" fill="${C.ink}" stroke="${C.white}" stroke-width="3"/><rect x="208" y="168" width="78" height="44" fill="${C.ink}" stroke="${C.white}" stroke-width="3"/><rect x="186" y="176" width="28" height="10" fill="${C.ink}"/><rect x="124" y="176" width="22" height="8" fill="${C.paper}" opacity=".7"/><rect x="218" y="176" width="22" height="8" fill="${C.paper}" opacity=".7"/></g>`,
    headset: `<g fill="none" stroke="${C.ink}" stroke-width="10"><path d="M70 160 Q70 70 200 64 Q330 70 330 160"/></g><rect x="40" y="150" width="34" height="74" fill="${C.yellow}" stroke="${C.ink}" stroke-width="8"/><rect x="326" y="150" width="34" height="74" fill="${C.yellow}" stroke="${C.ink}" stroke-width="8"/><path d="M60 222 Q74 280 150 284" fill="none" stroke="${C.ink}" stroke-width="8"/><rect x="146" y="274" width="26" height="20" fill="${C.ink}"/>`,
    crown: `<path d="M120 92 L140 30 L172 70 L200 18 L228 70 L260 30 L280 92 Z" fill="${C.yellow}" stroke="${C.ink}" stroke-width="8" stroke-linejoin="round"/>`,
    party: `<path d="M200 6 L242 92 L158 92 Z" fill="${C.pink}" stroke="${C.ink}" stroke-width="8" stroke-linejoin="round"/><circle cx="200" cy="6" r="12" fill="${C.yellow}" stroke="${C.ink}" stroke-width="6"/>`,
  };

  K.mascot = function (o) {
    const id = o.id, body = col(o.body || K.AGENT_BODY || "#3ec1d3"), ear = col(o.ear || o.body || K.AGENT_BODY || "#3ec1d3"), eye = col(o.eye || "green");
    const eyes = Object.keys(EYES).map((k) => `<g id="${id}-e-${k}" opacity="${k === "idle" ? 1 : 0}">${EYES[k](eye)}</g>`).join("");
    const mouths = Object.keys(MOUTH).map((k) => `<g id="${id}-m-${k}" opacity="${k === "line" ? 1 : 0}">${MOUTH[k](eye)}</g>`).join("");
    const size = o.size || 520;
    const badge = o.badge == null ? "A.I." : o.badge;
    const acc = o.accessory && ACC[o.accessory] ? ACC[o.accessory] : "";
    const accBehind = o.accessory === "headset";
    return `<svg id="${id}" class="k-mascot ${o.cls || ""}" viewBox="0 0 400 480" width="${size}" height="${Math.round(size * 1.2)}" style="overflow:visible;${o.style || ""}">
  <g id="${id}-all">
    <g id="${id}-legs">
      <rect x="160" y="414" width="12" height="40" fill="${C.ink}"/><rect x="228" y="414" width="12" height="40" fill="${C.ink}"/>
      <rect x="134" y="446" width="50" height="22" fill="${C.yellow}" stroke="${C.ink}" stroke-width="7"/>
      <rect x="216" y="446" width="50" height="22" fill="${C.yellow}" stroke="${C.ink}" stroke-width="7"/>
    </g>
    <g id="${id}-body">
      <rect x="130" y="324" width="164" height="104" fill="${C.ink}"/>
      <rect id="${id}-shirt" x="118" y="312" width="164" height="104" fill="${body}" stroke="${C.ink}" stroke-width="9"/>
      <g id="${id}-badge-ai" opacity="${badge ? 1 : 0}"><rect x="146" y="336" width="108" height="50" fill="${C.paper}" stroke="${C.ink}" stroke-width="6"/><text x="200" y="373" text-anchor="middle" font-family="${C.font}" font-weight="900" font-size="32" letter-spacing="-1">${badge}</text></g>
      <g id="${id}-badge-si" opacity="0"><rect x="146" y="336" width="108" height="50" fill="${C.yellow}" stroke="${C.ink}" stroke-width="6" transform="rotate(-6 200 361)"/><text x="200" y="373" text-anchor="middle" font-family="${C.font}" font-weight="900" font-size="32" letter-spacing="-1" transform="rotate(-6 200 361)">S.I.</text></g>
    </g>
    <rect x="182" y="296" width="36" height="22" fill="${C.ink}"/>
    <g id="${id}-head">
      ${accBehind ? acc : ""}
      <line x1="200" y1="92" x2="200" y2="40" stroke="${C.ink}" stroke-width="10"/>
      <circle id="${id}-bulb" cx="200" cy="30" r="17" fill="${C.yellow}" stroke="${C.ink}" stroke-width="8"/>
      <rect id="${id}-earL" x="34" y="158" width="32" height="76" fill="${ear}" stroke="${C.ink}" stroke-width="8"/>
      <rect id="${id}-earR" x="334" y="158" width="32" height="76" fill="${ear}" stroke="${C.ink}" stroke-width="8"/>
      <rect x="76" y="106" width="276" height="206" fill="${C.ink}"/>
      <rect x="62" y="92" width="276" height="206" fill="${C.paper}" stroke="${C.ink}" stroke-width="9"/>
      <rect x="90" y="120" width="220" height="150" fill="${C.screen}" stroke="${C.ink}" stroke-width="7"/>
      <path d="M104 132 L136 132 L110 166 Z" fill="${C.paper}" opacity=".12"/>
      <g id="${id}-eyes">${eyes}</g>
      <g id="${id}-mouth">${mouths}</g>
      <g id="${id}-talk" opacity="0"><rect x="160" y="226" width="80" height="40" fill="${C.screen}"/><rect x="176" y="230" width="48" height="30" rx="10" fill="${eye}"/></g>
      <g id="${id}-tears" opacity="0"><rect x="136" y="214" width="14" height="56" fill="${C.blue}"/><rect x="250" y="214" width="14" height="56" fill="${C.blue}"/></g>
      ${accBehind ? "" : acc}
      <path id="${id}-sweat" opacity="0" d="M352 74 Q372 104 368 122 A18 18 0 0 1 334 120 Q332 104 352 74 Z" fill="${C.blue}" stroke="${C.ink}" stroke-width="6"/>
    </g>
    <g id="${id}-armL"><line x1="124" y1="340" x2="52" y2="412" stroke="${C.ink}" stroke-width="12" stroke-linecap="round"/><circle cx="47" cy="417" r="20" fill="${C.paper}" stroke="${C.ink}" stroke-width="7"/></g>
    <g id="${id}-armR"><line x1="276" y1="340" x2="348" y2="412" stroke="${C.ink}" stroke-width="12" stroke-linecap="round"/><circle cx="353" cy="417" r="20" fill="${C.paper}" stroke="${C.ink}" stroke-width="7"/></g>
  </g>
</svg>`;
  };

  /* The female AGENT — for lines a female voice sings (see scripts/voice_cast.py). Same rig as AGENT:
     KIT.mascot({ id, ... }); KIT.rig(id); KIT.femme(id)  -> pink shirt + ears (KIT.FEMME), pink antenna bow, lashes, blush.
     KIT.femme recolours her body + ears itself (idempotent), whatever body the mascot was built with. */
  K.FEMME = { body: "pink", ear: "pink" };
  K.AGENT_BODY = "#3ec1d3"; // AGENT (male) wears blue: the default body of KIT.mascot
  K.femme = function (id) {
    const head = document.getElementById(id + "-head");
    if (!head) return;
    const shirt = document.getElementById(id + "-shirt") || document.querySelectorAll("#" + id + "-body > rect")[1];
    if (shirt) shirt.setAttribute("fill", col(K.FEMME.body));
    const ears = [document.getElementById(id + "-earL"), document.getElementById(id + "-earR")].filter(Boolean);
    (ears.length ? ears : [...head.querySelectorAll(":scope > rect")].filter((r) => r.getAttribute("x") === "34" || r.getAttribute("x") === "334"))
      .forEach((r) => r.setAttribute("fill", col(K.FEMME.ear)));
    if (document.getElementById(id + "-femme")) return;
    const g = document.createElementNS("http://www.w3.org/2000/svg", "g"), eye = C.green;
    g.setAttribute("id", id + "-femme");
    g.innerHTML = `<g stroke="${eye}" stroke-width="7" stroke-linecap="round">
        <path d="M124 160 L112 146"/><path d="M138 154 L132 138"/><path d="M154 152 L154 136"/>
        <path d="M276 160 L288 146"/><path d="M262 154 L268 138"/><path d="M246 152 L246 136"/></g>
      <ellipse cx="122" cy="238" rx="17" ry="9" fill="${C.pink}" opacity=".75"/><ellipse cx="278" cy="238" rx="17" ry="9" fill="${C.pink}" opacity=".75"/>
      <g stroke="${C.ink}" stroke-width="6" stroke-linejoin="round"><path d="M200 56 L162 36 L162 78 Z" fill="${C.pink}"/><path d="M200 56 L238 36 L238 78 Z" fill="${C.pink}"/>
        <circle cx="200" cy="56" r="10" fill="${C.pink}"/></g>`;
    head.appendChild(g);
  };

  /* --------------------------------------------------------------------------
     OUTFITS — characters dress for the scene (pit crew at a pit stop, shades at a night show, readers for a lecture).
     KIT.outfit(id, "mechanic" | "racing" | "pitcrew" | "star" | "reader" | "party" | "royal" | "none", { color })
     KIT.outfit(id, { hat, eyes, neck, torso, back }, { name, color })   compose parts (names below or raw SVG strings)
     KIT.outfitSwap(tl, id, name, at)   pop a new outfit on at `at` (set + to, seek-safe; build-time markup, no clocks)
     Call after the mascot is in the DOM (any time; before or after KIT.femme). Pure markup layered INTO the rig, so
     it moves with the head/body. Identity markers never change: the outfit sits under the chest badge (torso layers are
     drawn behind it), the shirt colour stays visible (AGENT blue / her pink), her antenna bow and the bulb stay on top
     of any hat, and eyewear is translucent so the LED face stays readable. Parts:
       hat:   capBack (backwards cap) · goggles (pushed up) · headset (+ mic) · crown (tilted) · partyHat (tilted)
       eyes:  shades (translucent, neon frame) · readers (round gold frames)
       neck:  chain · bowtie · collar (ermine) · scarf (checkered)
       torso: overalls (straps + tool belt) · racesuit (side stripes + checkered sash) · vest (team vest) · lapels (jacket)
       back:  cape
     -------------------------------------------------------------------------- */
  const OF_HAT = {
    capBack: (c) => ({
      b: `<path d="M80 100 Q86 30 200 26 Q314 30 320 100 Z" fill="${c}" stroke="${C.ink}" stroke-width="9" stroke-linejoin="round"/>
          <path d="M116 58 Q200 38 284 58" fill="none" stroke="${C.ink}" stroke-width="5" opacity=".4"/>`,
      f: `<path d="M64 90 Q200 74 336 90 L336 106 Q200 90 64 106 Z" fill="${c}" stroke="${C.ink}" stroke-width="7" stroke-linejoin="round"/>
          <path d="M172 100 Q200 66 228 100 Z" fill="${C.paper}" stroke="${C.ink}" stroke-width="6" stroke-linejoin="round"/>
          <rect x="182" y="92" width="36" height="7" fill="${C.ink}"/>`,
    }),
    goggles: (c) => ({
      f: `<path d="M62 98 Q200 84 338 98" fill="none" stroke="${C.ink}" stroke-width="13"/><path d="M62 98 Q200 84 338 98" fill="none" stroke="${c}" stroke-width="5"/>
          <rect x="174" y="86" width="52" height="10" fill="${C.ink}"/>
          <circle cx="156" cy="92" r="18" fill="${C.blue}" fill-opacity=".9" stroke="${C.ink}" stroke-width="7"/>
          <circle cx="244" cy="92" r="18" fill="${C.blue}" fill-opacity=".9" stroke="${C.ink}" stroke-width="7"/>
          <path d="M146 86 L158 80 M234 86 L246 80" stroke="${C.paper}" stroke-width="4" stroke-linecap="round"/>`,
    }),
    headset: (c) => ({
      b: `<path d="M56 166 Q56 64 200 58 Q344 64 344 166" fill="none" stroke="${C.ink}" stroke-width="13"/>`,
      f: `<rect x="28" y="148" width="42" height="84" rx="9" fill="${c}" stroke="${C.ink}" stroke-width="8"/>
          <rect x="330" y="148" width="42" height="84" rx="9" fill="${c}" stroke="${C.ink}" stroke-width="8"/>
          <path d="M50 230 Q58 288 146 288" fill="none" stroke="${C.ink}" stroke-width="8" stroke-linecap="round"/>
          <rect x="144" y="278" width="30" height="20" rx="6" fill="${C.ink}"/>`,
    }),
    crown: () => ({
      f: `<g transform="rotate(14 290 92)"><path d="M240 96 L248 48 L270 74 L290 38 L310 74 L332 48 L340 96 Z" fill="${C.yellow}" stroke="${C.ink}" stroke-width="7" stroke-linejoin="round"/>
          <circle cx="290" cy="82" r="7" fill="${C.red}" stroke="${C.ink}" stroke-width="4"/></g>`,
    }),
    partyHat: (c) => ({
      f: `<g transform="rotate(-18 128 94)"><path d="M128 8 L168 94 L88 94 Z" fill="${c}" stroke="${C.ink}" stroke-width="7" stroke-linejoin="round"/>
          <path d="M112 50 L144 50 M102 72 L154 72" stroke="${C.pink}" stroke-width="8"/>
          <circle cx="128" cy="8" r="11" fill="${C.yellow}" stroke="${C.ink}" stroke-width="6"/></g>`,
    }),
  };
  const OF_EYES = {
    shades: (c) => `<rect x="112" y="164" width="80" height="50" rx="10" fill="${C.ink}" fill-opacity=".38" stroke="${c}" stroke-width="6"/>
      <rect x="208" y="164" width="80" height="50" rx="10" fill="${C.ink}" fill-opacity=".38" stroke="${c}" stroke-width="6"/>
      <path d="M192 178 Q200 171 208 178" fill="none" stroke="${c}" stroke-width="6"/>
      <path d="M122 173 L142 173 M218 173 L238 173" stroke="${C.paper}" stroke-width="4" stroke-linecap="round" opacity=".55"/>`,
    readers: (c) => `<g fill="${C.paper}" fill-opacity=".08" stroke="${c}" stroke-width="6"><circle cx="150" cy="190" r="33"/><circle cx="250" cy="190" r="33"/></g>
      <path d="M183 186 Q200 176 217 186" fill="none" stroke="${c}" stroke-width="6"/>
      <path d="M117 184 L98 178 M283 184 L302 178" stroke="${c}" stroke-width="5" stroke-linecap="round"/>`,
  };
  const OF_NECK = {
    chain: () => `<path d="M146 314 Q200 334 254 314" fill="none" stroke="${C.ink}" stroke-width="11" stroke-linecap="round"/>
      <path d="M146 314 Q200 334 254 314" fill="none" stroke="${C.yellow}" stroke-width="6" stroke-dasharray="8 4" stroke-linecap="round"/>
      <circle cx="200" cy="325" r="5" fill="${C.yellow}" stroke="${C.ink}" stroke-width="3"/>`,
    bowtie: (c) => `<path d="M200 312 L170 300 L170 324 Z M200 312 L230 300 L230 324 Z" fill="${c}" stroke="${C.ink}" stroke-width="6" stroke-linejoin="round"/>
      <rect x="191" y="303" width="18" height="18" rx="3" fill="${c}" stroke="${C.ink}" stroke-width="5"/>`,
    collar: () => `<path d="M134 310 Q200 340 266 310 L258 294 Q200 318 142 294 Z" fill="${C.paper}" stroke="${C.ink}" stroke-width="6" stroke-linejoin="round"/>
      <g fill="${C.ink}"><rect x="156" y="306" width="6" height="10"/><rect x="197" y="314" width="6" height="10"/><rect x="238" y="306" width="6" height="10"/></g>`,
    scarf: (c) => `<path d="M148 310 Q200 330 252 310 L250 300 Q200 318 150 300 Z" fill="${C.paper}" stroke="${C.ink}" stroke-width="6" stroke-linejoin="round"/>
      <path d="M150 306 Q200 324 250 306" fill="none" stroke="${C.ink}" stroke-width="6" stroke-dasharray="8 8"/>
      <path d="M140 312 L120 350 L134 354 L148 316 Z" fill="${c}" stroke="${C.ink}" stroke-width="5" stroke-linejoin="round"/>`,
  };
  const OF_TORSO = {
    overalls: (c, id) => `<rect x="128" y="312" width="16" height="66" fill="${c}" stroke="${C.ink}" stroke-width="5"/>
      <rect x="256" y="312" width="16" height="66" fill="${c}" stroke="${C.ink}" stroke-width="5"/>
      <circle cx="136" cy="370" r="6" fill="${C.yellow}" stroke="${C.ink}" stroke-width="4"/><circle cx="264" cy="370" r="6" fill="${C.yellow}" stroke="${C.ink}" stroke-width="4"/>
      <rect x="116" y="394" width="168" height="16" fill="#8a5a33" stroke="${C.ink}" stroke-width="6"/>
      <rect x="188" y="391" width="24" height="22" fill="${C.yellow}" stroke="${C.ink}" stroke-width="5"/>
      <rect x="124" y="404" width="28" height="30" fill="#8a5a33" stroke="${C.ink}" stroke-width="5"/>
      <g transform="rotate(16 268 408)"><rect x="263" y="404" width="10" height="38" fill="#c9ccd1" stroke="${C.ink}" stroke-width="4"/>
        <path d="M258 440 a10 10 0 1 0 20 0 l-5 0 l0 6 l-10 0 l0 -6 Z" fill="#c9ccd1" stroke="${C.ink}" stroke-width="4" stroke-linejoin="round"/></g>`,
    racesuit: (c, id, nm) => {
      const cid = `${id}-of-${nm}-clip`, a = [118, 314], b = [282, 414], n = [-0.52, 0.854], w = 13;
      const P = (p, k) => `${(p[0] + n[0] * k).toFixed(1)} ${(p[1] + n[1] * k).toFixed(1)}`;
      return `<clipPath id="${cid}"><rect x="118" y="312" width="164" height="104"/></clipPath>
      <g clip-path="url(#${cid})">
        <rect x="122" y="314" width="10" height="100" fill="${c}"/><rect x="134" y="314" width="5" height="100" fill="${C.paper}"/>
        <rect x="268" y="314" width="10" height="100" fill="${c}"/><rect x="261" y="314" width="5" height="100" fill="${C.paper}"/>
        <path d="M${P(a, w)} L${P(b, w)} L${P(b, -w)} L${P(a, -w)} Z" fill="${C.paper}" stroke="${C.ink}" stroke-width="4"/>
        <path d="M${P(a, w / 2)} L${P(b, w / 2)}" stroke="${C.ink}" stroke-width="${w}" stroke-dasharray="${w} ${w}"/>
        <path d="M${P(a, -w / 2)} L${P(b, -w / 2)}" stroke="${C.ink}" stroke-width="${w}" stroke-dasharray="${w} ${w}" stroke-dashoffset="${w}"/>
      </g>`;
    },
    vest: (c) => `<path d="M118 312 L152 312 L140 350 L140 416 L118 416 Z" fill="${c}" stroke="${C.ink}" stroke-width="6" stroke-linejoin="round"/>
      <path d="M282 312 L248 312 L260 350 L260 416 L282 416 Z" fill="${c}" stroke="${C.ink}" stroke-width="6" stroke-linejoin="round"/>
      <rect x="118" y="396" width="22" height="9" fill="${C.yellow}" stroke="${C.ink}" stroke-width="3"/><rect x="260" y="396" width="22" height="9" fill="${C.yellow}" stroke="${C.ink}" stroke-width="3"/>`,
    lapels: (c) => `<path d="M118 312 L156 312 L140 358 L142 416 L118 416 Z" fill="#24124a" stroke="${C.ink}" stroke-width="6" stroke-linejoin="round"/>
      <path d="M282 312 L244 312 L260 358 L258 416 L282 416 Z" fill="#24124a" stroke="${C.ink}" stroke-width="6" stroke-linejoin="round"/>
      <path d="M156 314 L140 358 M244 314 L260 358" stroke="${c}" stroke-width="6" stroke-linecap="round"/>`,
  };
  const OF_BACK = {
    cape: (c) => `<path d="M128 318 Q84 380 90 446 L310 446 Q316 380 272 318 Z" fill="${c}" stroke="${C.ink}" stroke-width="8" stroke-linejoin="round"/>`,
  };
  const OUTFITS = {
    none: {},
    mechanic: { hat: "capBack", torso: "overalls", color: "#ff7a1a", torsoColor: "#2f5d8a" },
    racing: { hat: "goggles", neck: "scarf", torso: "racesuit", color: "red" },
    pitcrew: { hat: "headset", torso: "vest", color: "red" },
    star: { eyes: "shades", neck: "chain", torso: "lapels", color: "pink" },
    reader: { eyes: "readers", color: "yellow" },
    party: { hat: "partyHat", neck: "bowtie", color: "green", neckColor: "pink" },
    royal: { hat: "crown", neck: "collar", back: "cape", color: "red" },
  };
  K.OUTFITS = Object.keys(OUTFITS);
  const ofPart = (lib, v, c, id, nm) => (v == null ? "" : lib[v] ? lib[v](col(c), id, nm) : String(v)); // unknown name = raw SVG
  K.outfit = function (id, spec, opts) {
    opts = opts || {};
    const svg = document.getElementById(id), head = document.getElementById(id + "-head"), body = document.getElementById(id + "-body"), all = document.getElementById(id + "-all");
    if (!svg || !head || !body || !all) return;
    const name = typeof spec === "string" ? spec : opts.name || "custom";
    if (!opts.add) svg.querySelectorAll(".k-of").forEach((n) => n.remove());
    if (name === "none" || svg.querySelector(".k-of-" + name)) return;
    const o = typeof spec === "string" ? OUTFITS[spec] || {} : spec;
    const c = opts.color || o.color || "red";
    const ns = "http://www.w3.org/2000/svg";
    const layer = (slot, html, parent, before) => {
      if (!html) return;
      const g = document.createElementNS(ns, "g");
      g.setAttribute("class", `k-of k-of-${name} k-of-${slot}`);
      if (opts.hidden) g.style.opacity = "0";
      g.innerHTML = html;
      parent.insertBefore(g, before);
    };
    const hat = o.hat == null ? {} : OF_HAT[o.hat] ? OF_HAT[o.hat](col(c)) : { f: String(o.hat) };
    const shirt = document.getElementById(id + "-shirt") || body.querySelectorAll(":scope > rect")[1];
    layer("back", ofPart(OF_BACK, o.back, o.backColor || c, id, name), all, all.firstChild);            // behind everything
    layer("torso", ofPart(OF_TORSO, o.torso, o.torsoColor || c, id, name), body, shirt ? shirt.nextSibling : body.firstChild); // under the badge
    layer("neck", ofPart(OF_NECK, o.neck, o.neckColor || c, id, name), all, document.getElementById(id + "-armL")); // under the chin, over the head's shadow
    layer("hatb", hat.b, head, head.firstChild);                                                          // behind antenna + head box
    layer("hatf", hat.f, head, document.getElementById(id + "-eyes"));                                    // on the head's top edge
    layer("eyes", ofPart(OF_EYES, o.eyes, o.eyesColor || c, id, name), head, document.getElementById(id + "-sweat")); // over the LED face
  };
  K.outfitSwap = function (tl, id, spec, at, opts) {
    const name = typeof spec === "string" ? spec : (opts && opts.name) || "custom";
    K.outfit(id, spec, Object.assign({}, opts, { add: true, hidden: true }));
    tl.set("#" + id + " .k-of", { opacity: 0 }, at);
    if (name === "none") return;
    tl.set("#" + id + " .k-of-" + name, { opacity: 1, scale: 1.3, transformOrigin: "50% 50%" }, at);
    tl.to("#" + id + " .k-of-" + name, { scale: 1, duration: 0.28, ease: "back.out(2.5)" }, at + 0.001);
  };

  K.rig = function (id) {
    const g = (s) => document.getElementById(id + "-" + s);
    if (window.gsap) {
      gsap.set(g("armL"), { svgOrigin: "124 340" });
      gsap.set(g("armR"), { svgOrigin: "276 340" });
      gsap.set(g("head"), { svgOrigin: "200 300" });
      gsap.set(g("all"), { svgOrigin: "200 468" });
      gsap.set(g("eyes"), { svgOrigin: "200 190" });
      gsap.set(g("body"), { svgOrigin: "200 416" });
    }
    return { root: "#" + id, all: "#" + id + "-all", head: "#" + id + "-head", armL: "#" + id + "-armL", armR: "#" + id + "-armR", body: "#" + id + "-body", eyes: "#" + id + "-eyes", bulb: "#" + id + "-bulb" };
  };

  K.face = function (tl, id, expr, at) {
    const e = EXPR[expr] || EXPR.idle;
    Object.keys(EYES).forEach((k) => tl.set("#" + id + "-e-" + k, { opacity: k === e[0] ? 1 : 0 }, at));
    Object.keys(MOUTH).forEach((k) => tl.set("#" + id + "-m-" + k, { opacity: k === e[1] ? 1 : 0 }, at));
    tl.set("#" + id + "-tears", { opacity: expr === "cry" ? 1 : 0 }, at);
  };
  K.blink = function (tl, id, at) {
    tl.set("#" + id + "-eyes", { scaleY: 0.12 }, at);
    tl.set("#" + id + "-eyes", { scaleY: 1 }, at + 0.1);
  };
  K.talk = function (tl, id, times, hold) {
    times.forEach((t, i) => {
      const next = times[i + 1] != null ? times[i + 1] : t + 0.3;
      const h = Math.min(hold || 0.16, Math.max(0.06, (next - t) * 0.6));
      tl.set("#" + id + "-talk", { opacity: 1 }, t);
      tl.set("#" + id + "-talk", { opacity: 0 }, t + h);
    });
  };
  /* opts.pop=false sets the badge silently (use it to establish state at a frame's start). */
  K.badge = function (tl, id, which, at, opts) {
    tl.set("#" + id + "-badge-ai", { opacity: which === "si" ? 0 : 1 }, at);
    tl.set("#" + id + "-badge-si", { opacity: which === "si" ? 1 : 0 }, at);
    if (which === "si" && !(opts && opts.pop === false)) { tl.set("#" + id + "-badge-si", { scale: 1.8, svgOrigin: "200 361" }, at); tl.to("#" + id + "-badge-si", { scale: 1, duration: 0.3, ease: "back.out(2.5)" }, at + 0.001); }
  };
  const POSES = {
    down: [0, 0], wave: [0, -112], hype: [96, -96], shrug: [50, -50], point: [0, -62], raise: [0, -108], hip: [-30, 30], think: [0, -128], cover: [142, -142], flex: [80, -80], cheer: [118, -118],
  };
  K.pose = function (tl, id, pose, at, dur) {
    const p = POSES[pose] || POSES.down;
    tl.to("#" + id + "-armL", { rotation: p[0], duration: dur == null ? 0.22 : dur, ease: "back.out(2)" }, at);
    tl.to("#" + id + "-armR", { rotation: p[1], duration: dur == null ? 0.22 : dur, ease: "back.out(2)" }, at);
  };
  /* wave: oscillate right arm between two angles for n beats */
  K.wave = function (tl, id, times) {
    times.forEach((t, i) => tl.to("#" + id + "-armR", { rotation: i % 2 ? -125 : -92, duration: 0.18, ease: "sine.inOut" }, t));
  };
  K.groove = function (tl, id, times, amt) {
    const a = amt || 1;
    times.forEach((t, i) => {
      tl.set("#" + id + "-all", { scaleY: 1 - 0.045 * a, scaleX: 1 + 0.03 * a }, t);
      tl.to("#" + id + "-all", { scaleY: 1, scaleX: 1, duration: 0.28, ease: "back.out(3)" }, t + 0.001);
      tl.to("#" + id + "-head", { rotation: (i % 2 ? -6 : 6) * a, duration: 0.2, ease: "power2.out" }, t);
    });
  };
  K.sweat = function (tl, id, at, on) {
    if (on === false) { tl.set("#" + id + "-sweat", { opacity: 0 }, at); return; }
    tl.set("#" + id + "-sweat", { opacity: 1, y: -10 }, at);
    tl.to("#" + id + "-sweat", { y: 22, duration: 0.7, ease: "power1.in" }, at + 0.001);
    tl.set("#" + id + "-sweat", { opacity: 0, y: 0 }, at + 0.75);
  };
  K.tears = function (tl, id, at, on) { tl.set("#" + id + "-tears", { opacity: on === false ? 0 : 1 }, at); };

  /* ==========================================================================
     LE CHONK — Mistral's 1-trillion-param big boy. viewBox 0 0 600 620.
     KIT.chonk({ id, size:620, sash:"LE CHONK", horn:true })
     Pivots after KIT.chonkRig(id): all (feet), armL, armR (horn hand), eyes.
     KIT.chonkHonk(tl, id, at) squeezes the horn bulb + pops "HONK!" text.
     ========================================================================== */
  K.chonk = function (o) {
    const id = o.id, size = o.size || 620;
    return `<svg id="${id}" class="k-chonk ${o.cls || ""}" viewBox="0 0 600 620" width="${size}" height="${Math.round(size * 620 / 600)}" style="overflow:visible;${o.style || ""}">
  <g id="${id}-all">
    <rect x="168" y="556" width="70" height="44" fill="${C.ink}"/><rect x="362" y="556" width="70" height="44" fill="${C.ink}"/>
    <rect x="76" y="132" width="480" height="444" fill="${C.ink}"/>
    <rect x="60" y="116" width="480" height="444" fill="${C.cream}" stroke="${C.ink}" stroke-width="12"/>
    <g fill="${C.yellow}" stroke="${C.ink}" stroke-width="6">
      <rect x="88" y="476" width="34" height="34"/><rect x="122" y="476" width="34" height="34" fill="#ff8a3d"/><rect x="88" y="442" width="34" height="34" fill="#ff8a3d"/>
      <rect x="478" y="476" width="34" height="34"/><rect x="444" y="476" width="34" height="34" fill="#ff8a3d"/><rect x="478" y="442" width="34" height="34" fill="#ff8a3d"/>
    </g>
    <g id="${id}-eyes">
      <circle cx="228" cy="256" r="58" fill="${C.paper}" stroke="${C.ink}" stroke-width="10"/><circle id="${id}-pupilL" cx="242" cy="266" r="24" fill="${C.ink}"/>
      <circle cx="372" cy="256" r="58" fill="${C.paper}" stroke="${C.ink}" stroke-width="10"/><circle id="${id}-pupilR" cx="386" cy="266" r="24" fill="${C.ink}"/>
    </g>
    <path d="M300 336 C262 312 214 318 196 352 C214 340 250 340 300 360 C350 340 386 340 404 352 C386 318 338 312 300 336 Z" fill="${C.ink}"/>
    <rect x="262" y="384" width="76" height="16" fill="${C.ink}"/>
    <g id="${id}-sash"><path d="M60 196 L540 470 L540 540 L60 266 Z" fill="${C.pink}" stroke="${C.ink}" stroke-width="9"/>
      <text x="300" y="380" text-anchor="middle" font-family="${C.font}" font-weight="900" font-size="54" letter-spacing="-1" transform="rotate(29.7 300 368)">${o.sash || "LE CHONK"}</text></g>
    <g id="${id}-beret"><ellipse cx="250" cy="118" rx="200" ry="52" fill="${C.ink}" transform="rotate(-8 250 118)"/><rect x="240" y="44" width="22" height="36" fill="${C.ink}" transform="rotate(-8 250 118)"/></g>
    <g id="${id}-armL"><rect x="0" y="300" width="72" height="44" fill="${C.cream}" stroke="${C.ink}" stroke-width="10"/><circle cx="0" cy="322" r="34" fill="${C.cream}" stroke="${C.ink}" stroke-width="10"/></g>
    <g id="${id}-armR"><rect x="528" y="300" width="72" height="44" fill="${C.cream}" stroke="${C.ink}" stroke-width="10"/>
      ${o.horn === false ? `<circle cx="600" cy="322" r="34" fill="${C.cream}" stroke="#000" stroke-width="10"/>` : `
      <g id="${id}-horn"><path d="M596 300 L700 250 L700 394 L596 344 Z" fill="${C.yellow}" stroke="#000" stroke-width="10" stroke-linejoin="round"/>
      <circle id="${id}-bulb" cx="582" cy="322" r="44" fill="${C.red}" stroke="#000" stroke-width="10"/></g>`}
    </g>
    <g id="${id}-honk" opacity="0"><text x="760" y="250" font-family="${C.font}" font-weight="900" font-size="120" fill="${C.paper}" stroke="${C.ink}" stroke-width="14" paint-order="stroke" transform="rotate(-12 760 250)">HONK!</text></g>
  </g>
</svg>`;
  };
  K.chonkRig = function (id) {
    const g = (s) => document.getElementById(id + "-" + s);
    if (window.gsap) {
      gsap.set(g("all"), { svgOrigin: "300 600" });
      gsap.set(g("armL"), { svgOrigin: "72 322" });
      gsap.set(g("armR"), { svgOrigin: "528 322" });
      if (g("bulb")) gsap.set(g("bulb"), { svgOrigin: "582 322" });
      gsap.set(g("beret"), { svgOrigin: "250 140" });
    }
    return { root: "#" + id, all: "#" + id + "-all", armL: "#" + id + "-armL", armR: "#" + id + "-armR", beret: "#" + id + "-beret", honk: "#" + id + "-honk" };
  };
  K.chonkHonk = function (tl, id, at) {
    tl.set("#" + id + "-bulb", { scaleX: 0.55, scaleY: 1.25 }, at);
    tl.to("#" + id + "-bulb", { scaleX: 1, scaleY: 1, duration: 0.3, ease: "elastic.out(1,0.4)" }, at + 0.001);
    tl.set("#" + id + "-honk", { opacity: 1, scale: 0.4, svgOrigin: "760 220" }, at);
    tl.to("#" + id + "-honk", { scale: 1, duration: 0.25, ease: "back.out(3)" }, at + 0.001);
    tl.to("#" + id + "-honk", { opacity: 0, duration: 0.15 }, at + 0.5);
  };

  /* Standalone bulb-horn prop (for "honk honk" gags without Chonk). viewBox 0 0 260 160 */
  K.horn = function (o) {
    return `<svg id="${o.id}" viewBox="-10 -10 280 180" width="${o.size || 260}" height="${Math.round((o.size || 260) * 180 / 280)}" style="overflow:visible;${o.style || ""}">
      <path d="M96 52 L250 0 L250 160 L96 108 Z" fill="${C.yellow}" stroke="${C.ink}" stroke-width="10" stroke-linejoin="round"/>
      <circle id="${o.id}-bulb" cx="62" cy="80" r="58" fill="${C.red}" stroke="${C.ink}" stroke-width="10"/></svg>`;
  };

  window.KIT = K;
})();
