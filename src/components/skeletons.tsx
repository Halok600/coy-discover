export function CardSkeleton() {
  return (
    <div
      role="status"
      aria-label="Loading profiles"
      className="edge bg-soft absolute inset-0 animate-pulse rounded-[26px]"
    />
  );
}

export function MatchRowSkeleton() {
  return (
    <div className="edge bg-soft flex animate-pulse items-center gap-4 rounded-[22px] p-3">
      <div className="size-16 rounded-full bg-white" />
      <div className="flex-1 space-y-2">
        <div className="h-4 w-1/2 rounded-full bg-white" />
        <div className="h-3 w-3/4 rounded-full bg-white" />
      </div>
    </div>
  );
}
