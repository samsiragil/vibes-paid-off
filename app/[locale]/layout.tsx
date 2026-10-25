import type { Metadata } from "next";
import { Gochi_Hand, Source_Sans_3 } from "next/font/google";
import { notFound } from "next/navigation";
import Script from "next/script";
import { locale as rootLocale } from "next/root-params";
import { hasLocale, NextIntlClientProvider } from "next-intl";
import { getTranslations } from "next-intl/server";
import { routing } from "@/i18n/routing";
import { SiteHeader } from "@/components/layout/site-header";
import { ThemeProvider } from "@/components/providers/theme-provider";
import { ogLocale } from "@/lib/seo";
import { siteUrl } from "@/lib/site";
import "../globals.css";

// One face for all UI, headings and body text (same family as the logo wordmark).
const sourceSans = Source_Sans_3({
  variable: "--font-source-sans",
  subsets: ["latin"],
  weight: ["400", "600", "700"],
});

// Handwriting is only for short margin notes, never the largest text: no preload, so it does not
// compete with the fonts of the LCP element on slow connections.
const gochiHand = Gochi_Hand({
  variable: "--font-gochi-hand",
  subsets: ["latin"],
  weight: "400",
  display: "swap",
  preload: false,
});

/** Cloudflare Web Analytics (cookieless). Empty token = no beacon, e.g. locally and in previews. */
const analyticsToken = process.env.NEXT_PUBLIC_CF_ANALYTICS_TOKEN;

export function generateStaticParams() {
  return routing.locales.map((locale) => ({ locale }));
}

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("meta");
  const locale = await rootLocale();
  return {
    metadataBase: new URL(siteUrl),
    title: { default: t("title"), template: `%s · ${t("title")}` },
    description: t("description"),
    // Pages that set their own openGraph replace this object, so they repeat siteName and locale.
    openGraph: { type: "website", siteName: t("title"), locale: ogLocale(locale) },
  };
}

export default async function LocaleLayout({ children }: LayoutProps<"/[locale]">) {
  const locale = await rootLocale();
  if (!hasLocale(routing.locales, locale)) notFound();
  const t = await getTranslations("nav");

  return (
    <html
      lang={locale}
      suppressHydrationWarning
      className={`${sourceSans.variable} ${gochiHand.variable} h-full antialiased`}
    >
      <body className="flex min-h-full flex-col">
        <ThemeProvider>
          <NextIntlClientProvider>
            <a
              href="#konten"
              className="sr-only rounded-full bg-ink text-sm font-medium whitespace-nowrap text-bg focus:not-sr-only focus:absolute focus:top-3 focus:left-3 focus:z-50 focus:px-4 focus:py-2.5"
            >
              {t("skipToContent")}
            </a>
            <SiteHeader />
            <div id="konten" tabIndex={-1} className="flex grow flex-col outline-none">
              {children}
            </div>
          </NextIntlClientProvider>
        </ThemeProvider>
        {analyticsToken ? (
          <Script
            src="https://static.cloudflareinsights.com/beacon.min.js"
            data-cf-beacon={JSON.stringify({ token: analyticsToken, spa: true })}
            strategy="lazyOnload"
          />
        ) : null}
      </body>
    </html>
  );
}
