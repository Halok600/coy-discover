"use client";

import { ArrowLeft, CloudOff, HeartHandshake, MapPin } from "lucide-react";
import Link from "next/link";
import { Avatar } from "@/components/photo";
import { MatchRowSkeleton } from "@/components/skeletons";
import {
  primaryButton,
  secondaryButton,
  StateMessage,
} from "@/components/state-message";
import { timeAgo } from "@/lib/format";
import { useMatches } from "@/lib/queries";

export function MatchesScreen() {
  const { data, isPending, isError, refetch } = useMatches();

  return (
    <div className="flex min-h-full flex-col">
      <header className="flex items-center gap-3 px-4 pt-5 pb-3">
        <Link
          href="/discover"
          aria-label="Back to Discover"
          className="border-line bg-surface grid size-11 place-items-center rounded-full border shadow-sm transition active:scale-95"
        >
          <ArrowLeft aria-hidden className="size-5" />
        </Link>
        <h1 className="text-2xl font-extrabold tracking-tight">Matches</h1>
      </header>

      <div className="flex-1 px-4 pb-4">
        {isPending ? (
          <div className="space-y-3" role="status" aria-label="Loading matches">
            <MatchRowSkeleton />
            <MatchRowSkeleton />
            <MatchRowSkeleton />
          </div>
        ) : null}

        {isError ? (
          <div className="h-80">
            <StateMessage
              icon={CloudOff}
              title="Couldn't load matches"
              description="Check your connection and try again."
            >
              <button
                type="button"
                onClick={() => refetch()}
                className={primaryButton}
              >
                Try again
              </button>
            </StateMessage>
          </div>
        ) : null}

        {data && data.matches.length === 0 ? (
          <div className="h-80">
            <StateMessage
              testId="no-matches"
              icon={HeartHandshake}
              title="No matches yet"
              description="A match appears here when you and someone else like each other."
            >
              <Link href="/discover" className={secondaryButton}>
                Keep swiping
              </Link>
            </StateMessage>
          </div>
        ) : null}

        {data && data.matches.length > 0 ? (
          <ul className="space-y-3" aria-label="Your matches">
            {data.matches.map(({ id, matchedAt, profile }) => (
              <li
                key={id}
                data-testid="match-item"
                className="border-line bg-surface flex items-center gap-4 rounded-2xl border p-3 shadow-sm"
              >
                <Avatar src={profile.photoUrl} name={profile.name} />
                <div className="min-w-0 flex-1">
                  <h2 className="truncate font-semibold">
                    {profile.name}
                    <span className="text-muted ml-1.5 font-normal">
                      {profile.age}
                    </span>
                  </h2>
                  <p className="text-muted flex items-center gap-1 truncate text-sm">
                    <MapPin aria-hidden className="size-3.5 shrink-0" />
                    {profile.location}
                  </p>
                  <p className="text-brand text-xs">
                    Matched {timeAgo(matchedAt)}
                  </p>
                </div>
              </li>
            ))}
          </ul>
        ) : null}
      </div>
    </div>
  );
}
