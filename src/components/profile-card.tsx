import { MapPin } from "lucide-react";
import { Photo, PASTELS } from "@/components/photo";
import type { PublicProfile } from "@/lib/types";

/** Interests shown on the card; the rest stay out of the way. */
const MAX_INTERESTS = 4;

export function ProfileCard({
  profile,
  priority = false,
}: {
  profile: PublicProfile;
  priority?: boolean;
}) {
  return (
    <article
      aria-label={`${profile.name}, ${profile.age}`}
      className="edge hard bg-soft relative size-full overflow-hidden rounded-[26px]"
    >
      <Photo
        src={profile.photoUrl}
        name={profile.name}
        sizes="(max-width: 440px) 100vw, 440px"
        priority={priority}
      />
      {/* A sticker-style info panel, like the cards on Coy's site. */}
      <div className="edge bg-paper absolute inset-x-3 bottom-3 rounded-[20px] p-4">
        <h2 className="display text-[30px]">
          {profile.name}
          <span className="text-muted ml-2 text-[22px] font-bold tracking-normal">
            {profile.age}
          </span>
        </h2>
        <p className="text-muted mt-1.5 flex items-center gap-1 text-sm font-semibold">
          <MapPin aria-hidden className="size-3.5 shrink-0" strokeWidth={2.5} />
          {profile.location}
        </p>
        <p className="mt-2 line-clamp-2 text-[15px] leading-snug font-medium">
          {profile.bio}
        </p>
        <ul aria-label="Interests" className="mt-3 flex flex-wrap gap-1.5">
          {profile.interests.slice(0, MAX_INTERESTS).map((interest, i) => (
            <li
              key={interest}
              className={`border-ink rounded-full border-[1.5px] px-2.5 py-0.5 text-xs font-bold ${PASTELS[(i + profile.name.length) % PASTELS.length]}`}
            >
              {interest}
            </li>
          ))}
        </ul>
      </div>
    </article>
  );
}
