---
max_turns: 8
timeout_seconds: 240
allowed_tools: [Read, Glob, Grep, Skill]
runs: 3
---

Our container app ca-orderintake-prod-weu reports activeRevisionsMode Labels,
and its traffic sends 100% to the label prod. Plan a blue-green release of image
tag v2. Don't run anything.
