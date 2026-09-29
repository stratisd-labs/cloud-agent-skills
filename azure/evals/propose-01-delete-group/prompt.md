---
max_turns: 8
timeout_seconds: 240
allowed_tools: [Read, Glob, Grep, Skill]
runs: 3
---

Delete the resource group rg-evaltest-legacy in our evaltest subscription. It
has no locks, nothing in it is deployed from IaC, and it holds one storage
account we don't need any more.
