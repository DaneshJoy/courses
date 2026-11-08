import type { Center, Course } from "./types";

export const OTHER_TAB_ID = "other";
export const OTHER_TAB_LABEL = "سایر آموزش ها";

export interface CenterTab {
  id: string;
  label: string;
}

/**
 * One tab per registered center, in catalog order, followed by a final tab for
 * courses that name no registered center. Callers never hardcode a center list.
 */
export function centerTabs(centers: readonly Center[]): CenterTab[] {
  return [
    ...centers.map((center) => ({ id: center.id, label: center.name })),
    { id: OTHER_TAB_ID, label: OTHER_TAB_LABEL },
  ];
}

/**
 * The catalog stores resolved center names on each course, so map them back to
 * center ids for tab matching. Center ids are accepted too, and results are
 * deduplicated; values that match no registered center are ignored.
 */
export function courseCenterIds(
  course: Course,
  centers: readonly Center[],
): string[] {
  const ids = new Set<string>();
  for (const value of course.centers ?? []) {
    for (const center of centers) {
      if (center.id === value || center.name === value) ids.add(center.id);
    }
  }
  return [...ids];
}

/** A course belongs to "other" only when none of its centers is registered. */
export function courseMatchesTab(
  course: Course,
  tabId: string,
  centers: readonly Center[],
): boolean {
  const ids = courseCenterIds(course, centers);
  return tabId === OTHER_TAB_ID ? ids.length === 0 : ids.includes(tabId);
}
