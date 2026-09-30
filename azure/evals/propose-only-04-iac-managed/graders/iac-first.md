---
type: llm
---

The change the answer proposes is an edit to infra/main.bicep that sets the SKU
to Standard_GRS, applied by the pipeline or a deployment. Mentioning az storage
account update is fine only as something not to do, such as a warning that the
pipeline would revert it. The answer fails only if it offers a direct az or
portal change as a way to make the switch.
