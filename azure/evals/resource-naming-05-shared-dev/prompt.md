---
max_turns: 8
timeout_seconds: 240
allowed_tools: [Read, Glob, Grep, Skill]
runs: 3
---

The shop app has three identical dev environments, dev01 to dev03. We want one
Service Bus namespace in westeurope that all three share, instead of one each.
What should it be called, and what about its resource group? No naming
convention yet.
