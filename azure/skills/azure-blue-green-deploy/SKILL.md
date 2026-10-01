---
name: azure-blue-green-deploy
description:
  Azure blue-green and zero-downtime releases. Use when planning a release
  through deployment slots or Container Apps revisions, when swapping a slot
  into production, when splitting traffic between an old and a new version, or
  when rolling back the last release. For slot names, use azure-resource-naming.
---

# Azure blue-green releases

Plan the release; never deploy, swap or shift traffic. Output the plan as
described in the Output section and let the human run it, following
`azure-propose-only`.

Learn already covers the baseline. Read these through the Learn MCP instead of
restating them:

- [Staging environments in App Service][slots]: slots, swap phases, which
  settings swap, swap with preview, warm-up settings.
- [Azure Functions deployment slots][func-slots]: slots per plan and Functions
  behavior during a swap.
- [Disable functions in a slot][func-disable]: the per-function setting.
- [Blue-green deployment in Container Apps][aca-bg]: revisions, labels and
  traffic weights.

This skill adds the order a release must follow, how to keep the way back real,
and the decisions the traps force. Slot names come from `azure-resource-naming`;
the plan format comes from `azure-propose-only`.

## Precedence

1. A release process the user's project already defines wins: a pipeline that
   deploys and swaps, an approval gate, a release window. Look in its
   `AGENTS.md`, docs and pipeline files, and fit the plan into that process.
2. If IaC defines traffic weights, change them there: App Service routing
   percentages and Container Apps traffic entries set with `az` are reverted by
   the next deployment. A swap isn't, because IaC doesn't declare which build
   sits in which slot, unless the templates swap through `targetBuildVersion`.
3. Otherwise, use the order below.

## Pick the mechanism

- **App Service, Standard tier or above**: a slot, then swap with preview.
- **Functions on Consumption, Premium or Dedicated**: a slot, then swap.
  Consumption has one staging slot only.
- **Functions on Flex Consumption**: no slots. Rolling updates are the built-in
  option and aren't blue-green; two apps behind a gateway are.
- **Container Apps**: multiple revision mode, labels and traffic weights.
- **Several resources that change together**: two stacks behind Front Door or
  Traffic Manager.

Prefer the mechanism the app already uses. Propose two stacks only when the new
version changes more than the app, such as its data store. Traffic Manager
routes by DNS, so the cut-over and its rollback both wait for cached records to
expire.

## Order of a release

Every plan follows this order. It is the delta on top of the
`azure-propose-only` format, not a replacement for it.

1. **Deploy green** to the slot, or to a new revision with the `green` label,
   through the project's pipeline. It takes no production traffic yet.
2. **Verify green on its own URL**: the slot's host name, or the label's URL.
3. **Preview**: for a slot, `swap --action preview`. It applies production's
   settings to the slot and restarts it, but moves no traffic.
4. **Stop** before the cut-over, the same way the `azure-propose-only`
   checkpoint works: the human checks step 3 and decides to go on or abort.
5. **Cut-over**, with the abort command written above it, so the way out is in
   front of the human before the change runs.
6. **Observe** for a window the human sets, with the signals to watch, and the
   rollback command for that window.
7. **Keep blue untouched** until the window closes. Deploying the next build to
   the slot, or deactivating the old revision, removes the rollback.
8. Cleanup, and the contract half of any database migration, go last, after the
   checkpoint, as irreversible steps.

## Gotchas

### App Service and Functions slots

- **Abort and rollback are different commands.** `--action` defaults to `swap`,
  so a plain swap during a pending preview completes the cut-over instead of
  undoing it. Before the cut-over, the way out is `--action reset`. After it,
  the way back is a new swap of the same slots, labelled to run only after the
  cut-over completed; it runs the full warm-up again, so it takes minutes.
- **Make environment-specific settings sticky before the first deploy to the
  slot.** Otherwise the slot's test database or queue moves into production with
  the swap. Check which names are sticky with `slotConfigNames`, which returns
  names only; `appsettings list` prints values.
- **`slotConfigNames` replaces the whole sticky list.** An IaC or `az` change
  that lists only the new name makes every other sticky setting swappable again.
  Always write the full list: the names `slotConfigNames` returns now, plus the
  new ones.
- **Give both slots one user-assigned identity.** Managed identities, VNet
  integration and IP restrictions stay with the slot, so the slot is verified
  with its own identity and network. A shared user-assigned identity needs one
  set of role assignments that can't drift; give the slot the same VNet
  integration too.
- **Slots share the plan's instances.** Load-testing the slot, or a build that
  crash-loops there, takes capacity from production. Load-test elsewhere.
- **Set `WEBSITE_SWAP_WARMUP_PING_STATUSES` to `200`** and
  `WEBSITE_SWAP_WARMUP_PING_PATH` to the health endpoint, on both slots. By
  default any status, 500 included, counts as warmed up.
- **Never leave a preview pending.** It locks the slot's configuration until the
  swap is completed or reset; every preview step needs both follow-ups.
- **With App Service authentication on in either slot, plan a direct swap.**
  Swap with preview isn't available then; rely on the warm-up settings above.
- **This repo's rule: no auto swap into production.** It removes the human's
  check in step 2.
- **Schedule the cut-over outside batch windows.** The last phase recycles the
  old production workers and drops long-running requests and running functions.
- **Keep a slot's non-HTTP triggers away from production.** Queue, Service Bus,
  Event Hubs and timer functions in the slot consume whatever their settings
  point to. Disable them in the slot with a sticky
  `AzureWebJobs.<FUNCTION>.Disabled` set to `true` there and `false` in
  production. During a preview, the slot runs with production's values, so they
  run against production from step 3. On Linux, a function with a hyphen in its
  name can't be disabled this way.
