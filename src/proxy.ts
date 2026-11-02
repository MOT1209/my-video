import { clerkMiddleware } from "@clerk/nextjs/server";
import {
  NextResponse,
  type NextFetchEvent,
  type NextMiddleware,
  type NextRequest,
} from "next/server";
import { isAuthConfigured } from "./lib/auth";

/**
 * طبقة Clerk على مستوى الطلب (اصطلاح Next 16: ‎`proxy.ts`‎).
 *
 * `auth()` في المسارات يتطلب تشغيل `clerkMiddleware()` قبلها، وإلا يرمي
 * خطأ ويتحول كل مسار محمي إلى 500 لحظة إضافة مفاتيح Clerk.
 *
 * لا نحمي مسارات هنا (الحماية في كل مسار عبر `guardPaidRoute`/`requireSession`)
 * — الطبقة فقط تجعل الجلسة مقروءة. بلا مفاتيح (تطوير محلي) تمرّ الطلبات كما هي.
 */
let clerkHandler: NextMiddleware | null = null;

export default function proxy(req: NextRequest, event: NextFetchEvent) {
  if (!isAuthConfigured()) {
    return NextResponse.next();
  }
  clerkHandler ??= clerkMiddleware() as NextMiddleware;
  return clerkHandler(req, event);
}

export const config = {
  matcher: [
    // كل الصفحات عدا ملفات Next الداخلية والملفات الثابتة
    "/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest|mp4|mp3|wav)).*)",
    // كل مسارات الـ API دائماً
    "/(api|trpc)(.*)",
  ],
};
