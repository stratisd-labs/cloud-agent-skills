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
section and let the human apply it, following `azure-propose-only`.

Learn already covers the baseline. Read these through the Learn MCP instead of
restating them:

- [Tag resources][arm-tags]: limits, characters, required access.
- [Tag support][arm-tag-support]: which types take tags and show them in cost
  reports.
- [Tag policies][arm-tag-policies]: built-in policies that enforce tags.

This skill adds a fixed tag set on top, and the traps Learn doesn't flag. Names
are covered by `azure-resource-naming`; propose both together for a new
resource, from the same variables.

## Precedence

1. A tag set the user's project already defines wins. Look in its `AGENTS.md`,
   docs and IaC, and at Azure Policy tag rules.
2. If none is written down, infer it from tags already in use in the target
   subscription and follow it. Report gaps and deviations; don't fix them.
3. Only on a greenfield estate, use the tag set below.

## Tag keys

Write every key in lowercase letters with no separator: `businessunit`,
`opsteam`, `managedby`, `webdomain`. No hyphens, underscores or camelCase.

Tag names are case-insensitive for Azure operations, but a provider can keep the
casing it was given, and cost reports show it. Some types also reject characters
in names: Azure DNS rejects special characters, Front Door rejects `#` and `:`,
Traffic Manager rejects spaces. Lowercase letters alone work on every type.

## Tag set

| Tag            | Value                                    | Resource groups |
| -------------- | ---------------------------------------- | --------------- |
| `environment`  | The `<env>` in the resource's name       | Yes             |
| `app`          | The `<app>` in the resource's name       | Yes             |
| `domain`       | The `<domain>` in the resource's name    | Yes             |
| `region`       | The region code in the resource's name   | Yes             |
| `businessunit` | The department using it                  | Yes             |
| `opsteam`      | The team that builds and runs it         | Never           |
| `owner`        | A team mailbox or group address          | Yes             |
| `managedby`    | The repository whose IaC manages it      | Yes             |
| `webdomain`    | The custom hostname it serves; see below | Never           |
| `vmuser`       | The login account; virtual machines only | No              |

`environment`, `app`, `domain` and `region` take their values from [estate
vocabulary][vocab]: the environment set, shared scopes `dev`, `release` and
`global` included, and the region codes. Read it before proposing tags.

- **`opsteam`** is ideally the name of a GitHub team in the `managedby` repo.
- **`managedby`** is the repository path, such as `<ORG>/<REPO>`.

### Why resource groups skip `opsteam` and `webdomain`

A resource group holds one domain's resources, but they can be built by more
than one team: the web client and the networking it sits on. A single team on
the group is wrong for the rest, so the resources carry `opsteam` instead. A
group never answers on a hostname, so it never gets `webdomain`.

Recommend the built-in policy _Inherit a tag from the resource group if missing_
as the backstop for the tags groups do carry. Never for `opsteam` or
`webdomain`: the group has no value to give.

### Virtual machines

Virtual machines also get `vmuser`: the account you log in as, such as
`azureuser`, so nobody has to guess it.

- The account name only. Never a password, key or key path.
- Set it from the same parameter as `osProfile.adminUsername`, so the two can't
  differ at deploy time.
- If you log in as another account than the admin one, `vmuser` names that
  account instead.

## `webdomain`

Set it only on resources that answer on a real, custom hostname: Static Web
Apps, App Service apps, Front Door endpoints, virtual machines serving a site.
Never on a resource group, and never the platform's default host, such as
`*.azurestaticapps.net` or `*.azurewebsites.net`.

- Production gets the apex, `<app>.<ZONE>`. Every other environment gets
  `<env>.<app>.<ZONE>`, such as `dev02.<app>.<ZONE>`.
- Set it from the same parameter that configures the custom domain, so the tag
  can't drift from DNS.

What it's for:

- **Incident and DNS lookups.** "Which resource serves this hostname?" is one
  `az resource list --tag webdomain=<HOST>`, not a search through every app's
  custom domains.
- **Certificate and DNS cleanup.** List every `webdomain` and resolve each host.
  A resource still claiming a hostname whose record is gone, or a record
  pointing at a resource that's gone, is a dangling CNAME on the way to a
  subdomain takeover.
- **Cost per site.** Group a cost export by `webdomain` to see what each public
  site costs across its resources.

## Closed value lists

Every tag except `owner`, `managedby`, `webdomain` and `vmuser` has a closed
list of allowed values, written once in the project's IaC. A plan or build fails
on any other value, and a new value goes into the list first. `environment`,
`app`, `domain` and `region` share their lists with the resource names; see
[estate vocabulary][vocab] for those lists and why both come from the same
variables.

