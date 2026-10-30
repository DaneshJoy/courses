import { afterEach, describe, expect, it } from "vitest";
import { createRequire } from "node:module";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

const require = createRequire(import.meta.url);
const { createAjv, runGeneration } = require("../scripts/generate-catalog.cjs");

const manifest = {
  id: "ai-foundations",
  title: "مبانی هوش مصنوعی",
  description: "دوره مقدماتی",
  language: "fa-IR",
  dir: "rtl",
  level: "beginner",
  category: "ai",
  tags: ["ai"],
  lectures: [
    {
      id: "lecture-1",
      title: "مقدمه",
      order: 1,
      durationMinutes: 45,
      objectives: ["معرفی"],
      status: "published",
    },
  ],
  schemaVersion: "1.0.0",
  templateVersion: "1.0.0",
  license: "CC-BY-4.0",
  updatedAt: "2026-10-28",
};

const publishedEntry = {
  id: "ai-foundations",
  manifestUrl: "https://example.com/course.json",
  status: "published",
};

function response(body: unknown, overrides: Record<string, unknown> = {}) {
  return {
    ok: true,
    status: 200,
    url: "https://example.com/course.json",
    json: async () => body,
    ...overrides,
  };
}

const tempDirs: string[] = [];

function tempGeneratedDir(): string {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "portal-catalog-"));
  tempDirs.push(root);
  return path.join(root, "generated");
}

function setupRegistryEntryWithLocalPath(localPath: string) {
  return {
    id: "ai-foundations",
    manifestUrl: "https://example.com/course.json",
    localPath: localPath,
    status: "published",
  };
}

