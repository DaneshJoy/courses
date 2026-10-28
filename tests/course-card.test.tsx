import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { CourseCard } from "../src/components/CourseCard";
import type { Course } from "../src/lib/types";

const course: Course = {
  id: "security-basics",
  title: '<img src=x onerror="alert(1)">',
  description: "<strong>Safe text</strong>",
  language: "en",
  dir: "ltr",
  level: "beginner",
  category: "security",
  tags: ["security"],
  lectures: [],
  schemaVersion: "1.0.0",
  templateVersion: "1.0.0",
  license: "CC-BY-4.0",
  updatedAt: "2026-10-29",
};

describe("CourseCard", () => {
  it("preserves the course language and escapes untrusted title and description text", () => {
    const markup = renderToStaticMarkup(<CourseCard course={course} />);

    expect(markup).toContain('dir="ltr"');
    expect(markup).toContain('lang="en"');
    expect(markup).toContain("&lt;img src=x onerror=&quot;alert(1)&quot;&gt;");
    expect(markup).toContain("&lt;strong&gt;Safe text&lt;/strong&gt;");
    expect(markup).not.toContain("<img");
    expect(markup).not.toContain("<strong>");
  });
});
