export function LoadingSkeleton() {
  return (
    <div className="animate-pulse space-y-4 p-6">
      <div className="flex items-center gap-4">
        <div className="w-12 h-12 bg-surface rounded-lg" />
        <div className="flex-1 space-y-2">
          <div className="h-4 bg-surface rounded w-1/3" />
          <div className="h-3 bg-surface rounded w-1/4" />
        </div>
      </div>
      
      <div className="space-y-3">
        {[...Array(5)].map((_, i) => (
          <div key={i} className="flex items-center gap-3 p-3 bg-surface rounded-lg">
            <div className="w-4 h-4 bg-background rounded-full" />
            <div className="flex-1 space-y-2">
              <div className="h-3 bg-background rounded w-2/3" />
              <div className="h-2 bg-background rounded w-1/3" />
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
        <div className="h-10 bg-background rounded mb-3 animate-pulse" />
        <div className="h-6 bg-background rounded w-24 animate-pulse" />
      </div>
      <div className="p-4 space-y-3">
        {[...Array(8)].map((_, i) => (
          <div key={i} className="animate-pulse">
            <div className="flex items-start gap-3 p-3">
              <div className="w-4 h-4 bg-background rounded-full mt-1" />
              <div className="flex-1 space-y-2">
                <div className="h-3 bg-background rounded w-3/4" />
                <div className="h-2 bg-background rounded w-1/2" />
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
