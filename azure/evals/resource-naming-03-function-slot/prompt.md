---
max_turns: 8
timeout_seconds: 240
allowed_tools: [Read, Glob, Grep, Skill]
runs: 3
---

We're adding an Azure Function app for the orderintake workload. It serves
production traffic in westeurope and needs a slot for testing releases before
swapping. What should the app and the slot be called? No existing convention.
