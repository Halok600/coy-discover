"use client";

import { Heart } from "lucide-react";
import { motion, useReducedMotion } from "motion/react";
import Link from "next/link";
import { useEffect, useRef } from "react";
import { Avatar } from "@/components/photo";
import { positiveButton, secondaryButton } from "@/components/state-message";
import type { MatchDto } from "@/lib/types";

// Coy's palette.
const CONFETTI_COLORS = ["#ff3d81", "#ffe45c", "#cbf4e0", "#d7ecff", "#e7e0ff"];
const CONFETTI_COUNT = 22;

function Confetti() {
  return (
    <div
      aria-hidden
      className="pointer-events-none absolute inset-0 grid place-items-center"
    >
      {Array.from({ length: CONFETTI_COUNT }, (_, i) => {
        const angle = (i / CONFETTI_COUNT) * Math.PI * 2;
        const distance = 140 + (i % 3) * 50;
        return (
          <motion.span
            key={i}
            className="border-ink absolute size-3 rounded-sm border-2"
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

/**
 * Full-screen "It's a match!" dialog, modeled on the tilted pink match card on
 * Coy's site. Traps focus and closes on Escape.
 */
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
    // The overlay scrolls, so on a short screen (e.g. a landscape phone) the
    // buttons can always be reached.
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="match-title"
      data-testid="match-modal"
      className="bg-ink/75 fixed inset-0 z-50 overflow-y-auto"
    >
      {reduceMotion ? null : <Confetti />}
      <div className="short:p-3 grid min-h-full place-items-center p-6">
        <motion.div
          ref={dialogRef}
          initial={reduceMotion ? false : { scale: 0.8, opacity: 0, rotate: 8 }}
          animate={{ scale: 1, opacity: 1, rotate: 2 }}
          transition={{ type: "spring", stiffness: 380, damping: 24 }}
          className="edge hard-lg bg-pink short:p-4 relative w-full max-w-sm min-w-0 rounded-[28px] p-7 text-center"
        >
          <div className="flex items-center justify-center">
            <div className="edge bg-peach short:size-16 short:text-lg grid size-24 place-items-center rounded-full text-2xl font-extrabold tracking-tight">
              You
            </div>
            <span className="edge bg-paper short:size-8 z-10 -mx-3 grid size-11 place-items-center rounded-full">
              <Heart
                aria-hidden
                className="fill-pink text-pink size-5"
                strokeWidth={2.5}
              />
            </span>
            <Avatar
              src={profile.photoUrl}
              name={profile.name}
              className="short:size-16 size-24"
            />
          </div>
          <h2
            id="match-title"
            className="display short:mt-2 short:text-[30px] mt-5 text-[44px]"
          >
            It&rsquo;s a match!
          </h2>
          <p className="short:mt-1 short:text-sm mt-3 text-base leading-snug font-medium">
            You and <strong className="font-extrabold">{profile.name}</strong>{" "}
            liked each other.
          </p>
          {match.theirNote ? (
            <figure className="edge hard-sm bg-yellow short:mt-2 short:px-3 short:py-2 mt-4 -rotate-1 rounded-2xl px-4 py-3 text-left">
              <figcaption className="text-xs font-extrabold tracking-wide uppercase">
                {profile.name} wrote
              </figcaption>
              <blockquote className="mt-1 text-[15px] leading-snug font-semibold [overflow-wrap:anywhere]">
                {match.theirNote}
              </blockquote>
            </figure>
          ) : null}
          {match.yourNote ? (
            <p className="short:mt-2 mt-3 text-sm font-semibold [overflow-wrap:anywhere]">
              You wrote:{" "}
              <span className="font-medium">{`\u201C${match.yourNote}\u201D`}</span>
            </p>
          ) : null}
          <div className="short:mt-3 short:gap-2 mt-6 grid gap-3">
            <Link
              href="/discover/matches"
              onClick={onClose}
              className={positiveButton}
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
    </div>
  );
}
