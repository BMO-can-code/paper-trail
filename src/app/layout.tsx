import type { Metadata } from "next";
import { Geist, Geist_Mono, Instrument_Serif } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

const instrument = Instrument_Serif({
  variable: "--font-instrument",
  weight: "400",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Paper Trail — research that shows its receipts",
  description:
    "A Nemotron research agent on Nebius Token Factory that rejects any claim it cannot back with a verbatim quote from a stored source.",
  openGraph: {
    title: "Paper Trail — research that shows its receipts",
    description:
      "Every claim quote-checked. Every source stored. Full tool trace on screen.",
    type: "website",
  },
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body
        className={`${geistSans.variable} ${geistMono.variable} ${instrument.variable} antialiased`}
      >
        <div className="relative z-10">{children}</div>
      </body>
    </html>
  );
}
