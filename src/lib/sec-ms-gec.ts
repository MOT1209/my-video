/**
 * توليد توكن Sec-MS-GEC بصيغة v2 الذي تشترطه Microsoft لخدمة Edge TTS.
 *
 * نقل حرفي لخوارزمية مكتبة edge-tts الرسمية (rany2/edge-tts, وحدة drm.py):
 * SHA-256 مخصص (حالة أولية وثوابت معدلة) + دالة CS64، بالناتج "<16 hex>-<64 hex>".
 * كل العمليات على أعداد صحيحة 32-بت بدون إشارة (مطابق لـ & 0xFFFFFFFF في بايثون).
 */

const WIN_EPOCH = 11644473600;

const SHA256_INITIAL = [
  0x6a09e667, 0xbb67ae85, 0x3c6ef372, 0xa54ff53a,
  0x510e527f, 0x9b05688c, 0x1f83d9ab, 0x5be0cd19,
];

const SHA256_STATE = [
  0xfd9fbea2, 0x91243ce7, 0xbe499094, 0x0cd2e1e0a,
  0x6c006f49, 0x04bd35ab, 0xfeb0a7e4, 0x03effbd2,
];

const SHA256_SCHEDULE = [
  0xeb24bf9e, 0x1558691f, 0xa0c09ee2, 0x0cfa32ba,
  0xa622ee8c, 0xd1dd9491, 0xc0dd25a0, 0xf9e70ab6,
  0xf0c31573, 0x7058ce4e, 0x7188e606, 0x00e5ab33,
  0xd258b060, 0x72766564,
];

const SHA256_ROUND_CONSTANTS = [
  0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1,
  0x923f82a4, 0xab1c5ed5, 0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3,
  0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174, 0xe49b69c1, 0xefbe4786,
  0x0fc19dc6, 0x240ca1cc, 0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da,
  0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7, 0xc6e00bf3, 0xd5a79147,
  0x06ca6351, 0x14292967, 0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13,
  0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85, 0xa2bfe8a1, 0xa81a664b,
  0xc24b8b70, 0xc76c51a3, 0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070,
  0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a,
  0x5b9cca4f, 0x682e6ff3, 0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208,
  0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2,
];

const SHA256_ADJUSTMENT = 0xc9dc06a7;
const SHA256_BLOCK_CONSTANTS = [
  ...SHA256_ROUND_CONSTANTS.slice(0, 14),
  SHA256_ADJUSTMENT,
  ...SHA256_ROUND_CONSTANTS.slice(15),
];
const SHA256_SIGMA0_ADJUSTMENT = 0x059c0b80;
const SHA256_SIGMA1_ADJUSTMENT = 0x000b92c0;

const CS64_COEFFICIENTS: Array<[number, number]> = [
  [0xe82e91b1, 0xb32700d0], [0x44de24c6, 0x88dff51d],
  [0x3beb65bc, 0x29514038], [0xc89c5933, 0xb328cbdf],
  [0x8d1ec211, 0x0d405b4d5], [0x314ef5d5, 0x26e55f3c],
  [0xe92491b1, 0x607801c6], [0xf0a5b9d5, 0x82b2c1fb],
  [0x06064cf3, 0xfa51a3da], [0xda79fa60, 0x207cc464],
  [0xbed20560, 0x3c3c74f3], [0x89f9c9f8, 0xd2d14b61],
  [0x35fa38c6, 0xbb04a2c1], [0xcb49e3c6, 0xc5626167],
];
const CS64_FACTOR = 0x82893933;
const CS64_ADJUSTMENT0 = 0xf2f90b1a;
const CS64_ADJUSTMENT1 = 0x0b1a0000;

type U8 = [
  number, number, number, number, number, number, number, number,
];

const u32 = (n: number): number => n >>> 0;
const rotr = (x: number, n: number): number => u32((x >>> n) | (x << (32 - n)));
const rol16 = (value: number): number => u32((value << 16) | (value >>> 16));
const mul32 = (a: number, b: number): number => u32(Math.imul(a, b));

function wordsLe4Even(data: Uint8Array): number[] {
  const padLen = (((-data.length) % 4) + 4) % 4;
  const padded = new Uint8Array(data.length + padLen);
  padded.set(data);
  const view = new DataView(padded.buffer);
  const words: number[] = [];
  for (let i = 0; i < padded.length; i += 4) {
    words.push(view.getUint32(i, true));
  }
  if (words.length % 2 === 1) {
    words.push(0);
  }
  return words;
}

function sigma0(value: number): number {
  return u32(
    (value >>> 7) ^ (value << 25) ^ (value >>> 18) ^ (value << 14) ^ (value >>> 3),
  );
}

