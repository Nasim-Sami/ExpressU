import { describe, expect, it } from "vitest";

import { TARGET_CHARS, findInPages, paginate } from "./pagination";

const paragraph = (words: number, word = "word") => Array(words).fill(word).join(" ");

describe("paginate", () => {
  it("leaves a short piece as a single page", () => {
    expect(paginate("A very short story.")).toEqual(["A very short story."]);
  });

  it("returns nothing for nothing", () => {
    expect(paginate("")).toEqual([]);
    expect(paginate("   \n\n  ")).toEqual([]);
  });

  it("never loses a word", () => {
    const source = Array.from({ length: 40 }, (_, i) => `${paragraph(30)} p${i}.`).join("\n\n");
    const pages = paginate(source);

    expect(pages.length).toBeGreaterThan(1);

    // Every paragraph marker survives, in order.
    const rejoined = pages.join(" ").replace(/\s+/g, " ");
    for (let i = 0; i < 40; i++) expect(rejoined).toContain(`p${i}.`);
  });

  it("keeps pages near the target size", () => {
    const source = Array.from({ length: 30 }, () => paragraph(40)).join("\n\n");
    const pages = paginate(source);

    // The last page is allowed to be short; the rest should be in a sane band.
    for (const page of pages.slice(0, -1)) {
      expect(page.length).toBeLessThanOrEqual(TARGET_CHARS * 2);
      expect(page.length).toBeGreaterThan(100);
    }
  });

  it("splits a single enormous paragraph at sentence ends", () => {
    const source = Array.from({ length: 60 }, (_, i) => `This is sentence number ${i}.`).join(" ");
    const pages = paginate(source, 300);

    expect(pages.length).toBeGreaterThan(1);
    // No page starts mid-sentence — each begins with a capital or a digit.
    for (const page of pages) expect(page.trimStart()).toMatch(/^[A-Z0-9]/);
  });

  it("breaks Bengali sentences on the daṛi", () => {
    // The Bengali full stop is ।, not a dot, and splitting on "." alone would produce
    // one unbroken page for an entire Bengali book.
    const source = Array.from({ length: 40 }, (_, i) => `এটি ${i} নম্বর বাক্য।`).join(" ");
    const pages = paginate(source, 200);

    expect(pages.length).toBeGreaterThan(1);
    for (const page of pages.slice(0, -1)) expect(page.trimEnd()).toMatch(/।$/);
  });

  it("does not leave a runt page at the end of a paragraph run", () => {
    const source = Array.from({ length: 8 }, () => paragraph(60)).join("\n\n");
    const pages = paginate(source);
    // Only the final page may be small, and even it shouldn't be a stray word.
    expect(pages[pages.length - 1].length).toBeGreaterThan(20);
  });
});

describe("findInPages", () => {
  const pages = [
    { number: 1, text: "The mango tree stood by the river and nobody knew who planted it." },
    { number: 2, text: "Every summer the fruit fell into the water and floated away." },
    { number: 3, text: "One year a boy waited under the mango tree with a basket." },
  ];

  it("finds every page a phrase appears on", () => {
    expect(findInPages(pages, "mango").map((hit) => hit.number)).toEqual([1, 3]);
  });

  it("ignores case", () => {
    expect(findInPages(pages, "MANGO")).toHaveLength(2);
  });

  it("gives context around the match", () => {
    const [hit] = findInPages(pages, "basket");
    expect(hit.number).toBe(3);
    expect(hit.excerpt).toContain("basket");
  });

  it("says nothing for a one-letter query", () => {
    expect(findInPages(pages, "m")).toEqual([]);
  });

  it("says nothing when the phrase isn't there", () => {
    expect(findInPages(pages, "helicopter")).toEqual([]);
  });
});
