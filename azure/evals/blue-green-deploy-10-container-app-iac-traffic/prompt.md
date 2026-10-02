---
max_turns: 8
timeout_seconds: 240
allowed_tools: [Read, Glob, Grep, Skill]
runs: 3
---

Our container app ca-orderintake-prod-weu is in multiple revision mode. Our
pipeline deploys it by applying a Bicep template whose ingress traffic block is
a single entry: latestRevision true, weight 100. The live revision has no label.
Plan a blue-green release of image tag v2. Don't run anything.
