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
- [Blue-green deployment in Container Apps][aca-bg]: revisions, labels and
  traffic weights.

This skill adds the order a release must follow, how to keep the rollback real,
and the traps that turn a swap into an outage. Slot names come from
`azure-resource-naming`; the plan format comes from `azure-propose-only`.

## Precedence

1. A release process the user's project already defines wins: a pipeline that
   deploys and swaps, an approval gate, a release window. Look in its
   `AGENTS.md`, docs and pipeline files, and fit the plan into that process.
2. If IaC defines the app, its slots or its traffic weights, change them there.
   Swapping or setting weights with `az` against IaC-managed traffic config is
   reverted by the next deployment.
3. Otherwise, use the order below.

## Pick the mechanism

- **App Service, Standard tier or above**: a slot, then swap with preview.
- **Functions on Consumption, Premium or Dedicated**: a slot, then swap.
  Consumption has one staging slot only.
- **Functions on Flex Consumption**: no slots. Rolling updates are the only
  option; say that it isn't blue-green.
- **Container Apps**: multiple revision mode, labels and traffic weights.
- **Several resources that change together**: two stacks behind Front Door or
  Traffic Manager.

Prefer the mechanism the app already uses. Propose two stacks only when the new
version changes more than the app, such as its data store. Traffic Manager
routes by DNS, so both the cut-over and its rollback take effect only as
clients' cached records expire.

## Order of a release

Every plan follows this order. It is the delta on top of the
`azure-propose-only` format, not a replacement for it.

1. **Deploy green** to the slot or a new revision, through the project's
   pipeline. It takes no production traffic yet.
2. **Verify green on its own URL**: the slot's host name, or the revision
   label's URL.
3. **Preview**: for a slot, `swap --action preview`. It applies production's
   settings to the slot and restarts it, but moves no traffic. Its rollback is
   `swap --action reset`.
4. **Stop** before the cut-over, the same way the `azure-propose-only`
   checkpoint works: the human checks step 3 and decides to go on.
5. **Cut-over**, with its rollback command written above the cut-over command,
   so the way back is in front of the human before the change runs.
6. **Observe** for a window the human sets, with the signals to watch.
7. **Keep blue untouched** until the window closes. Deploying the next build to
   the slot, or deactivating the old revision, removes the rollback.
8. Cleanup, and the contract half of any database migration, go last, after the
   checkpoint, as irreversible steps.

## Gotchas

### App Service and Functions slots

- **Make environment-specific settings sticky before the first deploy to the
  slot.** App settings and connection strings swap by default, so a slot
  pointing at a test database takes that database into production. Check which
  names are sticky with `slotConfigNames`, which returns names only. Never run
  `appsettings list` or `connection-string list` to check: they print values.
- **Settings that stay with the slot mean the slot runs with its own identity
  and network.** Managed identities, VNet integration, IP restrictions and
  private endpoints don't swap, and private endpoints aren't cloned. Give the
  slot's identity the same role assignments as production's, and the slot the
  same VNet integration, or verification in step 2 passes or fails for the wrong
  reason.
- **Warm-up counts any HTTP response as ready, 500 included.** Set
  `WEBSITE_SWAP_WARMUP_PING_PATH` to the health endpoint and
  `WEBSITE_SWAP_WARMUP_PING_STATUSES` to `200` on both slots, so a failing build
  stops the swap instead of going live.
- **A preview left pending locks the slot.** Until the swap is completed or
  reset, the slot's configuration can't change. Every preview step needs both
  follow-ups in the plan: complete with `--action swap`, or back out with
  `--action reset`.
- **Swap with preview doesn't work while App Service authentication is on in
  either slot.** Say so, and plan a direct swap with the warm-up settings above
  instead.
- **Never propose auto swap for production.** It skips step 2, and it isn't
  supported on Linux or for containers.
