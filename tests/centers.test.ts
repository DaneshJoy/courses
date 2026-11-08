import { describe, expect, it } from "vitest";
import {
  centerTabs,
  courseCenterIds,
  courseMatchesTab,
  OTHER_TAB_ID,
  OTHER_TAB_LABEL,
} from "../src/lib/centers";
import type { Center, Course } from "../src/lib/types";

const centers: Center[] = [
  { id: "shahed-university", name: "دانشگاه شاهد" },
  { id: "jahad-sharif", name: "جهاد دانشگاهی صنعتی شریف" },
];

const base: Course = {
  id: "base",
  title: "Base",
  description: "Base description",
  language: "en",
  dir: "ltr",
  level: "beginner",
  category: "general",
  tags: [],
  courseUrl: "https://base.example.com/",
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

describe("centerTabs", () => {
  it("builds one tab per registered center plus a final other tab", () => {
    expect(centerTabs(centers)).toEqual([
      { id: "shahed-university", label: "دانشگاه شاهد" },
      { id: "jahad-sharif", label: "جهاد دانشگاهی صنعتی شریف" },
      { id: OTHER_TAB_ID, label: OTHER_TAB_LABEL },
    ]);
  });

  it("keeps only the other tab when no center is registered", () => {
    expect(centerTabs([])).toEqual([{ id: OTHER_TAB_ID, label: OTHER_TAB_LABEL }]);
  });
});

describe("courseCenterIds", () => {
  it("maps catalog center names to center ids", () => {
    expect(courseCenterIds(course({ centers: ["دانشگاه شاهد"] }), centers)).toEqual([
      "shahed-university",
    ]);
  });

  it("accepts center ids and deduplicates them", () => {
    expect(
      courseCenterIds(course({ centers: ["shahed-university", "دانشگاه شاهد"] }), centers),
    ).toEqual(["shahed-university"]);
  });

  it("ignores names that match no registered center", () => {
    expect(courseCenterIds(course({ centers: ["مرکز ناشناخته"] }), centers)).toEqual([]);
    expect(courseCenterIds(course({}), centers)).toEqual([]);
  });
});

describe("courseMatchesTab", () => {
  it("matches a tab by its center and not by another center", () => {
    const assigned = course({ centers: ["دانشگاه شاهد"] });
    expect(courseMatchesTab(assigned, "shahed-university", centers)).toBe(true);
    expect(courseMatchesTab(assigned, "jahad-sharif", centers)).toBe(false);
    expect(courseMatchesTab(assigned, OTHER_TAB_ID, centers)).toBe(false);
  });

  it("puts courses with no registered center under other", () => {
    expect(courseMatchesTab(course({}), OTHER_TAB_ID, centers)).toBe(true);
    expect(courseMatchesTab(course({ centers: [] }), OTHER_TAB_ID, centers)).toBe(true);
    expect(courseMatchesTab(course({ centers: ["مرکز بازنشسته"] }), OTHER_TAB_ID, centers)).toBe(
      true,
    );
  });

  it("matches every tab of a multi-center course", () => {
    const shared = course({ centers: ["دانشگاه شاهد", "جهاد دانشگاهی صنعتی شریف"] });
    expect(courseMatchesTab(shared, "shahed-university", centers)).toBe(true);
    expect(courseMatchesTab(shared, "jahad-sharif", centers)).toBe(true);
    expect(courseMatchesTab(shared, OTHER_TAB_ID, centers)).toBe(false);
  });
});
