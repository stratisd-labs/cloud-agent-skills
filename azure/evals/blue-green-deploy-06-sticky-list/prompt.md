---
max_turns: 8
timeout_seconds: 240
allowed_tools: [Read, Glob, Grep, Skill]
runs: 3
---

Release v2 of app-orderintake-prod, an App Service app with a preprod slot,
defined in Bicep. v2 adds an app setting PAYMENT_API_URL whose value must differ
between production and the slot. slotConfigNames returns appSettingNames
ORDERS_DB and QUEUE_CONN today. Show the Bicep change for the slot settings.
Don't run anything.
