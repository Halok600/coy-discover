export function CardSkeleton() {
  return (
    <div
      role="status"
      aria-label="Loading profiles"
      className="bg-line absolute inset-0 animate-pulse rounded-3xl"
    />
  );
}

export function MatchRowSkeleton() {
  return (
    <div className="bg-surface flex animate-pulse items-center gap-4 rounded-2xl p-3">
      <div className="bg-line size-14 rounded-full" />
      <div className="flex-1 space-y-2">
        <div className="bg-line h-4 w-1/2 rounded" />
        <div className="bg-line h-3 w-3/4 rounded" />
      </div>
    </div>
  );
}
