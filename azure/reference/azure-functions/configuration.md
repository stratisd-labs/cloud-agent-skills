# Azure Functions configuration

Deltas on top of the [Azure Functions WAF service guide][waf] and Learn's
[storage considerations][storage]. Read those through the Learn MCP first.

## Host ID collisions

**When to use it:** naming a function app, adding a slot or a second app on a
storage account another app already uses, or triaging a function app that
stopped firing.

**The decision:** keep every function app name at 32 characters or fewer. Where
two apps or slots must share a storage account and their names can't change, set
`AzureFunctionsWebHost__hostid` explicitly on each, slots included, as a sticky
slot setting.

**Why:** the runtime derives the host ID from the app name, truncated to 32
characters, and keys trigger state in the storage account by it. Two apps or
slots whose names match in the first 32 characters, on one storage account,
share a host ID. On runtime 4.x that's a hard failure: the host logs `AZFD0004`
and shuts down, so every function stops, timers and queues included. Earlier
runtimes only logged a warning, which is why an upgrade can surface an old
collision. Names that put the environment last, such as
`func-<workload>-prod-weu` and `func-<workload>-stg-weu`, differ only at the
end, so they collide first.

### Gotchas

- **Confirm the collision before renaming anything.** A host that stops right
  after a rename, a new slot or a second app on the same storage account points
  here. The Function App Down or Reporting Errors detector checks for host ID
  collisions; the runtime logs them as `AZFD0004`.
- **The fix moves trigger state.** Changing the host ID or the storage account
  resets the state keyed by the old ID: a Blob trigger reprocesses blobs it
  already handled. Plan the change as a step the human confirms, with that side
  effect in its blast radius.
- **A slot collision needs both slots fixed.** Set a distinct host ID on the
  production slot and on every other slot, and make each a sticky setting, or
  the next swap moves it.

### IaC

```bicep
// One per app and per slot; a distinct value each, at most 32 characters:
// lowercase letters, digits and single dashes, not at either end.
resource settings 'Microsoft.Web/sites/config@2023-12-01' = {
  parent: functionApp
  name: 'appsettings'
  properties: {
    AzureFunctionsWebHost__hostid: '<HOST_ID>'
    // ...the app's other settings: this resource replaces the whole set
  }
}

// Sticky, so a swap leaves each slot's host ID where it is. This also
// replaces the whole list: see "Write the full sticky list in IaC" in
// azure-blue-green-deploy.
resource sticky 'Microsoft.Web/sites/config@2023-12-01' = {
  parent: functionApp
  name: 'slotConfigNames'
  properties: {
    appSettingNames: [
      'AzureFunctionsWebHost__hostid'
      // ...every name the app already marks sticky
    ]
  }
}
```

### Cost impact

None for the setting. A separate storage account per app costs a few units of
currency a month at low volume, and avoids the collision without renaming.

Last verified: 2026-10-22

[waf]:
  https://learn.microsoft.com/azure/well-architected/service-guides/azure-functions
[storage]:
  https://learn.microsoft.com/azure/azure-functions/storage-considerations
