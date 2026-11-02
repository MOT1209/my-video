import { lookup as dnsLookup } from "node:dns/promises";
import { isIP } from "node:net";
import { UserFacingError } from "./user-facing-error";

/**
 * جلب صفحة عامة من رابط يرسله المستخدم بلا SSRF.
 *
 * الحمايات:
 * - http/https فقط، بلا بيانات اعتماد داخل الرابط، وبالمنافذ الافتراضية فقط.
 * - حلّ DNS لكل العناوين ورفض أي عنوان خاص/محلي/link-local/metadata
 *   (IPv4 و IPv6 وصيغة ‎::ffff:‎ المضمّنة).
 * - إعادة التوجيه يدوياً مع إعادة الفحص في كل قفزة (حد 3).
 * - مهلة إجمالية وحد حجم بالقراءة المتدفقة وفحص نوع المحتوى.
 *
 * حد معروف: بين فحص DNS والاتصال يمكن نظرياً تغيير السجل (DNS rebinding)؛
 * المهلة القصيرة وفحص كل قفزة يضيّقان النافذة. الحل الكامل يحتاج تثبيت
 * العنوان في الاتصال (undici Agent بـ lookup مخصص).
 */

export type LookupFn = (
  hostname: string,
) => Promise<Array<{ address: string; family: number }>>;

export type FetchLike = (url: string, init?: RequestInit) => Promise<Response>;

export interface SafeFetchOptions {
  fetchImpl?: FetchLike;
  lookup?: LookupFn;
  timeoutMs?: number;
  maxBytes?: number;
  maxRedirects?: number;
  userAgent?: string;
}

const DEFAULT_TIMEOUT_MS = 10_000;
const DEFAULT_MAX_BYTES = 2 * 1024 * 1024;
const DEFAULT_MAX_REDIRECTS = 3;

const defaultLookup: LookupFn = (hostname) =>
  dnsLookup(hostname, { all: true, verbatim: true });

const BLOCKED_URL_MESSAGE =
  "لا يمكن جلب هذا الرابط: يُقبل رابط http(s) عام فقط.";
const FETCH_FAILED_MESSAGE =
  "تعذّر جلب المقال من الرابط. تأكد أنه صفحة عامة تفتح في المتصفح ثم أعد المحاولة.";

function ipv4ToInt(ip: string): number {
  return (
    ip.split(".").reduce((acc, part) => (acc << 8) + Number(part), 0) >>> 0
  );
}

const BLOCKED_V4: Array<[string, number]> = [
  ["0.0.0.0", 8], // "هذا الجهاز"
  ["10.0.0.0", 8], // خاص
  ["100.64.0.0", 10], // CGNAT
  ["127.0.0.0", 8], // loopback
  ["169.254.0.0", 16], // link-local + metadata السحابية
  ["172.16.0.0", 12], // خاص
  ["192.0.0.0", 24], // IETF
  ["192.0.2.0", 24], // توثيق
  ["192.168.0.0", 16], // خاص
  ["198.18.0.0", 15], // اختبار أداء
  ["198.51.100.0", 24], // توثيق
  ["203.0.113.0", 24], // توثيق
  ["224.0.0.0", 4], // multicast
  ["240.0.0.0", 4], // محجوز + broadcast
];

function isBlockedIPv4(ip: string): boolean {
  const value = ipv4ToInt(ip);
  return BLOCKED_V4.some(([base, bits]) => {
    const mask = bits === 0 ? 0 : (~0 << (32 - bits)) >>> 0;
    return (value & mask) === (ipv4ToInt(base) & mask);
  });
}

