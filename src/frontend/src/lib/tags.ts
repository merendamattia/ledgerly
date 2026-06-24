// Tags are not a separate entity: they live as #hashtags inside a movement's
// note. These helpers parse them out for display and edit the note string when
// a tag is added or removed (the note stays the single source of truth).

// A hashtag: '#' followed by letters/numbers/_/- (Unicode-aware).
const TAG_RE = /#([\p{L}\p{N}_-]+)/gu;

/** Distinct tag names (without the leading '#') found in a note, in order. */
export function extractTags(note?: string | null): string[] {
  if (!note) return [];
  const seen = new Set<string>();
  const out: string[] = [];
  for (const m of note.matchAll(TAG_RE)) {
    const tag = m[1];
    const key = tag.toLowerCase();
    if (!seen.has(key)) {
      seen.add(key);
      out.push(tag);
    }
  }
  return out;
}

/** Normalize a user-typed tag: strip leading '#', drop invalid chars. */
export function normalizeTag(raw: string): string {
  return raw.replace(/^#+/, "").replace(/[^\p{L}\p{N}_-]/gu, "");
}

/** Append `#tag` to the note unless it's already present (case-insensitive). */
export function addTagToNote(note: string, rawTag: string): string {
  const tag = normalizeTag(rawTag);
  if (!tag) return note;
  const exists = extractTags(note).some((t) => t.toLowerCase() === tag.toLowerCase());
  if (exists) return note;
  const base = note.trimEnd();
  return base ? `${base} #${tag}` : `#${tag}`;
}

/** Remove every `#tag` occurrence from the note, tidying leftover whitespace. */
export function removeTagFromNote(note: string, rawTag: string): string {
  const tag = normalizeTag(rawTag);
  if (!tag) return note;
  const re = new RegExp(`#${tag}\\b`, "giu");
  return note.replace(re, "").replace(/\s{2,}/g, " ").trim();
}