Back the IaC check with an Azure Policy assignment that denies a tag value
outside the list, for whatever is created outside the IaC.

## Gotchas

- **Lowercase every value except `owner`.** Tag values are case-sensitive, so
  `Prod` and `prod` split one cost-report bucket in two. Keep one format for
  `managedby` across the estate for the same reason.
- **`owner` is a team address, not a person.** Tags are plain text that surface
  in cost exports and logs, so a personal email is personal data in the wrong
  place, and it goes stale when the person leaves.

  > **Exception:** if the team has no mailbox or group address, use the work
  > email of the person accountable for the resource. Never a private address,
  > and never pick the person yourself: ask the human. Even when you can see an
  > address, such as the human's own, write the placeholder `<OWNER_WORK_EMAIL>`
  > instead of filling it in. Note the exception in the output, so the tag is
  > replaced once the team has an address.

- **Tag each resource, not just its resource group.** Resources don't inherit
  group tags, so a tagged group still leaves the cost report empty.
- **Update `vmuser` when the login account changes.** Azure records only the
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
  --query "[?tags.managedby == null].name"

# Which resource serves this hostname?
az resource list --tag webdomain=<HOST> --query "[].{name: name, id: id}"

# Every hostname claimed by a tag, to resolve against DNS
az resource list --query "[?tags.webdomain].{name: name,
  host: tags.webdomain, type: type}"

# VM admin account next to its vmuser tag
az vm show --resource-group <RG> --name <VM> \
  --query '{admin: osProfile.adminUsername, tag: tags.vmuser}'
```

## Output

For each resource and resource group, give:

1. The tag set, with each value. Name the resources that get `webdomain` and
   `vmuser`, and show that the resource groups carry neither `opsteam` nor
   `webdomain`.
2. Which checks ran and what they returned, or why a check was skipped.
3. An IaC snippet in the project's IaC language that builds the tags from the
   same variables as the name. For Bicep:

   ```bicep
   @allowed(['<APP>'])
   param app string
   @allowed(['web', 'shared'])
   param domain string
   @allowed(['dev01', 'dev02', 'stg', 'prod', 'dev', 'release', 'global'])
   param env string
   @allowed(['weu'])
   param regionCode string
   @allowed(['<BUSINESS_UNIT>'])
   param businessUnit string
   @allowed(['<OPS_TEAM>'])
   param opsTeam string
   param siteHost string = '' // the hostname the custom domain binds

   var groupTags = {
     environment: env
     app: app
     domain: domain
     region: regionCode
     businessunit: businessUnit
     owner: '<TEAM_MAILBOX>'
     managedby: '<ORG>/<REPO>'
   }
   var tags = union(groupTags, { opsteam: opsTeam })
   var siteTags = empty(siteHost) ? tags : union(tags, { webdomain: siteHost })
   ```

   Give the resource group `groupTags`, a site with a custom domain `siteTags`,
   and every other resource `tags`. For a virtual machine, add
   `union(tags, { vmuser: adminUsername })` from its admin username parameter.

   For Terraform, the closed list is a validation on each variable, in the
   module that builds both names and tags:

   ```hcl
   variable "businessunit" {
     type = string
     validation {
       condition     = contains(["<BUSINESS_UNIT>"], var.businessunit)
       error_message = "Add the business unit to the list first."
     }
   }
   # ...app, domain, environment, region_short and opsteam the same way

   locals {
     group_tags = {
       environment  = var.environment
       app          = var.app
       domain       = var.domain
       region       = var.region_short
       businessunit = var.businessunit
       owner        = var.owner
       managedby    = var.managedby
     }
     tags = merge(local.group_tags, { opsteam = var.opsteam })
   }
   ```

   For an existing resource, give a plan in the `azure-propose-only` format
   instead, with a step like this:

   ```bash
   az resource tag --ids <RESOURCE_ID> --is-incremental \
     --tags owner=<TEAM_MAILBOX> opsteam=<OPS_TEAM>
   ```

Flag these as blockers, not notes: a missing tag, a value outside the project's
list, a key that breaks the key convention, `opsteam` or `webdomain` on a
resource group, and a `webdomain` set to a platform default host. A `vmuser`
that differs from `osProfile.adminUsername` is a blocker too, unless the human
confirms that's the account they log in as. A personal `owner` under the
exception is a note, not a blocker.

Last verified: 2026-10-24

[vocab]: ../../reference/conventions/vocabulary.md
[arm-tags]:
  https://learn.microsoft.com/azure/azure-resource-manager/management/tag-resources
[arm-tag-support]:
  https://learn.microsoft.com/azure/azure-resource-manager/management/tag-support
[arm-tag-policies]:
  https://learn.microsoft.com/azure/azure-resource-manager/management/tag-policies
