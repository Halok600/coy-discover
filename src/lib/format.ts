export function initials(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("");
}

/** A stable hue (0-359) for a name, used for placeholder avatars. */
export function hueFor(name: string): number {
  let hash = 0;
  for (const char of name) hash = (hash * 31 + char.charCodeAt(0)) % 360;
  return hash;
}

const RELATIVE_UNITS: [Intl.RelativeTimeFormatUnit, number][] = [
  ["day", 86_400_000],
  ["hour", 3_600_000],
  ["minute", 60_000],
];

/** "just now", "5 minutes ago", "2 days ago". */
export function timeAgo(iso: string, now: number = Date.now()): string {
  const elapsed = now - Date.parse(iso);
  const formatter = new Intl.RelativeTimeFormat("en", { numeric: "auto" });
  for (const [unit, size] of RELATIVE_UNITS) {
    if (elapsed >= size) {
      return formatter.format(-Math.floor(elapsed / size), unit);
    }
  }
  return "just now";
}
