import { useState } from "react";
type Theme = "light" | "dark";
function currentTheme(): Theme { return document.documentElement.dataset.theme === "dark" ? "dark" : "light"; }
export function ThemeToggle() { const [theme, setTheme] = useState<Theme>(currentTheme); const toggle = () => { const next = theme === "dark" ? "light" : "dark"; document.documentElement.dataset.theme = next; localStorage.setItem("portal-theme", next); setTheme(next); }; return <button className="theme-toggle" type="button" onClick={toggle} aria-label="تغییر پوسته" title="تغییر پوسته">{theme === "dark" ? "☀️" : "🌙"}</button>; }
