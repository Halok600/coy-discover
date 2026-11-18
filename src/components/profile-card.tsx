import { MapPin } from "lucide-react";
import type { PublicProfile } from "@/lib/types";
import { Photo } from "@/components/photo";

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
      className="bg-surface relative size-full overflow-hidden rounded-3xl shadow-xl ring-1 ring-black/5"
    >
      <Photo
        src={profile.photoUrl}
        name={profile.name}
        sizes="(max-width: 440px) 100vw, 440px"
        priority={priority}
      />
      <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/90 via-black/55 to-transparent p-5 pt-28 text-white">
        <h2 className="text-2xl leading-tight font-bold">
          {profile.name}
          <span className="ml-2 font-normal text-white/85">{profile.age}</span>
        </h2>
        <p className="mt-1 flex items-center gap-1 text-sm text-white/85">
          <MapPin aria-hidden className="size-3.5 shrink-0" />
          {profile.location}
        </p>
        <p className="mt-2 line-clamp-3 text-[15px] leading-snug text-white/95">
          {profile.bio}
        </p>
        <ul aria-label="Interests" className="mt-3 flex flex-wrap gap-1.5">
          {profile.interests.map((interest) => (
            <li
              key={interest}
              className="rounded-full bg-white/20 px-2.5 py-1 text-xs font-medium backdrop-blur-sm"
            >
              {interest}
            </li>
          ))}
        </ul>
      </div>
    </article>
  );
}
