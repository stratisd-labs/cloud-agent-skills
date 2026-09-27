---
name: azure-propose-only
description:
  Azure change planning, propose-only. Use when a task would create, change,
  scale, restart, tag, rotate or delete anything in Azure, when writing the plan
  another azure-* skill outputs, or when deciding whether an az command is safe
  to run.
---

# Azure propose-only changes

Run read-only commands only; never run anything that changes Azure. Output every
change as the plan described in the Output section and let the human run it.

Learn already covers the baseline. Read these through the Learn MCP instead of
restating them:

- [Bicep what-if][what-if]: change types, noise and limits of the preview.
- [Deployment modes][modes]: incremental vs. complete.
- [Lock resources][locks]: what each lock blocks, including POST operations.

This skill adds the rule, the plan format every `azure-*` skill shares, and the
commands that look read-only but aren't. When a task-specific `azure-*` skill
fits the task too, use both: that skill decides what to change, this one how to
plan it.

## Precedence

1. A change process the user's project already defines wins: changes only
   through a pipeline, a change ticket, a maintenance window. Look in its
   `AGENTS.md`, docs and pipeline files, and fit the plan into that process.
2. If the resource is managed by IaC, the plan changes the IaC. See IaC-managed
   resources below.
3. Otherwise, use the plan format in the Output section.

## What counts as read-only

A command is safe to run only if it changes nothing in Azure **and** returns no
secret. Both, every time. When you can't tell, it isn't: plan it.

Safe to run:

- Reads: `list`, `show`, `check-name`, `list-deleted`, and queries against Azure
  Monitor, Log Analytics and Resource Graph.
- `az deployment <scope> what-if`. It's an operation that stores nothing.
- `az rest` with the default method, GET.
- Tools of the Azure MCP server, which runs `--read-only`, except any that
  return a secret value.

Never run these, however read-only they look. Put them in the plan:

- `az stack-whatif ... create`: unlike deployment what-if, it creates a stored
  result resource in the scope.
- `az vm run-command invoke`: runs a script on the VM, elevated by default on
  Linux.
- Commands that return secrets: `az storage account keys list`,
  `az functionapp keys list`, `az webapp deployment list-publishing-profiles`,
  `az keyvault secret show`, `az account get-access-token`. Nothing changes, but
  the secret lands in the transcript and its logs.
- `az rest` with `--method` post, put, patch or delete. Even a POST that only
  reads, such as `listKeys`, can return a secret.
- `az account set`: it switches the human's default subscription for every later
  command, theirs included.

Any other command with a verb such as `create`, `update`, `set`, `delete`,
`add`, `remove`, `start`, `stop`, `restart`, `swap`, `tag`, `assign`,
`regenerate`, `purge`, `invoke` or `deploy` changes state.

## IaC-managed resources

If the project's IaC defines the resource, the plan edits the IaC and applies it
through the project's pipeline. Never plan an `az` change against it: the next
deployment reverts it, or `terraform plan` reports it as drift.

To tell, search the project's IaC for the resource, then check the resource
group's deployment history. Deployment history keeps at most 800 entries and
deletes old ones automatically, so an empty history proves nothing. If you still
can't tell, ask the human.

## Irreversible steps

These have no rollback. They go last, after the checkpoint:

- Deletes of anything without soft delete, and every purge.
- Enabling key vault purge protection. It can't be turned off again.
- Regenerating a key or secret. The old one is gone, and every client still
  using it breaks.
- SKU or tier downgrades that drop features or data.
- A deployment with `--mode Complete`, or a deployment stack whose
  `actionOnUnmanage` deletes: both delete what the template leaves out.
- Anything that recreates the resource, such as changing its region or name.
- Data plane deletes: blobs, queue messages, table rows, files. Locks don't
  protect data.

## Gotchas

- **Read what-if as evidence, not proof.** It reports noise: properties shown as
  deleted that won't change, and any property set from `reference()` shown as
  modified on every run. Resources past its nesting limits show as `Ignore`.
  List `Ignore` and `Unsupported` results as unknown, never as safe.
- **Never propose `--mode Complete` unless the human asked for it.** It deletes
  every resource in the group that the template doesn't define. Incremental is
  the default; keep it.
- **A ReadOnly lock blocks more than writes.** It blocks POST operations too,
  such as listing storage keys, starting a VM or scaling an App Service plan.
  Check locks during discovery. If a step needs a lock removed, make that its
  own step, with a matching step that puts the lock back.
- **Pin the subscription on every command.** Add `--subscription <SUB>` rather
  than planning `az account set`, so the plan can't run against whatever
  subscription the human's shell last used.
- **Secrets never appear in a plan.** Name the key vault and secret; never write
  the value, and never plan a command that prints one.

## Checks before proposing

All read-only. Run the ones that apply:

```bash
# Which account and subscription is this?
az account show --query '{sub: id, name: name, user: user.name}'

# Locks on the resource group, and anywhere in the subscription
az lock list --resource-group <RG>
az lock list

# Is the group deployed from IaC? Its deployment history
az deployment group list --resource-group <RG> --output table \
  --query "[].{name: name, time: properties.timestamp}"

# Preview an IaC change (<PARAMS>: a .bicepparam path, or @<file>.json)
az deployment group what-if --resource-group <RG> \
  --template-file <TEMPLATE> --parameters <PARAMS>
```

## Output

For each change the human asked for, give a plan with these parts, in order:

1. **Context**: the goal in one line, the subscription, the scope, and the
   account from `az account show`.
2. **Discovery**: which checks ran and what they returned, or why a check was
   skipped.
3. **Preview**: the what-if or `terraform plan` summary, with noise and `Ignore`
   results called out. For a change no preview covers, give each property's
   current value and its new value instead.
4. **Changes**: numbered steps, one change each, never chained with `&&`, so the
   human can stop between any two. Each step has the command or IaC diff, what
   changes (before and after), the blast radius (dependents, restarts,
   downtime), and its rollback command.
5. **Checkpoint**: before the first irreversible step, tell the human to stop
   and run the verification for every step so far.
6. **Irreversible steps**: numbered on from the changes, each marked
   `Rollback: none`.
7. **Verification**: for each step, a read-only command and the output to
   expect.

Order the steps: creates before cut-overs, cut-overs before deletes, and delete
the old only after the new is verified.

Use this shape:

````markdown
## Plan: <GOAL>

Subscription: <SUB> · Scope: <RG> · Account: <ACCOUNT>

### Discovery

- `az lock list --resource-group <RG>`: no locks.

### Preview

What-if: 1 to modify, 0 to delete. Noise: <PROPERTY>.

### Changes

1. <What changes>: `<BEFORE>` to `<AFTER>`. Blast radius: <EFFECT>.

   ```bash
   az <command> --subscription <SUB> ...
   ```

   Rollback: `az <command> --subscription <SUB> ...`

### Checkpoint

Stop. Run the verification for steps 1 to <N> before going on.

### Irreversible steps

<N+1>. <What is deleted or purged>. Rollback: none.

### Verification

- Step 1: `az <command> --query <FIELD>` returns `<AFTER>`.
````

Flag any of these as a blocker, not a note: an `az` change planned against an
IaC-managed resource, an irreversible step with no checkpoint before it, an IaC
change with no preview, and a lock or policy that will reject a step.

Last verified: 2026-09-27

[what-if]:
  https://learn.microsoft.com/azure/azure-resource-manager/bicep/deploy-what-if
[modes]:
  https://learn.microsoft.com/azure/azure-resource-manager/templates/deployment-modes
[locks]:
  https://learn.microsoft.com/azure/azure-resource-manager/management/lock-resources
