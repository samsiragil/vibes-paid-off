import { notFound } from "next/navigation";

// Unknown paths under /[locale] render the localized not-found page instead of Next's default.
// Always a 404, so there is nothing to validate for instant navigation.
export const instant = false;

export default function CatchAll() {
  notFound();
}
