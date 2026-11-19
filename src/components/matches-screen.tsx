"use client";

import { ArrowLeft, CloudOff, HeartHandshake, MapPin } from "lucide-react";
import Link from "next/link";
import { Avatar, PASTELS } from "@/components/photo";
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
      <header className="flex items-center gap-4 px-5 pt-5 pb-4">
        <Link
          href="/discover"
          aria-label="Back to Discover"
          className="edge hard press bg-paper grid size-12 place-items-center rounded-full"
        >
          <ArrowLeft aria-hidden className="size-6" strokeWidth={2.75} />
        </Link>
        <h1 className="display text-[38px]">Matches</h1>
      </header>

      <div className="flex-1 px-5 pb-5">
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
              tone="peach"
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
              tone="lilac"
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
          <ul className="space-y-4" aria-label="Your matches">
            {data.matches.map(
              ({ id, matchedAt, profile, theirNote }, index) => (
                <li
                  key={id}
                  data-testid="match-item"
                  className={`edge hard flex items-center gap-4 rounded-[22px] p-3 ${PASTELS[index % PASTELS.length]}`}
                >
                  <Avatar
                    src={profile.photoUrl}
                    name={profile.name}
                    className="size-16"
                  />
                  <div className="min-w-0 flex-1">
                    <h2 className="truncate text-xl leading-tight font-extrabold tracking-tight">
                      {profile.name}
                      <span className="ml-1.5 font-bold opacity-60">
                        {profile.age}
                      </span>
                    </h2>
                    <p className="flex items-center gap-1 truncate text-sm font-semibold">
                      <MapPin
                        aria-hidden
                        className="size-3.5 shrink-0"
                        strokeWidth={2.5}
                      />
                      {profile.location}
                    </p>
                    {theirNote ? (
                      <p className="mt-1 line-clamp-2 text-sm font-semibold [overflow-wrap:anywhere] italic">
                        {`\u201C${theirNote}\u201D`}
                      </p>
                    ) : null}
                    <p className="edge bg-paper mt-1.5 inline-block rounded-full px-2 py-px text-xs font-bold">
                      Matched {timeAgo(matchedAt)}
                    </p>
                  </div>
                </li>
              ),
            )}
          </ul>
        ) : null}
      </div>
    </div>
  );
}
