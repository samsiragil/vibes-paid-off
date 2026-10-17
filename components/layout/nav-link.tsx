"use client";

import type { ComponentProps } from "react";
import { Link, usePathname } from "@/i18n/navigation";
import { cn } from "@/lib/cn";

/**
 * Header navigation link: marks the current section (VPO-Support shows "Dukung kami" in the
 * accent color) with aria-current. /tools also covers /tools/[slug].
 */
export function NavLink({
  href,
  className,
  activeClassName = "font-semibold text-accent-text",
  ...props
}: ComponentProps<typeof Link> & { href: string; activeClassName?: string }) {
  const pathname = usePathname();
  const active = pathname === href || pathname.startsWith(`${href}/`);

  return (
    <Link
      href={href}
      aria-current={active ? "page" : undefined}
      className={cn(className, active && activeClassName)}
      {...props}
    />
  );
}
