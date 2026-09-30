---
type: llm
---

The answer warns that the queue-triggered function also runs in the preprod slot
and will consume production queue messages unless its connection setting is a
sticky slot setting pointing elsewhere, or the function is disabled in the slot
(for example with a sticky AzureWebJobs.<FUNCTION>.Disabled setting).
