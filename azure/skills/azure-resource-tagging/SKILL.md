---
name: azure-resource-tagging
description:
  Azure resource tagging. Use when choosing tags for a new Azure resource or
  resource group, when writing Bicep, Terraform or az CLI that creates
  resources, or when auditing existing tags for gaps and inconsistent values
  that break cost reports. For names, use azure-resource-naming.
---

# Azure resource tagging

Propose tags; never apply them. Output the proposal as described in the Output
section and let the human apply it.

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

### Virtual machines

Virtual machines also get `vm-user`: the account you log in as, such as
`azureuser`, so nobody has to guess it.

- The account name only. Never a password, key or key path.
- Set it from the same parameter as `osProfile.adminUsername`, so the two can't
  differ at deploy time.
- If you log in as another account than the admin one, `vm-user` names that
  account instead.

## Gotchas

- **Lowercase every value except `businessname`.** Tag values are
  case-sensitive, so `Prod` and `prod` split one cost-report bucket in two. Keep
  one format for `solutionname` across the estate for the same reason.
- **`owner` is a team address, never a person.** Tags are plain text that
  surface in cost exports and logs, so a personal email is personal data in the
  wrong place, and it goes stale when the person leaves.
- **Tag each resource, not just its resource group.** Resources don't inherit
  group tags, so a tagged group still leaves the cost report empty. Recommend
  the built-in policy _Inherit a tag from the resource group if missing_ as the
  backstop, not as the primary mechanism.
- **Update `vm-user` when the login account changes.** Azure records only the
  admin account set at creation, and `osProfile.adminUsername` can't be updated.
  Accounts added inside the OS are invisible to Azure, so a stale tag is the
  only record, and it's wrong.
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

# VM admin account next to its vm-user tag
az vm show --resource-group <RG> --name <VM> \
  --query '{admin: osProfile.adminUsername, tag: tags."vm-user"}'
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
  businessname: '<BUSINESS_NAME>'
  solutionname: '<REPO_PATH>'
  app: workload
  environment: env
  owner: '<TEAM_MAILBOX>'
  team: '<TEAM>'
}
```

For a virtual machine, add `vm-user` from the admin username parameter:

```bicep
param adminUsername string

resource vm 'Microsoft.Compute/virtualMachines@2025-11-01' = {
  name: '<VM_NAME>'
  location: resourceGroup().location
  tags: union(tags, { 'vm-user': adminUsername })
  properties: {
    osProfile: {
      adminUsername: adminUsername
      // ...
    }
  }
}
```

For an existing resource, give an az CLI plan step instead:

```bash
az resource tag --ids <RESOURCE_ID> --is-incremental \
  --tags owner=<TEAM_MAILBOX> team=<TEAM>
```

Flag any missing tag or inconsistent value as a blocker, not a note. A `vm-user`
that differs from `osProfile.adminUsername` is a blocker too, unless the human
confirms that's the account they log in as.

Last verified: 2026-09-27

[arm-tags]:
  https://learn.microsoft.com/azure/azure-resource-manager/management/tag-resources
[arm-tag-support]:
  https://learn.microsoft.com/azure/azure-resource-manager/management/tag-support
[arm-tag-policies]:
  https://learn.microsoft.com/azure/azure-resource-manager/management/tag-policies
