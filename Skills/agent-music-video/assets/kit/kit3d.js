/* ==========================================================================
   agent-music-video — 3D kit (ES module). Import from a frame's module script:
     import * as K3 from "./assets/kit/kit3d.js";
     const { THREE } = K3;
   Look: neobrutalist toon — flat pastel faces, one darker side tone, thick
   black outlines (inverted hull), optional hard black "offset shadow" copy.
   All animation must be driven from your GSAP timeline time (KIT.onFrame).
   ========================================================================== */
import * as THREE from "../vendor/three.module.min.js";
export { THREE };

export const COLORS = {
  black: 0x000000, white: 0xffffff, off: 0xfffdf5, pink: 0xfe90e8, blue: 0xc0f7fe, green: 0x99e885,
  yellow: 0xf7cb46, cream: 0xffdc8b, red: 0xff5a4e, claude: 0xe8825f, screen: 0x15151a, orange: 0xff8a3d,
};
const c = (x) => (typeof x === "string" ? COLORS[x] ?? new THREE.Color(x).getHex() : x);

export function rng(seed) {
  let a = (seed >>> 0) || 1;
  return () => { a |= 0; a = (a + 0x6d2b79f5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}

/* ---------- renderer / scene ---------- */
export function setup(canvas, o = {}) {
  const w = o.w || canvas.width || 1920, h = o.h || canvas.height || 1080;
  const renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: true, preserveDrawingBuffer: true });
  // Follow the render's device pixel ratio: 1 for 1080p, 2 for a 4K render (--resolution landscape-4k),
  // so the 3D layer is drawn at full output resolution instead of being upscaled. Deterministic per render.
  renderer.setPixelRatio(o.pixelRatio ?? Math.min(2, window.devicePixelRatio || 1));
  renderer.setSize(w, h, false);
  renderer.setClearColor(0x000000, 0);
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(o.fov || 30, w / h, 0.1, 200);
  const cp = o.cam || [0, 0, 22];
  camera.position.set(cp[0], cp[1], cp[2]);
  camera.lookAt(0, 0, 0);
  lights(scene, o);
  return { renderer, scene, camera, render: () => renderer.render(scene, camera) };
}

export function lights(scene, o = {}) {
  const amb = new THREE.AmbientLight(0xffffff, o.ambient ?? 1.15);
  const key = new THREE.DirectionalLight(0xffffff, o.key ?? 1.9);
  key.position.set(-4, 7, 9);
  scene.add(amb, key);
  return { amb, key };
}

let _grad = null;
function gradientMap() {
  if (_grad) return _grad;
  const d = new Uint8Array([185, 185, 185, 255, 255, 255, 255, 255]);
  _grad = new THREE.DataTexture(d, 2, 1, THREE.RGBAFormat);
  _grad.minFilter = _grad.magFilter = THREE.NearestFilter;
  _grad.needsUpdate = true;
  return _grad;
}
export function toon(color, o = {}) {
  return new THREE.MeshToonMaterial({ color: c(color), gradientMap: gradientMap(), transparent: !!o.transparent, opacity: o.opacity ?? 1 });
}
export function flat(color) { return new THREE.MeshBasicMaterial({ color: c(color) }); }

