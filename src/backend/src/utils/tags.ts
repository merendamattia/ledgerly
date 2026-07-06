const TAG_RE = /#([\p{L}\p{N}_-]+)/gu;

/** Distinct hashtag names, without "#", in first-seen order. */
export function extractTags(note?: string | null): string[] {
  if (!note) return [];
  const seen = new Set<string>();
  const out: string[] = [];
  for (const match of note.matchAll(TAG_RE)) {
    const tag = match[1];
    const key = tag.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(tag);
  }
  return out;
}
