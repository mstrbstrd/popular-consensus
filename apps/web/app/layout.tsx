import type { Metadata } from "next";
import logoMark from "../src/logo2026_nobackground.png";
import "./globals.css";

export const metadata: Metadata = {
  title: "Popular Consensus MVP",
  description: "Civic signal protocol demo",
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
