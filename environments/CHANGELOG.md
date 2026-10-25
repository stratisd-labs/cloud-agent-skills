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
  to 5 adds `stg`, and may still deploy production by hand; a team of 6 to 15
  gets numbered dev environments, `stg`, `prod` and the shared scopes `dev`,
  `release` and `global`. Larger teams are beyond the skill, and it asks.
