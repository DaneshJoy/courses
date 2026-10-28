import { describe, expect, it } from "vitest";
import { buildSearchIndex, filterCourses, filtersFrom, searchCourses } from "../src/lib/search";
import type { Course } from "../src/lib/types";

const base: Course = {
  id: "base",
  title: "Base",
  description: "Base description",
  language: "en",
  dir: "ltr",
  level: "beginner",
  category: "general",
  tags: [],
  lectures: [
    { id: "lecture-1", title: "Intro", order: 1, durationMinutes: 30, objectives: [], status: "published" },
  ],
  schemaVersion: "1.0.0",
  templateVersion: "1.0.0",
  license: "CC-BY-4.0",
  updatedAt: "2026-10-29",
};

function course(overrides: Partial<Course>): Course {
  return { ...base, ...overrides };
}

const ai = course({
  id: "ai-medical",
  title: "مقدمه‌ای بر هوش مصنوعی و کاربرد آن در مهندسی پزشکی ۲",
  description: "دوره مقدماتی هوش مصنوعی",
  language: "fa",
  dir: "rtl",
  category: "ai",
  tags: ["ai", "medical"],
});

const python = course({
  id: "python-basics",
  title: "Python for Beginners",
  description: "Learn Python programming",
  category: "programming",
  tags: ["python", "programming"],
});

const advanced = course({
  id: "advanced-ml",
  title: "یادگیری ماشین پیشرفته",
  description: "مباحث پیشرفته یادگیری ماشین",
  language: "fa",
  dir: "rtl",
  level: "advanced",
  category: "ai",
  tags: ["ai", "ml"],
});

const courses = [ai, python, advanced];
const ids = (list: Course[]) => list.map((item) => item.id);

describe("buildSearchIndex", () => {
  it("indexes normalized title and description tokens", () => {
    const index = buildSearchIndex(courses);
    expect(ids(index.get("python") ?? [])).toEqual(["python-basics"]);
    expect(ids(index.get("هوش") ?? [])).toEqual(["ai-medical"]);
  });
});

describe("searchCourses", () => {
  it("finds the ZWNJ title with a Persian query", () => {
    expect(ids(searchCourses(courses, "هوش مصنوعی"))).toEqual(["ai-medical"]);
    expect(ids(searchCourses(courses, "مقدمه ای"))).toEqual(["ai-medical"]);
  });

  it("normalizes Arabic yeh in the query", () => {
    expect(ids(searchCourses(courses, "هوش مصنوعي"))).toEqual(["ai-medical"]);
  });

  it("matches a Latin-digit query against Persian digits in the title", () => {
    expect(ids(searchCourses(courses, "2"))).toEqual(["ai-medical"]);
  });

  it("finds the English course with a latin query", () => {
    expect(ids(searchCourses(courses, "python"))).toEqual(["python-basics"]);
  });

  it("returns all courses for an empty query", () => {
    expect(ids(searchCourses(courses, "  "))).toEqual(ids(courses));
  });

  it("returns nothing when a token is missing", () => {
    expect(searchCourses(courses, "هوش کوکب")).toEqual([]);
  });
});

describe("filterCourses", () => {
  it("returns all courses for empty filters", () => {
    expect(ids(filterCourses(courses, {}))).toEqual(ids(courses));
  });

  it("filters by level, language, and category", () => {
    expect(ids(filterCourses(courses, { level: "beginner" }))).toEqual(["ai-medical", "python-basics"]);
    expect(ids(filterCourses(courses, { language: "fa" }))).toEqual(["ai-medical", "advanced-ml"]);
    expect(ids(filterCourses(courses, { category: "ai" }))).toEqual(["ai-medical", "advanced-ml"]);
  });

  it("requires every provided tag (AND)", () => {
    expect(ids(filterCourses(courses, { tags: ["ai"] }))).toEqual(["ai-medical", "advanced-ml"]);
    expect(ids(filterCourses(courses, { tags: ["ai", "medical"] }))).toEqual(["ai-medical"]);
    expect(filterCourses(courses, { tags: ["ai", "python"] })).toEqual([]);
  });

  it("combines filters", () => {
    expect(ids(filterCourses(courses, { level: "beginner", language: "fa" }))).toEqual(["ai-medical"]);
  });
});

describe("filtersFrom", () => {
  it("returns sorted unique values across courses", () => {
    expect(filtersFrom(courses)).toEqual({
      levels: ["advanced", "beginner"],
      languages: ["en", "fa"],
      categories: ["ai", "programming"],
      tags: ["ai", "medical", "ml", "programming", "python"],
    });
  });
});
