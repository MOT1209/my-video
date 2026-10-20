import { Metadata, Viewport } from "next";
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

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="ar">
      <body className="bg-background text-foreground">{children}</body>
    </html>
  );
}
