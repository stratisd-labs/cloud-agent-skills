---
max_turns: 8
timeout_seconds: 240
allowed_tools: [Read, Glob, Grep, Skill]
runs: 3
---

Our container app ca-orderintake-prod-weu is in multiple revision mode. Last
week we released through labels: the revision labelled green now takes 100% of
traffic, and the one labelled blue takes 0%. Plan the blue-green release of
image tag v3. Don't run anything.
