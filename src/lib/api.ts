import type {
  ApiErrorBody,
  FeedResponse,
  MatchesResponse,
  SwipeAction,
  SwipeResponse,
} from "@/lib/types";

export class ApiError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: string,
    message: string,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  let response: Response;
  try {
    response = await fetch(path, {
      ...init,
      cache: "no-store",
      credentials: "same-origin",
      headers: { "content-type": "application/json", ...init?.headers },
    });
  } catch {
    throw new ApiError(0, "NETWORK_ERROR", "You appear to be offline.");
  }

  if (!response.ok) {
    const body = (await response
      .json()
      .catch(() => null)) as ApiErrorBody | null;
    throw new ApiError(
      response.status,
      body?.error.code ?? "UNKNOWN",
      body?.error.message ?? "Something went wrong.",
    );
  }
  return (await response.json()) as T;
}

export const api = {
  feed: (limit: number) => request<FeedResponse>(`/feed?limit=${limit}`),
  swipe: (profileId: string, action: SwipeAction, note?: string) =>
    request<SwipeResponse>("/swipe", {
      method: "POST",
      body: JSON.stringify({ profileId, action, ...(note ? { note } : {}) }),
    }),
  matches: () => request<MatchesResponse>("/matches"),
  reset: () => request<{ ok: true }>("/api/demo/reset", { method: "POST" }),
};
