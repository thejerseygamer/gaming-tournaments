import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import Navbar from "./components/Navbar";
import Footer from "./components/Footer";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: {
    default: "BattleGrid | Gaming Tournaments",
    template: "%s | BattleGrid",
  },
  description:
    "BattleGrid is a competitive gaming tournament hub for hosting events, joining brackets, submitting scores, tracking records, and climbing leaderboards.",
  keywords: [
    "BattleGrid",
    "gaming tournaments",
    "Madden tournaments",
    "esports",
    "brackets",
    "leaderboard",
    "score tracking",
  ],
  authors: [
    {
      name: "BattleGrid",
    },
  ],
  creator: "BattleGrid",
  openGraph: {
    title: "BattleGrid | Gaming Tournaments",
    description:
      "Join tournaments, track brackets, submit scores, and climb the BattleGrid leaderboard.",
    siteName: "BattleGrid",
    type: "website",
  },
};

export const viewport: Viewport = {
  themeColor: "#000000",
  colorScheme: "dark",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body
        className={`${geistSans.variable} ${geistMono.variable} min-h-screen bg-black text-white antialiased`}
      >
        <Navbar />

        <div>{children}</div>

        <Footer />
      </body>
    </html>
  );
}