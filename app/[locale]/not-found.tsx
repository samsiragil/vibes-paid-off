import { getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { SystemMessage } from "@/components/ui/bubble";
import { buttonStyles } from "@/components/ui/button";
import { SiteFooter } from "@/components/layout/site-footer";

export default async function NotFound() {
  const t = await getTranslations("notFound");

  return (
    <>
      <main className="mx-auto flex w-full max-w-[1200px] flex-col gap-6 px-4 pt-20 sm:px-6">
        <h1 className="font-display text-5xl font-normal tracking-[-1px]">
          404 · <span className="italic">{t("title")}</span>
        </h1>
        <SystemMessage className="max-w-xl">{t("body")}</SystemMessage>
        <Link href="/" className={buttonStyles({ variant: "outline", className: "self-start" })}>
          {t("back")}
        </Link>
      </main>
      <SiteFooter />
    </>
  );
}
