export default function Loading() {
  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8 animate-fade-in">
      <div className="h-3 shimmer rounded w-20 mb-6" />
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-4">
          <div className="h-48 shimmer" />
          <div className="h-8 shimmer w-3/4" />
          <div className="h-36 shimmer" />
          <div className="grid grid-cols-4 gap-2">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="h-16 shimmer" />
            ))}
          </div>
        </div>
        <div className="h-80 shimmer" />
      </div>
    </div>
  );
}