function sigma1(value: number): number {
  return u32(
    (value >>> 17) ^ (value << 15) ^ (value >>> 19) ^ (value << 13) ^ (value >>> 10),
  );
}

function sum32(...parts: number[]): number {
  let s = 0;
  for (const p of parts) {
    s += u32(p);
  }
  return u32(s);
}

function sha256Rounds(state: number[], words: number[], firstRound = 0): U8 {
  let a = u32(state[0] as number);
  let b = u32(state[1] as number);
  let c = u32(state[2] as number);
  let d = u32(state[3] as number);
  let e = u32(state[4] as number);
  let f = u32(state[5] as number);
  let g = u32(state[6] as number);
  let h = u32(state[7] as number);
  const constants =
    firstRound === 14 ? SHA256_BLOCK_CONSTANTS : SHA256_ROUND_CONSTANTS;
  // e * 0x100000001 يكرر الكلمة في 64 بت؛ الإزاحة اليمنى تعطي ROTR في الـ 32 بت الدنيا.
  const aligned = Math.min(64, Math.floor((firstRound + 7) / 8) * 8);
  for (let index = firstRound; index < aligned; index++) {
    const t1 = sum32(
      h,
      rotr(e, 6) ^ rotr(e, 11) ^ rotr(e, 25),
      g ^ (e & (f ^ g)),
      constants[index] as number,
      words[index] as number,
    );
    const t2 = sum32(
      rotr(a, 2) ^ rotr(a, 13) ^ rotr(a, 22),
      (a & b) | (c & (a | b)),
    );
    const na = sum32(t1, t2);
    const ne = sum32(d, t1);
    const nb = a;
    const nc = b;
    const nd = c;
    const nf = e;
    const ng = f;
    const nh = g;
    a = na;
    b = nb;
    c = nc;
    d = nd;
    e = ne;
    f = nf;
    g = ng;
    h = nh;
  }
  // ثماني جولات تعيد الترتيب الأصلي؛ ندوّر الأدوار بدل نقل القيم (مطابق للأصل).
  for (let index = aligned; index < 64; index += 8) {
    let t1 = sum32(
      h,
      rotr(e, 6) ^ rotr(e, 11) ^ rotr(e, 25),
      g ^ (e & (f ^ g)),
      constants[index] as number,
      words[index] as number,
    );
    d = sum32(d, t1);
    h = sum32(
      t1,
      rotr(a, 2) ^ rotr(a, 13) ^ rotr(a, 22),
      (a & b) | (c & (a | b)),
    );
    t1 = sum32(
      g,
      rotr(d, 6) ^ rotr(d, 11) ^ rotr(d, 25),
      f ^ (d & (e ^ f)),
      constants[index + 1] as number,
      words[index + 1] as number,
    );
    c = sum32(c, t1);
    g = sum32(
      t1,
      rotr(h, 2) ^ rotr(h, 13) ^ rotr(h, 22),
      (h & a) | (b & (h | a)),
    );
    t1 = sum32(
      f,
      rotr(c, 6) ^ rotr(c, 11) ^ rotr(c, 25),
      e ^ (c & (d ^ e)),
      constants[index + 2] as number,
      words[index + 2] as number,
    );
    b = sum32(b, t1);
    f = sum32(
      t1,
      rotr(g, 2) ^ rotr(g, 13) ^ rotr(g, 22),
      (g & h) | (a & (g | h)),
    );
    t1 = sum32(
      e,
      rotr(b, 6) ^ rotr(b, 11) ^ rotr(b, 25),
      d ^ (b & (c ^ d)),
      constants[index + 3] as number,
      words[index + 3] as number,
    );
    a = sum32(a, t1);
    e = sum32(
      t1,
      rotr(f, 2) ^ rotr(f, 13) ^ rotr(f, 22),
      (f & g) | (h & (f | g)),
    );
    t1 = sum32(
      d,
      rotr(a, 6) ^ rotr(a, 11) ^ rotr(a, 25),
      c ^ (a & (b ^ c)),
      constants[index + 4] as number,
      words[index + 4] as number,
    );
    h = sum32(h, t1);
    d = sum32(
      t1,
      rotr(e, 2) ^ rotr(e, 13) ^ rotr(e, 22),
      (e & f) | (g & (e | f)),
    );
    t1 = sum32(
      c,
      rotr(h, 6) ^ rotr(h, 11) ^ rotr(h, 25),
      b ^ (h & (a ^ b)),
      constants[index + 5] as number,
      words[index + 5] as number,
    );
    g = sum32(g, t1);
    c = sum32(
      t1,
      rotr(d, 2) ^ rotr(d, 13) ^ rotr(d, 22),
      (d & e) | (f & (d | e)),
    );
    t1 = sum32(
      b,
      rotr(g, 6) ^ rotr(g, 11) ^ rotr(g, 25),
      a ^ (g & (h ^ a)),
      constants[index + 6] as number,
      words[index + 6] as number,
    );
    f = sum32(f, t1);
    b = sum32(
      t1,
      rotr(c, 2) ^ rotr(c, 13) ^ rotr(c, 22),
      (c & d) | (e & (c | d)),
    );
    t1 = sum32(
      a,
      rotr(f, 6) ^ rotr(f, 11) ^ rotr(f, 25),
      h ^ (f & (g ^ h)),
      constants[index + 7] as number,
      words[index + 7] as number,
    );
    e = sum32(e, t1);
    a = sum32(
      t1,
      rotr(b, 2) ^ rotr(b, 13) ^ rotr(b, 22),
      (b & c) | (d & (b | c)),
    );
  }
  return [a, b, c, d, e, f, g, h];
}

