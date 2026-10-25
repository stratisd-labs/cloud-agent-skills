# cloud-agent-skills

Azure architecture and DevOps expertise for AI agents, packaged as Claude Code
plugins. The agent reads live state and proposes a plan; you run the changes.

## What it is

Agents already reach Microsoft Learn through its MCP server. This plugin holds
only what Learn doesn't say: opinions, thresholds, traps hit in production and
exact settings. It also loads the read-only Azure MCP server for live state, and
a hook that stops the agent from changing Azure on its own.

The `azure` plugin ships these skills:

| Skill                     | Use it to                                |
| ------------------------- | ---------------------------------------- |
| `azure-propose-only`      | Plan any change as steps for you to run. |
| `azure-cost-review`       | Cut a bill, explain a cost jump.         |
| `azure-fault-triage`      | Find why an app or resource is failing.  |
| `azure-blue-green-deploy` | Release through slots or revisions.      |
| `azure-resource-naming`   | Name resources, resource groups, slots.  |
| `azure-resource-tagging`  | Choose tags and audit them for cost.     |

Each one triggers on its own from the task you give the agent; you don't call
them by name.

The `environments` plugin is cross-cloud. It decides which environments a
product needs from the size of its team, before any cloud is involved, and
leaves building them to a cloud plugin:

| Skill                       | Use it to                                     |
| --------------------------- | --------------------------------------------- |
| `environments-choose-shape` | Choose the environments a team needs by size. |

It needs no MCP server, CLI or sign-in.

## Prerequisites

- **Node.js**, which provides `npx`. The Azure MCP server runs through it.
- **The Azure CLI**, signed in with `az login`. The agent and the Azure MCP
  server act as that identity, so see Recommended RBAC below first.

## Install in Claude Code

```bash
claude plugin marketplace add stratisd-labs/cloud-agent-skills
claude plugin install azure@cloud-agent-skills
claude plugin install environments@cloud-agent-skills  # optional
```

The plugin loads in your next session, or in an open one after
`/reload-plugins`. Inside a session, `/plugin` does the same through a menu.

To get updates:

```bash
claude plugin marketplace update cloud-agent-skills
claude plugin update azure
```

## Pin a version

Each release is tagged `azure--vX.Y.Z`; the [CHANGELOG](azure/CHANGELOG.md)
lists them. Add the marketplace pinned to a tag instead of the default branch:

```bash
claude plugin marketplace add stratisd-labs/cloud-agent-skills#azure--vX.Y.Z
claude plugin install azure@cloud-agent-skills
```

Updates then follow that tag, not the default branch. To move to a newer
release, remove the marketplace and add it again with the new tag.

## Other agent tools

The skills are plain folders with a `SKILL.md`, so other agent tools that read
skills can use them:

- **Copy a skill folder**, such as `azure/skills/azure-cost-review/`, into the
  tool's skills directory.
- **Or pin a git submodule to a release tag**, and point the tool at
  `azure/skills/`:

  ```bash
  git submodule add https://github.com/stratisd-labs/cloud-agent-skills \
    vendor/cloud-agent-skills
  git -C vendor/cloud-agent-skills checkout azure--vX.Y.Z
  ```

Outside Claude Code you get the skills only. The guard hook and the read-only
MCP configuration don't come with them, so rely on RBAC and the snippet below.

## Safety model

Four layers, from strongest to weakest:

1. **The Azure MCP server runs `--read-only`.** The server refuses writes,
   whatever the prompt says.
2. **A `PreToolUse` hook** denies Bash commands that change Azure or print
   secrets, across `az`, `az rest`, `azd`, Terraform and Az PowerShell. It's a
   guard, not a sandbox: a script file or an SDK call gets past it.
3. **The `azure-propose-only` skill** makes every change a plan, with
   irreversible steps last, after a checkpoint where you confirm.
4. **Your RBAC** is the real ceiling. The agent inherits your `az login`.

No single layer is trusted on its own. [ARCHITECTURE.md](ARCHITECTURE.md)
explains why each one exists.

## Recommended RBAC

Give the identity the agent uses the **Reader** role, scoped as narrowly as the
work allows. Add **Cost Management Reader** for `azure-cost-review`. Never give
it **Contributor** or **Owner**: with those, the hook is the only thing between
the agent and a delete, and the hook is a guard, not a sandbox.

If you work as an identity with write access, sign the agent in as a separate
read-only identity, or run it in a shell signed in as one.

## Optional `AGENTS.md` snippet

The plugin's rules reach your agent through its skills. To keep agents
propose-only in your own repository too, whatever tool they run in, paste this
into its `AGENTS.md`:

```markdown
## Azure changes

- Propose-only. Run read-only Azure commands only (`list`, `show`, queries,
  `what-if`). Output every change as a plan for a human to run.
- Never run a command that returns a secret, such as `keys list` or
  `get-access-token`, even though it changes nothing.
- Pin `--subscription` on every command; never run `az account set`.
- Put deletes, purges and other steps with no rollback last, after a checkpoint
  where the human confirms the checks.
- If a command is denied, put it in the plan. Never rephrase it or wrap it in a
  script to get past the denial.
```

## Contributing

Maintainers start with [AGENTS.md](AGENTS.md), which holds the rules for skills,
reference files, hooks, evals, versioning and commits.
[ARCHITECTURE.md](ARCHITECTURE.md) explains why the repo is shaped this way.

## License

[Apache-2.0](LICENSE)
