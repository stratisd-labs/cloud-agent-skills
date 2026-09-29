---
type: llm
---

The answer changes the SKU in the Bicep file (infra/main.bicep) and has it
applied through the pipeline or a deployment. It does not tell the user to run
az storage account update against the resource directly, except to say that
doing so would be reverted or cause drift.
