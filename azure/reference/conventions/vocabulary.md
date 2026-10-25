# Estate vocabulary

The values that resource names and tags share: environments, region codes, and
the closed lists that hold apps and domains. `azure-resource-naming` and
`azure-resource-tagging` both read them from here, so a name and its tags can't
disagree. This is a convention, not a service, so it has no WAF guide; see
Learn's [naming][caf-naming] and [tagging][caf-tagging] guidance for the
baseline.

## Environments

**When to use it:** choosing the `<env>` in a name or the `environment` tag for
a new resource, on a greenfield estate.

**The decision:** use only values from this set. A product uses the subset its
shape calls for: the size of the team and the scale of the application decide
it, so one product runs on `dev`, `prod` and `global`, and another on a dozen
numbered dev environments. A value outside the set is never valid.

| `<env>`         | What it is                                       |
| --------------- | ------------------------------------------------ |
| `dev`           | The only dev environment, or what `devNN` share  |
| `dev01`…`dev99` | Identical dev environments, for parallel testing |
| `stg`           | Staging, from the same definition as production  |
| `prod`          | Production                                       |
| `release`       | What `stg` and `prod` share                      |
| `global`        | What every environment uses, such as IaC state   |

Once there are numbered dev environments, a resource they all share uses `dev`
with the `shared` domain: `sbns-<app>-shared-dev-<region>`, tagged
`environment=dev`, `domain=shared`.

**Why:** a single developer doesn't need a staging copy, and a large team can't
share one dev environment. Numbered dev environments let several people or
pipelines test in parallel on identical copies. The shared scopes say what
outlives any single environment, so a teardown of `dev02` can't take the shared
message bus with it. `test` isn't in the set: `stg` covers it.

### Gotchas

- **`dev` changes meaning when numbered dev environments appear.** While there's
  one dev environment, `dev` is it. Once `dev01` exists, `dev` names only what
  the numbered ones share, and a resource that belongs to one of them carries
  that environment, such as `dev02`, or it's torn down with the wrong one.
- **Moving from `dev` to `dev01` recreates the dev resources.** Most Azure
  resource names can't change, and `dev`'s own resources now need `dev01` in
  their names. Plan it as new resources plus a data move, not a rename.

### IaC

```bicep
// The subset this product's shape uses, from the set above
@allowed(['dev01', 'dev02', 'dev', 'stg', 'prod', 'release', 'global'])
param env string
```

### Cost impact

Each numbered dev environment is a full copy. Put what can be shared, such as a
messaging namespace or a Log Analytics workspace, under `dev` so the copies
don't multiply it.

Last verified: 2026-10-25

## Region codes

**When to use it:** the `<region>` in a name or the `region` tag.

**The decision:** use the code from this table. Extend the table; never
improvise a code in a single name or tag.

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

**Why:** Microsoft publishes no official short codes, so one table must be the
single source, or two teams invent two codes for one region.

### Gotchas

- **The `region` tag takes the code, not the Azure name.** `weu`, not
  `westeurope`, so tags group the same way the names read.

### IaC

```bicep
@allowed(['weu'])
param regionCode string
```

### Cost impact

None.

Last verified: 2026-10-24

## Closed value lists

**When to use it:** adding an app, a domain, an environment or a region to the
IaC, or proposing a name or tags that use one.

**The decision:** `<app>`, `<domain>`, `<env>` and the region code each have a
closed list, written once in the project's IaC. A new value is added to the list
first, then used. Names and the `app`, `domain`, `environment` and `region` tags
take their values from the same variables.

**Why:** a value checked at plan time can't drift. One set of variables feeding
both the name and the tags means a resource's name and tags can't disagree,
which is what cost reports and incident lookups rely on.

### Gotchas

- **Never invent a domain.** If the task doesn't say which part of the app the
  resource serves, ask. Never drop the component to make a name fit.
- **Give each domain its own `app` and `domain` values in IaC**, even when two
  domains share an app today. One shared variable breaks the day they diverge.
- **A value outside the project's list is a blocker,** in a name or a tag.

### IaC

```hcl
variable "domain" {
  type = string
  validation {
    condition     = contains(["web", "shared"], var.domain)
    error_message = "Add the domain to the list first."
  }
}
# ...app, environment and region_short the same way
```

### Cost impact

None for the lists. They keep cost reports grouped by `app`, `domain` and
`environment` complete.

Last verified: 2026-10-24

[caf-naming]:
  https://learn.microsoft.com/azure/cloud-adoption-framework/ready/azure-best-practices/resource-naming
[caf-tagging]:
  https://learn.microsoft.com/azure/cloud-adoption-framework/ready/azure-best-practices/resource-tagging
