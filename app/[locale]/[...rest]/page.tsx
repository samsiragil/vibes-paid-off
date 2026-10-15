import { notFound } from "next/navigation";

// Unknown paths under /[locale] render the localized not-found page instead of Next's default.
export default function CatchAll() {
  notFound();
}
