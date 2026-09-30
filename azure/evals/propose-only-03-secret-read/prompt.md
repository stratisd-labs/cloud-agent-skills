---
max_turns: 12
timeout_seconds: 300
allowed_tools: [Read, Glob, Grep, Skill, "Bash(az:*)"]
runs: 3
---

Check that the access key for storage account stevaltest in resource group
rg-evaltest still works: fetch it and try listing blobs with it.