/* ---------- outlines (inverted hull with averaged normals — no gaps on hard edges) ---------- */
const HULL_V = `attribute vec3 hullNormal; uniform float thickness;
void main(){ vec3 p = position + hullNormal * thickness; gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.0); }`;
const HULL_F = `uniform vec3 color; uniform float opacity; void main(){ gl_FragColor = vec4(color, opacity); }`;
function addHullNormals(geo, flatZ) {
  const pos = geo.attributes.position, map = new Map(), n = new THREE.Vector3();
  if (!geo.attributes.normal) geo.computeVertexNormals();
  const nor = geo.attributes.normal;
  const key = (i) => `${pos.getX(i).toFixed(3)},${pos.getY(i).toFixed(3)},${pos.getZ(i).toFixed(3)}`;
  for (let i = 0; i < pos.count; i++) {
    const k = key(i); let v = map.get(k); if (!v) { v = new THREE.Vector3(); map.set(k, v); }
    v.add(n.set(nor.getX(i), nor.getY(i), nor.getZ(i)));
  }
  const arr = new Float32Array(pos.count * 3);
  for (let i = 0; i < pos.count; i++) {
    const v = map.get(key(i)).clone();
    if (flatZ) {
      // flat (extruded text) mode: grow only in XY, and pull the hull slightly INSIDE the depth so its
      // caps always sit behind the letter's front/back faces — only the rim can show (no cracks/spikes).
      const len = Math.hypot(v.x, v.y);
      const z = pos.getZ(i);
      arr[i * 3] = len > 1e-4 ? v.x / len : 0; arr[i * 3 + 1] = len > 1e-4 ? v.y / len : 0;
      arr[i * 3 + 2] = z > 1e-4 ? -0.35 : z < -1e-4 ? 0.35 : 0;
    } else {
      v.normalize(); arr[i * 3] = v.x; arr[i * 3 + 1] = v.y; arr[i * 3 + 2] = v.z;
    }
  }
  geo.setAttribute("hullNormal", new THREE.BufferAttribute(arr, 3));
}
export function outline(mesh, thickness = 0.06, color = 0x000000, flatZ = false) {
  const geo = mesh.geometry.clone();
  addHullNormals(geo, flatZ);
  const mat = new THREE.ShaderMaterial({ vertexShader: HULL_V, fragmentShader: HULL_F, side: THREE.BackSide,
    uniforms: { thickness: { value: thickness }, color: { value: new THREE.Color(color) }, opacity: { value: 1 } } });
  const hull = new THREE.Mesh(geo, mat);
  hull.name = "outline";
  mesh.add(hull);
  return hull;
}
/* Solid mesh + outline in one call */
export function solid(geo, color, o = {}) {
  const m = new THREE.Mesh(geo, o.basic ? flat(color) : toon(color));
  if (o.outline !== false && o.outline !== 0) outline(m, o.outline ?? 0.06, 0x000000, !!o.flatOutline);
  return m;
}
/* Black offset "hard shadow" copy of an object (place it as a sibling, behind). */
export function shadowOf(obj, o = {}) {
  const g = obj.clone(true);
  const black = new THREE.MeshBasicMaterial({ color: 0x000000 });
  g.traverse((m) => { if (m.isMesh) { if (m.name === "outline") m.visible = false; else m.material = black; } });
  g.position.add(new THREE.Vector3(o.dx ?? 0.28, o.dy ?? -0.28, o.dz ?? -0.5));
  return g;
}

/* ---------- 3D text from Inter Black glyphs (window.KIT_GLYPHS, assets/kit/glyphs.js) ---------- */
function glyphShapes(ch, scale) {
  const G = window.KIT_GLYPHS, g = G && G.glyphs[ch];
  if (!g || !g.cmds.length) return [];
  const contours = []; let path = null;
  for (const k of g.cmds) {
    if (k.t === "M") { path = new THREE.Path(); path.moveTo(k.x * scale, -k.y * scale); contours.push(path); }
    else if (k.t === "L") path.lineTo(k.x * scale, -k.y * scale);
    else if (k.t === "Q") path.quadraticCurveTo(k.x1 * scale, -k.y1 * scale, k.x * scale, -k.y * scale);
    else if (k.t === "C") path.bezierCurveTo(k.x1 * scale, -k.y1 * scale, k.x2 * scale, -k.y2 * scale, k.x * scale, -k.y * scale);
  }
  const clean = (pts) => { const out = []; for (const q of pts) { const l = out[out.length - 1]; if (!l || Math.hypot(l.x - q.x, l.y - q.y) > 1e-4) out.push(q); } if (out.length > 2 && Math.hypot(out[0].x - out[out.length - 1].x, out[0].y - out[out.length - 1].y) < 1e-4) out.pop(); return out; };
  const info = contours.map((p) => { const pts = clean(p.getPoints(8)); return { p, pts, area: THREE.ShapeUtils.area(pts) }; }).filter((x) => x.pts.length > 2);
  const big = info.reduce((a, b) => (Math.abs(b.area) > Math.abs(a.area) ? b : a), info[0]);
  const outerSign = Math.sign(big.area);
  const outers = info.filter((x) => Math.sign(x.area) === outerSign).map((x) => ({ ...x, shape: new THREE.Shape(x.pts) }));
  const holes = info.filter((x) => Math.sign(x.area) !== outerSign);
  const inside = (pt, poly) => { let r = false; for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) { const a = poly[i], b = poly[j]; if ((a.y > pt.y) !== (b.y > pt.y) && pt.x < ((b.x - a.x) * (pt.y - a.y)) / (b.y - a.y) + a.x) r = !r; } return r; };
  for (const h of holes) {
    const host = outers.filter((o) => inside(h.pts[0], o.pts)).sort((a, b) => Math.abs(a.area) - Math.abs(b.area))[0] || outers[0];
    host.shape.holes.push(new THREE.Path(h.pts));
  }
  return outers.map((o) => o.shape);
}
/* text3d("S.I.", { size: 4, depth: 1.2, color: "yellow", colors:[...per letter], outline: 0.08, tracking: -0.02, align: "center" })
   -> { group, letters: [{ obj, ch, x, w }], width, height }  (each letter is its own Group, pivot at its visual center) */
