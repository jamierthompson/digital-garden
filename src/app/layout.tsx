import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import Link from "next/link";
import "./foundation.css";
import "./globals.css";
import styles from "./layout.module.css";

// The shell's own faces — the only fonts preloaded on every route (D11).
// Per-project faces load on demand via the Phase 1 roster with preload: false.
const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
  preload: true,
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
  preload: true,
});

export const metadata: Metadata = {
  title: "Portfolio",
  description: "Personal portfolio and digital garden.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`${geistSans.variable} ${geistMono.variable}`}>
      <body>
        <header className={styles.header}>
          <nav className={styles.nav} aria-label="Primary">
            <Link href="/" className={styles.brand}>
              Portfolio
            </Link>
            {/* Skeleton — real /work, /about, /now routes land in Phase 3. */}
            <ul className={styles.links}>
              <li>Work</li>
              <li>About</li>
              <li>Now</li>
            </ul>
          </nav>
        </header>
        {children}
      </body>
    </html>
  );
}