- **The rollback swap works only while the slot still holds blue.** Rollback is
  the same swap again. Once the next build lands in the slot, it swaps the new
  build back in.
- **The last phase recycles the old production workers.** Long-running requests
  and executing functions are dropped, so schedule the cut-over outside batch
  windows. On Functions, a swap doesn't guarantee zero downtime.
- **A slot runs its non-HTTP triggers.** Queue, Service Bus, Event Hubs and
  timer functions in the slot consume from whatever their settings point to.
  Make those connection settings sticky and point them away from production, or
  disable the functions in the slot with a sticky
  `AzureWebJobs.<FUNCTION>.Disabled` setting set to `true`.
- **Function keys reset on swap when `AzureWebJobsSecretStorageType` is
  `files`.** Callers using those keys break after the cut-over.
- **A traffic split is per client, not per request.** A routed client is pinned
  to the slot by a cookie for up to an hour, so 10% means 10% of clients, and
  they keep seeing the same version.

### Container Apps revisions

- **Switch to multiple revision mode before deploying green.** In single
  revision mode, the new revision replaces the old one, and there's nothing to
  split or roll back to.
- **Pin traffic to the current revision by name before deploying green.** A
  traffic entry with `latestRevision: true` sends all traffic to every new
  revision as soon as it's ready: deploying green is then the cut-over.
- **Name every revision in each weight change.** Weights must add up to 100; set
  both, by label or revision name, in one command.
- **Keep blue active at weight 0 through the window.** Deactivating it is a
  cleanup step. Inactive revisions past the retention cap are purged, and a
  purged revision can't be a rollback target.

### Database changes

- **A migration the old version can't run against makes rollback impossible.**
  Swapping back puts blue on a schema it doesn't understand. Split it: the
  expand half (additive, readable by both versions) goes before the cut-over,
  and the contract half (drops, renames) goes in a later release, after the
  window, as an irreversible step. A release with only a breaking migration is a
  blocker.

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

# Container Apps: revision mode, and the current traffic entries
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
2. The steps in the order under Order of a release. The cut-over step shows its
   rollback command first, then the cut-over command. For a slot:

   ```bash
   # Rollback: swap the same slots back
   az webapp deployment slot swap --resource-group <RG> --name <APP> \
     --slot <SLOT> --target-slot production --subscription <SUB>

   # Cut-over: complete the swap started by the preview
   az webapp deployment slot swap --resource-group <RG> --name <APP> \
     --slot <SLOT> --target-slot production --action swap \
     --subscription <SUB>
   ```

   For Container Apps, rollback and cut-over are both weight changes:

   ```bash
   # Rollback: all traffic back to blue
   az containerapp ingress traffic set --resource-group <RG> \
     --name <APP> --label-weight blue=100 green=0 --subscription <SUB>

   # Cut-over: all traffic to green
   az containerapp ingress traffic set --resource-group <RG> \
     --name <APP> --label-weight blue=0 green=100 --subscription <SUB>
   ```

3. The observation window and what to watch during it: error rate, latency and
   the health endpoint.
4. Sticky settings the release needs, as an IaC snippet. For Bicep:

   ```bicep
   resource sticky 'Microsoft.Web/sites/config@2023-12-01' = {
     parent: app
     name: 'slotConfigNames'
     properties: {
       appSettingNames: [ '<SETTING>' ]
       connectionStringNames: [ '<CONNECTION>' ]
     }
   }
   ```

Flag any of these as a blocker, not a note: an environment-specific setting that
isn't sticky, a breaking migration with no expand half, a traffic entry with
`latestRevision: true`, a slot on Flex Consumption, and a cut-over with no
rollback command above it.

Last verified: 2026-09-30

[slots]: https://learn.microsoft.com/azure/app-service/deploy-staging-slots
[func-slots]:
  https://learn.microsoft.com/azure/azure-functions/functions-deployment-slots
[aca-bg]: https://learn.microsoft.com/azure/container-apps/blue-green-deployment
