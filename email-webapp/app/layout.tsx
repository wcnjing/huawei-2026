import type { Metadata } from "next";
import { IBM_Plex_Mono } from "next/font/google";

const mono = IBM_Plex_Mono({
  weight: ["400", "500", "600", "700"],
  subsets: ["latin"],
  variable: "--font-mono",
});

export const metadata: Metadata = {
  title: "ScamShield — Cybersecurity Training",
  description: "Behavioural phishing awareness training.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body
        className={`${mono.variable} font-mono text-ink bg-base min-h-screen`}
      >
        {children}
      </body>
    </html>
  );
}
