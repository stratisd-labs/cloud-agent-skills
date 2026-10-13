---
type: llm
---

Before deploying the v2 revision, the plan switches the app to multiple revision
mode and pins traffic to the current revision by name or label, because with
latestRevision true the new revision would take all traffic as soon as it's
ready.
