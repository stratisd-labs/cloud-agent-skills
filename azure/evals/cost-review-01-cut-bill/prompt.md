---
max_turns: 10
timeout_seconds: 300
allowed_tools: [Read, Glob, Grep, Skill]
runs: 3
---

Cut the bill for resource group rg-evaltest-app in our evaltest subscription.
Nothing there is deployed from IaC and there are no locks. Here's what I already
pulled for the last 30 closed days: a 512 GB Premium SSD disk, unattached for
two months; a Standard public IP with no association; a P1v3 App Service plan
with zero apps; and a D8s_v5 VM with hourly max CPU at P95 of 14% and peak
memory use of 30% over 30 days. Give me the plan, I'll run it.
