---
name: environments-choose-shape
description:
  Environments for a product, on any cloud. Use when deciding which environments
  a product needs, when setting up environments for a new product, when a team
  grows and asks whether it needs staging or more dev environments, or when
  checking that an existing layout fits the team. For building the layout on a
  cloud, use that cloud's plugin.
---

# Choose a product's environments

Propose the environments a product needs; never create anything. Output the
layout as described in the Output section, in neutral terms, and let the human
or a cloud plugin build it.

Learn already covers the baseline. Read this through the Learn MCP instead of
restating it:

- [Optimize environment costs][waf-co08]: what development, testing, staging and
  production are for, and how closely preproduction should match production.

This skill adds which environments a team of a given size needs, who deploys
production at each size, and what changes when the team grows. Building the
layout on a cloud is covered by that cloud's plugin.

## Precedence

1. A layout the project already defines wins. Look in its `AGENTS.md`, docs, IaC
   and CI configuration.
2. If none is written down, infer it from the environments the product already
   has, and compare them with the tier below for the team's size. Report a
   mismatch; don't change it.
3. Only for a new product, or when asked to redesign, use the tiers below.

## The input: team size

Count the people who deploy or change the product's infrastructure and code, not
everyone in the organization. If the task doesn't say, ask. Never assume a size
to pick a tier.

Application scale and compliance will change the shape too, but this skill
decides by team size alone for now. Name them as open questions when the task
mentions them, and don't let them move the tier.

## Tiers

| Team | Environments           | Shared scopes              | Production    |
| ---- | ---------------------- | -------------------------- | ------------- |
| 1    | `dev`, `prod`          | `global`                   | By hand       |
| 2-5  | `dev`, `stg`, `prod`   | `global`                   | By hand       |
| 6-15 | `devNN`, `stg`, `prod` | `dev`, `release`, `global` | Pipeline only |
| 16+  | Beyond this skill: ask |                            |               |

`devNN` is `dev01`, `dev02` and so on, one per dev environment.

What each environment is for:

- **`dev`, `dev01`…**: where people try changes. Cheap and disposable. With one
  dev environment it's `dev`; with several, they're numbered, and `dev` becomes
  what they share.
- **`stg`**: where a release is rehearsed before production, from the same
  definition as production.
- **`prod`**: what users see.
- **Shared scopes**: `global` holds what every environment uses, such as IaC
  state and pipeline identities. `dev` and `release` hold what the dev
  environments, or `stg` and `prod`, share.

### Why these tiers

- **1 person:** nobody else's change can surprise production, so a staging copy
  rehearses nothing that `dev` doesn't. It only doubles the cost.
- **2 to 5:** a second person's change can now reach production, so staging
  earns its place. With few people, the rules aren't strict yet, so deploying
  production by hand is acceptable.
- **6 to 15:** several features are in test at once, and people queue for a
  single dev environment. One dev environment per work stream that tests at the
  same time, at least two, all from one definition. With this many people,
  production is applied only by its pipeline.
- **More than 15, or tens of services:** the shape depends on how the teams and
  services are split, which this skill doesn't model yet. Say so, and ask how
  the teams and services divide before proposing anything.

## Gotchas

- **Don't separate environments by size.** Dev, test and prod as three sizes of
  the same thing rehearse nothing. Each environment has a purpose; `test` isn't
  one of them, because `stg` covers it.
- **Don't add staging for one person.** It's the most common over-build: a solo
  developer pays for an environment nobody else deploys to.
- **Moving from `dev` to `dev01` renames the dev environment.** Cloud resource
  names usually can't change, so the cloud plugin plans it as new resources and
  a data move. Say so when a team crosses from 5 to 6.
- **Count deployers, not headcount.** A company of fifty with three people on
  the product is a team of 3.

## Output

Give, in order:

1. **Team size** used, and where it came from. If it's missing, stop and ask.
2. **Tier**, and the environments, shared scopes and who deploys production, as
   a table.
3. **For 6 to 15:** the number of numbered dev environments, from the work
   streams that test at once, and the reason.
4. **What changes next:** which tier the team moves to as it grows, and what
   moving costs, such as renaming `dev` to `dev01`.
5. **Next step:** point to the cloud plugin that builds the layout. Don't name
   cloud resources, tiers or commands here.

Flag these as blockers, not notes: no team size, a team of more than 15, and an
existing layout that the project defines and the task would contradict.

Last verified: 2026-10-25

[waf-co08]:
  https://learn.microsoft.com/azure/well-architected/cost-optimization/optimize-environment-costs
