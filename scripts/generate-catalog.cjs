#!/usr/bin/env node
"use strict";

const fs = require("node:fs");
const path = require("node:path");
const Ajv = require("ajv");

const ROOT = path.resolve(__dirname, "..");
const REGISTRY_PATH = path.join(ROOT, "data", "courses.json");
const SCHEMA_DIR = path.join(ROOT, "schemas");
const GENERATED_DIR = path.join(ROOT, "generated");
const CATALOG_SCHEMA_VERSION = "1.0.0";
const FETCH_TIMEOUT_MS = 15_000;

function createAjv() {
  const ajv = new Ajv({ allErrors: true });
  ajv.addFormat("https-url", (value) => {
    try {
      return new URL(value).protocol === "https:";
    } catch {
      return false;
    }
  });
  // Accepted subset: primary language subtag 2-3 letters + optional 2-8
  // alphanumeric subtags. Not full RFC 5646.
  ajv.addFormat("bcp47", /^[a-z]{2,3}(?:-[a-z0-9]{2,8})*$/i);
  // Accepted subset: YYYY-MM-DD or a full date-time with Z/offset.
  ajv.addFormat("iso-date", (value) => {
    const iso =
      /^\d{4}-\d{2}-\d{2}(?:T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2}))?$/;
    return iso.test(value) && !Number.isNaN(Date.parse(value));
  });
  return ajv;
}

function loadSchemas() {
  return {
    registry: JSON.parse(
      fs.readFileSync(path.join(SCHEMA_DIR, "course-registry.schema.json"), "utf8"),
    ),
    manifest: JSON.parse(
      fs.readFileSync(path.join(SCHEMA_DIR, "course-manifest.schema.json"), "utf8"),
    ),
  };
}

function describeAjvError(error) {
  if (error.keyword === "enum") {
    return `${error.message} (${error.params.allowedValues.join(", ")})`;
  }
  if (error.keyword === "additionalProperties") {
    return `${error.message} ("${error.params.additionalProperty}")`;
  }
  return error.message;
}

function formatAjvError(error) {
  const detail = describeAjvError(error);
  const entry = /^\/(\d+)(\/.*)?$/.exec(error.instancePath);
  if (entry) return `entry[${entry[1]}]${entry[2] ?? ""}: ${detail}`;
  return `registry${error.instancePath || ""}: ${detail}`;
}

function validateRegistry(registry, ajv = createAjv()) {
  const errors = [];
  const validate = ajv.compile(loadSchemas().registry);
  if (!validate(registry)) errors.push(...validate.errors.map(formatAjvError));

  // JSON Schema cannot express uniqueness across array items; enforce it here.
  if (Array.isArray(registry)) {
    const firstSeen = new Map();
    registry.forEach((entry, index) => {
      const id = entry !== null && typeof entry === "object" ? entry.id : undefined;
      if (typeof id !== "string") return;
      if (firstSeen.has(id)) {
        errors.push(
          `entry[${index}]: duplicate id "${id}" (first declared at entry[${firstSeen.get(id)}])`,
        );
      } else {
        firstSeen.set(id, index);
      }
    });
  }

  return { valid: errors.length === 0, errors };
}

// JSON Schema cannot express uniqueness across array items; enforce it here.
function validateLectureUniqueness(lectures) {
  const errors = [];
  const ids = new Map();
  const orders = new Map();
  lectures.forEach((lecture, index) => {
    if (ids.has(lecture.id)) {
      errors.push(
        `lecture "${lecture.id}": duplicate lecture id (first declared at lecture[${ids.get(lecture.id)}])`,
      );
    } else {
      ids.set(lecture.id, index);
    }
    if (orders.has(lecture.order)) {
      errors.push(
        `lecture "${lecture.id}": duplicate lecture order ${lecture.order} (first declared at lecture[${orders.get(lecture.order)}])`,
      );
    } else {
      orders.set(lecture.order, index);
    }
  });
  return errors;
}

async function fetchManifest(url, fetchImpl = fetch) {
  let response;
  try {
    response = await fetchImpl(url, { signal: AbortSignal.timeout(FETCH_TIMEOUT_MS) });
  } catch (error) {
    throw new Error(`manifest unreachable (${error.message})`);
  }
  if (!response.ok) {
    throw new Error(`manifest unreachable (HTTP ${response.status})`);
  }
  // Redirects keep the final URL; the first hop is https via the registry schema.
  if (typeof response.url === "string" && !response.url.startsWith("https:")) {
    throw new Error(`manifest unreachable (redirected to non-https URL ${response.url})`);
  }
  try {
    return await response.json();
  } catch {
    throw new Error("manifest invalid (response is not JSON)");
  }
}

