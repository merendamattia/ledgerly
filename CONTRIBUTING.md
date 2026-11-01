# Contributing

Start with the [development guide](docs/development.md) for Bun setup, local services, migrations
and checks. [PRODUCT.md](PRODUCT.md) describes product priorities; [DESIGN.md](DESIGN.md) is the
interface design source. Coding agents must follow [AGENTS.md](AGENTS.md).

## Set up a branch and hooks

Fork and clone the repository, add `https://github.com/merendamattia/ledgerly.git` as `upstream`,
and branch from the current `develop`:

```bash
git fetch upstream
git switch -c feature/your-change upstream/develop
```

Install application dependencies and generate Prisma using [local setup](docs/development.md#local-setup).
`requirements.txt` installs only the Python Git-hook tool, not the application dependencies.
If the pinned pre-commit version is not already available, install it in your Python environment:

```bash
pip install -r requirements.txt
pre-commit install
pre-commit install --hook-type commit-msg
```

## Make and validate changes

Keep one logical change per commit. Reuse existing components and services, follow TypeScript
and ESLint conventions, and add a concrete behavior regression test for non-trivial logic or bug
fixes. Keep functions focused; comment on decisions that are not apparent from the code.
Preserve validation, owner isolation, accessibility and data-loss protections.

Update the appropriate [documentation guide](docs/README.md) when behavior, setup, configuration or
architecture changes. Keep README focused on users and technical runbooks in `docs/`. For UI
work, follow DESIGN and the EN/IT localization rules in AGENTS.

Before committing, review the complete diff and run [validation](docs/development.md#validation):
all pre-commit hooks, migrations against an isolated test database, typecheck, lint, tests and both
builds. Exercise the affected path at runtime. Do not bypass hooks or defer known failures to CI.

## Conventional Commits

Use `type(scope): imperative outcome`, for example:

```text
docs(readme): explain the first-use workflow
```

Keep the subject short, lowercase and without a trailing period. Use the body for what changed,
why, affected files and validation; reference related issues in the footer. Allowed types are
`feat`, `fix`, `docs`, `style`, `refactor`, `test`, `chore`, `ci`, `build`, `perf`, `ops`, `merge`
and `revert`, as defined in [git-conventional-commits.yaml](git-conventional-commits.yaml).
Breaking changes use `!` and a `BREAKING CHANGE:` footer. The commit-msg hook validates the format;
the [release workflow](.github/workflows/semantic-release.yaml) defines release behavior.

## Submit a pull request

Fetch upstream updates and bring your branch up to date with `upstream/develop`, resolving conflicts
and rerunning affected checks. Push your feature branch to your fork and open a PR targeting
**develop**, never `main`. Do not push directly to protected base branches or force-push shared work.

Describe the problem, resulting behavior and actual validation. Link the originating issue with
`Closes #<number>` for a same-repository issue. Use real Markdown line breaks. Keep unrelated changes
out of the PR, confirm it is mergeable, and respond to review feedback. Automated checks and the
repository's required reviews must pass before maintainers merge.

Report bugs and feature requests through the repository's issue templates. Follow the
[Code of Conduct](CODE_OF_CONDUCT.md) in all project discussions.
