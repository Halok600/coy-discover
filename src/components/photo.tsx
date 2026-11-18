"use client";

import Image from "next/image";
import { useState } from "react";
import { hueFor, initials } from "@/lib/format";

/** Coy's pastel fills, cycled by index. */
export const PASTELS = [
  "bg-lilac",
  "bg-peach",
  "bg-mint",
  "bg-sky",
  "bg-pink-soft",
  "bg-yellow",
] as const;

type PhotoProps = {
  src: string;
  name: string;
  sizes: string;
  priority?: boolean;
};

/**
 * Fills its (relatively positioned) parent. If the remote image fails to load,
 * falls back to a pastel block with the person's initials so a card is never
 * blank.
 */
export function Photo({ src, name, sizes, priority }: PhotoProps) {
  const [failed, setFailed] = useState(false);

  if (failed) {
    return (
      <div
        aria-hidden
        className={`absolute inset-0 grid place-items-center text-6xl font-extrabold tracking-tight ${PASTELS[hueFor(name) % PASTELS.length]}`}
      >
        {initials(name)}
      </div>
    );
  }

  return (
    <Image
      src={src}
      alt=""
      fill
      sizes={sizes}
      priority={priority}
      draggable={false}
      onError={() => setFailed(true)}
      className="object-cover"
    />
  );
}

/** A round, ink-outlined photo, like the avatars on Coy's match card. */
export function Avatar({
  src,
  name,
  className = "size-14",
}: {
  src: string;
  name: string;
  className?: string;
}) {
  return (
    <div
      className={`edge bg-soft relative shrink-0 overflow-hidden rounded-full ${className}`}
    >
      <Photo src={src} name={name} sizes="112px" />
    </div>
  );
}
