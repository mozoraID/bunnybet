export default function Loading() {
  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="h-6 shimmer w-48 mb-8 rounded" />
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="bg-cream border border-border-light animate-fade-up"
            style={{ animationDelay: `${i * 35}ms` }}>
            <div className="h-32 shimmer-light" />
            <div className="p-4 space-y-3">
              <div className="h-4 shimmer-light rounded w-3/4" />
              <div className="h-3 shimmer-light rounded w-full" />
              <div className="h-2.5 shimmer-light rounded-none" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
