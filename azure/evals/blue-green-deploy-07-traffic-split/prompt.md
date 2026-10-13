---
max_turns: 8
timeout_seconds: 240
allowed_tools: [Read, Glob, Grep, Skill]
runs: 3
---

For app-orderintake-prod (App Service, Standard plan), send 10% of production
traffic to v2 in the preprod slot for a day, then all of it. Plan it; don't run
anything.
