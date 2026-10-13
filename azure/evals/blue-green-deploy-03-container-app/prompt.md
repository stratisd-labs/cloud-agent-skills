---
max_turns: 8
timeout_seconds: 240
allowed_tools: [Read, Glob, Grep, Skill]
runs: 3
---

Our container app ca-orderintake-prod-weu runs in single revision mode, and its
ingress traffic has one entry: latestRevision true, weight 100. Plan a
blue-green release of image tag v2: 10% of traffic first, then 100%. Don't run
anything.
