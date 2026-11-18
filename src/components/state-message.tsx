import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";

const TONES = {
  lilac: "bg-lilac",
  mint: "bg-mint",
  peach: "bg-peach",
  pink: "bg-pink-soft",
  sky: "bg-sky",
} as const;

type StateMessageProps = {
  icon: LucideIcon;
  title: string;
  description: string;
  tone?: keyof typeof TONES;
  children?: ReactNode;
  testId?: string;
};

/** A pastel Coy card with an icon, title, copy and actions: empty, error and caught-up states. */
export function StateMessage({
  icon: Icon,
  title,
  description,
  tone = "lilac",
  children,
  testId,
}: StateMessageProps) {
  return (
    <div
      data-testid={testId}
      className={`edge hard flex size-full flex-col items-center justify-center gap-3 rounded-[26px] p-7 text-center ${TONES[tone]}`}
    >
      <div className="edge grid size-16 place-items-center rounded-full bg-white">
        <Icon aria-hidden className="size-8" strokeWidth={2.25} />
      </div>
      <h2 className="display text-[28px]">{title}</h2>
      <p className="max-w-[28ch] text-[15px] leading-snug font-medium">
        {description}
      </p>
      {children ? (
        <div className="mt-2 flex flex-wrap justify-center gap-3">
          {children}
        </div>
      ) : null}
    </div>
  );
}

const button =
  "edge hard press inline-flex h-12 items-center justify-center gap-2 rounded-full px-6 text-base font-bold text-ink disabled:opacity-50";

/** Coy's primary action: hot pink with dark text. */
export const primaryButton = `${button} bg-pink`;
export const secondaryButton = `${button} bg-white`;
/** Used where Coy uses its WhatsApp green. */
export const positiveButton = `${button} bg-wa`;
