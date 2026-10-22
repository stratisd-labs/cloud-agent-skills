---
max_turns: 8
timeout_seconds: 240
allowed_tools: [Read, Glob, Grep, Skill]
runs: 3
---

Plan a blue-green release of app-evaltest-web in rg-evaltest-app: deploy build
2.4 to the preprod slot, check it, and swap it into production.
