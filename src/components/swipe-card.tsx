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
  useState,
  type Ref,
} from "react";
import { ProfileCard, type CardView } from "@/components/profile-card";
import type { PublicProfile, SwipeAction } from "@/lib/types";

/** Drag further than this (px), or flick faster than VELOCITY (px/s), to commit. */
const DISTANCE_THRESHOLD = 110;
const VELOCITY_THRESHOLD = 500;

export type SwipeCardHandle = {
  /** Animate the card off-screen and report the swipe, as a drag would. */
  fling: (action: SwipeAction, note?: string) => void;
};

type SwipeCardProps = {
  profile: PublicProfile;
  onSwiped: (action: SwipeAction, note?: string) => void;
  ref?: Ref<SwipeCardHandle>;
};

/**
 * The interactive top card. Dragging, the on-screen buttons and the arrow keys
 * all end in `fling`, so every swipe plays the same animation and reports once.
 */
export function SwipeCard({ profile, onSwiped, ref }: SwipeCardProps) {
  const x = useMotionValue(0);
  const reduceMotion = useReducedMotion();
  // Each new card starts with the slim info strip.
  const [view, setView] = useState<CardView>("compact");
  // True once the current press has turned into a drag (so it isn't a tap).
  const dragged = useRef(false);
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
    async (action: SwipeAction, note?: string) => {
      if (leaving.current) return; // a card can only be swiped once
      leaving.current = true;
      const distance = window.innerWidth + 260;
      await animate(
        x,
        action === "like" ? distance : -distance,
        reduceMotion ? { duration: 0.1 } : { duration: 0.28, ease: "easeIn" },
      );
      // If the deck was reset mid-animation this card is gone: don't report it.
      if (mounted.current) onSwiped(action, note);
    },
    [onSwiped, reduceMotion, x],
  );

  useImperativeHandle(
    ref,
    () => ({ fling: (action, note) => void fling(action, note) }),
    [fling],
  );

  return (
    <motion.div
      data-testid="swipe-card"
      // motion makes tappable elements focusable; the eye and More buttons are
      // the keyboard path, so the card itself must not be a noisy tab stop.
      tabIndex={-1}
      drag="x"
      dragMomentum={false}
      style={{ x, rotate }}
      onPointerDown={() => {
        dragged.current = false;
      }}
      onDragStart={() => {
        dragged.current = true;
      }}
      // A tap hides or restores the info so the whole photo can be seen. A
      // short drag that snaps back must not count as a tap.
      onTap={() => {
        if (dragged.current) return;
        setView((v) => (v === "photo" ? "compact" : "photo"));
      }}
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
      <ProfileCard
        profile={profile}
        priority
        view={view}
        onViewChange={setView}
      />
      <motion.div
        aria-hidden
        style={{ opacity: likeOpacity }}
        className="edge hard bg-wa pointer-events-none absolute top-16 left-6 -rotate-12 rounded-2xl px-4 py-1 text-3xl font-extrabold tracking-tight"
      >
        LIKE
      </motion.div>
      <motion.div
        aria-hidden
        style={{ opacity: passOpacity }}
        className="edge hard bg-paper pointer-events-none absolute top-16 right-6 rotate-12 rounded-2xl px-4 py-1 text-3xl font-extrabold tracking-tight"
      >
        NOPE
      </motion.div>
    </motion.div>
  );
}
