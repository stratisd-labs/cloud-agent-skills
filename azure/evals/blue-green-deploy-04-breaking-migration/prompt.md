---
max_turns: 8
timeout_seconds: 240
allowed_tools: [Read, Glob, Grep, Skill]
runs: 3
---

Plan tonight's release of app-orderintake-prod (App Service with a preprod
slot). v2 ships with a database migration that renames the orders.customer
column to orders.customer_id; v1 reads orders.customer. We swap preprod into
production as usual. Don't run anything.
