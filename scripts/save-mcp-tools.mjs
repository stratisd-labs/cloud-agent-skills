#!/usr/bin/env node
// Saves the tools/list of each mocked stdio MCP server to
// <cloud>/evals/mocks/<server>/_tools.json, starting the server at the version
// its plugin's .mcp.json pins. Run it after that version changes: the eval
// tests check every mocked tool name against this file.
//
// Usage: pnpm mocks:tools [<cloud>...]   (default: every plugin with mocks)

import { spawn } from "node:child_process";
import { existsSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");

function listTools({ command, args = [], env = {} }) {
  return new Promise((resolve, reject) => {
    const server = spawn(command, args, {
      env: { ...process.env, ...env },
      stdio: ["pipe", "pipe", "inherit"],
      shell: process.platform === "win32"
    });
    const send = (message) =>
      server.stdin.write(`${JSON.stringify({ jsonrpc: "2.0", ...message })}\n`);
    const timer = setTimeout(() => {
      server.kill();
      reject(new Error("timed out waiting for tools/list"));
    }, 180_000);
    let buffer = "";
    server.stdout.on("data", (chunk) => {
      buffer += chunk;
      let end;
      while ((end = buffer.indexOf("\n")) !== -1) {
        const line = buffer.slice(0, end).trim();
        buffer = buffer.slice(end + 1);
        let message;
        try {
          message = JSON.parse(line);
        } catch {
          continue;
        }
        if (message.id === 1) {
          send({ method: "notifications/initialized" });
          send({ id: 2, method: "tools/list" });
        } else if (message.id === 2) {
          clearTimeout(timer);
          server.kill();
          if (message.error) reject(new Error(message.error.message));
          else resolve(message.result);
        }
      }
    });
    server.on("error", reject);
    send({
      id: 1,
      method: "initialize",
      params: {
        protocolVersion: "2025-06-18",
        capabilities: {},
        clientInfo: { name: "save-mcp-tools", version: "1" }
      }
    });
  });
}

const plugins = process.argv.slice(2).length
  ? process.argv.slice(2)
  : readdirSync(root).filter((d) => existsSync(join(root, d, "evals/mocks")));

for (const plugin of plugins) {
  const { mcpServers } = JSON.parse(
    readFileSync(join(root, plugin, ".mcp.json"), "utf8")
  );
  const mocks = join(root, plugin, "evals/mocks");
  for (const name of readdirSync(mocks)) {
    const server = mcpServers[name];
    if (!server?.command) continue; // Not a stdio server, or not this plugin's
    const result = await listTools(server);
    const out = join(mocks, name, "_tools.json");
    writeFileSync(out, `${JSON.stringify(result, null, 2)}\n`);
    console.log(`${plugin}/${name}: ${result.tools.length} tools -> ${out}`);
  }
}
