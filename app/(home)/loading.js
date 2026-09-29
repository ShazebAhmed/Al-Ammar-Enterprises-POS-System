export default function Loading() {
  return (
    <main className="container loading-state" aria-busy="true">
      <div className="eyebrow">ONE MOMENT</div>
      <h2>Getting things ready…</h2>
      <div className="skeleton-grid">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="skeleton" />
        ))}
      </div>
    </main>
  );
}
