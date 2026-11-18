"use client";

import { useEffect } from "react";

/** A brief, polite status message. The live region stays mounted so it is announced. */
export function Toast({
  message,
  onDismiss,
}: {
  message: string | null;
  onDismiss: () => void;
}) {
  useEffect(() => {
    if (!message) return;
    const timer = setTimeout(onDismiss, 4500);
    return () => clearTimeout(timer);
  }, [message, onDismiss]);

  return (
    <div
      role="status"
      aria-live="polite"
      className="pointer-events-none absolute inset-x-4 bottom-28 z-40 flex justify-center"
    >
      {message ? (
        <div className="bg-ink text-bg pointer-events-auto rounded-full px-4 py-2 text-sm font-medium shadow-lg">
          {message}
        </div>
      ) : null}
    </div>
  );
}
