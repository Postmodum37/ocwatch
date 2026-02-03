export function LoadingSkeleton() {
  return (
    <div className="space-y-4 p-6">
      <div className="flex items-center gap-4">
        <div className="w-12 h-12 bg-surface rounded-lg animate-shimmer" />
        <div className="flex-1 space-y-2">
          <div className="h-4 bg-surface rounded w-1/3 animate-shimmer" />
          <div className="h-3 bg-surface rounded w-1/4 animate-shimmer" />
        </div>
      </div>
      
      <div className="space-y-3">
        {[...Array(5)].map((_, i) => (
          <div key={i} className="flex items-center gap-3 p-3 bg-surface rounded-lg">
            <div className="w-4 h-4 bg-background rounded-full animate-shimmer" />
            <div className="flex-1 space-y-2">
              <div className="h-3 bg-background rounded w-2/3 animate-shimmer" />
              <div className="h-2 bg-background rounded w-1/3 animate-shimmer" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export function SessionListSkeleton() {
  return (
    <div className="w-[280px] h-full bg-surface border-r border-border">
      <div className="p-4 border-b border-border">
        <div className="h-10 rounded mb-3 animate-shimmer" />
        <div className="h-6 rounded w-24 animate-shimmer" />
      </div>
      <div className="p-4 space-y-3">
        {[...Array(8)].map((_, i) => (
          <div key={i}>
            <div className="flex items-start gap-3 p-3">
              <div className="w-4 h-4 rounded-full mt-1 animate-shimmer" />
              <div className="flex-1 space-y-2">
                <div className="h-3 rounded w-3/4 animate-shimmer" />
                <div className="h-2 rounded w-1/2 animate-shimmer" />
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