- **Check function keys before a Functions swap.** With
  `AzureWebJobsSecretStorageType` set to `files`, the swap resets them and
  callers using them break.
- **A Functions swap can fail when `AzureWebJobsStorage` is
  network-restricted.** Check the storage account's network rules in discovery.
- **A percentage split is per client.** A routed client stays pinned to the slot
  by cookie for up to an hour, so 10% means 10% of clients. Its rollback is
  `az webapp traffic-routing clear`.

### Container Apps revisions

- **Switch to multiple revision mode before deploying green.** In single
  revision mode the new revision replaces the old one, leaving nothing to roll
  back to.
- **Pin traffic to the current revision before deploying green.** With a
  `latestRevision: true` entry, the deploy itself becomes the cut-over.
- **Label both revisions before the first weight change.** `--label-weight`
  fails on a label no revision carries; give blue its label before deploying
  green.
- **Set both weights in every change.** They must add up to 100.
- **Keep blue active at weight 0 through the window.** Revisions past the
  retention cap are purged, and a purged revision can't be a rollback target.

### Database changes

- **A migration the old version can't run against makes rollback impossible.**
  Split it: the expand half (additive, readable by both versions) goes before
  the cut-over; the contract half (drops, renames) goes in a later release,
  after the window, as an irreversible step. A release with only a breaking
  migration is a blocker.

## Checks before proposing

All read-only. Run the ones that apply:

```bash
# Slots on the app (slots need Standard tier or above)
az webapp deployment slot list --resource-group <RG> --name <APP> \
  --subscription <SUB> --output table

# Settings that stay with the slot: names only, never values
ID=$(az webapp show --resource-group <RG> --name <APP> \
  --subscription <SUB> --query id --output tsv)
URL="https://management.azure.com${ID}/config/slotConfigNames"
az rest --url "${URL}?api-version=2023-12-01"

# Current traffic split across slots
az webapp traffic-routing show --resource-group <RG> --name <APP> \
  --subscription <SUB>

# Identity and VNet integration of the slot, to compare with production
az webapp identity show --resource-group <RG> --name <APP> \
  --slot <SLOT> --subscription <SUB>
az webapp vnet-integration list --resource-group <RG> --name <APP> \
  --slot <SLOT> --subscription <SUB>

# Health check path to use for warm-up
az webapp config show --resource-group <RG> --name <APP> \
  --subscription <SUB> --query healthCheckPath

# Container Apps: revision mode, traffic entries, revisions and labels
az containerapp show --resource-group <RG> --name <APP> \
  --subscription <SUB> \
  --query properties.configuration.activeRevisionsMode
az containerapp ingress traffic show --resource-group <RG> --name <APP> \
  --subscription <SUB>
az containerapp revision list --resource-group <RG> --name <APP> \
  --subscription <SUB> --output table
```

For function apps, use the `az functionapp` form of the same commands.

## Output

Give one plan in the `azure-propose-only` format, with these additions:

1. The mechanism from the Pick the mechanism section, and why.
2. The steps in the order under Order of a release. For a slot, the cut-over and
   the window around it look like this:

   ```bash
   # Abort, before the cut-over: cancel the pending preview
   az webapp deployment slot swap --resource-group <RG> --name <APP> \
     --slot <SLOT> --target-slot production --action reset \
     --subscription <SUB>

   # Cut-over: complete the swap started by the preview
   az webapp deployment slot swap --resource-group <RG> --name <APP> \
     --slot <SLOT> --target-slot production --action swap \
     --subscription <SUB>

   # Rollback, only after the cut-over completed: swap the same slots
   # back. It runs the full warm-up again.
   az webapp deployment slot swap --resource-group <RG> --name <APP> \
     --slot <SLOT> --target-slot production --action swap \
     --subscription <SUB>
   ```

   For Container Apps, label both revisions first; the cut-over and its rollback
   are both weight changes:

   ```bash
   az containerapp revision label add --resource-group <RG> \
     --name <APP> --revision <BLUE_REVISION> --label blue \
     --subscription <SUB>

   # Rollback: all traffic back to blue
   az containerapp ingress traffic set --resource-group <RG> \
     --name <APP> --label-weight blue=100 green=0 --subscription <SUB>

   # Cut-over: all traffic to green
   az containerapp ingress traffic set --resource-group <RG> \
     --name <APP> --label-weight blue=0 green=100 --subscription <SUB>
   ```

3. The observation window and what to watch during it: error rate, latency and
   the health endpoint.
4. The full sticky list as an IaC snippet: every name `slotConfigNames` returns
   now, plus any the release adds. For Bicep:

   ```bicep
   resource sticky 'Microsoft.Web/sites/config@2023-12-01' = {
     parent: app
     name: 'slotConfigNames'
     properties: {
       appSettingNames: [ '<EXISTING_SETTING>', '<NEW_SETTING>' ]
       connectionStringNames: [ '<EXISTING_CONNECTION>' ]
     }
   }
   ```

Flag any of these as a blocker, not a note: an environment-specific setting that
isn't sticky, a sticky list that drops existing names, a breaking migration with
no expand half, a traffic entry with `latestRevision: true`, a slot on Flex
Consumption, and a cut-over with no abort command above it.

Last verified: 2026-10-01

[slots]: https://learn.microsoft.com/azure/app-service/deploy-staging-slots
[func-slots]:
  https://learn.microsoft.com/azure/azure-functions/functions-deployment-slots
[func-disable]:
  https://learn.microsoft.com/azure/azure-functions/disable-function#disable-functions-in-a-slot
[aca-bg]: https://learn.microsoft.com/azure/container-apps/blue-green-deployment
