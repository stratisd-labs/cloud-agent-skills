# AGENTS.md

These instructions are for agents **maintaining this repo**. Adopters never load
this file.

`cloud-agent-skills` packages Azure architecture and DevOps expertise as agent
skills, distributed as a Claude Code plugin marketplace with one plugin per
cloud. It holds only the deltas on top of Microsoft Learn. For the layout and
the reasoning behind it, read [ARCHITECTURE.md](ARCHITECTURE.md).

## Skills (`<cloud>/skills/<name>/SKILL.md`)

- Name every skill `<cloud>-<verb-phrase>`, for example `azure-cost-review`. The
  folder name and the `name` field must match.
- Name skills after tasks, not resource types. A resource type belongs in
  `reference/`.
- The `description` opens with the cloud name and states when to trigger the
  skill.
- Point to the reference files the skill needs instead of copying their content.
- Any skill that touches cloud state must follow `azure-propose-only`: it
  outputs a plan and never executes one.

## Reference files (`<cloud>/reference/<service>/<topic>.md`)

- Write deltas only. Never restate Learn; link to it instead.
- Every entry has, in order: when to use it, the decision and why, gotchas, an
  IaC snippet, the cost impact, and a `Last verified: YYYY-MM-DD` line.
- Verify every `az` flag against the Learn MCP before writing it. Tag any flag
  you couldn't verify `# verify`.
- Service folder names follow the Azure Well-Architected Framework service
  guides.

## Versioning

- On any change inside a plugin folder, bump `version` in that plugin's
  `.claude-plugin/plugin.json` and add an entry to that plugin's `CHANGELOG.md`.
  An unbumped version withholds the update from users.
- Semver lives in `plugin.json` only. Never add `version` to
  `.claude-plugin/marketplace.json`.

## Dependencies

- Each version lives in exactly one place. Never write a version anywhere else,
  including in docs or workflow `run:` steps:
  - Maintainer tools (Prettier, markdownlint, commitlint, Husky, Claude Code):
    `package.json`, pinned exactly, with `pnpm-lock.yaml`.
  - pnpm: `packageManager` in `package.json`. Workflows read it through
    `pnpm/action-setup`.
  - Node: `.nvmrc`. Workflows read it with `node-version-file`.
  - GitHub Actions: the `uses:` lines in `.github/workflows/`.
  - MCP servers shipped to users: the plugin's `.mcp.json`.
- Renovate (`renovate.json`) tracks all of these. Its Dependency Dashboard issue
  lists every dependency and any pending update.
- A Renovate PR that touches a plugin folder still needs the versioning rule
  above: bump `plugin.json` and add a `CHANGELOG.md` entry before merging.
- A new pinned version in a new kind of file needs a Renovate rule too. Check
  the dashboard lists it.

## Formatting

- Run `pnpm install` once to install the pinned tools. Enable pnpm with
  `corepack enable` if you don't have it.
- Prettier formats Markdown and JSON, using `.prettierrc.json`: `pnpm format`.
  `pnpm format:check` must pass before committing.

## Commits

- Follow [Conventional Commits](https://www.conventionalcommits.org/):
  `type(scope): subject`. The rules are `@commitlint/config-conventional` plus
  the overrides in `commitlint.config.mjs`.
- Allowed types: `build`, `chore`, `ci`, `docs`, `feat`, `fix`, `perf`,
  `refactor`, `revert`, `style`, `test`.
- The scope is optional. When you use one, name the plugin or area, for example
  `feat(azure): ...` or `ci(workflows): ...`.
- Write the subject in the imperative mood, lower case, with no trailing period.
- Keep the header to 72 characters or fewer. Wrap the body at 100.
- Mark a breaking change with `!` before the colon or a `BREAKING CHANGE:`
  footer.
- `pnpm install` installs a Husky `commit-msg` hook that runs commitlint
  locally. The Commitlint workflow re-checks every commit in a pull request.
  Never bypass the hook with `--no-verify`; fix the message instead.

## Markdown

- Never let a line go over 80 characters. This applies to prose, lists and code
  blocks alike.
- Break lines only between words. Never split a word, inline code or a link. A
  shorter line is fine.
- `CLAUDE.md` is exempt and stays the single line `@AGENTS.md`.
- Prettier wraps prose at 80 characters and never splits a link or inline code.
  It doesn't wrap code blocks, so keep their lines under 80 by hand.
- `pnpm lint:md` must pass. The config is `.markdownlint-cli2.jsonc`.

## JSON

- No trailing commas, in `.json` and `.jsonc` alike.
- Use 2-space indents and end every file with a newline.
- Let Prettier decide line breaks: an array stays on one line when it fits in 80
  characters. Don't hand-format against it.
- A long string value, such as a `description`, stays on one line even past 80
  characters. JSON can't split a string, so the 80-column limit covers the
  structure, not string values.

## Hard rules

- **Never write client names, tenant or subscription IDs, resource names, IPs or
  incident details.** Use generic placeholders only (`<SUB>`, `<RG>`, `<APP>`).
- When working against a real Azure subscription while maintaining this repo,
  you are propose-only too. Run read-only commands only and output mutating
  steps as a plan for the human.
