# Changelog

All notable changes to the `environments` plugin are recorded here. The format
follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and versions
follow [Semantic Versioning](https://semver.org/). Each release is tagged
`environments--vX.Y.Z`.

## [1.0.0] - Unreleased

### Added

- Plugin manifest (`.claude-plugin/plugin.json`). The plugin is cross-cloud: no
  MCP server and no hook, since it never reads or changes a cloud.
- `environments-choose-shape` skill: which environments a product needs, chosen
  by team size. A single developer gets `dev`, `prod` and `global`; a team of 2
  to 5 adds `stg`; a team of 6 to 15 gets numbered dev environments, or
  per-branch ones when the IaC is fast enough, plus `stg`, `prod` and the shared
  scopes `dev` and `global`. `release` is the definition `stg` and `prod` share,
  not a place for resources. Production is deployed only by its pipeline, at
  every size. Larger teams are beyond the skill, and it asks.
