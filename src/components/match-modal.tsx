"use client";

import { Heart } from "lucide-react";
import { motion, useReducedMotion } from "motion/react";
import Link from "next/link";
import { useEffect, useRef } from "react";
import { Avatar } from "@/components/photo";
import { primaryButton, secondaryButton } from "@/components/state-message";
import type { MatchDto } from "@/lib/types";

const CONFETTI_COLORS = ["#e11d5a", "#fb923c", "#facc15", "#4ade80", "#38bdf8"];
const CONFETTI_COUNT = 20;

function Confetti() {
  return (
    <div
      aria-hidden
      className="pointer-events-none absolute inset-0 grid place-items-center"
    >
      {Array.from({ length: CONFETTI_COUNT }, (_, i) => {
        const angle = (i / CONFETTI_COUNT) * Math.PI * 2;
        const distance = 130 + (i % 3) * 45;
        return (
          <motion.span
            key={i}
            className="absolute size-2.5 rounded-sm"
            style={{
              backgroundColor: CONFETTI_COLORS[i % CONFETTI_COLORS.length],
            }}
            initial={{ x: 0, y: 0, opacity: 1, scale: 1, rotate: 0 }}
            animate={{
              x: Math.cos(angle) * distance,
              y: Math.sin(angle) * distance + 40,
              opacity: 0,
              scale: 0.6,
              rotate: 240,
            }}
            transition={{ duration: 1.1, ease: "easeOut" }}
          />
        );
      })}
    </div>
  );
}

type MatchModalProps = {
  match: MatchDto;
  onClose: () => void;
};

/** Full-screen "It's a match!" dialog with focus management and Escape to close. */
export function MatchModal({ match, onClose }: MatchModalProps) {
  const reduceMotion = useReducedMotion();
  const dialogRef = useRef<HTMLDivElement>(null);
  const keepSwipingRef = useRef<HTMLButtonElement>(null);
  const onCloseRef = useRef(onClose);
  useEffect(() => {
    onCloseRef.current = onClose;
  });

  useEffect(() => {
    const previouslyFocused = document.activeElement as HTMLElement | null;
    keepSwipingRef.current?.focus();

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        onCloseRef.current();
        return;
      }
      if (event.key !== "Tab") return;
      // Keep Tab inside the dialog.
      const focusable = dialogRef.current?.querySelectorAll<HTMLElement>(
        "a[href], button:not([disabled])",
      );
      if (!focusable?.length) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    }

    window.addEventListener("keydown", onKeyDown);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      previouslyFocused?.focus?.();
    };
  }, []);

  const { profile } = match;
  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="match-title"
      data-testid="match-modal"
      className="fixed inset-0 z-50 grid place-items-center bg-black/70 p-6 backdrop-blur-sm"
    >
      {reduceMotion ? null : <Confetti />}
      <motion.div
        ref={dialogRef}
        initial={reduceMotion ? false : { scale: 0.85, opacity: 0, y: 16 }}
        animate={{ scale: 1, opacity: 1, y: 0 }}
        transition={{ type: "spring", stiffness: 380, damping: 26 }}
        className="bg-surface relative w-full max-w-sm rounded-3xl p-7 text-center shadow-2xl"
      >
        <div className="flex items-center justify-center -space-x-5">
          <div className="from-brand ring-surface grid size-24 place-items-center rounded-full bg-gradient-to-br to-orange-400 text-xl font-bold text-white ring-4">
            You
          </div>
          <Avatar
            src={profile.photoUrl}
            name={profile.name}
            className="ring-surface size-24 ring-4"
          />
        </div>
        <h2
          id="match-title"
          className="text-brand mt-6 flex items-center justify-center gap-2 text-3xl font-extrabold tracking-tight"
        >
          <Heart aria-hidden className="size-7 fill-current" />
          It&rsquo;s a match!
        </h2>
        <p className="text-muted mt-2">
          You and <strong className="text-ink">{profile.name}</strong> liked
          each other.
        </p>
        <div className="mt-6 grid gap-3">
          <Link
            href="/discover/matches"
            onClick={onClose}
            className={primaryButton}
          >
            See matches
          </Link>
          <button
            ref={keepSwipingRef}
            type="button"
            onClick={onClose}
            className={secondaryButton}
          >
            Keep swiping
          </button>
        </div>
      </motion.div>
    </div>
  );
}
