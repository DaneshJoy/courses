import rawCatalog from "../../generated/catalog.json";
import type { Center, Course } from "./types";

function isCourse(value: unknown): value is Course {
  if (typeof value !== "object" || value === null) return false;
  const course = value as Record<string, unknown>;
  return (
    typeof course.id === "string" &&
    typeof course.title === "string" &&
    typeof course.description === "string" &&
    typeof course.language === "string" &&
    (course.dir === "rtl" || course.dir === "ltr") &&
    typeof course.level === "string" &&
    typeof course.category === "string" &&
    typeof course.courseUrl === "string" &&
    Array.isArray(course.tags)
  );
}

const catalog = rawCatalog as { schemaVersion?: unknown; centers?: unknown; courses?: unknown };

export const catalogError =
  catalog.schemaVersion !== "1.0.0" || !Array.isArray(catalog.courses) || !catalog.courses.every(isCourse)
    ? "داده‌های دوره‌ها معتبر نیستند."
    : null;

export const courses: Course[] = catalogError ? [] : (catalog.courses as Course[]);

// Registered centers in data/centers.json order; drives the portal's center tabs.
export const centers: Center[] = Array.isArray(catalog.centers)
  ? catalog.centers.filter(isCenter)
  : [];

// Filter offers every known center, not only centers currently assigned.
export const centerOptions: string[] = uniqueStrings(centers.map((center) => center.name));

function isCenter(value: unknown): value is Center {
  if (typeof value !== "object" || value === null) return false;
  const center = value as Record<string, unknown>;
  return typeof center.id === "string" && typeof center.name === "string";
}

function uniqueStrings(values: string[]): string[] {
  return [...new Set(values)];
}
