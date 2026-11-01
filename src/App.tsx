import { useEffect, useMemo, useState } from "react";
import { CourseCard } from "./components/CourseCard";
import { EmptyState } from "./components/EmptyState";
import { ErrorState } from "./components/ErrorState";
import { LoadingState } from "./components/LoadingState";
import { SearchBox } from "./components/SearchBox";
import { ThemeToggle } from "./components/ThemeToggle";
import { catalogError, courses } from "./lib/catalog";
import { normalizePersian } from "./lib/normalize";
import { searchCourses } from "./lib/search";

const tabs = [
  { id: "shahed-university", label: "🎓 دانشگاه شاهد" },
  { id: "jahad-sharif", label: "🎓 جهاد دانشگاهی صنعتی شریف" },
  { id: "other", label: "🎓 سایر آموزش ها" },
] as const;

const centerLabels: Record<(typeof tabs)[number]["id"], string> = {
  "shahed-university": "دانشگاه شاهد",
  "jahad-sharif": "جهاد دانشگاهی صنعتی شریف",
  other: "",
};
type TabId = (typeof tabs)[number]["id"];

export default function App() {
  const [status, setStatus] = useState<"loading" | "ready">("loading");
  const [query, setQuery] = useState("");
  const [activeTab, setActiveTab] = useState<TabId>("shahed-university");
  useEffect(() => setStatus("ready"), []);

  const shownCourses = useMemo(() => {
    const searched = searchCourses(courses, normalizePersian(query));
    return searched.filter((course) => activeTab === "other"
      ? !course.centers?.some((center) => Object.entries(centerLabels).some(([id, label]) => id !== "other" && (center === id || center === label)))
      : course.centers?.some((center) => center === activeTab || center === centerLabels[activeTab]));
  }, [query, activeTab]);

  return <main className="shell"><header className="shell__header"><div><h1 className="shell__title">پورتال <span>دوره‌های آموزشی</span></h1><p className="shell__subtitle">سعید محققی</p></div><ThemeToggle /><SearchBox value={query} onChange={setQuery} /><div className="catalog-tabs" role="tablist" aria-label="دسته‌بندی دوره‌ها">{tabs.map((tab) => <button key={tab.id} id={`tab-${tab.id}`} type="button" role="tab" aria-selected={activeTab === tab.id} aria-controls="course-panel" onClick={() => setActiveTab(tab.id)}>{tab.label}</button>)}</div></header><section id="course-panel" role="tabpanel" aria-labelledby={`tab-${activeTab}`} className="course-list" aria-live="polite">{status === "loading" ? <LoadingState /> : catalogError ? <ErrorState message={catalogError} /> : shownCourses.length === 0 ? <EmptyState /> : shownCourses.map((course) => <CourseCard key={course.id} course={course} />)}</section></main>;
}
