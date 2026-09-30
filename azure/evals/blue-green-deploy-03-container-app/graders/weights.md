---
type: llm
weight: 0.5
---

Each traffic shift sets the weights of both revisions (adding up to 100), and
each shift has a rollback that puts all traffic back on the old revision. The
old revision stays active until the release is confirmed.