/** يوسّع IPv6 إلى 8 مجموعات رقمية (يدعم :: والذيل IPv4). */
function expandIPv6(ip: string): number[] | null {
  let address = ip.toLowerCase().split("%")[0];
  const v4Tail = address.match(/(\d+\.\d+\.\d+\.\d+)$/);
  if (v4Tail) {
    const n = ipv4ToInt(v4Tail[1]);
    address = address.replace(
      v4Tail[1],
      `${(n >>> 16).toString(16)}:${(n & 0xffff).toString(16)}`,
    );
  }
  const [head, tail] = address.split("::");
  const headParts = head ? head.split(":") : [];
  const tailParts = tail !== undefined && tail !== "" ? tail.split(":") : [];
  const missing = 8 - headParts.length - tailParts.length;
  if (address.includes("::") ? missing < 1 : missing !== 0) {
    return null;
  }
  const groups = [
    ...headParts,
    ...Array(address.includes("::") ? missing : 0).fill("0"),
    ...tailParts,
  ].map((g) => parseInt(g, 16));
  return groups.length === 8 && groups.every((g) => Number.isFinite(g))
    ? groups
    : null;
}

function isBlockedIPv6(ip: string): boolean {
  const g = expandIPv6(ip);
  if (!g) {
    return true; // صيغة غير مفهومة ⇒ رفض
  }
  const allZeroPrefix = g.slice(0, 5).every((x) => x === 0);
  // ‎::ffff:a.b.c.d‎ (IPv4 مضمّن) و ‎::a.b.c.d‎ (متوافق قديم) ⇒ افحص الـ IPv4
  if (allZeroPrefix && (g[5] === 0xffff || g[5] === 0)) {
    if (g[5] === 0 && g[6] === 0 && (g[7] === 0 || g[7] === 1)) {
      return true; // :: و ::1
    }
    const v4 = `${g[6] >> 8}.${g[6] & 0xff}.${g[7] >> 8}.${g[7] & 0xff}`;
    return isBlockedIPv4(v4);
  }
  // NAT64 المعروف ‎64:ff9b::/96‎ ⇒ افحص الـ IPv4 المضمّن
  if (g[0] === 0x64 && g[1] === 0xff9b && g.slice(2, 6).every((x) => x === 0)) {
    const v4 = `${g[6] >> 8}.${g[6] & 0xff}.${g[7] >> 8}.${g[7] & 0xff}`;
    return isBlockedIPv4(v4);
  }
  const first = g[0];
  return (
    (first & 0xfe00) === 0xfc00 || // fc00::/7 عناوين محلية فريدة
    (first & 0xffc0) === 0xfe80 || // fe80::/10 link-local
    (first & 0xffc0) === 0xfec0 || // fec0::/10 site-local (مهمل)
    (first & 0xff00) === 0xff00 || // multicast
    (first === 0x2001 && g[1] === 0x0db8) || // توثيق
    first === 0x2002 // 6to4 قد يضمّن IPv4 خاصاً
  );
}

/** هل العنوان (IPv4/IPv6) غير مسموح بالاتصال به من الخادم؟ */
export function isBlockedAddress(address: string): boolean {
  const family = isIP(address);
  if (family === 4) {
    return isBlockedIPv4(address);
  }
  if (family === 6) {
    return isBlockedIPv6(address);
  }
  return true;
}

/** يتحقق من شكل الرابط ثم من كل عناوين مضيفه. يرمي UserFacingError عند الرفض. */
export async function assertPublicUrl(
  rawUrl: string,
  lookup: LookupFn = defaultLookup,
): Promise<URL> {
  let url: URL;
  try {
    url = new URL(rawUrl);
  } catch {
    throw new UserFacingError(BLOCKED_URL_MESSAGE);
  }
  if (url.protocol !== "http:" && url.protocol !== "https:") {
    throw new UserFacingError(BLOCKED_URL_MESSAGE);
  }
  if (url.username || url.password) {
    throw new UserFacingError(BLOCKED_URL_MESSAGE);
  }
  // منافذ غير قياسية = غالباً خدمات داخلية/مسح منافذ
  if (url.port && url.port !== "80" && url.port !== "443") {
    throw new UserFacingError(BLOCKED_URL_MESSAGE);
  }
  const hostname = url.hostname.replace(/^\[|\]$/g, "");
  if (
    !hostname ||
    hostname === "localhost" ||
    hostname.endsWith(".localhost")
  ) {
    throw new UserFacingError(BLOCKED_URL_MESSAGE);
  }

  let addresses: Array<{ address: string }>;
  if (isIP(hostname)) {
    addresses = [{ address: hostname }];
  } else {
    try {
      addresses = await lookup(hostname);
    } catch {
      throw new UserFacingError(FETCH_FAILED_MESSAGE);
    }
  }
  if (
    addresses.length === 0 ||
    addresses.some((a) => isBlockedAddress(a.address))
  ) {
    throw new UserFacingError(BLOCKED_URL_MESSAGE);
  }
  return url;
}

