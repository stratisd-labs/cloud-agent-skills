# Changelog

All notable changes to the `environments` plugin are recorded here. The format
follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and versions
follow [Semantic Versioning](https://semver.org/). Each release is tagged
`environments--vX.Y.Z`.

## [1.0.0] - Unreleased

### Added

- Plugin manifest (`.claude-plugin/plugin.json`). The plugin is cross-cloud: no
  MCP server and no hook, since it never reads or changes a cloud.
