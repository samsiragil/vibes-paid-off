import Image from "next/image";
import { cn } from "@/lib/cn";

const sizes = {
  xs: "size-[26px] text-[10px]",
  sm: "size-[34px] text-[11px]",
  md: "size-10 text-[13px]",
  lg: "size-[84px] text-[32px]",
} as const;

const pixels = { xs: 26, sm: 34, md: 40, lg: 84 } as const;

/**
 * OAuth avatars come at full size (GitHub serves up to 460 px, hundreds of KB). Both providers
 * resize through the URL, so ask for twice the rendered size (sharp on 2x screens).
 */
export function sizedAvatarUrl(src: string, pixels: number) {
  const size = pixels * 2;
  try {
    const url = new URL(src);
    if (url.hostname === "avatars.githubusercontent.com") {
      url.searchParams.set("s", String(size));
      return url.toString();
    }
    if (url.hostname.endsWith(".googleusercontent.com") && !url.search) {
      // ".../a/ACg8oc...=s96-c" → "=s{size}-c"; append when there is no size suffix yet.
      return /=s\d+(-c)?$/.test(url.pathname)
        ? src.replace(/=s\d+(-c)?$/, `=s${size}-c`)
        : `${src}=s${size}-c`;
    }
  } catch {
    // Not a URL we know how to resize: use it as is.
  }
  return src;
}

export function initialsOf(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  const letters =
    parts.length > 1 ? parts[0][0] + parts[parts.length - 1][0] : (parts[0]?.slice(0, 2) ?? "");
  return letters.toUpperCase();
}

/** Maker avatar: photo when available, otherwise initials on the soft accent color. */
export function Avatar({
  name,
  src,
  size = "md",
  className,
}: {
  name: string;
  src?: string | null;
  size?: keyof typeof sizes;
  className?: string;
}) {
  const classes = cn(
    "relative inline-flex shrink-0 items-center justify-center overflow-hidden rounded-full bg-accent-soft font-semibold text-accent-ink",
    sizes[size],
    className,
  );

  if (src) {
    return (
      <span className={classes}>
        <Image
          src={sizedAvatarUrl(src, pixels[size])}
          alt=""
          width={pixels[size]}
          height={pixels[size]}
          unoptimized
          className="size-full object-cover"
        />
      </span>
    );
  }

  return (
    <span className={classes} aria-hidden="true">
      {initialsOf(name)}
    </span>
  );
}

/** The site's own voice: an outlined circle with an italic "V". */
export function SystemAvatar({ className }: { className?: string }) {
  return (
    <span
      aria-hidden="true"
      className={cn(
        "inline-flex size-9 shrink-0 items-center justify-center rounded-full border border-border-strong bg-surface font-display text-sm text-accent-text italic",
        className,
      )}
    >
      V
    </span>
  );
}
