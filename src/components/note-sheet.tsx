"use client";

import { useEffect, useRef } from "react";
import { primaryButton, secondaryButton } from "@/components/state-message";
import { clampNote, NOTE_MAX_LENGTH, noteLength } from "@/lib/note";

type NoteSheetProps = {
  name: string;
  value: string;
  onChange: (value: string) => void;
  onSubmit: () => void;
  onCancel: () => void;
};

/**
 * Bottom sheet for writing a sealed note to go with a like. The note is only
 * ever shown if the like turns into a match. Traps focus, closes on Escape,
 * and submits with Ctrl/Cmd+Enter.
 */
export function NoteSheet({
  name,
  value,
  onChange,
  onSubmit,
  onCancel,
}: NoteSheetProps) {
  const dialogRef = useRef<HTMLFormElement>(null);
  const textRef = useRef<HTMLTextAreaElement>(null);
  const onCancelRef = useRef(onCancel);
  useEffect(() => {
    onCancelRef.current = onCancel;
  });

  useEffect(() => {
    const previouslyFocused = document.activeElement as HTMLElement | null;
    textRef.current?.focus();

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        onCancelRef.current();
        return;
      }
      if (event.key !== "Tab") return;
      // Keep Tab inside the sheet.
      const focusable = dialogRef.current?.querySelectorAll<HTMLElement>(
        "textarea, button:not([disabled])",
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

  const count = noteLength(value);
  const blank = value.trim().length === 0;
  const nearLimit = count >= NOTE_MAX_LENGTH - 20;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="note-title"
      aria-describedby="note-hint"
      data-testid="note-sheet"
      className="bg-ink/75 fixed inset-0 z-50 overflow-y-auto"
    >
      <div className="short:items-center flex min-h-full items-end justify-center p-3 md:items-center">
        <form
          ref={dialogRef}
          onSubmit={(event) => {
            event.preventDefault();
            if (!blank) onSubmit();
          }}
          className="edge hard-lg bg-lilac short:p-3 w-full max-w-sm rounded-[28px] p-5"
        >
          <h2 id="note-title" className="display short:text-[22px] text-[32px]">
            Say something.
          </h2>
          <p
            id="note-hint"
            className="short:mt-1 mt-2 text-sm leading-snug font-medium"
          >
            {name} only sees this if you both like each other. If not, nobody
            ever knows.
          </p>

          <label htmlFor="note-text" className="sr-only">
            Your note to {name}
          </label>
          <textarea
            id="note-text"
            ref={textRef}
            value={value}
            rows={3}
            placeholder="Coffee after the fest?"
            onChange={(event) => onChange(clampNote(event.target.value))}
            onKeyDown={(event) => {
              if (event.key === "Enter" && (event.metaKey || event.ctrlKey)) {
                event.preventDefault();
                if (!blank) onSubmit();
              }
            }}
            className="edge bg-paper short:mt-2 mt-3 w-full resize-none rounded-2xl p-3 text-base font-medium outline-none focus-visible:outline-3 focus-visible:outline-offset-2"
          />
          <p
            aria-live="polite"
            className={`mt-1 text-right text-xs font-bold ${nearLimit ? "font-extrabold" : ""}`}
          >
            {count}/{NOTE_MAX_LENGTH}
          </p>

          <div className="short:mt-2 mt-3 grid grid-cols-[1fr_1.7fr] gap-3">
            <button
              type="button"
              onClick={onCancel}
              className={secondaryButton}
            >
              Cancel
            </button>
            <button type="submit" disabled={blank} className={primaryButton}>
              Like with note
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
