# Changelog

All notable changes to the `azure` plugin are recorded here. The format follows
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and versions follow
[Semantic Versioning](https://semver.org/). Each release is tagged
`azure--vX.Y.Z`.

## [0.1.0] - Unreleased

### Added

- Plugin manifest (`.claude-plugin/plugin.json`).
- MCP configuration (`.mcp.json`): the Azure MCP server pinned to
  `@azure/mcp@2.0.5` and started with `--read-only`, and the Microsoft Learn MCP
  server.
- `azure-propose-only` skill: the read-only rule, the plan format every
  `azure-*` skill shares, commands that look read-only but aren't, and the steps
  that can't be rolled back. When discovery can't run, or the resource group,
  subscription or image is missing, it still gives the plan, with each gap as a
  blocker.
- `PreToolUse` hook (`hooks/`): denies Bash commands that change Azure or print
  secrets, across `az`, `az rest`, `azd`, Terraform and Az PowerShell, and
  points the agent to `azure-propose-only`. It fails closed on commands that
  mention `az` in a form it can't parse. A guard, not a sandbox.
- `azure-resource-naming` skill: a naming convention on top of the Cloud
  Adoption Framework, region codes, deployment slot naming, and length and
  name-reuse traps.
- `azure-resource-tagging` skill: a required tag set, a `vm-user` tag recording
  the login account on virtual machines, and the traps that break cost reports.
  It never fills in a person's address for `owner` itself.
- `azure-blue-green-deploy` skill: releases through deployment slots, Container
  Apps revisions or two stacks, in a fixed order with the abort command written
  above every cut-over and a separate rollback for the window after it. Covers
  settings that swap by default, a sticky list that must be written in full,
  warm-up that treats a 500 as ready, queue triggers running in a slot, the
  `latestRevision` trap, Container Apps labels read as live and candidate rather
  than fixed colors, and migrations that make a swap-back impossible.
