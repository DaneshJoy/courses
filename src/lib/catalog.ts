import rawCatalog from "../../generated/catalog.json";
import type { Course } from "./types";

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

// Filter offers every known center, not only centers currently assigned.
export const centerOptions: string[] = Array.isArray(catalog.centers)
  ? uniqueStrings(catalog.centers.filter(isCenterEntry).map((center) => center.name))
  : [];

function isCenterEntry(value: unknown): value is { name: string } {
  return (
    typeof value === "object" && value !== null && typeof (value as { name?: unknown }).name === "string"
  );
}

function uniqueStrings(values: string[]): string[] {
  return [...new Set(values)];
}
