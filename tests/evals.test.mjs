// Structural checks on each plugin's eval suite: the rules in AGENTS.md
// (Evals) that a machine can check without running a model.

import assert from "node:assert/strict";
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");

const dirs = (path) =>
  existsSync(path)
    ? readdirSync(path, { withFileTypes: true })
        .filter((e) => e.isDirectory())
        .map((e) => e.name)
    : [];

// Reads the `key: value` lines of a file's frontmatter.
function frontmatter(path) {
  const match = readFileSync(path, "utf8").match(/^---\n([\s\S]*?)\n---/);
  const fields = {};
  for (const line of (match?.[1] ?? "").split("\n")) {
    const i = line.indexOf(":");
    if (i === -1) continue;
    fields[line.slice(0, i).trim()] = line
      .slice(i + 1)
      .trim()
      .replace(/^"(.*)"$/, "$1");
  }
  return fields;
}

const plugins = dirs(root).filter((d) =>
  existsSync(join(root, d, ".claude-plugin", "plugin.json"))
);

for (const plugin of plugins) {
  const skills = dirs(join(root, plugin, "skills")).map((name) => ({
    name,
    short: name.replace(new RegExp(`^${plugin}-`), "")
  }));
  const evalDir = join(root, plugin, "evals");
  const cases = dirs(evalDir)
    .filter((name) => existsSync(join(evalDir, name, "prompt.md")))
    .map((name) => {
      const graderDir = join(evalDir, name, "graders");
      const graders = existsSync(graderDir)
        ? readdirSync(graderDir)
            .filter((f) => f.endsWith(".md"))
            .map((f) => frontmatter(join(graderDir, f)))
        : [];
      return {
        name,
        prompt: frontmatter(join(evalDir, name, "prompt.md")),
        graders
      };
    });

  const skillGraders = (c) =>
    c.graders.filter((g) => g.type === "tool_used" && g.tool === "Skill");
  const firesFor = (c, skill) =>
    skillGraders(c).some(
      (g) => g.input_match?.includes(skill) && g.max !== "0"
    );
  const mustNotFire = (c, skill) =>
    skillGraders(c).some(
      (g) => g.input_match?.includes(skill) && g.max === "0"
    );

  // MCP mocks: suite-wide in evals/mocks/<server>/, or per case in
  // evals/<case>/mocks/<server>/. Each <tool>.md must name a tool the pinned
  // server still has, per the saved tools/list in evals/mocks/<server>/
  // _tools.json; `pnpm mocks:tools` refreshes that file after a version bump.
  const mcpServers = Object.keys(
    JSON.parse(readFileSync(join(root, plugin, ".mcp.json"), "utf8"))
      .mcpServers ?? {}
  );
  const mockDirs = [
    join(evalDir, "mocks"),
    ...cases.map((c) => join(evalDir, c.name, "mocks"))
  ].filter(existsSync);

  for (const mockDir of mockDirs) {
    const where = mockDir.slice(root.length + 1);
    test(`${plugin}: mocks in ${where} match the pinned servers`, () => {
      for (const server of dirs(mockDir)) {
        assert.ok(
          mcpServers.includes(server),
          `${where}/${server}: no server named ${server} in .mcp.json`
        );
        const saved = join(evalDir, "mocks", server, "_tools.json");
        assert.ok(existsSync(saved), `missing ${saved}; run pnpm mocks:tools`);
        const tools = new Set(
          JSON.parse(readFileSync(saved, "utf8")).tools.map((t) => t.name)
        );
        const dir = join(mockDir, server);
        for (const file of readdirSync(dir)) {
          if (!file.endsWith(".md") || file.startsWith("_")) continue;
          const tool = file.slice(0, -3);
          assert.ok(
            tools.has(tool),
            `${where}/${server}/${file}: the pinned server has no tool ` +
              `${tool}; run pnpm mocks:tools and rename or drop the mock`
          );
          const body = readFileSync(join(dir, file), "utf8");
          for (const [, ref] of body.matchAll(/\{\{file:([^}]+)\}\}/g)) {
            const fixture = join(dir, ref);
            assert.ok(existsSync(fixture), `${where}/${server}: no ${ref}`);
            if (ref.endsWith(".json")) {
              JSON.parse(readFileSync(fixture, "utf8"));
            }
          }
        }
      }
    });
  }

  if (skills.length === 0) continue;

  test(`${plugin}: every case is named <skill>-NN-<what> or neg-NN-<what>`, () => {
    const prefixes = [...skills.map((s) => s.short), "neg"].join("|");
    const pattern = new RegExp(`^(${prefixes})-\\d{2}-[a-z0-9-]+$`);
    for (const c of cases) assert.match(c.name, pattern, c.name);
  });

  test(`${plugin}: every case has an outcome grader and runs 3+ times`, () => {
    for (const c of cases) {
      assert.ok(
        c.graders.some((g) => g.type && g.type !== "tool_used"),
        `${c.name}: needs a grader that checks the outcome`
      );
      const runs = Number(c.prompt.runs ?? 3);
      assert.ok(runs >= 3, `${c.name}: runs is ${runs}, needs 3 or more`);
    }
  });

  test(`${plugin}: the suite has a case where no skill should fire`, () => {
    const none = cases.filter(
      (c) =>
        c.name.startsWith("neg-") &&
        skillGraders(c).some((g) => g.max === "0" && !g.input_match)
    );
    assert.ok(none.length > 0, "add a neg-NN-<what> case");
  });

  for (const skill of skills) {
    test(`${plugin}: ${skill.name} has 3+ cases that should trigger it`, () => {
      const own = cases.filter(
        (c) => c.name.startsWith(`${skill.short}-`) && firesFor(c, skill.name)
      );
      assert.ok(
        own.length >= 3,
        `found ${own.length}; add ${skill.short}-NN-<what> cases with a ` +
          `tool_used: Skill grader for ${skill.name}`
      );
    });

    test(`${plugin}: ${skill.name} has a case it must not trigger on`, () => {
      assert.ok(
        cases.some((c) => mustNotFire(c, skill.name)),
        `add a case with a tool_used: Skill grader for ${skill.name} and ` +
          "max: 0"
      );
    });
  }
}
