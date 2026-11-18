"use client";

import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";

export const MATCHES_KEY = ["matches"] as const;

/** The viewer's mutual matches. Shared by the header badge and the Matches page. */
export function useMatches() {
  return useQuery({ queryKey: MATCHES_KEY, queryFn: api.matches });
}
