import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";

type StateMessageProps = {
  icon: LucideIcon;
  title: string;
  description: string;
  children?: ReactNode;
  testId?: string;
};

/** Centered icon + title + copy + actions, for empty, error and caught-up states. */
export function StateMessage({
  icon: Icon,
  title,
  description,
  children,
  testId,
}: StateMessageProps) {
  return (
    <div
      data-testid={testId}
      className="border-line bg-surface/60 flex size-full flex-col items-center justify-center gap-3 rounded-3xl border border-dashed p-8 text-center"
    >
      <div className="bg-brand/10 text-brand grid size-16 place-items-center rounded-full">
        <Icon aria-hidden className="size-8" />
      </div>
      <h2 className="text-xl font-bold">{title}</h2>
      <p className="text-muted max-w-[26ch] text-sm">{description}</p>
      {children ? (
        <div className="mt-2 flex flex-wrap justify-center gap-3">
          {children}
        </div>
      ) : null}
    </div>
  );
}

export const primaryButton =
  "inline-flex h-11 items-center justify-center gap-2 rounded-full bg-brand px-5 text-sm font-semibold text-brand-ink transition hover:bg-brand-strong active:scale-95 disabled:opacity-50";

export const secondaryButton =
  "inline-flex h-11 items-center justify-center gap-2 rounded-full border border-line bg-surface px-5 text-sm font-semibold text-ink transition hover:bg-line/50 active:scale-95 disabled:opacity-50";
