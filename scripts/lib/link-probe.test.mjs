import assert from "node:assert/strict";
import { test } from "node:test";
import { blockedReason, isPublicIp, markdownCell, markdownUrl, probe } from "./link-probe.mjs";

test("public and non-public addresses", () => {
  for (const ip of ["8.8.8.8", "1.1.1.1", "76.76.21.21", "2606:4700::1111", "::ffff:8.8.8.8"]) {
    assert.equal(isPublicIp(ip), true, ip);
  }
  for (const ip of [
    "0.0.0.0",
    "10.1.2.3",
    "100.64.0.1",
    "127.0.0.1",
    "169.254.169.254",
    "172.16.0.1",
    "172.31.255.255",
    "192.168.1.1",
    "224.0.0.1",
    "::",
    "::1",
    "fc00::1",
    "fd12::1",
    "fe80::1",
    "::ffff:127.0.0.1",
    "::ffff:7f00:1",
  ]) {
    assert.equal(isPublicIp(ip), false, ip);
  }
});

test("blocks private, loopback and non-web targets before any request", async () => {
  for (const target of [
    "https://127.0.0.1/",
    "https://localhost/",
    "https://[::1]/",
    "http://169.254.169.254/latest/meta-data/",
    "https://10.0.0.5:8443/admin",
  ]) {
    assert.equal(await blockedReason(target), "private address", target);
  }
  assert.equal(await blockedReason("file:///etc/passwd"), "unsupported scheme");
  assert.equal(await blockedReason("not a url"), "invalid url");
  assert.equal(await blockedReason("https://203.0.113.10/"), null);
});

test("probe refuses a private target without fetching it", async () => {
  assert.deepEqual(await probe("https://127.0.0.1/"), {
    ok: false,
    detail: "HEAD private address, GET private address",
  });
});

test("markdown output cannot break out of the link or the table cell", () => {
  const url = markdownUrl("https://evil.example/a) | **x** | [y](https://z.example)");
  assert.doesNotMatch(url, /[\s|()<>[\]]/);
  assert.equal(new URL(url).host, "evil.example");
  assert.equal(markdownUrl("javascript-ish nonsense"), "#invalid-url");
  assert.equal(markdownCell("a|b\n`c`"), "a\\|b \\`c\\`");
});
