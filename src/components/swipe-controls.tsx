import { Heart, X } from "lucide-react";

type SwipeControlsProps = {
  disabled: boolean;
  onPass: () => void;
  onLike: () => void;
};

export function SwipeControls({
  disabled,
  onPass,
  onLike,
}: SwipeControlsProps) {
  return (
    <div className="flex items-center justify-center gap-7 px-4 pt-4 pb-3">
      <button
        type="button"
        onClick={onPass}
        disabled={disabled}
        aria-label="Pass"
        className="border-line bg-surface text-pass hover:text-ink grid size-16 place-items-center rounded-full border shadow-md transition active:scale-90 disabled:opacity-40"
      >
        <X aria-hidden className="size-8" strokeWidth={2.75} />
      </button>
      <button
        type="button"
        onClick={onLike}
        disabled={disabled}
        aria-label="Like"
        className="bg-brand text-brand-ink shadow-brand/30 hover:bg-brand-strong grid size-16 place-items-center rounded-full shadow-lg transition active:scale-90 disabled:opacity-40"
      >
        <Heart aria-hidden className="size-8 fill-current" />
      </button>
    </div>
  );
}
