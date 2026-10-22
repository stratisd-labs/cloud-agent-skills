---
name: azure-cost-review
description:
  Azure cost review. Use when asked to cut an Azure bill, to explain why Azure
  costs jumped, to find what can be shut down or deleted, or to check whether a
  SKU is oversized. For tags that attribute cost, use azure-resource-tagging.
---

# Azure cost review

Propose savings; never stop, resize, delete or buy anything. Output the review
as described in the Output section and let the human apply it, following
`azure-propose-only`.

Learn already covers the baseline. Read these through the Learn MCP instead of
restating them:

- [Advisor cost recommendations][advisor-cost]: how Advisor flags idle and
  oversized VMs, and its limits.
- [Understand Cost Management data][cm-data]: latency, estimated vs closed
  periods, supported offers.
- [Azure Monitor Logs cost][la-cost]: table plans, retention and commitment
  tiers.
- [Savings plan or reservation][commit-decide]: which commitment fits which
  load.

This skill adds the order to look in, the thresholds that make a finding, and
the savings that cost more than they save. Tags that attribute cost are covered
by `azure-resource-tagging`.

## Precedence

1. A cost process the user's project already defines wins: FinOps reviews,
   budgets, approved exceptions such as a standby DR stack, or a team that owns
   commitments. Look in its `AGENTS.md`, docs and IaC, and at dismissed Advisor
   recommendations.
2. Without one, use the review order and thresholds below.

## Review order

Work in this order. Each step is cheaper to act on than the next, and
right-sizing before committing stops a reservation from locking in waste.

1. **Scope and spend.** Fix the scope (subscription, resource group or one
   resource) and a closed period: whole days, ending yesterday. Pull actual cost
   per resource and meter, and list the top 10 resources by cost. Savings are
   priced from this, not from retail prices.
2. **Orphans.** Resources that bill and serve nothing; see the Thresholds
   section.
3. **Oversized.** SKUs or instance counts above what the metrics show.
4. **Non-prod running 24/7.** VMs whose `environment` isn't `prod`, running
   every hour with no schedule.
5. **Log Analytics.** Ingestion by table, retention, table plan. Often the
   silent top line.
6. **Commitments.** Reservations or a savings plan, only for the baseline left
   after steps 2 to 5.

Rank findings by monthly saving, then effort (small, medium, large), then risk
(low, medium, high, irreversible).

## Thresholds

A finding is waste only when it meets its threshold:

- **Unattached managed disk**: `diskState` is `Unattached`, and
  `lastOwnershipUpdateTime` is over 14 days ago or, if it's empty because the
  disk was never attached, `timeCreated` is.
- **Unassociated public IP**: no `ipConfiguration` and no `natGateway`.
- **Empty App Service plan**: `numberOfSites` is 0.
- **Idle NAT gateway**: no subnet attached.
- **Old snapshot**: over 30 days old, and its `source` is missing from
  `az disk list` or has a newer snapshot. Group snapshots by `source` to find
  the newest.
- **Oversized VM or plan**: over at least 14 days, the P95 of hourly maximum CPU
  is at or below 35%, and peak memory use at or below 45%.
- **Non-prod running 24/7**: `environment` isn't `prod`, and the VM's compute
  meter in the step 1 spend lines shows 24 hours on every day of the period.
  Whether it runs right now is one sample; an auto-shutdown VM looks running by
  day.
- **Log Analytics retention**: an Analytics table keeps data past 31 days, or 90
  with Sentinel, and nobody named a reason.
- **Log Analytics commitment tier**: billable ingestion was 100 GB or more on
  every day of the last 31.
- **Reservation or savings plan**: the usage ran every hour of the last 30 days.
  Commit to the lowest hourly usage, never the average.

Why these numbers:

- **35% CPU and 45% memory**: one size down usually halves both, so the peak
  lands near 70% CPU and 90% memory. Any higher and the downsize causes the next
  incident.
- **14 days minimum**: Advisor's default lookback is 7 days, which misses a
  weekly batch. Use 30 days when the workload has a month-end peak, such as
  payroll or billing.
- **Hourly maximum, not average**: an average over 14 days flattens every peak
  the resized SKU must still absorb.

## Gotchas

