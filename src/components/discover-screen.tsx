"use client";

import { CloudOff, Heart, PartyPopper, RotateCcw } from "lucide-react";
import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { MatchModal } from "@/components/match-modal";
import { ProfileCard } from "@/components/profile-card";
import { CardSkeleton } from "@/components/skeletons";
import {
  primaryButton,
  secondaryButton,
  StateMessage,
} from "@/components/state-message";
import { SwipeCard, type SwipeCardHandle } from "@/components/swipe-card";
import { SwipeControls } from "@/components/swipe-controls";
import { Toast } from "@/components/toast";
import { useMatches } from "@/lib/queries";
import type { MatchDto, SwipeAction } from "@/lib/types";
import { useDeck } from "@/lib/use-deck";

export function DiscoverScreen() {
  const [pendingMatches, setPendingMatches] = useState<MatchDto[]>([]);
  const [announcement, setAnnouncement] = useState("");
  const [restarting, setRestarting] = useState(false);
  const cardRef = useRef<SwipeCardHandle>(null);

  const handleMatch = useCallback(
    (match: MatchDto) => setPendingMatches((current) => [...current, match]),
    [],
  );
  const deck = useDeck(handleMatch);
  const { data: matchData } = useMatches();

  const top = deck.queue[0];
  const next = deck.queue[1];
  const matchCount = matchData?.matches.length ?? 0;
  const modalOpen = pendingMatches.length > 0;

  const { swipe } = deck;
  const handleSwiped = useCallback(
    (action: SwipeAction) => {
      if (!top) return;
      swipe(top, action);
      setAnnouncement(
        action === "like" ? `Liked ${top.name}` : `Passed ${top.name}`,
      );
    },
    [top, swipe],
  );

  // Desktop: arrow keys swipe the top card.
  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (modalOpen || event.metaKey || event.ctrlKey || event.altKey) return;
      // Don't hijack arrow keys while the user is typing somewhere.
      if (
        event.target instanceof Element &&
        event.target.closest("input, textarea, select, [contenteditable]")
      ) {
        return;
      }
      if (event.key === "ArrowRight") {
        event.preventDefault();
        cardRef.current?.fling("like");
      } else if (event.key === "ArrowLeft") {
        event.preventDefault();
        cardRef.current?.fling("pass");
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [modalOpen]);

  async function handleStartOver() {
    setRestarting(true);
    await deck.startOver();
    setRestarting(false);
  }

  const showCaughtUp = deck.status === "ready" && !top && !deck.hasMore;
  const showSkeleton =
    deck.status === "loading" ||
    (deck.status === "ready" && !top && deck.hasMore);

  return (
    <div className="relative flex h-full flex-col">
      <header className="flex items-center justify-between px-5 pt-5 pb-3">
        <h1 className="text-2xl font-extrabold tracking-tight">Discover</h1>
        <Link
          href="/discover/matches"
          aria-label={matchCount ? `Matches, ${matchCount}` : "Matches"}
          className="border-line bg-surface relative grid size-11 place-items-center rounded-full border shadow-sm transition active:scale-95"
        >
          <Heart aria-hidden className="text-brand size-5" />
          {matchCount > 0 ? (
            <span
              data-testid="match-count"
              className="bg-brand text-brand-ink absolute -top-1 -right-1 grid min-w-5 place-items-center rounded-full px-1 text-xs font-bold"
            >
              {matchCount}
            </span>
          ) : null}
        </Link>
      </header>

      <section aria-label="Profiles" className="relative mx-4 min-h-0 flex-1">
        {showSkeleton ? <CardSkeleton /> : null}

        {deck.status === "error" ? (
          <StateMessage
            icon={CloudOff}
            title="Couldn't load profiles"
            description="Check your connection and try again."
          >
            <button
              type="button"
              onClick={deck.retry}
              className={primaryButton}
            >
              Try again
            </button>
          </StateMessage>
        ) : null}

        {deck.status === "ready" && top ? (
          <>
            {next ? (
              <div
                inert
                aria-hidden
                className="pointer-events-none absolute inset-0 scale-[0.95] opacity-90"
              >
                <ProfileCard profile={next} />
              </div>
            ) : null}
            <SwipeCard
              key={top.id}
              ref={cardRef}
              profile={top}
              onSwiped={handleSwiped}
            />
          </>
        ) : null}

        {showCaughtUp ? (
          <StateMessage
            testId="caught-up"
            icon={PartyPopper}
            title="You're all caught up"
            description="No more profiles right now. Check your matches, or start over."
          >
            <Link href="/discover/matches" className={secondaryButton}>
              See matches
            </Link>
            <button
              type="button"
              onClick={handleStartOver}
              disabled={restarting}
              className={primaryButton}
            >
              <RotateCcw aria-hidden className="size-4" />
              Start over
            </button>
          </StateMessage>
        ) : null}
      </section>

      <SwipeControls
        disabled={!top || modalOpen}
        onPass={() => cardRef.current?.fling("pass")}
        onLike={() => cardRef.current?.fling("like")}
      />
      <p className="text-muted hidden pb-3 text-center text-xs md:block">
        Tip: use the &larr; and &rarr; arrow keys
      </p>

      <Toast message={deck.notice} onDismiss={deck.dismissNotice} />
      <p aria-live="polite" className="sr-only">
        {announcement}
      </p>

      {modalOpen ? (
        <MatchModal
          match={pendingMatches[0]}
          onClose={() => setPendingMatches((current) => current.slice(1))}
        />
      ) : null}
    </div>
  );
}
