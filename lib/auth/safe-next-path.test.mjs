import assert from "node:assert/strict";
import { test } from "node:test";
import { safeNextPath } from "./safe-next-path.ts";

const fallback = "/en";

test("keeps same-site paths", () => {
  assert.equal(safeNextPath("/en/p/foo", fallback), "/en/p/foo");
  assert.equal(safeNextPath("/id/me?tab=projects#top", fallback), "/id/me?tab=projects#top");
  assert.equal(safeNextPath("/", fallback), "/");
});

test("rejects non-strings and relative or absolute URLs", () => {
  for (const value of [
    undefined,
    null,
    1,
    "",
    "en/p/foo",
    "https://evil.example",
    "javascript:alert(1)",
  ]) {
    assert.equal(safeNextPath(value, fallback), fallback, String(value));
  }
});

test("rejects protocol-relative URLs, including ones hidden behind characters URL parsers strip", () => {
  for (const value of [
    "//evil.example",
    "/\\evil.example",
    "/\t/evil.example",
    "/\n/evil.example",
    "/\r/evil.example",
    "/\t\\evil.example",
    "/x\\y",
    "/en\u0000",
    "/en\u007f",
  ]) {
    assert.equal(safeNextPath(value, fallback), fallback, JSON.stringify(value));
  }
});

test("returns a value that resolves to our origin", () => {
  for (const value of [
    "/en/p/foo",
    "/en/../id",
    "/%2F%2Fevil.example",
    "/en?next=//evil.example",
  ]) {
    const result = safeNextPath(value, fallback);
    assert.equal(new URL(result, "https://jadinya.dev").origin, "https://jadinya.dev", value);
  }
});
