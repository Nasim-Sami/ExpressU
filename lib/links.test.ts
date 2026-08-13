import { describe, expect, it } from "vitest";

import { hostOf, parseLink, readLinks, suggestLabel, writeLinks } from "./links";

describe("parseLink — what may go on a child's profile", () => {
  it("refuses javascript: URLs", () => {
    // The whole reason this function exists. A stored javascript: URL runs in the
    // browser of whoever taps it.
    const result = parseLink("javascript:alert(document.cookie)");
    expect(result.ok).toBe(false);
  });

  it("refuses data: URLs", () => {
    expect(parseLink("data:text/html,<script>alert(1)</script>").ok).toBe(false);
  });

  it("refuses other exotic schemes", () => {
    for (const url of ["file:///etc/passwd", "vbscript:msgbox(1)", "ftp://example.com"]) {
      expect(parseLink(url).ok, url).toBe(false);
    }
  });

  it("accepts a bare host, because that's how people type addresses", () => {
    const result = parseLink("instagram.com/maya");
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.link.url).toBe("https://instagram.com/maya");
  });

  it("keeps an explicit http:// rather than silently upgrading it", () => {
    const result = parseLink("http://example.com/x");
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.link.url.startsWith("http://")).toBe(true);
  });

  it("rejects things that aren't addresses at all", () => {
    expect(parseLink("").ok).toBe(false);
    expect(parseLink("just some words").ok).toBe(false);
    expect(parseLink("localhost").ok).toBe(false);
  });

  it("falls back to a sensible label when none is given", () => {
    const result = parseLink("https://www.youtube.com/@someone");
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.link.label).toBe("YouTube");
  });

  it("keeps the label the author chose", () => {
    const result = parseLink("https://example.com", "  My portfolio  ");
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.link.label).toBe("My portfolio");
  });
});

describe("hostOf and suggestLabel", () => {
  it("shows the bare host so the destination is never a surprise", () => {
    expect(hostOf("https://www.facebook.com/someone")).toBe("facebook.com");
    expect(hostOf("https://sub.example.co.uk/path")).toBe("sub.example.co.uk");
  });

  it("resolves a scheme-less address, so the field isn't blank while you type", () => {
    expect(hostOf("youtube.com/@me")).toBe("youtube.com");
    expect(suggestLabel("youtube.com/@me")).toBe("YouTube");
  });

  it("shows no host for a URL that isn't a web address", () => {
    expect(hostOf("javascript:alert(1)")).toBe("");
  });

  it("names hosts people recognise, and falls back to the domain otherwise", () => {
    expect(suggestLabel("https://youtu.be/abc")).toBe("YouTube");
    expect(suggestLabel("https://x.com/someone")).toBe("X");
    expect(suggestLabel("https://some-random-site.example/page")).toBe(
      "some-random-site.example",
    );
  });
});

describe("readLinks", () => {
  it("survives junk in the column without throwing", () => {
    for (const junk of [null, "", "not json", "{}", "[1,2,3]", '["nope"]']) {
      expect(readLinks(junk)).toEqual([]);
    }
  });

  it("drops entries that would no longer pass validation", () => {
    // A link stored before a rule tightened must not become renderable again just
    // because it is already in the database.
    const stored = JSON.stringify([
      { label: "Bad", url: "javascript:alert(1)" },
      { label: "Good", url: "https://example.com/" },
    ]);
    expect(readLinks(stored)).toEqual([{ label: "Good", url: "https://example.com/" }]);
  });

  it("round-trips through writeLinks", () => {
    const links = [{ label: "YouTube", url: "https://youtube.com/@me" }];
    expect(readLinks(writeLinks(links))).toEqual(links);
  });

  it("stores nothing rather than an empty array", () => {
    expect(writeLinks([])).toBeNull();
  });
});
