import type { Metadata } from "next";
import { Fraunces, Karla } from "next/font/google";
import Script from "next/script";

import "./globals.css";
import { TopNav } from "@/components/TopNav";
import { getSessionUser } from "@/lib/auth";

/**
 * Fraunces for headings — a warm serif with real character, so an idea looks *written*
 * rather than filed. Karla for interface and body: humanist, friendly, and not one of
 * the four sans-serifs every product on the internet already uses.
 */
const fraunces = Fraunces({
  subsets: ["latin"],
  variable: "--font-fraunces",
  axes: ["SOFT", "WONK", "opsz"],
  display: "swap",
});

const karla = Karla({
  subsets: ["latin"],
  variable: "--font-karla",
  display: "swap",
});

export const metadata: Metadata = {
  title: "ExpressU — say the idea",
  description:
    "A place for young people to share any idea, dream, or thing they've made. No comments, no ranking, no verdicts. Just being heard.",
};

/**
 * Applies the saved theme before first paint so a dark-mode user never gets a white
 * flash. Runs from localStorage; falls through to the system preference when unset.
 */
const THEME_BOOTSTRAP = `
try {
  var t = localStorage.getItem('expressu-theme');
  if (t === 'dark' || t === 'light') document.documentElement.dataset.theme = t;
} catch (e) {}
`;

export default async function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const user = await getSessionUser();

  return (
    // suppressHydrationWarning is correct here rather than a cover-up: the bootstrap
    // script below deliberately stamps `data-theme` before React hydrates, so the client
    // html element legitimately differs from the server's. It applies to this element's
    // attributes only, not to anything inside the page.
    <html
      lang="en"
      className={`${fraunces.variable} ${karla.variable}`}
      suppressHydrationWarning
    >
      <head>
        {/*
          next/script, not a raw <script> tag: a plain <script> only ever works here
          because Next statically injects it into the first HTML response. The moment
          anything makes React reconcile the root layout on the client — Fast Refresh
          during development is the usual culprit — React refuses to execute a raw
          script it's asked to render and logs "Encountered a script tag while
          rendering React component". beforeInteractive is next/script's actual,
          supported mechanism for code that must run before hydration.
        */}
        <Script id="theme-bootstrap" strategy="beforeInteractive">
          {THEME_BOOTSTRAP}
        </Script>
      </head>
      <body>
        <a href="#main" className="eu-skip-link">
          Skip to content
        </a>
        <TopNav user={user} />
        <main id="main">{children}</main>
      </body>
    </html>
  );
}
