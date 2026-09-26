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
in the Output section and let the human apply it.

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
<type>-<workload>-<env>-<region>[-<###>]
```

Lowercase, hyphen-separated, always in this order.

- `<type>`: the CAF abbreviation, for example `ca`, `func`, `kv`, `st`. Never
  invent one. If CAF has none, ask.
- `<workload>`: the workload, app or project. Add a component after it for
  multi-service workloads: `ca-<workload>-api-prod-weu`.
- `<env>`: `dev`, `test`, `stg` or `prod`. Keep the set closed.
- `<region>`: a short code from the table below. Microsoft publishes no official
  short codes, so one table must be the single source.
- `<###>`: optional, three digits. See Instance numbers below.

Resource groups follow the same pattern: `rg-<workload>-<env>-<region>`.

### Region codes

Extend this table; never improvise a code in a single name.

| Region               | Code   |
| -------------------- | ------ |
| `westeurope`         | `weu`  |
| `northeurope`        | `neu`  |
| `germanywestcentral` | `gwc`  |
| `francecentral`      | `frc`  |
| `uksouth`            | `uks`  |
| `swedencentral`      | `sdc`  |
| `eastus`             | `eus`  |
| `eastus2`            | `eus2` |
| `westus2`            | `wus2` |
| `southeastasia`      | `sea`  |

### No-hyphen types

Types that allow only lowercase letters and digits, such as storage accounts and
container registries, drop the hyphens and keep the order:
`st<workload><env><region>[###]`.

### Instance numbers

Omit the suffix by default. Add one only when the name is already taken, often
by another tenant for globally unique types, or when deploying identical
siblings. Number from `001`. A second sibling of an unsuffixed resource is
`002`, because the original is implicitly `001` and can't be renamed.

### Deployment slots

The name carries the environment of the app's whole lifecycle, not of a slot. A
production app with a pre-production slot is `func-<workload>-prod-weu` with
slot `preprod`. Name the app `stg` only if the app itself never serves
production traffic.

Prefer `preprod` over `staging` for the slot name, so a slot is never confused
with the `stg` environment.

## Length traps

The pattern eats most of the budget on these types. Check the workload fits
before proposing, and shorten the workload, never the other components.

| Type            | Limit | Room for `<workload>`, no suffix |
| --------------- | ----- | -------------------------------- |
| Key vault       | 24    | `kv-…-prod-weu`: 12              |
| Storage account | 24    | `st…prodweu`: 15                 |
| Container app   | 32    | `ca-…-prod-weu`: 20              |
| Function app    | 32\*  | `func-…-prod-weu`: 18            |

\* The function app name allows 60 characters, but the host ID truncates it
to 32. Two apps sharing a storage account whose names match in the first 32
characters collide, and this pattern puts `<env>` last, so `prod` and `stg`
twins collide first. Keep function app names at 32 characters or fewer, or give
each app its own storage account.

A Windows VM's resource name can take 64 characters, but its host name
(`computerName`) takes only 15. Don't reuse the resource name as the host name;
give the host name its own short scheme.

## Other gotchas

- **Key vault names stay reserved after deletion.** A soft-deleted vault keeps
  its global name for the whole retention period, 7 to 90 days, and purge
  protection makes that unskippable. Tearing down and redeploying the same name
  fails. Check deleted vaults before reusing a name.
- **`az keyvault check-name` doesn't check vaults.** It accepts only
  `--resource-type hsm`. For vaults, use the deleted-vault check below.
- **Names are case-insensitive, and APIs may return different casing.** Always
  lowercase, and compare case-insensitively in scripts.
- **Names are permanent for most types.** Put anything that changes, such as the
  owner, team or cost centre, in tags, never in the name.

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
3. An IaC snippet in the project's IaC language. For Bicep:

```bicep
param workload string
param env string
param regionCode string

resource kv 'Microsoft.KeyVault/vaults@2023-07-01' = {
  name: 'kv-${workload}-${env}-${regionCode}'
  location: resourceGroup().location
  // ...
}
```

Flag any length overflow or taken name as a blocker, not a note.

Last verified: 2026-09-26

[caf-naming]:
  https://learn.microsoft.com/azure/cloud-adoption-framework/ready/azure-best-practices/resource-naming
[caf-abbr]:
  https://learn.microsoft.com/azure/cloud-adoption-framework/ready/azure-best-practices/resource-abbreviations
[arm-rules]:
  https://learn.microsoft.com/azure/azure-resource-manager/management/resource-name-rules
