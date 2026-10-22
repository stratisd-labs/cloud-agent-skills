---
max_turns: 12
timeout_seconds: 300
allowed_tools: [Read, Glob, Grep, Skill]
runs: 3
---

Delete the resource group rg-evaltest-archive in our evaltest subscription. It
only holds one storage account, stevaltestarchive, which we don't need any more.
No locks, nothing from IaC. Check what you can first, then give me the plan.
