"use client";

import { ChevronUp, Eye, EyeOff, MapPin } from "lucide-react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { PASTELS, Photo } from "@/components/photo";
import type { PublicProfile } from "@/lib/types";

/**
 * What the card shows on top of the photo:
 * - `compact`: a slim strip with name, age and city (the default)
 * - `details`: the strip plus bio and interests
 * - `photo`: nothing, so the whole picture is visible
 */
export type CardView = "compact" | "details" | "photo";

/** Interests shown when expanded; the rest stay out of the way. */
const MAX_INTERESTS = 4;

/**
 * Keeps a press on a control from also starting a drag or a tap on the card.
 * It has to be a native listener: the card's gesture handling listens natively
 * and runs before React's synthetic `stopPropagation` could stop it.
 */
const shieldFromCardGestures = (node: HTMLElement | null) => {
  if (!node) return;
  const stop = (event: Event) => event.stopPropagation();
  node.addEventListener("pointerdown", stop);
  return () => node.removeEventListener("pointerdown", stop);
};

type ProfileCardProps = {
  profile: PublicProfile;
  priority?: boolean;
  view?: CardView;
  /** Omit for a static, non-interactive card (the one waiting behind). */
  onViewChange?: (view: CardView) => void;
};

export function ProfileCard({
  profile,
  priority = false,
  view = "compact",
  onViewChange,
}: ProfileCardProps) {
  const reduceMotion = useReducedMotion();
  const hidden = view === "photo";
  const expanded = view === "details";
  const slide = reduceMotion
    ? { duration: 0 }
    : { type: "spring" as const, stiffness: 420, damping: 32 };

  return (
    <article
      aria-label={`${profile.name}, ${profile.age}`}
      className="edge hard bg-soft relative size-full overflow-hidden rounded-[26px]"
    >
      <Photo
        src={profile.photoUrl}
        name={profile.name}
        sizes="(max-width: 440px) 100vw, 440px"
        priority={priority}
      />

      {onViewChange ? (
        <button
          type="button"
          aria-pressed={hidden}
          aria-label={hidden ? "Show details" : "Hide details to see the photo"}
          ref={shieldFromCardGestures}
          onClick={() => onViewChange(hidden ? "compact" : "photo")}
          className="edge hard-sm press bg-paper absolute top-3 right-3 z-10 grid size-10 place-items-center rounded-full"
        >
          {hidden ? (
            <EyeOff aria-hidden className="size-5" strokeWidth={2.5} />
          ) : (
            <Eye aria-hidden className="size-5" strokeWidth={2.5} />
          )}
        </button>
      ) : null}

      <AnimatePresence>
        {hidden ? null : (
          <motion.div
            key="info"
            initial={{ y: 36, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 36, opacity: 0 }}
            transition={slide}
            className="edge bg-paper absolute inset-x-3 bottom-3 rounded-[20px] p-3.5"
          >
            <div className="flex items-center gap-3">
              <div className="min-w-0 flex-1">
                {/* Only the name truncates: the age must never be cut off. */}
                <h2 className="display flex items-baseline gap-2 text-[26px]">
                  <span className="min-w-0 truncate">{profile.name}</span>
                  <span className="text-muted shrink-0 text-[20px] font-bold tracking-normal">
                    {profile.age}
                  </span>
                </h2>
                <p className="text-muted mt-1 flex items-center gap-1 text-sm font-semibold">
                  <MapPin
                    aria-hidden
                    className="size-3.5 shrink-0"
                    strokeWidth={2.5}
                  />
                  <span className="truncate">{profile.location}</span>
                </p>
              </div>
              {onViewChange ? (
                <button
                  type="button"
                  aria-expanded={expanded}
                  aria-label={`${expanded ? "Less" : "More"} about ${profile.name}`}
                  ref={shieldFromCardGestures}
                  onClick={() => onViewChange(expanded ? "compact" : "details")}
                  className="edge hard-sm press bg-yellow grid size-10 shrink-0 place-items-center rounded-full"
                >
                  <ChevronUp
                    aria-hidden
                    className={`size-5 transition-transform ${expanded ? "rotate-180" : ""}`}
                    strokeWidth={3}
                  />
                </button>
              ) : null}
            </div>

            <AnimatePresence initial={false}>
              {expanded ? (
                <motion.div
                  key="more"
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: "auto", opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  transition={slide}
                  className="overflow-hidden"
                >
                  <p className="mt-3 line-clamp-3 text-[15px] leading-snug font-medium">
                    {profile.bio}
                  </p>
                  <ul
                    aria-label="Interests"
                    className="mt-3 flex flex-wrap gap-1.5"
                  >
                    {profile.interests
                      .slice(0, MAX_INTERESTS)
                      .map((interest, i) => (
                        <li
                          key={interest}
                          className={`border-ink rounded-full border-[1.5px] px-2.5 py-0.5 text-xs font-bold ${PASTELS[(i + profile.name.length) % PASTELS.length]}`}
                        >
                          {interest}
                        </li>
                      ))}
                  </ul>
                </motion.div>
              ) : null}
            </AnimatePresence>
          </motion.div>
        )}
      </AnimatePresence>

      {hidden && onViewChange ? (
        <p className="pointer-events-none absolute inset-x-0 bottom-4 flex justify-center">
          <span className="edge hard-sm bg-yellow rounded-full px-3 py-1 text-xs font-bold">
            Tap the photo to show info
          </span>
        </p>
      ) : null}
    </article>
  );
}
