type ParsedReleaseVersion = {
  major: number;
  minor: number;
  patch: number;
  prerelease: string[] | null;
};

const releaseVersionPattern =
  /^(?:v)?(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(?:-([0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*))?(?:\+[0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*)?$/;

function parseReleaseVersion(version: string): ParsedReleaseVersion | null {
  const match = version.trim().match(releaseVersionPattern);
  if (!match) return null;

  return {
    major: Number(match[1]),
    minor: Number(match[2]),
    patch: Number(match[3]),
    prerelease: match[4]?.split(".") ?? null,
  };
}

function comparePrerelease(left: string[] | null, right: string[] | null): number {
  if (!left && !right) return 0;
  if (!left) return 1;
  if (!right) return -1;

  const length = Math.max(left.length, right.length);
  for (let index = 0; index < length; index += 1) {
    const leftIdentifier = left[index];
    const rightIdentifier = right[index];
    if (leftIdentifier === undefined) return -1;
    if (rightIdentifier === undefined) return 1;
    if (leftIdentifier === rightIdentifier) continue;

    const leftNumber = /^\d+$/.test(leftIdentifier) ? Number(leftIdentifier) : null;
    const rightNumber = /^\d+$/.test(rightIdentifier) ? Number(rightIdentifier) : null;
    if (leftNumber !== null && rightNumber !== null) return leftNumber - rightNumber;
    if (leftNumber !== null) return -1;
    if (rightNumber !== null) return 1;
    return leftIdentifier < rightIdentifier ? -1 : 1;
  }

  return 0;
}

function compareReleaseVersions(left: ParsedReleaseVersion, right: ParsedReleaseVersion): number {
  for (const key of ["major", "minor", "patch"] as const) {
    if (left[key] !== right[key]) return left[key] - right[key];
  }
  return comparePrerelease(left.prerelease, right.prerelease);
}

/** Returns whether the built release should be shown for the stored user state. */
export function shouldShowReleaseAnnouncement(
  currentVersion: string,
  lastSeenReleaseVersion: string | null | undefined,
): boolean {
  const current = parseReleaseVersion(currentVersion);
  if (!current) return false;
  if (!lastSeenReleaseVersion) return true;

  const lastSeen = parseReleaseVersion(lastSeenReleaseVersion);
  if (!lastSeen) return true;
  return compareReleaseVersions(current, lastSeen) > 0;
}
