import type { Metadata, Viewport } from "next";
import { Inter, Noto_Sans_KR } from "next/font/google";
import { RegisterSW } from "@/components/RegisterSW";
import "./globals.css";

const inter = Inter({ subsets: ["latin"], variable: "--font-inter", display: "swap" });
// Inter has no Hangul, so Korean titles and channel names fall back to Noto Sans KR.
const notoKr = Noto_Sans_KR({ subsets: ["latin"], weight: ["400", "500", "600", "700"], variable: "--font-noto-kr", display: "swap", preload: false });

export const metadata: Metadata = {
  title: "FocusTube",
  description: "Watch YouTube on your terms: your topics, your daily time limit.",
  applicationName: "FocusTube",
  appleWebApp: { capable: true, title: "FocusTube", statusBarStyle: "default" },
  icons: { icon: "/icon-192.png", apple: "/apple-touch-icon.png" },
  // Next only emits mobile-web-app-capable; iOS before 16.4 needs the apple- one to open without Safari's address bar.
  other: { "apple-mobile-web-app-capable": "yes" },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#ffffff" },
    { media: "(prefers-color-scheme: dark)", color: "#09090b" },
  ],
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${inter.variable} ${notoKr.variable}`}>
      <head>
        {/* eslint-disable-next-line @next/next/no-page-custom-font */}
        <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Material+Symbols+Rounded:opsz,wght,FILL,GRAD@20..48,200,0..1,0&display=block" />
      </head>
      <body>{children}<RegisterSW /></body>
    </html>
  );
}