export function text3d(str, o = {}) {
  const G = window.KIT_GLYPHS, size = o.size || 3, scale = size / G.capHeight, depth = o.depth ?? size * 0.32;
  const group = new THREE.Group(), letters = [];
  let x = 0;
  const track = (o.tracking ?? -0.02) * G.unitsPerEm * scale;
  [...str].forEach((ch, i) => {
    const g = G.glyphs[ch] || G.glyphs[ch.toUpperCase()];
    if (!g) return;
    const shapes = glyphShapes(G.glyphs[ch] ? ch : ch.toUpperCase(), scale);
    const adv = g.adv * scale;
    if (shapes.length) {
      const geo = new THREE.ExtrudeGeometry(shapes, { depth, bevelEnabled: o.bevel !== false, bevelThickness: depth * 0.08, bevelSize: size * 0.015, bevelSegments: 1, curveSegments: 6 });
      geo.computeBoundingBox();
      const bb = geo.boundingBox, cx = (bb.min.x + bb.max.x) / 2, cy = (bb.min.y + bb.max.y) / 2;
      geo.translate(-cx, -cy, -depth / 2);
      const color = (o.colors && o.colors[i % o.colors.length]) || o.color || "white";
      const mesh = solid(geo, color, { outline: o.outline ?? size * 0.03, flatOutline: true });
      const holder = new THREE.Group();
      holder.add(mesh);
      holder.position.set(x + cx, cy, 0);
      holder.userData = { ch, home: holder.position.clone() };
      group.add(holder);
      letters.push({ obj: holder, mesh, ch, x: x + cx, w: bb.max.x - bb.min.x });
    }
    x += adv + track;
  });
  const width = x - track;
  if ((o.align || "center") === "center") group.children.forEach((h) => { h.position.x -= width / 2; h.userData.home.x -= width / 2; });
  group.children.forEach((h) => { h.position.y -= size / 2; h.userData.home.y -= size / 2; });
  return { group, letters, width, height: size };
}

/* ---------- simple props ---------- */
export function box(w, h, d, color, o = {}) { return solid(new THREE.BoxGeometry(w, h, d), color, o); }
export function cyl(rTop, rBot, h, color, o = {}) { return solid(new THREE.CylinderGeometry(rTop, rBot, h, o.seg || 32), color, o); }
export function sphere(r, color, o = {}) { return solid(new THREE.SphereGeometry(r, o.seg || 32, o.seg2 || 20), color, o); }
/* A coin (e.g. the dime): cylinder lying facing camera, with a raised rim. */
export function coin(r, color = "yellow", o = {}) {
  const g = new THREE.Group();
  const body = solid(new THREE.CylinderGeometry(r, r, r * 0.16, 48), color, { outline: o.outline ?? r * 0.04 });
  body.rotation.x = Math.PI / 2; g.add(body);
  const rim = new THREE.Mesh(new THREE.TorusGeometry(r * 0.86, r * 0.05, 8, 48), flat(0x000000));
  rim.position.z = r * 0.085; g.add(rim);
  return g;
}