function expandSha256Schedule(words: number[], firstWord = 16): void {
  for (let index = firstWord; index < 64; index++) {
    const x = words[index - 2] as number;
    const y = words[index - 15] as number;
    const s1 = u32(
      (x >>> 17) ^ (x << 15) ^ (x >>> 19) ^ (x << 13) ^ (x >>> 10),
    );
    const s0 = u32(
      (y >>> 7) ^ (y << 25) ^ (y >>> 18) ^ (y << 14) ^ (y >>> 3),
    );
    words.push(
      sum32(s1, words[index - 7] as number, s0, words[index - 16] as number),
    );
  }
}

function sha256Init(data: Uint8Array): U8 {
  const words: number[] = new Array<number>(14).fill(0);
  words.push(
    u32((data[0] as number) * 65536 + (data[1] as number) * 256 + (data[2] as number)),
    u32(
      (data[3] as number) * 16777216 +
        (data[4] as number) * 65536 +
        (data[5] as number) * 256 +
        (data[6] as number),
    ),
  );
  for (let index = 16; index < 30; index++) {
    let value = SHA256_SCHEDULE[index - 16] as number;
    if (index - 2 >= 14) {
      value +=
        index === 16
          ? u32(sigma1(words[index - 2] as number) ^ SHA256_SIGMA1_ADJUSTMENT)
          : sigma1(words[index - 2] as number);
    }
    if (index - 7 >= 14) {
      value += words[index - 7] as number;
    }
    if (index - 15 >= 14) {
      value +=
        index === 29
          ? u32(sigma0(words[index - 15] as number) ^ SHA256_SIGMA0_ADJUSTMENT)
          : sigma0(words[index - 15] as number);
    }
    words.push(u32(value));
  }
  words.push(
    u32(
      sigma1(words[28] as number) +
        (words[23] as number) +
        sigma0(words[15] as number) +
        (words[14] as number) +
        SHA256_ADJUSTMENT -
        (SHA256_ROUND_CONSTANTS[14] as number),
    ),
  );
  expandSha256Schedule(words, 31);
  const working = sha256Rounds(SHA256_STATE, words, 14);
  const out = SHA256_INITIAL.map((v, i) => u32(v + (working[i] as number)));
  return out as U8;
}

function sha256Digest(data: Uint8Array): Uint8Array {
  if (data.length < 7) {
    throw new Error("Token salt must contain at least seven bytes");
  }
  const length = 57 + data.length;
  const zeroCount = (((55 - length) % 64) + 64) % 64;
  const padded = new Uint8Array(data.length - 7 + 1 + zeroCount + 8);
  padded.set(data.subarray(7), 0);
  padded[data.length - 7] = 0x80;
  const bitLen = length * 8;
  const hi = Math.floor(bitLen / 4294967296);
  const lo = u32(bitLen);
  const o = padded.length - 8;
  padded[o] = u32(hi >>> 24);
  padded[o + 1] = u32((hi >>> 16) & 0xff);
  padded[o + 2] = u32((hi >>> 8) & 0xff);
  padded[o + 3] = u32(hi & 0xff);
  padded[o + 4] = u32(lo >>> 24);
  padded[o + 5] = u32((lo >>> 16) & 0xff);
  padded[o + 6] = u32((lo >>> 8) & 0xff);
  padded[o + 7] = u32(lo & 0xff);
  let state = sha256Init(data.subarray(0, 7));
  const view = new DataView(padded.buffer);
  for (let offset = 0; offset < padded.length; offset += 64) {
    const words: number[] = [];
    for (let i = 0; i < 16; i++) {
      words.push(view.getUint32(offset + i * 4, false));
    }
    expandSha256Schedule(words);
    const working = sha256Rounds(state, words);
    state = state.map((v, i) => u32(v + (working[i] as number))) as U8;
  }
  const out = new Uint8Array(32);
  const outView = new DataView(out.buffer);
  state.forEach((v, i) => outView.setUint32(i * 4, v, false));
  return out;
}

