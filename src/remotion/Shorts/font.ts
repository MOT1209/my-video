import { fontFamily, loadFont } from "@remotion/google-fonts/NotoKufiArabic";

loadFont("normal", {
  subsets: ["arabic", "latin"],
  weights: ["400", "700"],
});

export const shortFontFamily = fontFamily;
