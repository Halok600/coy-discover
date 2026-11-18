export type ErrorCode =
  | "VALIDATION_ERROR"
  | "PROFILE_NOT_FOUND"
  | "ALREADY_SWIPED"
  | "UNAUTHORIZED"
  | "INTERNAL_ERROR";

/** An error that is safe to show to the client as-is. */
export class AppError extends Error {
  constructor(
    public readonly code: ErrorCode,
    public readonly status: number,
    message: string,
  ) {
    super(message);
    this.name = "AppError";
  }
}

export const errors = {
  profileNotFound: () =>
    new AppError("PROFILE_NOT_FOUND", 404, "That profile does not exist."),
  alreadySwiped: () =>
    new AppError(
      "ALREADY_SWIPED",
      409,
      "You have already swiped on this profile. Swipes are final.",
    ),
  unauthorized: () =>
    new AppError("UNAUTHORIZED", 401, "Missing or invalid credentials."),
};
