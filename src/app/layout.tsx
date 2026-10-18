import type { Metadata } from "next";
// @ts-ignore Next.js processes this global stylesheet import.
import "./globals.css";

export const metadata: Metadata = {
  title: "ইকরা মেধাবৃত্তি ২০২৬",
  description: "রামু ইকরা মডেল একাডেমি মেধাবৃত্তি পরীক্ষার অনলাইন আবেদন",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="bn">
      <body>{children}</body>
    </html>
  );
}
