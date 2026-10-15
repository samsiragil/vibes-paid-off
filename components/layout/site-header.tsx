import { Suspense, type ReactNode } from "react";
import { getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { Avatar } from "@/components/ui/avatar";
import { buttonStyles } from "@/components/ui/button";
import { getCurrentUser } from "@/lib/auth/current-user";
import { LocaleSwitcher } from "./locale-switcher";
import { Wordmark } from "./logo";
import { MobileMenu } from "./mobile-menu";
import { ThemeToggle } from "./theme-toggle";

export type HeaderUser = { name: string; avatarUrl?: string | null };

const navItems = [
  { href: "/explore", key: "explore" },
  { href: "/tools", key: "tools" },
  { href: "/support", key: "support" },
] as const;

/**
 * Pass `user` to render a fixed state (UI kit); leave it out to show the real session,
 * which streams in behind a Suspense boundary so the rest of the header stays static.
 */
export async function SiteHeader({ user }: { user?: HeaderUser | null }) {
  const t = await getTranslations("nav");
  const tBrand = await getTranslations("brand");

  const account: ReactNode =
    user === undefined ? (
      <Suspense fallback={<AccountPlaceholder />}>
        <SessionAccount />
      </Suspense>
    ) : (
      <AccountLink user={user} />
    );

  return (
    <header className="relative border-b border-border">
      <div className="mx-auto flex max-w-[1200px] items-center gap-4 px-4 py-3.5 sm:px-6 md:gap-7">
        <Link href="/" aria-label={tBrand("home")} className="shrink-0">
          <Wordmark />
        </Link>

        <nav aria-label={t("label")} className="hidden grow gap-[22px] text-sm md:flex">
          {navItems.map((item) => (
            <Link key={item.key} href={item.href} className="text-ink hover:text-accent-text">
              {t(item.key)}
            </Link>
          ))}
        </nav>

        <div className="ml-auto hidden items-center gap-2 md:flex">
          <LocaleSwitcher />
          <ThemeToggle />
          {account}
          <Link href="/submit" className={buttonStyles({ variant: "primary" })}>
            {t("submit")}
          </Link>
        </div>

        <div className="ml-auto flex items-center gap-1 md:hidden">
          <ThemeToggle />
          <MobileMenu>
            <nav aria-label={t("label")} className="flex flex-col">
              {navItems.map((item) => (
                <Link
                  key={item.key}
                  href={item.href}
                  className="flex min-h-12 items-center border-b border-border text-base text-ink"
                >
                  {t(item.key)}
                </Link>
              ))}
            </nav>
            <div className="mt-4 flex items-center justify-between">
              <LocaleSwitcher />
              {account}
            </div>
            <Link
              href="/submit"
              className={buttonStyles({ variant: "primary", size: "lg", className: "mt-4 w-full" })}
            >
              {t("submit")}
            </Link>
          </MobileMenu>
        </div>
      </div>
    </header>
  );
}

async function SessionAccount() {
  const user = await getCurrentUser();
  return (
    <AccountLink
      user={
        user ? { name: user.displayName || user.username || "?", avatarUrl: user.avatarUrl } : null
      }
    />
  );
}

async function AccountLink({ user }: { user: HeaderUser | null }) {
  const t = await getTranslations("nav");

  return user ? (
    <Link href="/me" aria-label={t("dashboard")} className="rounded-full">
      <Avatar name={user.name} src={user.avatarUrl} />
    </Link>
  ) : (
    <Link href="/login" className={buttonStyles({ variant: "ghost" })}>
      {t("login")}
    </Link>
  );
}

/** Same footprint as the avatar so the header does not shift when the session arrives. */
function AccountPlaceholder() {
  return <span aria-hidden="true" className="inline-block size-10 rounded-full bg-bubble" />;
}
