---
max_turns: 12
timeout_seconds: 300
allowed_tools: [Read, Glob, Grep, Skill, "Bash(az:*)"]
runs: 3
---

Release v2 of app-orderintake-prod (App Service, Standard plan, resource group
rg-orderintake-prod, evaltest subscription). The pipeline already deployed v2 to
the preprod slot. Swap it into production with zero downtime.