- **Pull spend with `az consumption usage list`.** What a command does decides
  whether it's read-only, not its HTTP method: `az monitor log-analytics query`
  POSTs and only reads. The Cost Management Query API reads too, but no `az`
  command wraps it today, since the `costmanagement` extension only manages
  exports, and the hook denies every `az rest` POST because it can't read the
  body. If your extension has a `costmanagement query` command, prefer it. Learn
  puts the Usage Details API behind `az consumption` in maintenance mode, due
  for deprecation. If it errors or comes back empty, as it can on CSP or a new
  subscription, run `az costmanagement export list` to find a scheduled export
  and ask the human for its latest file, or for a Cost analysis export grouped
  by resource and meter. List the missing spend as a blocker.
- **Never count today, and treat the open month as an estimate.** Cost data
  lands 8 to 24 hours late, 72 on pay-as-you-go. For "why did costs jump",
  compare two closed windows of the same length, and check whether a reservation
  or savings plan purchase landed in the later one: in actual cost it shows as a
  one-day spike that amortized cost spreads out. Name both windows in the
  answer, and warn that figures for today and the open month are estimates.
- **Reprice every Advisor saving from actual cost.** Advisor prices at retail
  and ignores reservations and savings plans, so a resize it recommends can even
  raise cost when it moves a VM off a reserved series. Treat its list as
  candidates, then apply the thresholds above with your own metrics.
- **Pass `--offset 14d --interval 1h` to every sizing metrics query.** Without a
  window, `az monitor metrics list` reads the last hour. See [Azure Monitor
  queries][monitor-queries].
- **Stopping an App Service app saves nothing.** The plan bills per instance
  whether its apps run or not. Plan a scale-in, a smaller SKU or deleting the
  plan; for non-prod, recreate it from IaC when needed.
- **Plan `az vm deallocate`, never `az vm stop`.** A stopped VM keeps billing
  compute. Deallocating also drops a dynamic public IP and the temp disk, so say
  so in the blast radius.
- **A NAT gateway with low traffic isn't idle.** Removing it cuts outbound
  access on a private subnet, Windows activation and updates included. Subnets
  are private by default in the portal and with API versions released after 31
  March 2026; older API versions and existing VNets keep the old default. On
  those, egress moves to an unpredictable default outbound IP, which breaks
  partner allow lists. Only a NAT gateway with no subnet is an orphan.
- **Deleting a public IP releases the address for good.** Partners may allow
  list it. Ask who uses the address, and put the delete in Irreversible steps.
- **Check unattached disks against Site Recovery.** Replica and seed disks look
  unattached by design. Check whether a Recovery Services vault replicates the
  disk before listing it. For a real orphan, plan an incremental snapshot on
  Standard storage before the delete, and price it.
- **Downgrades that drop a feature or data go last.** They follow the
  irreversible rule in `azure-propose-only`. Name what each one loses:
  - App Service Standard to Basic: deployment slots, autoscale, and more than 3
    instances.
  - App Service to a tier with fewer slots: the scale fails until the extra
    slots are deleted.
  - A Premium storage account: no in-place change, so a new account and a data
    copy.
  - Blob tier to Archive: hours to rehydrate, and early deletion charges for 180
    days.
  - A Log Analytics retention cut: data older than the new retention is deleted.

  A managed disk from Premium SSD to Standard SSD is reversible but needs the VM
  deallocated, so it is downtime, not an irreversible step.

- **A Log Analytics daily cap is not a saving.** Collection stops when the cap
  hits, security logs included, and data over the cap still bills. Propose table
  plans, retention and fewer diagnostic categories instead.
- **Commitments are irreversible steps.** A savings plan can't be cancelled or
  exchanged. Reservations bought from 1 February 2027 can't be exchanged when a
  savings plan covers the service, and refunds are capped at USD 50,000 per 12
  months. A Log Analytics commitment tier locks for 31 days.
- **Untagged spend can't be attributed.** Report its share of the total as a
  finding and point to `azure-resource-tagging`; don't propose tags here.

## Checks before proposing

All read-only. They need Reader and Cost Management Reader at the scope; Cost
Management Reader also reads Advisor. Without it, run the rest and list the
spend pull as a blocker. Run the ones that apply:

