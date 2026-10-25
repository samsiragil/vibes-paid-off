import { getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { SystemMessage } from "@/components/ui/bubble";
import { buttonStyles } from "@/components/ui/button";
import { SiteFooter } from "@/components/layout/site-footer";

export default async function NotFound() {
  const t = await getTranslations("notFound");

  return (
    <>
      <main className="mx-auto flex w-full max-w-[1120px] flex-col gap-5 px-4 pt-16 sm:px-6 sm:pt-20">
        <h1 className="text-[30px] leading-9 font-bold break-words sm:text-[40px] sm:leading-11">
          404 · {t("title")}
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
