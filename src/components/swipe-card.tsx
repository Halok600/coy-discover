"use client";

import {
  animate,
  motion,
  useMotionValue,
  useReducedMotion,
  useTransform,
} from "motion/react";
import {
  useCallback,
  useEffect,
  useImperativeHandle,
  useRef,
  type Ref,
} from "react";
import { ProfileCard } from "@/components/profile-card";
import type { PublicProfile, SwipeAction } from "@/lib/types";

/** Drag further than this (px), or flick faster than VELOCITY (px/s), to commit. */
const DISTANCE_THRESHOLD = 110;
const VELOCITY_THRESHOLD = 500;

export type SwipeCardHandle = {
  /** Animate the card off-screen and report the swipe, as a drag would. */
  fling: (action: SwipeAction) => void;
};

type SwipeCardProps = {
  profile: PublicProfile;
  onSwiped: (action: SwipeAction) => void;
  ref?: Ref<SwipeCardHandle>;
};

/**
 * The interactive top card. Dragging, the on-screen buttons and the arrow keys
 * all end in `fling`, so every swipe plays the same animation and reports once.
 */
export function SwipeCard({ profile, onSwiped, ref }: SwipeCardProps) {
  const x = useMotionValue(0);
  const reduceMotion = useReducedMotion();
  const rotate = useTransform(
    x,
    [-220, 0, 220],
    reduceMotion ? [0, 0, 0] : [-14, 0, 14],
  );
  const likeOpacity = useTransform(x, [30, 130], [0, 1]);
  const passOpacity = useTransform(x, [-130, -30], [1, 0]);

  const leaving = useRef(false);
  const mounted = useRef(true);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  const fling = useCallback(
    async (action: SwipeAction) => {
      if (leaving.current) return; // a card can only be swiped once
      leaving.current = true;
      const distance = window.innerWidth + 260;
      await animate(
        x,
        action === "like" ? distance : -distance,
        reduceMotion ? { duration: 0.1 } : { duration: 0.28, ease: "easeIn" },
      );
      // If the deck was reset mid-animation this card is gone: don't report it.
      if (mounted.current) onSwiped(action);
    },
    [onSwiped, reduceMotion, x],
  );

  useImperativeHandle(ref, () => ({ fling: (action) => void fling(action) }), [
    fling,
  ]);

  return (
    <motion.div
      data-testid="swipe-card"
      drag="x"
      dragMomentum={false}
      style={{ x, rotate }}
      onDragEnd={(_, info) => {
        if (
          info.offset.x > DISTANCE_THRESHOLD ||
          info.velocity.x > VELOCITY_THRESHOLD
        ) {
          void fling("like");
        } else if (
          info.offset.x < -DISTANCE_THRESHOLD ||
          info.velocity.x < -VELOCITY_THRESHOLD
        ) {
          void fling("pass");
        } else {
          animate(x, 0, { type: "spring", stiffness: 520, damping: 34 });
        }
      }}
      className="absolute inset-0 cursor-grab touch-pan-y select-none active:cursor-grabbing"
    >
      <ProfileCard profile={profile} priority />
      <motion.div
        aria-hidden
        style={{ opacity: likeOpacity }}
        className="edge hard bg-wa pointer-events-none absolute top-8 left-6 -rotate-12 rounded-2xl px-4 py-1 text-3xl font-extrabold tracking-tight"
      >
        LIKE
      </motion.div>
      <motion.div
        aria-hidden
        style={{ opacity: passOpacity }}
        className="edge hard bg-paper pointer-events-none absolute top-8 right-6 rotate-12 rounded-2xl px-4 py-1 text-3xl font-extrabold tracking-tight"
      >
        NOPE
      </motion.div>
    </motion.div>
  );
}
