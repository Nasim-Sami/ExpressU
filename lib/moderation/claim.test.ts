import { describe, expect, it } from "vitest";

import { needsModeration, pickNext, type ClaimableEntry } from "./claim";

const t = (ms: number) => new Date(2026, 0, 1, 0, 0, 0, ms);

function entry(over: Partial<ClaimableEntry> = {}): ClaimableEntry {
  return { createdAt: t(0), contentUpdatedAt: null, moderatedAt: null, ...over };
}

describe("needsModeration", () => {
  it("claims a brand-new entry", () => {
    expect(needsModeration(entry())).toBe(true);
  });

  it("leaves a checked, unedited entry alone", () => {
    expect(needsModeration(entry({ moderatedAt: t(10) }))).toBe(false);
  });

  it("re-claims an entry edited after it was checked", () => {
    // The bypass this exists to close: publish something harmless, then rewrite it.
    expect(
      needsModeration(entry({ moderatedAt: t(10), contentUpdatedAt: t(20) })),
    ).toBe(true);
  });

  it("does not re-claim an edit that was already re-checked", () => {
    expect(
      needsModeration(entry({ contentUpdatedAt: t(20), moderatedAt: t(30) })),
    ).toBe(false);
  });

  it("does not re-claim an entry whose row was merely rewritten", () => {
    // Renumbering after a sibling is deleted writes the row but changes no content, so
    // contentUpdatedAt stays null and the entry must not go back through the model.
    expect(needsModeration(entry({ moderatedAt: t(10) }))).toBe(false);
  });

  it("still claims a blocked entry's edit, so an author can fix and resubmit", () => {
    expect(
      needsModeration(entry({ moderatedAt: t(5), contentUpdatedAt: t(6) })),
    ).toBe(true);
  });
});

describe("pickNext", () => {
  it("returns null when everything is already checked", () => {
    expect(pickNext([entry({ moderatedAt: t(1) }), entry({ moderatedAt: t(2) })])).toBeNull();
  });

  it("takes the oldest entry that needs checking, not simply the oldest", () => {
    const oldButChecked = entry({ createdAt: t(0), moderatedAt: t(50) });
    const newerAndEdited = entry({
      createdAt: t(10),
      moderatedAt: t(20),
      contentUpdatedAt: t(60),
    });
    const newestUnchecked = entry({ createdAt: t(30) });

    // The bug this guards: claiming a post's OLDEST entry would re-check already-approved
    // content and never look at the one that actually changed.
    expect(pickNext([oldButChecked, newerAndEdited, newestUnchecked])).toBe(newerAndEdited);
  });

  it("drains in the order people wrote things", () => {
    const first = entry({ createdAt: t(5) });
    const second = entry({ createdAt: t(9) });
    expect(pickNext([second, first])).toBe(first);
  });
});