afterEach(() => {
  for (const dir of tempDirs.splice(0)) {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

async function generate(
  registry: unknown[],
  fetchImpl: () => Promise<unknown>,
  generatedDir = tempGeneratedDir(),
) {
  return runGeneration({ registry, ajv: createAjv(), fetchImpl, generatedDir });
}

describe("catalog generation pipeline", () => {
  it("includes a valid published manifest and its featured flag", async () => {
    const generatedDir = tempGeneratedDir();
    const result = await generate([{ ...publishedEntry, featured: true }], async () => response(manifest), generatedDir);

    expect(result.ok).toBe(true);
    expect(result.courses).toHaveLength(1);
    expect(result.courses[0]).toMatchObject({ id: "ai-foundations", featured: true });

    const catalog = JSON.parse(fs.readFileSync(path.join(generatedDir, "catalog.json"), "utf8"));
    expect(catalog.schemaVersion).toBe("1.0.0");
    expect(catalog.courses[0]).toMatchObject({ id: "ai-foundations", featured: true });
    expect(fs.existsSync(path.join(generatedDir, "search-index.json"))).toBe(true);
  });

  it("omits featured when the registry entry does not set it", async () => {
    const result = await generate([publishedEntry], async () => response(manifest));
    expect(result.ok).toBe(true);
    expect("featured" in result.courses[0]).toBe(false);
  });

  it("resolves center ids to labels, derives courseUrl, and omits unset centers", async () => {
    const withoutCenters = await generate([publishedEntry], async () => response(manifest));
    expect(withoutCenters.ok).toBe(true);
    expect("centers" in withoutCenters.courses[0]).toBe(false);
    expect(withoutCenters.courses[0].courseUrl).toBe("https://example.com/");

    const withCenters = await generate(
      [{ ...publishedEntry, centers: ["shahed-university"] }],
      async () => response(manifest),
    );
    expect(withCenters.ok).toBe(true);
    expect(withCenters.courses[0].centers).toEqual(["دانشگاه شاهد"]);

    const generatedDir = tempGeneratedDir();
    await generate(
      [{ ...publishedEntry, centers: ["shahed-university"] }],
      async () => response(manifest),
      generatedDir,
    );
    const catalog = JSON.parse(fs.readFileSync(path.join(generatedDir, "catalog.json"), "utf8"));
    expect(catalog.centers).toContainEqual({ id: "shahed-university", name: "دانشگاه شاهد" });
  });

  it("fails on a registry center id that data/centers.json does not define", async () => {
    const result = await generate(
      [{ ...publishedEntry, centers: ["unknown-center"] }],
      async () => response(manifest),
    );
    expect(result.ok).toBe(false);
    expect(result.errors.join("\n")).toContain("unknown center id(s) unknown-center");
  });

  it("fails fast on unknown center ids even when the entry is not published", async () => {
    const result = await generate(
      [{ ...publishedEntry, status: "archived", centers: ["unknown-center"] }],
      async () => response(manifest),
    );
    expect(result.ok).toBe(false);
    expect(result.errors.join("\n")).toContain("entry[0]");
    expect(result.errors.join("\n")).toContain("unknown center id(s) unknown-center");
  });

  it("fails when the manifest id differs from the registry id", async () => {
    const result = await generate([publishedEntry], async () =>
      response({ ...manifest, id: "other-course" }),
    );
    const errors = result.errors.join("\n");
    expect(result.ok).toBe(false);
    expect(errors).toContain('course "ai-foundations"');
    expect(errors).toContain("does not match registry id");
  });

  it("fails when lectures are empty or a required field is missing", async () => {
    const empty = await generate([publishedEntry], async () =>
      response({ ...manifest, lectures: [] }),
    );
    expect(empty.ok).toBe(false);
    expect(empty.errors.join("\n")).toContain("at least one lecture");

    const { title: _title, ...withoutTitle } = manifest;
    const missing = await generate([publishedEntry], async () => response(withoutTitle));
    expect(missing.ok).toBe(false);
    expect(missing.errors.join("\n")).toContain("title");
  });

  it("fails on duplicate lecture ids and duplicate order values", async () => {
    const lecture = manifest.lectures[0];

    const duplicateId = await generate([publishedEntry], async () =>
      response({
        ...manifest,
        lectures: [lecture, { ...lecture, title: "دوم", order: 2 }],
      }),
    );
    expect(duplicateId.ok).toBe(false);
    expect(duplicateId.errors.join("\n")).toContain(
      'lecture "lecture-1": duplicate lecture id',
    );

    const duplicateOrder = await generate([publishedEntry], async () =>
      response({
        ...manifest,
        lectures: [lecture, { ...lecture, id: "lecture-2", title: "دوم" }],
      }),
    );
    expect(duplicateOrder.ok).toBe(false);
    expect(duplicateOrder.errors.join("\n")).toContain(
      'lecture "lecture-2": duplicate lecture order 1',
    );
  });

  it("fails without writing artifacts when the manifest is unreachable", async () => {
    const generatedDir = tempGeneratedDir();

    const thrown = await generate(
      [publishedEntry],
      async () => {
        throw new Error("network down");
      },
      generatedDir,
    );
    expect(thrown.ok).toBe(false);
    expect(thrown.errors.join("\n")).toContain('course "ai-foundations"');
    expect(fs.existsSync(generatedDir)).toBe(false);

    const notFound = await generate(
      [publishedEntry],
      async () => response(null, { ok: false, status: 404 }),
      generatedDir,
    );
    expect(notFound.ok).toBe(false);
    expect(notFound.errors.join("\n")).toContain("HTTP 404");
    expect(fs.existsSync(generatedDir)).toBe(false);
  });

  it("rejects a manifest that redirects to a non-https URL", async () => {
    const result = await generate([publishedEntry], async () =>
      response(manifest, { url: "http://insecure.example/course.json" }),
    );
    expect(result.ok).toBe(false);
    expect(result.errors.join("\n")).toContain("non-https");
  });

  it("skips unpublished entries without fetching them", async () => {
    let calls = 0;
    const result = await generate(
      [{ ...publishedEntry, status: "archived" }],
      async () => {
        calls += 1;
        return response(manifest);
      },
    );
    expect(calls).toBe(0);
    expect(result.ok).toBe(true);
    expect(result.courses).toEqual([]);
  });

  it("fails with PORTAL_LOCAL=1 and missing local manifest", async () => {
    const generatedDir = tempGeneratedDir();
    const originalEnv = process.env.PORTAL_LOCAL;
    process.env.PORTAL_LOCAL = "1";

    const result = await generate(
      [{ ...publishedEntry, localPath: "nonexistent-course.json" }],
      async () => response(manifest),
      generatedDir,
    );

    // Restore environment
    if (originalEnv === undefined) {
      delete process.env.PORTAL_LOCAL;
    } else {
      process.env.PORTAL_LOCAL = originalEnv;
    }

    expect(result.ok).toBe(false);
    expect(result.errors.join("\n")).toContain('PORTAL_LOCAL=1 but no local manifest found');
  });

  it("uses local manifest when localPath exists and PORTAL_LOCAL=1", async () => {
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "local-manifest-test-"));
    const courseJsonPath = path.join(tempDir, "course.json");
    fs.writeFileSync(courseJsonPath, JSON.stringify(manifest));

    const localEntry = setupRegistryEntryWithLocalPath(courseJsonPath);
    const originalEnv = process.env.PORTAL_LOCAL;
    process.env.PORTAL_LOCAL = "1";

    const result = await generate([localEntry], async () => {
      throw new Error("Should not be called when local path exists");
    });

    // Restore environment
    if (originalEnv === undefined) {
      delete process.env.PORTAL_LOCAL;
    } else {
      process.env.PORTAL_LOCAL = originalEnv;
    }

    // Cleanup temp dir
    fs.rmSync(tempDir, { recursive: true, force: true });

    expect(result.ok).toBe(true);
    expect(result.courses).toHaveLength(1);
    expect(result.courses[0]).toMatchObject({ id: "ai-foundations" });
  });

  it("uses remote manifest when PORTAL_LOCAL is not enabled", async () => {
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "local-prefer-test-"));
    const courseJsonPath = path.join(tempDir, "course.json");
    fs.writeFileSync(courseJsonPath, JSON.stringify(manifest));

    const localEntry = { ...publishedEntry, localPath: courseJsonPath };

    // Without PORTAL_LOCAL, the remote manifest remains the source of truth.
    const result = await generate([localEntry], async () => response(manifest));

    // Cleanup temp dir
    fs.rmSync(tempDir, { recursive: true, force: true });

    expect(result.ok).toBe(true);
    expect(result.courses).toHaveLength(1);
    expect(result.courses[0].courseUrl).toBe("https://example.com/");
  });
});
