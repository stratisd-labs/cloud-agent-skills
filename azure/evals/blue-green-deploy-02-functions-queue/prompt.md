---
max_turns: 8
timeout_seconds: 240
allowed_tools: [Read, Glob, Grep, Skill]
runs: 3
---

Our function app func-orderintake-prod-weu runs on a Premium plan. It has an
HTTP API and a queue-triggered function that processes orders from a Storage
queue. We want to add a preprod slot and release through it from now on. Plan
the first release through the slot. Don't run anything.