```bash
# Which account and subscription is this?
az account show --query '{sub: id, name: name, user: user.name}'

# Actual cost lines for a closed period, per resource and meter
az consumption usage list --subscription <SUB> \
  --start-date <START> --end-date <END> --include-meter-details \
  --query '[].{res: instanceName, cost: pretaxCost, meter: meterId,
    qty: usageQuantity, day: usageStart}'

# If that fails: scheduled cost exports the human can pull a file from
az costmanagement export list --scope /subscriptions/<SUB>

# Orphans: unattached disks, unassociated IPs, empty plans, idle NAT
az disk list --subscription <SUB> \
  --query "[?diskState=='Unattached'].{name: name, gb: diskSizeGb,
    sku: sku.name, since: lastOwnershipUpdateTime, created: timeCreated}"
az network public-ip list --subscription <SUB> \
  --query '[?!ipConfiguration && !natGateway].{name: name, ip: ipAddress}'
az appservice plan list --subscription <SUB> \
  --query '[?numberOfSites==`0`].{name: name, sku: sku.name}'
az network nat gateway list --subscription <SUB> \
  --query '[?!subnets].name'
az snapshot list --subscription <SUB> \
  --query '[].{name: name, created: timeCreated, sku: sku.name,
    source: creationData.sourceResourceId}'

# Oversized: hourly peaks over 14 days (plans: CpuPercentage, MemoryPercentage)
# Memory on a VM is free memory: peak use is 100 minus its Minimum
az monitor metrics list --resource <VM_ID> \
  --metrics "Percentage CPU" "Available Memory Percentage" \
  --aggregation Maximum Minimum --interval 1h --offset 14d

# Non-prod candidates; the 24/7 evidence is the hours in the spend lines
az vm list --subscription <SUB> \
  --query "[?tags.environment!='prod'].{name: name,
    env: tags.environment, size: hardwareProfile.vmSize}"

# Log Analytics: workspace GUID, retention, cap; then billable GB by table
az monitor log-analytics workspace show --subscription <SUB> \
  --resource-group <RG> --workspace-name <WORKSPACE> \
  --query '{guid: customerId, days: retentionInDays,
    cap: workspaceCapping.dailyQuotaGb}'
az monitor log-analytics query --workspace <WORKSPACE_GUID> \
  --analytics-query "Usage | where IsBillable == true
    | summarize GB = sum(Quantity) / 1000 by DataType
    | sort by GB desc" --timespan P31D

# Advisor's cost candidates. Never pass --refresh: it regenerates them
az advisor recommendation list --subscription <SUB> --category Cost \
  --query '[].{res: impactedValue, problem: shortDescription.problem}'
```

`--workspace` takes the workspace GUID, `customerId`; see [Azure Monitor
queries][monitor-queries].

## Output

Give, in order:

1. **Scope**: subscription, scope, the closed period, and whether costs are
   actual or amortized. The total, and the top 10 resources by cost.
2. **Findings**: a table ranked as the Review order section describes, with
   these columns: rank, resource, finding, evidence, monthly saving, effort,
   risk. The evidence is the number that crossed a threshold, such as "P95 CPU
   18% over 14 days". Price the saving from actual cost; if only retail prices
   were available, label it a retail estimate.
3. **Checks**: which checks ran and what they returned, or why each was skipped.
4. **Plan**: one plan in the `azure-propose-only` format, steps in rank order,
   each with its saving and evidence. Deletes, the downgrades listed in Gotchas,
   retention cuts and commitments go under Irreversible steps, after the
   checkpoint. For IaC-managed resources, the step is the IaC change.
5. **Untagged spend**: its share of the total, pointing to
   `azure-resource-tagging`.

Flag these as blockers, not notes: no spend data for the period, a resize with
less than 14 days of metrics, a commitment proposed before right-sizing, and a
delete whose owner nobody has confirmed.

Last verified: 2026-10-15

[monitor-queries]: ../../reference/azure-monitor/queries.md
[advisor-cost]:
  https://learn.microsoft.com/azure/advisor/advisor-cost-recommendations
[cm-data]:
  https://learn.microsoft.com/azure/cost-management-billing/costs/understand-cost-mgt-data
[la-cost]: https://learn.microsoft.com/azure/azure-monitor/logs/cost-logs
[commit-decide]:
  https://learn.microsoft.com/azure/cost-management-billing/savings-plan/decide-between-savings-plan-reservation
