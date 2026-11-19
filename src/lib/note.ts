/** Longest sealed note, in characters. Enforced by the UI, the API and the database. */
export const NOTE_MAX_LENGTH = 140;

/** Notes are counted in characters (code points), so an emoji counts as one. */
export function noteLength(note: string): number {
  return [...note].length;
}

/** Cuts text to the limit without ever splitting an emoji in half. */
export function clampNote(text: string): string {
  const characters = [...text];
  return characters.length > NOTE_MAX_LENGTH
    ? characters.slice(0, NOTE_MAX_LENGTH).join("")
    : text;
}
