import type { Metadata, Viewport } from "next";
import { Dela_Gothic_One, Instrument_Sans, Martian_Mono } from "next/font/google";
import "./globals.css";
import { Nav } from "@/components/Nav";
import { Footer } from "@/components/Footer";
import { Providers } from "@/components/web3/Providers";

// latin only, swap so text paints immediately; all three render above the fold on every page, so all are preloaded.
const display = Dela_Gothic_One({ weight: "400", subsets: ["latin"], display: "swap", variable: "--f-display" });
const body = Instrument_Sans({ subsets: ["latin"], display: "swap", variable: "--f-body" });
const mono = Martian_Mono({ subsets: ["latin"], display: "swap", variable: "--f-mono" });

const SITE = "https://catapacks.xyz";
const title = "Cata — pull something real.";
const description = "the vault where every card on earth lives. rip it. flip it. bet on it. borrow on it. ship it.";

export const metadata: Metadata = {
  metadataBase: new URL(SITE),
  title: { default: title, template: "%s · Cata" },
  description,
  applicationName: "Cata",
  alternates: { canonical: "/" },
  openGraph: { type: "website", url: SITE, siteName: "Cata", title, description, locale: "en_US" },
  twitter: { card: "summary_large_image", title, description },
  appleWebApp: { title: "Cata", statusBarStyle: "default" },
  formatDetection: { telephone: false },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#F5EDE0",
  colorScheme: "light",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className={`${display.variable} ${body.variable} ${mono.variable}`}>
      <body className="min-h-dvh">
        <Providers>
          <a href="#main" className="skip-link">skip to content</a>
          <Nav />
          <main id="main" className="overflow-x-clip">{children}</main>
          <Footer />
        </Providers>
      </body>
    </html>
  );
}
