import { Heart, MessageCircleHeart, X } from "lucide-react";

type SwipeControlsProps = {
  disabled: boolean;
  onPass: () => void;
  onLike: () => void;
  onNote: () => void;
};

export function SwipeControls({
  disabled,
  onPass,
  onLike,
  onNote,
}: SwipeControlsProps) {
  return (
    <div className="short:pt-2 short:pb-2 flex items-center justify-center gap-6 px-4 pt-5 pb-4">
      <button
        type="button"
        onClick={onPass}
        disabled={disabled}
        aria-label="Pass"
        className="edge hard press bg-paper short:size-12 grid size-16 place-items-center rounded-full disabled:opacity-40"
      >
        <X aria-hidden className="size-8" strokeWidth={3} />
      </button>
      <button
        type="button"
        onClick={onNote}
        disabled={disabled}
        aria-label="Write a note"
        className="edge hard press bg-yellow short:size-11 grid size-14 place-items-center rounded-full disabled:opacity-40"
      >
        <MessageCircleHeart aria-hidden className="size-6" strokeWidth={2.5} />
      </button>
      <button
        type="button"
        onClick={onLike}
        disabled={disabled}
        aria-label="Like"
        className="edge hard press bg-pink short:size-12 grid size-16 place-items-center rounded-full disabled:opacity-40"
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
