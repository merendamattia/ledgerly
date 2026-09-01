export type ReleaseSection = {
  title: string;
  items: string[];
};

export type ReleaseInfo = {
  version: string;
  date: string | null;
  sections: ReleaseSection[];
};

const releaseHeadingPattern =
  /^(?:\[)?v?(\d+\.\d+\.\d+(?:-[0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*)?(?:\+[0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*)?)(?:\])?(?:\([^)]*\))?(?:\s+\((\d{4}-\d{2}-\d{2})\))?\s*$/;
const sectionHeadingPattern = /^#{1,6}\s+(.+?)\s*$/;
const changeItemPattern = /^\s*[-*+]\s+(.+?)\s*$/;

function releaseHeading(line: string): { version: string; date: string | null } | null {
  const heading = line.match(sectionHeadingPattern);
  if (!heading) return null;

  const release = heading[1].trim().match(releaseHeadingPattern);
  if (!release) return null;

  return { version: release[1], date: release[2] ?? null };
}

function cleanMarkdown(value: string): string {
  return value
    .replace(/\[([^\]]+)\]\([^)]*\)/g, (_, label: string) =>
      /^[0-9a-f]{6,40}$/i.test(label.trim()) ? "" : label,
    )
    .replace(/\(\s*\)/g, "")
    .replace(/(\*\*|__|~~|`)/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

/** Parses the newest semantic-release section from a Markdown changelog. */
export function parseLatestRelease(changelog: string): ReleaseInfo {
  const lines = changelog.replace(/\r\n?/g, "\n").split("\n");
  const start = lines.findIndex((line) => releaseHeading(line) !== null);
  if (start === -1) {
    throw new Error("CHANGELOG.md does not contain a semantic release heading");
  }

  const release = releaseHeading(lines[start])!;
  const sections: ReleaseSection[] = [];
  let currentSection: ReleaseSection | null = null;

  for (const line of lines.slice(start + 1)) {
    if (releaseHeading(line)) break;

    const heading = line.match(sectionHeadingPattern);
    if (heading) {
      currentSection = { title: cleanMarkdown(heading[1]), items: [] };
      sections.push(currentSection);
      continue;
    }

    const item = line.match(changeItemPattern);
    if (item && currentSection) {
      currentSection.items.push(cleanMarkdown(item[1]));
      continue;
    }

    if (currentSection && currentSection.items.length > 0 && line.trim()) {
      const continuation = cleanMarkdown(line);
      if (continuation) {
        const index = currentSection.items.length - 1;
        currentSection.items[index] = `${currentSection.items[index]} ${continuation}`;
      }
    }
  }

  return {
    ...release,
    sections: sections.filter((section) => section.items.length > 0),
  };
}