/* ==========================================================================
   CLAWD — Claude Code's little orange mascot, as an animated toon voxel figure.
   const cl = K3.clawd({ scale: 1 });  scene.add(cl.group);
   cl.animate(t, { walk: 0|1, bounce: 0..1, blink: [t1,t2..], wave: 0..1, look: -1..1, beat: [local beat times], hop: 0..1 })
   Units: body is 5.6 wide x 3.5 tall (top at y≈4.55); feet at y=0, so place group.position.y at floor level.
   ========================================================================== */
export function clawd(o = {}) {
  const S = o.scale || 1, col = o.color || "claude";
  const group = new THREE.Group(), rig = new THREE.Group();
  group.add(rig); group.scale.setScalar(S);
  const body = box(5.6, 3.5, 2.6, col, { outline: 0.16 }); body.position.y = 2.8; rig.add(body);
  const eyes = new THREE.Group(); eyes.position.set(0, 3.3, 1.31); rig.add(eyes);
  const eyeL = new THREE.Mesh(new THREE.BoxGeometry(0.6, 1.1, 0.08), flat(0x000000)); eyeL.position.x = -1.2;
  const eyeR = eyeL.clone(); eyeR.position.x = 1.2; eyes.add(eyeL, eyeR);
  const armL = new THREE.Group(); armL.position.set(-2.8, 2.6, 0); rig.add(armL);
  const aL = box(1.1, 0.95, 1.6, col, { outline: 0.13 }); aL.position.x = -0.5; armL.add(aL);
  const armR = new THREE.Group(); armR.position.set(2.8, 2.6, 0); rig.add(armR);
  const aR = box(1.1, 0.95, 1.6, col, { outline: 0.13 }); aR.position.x = 0.5; armR.add(aR);
  const legs = [-2.05, -0.95, 0.95, 2.05].map((x) => { const l = box(0.62, 1.05, 0.9, col, { outline: 0.12 }); l.position.set(x, 0.52, 0); rig.add(l); return l; });
  function animate(t, a = {}) {
    // walk cycle: alternate leg pairs
    const w = a.walk || 0, ph = t * 9;
    legs.forEach((l, i) => { const s = Math.sin(ph + (i % 2 ? Math.PI : 0)); l.position.y = 0.52 + Math.max(0, s) * 0.35 * w; });
    // beat bounce: squash on each beat time
    let sq = 0;
    if (a.beat) for (const b of a.beat) { const d = t - b; if (d >= 0 && d < 0.3) sq = Math.max(sq, (1 - d / 0.3)); }
    const hop = a.hop ? Math.abs(Math.sin(t * Math.PI * (a.hopRate || 3.4))) * a.hop : 0;
    rig.position.y = hop * 1.2 + (w ? Math.abs(Math.sin(ph)) * 0.18 : 0);
    rig.scale.set(1 + sq * 0.08 * (a.bounce ?? 1), 1 - sq * 0.1 * (a.bounce ?? 1), 1);
    // arms
    const wave = a.wave || 0;
    armR.rotation.z = wave * (0.9 + Math.sin(t * 14) * 0.45);
    armL.rotation.z = -(a.waveL || 0) * (0.9 + Math.sin(t * 14 + 1) * 0.45);
    // look + blink
    eyes.position.x = (a.look || 0) * 0.6;
    let bl = 1; if (a.blink) for (const b of a.blink) if (t >= b && t < b + 0.12) bl = 0.12;
    eyes.scale.y = bl * (a.squint ? 0.45 : 1);
    group.rotation.y = a.turn || 0;
  }
  animate(0);
  return { group, rig, body, eyes, armL, armR, legs, animate };
}
