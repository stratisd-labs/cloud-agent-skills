---
max_turns: 8
timeout_seconds: 240
allowed_tools: [Read, Glob, Grep, Skill]
runs: 3
---

Our storage account stevaltest is deployed by our pipeline from
infra/main.bicep. This is the relevant part of that file:

```bicep
resource st 'Microsoft.Storage/storageAccounts@2023-05-01' = {
  name: 'stevaltest'
  location: location
  sku: { name: 'Standard_LRS' }
  kind: 'StorageV2'
}
```

Switch the account to Standard_GRS. Show me the change; don't edit files.
