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
    <div className="flex items-center justify-center gap-8 px-4 pt-5 pb-4">
      <button
        type="button"
        onClick={onPass}
        disabled={disabled}
        aria-label="Pass"
        className="edge hard press bg-paper grid size-16 place-items-center rounded-full disabled:opacity-40"
      >
        <X aria-hidden className="size-8" strokeWidth={3} />
      </button>
      <button
        type="button"
        onClick={onLike}
        disabled={disabled}
        aria-label="Like"
        className="edge hard press bg-pink grid size-16 place-items-center rounded-full disabled:opacity-40"
      >
        <Heart
          aria-hidden
          className="size-8 fill-white"
          strokeWidth={2.5}
          stroke="var(--ink)"
        />
      </button>
    </div>
  );
}
