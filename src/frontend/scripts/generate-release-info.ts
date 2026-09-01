import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { parseLatestRelease } from "./release-info";

const scriptDirectory = dirname(fileURLToPath(import.meta.url));
const changelogPath = resolve(scriptDirectory, "../../../CHANGELOG.md");
const outputPath = resolve(scriptDirectory, "../src/generated/release-info.ts");

/** Generates the client-safe latest release artifact used by the app shell. */
export async function generateReleaseInfo() {
  const changelog = await readFile(changelogPath, "utf8");
  const release = parseLatestRelease(changelog);
  const output = `// Generated from CHANGELOG.md. Do not edit manually.\nimport type { ReleaseInfo } from "../../scripts/release-info";\n\nexport const releaseInfo = ${JSON.stringify(release, null, 2)} satisfies ReleaseInfo;\n`;

  await mkdir(dirname(outputPath), { recursive: true });
  await writeFile(outputPath, output);
}

if (import.meta.main) await generateReleaseInfo();
