import { describe, expect, it } from "vitest";

import { MIN_SCORE, editDistance, normalise, ranked, scoreFields, wordScore } from "./fuzzy";

const title = (text: string) => [{ text, weight: 1 }];

describe("normalise", () => {
  it("folds case, accents and punctuation", () => {
    expect(normalise("Café — Mango!")).toBe("cafe mango");
    expect(normalise("  lots   of   space  ")).toBe("lots of space");
  });
});

describe("editDistance", () => {
  it("counts single edits", () => {
    expect(editDistance("mango", "mango")).toBe(0);
    expect(editDistance("mango", "mango".replace("a", "e"))).toBe(1); // substitution
    expect(editDistance("mango", "mango" + "e")).toBe(1); // insertion
    expect(editDistance("mango", "mang")).toBe(1); // deletion
  });

  it("counts a pair of swapped letters as one edit, not two", () => {
    expect(editDistance("mnago", "mango")).toBe(1);
    expect(editDistance("scaerd", "scared")).toBe(1);
  });

  it("gives up early rather than scoring nonsense", () => {
    expect(editDistance("mango", "bicycle", 3)).toBeGreaterThan(3);
  });
});

describe("wordScore — the typing a child actually does", () => {
  it("matches the word exactly typed", () => {
    expect(wordScore("mango", "mango")).toBe(1);
  });

  it("matches a half-typed word", () => {
    // Searching before you've finished typing is the normal case, not an edge case.
    expect(wordScore("man", "mango")).toBeGreaterThan(MIN_SCORE);
    expect(wordScore("ma", "mango")).toBeGreaterThan(MIN_SCORE);
  });

  it("matches common misspellings", () => {
    for (const typo of ["mago", "mangoe", "nango", "mnago"]) {
      expect(wordScore(typo, "mango"), typo).toBeGreaterThan(MIN_SCORE);
    }
  });

  it("does not match unrelated words", () => {
    for (const other of ["bicycle", "elephant", "library"]) {
      expect(wordScore("mango", other), other).toBe(0);
    }
  });

  it("keeps short queries strict, so 'cat' doesn't match 'car', 'can', 'cab' equally loosely", () => {
    // One edit is allowed on a 3-letter word; two would make every short word match.
    expect(wordScore("cat", "cot")).toBeGreaterThan(0);
    expect(wordScore("cat", "dog")).toBe(0);
  });

  it("does not match a short word to a different short word two edits away", () => {
    // Found live: searching "bird" returned a post about being "bad" at things. Half a
    // four-letter word is not a typo.
    expect(wordScore("bird", "bad")).toBe(0);
    expect(wordScore("tree", "the")).toBe(0);
  });
});

describe("scoreFields", () => {
  it("weights a title above a body mention", () => {
    const inTitle = scoreFields("mango", [
      { text: "The mango tree", weight: 1 },
      { text: "nothing here", weight: 0.4 },
    ]);
    const inBody = scoreFields("mango", [
      { text: "nothing here", weight: 1 },
      { text: "I planted a mango", weight: 0.4 },
    ]);
    expect(inTitle).toBeGreaterThan(inBody);
  });

  it("requires every query word to match something", () => {
    // "mango cake" must not return every mango post that has no cake in it.
    const both = scoreFields("mango cake", title("mango cake recipe"));
    const onlyOne = scoreFields("mango cake", title("mango tree in the garden"));
    expect(both).toBeGreaterThan(MIN_SCORE);
    expect(onlyOne).toBe(0);
  });

  it("ignores word order and which field each word came from", () => {
    const fields = [
      { text: "Mango", weight: 1 },
      { text: "a cake I made", weight: 0.6 },
    ];
    expect(scoreFields("cake mango", fields)).toBeGreaterThan(MIN_SCORE);
  });

  it("scores nothing for an empty query", () => {
    expect(scoreFields("", title("mango"))).toBe(0);
    expect(scoreFields("   ", title("mango"))).toBe(0);
  });
});

describe("ranked", () => {
  const posts = [
    { id: "a", title: "How to grow a mango tree", body: "" },
    { id: "b", title: "My bicycle", body: "I rode past a mango stall" },
    { id: "c", title: "Elephant drawing", body: "nothing to do with fruit" },
    { id: "d", title: "Mango", body: "" },
  ];
  const fields = (p: (typeof posts)[number]) => [
    { text: p.title, weight: 1 },
    { text: p.body, weight: 0.4 },
  ];

  it("puts the closest title first and drops the unrelated one", () => {
    const results = ranked("mango", posts, fields).map((p) => p.id);
    expect(results[0]).toBe("d"); // exact title
    expect(results).toContain("a");
    expect(results).not.toContain("c");
  });

  it("still finds things when the query is misspelled", () => {
    expect(ranked("mngo", posts, fields).map((p) => p.id)).toContain("d");
  });

  it("still finds things when the query is half-typed", () => {
    expect(ranked("man", posts, fields).map((p) => p.id)).toContain("d");
  });

  it("returns nothing rather than noise for a query with no relation", () => {
    expect(ranked("helicopter", posts, fields)).toEqual([]);
  });

  it("respects the limit", () => {
    const many = Array.from({ length: 100 }, (_, i) => ({
      id: String(i),
      title: "mango",
      body: "",
    }));
    expect(ranked("mango", many, fields, 10)).toHaveLength(10);
  });
});
