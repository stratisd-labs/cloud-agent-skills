---
name: azure-resource-tagging
description:
  Azure resource tagging. Use when choosing tags for a new Azure resource or
  resource group, when writing Bicep, Terraform or az CLI that creates
  resources, or when auditing existing tags for gaps and inconsistent values
  that break cost reports. For names, use azure-resource-naming.
---

# Azure resource tagging

Propose tags; never apply them. Output the proposal as described in
[Output](#output) and let the human apply it.

Learn already covers the baseline. Read these through the Learn MCP instead of
restating them:

- [Tag resources][arm-tags]: limits, characters, required access.
- [Tag support][arm-tag-support]: which types take tags and show them in cost
  reports.
- [Tag policies][arm-tag-policies]: built-in policies that enforce tags.

This skill adds a fixed tag set on top, and the traps Learn doesn't flag. Names
are covered by `azure-resource-naming`; propose both together for a new
resource.

## Precedence

1. A tag set the user's project already defines wins. Look in its `AGENTS.md`,
   docs and IaC, and at Azure Policy tag rules.
2. If none is written down, infer it from tags already in use in the target
   subscription and follow it. Report gaps and deviations; don't fix them.
3. Only on a greenfield estate, use the tag set below.

## Tag set

Tag every resource and resource group with all of these:

| Tag            | Value                                           |
| -------------- | ----------------------------------------------- |
| `businessname` | Human-readable name, such as `Order Intake API` |
| `solutionname` | Source repo or solution path, or empty if none  |
| `app`          | Application the resource belongs to             |
| `environment`  | `dev`, `test`, `stg` or `prod`, as in the name  |
| `owner`        | A team mailbox or group address, never a person |
| `team`         | The responsible team                            |

## Gotchas

- **Tag values are case-sensitive; tag names aren't.** `Prod` and `prod` are two
  cost-report buckets. Lowercase every value except `businessname`, and keep one
  format for `solutionname` across the estate.
- **Tags are plain text and not treated as customer data.** They show up in cost
  exports, deployment history and logs. A personal email in `owner` is personal
  data in the wrong place, and goes stale when the person leaves. Never put
  usernames, secrets or incident details in any tag.
- **Resources don't inherit resource group tags.** Tagging only the group leaves
  the cost report empty. Tag each resource, and recommend the built-in policy
  _Inherit a tag from the resource group if missing_ as the backstop.
- **Some types cap tags at 15, not 50.** Automation, CDN, public and private DNS
  zones among them. The six tags above fit; a sprawling set won't.
- **`az resource tag` replaces the whole set by default.** Any plan that adds a
  tag to an existing resource must use `--is-incremental`, or it wipes the tags
  already there.

## Checks before proposing

All read-only. Run the ones that apply:

```bash
# Current tags on a resource or resource group
az tag list --resource-id <RESOURCE_ID>

# Resources in a group missing a required tag
az resource list --resource-group <RG> \
  --query "[?tags.owner == null].name"
```

## Output

For each resource, give:

1. The tag set, with each value.
2. Which checks ran and what they returned, or why a check was skipped.
3. An IaC snippet in the project's IaC language. For Bicep:

```bicep
param workload string
param env string

var tags = {
  businessname: '<BUSINESS NAME>'
  solutionname: '<REPO PATH>'
  app: workload
  environment: env
  owner: '<TEAM MAILBOX>'
  team: '<TEAM>'
}
```

For an existing resource, give an az CLI plan step instead:

```bash
az resource tag --ids <RESOURCE_ID> --is-incremental \
  --tags owner=<TEAM_MAILBOX> team=<TEAM>
```

Flag any missing tag or inconsistent value as a blocker, not a note.

Last verified: 2026-09-26

[arm-tags]:
  https://learn.microsoft.com/azure/azure-resource-manager/management/tag-resources
[arm-tag-support]:
  https://learn.microsoft.com/azure/azure-resource-manager/management/tag-support
[arm-tag-policies]:
  https://learn.microsoft.com/azure/azure-resource-manager/management/tag-policies
