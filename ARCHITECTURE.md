# Architecture

This repo packages cloud architecture and DevOps expertise for agents only.
Agents combine three sources:

- The **Azure MCP**, read-only, for live state.
- The **Microsoft Learn MCP** for official docs and the Well-Architected
  Framework (WAF).
- **This repo** for the maintainer's deltas on top of Learn: opinions,
  thresholds, production failures and exact settings.

This file explains why the repo is shaped the way it is. The rules themselves
live in [AGENTS.md](AGENTS.md).

## Layout

```text
cloud-agent-skills/
  .claude-plugin/marketplace.json   # catalog: lists azure (aws, gcp later)
  AGENTS.md                         # maintainer instructions
  CLAUDE.md                         # imports AGENTS.md
  ARCHITECTURE.md                   # this file
  LICENSE, NOTICE, README.md
  azure/                            # one plugin
    .claude-plugin/plugin.json      # semver lives here only
    .mcp.json                       # Azure MCP (read-only) + Learn MCP
    CHANGELOG.md                    # per-plugin release notes
    skills/                         # verbs: workflows, one SKILL.md each
      azure-propose-only/
      azure-cost-review/ ...
    reference/                      # nouns: mirrors the WAF service guides
      app-service/
        cost.md  reliability.md  performance.md
        deployment.md  configuration.md
      virtual-network/  key-vault/ ...
    hooks/                          # PreToolUse guard: mutating az in Bash
  aws/  gcp/                        # empty until there's real depth
```

## Why it's shaped this way

### Verbs vs nouns

Agents pick a skill by matching the task they've been given to a skill
description. A task reads like "cut this App Service bill" or "why is the slot
swap slow", not like "App Service". So skills are verbs (workflows), and
knowledge about a resource type is a noun that sits in `reference/`. One skill
pulls in several reference files, and one reference file serves several skills.
Keeping them apart avoids duplication in both directions.

### The reference tree mirrors the WAF

Reference folders follow the Azure Well-Architected Framework service guides,
one folder per service with files per concern. An agent that fetches a WAF guide
through the Learn MCP can find the matching delta file here without a lookup
table, and a maintainer can see at a glance which service guides have coverage.

### Deltas only

Learn is already available through its MCP and is kept up to date by Microsoft.
Restating it here would add tokens, go stale, and hide the actual value of this
repo: what Learn doesn't say. The fixed entry shape (when to use it, the
decision, gotchas, snippet, cost, last verified) keeps entries comparable and
makes stale entries easy to spot.

### Cloud-prefixed skill names

Plugin namespacing (`azure:...`) only exists inside Claude Code. People also
copy skill folders straight into other agent tools, where two skills both called
`cost-review` would collide. The prefix makes every name globally unique, and a
description that opens with the cloud stops an Azure skill from triggering on an
AWS task.

### One subdirectory and one `plugin.json` per plugin

Each cloud is a separate plugin with its own root, so users install only the
clouds they use and each cloud versions independently. The alternative, several
marketplace entries all pointing at `./` and filtering by skills, runs into a
known bug that loads every skill for every entry.

### Versioning

Claude Code caches plugins by version string. If the version doesn't change,
users don't get the update, so every change inside a plugin folder needs a bump.
The version lives in `plugin.json` only, because two sources of truth drift
apart, and `plugin.json` wins anyway when both are set. Tags follow
`<cloud>-vX.Y.Z`, and each plugin keeps its own `CHANGELOG.md`, because each
plugin versions independently and a shared changelog would mix unrelated release
histories. Users who want stability pin the marketplace to a tag, and users of
other tools pin a git submodule to one.

### One place per version, tracked by Renovate

Pinned versions drift when the same number is written in several places: a
workflow, the docs and a config file each end up with a different one. So every
version lives in exactly one file that a tool can read: `package.json` for
maintainer tools, `.nvmrc` for Node, `uses:` lines for actions, and `.mcp.json`
for MCP servers. Workflows and docs call the tools without a version.

Renovate reads all four. Dependabot can't read a version inside `.mcp.json`, and
that is the one that matters most, because it ships to users and the safety
model depends on it being pinned. Renovate's Dependency Dashboard issue gives a
single list of every dependency and whether it is out of date.

### Layered safety model

The agents this repo serves operate on production infrastructure, so the safety
model is defence in depth, listed from strongest to weakest:

1. **The Azure MCP runs `--read-only`.** The server itself refuses writes,
   whatever the prompt says.
2. **A `PreToolUse` hook** blocks mutating `az` commands run through Bash, a
   path that `--read-only` doesn't cover.
3. **The `azure-propose-only` skill** defines the plan format (discovery,
   preview, mutation, verification, with irreversible steps last after a
   checkpoint), so the human reviews a plan instead of trusting an action.
4. **The user's own RBAC** is the real ceiling. The agent inherits the user's
   `az login`, which is why the README recommends Reader for agent use.

Each layer covers a gap in the one above it. No single layer is trusted on its
own.

### Where the rules reach adopters

An agent reads `AGENTS.md` only in the project it's working in, so the root
`AGENTS.md` never reaches adopters. The rules reach them through the skills, the
hook and the MCP flags. The README offers an optional snippet they can paste
into their own `AGENTS.md`.

`CLAUDE.md` is a one-line `@AGENTS.md` import rather than a symlink, because git
symlinks break on Windows checkouts.

### Empty `aws/` and `gcp/`

An empty plugin folder, or a thin one, teaches agents nothing the official docs
don't. It would still cost users an install and an update cycle, and it would
suggest coverage that doesn't exist. A cloud gets a plugin and a marketplace
entry once it has real depth.
