"use client";

import Image from "next/image";
import { useState } from "react";
import { hueFor, initials } from "@/lib/format";

type PhotoProps = {
  src: string;
  name: string;
  sizes: string;
  priority?: boolean;
};

/**
 * Fills its (relatively positioned) parent. If the remote image fails to load,
 * falls back to a gradient with the person's initials so a card is never blank.
 */
export function Photo({ src, name, sizes, priority }: PhotoProps) {
  const [failed, setFailed] = useState(false);

  if (failed) {
    const hue = hueFor(name);
    return (
      <div
        aria-hidden
        className="absolute inset-0 grid place-items-center text-6xl font-bold text-white/90"
        style={{
          background: `linear-gradient(135deg, hsl(${hue} 70% 58%), hsl(${(hue + 45) % 360} 70% 42%))`,
        }}
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
      className={`relative shrink-0 overflow-hidden rounded-full ${className}`}
    >
      <Photo src={src} name={name} sizes="96px" />
    </div>
  );
}
