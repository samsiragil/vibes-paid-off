import assert from "node:assert/strict";
import { test } from "node:test";
import { parseSocial, socialInputValue, tidySocialInput } from "./social.ts";

const url = (key, raw) => {
  const parsed = parseSocial(key, raw);
  return parsed.ok ? parsed.url : null;
};

test("builds the profile link from a username", () => {
  assert.equal(url("github", "ragil"), "https://github.com/ragil");
  assert.equal(url("linkedin", "ragil-s"), "https://www.linkedin.com/in/ragil-s");
  assert.equal(url("x", "@ragil_dev"), "https://x.com/ragil_dev");
  assert.equal(url("threads", "@ragil.dev"), "https://www.threads.com/@ragil.dev");
  assert.equal(url("instagram", "ragil.dev"), "https://www.instagram.com/ragil.dev");
  assert.equal(url("tiktok", "ragil.dev"), "https://www.tiktok.com/@ragil.dev");
  assert.equal(url("github", "  "), "");
});

test("reads the username out of a pasted profile link", () => {
  assert.equal(url("github", "https://github.com/ragil/"), "https://github.com/ragil");
  assert.equal(url("github", "github.com/ragil"), "https://github.com/ragil");
  assert.equal(url("x", "https://twitter.com/ragil_dev"), "https://x.com/ragil_dev");
  assert.equal(url("threads", "https://www.threads.net/@ragil"), "https://www.threads.com/@ragil");
  assert.equal(
    url("instagram", "https://instagram.com/ragil.dev?igsh=abc"),
    "https://www.instagram.com/ragil.dev",
  );
  assert.equal(url("tiktok", "https://m.tiktok.com/@ragil"), "https://www.tiktok.com/@ragil");
  assert.equal(
    url("linkedin", "https://id.linkedin.com/in/ragil-s/"),
    "https://www.linkedin.com/in/ragil-s",
  );
  assert.equal(url("linkedin", "linkedin.com/in/ragil-s"), "https://www.linkedin.com/in/ragil-s");
});

test("keeps other https links on the same platform as typed", () => {
  assert.equal(
    url("linkedin", "https://www.linkedin.com/company/jadinya"),
    "https://www.linkedin.com/company/jadinya",
  );
  assert.equal(url("github", "https://github.com/org/repo"), "https://github.com/org/repo");
});

test("refuses other sites and invalid usernames", () => {
  assert.equal(url("github", "https://evil.example/ragil"), null);
  assert.equal(url("instagram", "https://x.com/ragil"), null);
  assert.equal(url("github", "-ragil"), null);
  assert.equal(url("x", "way_too_long_for_x_handles"), null);
  assert.equal(url("instagram", "ragil dev"), null);
  assert.equal(url("github", "http://github.com/org/repo"), null);
});

test("shows stored links as usernames", () => {
  assert.equal(socialInputValue("tiktok", "https://www.tiktok.com/@ragil"), "ragil");
  assert.equal(
    socialInputValue("github", "https://github.com/org/repo"),
    "https://github.com/org/repo",
  );
  assert.equal(socialInputValue("x", ""), "");
  assert.equal(tidySocialInput("instagram", " https://instagram.com/ragil.dev/ "), "ragil.dev");
  assert.equal(tidySocialInput("instagram", "@ragil"), "ragil");
});
