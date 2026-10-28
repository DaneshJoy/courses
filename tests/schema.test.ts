import { describe, expect, it } from "vitest";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
// The generator is CommonJS so the build CLI and this test share one implementation.
const { createAjv, validateRegistry } = require("../scripts/generate-catalog.cjs");

const validEntry = {
  id: "ai-foundations",
  manifestUrl: "https://example.com/courses/ai-foundations/course.json",
  status: "published",
};

function errorsFor(registry: unknown): string {
  const result = validateRegistry(registry, createAjv());
  expect(result.valid).toBe(false);
  return result.errors.join("\n");
}

describe("course registry validation", () => {
  it("accepts an empty registry", () => {
    expect(validateRegistry([], createAjv())).toEqual({ valid: true, errors: [] });
  });

  it("accepts a minimal valid registry", () => {
    expect(validateRegistry([validEntry], createAjv())).toEqual({ valid: true, errors: [] });
    expect(
      validateRegistry([{ ...validEntry, featured: true }], createAjv()),
    ).toEqual({ valid: true, errors: [] });
  });

  it("rejects a duplicate id with a clear message", () => {
    const errors = errorsFor([validEntry, { ...validEntry, status: "unlisted" }]);
    expect(errors).toContain('duplicate id "ai-foundations"');
  });

  it("rejects an invalid status with the entry index", () => {
    const errors = errorsFor([{ ...validEntry, status: "publshed" }]);
    expect(errors).toContain("entry[0]");
    expect(errors).toContain("status");
  });

  it("rejects ids with uppercase or Persian characters", () => {
    expect(errorsFor([{ ...validEntry, id: "AI-Foundations" }])).toContain("entry[0]");
    expect(errorsFor([{ ...validEntry, id: "دوره-هوش-مصنوعی" }])).toContain("entry[0]");
  });

  it("rejects a non-https manifestUrl", () => {
    expect(errorsFor([{ ...validEntry, manifestUrl: "http://example.com/course.json" }])).toContain(
      "manifestUrl",
    );
  });
});
