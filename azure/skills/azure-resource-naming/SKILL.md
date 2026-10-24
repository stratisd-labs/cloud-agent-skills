---
name: azure-resource-naming
description:
  Azure resource naming. Use when choosing a name for a new Azure resource,
  resource group or deployment slot, when writing Bicep, Terraform or az CLI
  that creates resources, or when reviewing existing names for consistency. For
  tags, use azure-resource-tagging.
---

# Azure resource naming

Propose names; never create or rename anything. Output the proposal as described
in the Output section and let the human apply it, following
`azure-propose-only`.

Learn already covers the baseline. Read these through the Learn MCP instead of
restating them:

- [Define your naming convention][caf-naming]: components, scope, delimiters.
- [Resource abbreviations][caf-abbr]: the `<type>` prefix for every resource.
- [Naming rules and restrictions][arm-rules]: length and characters per type.

This skill adds a fixed convention on top, and the traps Learn doesn't flag.
Tags are covered by `azure-resource-tagging`; propose both together for a new
resource.

## Precedence

1. A convention the user's project already defines wins. Look in its
   `AGENTS.md`, docs and IaC, and at Azure Policy naming rules.
2. If none is written down, infer it from existing names in the target
   subscription and follow it. Report deviations; don't fix them.
3. Only on a greenfield estate, use the convention below.

## Convention

```text
<type>-<app>-<domain>-<env>-<region>[-<##>]
```

Lowercase, hyphen-separated, always in this order. For example,
`stapp-app1-web-stg-weu` or `kv-app1-shared-dev-weu`.

- `<type>`: the CAF abbreviation, for example `ca`, `func`, `kv`, `st`, `stapp`.
  Never invent one. If CAF has none, ask.
- `<app>`: the product the resource belongs to.
- `<domain>`: the part of the app it serves, such as `web`, `mobile`,
  `authentication` or `telemetry`, or `shared` for infrastructure the app's
  domains share. CAF calls this the workload component and makes it optional;
  here it's always there.
- `<env>`: an environment from [estate vocabulary][vocab].
- `<region>`: a region code from [estate vocabulary][vocab].
- `<##>`: optional, two digits. See Instance numbers below.

Resource groups follow the same pattern, one per app domain per environment:
`rg-<app>-<domain>-<env>-<region>`.

### Shared vocabulary

`<app>`, `<domain>`, `<env>` and the region code each come from a closed list
written once in the project's IaC, and the tags take the same values. The
environment set, with the shared scopes `dev`, `release` and `global`, the
region codes, and the rules for the lists are in [estate vocabulary][vocab].
Read it before proposing a name.

### No-hyphen types

Types that allow only lowercase letters and digits, such as storage accounts and
container registries, drop the hyphens and keep the order:
`st<app><domain><env><region>[##]`.

### Instance numbers

Omit the suffix by default. Add one only when the name is already taken, often
by another tenant for globally unique types, or when deploying identical
siblings. Number from `01`. A second sibling of an unsuffixed resource is `02`,
because the original is implicitly `01` and can't be renamed.

### Deployment slots

The name carries the environment of the app's whole lifecycle, not of a slot. A
production app with a pre-production slot is `func-<app>-<domain>-prod-weu` with
slot `preprod`. Name the app `stg` only if the app itself never serves
production traffic.

Prefer `preprod` over `staging` for the slot name, so a slot is never confused
with the `stg` environment.

### Length budgets

The pattern eats most of the budget on these types. Check `<app>` and `<domain>`
fit before proposing. Shorten the app or the domain, never the other components.
The room below counts both together, with the hyphen between them, for a
three-letter region and no suffix.

| Type            | Limit | Room in `dev01` | Room in `release` |
| --------------- | ----- | --------------- | ----------------- |
| Key vault       | 24    | 11              | 9                 |
| Storage account | 24    | 14, no hyphen   | 12, no hyphen     |
| Container app   | 32    | 19              | 17                |
| Function app    | 32\*  | 17              | 15                |

A four-letter region such as `eus2` takes one more, and a suffix three more (two
without hyphens). `prod` and `stg` leave one and two more than `dev01`.

\* The function app name allows 60 characters, but keep it to 32: longer names
can collide on host ID, and this pattern's environment twins, such as `dev01`
and `dev02`, collide first. See [host ID collisions][hostid].

A Windows VM's resource name can take 64 characters, but its host name
(`computerName`) takes only 15. Don't reuse the resource name as the host name;
give the host name its own short scheme.

## Gotchas

- **Key vault names stay reserved after deletion.** A soft-deleted vault keeps
  its global name for the whole retention period, 7 to 90 days, and purge
  protection makes that unskippable. Tearing down and redeploying the same name
  fails. Check deleted vaults before reusing a name.
- **`az keyvault check-name` doesn't check vaults.** It accepts only
  `--resource-type hsm`. For vaults, use the deleted-vault check below.

## Checks before proposing

All read-only. Run the ones that apply:

```bash
# Name taken in the resource group?
az resource list --resource-group <RG> --name <NAME>

# Storage account name free globally?
az storage account check-name --name <NAME>

# Key vault name held by a soft-deleted vault?
az keyvault list-deleted --resource-type vault \
  --query "[?name=='<NAME>']"
```

## Output

For each resource, give:

1. The proposed name, and its length against the type's limit.
2. Which checks ran and what they returned, or why a check was skipped.
3. An IaC snippet in the project's IaC language that builds the name from the
   closed lists, so the resource group, the resources and the tags share one
   base. For Bicep:

   ```bicep
   @allowed(['<APP>'])
   param app string
   @allowed(['web', 'shared'])
   param domain string
   @allowed(['dev01', 'dev02', 'stg', 'prod', 'dev', 'release'])
   param env string
   param regionCode string

   var base = '${app}-${domain}-${env}-${regionCode}'

   resource kv 'Microsoft.KeyVault/vaults@2023-07-01' = {
     name: 'kv-${base}'
     location: resourceGroup().location
     // ...
   }
   ```

   For Terraform, one naming module that whatever creates the resource groups
   and whatever deploys into them both call:

   ```hcl
   variable "domain" {
     type = string
     validation {
       condition     = contains(["web", "shared"], var.domain)
       error_message = "Add the domain to the list first."
     }
   }
   # ...app, environment and region_short the same way

   locals {
     base = "${var.app}-${var.domain}-${var.environment}-${var.region_short}"
   }

   output "base" { value = local.base }
   output "resource_group" { value = "rg-${local.base}" }
   output "compact" { value = replace(local.base, "-", "") }
   ```

Flag any length overflow, taken name, or value outside the project's lists as a
blocker, not a note. A missing domain is a blocker too: ask for it.

Last verified: 2026-10-24

[vocab]: ../../reference/conventions/vocabulary.md
[hostid]: ../../reference/azure-functions/configuration.md
[caf-naming]:
  https://learn.microsoft.com/azure/cloud-adoption-framework/ready/azure-best-practices/resource-naming
[caf-abbr]:
  https://learn.microsoft.com/azure/cloud-adoption-framework/ready/azure-best-practices/resource-abbreviations
[arm-rules]:
  https://learn.microsoft.com/azure/azure-resource-manager/management/resource-name-rules
