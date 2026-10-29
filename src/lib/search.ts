import { normalizePersian } from "./normalize";
import type { Course, FilterOptions, Filters, SearchIndex } from "./types";

// Split on any run of non-letter/digit chars (Unicode-aware) so punctuation-attached words tokenize correctly.
function tokenize(text: string): string[] {
  return normalizePersian(text).split(/[^\p{L}\p{N}]+/u).filter(Boolean);
}

export function buildSearchIndex(courses: Course[]): SearchIndex {
  const index: SearchIndex = new Map();
  for (const course of courses) {
    for (const token of tokenize(`${course.title} ${course.description}`)) {
      const bucket = index.get(token) ?? [];
      if (!bucket.includes(course)) bucket.push(course);
      index.set(token, bucket);
    }
  }
  return index;
}

export function searchCourses(courses: Course[], query: string): Course[] {
  const tokens = tokenize(query);
  if (tokens.length === 0) return courses;

  const index = buildSearchIndex(courses);
  return courses.filter((course) =>
    tokens.every((token) => index.get(token)?.includes(course)),
  );
}

export function filterCourses(courses: Course[], filters: Filters): Course[] {
  return courses.filter(
    (course) =>
      (filters.level === undefined || course.level === filters.level) &&
      (filters.language === undefined || course.language === filters.language) &&
      (filters.category === undefined || course.category === filters.category) &&
      (filters.tags === undefined || filters.tags.every((tag) => course.tags.includes(tag))),
  );
}

function uniqueSorted(values: string[]): string[] {
  return [...new Set(values)].sort();
}

export function filtersFrom(courses: Course[]): FilterOptions {
  return {
    levels: uniqueSorted(courses.map((course) => course.level)),
    languages: uniqueSorted(courses.map((course) => course.language)),
    categories: uniqueSorted(courses.map((course) => course.category)),
    tags: uniqueSorted(courses.flatMap((course) => course.tags)),
  };
}
