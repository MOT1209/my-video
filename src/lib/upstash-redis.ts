import { Redis } from "@upstash/redis";

/**
 * عميل Upstash Redis مشترك (REST) — مُهيكل مرة واحدة عند أول استعمال.
 * يُعيد null إن لم تكن المفاتيح مهيأة (تطوير محلي غالباً)، ويبقى
 * استدعاؤه آمناً — الطبقات فوقه تتضمن سقوطاً محلياً خاصاً بها.
 */
let client: Redis | null | undefined;

export function getUpstashRedis(): Redis | null {
  if (client === undefined) {
    const url = process.env.UPSTASH_REDIS_REST_URL;
    const token = process.env.UPSTASH_REDIS_REST_TOKEN;
    client = url && token ? new Redis({ url, token }) : null;
  }
  return client;
}

/** للاختبار فقط — يُفرش الكاش كي يُعاد البناء بعد تغيير مفاتيح البيئة. */
export function resetUpstashRedisForTests(): void {
  client = undefined;
}
