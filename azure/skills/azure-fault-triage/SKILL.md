---
name: azure-fault-triage
description:
  Azure fault triage. Use when an Azure app or resource is failing and the cause
  isn't known yet, such as an API returning 503s, a function that stopped
  firing, a latency spike at a given time, or a failed deployment. For shipping
  the fix through slots or revisions, use azure-blue-green-deploy.
---

# Azure fault triage

Propose a diagnosis and a fix; never restart, scale, roll back or change
anything. Output the triage as described in the Output section and let the human
apply it, following `azure-propose-only`.

Learn already covers the baseline. Read these through the Learn MCP instead of
restating them:

- [Resource Health overview][rh]: availability states and what each means.
- [Activity log][activity]: what it records and how to filter it.
- [App Service diagnostics][as-diag]: the Diagnose and solve problems detectors.
- [Container Apps deployment failures][aca-fail]: revision states, probes and
  system logs.

This skill adds the order to look in, what clears the platform, and the first
checks per service that Learn spreads across pages. Shipping the fix is covered
by `azure-blue-green-deploy`.

## Precedence

1. A runbook, on-call guide or dashboard the project already has wins. Look in
   its `AGENTS.md`, docs and alert rules, and follow its order.
2. Without one, use the triage order below.

## Triage order

Work in this order. Most incidents are the platform or a change, and both are
cheaper to confirm than an application cause.

1. **Frame.** The symptom, the affected resource, when it started (in UTC), and
   what the human says changed. A start time is required: ask for one rather
   than querying "now". The window runs from 2 hours before the start to the
   end, or to now if it's ongoing.
2. **Rule out the platform.** Service Health events that overlap the window in
   the resource's region, then the resource's Resource Health history. An
   overlapping incident or an `Unavailable` state with a platform cause ends the
   search: the plan is to wait, fail over, or open a ticket, not to change the
   app.
3. **What changed.** The resource group's activity log and deployment history
   from 24 hours before the start to its end. A change that lands minutes before
   the start is the leading hypothesis until the evidence clears it.
4. **Evidence.** Metrics and logs for the window, per service below.
5. **Rank hypotheses** by the evidence for each, and give each the query that
   confirms or rules it out.
6. **Plan** the fix, and the check that shows it worked.

## First checks per service

### App Service and Functions

- **Platform restarts.** They don't appear in the activity log; only a
  `SiteStarted` shows that the app started. Read Resource Health history, and
  ask the human to run the Web App Restarted detector under Diagnose and solve
  problems. A restart lines up with 5xx bursts and cold starts. On one instance,
  every platform upgrade is downtime.
- **Slot swaps.** A swap restarts the target's workers. Look for
  `Microsoft.Web/sites/slots/slotsswap/action` in the activity log; one just
  before the start makes the swapped build the first suspect. To roll back, hand
  over to `azure-blue-green-deploy`.
- **SNAT exhaustion.** Intermittent 5xx and time-outs to dependencies, with
  normal CPU, point to it: each instance starts with 128 SNAT ports, used up by
  repeated connections to the same address and port. Check dependency latency
  first: slow backends hold connections open, so exhaustion is usually the
  symptom. Ask the human to run the SNAT Port Exhaustion detector; there's no
  metric for it.
- **A function app that stopped firing** right after a rename, a new slot, or a
  second app on the same storage account: check for a host ID collision. Ask the
  human to run the Function App Down or Reporting Errors detector, which checks
  for them. See [host ID collisions][hostid].

### Container Apps

- **Revision state first.** List revisions with their health, running and
  provisioning state. A new revision that's `Degraded` or still provisioning
  points to probes, the image or the target port.
- **Probes.** System logs show probe failures. With ingress on and no probes
  configured, defaults apply; a slow-starting app then fails them. Compare the
  probe port with the ingress `targetPort`.

## Gotchas

- **Resource Health in Resource Graph covers VMs only.** `HealthResources`
  returns availability for virtual machines; for App Service, Functions,
  Container Apps and the rest, read the resource's history through the Resource
  Health API or the Azure MCP.
- **A clean activity log doesn't clear the platform.** It records control plane
  operations: deployments, swaps, scaling, config writes. Platform maintenance
  and crashes don't appear there.
- **`az monitor activity-log list` reads 6 hours and 50 events by default.**
  Pass `--start-time`, `--end-time` and `--max-events`, or the change that
  caused a morning incident is cut off. The Azure MCP's activity log command
  takes `hours` back from now instead: set it to reach 24 hours before the
  start.
- **`az monitor log-analytics query` reads all data by default.** Without
  `--timespan`, a query scans the table's whole retention. Bound every query to
  the window.
- **Metrics and log queries need the window and the workspace GUID.** See [Azure
  Monitor queries][monitor-queries].
- **A restart is a mitigation, not a diagnosis.** It clears temporary files,
  process state and the instance the fault lived on. Capture the evidence first,
  and plan the restart after the checkpoint with what it destroys in its blast
  radius.
- **Use UTC everywhere.** Activity log, metrics and logs are in UTC; convert the
  human's start time once, in step 1, and say so.

