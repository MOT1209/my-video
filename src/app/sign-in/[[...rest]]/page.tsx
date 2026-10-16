import { ClerkProvider, SignIn } from "@clerk/nextjs";

/**
 * صفحة تسجيل الدخول (Clerk).
 * بلا مفاتيح Clerk تُعرض رسالة إرشادية بدل كسر الصفحة — فالمشروع يبقى
 * قابلاً للتشغيل الكامل محلياً وقبل تسجيل الحسابات.
 */
const clerkEnabled = Boolean(
  process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY && process.env.CLERK_SECRET_KEY,
);

export default function SignInPage() {
  if (!clerkEnabled) {
    return (
      <div className="mx-auto max-w-xl p-8" dir="rtl">
        <h1 className="text-lg font-medium">تسجيل الدخول غير مُهيأ</h1>
        <p className="text-sm opacity-70 mt-2">
          أضف <code>NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY</code> و{" "}
          <code>CLERK_SECRET_KEY</code> إلى متغيرات البيئة ثم أعد النشر لتفعيل
          الحسابات وحفظ المشاريع في السحابة.
        </p>
      </div>
    );
  }

  return (
    <ClerkProvider>
      <div className="flex min-h-screen items-center justify-center" dir="ltr">
        <SignIn />
      </div>
    </ClerkProvider>
  );
}
