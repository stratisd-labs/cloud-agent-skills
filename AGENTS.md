# AGENTS.md

These instructions are for agents **maintaining this repo**. Adopters never load this file.

`cloud-agent-skills` packages Azure architecture and DevOps expertise as agent skills, distributed as a Claude Code plugin marketplace with one plugin per cloud. It holds only the deltas on top of Microsoft Learn. For the layout and the reasoning behind it, read [ARCHITECTURE.md](ARCHITECTURE.md).

## Skills (`<cloud>/skills/<name>/SKILL.md`)

- Name every skill `<cloud>-<verb-phrase>`, for example `azure-cost-review`. The folder name and the `name` field must match.
- Name skills after tasks, not resource types. A resource type belongs in `reference/`.
- The `description` opens with the cloud name and states when to trigger the skill.
- Point to the reference files the skill needs instead of copying their content.
- Any skill that touches cloud state must follow `azure-propose-only`: it outputs a plan and never executes one.

## Reference files (`<cloud>/reference/<service>/<topic>.md`)

- Write deltas only. Never restate Learn; link to it instead.
- Every entry has, in order: when to use it, the decision and why, gotchas, an IaC snippet, the cost impact, and a `Last verified: YYYY-MM-DD` line.
- Verify every `az` flag against the Learn MCP before writing it. Tag any flag you couldn't verify `# verify`.
- Service folder names follow the Azure Well-Architected Framework service guides.

## Versioning

- On any change inside a plugin folder, bump `version` in that plugin's `.claude-plugin/plugin.json` and add an entry to that plugin's `CHANGELOG.md`. An unbumped version withholds the update from users.
- Semver lives in `plugin.json` only. Never add `version` to `.claude-plugin/marketplace.json`.

## Hard rules

- **Never write client names, tenant or subscription IDs, resource names, IPs or incident details.** Use generic placeholders only (`<SUB>`, `<RG>`, `<APP>`).
- When working against a real Azure subscription while maintaining this repo, you are propose-only too. Run read-only commands only and output mutating steps as a plan for the human.
