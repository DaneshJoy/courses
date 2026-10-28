export default function App() {
  return (
    <main className="shell">
      <header className="shell__header">
        <h1 className="shell__title">پرتال آموزش هوش مصنوعی</h1>
        {/* ThemeToggle arrives in a later task; this is only the slot for it. */}
        <button className="shell__theme-slot" type="button" disabled>
          تغییر پوسته
        </button>
      </header>
      <div className="shell__placeholder" aria-label="محتوای دوره‌ها" />
    </main>
  );
}
