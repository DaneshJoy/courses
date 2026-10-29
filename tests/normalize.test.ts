import { describe, expect, it } from "vitest";
import { normalizePersian } from "../src/lib/normalize";

describe("normalizePersian", () => {
  it("normalizes the Persian-derived sample in one pass", () => {
    const input = "سلام كودكك ي ۱۲۳ احمد\u064B\u0650 " + "ی‌نیم‌فاصله";
    expect(normalizePersian(input)).toBe("سلام کودکک ی 123 احمد ی نیم فاصله");
  });

  it("maps Arabic yeh and kaf to Persian forms", () => {
    expect(normalizePersian("يك")).toBe("یک");
  });

  it("strips Arabic diacritics and superscript alef", () => {
    expect(normalizePersian("كِتَاب\u0670")).toBe("کتاب");
  });

  it("treats ZWNJ and tatweel as plain spaces", () => {
    expect(normalizePersian("می‌روم")).toBe("می روم");
    expect(normalizePersian("کـــتاب")).toBe("ک تاب");
  });

  it("maps Persian and Arabic-Indic digits to Latin digits", () => {
    expect(normalizePersian("۱۲۳ و ٤٥٦")).toBe("123 و 456");
  });

  it("lowercases, collapses whitespace, and trims", () => {
    expect(normalizePersian("  Hello   WORLD  ")).toBe("hello world");
  });

  it("returns an empty string unchanged", () => {
    expect(normalizePersian("")).toBe("");
  });
});
