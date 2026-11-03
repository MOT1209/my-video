import { ClerkProvider } from "@clerk/nextjs";
import { Metadata, Viewport } from "next";
import type { ReactNode } from "react";
import "../../styles/global.css";

export const metadata: Metadata = {
  title: "my-video | مولّد فيديوهات Shorts عمودية",
  description:
    "حوّل نصاً قصيراً إلى فيديو Shorts عمودي 9:16 بتعليق صوتي وكابشن يتحرك كلمة بكلمة.",
  openGraph: {
    title: "my-video | مولّد فيديوهات Shorts عمودية",
    description:
      "حوّل نصاً قصيراً إلى فيديو Shorts عمودي 9:16 بتعليق صوتي وكابشن يتحرك كلمة بكلمة.",
    type: "website",
    locale: "ar",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
};

const clerkEnabled = Boolean(
  process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY && process.env.CLERK_SECRET_KEY,
);

export default function RootLayout({
  children,
}: {
  children: ReactNode;
}) {
  const page = (
    <html lang="ar">
      <body className="bg-background text-foreground">
        {clerkEnabled ? <ClerkProvider>{children}</ClerkProvider> : children}
      </body>
    </html>
  );
  // بلا مفاتيح Clerk (تطوير محلي) لا مزوّد — المزوّد يرمي عند غياب المفتاح العام.
  // مع المفاتيح يجب أن يلفّ التطبيق كله حتى تتجدد جلسة المحرّر وطلبات الـ API.
  return clerkEnabled ? <ClerkProvider>{page}</ClerkProvider> : page;
}