function cs64Digest(data: Uint8Array, digest: Uint8Array): [number, number] {
  const view = new DataView(digest.buffer);
  let keyA = u32(view.getUint32(0, true) | 1);
  let keyB = u32(view.getUint32(4, true) | 1);
  const factors = [mul32(keyA, CS64_FACTOR), mul32(keyB, CS64_FACTOR)];
  const terms: number[] = CS64_COEFFICIENTS.map(([coefficient], index) =>
    mul32(coefficient, factors[index % 2] as number),
  );
  const offsets: number[] = CS64_COEFFICIENTS.map(([, offset]) => offset);
  const prefixed = new Uint8Array(data.length + 1);
  prefixed[0] = 0;
  prefixed.set(data, 1);
  wordsLe4Even(prefixed).forEach((word, index) => {
    let term = mul32(word, index % 2 === 0 ? keyA : keyB);
    let offset = mul32(
      rol16(word),
      index % 2 === 0 ? 0xef0569fb : 0xc31713db,
    );
    if (index === 0) {
      term = u32(term + mul32(CS64_ADJUSTMENT0, factors[0] as number));
      offset = u32(offset + CS64_ADJUSTMENT1);
    }
    terms.push(term);
    offsets.push(offset);
  });
  let swapAcc = 0;
  let swapLast = 0;
  let state = 0;
  let acc = 0;
  for (let index = 0; index < terms.length; index += 2) {
    const x = terms[index] as number;
    const y = terms[index + 1] as number;
    let t = rol16(u32((offsets[index] as number) + x));
    let q = mul32(t, 0x76f50f34);
    swapAcc = u32(swapAcc + u32(mul32(rol16(q), 0xc3efea97) + q));
    t = rol16(u32((offsets[index + 1] as number) + y));
    q = mul32(t, 0x1881ce3c);
    swapLast = u32(mul32(rol16(q), 0x35bd1ec9) + q);
    swapAcc = u32(swapAcc + swapLast);

    state = u32(mul32(state, keyA) + x);
    state = mul32(rol16(state), 0xcf98b111);
    state = mul32(rol16(state), 0x87085b9f);
    state = mul32(rol16(state), 0x12ceb96d);
    state = mul32(rol16(state), 0x257e1d83);
    acc = u32(acc + state);
    t = u32(mul32(state, keyB) + y);
    t = mul32(rol16(t), 0xa27416f5);
    t = mul32(rol16(t), 0xd38396ff);
    state = mul32(rol16(mul32(rol16(t), 0x7c932b89)), 0xbfa49f69);
    acc = u32(acc + state);
  }
  return [u32(swapLast ^ state), u32(swapAcc ^ acc)];
}

function bytesToHexUpper(bytes: Uint8Array): string {
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("")
    .toUpperCase();
}

function tokenHash(data: Uint8Array): [string, string] {
  const digest = sha256Digest(data);
  const [w0, w1] = cs64Digest(data, digest);
  const le = new Uint8Array(8);
  const leView = new DataView(le.buffer);
  leView.setUint32(0, w0 as number, true);
  leView.setUint32(4, w1 as number, true);
  return [bytesToHexUpper(le), bytesToHexUpper(digest)];
}

/**
 * يولد توكن Sec-MS-GEC بصيغة v2 ("<16 hex>-<64 hex>").
 * يقبل طابعاً زمنياً ثابتاً للاختبار (مطابق لمعامل unix_timestamp في الأصل).
 */
export function generateSecMsGecV2(
  trustedClientToken: string,
  unixTimestamp?: number,
): string {
  let ticks = unixTimestamp ?? Date.now() / 1000;
  ticks += WIN_EPOCH;
  ticks -= ticks % 300;
  ticks *= 1e9 / 100;
  const ascii = `${ticks.toFixed(0)}${trustedClientToken}`;
  const data = new Uint8Array(ascii.length);
  for (let i = 0; i < ascii.length; i++) {
    data[i] = ascii.charCodeAt(i);
  }
  const [cs64, sha256] = tokenHash(data);
  return `${cs64}-${sha256}`;
}
