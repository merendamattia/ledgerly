import { expect, test } from "bun:test";
import { parseLatestRelease } from "./release-info";

test("parses the first release across heading depths and grouped changes", () => {
  const changelog = `# Changelog

## [2.1.3](https://example.com/compare/v2.1.2...v2.1.3) (2026-08-31)

### Features

* **frontend:** show release notes ([abc123](https://example.com/commit/abc123))

### Bug Fixes

- **settings:** keep acknowledgements per user

# [2.1.2](https://example.com/compare/v2.1.1...v2.1.2) (2026-08-20)

### Features

* this older release must not be included
`;

  expect(parseLatestRelease(changelog)).toEqual({
    version: "2.1.3",
    date: "2026-08-31",
    sections: [
      {
        title: "Features",
        items: ["frontend: show release notes"],
      },
      {
        title: "Bug Fixes",
        items: ["settings: keep acknowledgements per user"],
      },
    ],
  });
});

test("parses a release without a date and stops before another release heading", () => {
  const changelog = `# Changelog

### [1.0.0](https://example.com/compare/v0.9.0...v1.0.0)

### BREAKING CHANGES

* drop the legacy endpoint

## 0.9.0 (2026-01-01)

### Features

* older note
`;

  expect(parseLatestRelease(changelog)).toEqual({
    version: "1.0.0",
    date: null,
    sections: [{ title: "BREAKING CHANGES", items: ["drop the legacy endpoint"] }],
  });
});
