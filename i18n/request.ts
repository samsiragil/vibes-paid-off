import { hasLocale } from "next-intl";
import { getRequestConfig } from "next-intl/server";
import { locale as rootLocale } from "next/root-params";
import { routing } from "./routing";

export default getRequestConfig(async ({ locale: override }) => {
  // An explicit locale (e.g. getTranslations({ locale })) wins over the [locale] segment.
  const candidate = override ?? (await rootLocale());
  const locale = hasLocale(routing.locales, candidate) ? candidate : routing.defaultLocale;

  return {
    locale,
    // Dates on the site (maker since, link last checked) are shown in Indonesian time.
    timeZone: "Asia/Jakarta",
    messages: (await import(`../messages/${locale}.json`)).default,
  };
});
