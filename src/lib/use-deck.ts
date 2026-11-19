"use client";

import { useQueryClient } from "@tanstack/react-query";
import { useCallback, useEffect, useRef, useState } from "react";
import { api, ApiError } from "@/lib/api";
import { MATCHES_KEY } from "@/lib/queries";
import type { MatchDto, PublicProfile, SwipeAction } from "@/lib/types";

const PAGE_SIZE = 10;
/** Fetch the next page when this many cards (or fewer) are left. */
const PREFETCH_THRESHOLD = 5;
const RETRY_DELAY_MS = 500;

export type DeckStatus = "loading" | "ready" | "error";

/**
 * Client-side swipe deck: a queue of profiles that refills from GET /feed.
 *
 * Swipes are optimistic. The card leaves immediately and POST /swipe runs in
 * the background; if it fails the card returns to the front of the deck. Every
 * swiped id is remembered locally, so a profile can never reappear even while
 * its swipe is still in flight and the server would still return it.
 */
export function useDeck(onMatch: (match: MatchDto) => void) {
  const queryClient = useQueryClient();
  const [queue, setQueue] = useState<PublicProfile[]>([]);
  const [hasMore, setHasMore] = useState(true);
  const [status, setStatus] = useState<DeckStatus>("loading");
  const [notice, setNotice] = useState<string | null>(null);
  // The last attempt to load more profiles failed.
  const [refillFailed, setRefillFailed] = useState(false);

  const seen = useRef(new Set<string>());
  // Notes that were sent but not (yet) saved, so a retry can restore them.
  const drafts = useRef(new Map<string, string>());
  const fetching = useRef(false);
  const retryTimer = useRef<ReturnType<typeof setTimeout> | undefined>(
    undefined,
  );
  const onMatchRef = useRef(onMatch);
  useEffect(() => {
    onMatchRef.current = onMatch;
  });

  // Lets `load` schedule a retry of itself without referencing its own binding.
  const loadRef = useRef<() => Promise<void>>(async () => {});

  const load = useCallback(async () => {
    if (fetching.current) return;
    fetching.current = true;
    try {
      const page = await api.feed(PAGE_SIZE);
      const fresh = page.profiles.filter((p) => !seen.current.has(p.id));
      setQueue((current) => {
        const inQueue = new Set(current.map((p) => p.id));
        const additions = fresh.filter((p) => !inQueue.has(p.id));
        return additions.length ? [...current, ...additions] : current;
      });
      setHasMore(page.hasMore);
      setStatus("ready");
      setRefillFailed(false);
      // The server may still list profiles whose swipe is in flight. If the
      // page added nothing new, look again shortly instead of spinning.
      if (page.hasMore && fresh.length === 0) {
        retryTimer.current = setTimeout(
          () => void loadRef.current(),
          RETRY_DELAY_MS,
        );
      }
    } catch {
      setRefillFailed(true);
      setStatus((current) => (current === "loading" ? "error" : current));
      setNotice("Couldn't load profiles. Check your connection.");
    } finally {
      fetching.current = false;
    }
  }, []);

  useEffect(() => {
    loadRef.current = load;
  }, [load]);

  // Initial load.
  useEffect(() => {
    void load();
    return () => clearTimeout(retryTimer.current);
  }, [load]);

  // Keep the deck topped up.
  useEffect(() => {
    if (status === "ready" && hasMore && queue.length <= PREFETCH_THRESHOLD) {
      void load();
    }
  }, [status, hasMore, queue.length, load]);

  const swipe = useCallback(
    (profile: PublicProfile, action: SwipeAction, note?: string) => {
      seen.current.add(profile.id);
      if (note) drafts.current.set(profile.id, note);
      setQueue((current) => current.filter((p) => p.id !== profile.id));

      api
        .swipe(profile.id, action, note)
        .then((result) => {
          drafts.current.delete(profile.id);
          if (result.matched) {
            onMatchRef.current(result.match);
            void queryClient.invalidateQueries({ queryKey: MATCHES_KEY });
          }
        })
        .catch((error: unknown) => {
          // Already recorded on the server: nothing to undo.
          if (error instanceof ApiError && error.code === "ALREADY_SWIPED") {
            drafts.current.delete(profile.id);
            return;
          }
          seen.current.delete(profile.id);
          setQueue((current) => [profile, ...current]);
          setNotice("Couldn't save that swipe. Please try again.");
        });
    },
    [queryClient],
  );

  const startOver = useCallback(async () => {
    try {
      await api.reset();
    } catch {
      setNotice("Couldn't restart. Please try again.");
      return;
    }
    clearTimeout(retryTimer.current);
    seen.current.clear();
    drafts.current.clear();
    setQueue([]);
    setHasMore(true);
    setRefillFailed(false);
    setStatus("loading");
    await queryClient.invalidateQueries({ queryKey: MATCHES_KEY });
    await load();
  }, [load, queryClient]);

  const retry = useCallback(() => {
    setRefillFailed(false);
    setStatus("loading");
    void load();
  }, [load]);

  const dismissNotice = useCallback(() => setNotice(null), []);

  /** The note typed for a profile whose swipe failed to save, if any. */
  const draftFor = useCallback(
    (profileId: string) => drafts.current.get(profileId) ?? "",
    [],
  );

  return {
    queue,
    hasMore,
    refillFailed,
    status,
    notice,
    swipe,
    startOver,
    retry,
    dismissNotice,
    draftFor,
  };
}
