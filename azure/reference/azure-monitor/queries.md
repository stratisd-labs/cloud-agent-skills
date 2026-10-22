# Azure Monitor queries from the CLI

Deltas on top of Learn's [metrics][metrics-cli] and [Log Analytics
query][la-cli] references. Azure Monitor has no WAF service guide of its own;
the [Log Analytics][waf-la] and [Application Insights][waf-ai] guides cover
parts of it.

## Pin the time window on every metrics query

**When to use it:** any `az monitor metrics list` call, for sizing, cost or
incident evidence.

**The decision:** always pass an explicit window, `--start-time` and
`--end-time`, or `--offset` with an `--interval` that suits it: `1h` over 14
days for sizing, `1m` to `5m` around an incident.

**Why:** `--offset` defaults to `1h`, ending now, and `--interval` to one
minute. Without a window, a busy VM looks idle, and an incident from this
morning isn't in the result at all. The command returns no error either way.

### Gotchas

- **Write `--interval` as `##h##m`**, such as `5m` or `1h`, the format its
  reference documents.
- **Pick the aggregation the metric supports.** `Http5xx` and `Requests`
  aggregate as `Total`; `HttpResponseTime` as `Average`. Check
  `az monitor metrics list-definitions` before asking for `Maximum`.

### IaC

None: the window belongs to the query, not to the resource.

### Cost impact

None. Platform metrics are free to read.

Last verified: 2026-10-22

## Query Log Analytics by workspace GUID

**When to use it:** any `az monitor log-analytics query` call.

**The decision:** pass `--workspace` the workspace's `customerId`, a GUID, and
read it from `az monitor log-analytics workspace show` or the IaC output below.
Never pass the workspace name.

**Why:** the reference documents `--workspace` as the workspace GUID, not its
name or resource ID. Looking the GUID up once is cheaper than an agent retrying
the query with guesses.

### Gotchas

- **Workspace-based Application Insights uses other table names.** In the
  workspace, query `AppRequests`, `AppDependencies`, `AppExceptions` and
  `AppTraces`, with `TimeGenerated`. `requests` and `timestamp` belong to the
  Application Insights resource.

### IaC

```bicep
// Expose the GUID so pipelines and agents never need the name lookup
output workspaceGuid string = workspace.properties.customerId
```

### Cost impact

None for the lookup. Queries on Analytics tables are included in ingestion;
Basic and Auxiliary tables bill per GB scanned.

Last verified: 2026-10-22

[metrics-cli]: https://learn.microsoft.com/cli/azure/monitor/metrics
[la-cli]: https://learn.microsoft.com/cli/azure/monitor/log-analytics
[waf-la]:
  https://learn.microsoft.com/azure/well-architected/service-guides/azure-log-analytics
[waf-ai]:
  https://learn.microsoft.com/azure/well-architected/service-guides/application-insights