## Checks before proposing

All read-only. Prefer the Azure MCP's `resourcehealth` and `monitor` tools when
they're loaded; these are the CLI equivalents. Run the ones that apply:

```bash
# Which account and subscription is this?
az account show --query '{sub: id, name: name, user: user.name}'

# Platform: Service Health events (resource-graph extension); keep the
# ones whose impact overlaps the window and the resource's region
az graph query -q "ServiceHealthResources
  | where type =~ 'Microsoft.ResourceHealth/events'
  | project title = properties.Title, kind = properties.EventType,
    status = properties.Status, start = properties.ImpactStartTime,
    end = properties.ImpactMitigationTime"

# Platform: the resource's Resource Health history, any resource type
az rest --method get --url "https://management.azure.com<RESOURCE_ID>\
/providers/Microsoft.ResourceHealth/availabilityStatuses\
?api-version=2025-05-01" \
  --query "value[].{state: properties.availabilityState,
    at: properties.occuredTime, cause: properties.reasonType,
    summary: properties.summary}"

# Changes: control plane operations, 24 hours before the start to the end
az monitor activity-log list --resource-group <RG> \
  --start-time <START_MINUS_24H> --end-time <END> --max-events 500 \
  --query "[?status.value=='Succeeded' || status.value=='Failed'].{
    at: eventTimestamp, op: operationName.value,
    status: status.value, by: caller}"

# Changes: deployments, and why a failed one failed
az deployment group list --resource-group <RG> \
  --query "[].{name: name, state: properties.provisioningState,
    at: properties.timestamp}"
az deployment operation group list --resource-group <RG> \
  --name <DEPLOYMENT> \
  --query "[?properties.provisioningState=='Failed'].properties.statusMessage"

# Evidence, App Service and Functions: 5xx and latency over the window
az monitor metrics list --resource <RESOURCE_ID> \
  --metrics Http5xx Requests --aggregation Total \
  --start-time <START> --end-time <END> --interval 5m
az monitor metrics list --resource <RESOURCE_ID> \
  --metrics HttpResponseTime --aggregation Average \
  --start-time <START> --end-time <END> --interval 5m

# Evidence: failed requests and slow dependencies, workspace-based App Insights
az monitor log-analytics query --workspace <WORKSPACE_GUID> \
  --timespan <START>/<END> \
  --analytics-query "AppRequests | where Success == false
    | summarize failed = count() by ResultCode, bin(TimeGenerated, 5m)"
az monitor log-analytics query --workspace <WORKSPACE_GUID> \
  --timespan <START>/<END> \
  --analytics-query "AppDependencies
    | summarize p95 = percentile(DurationMs, 95), failed = countif(not(Success))
      by Target, bin(TimeGenerated, 5m)"

# Functions: runtime errors, a host ID collision among them
az monitor log-analytics query --workspace <WORKSPACE_GUID> \
  --timespan <START>/<END> \
  --analytics-query "AppTraces | where SeverityLevel >= 3
    | project TimeGenerated, AppRoleName, Message"  # verify: AZFD0004 text

# Container Apps: revision state, probes, then platform events
az containerapp revision list --resource-group <RG> --name <APP> \
  --query "[].{rev: name, health: properties.healthState,
    running: properties.runningState,
    provisioning: properties.provisioningState,
    traffic: properties.trafficWeight}"
az containerapp revision show --resource-group <RG> --name <APP> \
  --revision <REVISION> --query "properties.template.containers[].probes"
az containerapp logs show --resource-group <RG> --name <APP> \
  --type system --tail 50
```

`--timespan` takes `<START>/<END>` in ISO 8601, UTC.

## Output

Give, in order:

1. **Frame**: the symptom, the resource, the window in UTC, and what the human
   said changed.
2. **Checks**: which checks ran, in the triage order, and what each returned, or
   why it was skipped. Platform and change checks come first.
3. **Timeline**: the changes, health transitions and metric shifts in the
   window, in time order, against the start time.
4. **Hypotheses**: ranked, each with the evidence for and against, the query
   that confirms or rules it out, and a confidence of high, medium or low.
5. **Most likely cause**: one line, with the evidence that decides it, or
   "unknown" and the check that would decide it.
6. **Plan**: one plan in the `azure-propose-only` format. Mitigation first, then
   the fix. Its verification step names the metric or query that should return
   to the baseline, and the value it had before the start.

Flag these as blockers, not notes: no start time, a platform incident that
overlaps the window, a check that couldn't run for the platform or the changes,
and a fix proposed with no evidence that ranks it first.

Last verified: 2026-10-22

[hostid]: ../../reference/azure-functions/configuration.md
[monitor-queries]: ../../reference/azure-monitor/queries.md
[rh]: https://learn.microsoft.com/azure/service-health/resource-health-overview
[activity]:
  https://learn.microsoft.com/azure/azure-monitor/fundamentals/activity-log
[as-diag]: https://learn.microsoft.com/azure/app-service/overview-diagnostics
[aca-fail]:
  https://learn.microsoft.com/azure/container-apps/troubleshoot-deployment-errors
