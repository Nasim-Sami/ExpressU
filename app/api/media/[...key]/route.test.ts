import { describe, expect, it } from "vitest";

import { parseRangeHeader } from "./route";

describe("parseRangeHeader", () => {
  it("supports open-ended byte ranges", () => {
    expect(parseRangeHeader("bytes=200-", 1000)).toEqual({ start: 200, end: 999 });
  });

  it("supports suffix byte ranges", () => {
    expect(parseRangeHeader("bytes=-500", 1000)).toEqual({ start: 500, end: 999 });
  });

  it("rejects invalid ranges", () => {
    expect(parseRangeHeader("bytes=500-200", 1000)).toBeNull();
    expect(parseRangeHeader("bytes=500-2000", 1000)).toBeNull();
    expect(parseRangeHeader("bytes=-0", 1000)).toBeNull();
  });
});