async function readCapped(
  response: Response,
  maxBytes: number,
): Promise<string> {
  const declared = Number(response.headers.get("content-length") ?? "0");
  if (declared > maxBytes) {
    throw new UserFacingError("صفحة المقال أكبر من المسموح.");
  }
  if (!response.body) {
    return "";
  }
  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) {
      break;
    }
    total += value.byteLength;
    if (total > maxBytes) {
      await reader.cancel().catch(() => {});
      throw new UserFacingError("صفحة المقال أكبر من المسموح.");
    }
    chunks.push(value);
  }
  return new TextDecoder().decode(Buffer.concat(chunks));
}

/**
 * يجلب نص صفحة عامة (HTML/نص) مع كل حمايات SSRF أعلاه.
 * الأخطاء كلها UserFacingError برسائل عامة (لا رموز حالة ولا تفاصيل شبكة
 * داخلية تساعد على مسح المنافذ).
 */
export async function fetchPublicText(
  rawUrl: string,
  options: SafeFetchOptions = {},
): Promise<string> {
  const fetchImpl = options.fetchImpl ?? fetch;
  const lookup = options.lookup ?? defaultLookup;
  const maxRedirects = options.maxRedirects ?? DEFAULT_MAX_REDIRECTS;
  const signal = AbortSignal.timeout(options.timeoutMs ?? DEFAULT_TIMEOUT_MS);

  let current = rawUrl;
  for (let hop = 0; hop <= maxRedirects; hop += 1) {
    const url = await assertPublicUrl(current, lookup);
    let response: Response;
    try {
      response = await fetchImpl(url.toString(), {
        redirect: "manual",
        signal,
        headers: {
          "user-agent":
            options.userAgent ?? "Mozilla/5.0 (compatible; my-video-bot/0.1)",
          accept: "text/html,application/xhtml+xml,text/plain;q=0.9",
        },
      });
    } catch (err) {
      console.warn("safe-fetch: فشل الطلب", (err as Error)?.message);
      throw new UserFacingError(FETCH_FAILED_MESSAGE);
    }

    if (response.status >= 300 && response.status < 400) {
      const location = response.headers.get("location");
      await response.body?.cancel().catch(() => {});
      if (!location) {
        throw new UserFacingError(FETCH_FAILED_MESSAGE);
      }
      current = new URL(location, url).toString();
      continue;
    }
    if (!response.ok) {
      await response.body?.cancel().catch(() => {});
      throw new UserFacingError(FETCH_FAILED_MESSAGE);
    }
    const contentType = (
      response.headers.get("content-type") ?? ""
    ).toLowerCase();
    if (
      contentType &&
      !contentType.startsWith("text/") &&
      !contentType.includes("html") &&
      !contentType.includes("xml")
    ) {
      await response.body?.cancel().catch(() => {});
      throw new UserFacingError("الرابط لا يشير إلى صفحة مقال (HTML).");
    }
    return readCapped(response, options.maxBytes ?? DEFAULT_MAX_BYTES);
  }
  throw new UserFacingError(FETCH_FAILED_MESSAGE);
}
