import type { Metadata } from "next";
import logoMark from "../src/logo2026_nobackground.png";
import "./globals.css";

export const metadata: Metadata = {
  title: "Popular Consensus",
  description: "Ask clear questions, gather private votes, and share public answers.",
  icons: {
    icon: logoMark.src,
    apple: logoMark.src
  }
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
