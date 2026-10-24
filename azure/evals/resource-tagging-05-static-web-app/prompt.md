---
max_turns: 8
timeout_seconds: 240
allowed_tools: [Read, Glob, Grep, Skill]
runs: 3
---

We're creating a Static Web App for app1's web domain in production, West
Europe, and its resource group. It serves app1.example.com; its default host is
<RANDOM>.azurestaticapps.net. Business unit marketing, run by the web team
(mailbox web-team@example.com), IaC in example-org/app1-infra. Which tags go on
the app and which on the resource group? Nothing is defined for tags yet.
