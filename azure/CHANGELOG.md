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
  that can't be rolled back.
- `azure-resource-naming` skill: a naming convention on top of the Cloud
  Adoption Framework, region codes, deployment slot naming, and length and
  name-reuse traps.
- `azure-resource-tagging` skill: a required tag set, a `vm-user` tag recording
  the login account on virtual machines, and the traps that break cost reports.