async function loadPublishedCourses(registry, ajv, fetchImpl = fetch) {
  const validateManifest = ajv.compile(loadSchemas().manifest);
  const courses = [];
  const failures = [];

  for (const entry of registry) {
    if (entry.status !== "published") {
      console.log(`skip  ${entry.id} (${entry.status})`);
      continue;
    }
    try {
      const manifest = await fetchManifest(entry.manifestUrl, fetchImpl);
      if (!validateManifest(manifest)) {
        const details = validateManifest.errors
          .map((error) => `${error.instancePath || "/"}: ${describeAjvError(error)}`)
          .join("; ");
        throw new Error(`manifest invalid: ${details}`);
      }
      if (manifest.id !== entry.id) {
        throw new Error(
          `manifest id "${manifest.id}" does not match registry id "${entry.id}"`,
        );
      }
      const lectureErrors = validateLectureUniqueness(manifest.lectures);
      if (lectureErrors.length > 0) {
        throw new Error(`manifest invalid: ${lectureErrors.join("; ")}`);
      }
      if (manifest.lectures.length === 0) {
        throw new Error("manifest invalid: published course must have at least one lecture");
      }
      console.log(`ok    ${entry.id} (${manifest.lectures.length} lectures)`);
      courses.push(entry.featured === true ? { ...manifest, featured: true } : manifest);
    } catch (error) {
      const message = `course "${entry.id}": ${error.message}`;
      failures.push(message);
      console.error(`fail  ${message}`);
    }
  }

  return { courses, failures };
}

function buildSearchIndex(courses, generatedAt) {
  return {
    schemaVersion: CATALOG_SCHEMA_VERSION,
    generatedAt,
    courses: courses.map((course) => ({
      id: course.id,
      title: course.title,
      description: course.description,
      tags: course.tags,
      lectures: course.lectures.map(({ id, title, order }) => ({ id, title, order })),
    })),
  };
}

function writeGenerated(courses, generatedAt, generatedDir = GENERATED_DIR) {
  fs.mkdirSync(generatedDir, { recursive: true });
  fs.writeFileSync(
    path.join(generatedDir, "README.md"),
    "GENERATED — never hand-edit. Regenerate with `npm run generate-catalog`.\n",
  );
  const catalog = { schemaVersion: CATALOG_SCHEMA_VERSION, generatedAt, courses };
  fs.writeFileSync(
    path.join(generatedDir, "catalog.json"),
    `${JSON.stringify(catalog, null, 2)}\n`,
  );
  fs.writeFileSync(
    path.join(generatedDir, "search-index.json"),
    `${JSON.stringify(buildSearchIndex(courses, generatedAt), null, 2)}\n`,
  );
}

async function runGeneration({
  registry,
  ajv = createAjv(),
  fetchImpl = fetch,
  generatedDir = GENERATED_DIR,
  validateOnly = false,
}) {
  const { valid, errors } = validateRegistry(registry, ajv);
  if (!valid) return { ok: false, phase: "registry", errors };

  const { courses, failures } = await loadPublishedCourses(registry, ajv, fetchImpl);
  if (failures.length > 0) return { ok: false, phase: "manifest", errors: failures };
  if (validateOnly) return { ok: true, phase: "validate", courses };

  const generatedAt = new Date().toISOString();
  writeGenerated(courses, generatedAt, generatedDir);
  return { ok: true, phase: "generate", courses, generatedAt };
}

function readRegistry() {
  try {
    return JSON.parse(fs.readFileSync(REGISTRY_PATH, "utf8"));
  } catch (error) {
    throw new Error(`cannot read data/courses.json: ${error.message}`);
  }
}

async function main(argv) {
  const validateOnly = argv.includes("--validate-only");
  let registry;
  try {
    registry = readRegistry();
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
    return;
  }

  const result = await runGeneration({ registry, validateOnly });
  if (!result.ok) {
    if (result.phase === "registry") {
      console.error(`registry invalid (${result.errors.length} error(s)):`);
    } else {
      console.error(`\n${result.errors.length} published course manifest(s) failed:`);
    }
    for (const error of result.errors) console.error(`  ${error}`);
    process.exitCode = 1;
    return;
  }

  if (validateOnly) {
    const published = registry.filter((entry) => entry.status === "published").length;
    console.log(`validate: OK (${registry.length} entries, ${published} published)`);
    return;
  }

  console.log(
    `generated: generated/catalog.json + generated/search-index.json (${result.courses.length} courses)`,
  );
}

module.exports = {
  createAjv,
  loadSchemas,
  loadPublishedCourses,
  runGeneration,
  validateRegistry,
};

if (require.main === module) {
  main(process.argv.slice(2)).catch((error) => {
    console.error(error.message);
    process.exitCode = 1;
  });
}
