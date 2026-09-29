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
- Never link to a heading inside the same file. Refer to the section by name.
- To create a skill, follow `.claude/skills/create-skill/SKILL.md`. It holds the
  workflow and the template; the rules stay here.

## Reference files (`<cloud>/reference/<service>/<topic>.md`)

- Write deltas only. Never restate Learn; link to it instead.
- Every entry has, in order: when to use it, the decision and why, gotchas, an
  IaC snippet, the cost impact, and a `Last verified: YYYY-MM-DD` line.
- Verify every `az` flag against the Learn MCP before writing it. Tag any flag
  you couldn't verify `# verify`.
- Service folder names follow the Azure Well-Architected Framework service
  guides.
- A trap about one service starts in the first skill that needs it. When a
  second skill needs the same trap, move it to
  `<cloud>/reference/<service>/<topic>.md` in the same change, and point both
  skills to it. Never keep two copies.

## Hooks (`<cloud>/hooks/`)

- The guard's rules live in its policy JSON, such as `az-guard-policy.json`. The
  script only parses commands; change what counts as read-only in the JSON.
- The policy and the "What counts as read-only" section of the propose-only
  skill must agree. Change both in the same commit; `pnpm test` checks that
  every `az` command the section names gets the verdict it gives.
- Add a test case to `tests/` for every command you allow or deny on purpose.
- Use Node built-ins only. Hooks run on the user's machine, with whatever Node
  they installed for the Azure MCP.
- A hook only denies. Never make one answer `allow`.
- `pnpm test` must pass.

## Evals (`<cloud>/evals/`)

- Every skill ships with at least three eval cases that should trigger it. Each
  case has an outcome grader, not only a `tool_used: Skill` check, which the
  runner leaves out of the score.
- Every skill also has one case it must not trigger on, such as a tagging task
  for the naming skill. The suite keeps at least one case where no skill should
  fire, and every case runs at least 3 times.
- Name cases `<skill>-NN-<what>`, with the skill name minus its cloud prefix,
  and `neg-NN-<what>` for cases where no skill should fire.
- A change to what a skill tells the agent to do adds or updates a case that
  would fail without the change. Wording-only edits don't need one.
- `pnpm test` checks the rules above that need no model: names, case counts,
  outcome graders and runs.
- Prompts and graders follow the hard rules below: placeholders only.
- A case that lets the agent run commands grants `Bash(az:*)` only, so the guard
  hook is what stands between the agent and Azure.
- Run `pnpm eval` before merging a skill change, or
  `pnpm eval --case "<skill>-*"` for one skill. It has a cost cap built in. Bash
  cases need a sandbox backend: `bubblewrap` and `socat` on Linux, built in on
  macOS. Run it as a non-root user; as root the sandbox can't start a shell.
- `--allow-tools` grants Bash to every case in the run, whatever a case's own
  `allowed_tools` says. Write cases that pass with or without it.

## Versioning

- On any change inside a plugin folder, bump `version` in that plugin's
  `.claude-plugin/plugin.json` and add an entry to that plugin's `CHANGELOG.md`.
  An unbumped version withholds the update from users.
- Exception: while the plugin's top `CHANGELOG.md` entry is still `Unreleased`,
  add to that entry instead of bumping. Bump once that version is tagged.
- Exception: a change only under `<cloud>/evals/` needs no bump and no
  `CHANGELOG.md` entry. Evals ship with the plugin but never load for users.
- Tag a release with `pnpm exec claude plugin tag <cloud>`. It creates
  `<cloud>--vX.Y.Z` and checks that `plugin.json` and the marketplace entry
  agree.
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
- Prettier formats Markdown, JSON and JavaScript, using `.prettierrc.json`:
  `pnpm format`. `pnpm format:check` must pass before committing.

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
