export default function Loading() {
  return (
    <div className="container section" aria-label="Loading collection" role="status">
      <div className="skeleton h-12 w-64 mb-10" />
      <div className="product-grid">
        {[1, 2, 3].map((i) => (
          <div key={i}>
            <div className="skeleton aspect-[4/5]" />
            <div className="skeleton h-5 mt-5 w-2/3" />
          </div>
        ))}
      </div>
      <span className="sr-only">Loading…</span>
    </div>
  );
}
