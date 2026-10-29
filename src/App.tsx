import { useEffect, useMemo, useState } from "react";
import { CourseCard } from "./components/CourseCard";
import { EmptyState } from "./components/EmptyState";
import { ErrorState } from "./components/ErrorState";
import { Filters } from "./components/Filters";
import { LoadingState } from "./components/LoadingState";
import { SearchBox } from "./components/SearchBox";
import { ThemeToggle } from "./components/ThemeToggle";
import { catalogError, courses } from "./lib/catalog";
import { normalizePersian } from "./lib/normalize";
import { filterCourses, filtersFrom, searchCourses } from "./lib/search";
import type { Filters as FiltersValue } from "./lib/types";
export default function App() { const [status, setStatus] = useState<"loading" | "ready">("loading"); const [query, setQuery] = useState(""); const [filters, setFilters] = useState<FiltersValue>({}); useEffect(() => setStatus("ready"), []); const shownCourses = useMemo(() => filterCourses(searchCourses(courses, normalizePersian(query)), filters), [query, filters]); const options = useMemo(() => filtersFrom(courses), []); return <main className="shell"><header className="shell__header"><h1 className="shell__title">پرتال دوره‌های آموزشی</h1><ThemeToggle /><SearchBox value={query} onChange={setQuery} /><Filters options={options} value={filters} onChange={setFilters} /></header><section className="course-list" aria-live="polite">{status === "loading" ? <LoadingState /> : catalogError ? <ErrorState message={catalogError} /> : shownCourses.length === 0 ? <EmptyState /> : shownCourses.map((course) => <CourseCard key={course.id} course={course} />)}</section></main>; }
