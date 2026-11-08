import { useEffect, useMemo, useState } from "react";
import { CourseCard } from "./components/CourseCard";
import { EmptyState } from "./components/EmptyState";
import { ErrorState } from "./components/ErrorState";
import { LoadingState } from "./components/LoadingState";
import { SearchBox } from "./components/SearchBox";
import { ThemeToggle } from "./components/ThemeToggle";
import { catalogError, centers, courses } from "./lib/catalog";
import { centerTabs, courseMatchesTab, OTHER_TAB_ID } from "./lib/centers";
import { normalizePersian } from "./lib/normalize";
import { searchCourses } from "./lib/search";

// Center tabs come from the generated catalog (data/centers.json), plus a final
// tab for courses that name no registered center.
const tabs = centerTabs(centers);
const initialTabId = centers[0]?.id ?? OTHER_TAB_ID;

export default function App() {
  const [status, setStatus] = useState<"loading" | "ready">("loading");
  const [query, setQuery] = useState("");
  const [activeTab, setActiveTab] = useState(initialTabId);
  useEffect(() => setStatus("ready"), []);

  const shownCourses = useMemo(() => {
    const searched = searchCourses(courses, normalizePersian(query));
    return searched.filter((course) => courseMatchesTab(course, activeTab, centers));
  }, [query, activeTab]);

  return (
    <main className="shell">
      <header className="shell__header">
        <div>
          <h1 className="shell__title">
            پورتال <span>دوره‌های آموزشی</span>
          </h1>
          <p className="shell__subtitle">سعید محققی</p>
        </div>
        <ThemeToggle />
        <SearchBox value={query} onChange={setQuery} />
        <div className="catalog-tabs" role="tablist" aria-label="دسته‌بندی دوره‌ها">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              id={`tab-${tab.id}`}
              type="button"
              role="tab"
              aria-selected={activeTab === tab.id}
              aria-controls="course-panel"
              onClick={() => setActiveTab(tab.id)}
            >
              🎓 {tab.label}
            </button>
          ))}
        </div>
      </header>
      <section
        id="course-panel"
        role="tabpanel"
        aria-labelledby={`tab-${activeTab}`}
        className="course-list"
        aria-live="polite"
      >
        {status === "loading" ? (
          <LoadingState />
        ) : catalogError ? (
          <ErrorState message={catalogError} />
        ) : shownCourses.length === 0 ? (
          <EmptyState />
        ) : (
          shownCourses.map((course) => <CourseCard key={course.id} course={course} />)
        )}
      </section>
    </main>
  );
}
