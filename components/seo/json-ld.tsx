/**
 * Structured data for search engines, as a plain <script> (not next/script: it is data, not
 * code). Maker content goes in here, so "<" is escaped to keep it from closing the tag.
 */
export function JsonLd({ data }: { data: Record<string, unknown> }) {
  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(data).replace(/</g, "\\u003c") }}
    />
  );
}
