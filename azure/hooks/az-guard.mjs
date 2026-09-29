#!/usr/bin/env node
// PreToolUse guard for the Bash tool: denies commands that change Azure state
// or print secrets, so the agent puts them in a plan instead. The rules live
// in az-guard-policy.json; this file only parses commands and applies them.
//
// It is a guard, not a sandbox: a script file or an SDK call gets past it.
// It never answers "allow", so the user's own permission rules still apply.

import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const policy = JSON.parse(
  readFileSync(join(here, "az-guard-policy.json"), "utf8")
);

const PLAN = "Put it in the plan for the human instead (azure-propose-only).";

// Commands whose arguments are text, not commands to run.
const TEXT_COMMANDS = new Set([
  "echo",
  "printf",
  "grep",
  "egrep",
  "fgrep",
  "rg",
  "git",
  "jq"
]);
const SHELLS = new Set(["bash", "sh", "zsh", "dash"]);
const SHELL_KEYWORDS = new Set([
  "!",
  "{",
  "}",
  "if",
  "then",
  "else",
  "elif",
  "fi",
  "do",
  "done",
  "while",
  "until",
  "time"
]);
// Wrappers that run the rest of the line, with their options that take a value.
const WRAPPERS = {
  sudo: ["-u", "-g"],
  env: ["-u"],
  nohup: [],
  command: [],
  exec: [],
  nice: ["-n"],
  stdbuf: [],
  timeout: ["-s", "-k"],
  watch: ["-n"],
  xargs: ["-I", "-n", "-P", "-L", "-d", "-E", "-s", "-a"]
};

// `az` as a command word: at the start, or after a separator or quote.
const AZ_WORD = /(^|[\s;&|(`'"$=/])az(\.cmd|\.exe)?\s+[a-z-]/gi;
// A PowerShell Az cmdlet, such as Remove-AzResourceGroup.
const AZ_CMDLET = /\b([a-z]+)-Az([a-z0-9]+)\b/gi;

const deny = (reason) => ({ decision: "deny", reason });
const ALLOW = { decision: "allow" };

// Replaces $(...) and `...` with a placeholder, returning their contents.
// Single-quoted text is left alone, as the shell leaves it alone.
function extractSubstitutions(str) {
  const inner = [];
  let out = "";
  let quote = null;
  for (let i = 0; i < str.length; i++) {
    const c = str[i];
    if (quote !== "'" && c === "\\") {
      out += c + (str[i + 1] ?? "");
      i++;
      continue;
    }
    if (quote === "'") {
      if (c === "'") quote = null;
      out += c;
      continue;
    }
    if (c === "'" && quote === null) {
      quote = "'";
      out += c;
      continue;
    }
    if (c === '"') {
      quote = quote === '"' ? null : '"';
      out += c;
      continue;
    }
    if (c === "$" && str[i + 1] === "(") {
      let depth = 1;
      let j = i + 2;
      while (j < str.length && depth > 0) {
        if (str[j] === "(") depth++;
        else if (str[j] === ")") depth--;
        j++;
      }
      inner.push(str.slice(i + 2, j - 1));
      out += "__SUBST__";
      i = j - 1;
      continue;
    }
    if (c === "`") {
      const j = str.indexOf("`", i + 1);
      const end = j === -1 ? str.length : j;
      inner.push(str.slice(i + 1, end));
      out += "__SUBST__";
      i = end;
      continue;
    }
    out += c;
  }
  return { rest: out, inner };
}

// Splits on unquoted ; & | newlines and parentheses. Returns raw segments.
function splitSegments(str) {
  const segments = [];
  let current = "";
  let quote = null;
  for (let i = 0; i < str.length; i++) {
    const c = str[i];
    if (quote !== "'" && c === "\\") {
      current += c + (str[i + 1] ?? "");
      i++;
      continue;
    }
    if (quote) {
      if (c === quote) quote = null;
      current += c;
      continue;
    }
    if (c === "'" || c === '"') {
      quote = c;
      current += c;
      continue;
    }
    if (";&|\n()".includes(c)) {
      segments.push(current);
      current = "";
      continue;
    }
    current += c;
  }
  segments.push(current);
  return segments.filter((s) => s.trim() !== "");
}

// Splits one segment into words, removing quotes and escapes.
function words(segment) {
  const out = [];
  let current = "";
  let inWord = false;
  let quote = null;
  for (let i = 0; i < segment.length; i++) {
    const c = segment[i];
    if (quote === "'") {
      if (c === "'") quote = null;
      else current += c;
      continue;
    }
    if (c === "\\") {
      current += segment[i + 1] ?? "";
      inWord = true;
      i++;
      continue;
    }
    if (quote === '"') {
      if (c === '"') quote = null;
      else current += c;
      continue;
    }
    if (c === "'" || c === '"') {
      quote = c;
      inWord = true;
      continue;
    }
    if (/\s/.test(c)) {
      if (inWord) out.push(current);
      current = "";
      inWord = false;
      continue;
    }
    current += c;
    inWord = true;
  }
  if (inWord) out.push(current);
  return out;
}

const base = (word) =>
  word
    .split(/[\\/]/)
    .pop()
    .replace(/\.(cmd|exe)$/i, "");

// Drops env assignments, shell keywords and wrappers from the front.
function unwrap(argv) {
  let args = [...argv];
  for (;;) {
    while (
      args.length &&
      (/^[A-Za-z_][A-Za-z0-9_]*=/.test(args[0]) || SHELL_KEYWORDS.has(args[0]))
    ) {
      args.shift();
    }
    const name = args.length ? base(args[0]) : "";
    if (!(name in WRAPPERS)) return args;
    const valued = WRAPPERS[name];
    args.shift();
    while (args.length && args[0].startsWith("-")) {
      const flag = args.shift();
      if (valued.includes(flag)) args.shift();
    }
    if (name === "timeout" && args.length) args.shift(); // the duration
  }
}

// Leading words that look like subcommands, up to the first flag or value.
function commandPath(args) {
  const path = [];
  for (const arg of args) {
    if (!/^[a-z][a-z0-9-]*$/.test(arg)) break;
    path.push(arg);
  }
  return path;
}

function flagValue(args, names) {
  for (let i = 0; i < args.length; i++) {
    for (const name of names) {
      if (args[i] === name) return args[i + 1];
      if (args[i].startsWith(`${name}=`)) return args[i].slice(name.length + 1);
    }
  }
  return undefined;
}

function evaluateAzRest(args) {
  const rules = policy.azRest;
  const method = (flagValue(args, ["--method", "-m"]) ?? "get").toLowerCase();
  if (!rules.readMethods.includes(method)) {
    return deny(`\`az rest --method ${method}\` can change Azure. ${PLAN}`);
  }
  const url = (flagValue(args, ["--url", "--uri", "-u"]) ?? "").toLowerCase();
  if (rules.secretUrlPatterns.some((p) => url.includes(p))) {
    return deny(`This \`az rest\` call can return a secret. ${PLAN}`);
  }
  return ALLOW;
}

function evaluateAz(args) {
  const rules = policy.az;
  if (args.length === 0 || args.some((a) => a === "-h" || a === "--help")) {
    return ALLOW;
  }
  if (args[0] === "--version") return ALLOW;
  const path = commandPath(args);
  const joined = path.join(" ");
  if (path.length === 0) {
    return deny(`Couldn't tell what \`az ${args[0]}\` does. ${PLAN}`);
  }
  if (path[0] === "rest") return evaluateAzRest(args.slice(1));
  if (rules.localCommands.includes(joined)) return ALLOW;

  const verb = path[path.length - 1];
  const isRead =
    rules.readVerbs.includes(verb) ||
    rules.readVerbPrefixes.some((p) => verb.startsWith(p));
  if (!isRead) {
    return deny(`\`az ${joined}\` changes Azure state. ${PLAN}`);
  }
  const pathWords = path.flatMap((w) => w.split("-"));
  if (
    pathWords.some((w) => rules.secretWords.includes(w)) &&
    !rules.secretWordExceptions.includes(joined)
  ) {
    return deny(`\`az ${joined}\` can print a secret. ${PLAN}`);
  }
  return ALLOW;
}

function evaluateAzd(args) {
  const joined = commandPath(args).join(" ");
  if (args.some((a) => a === "-h" || a === "--help")) return ALLOW;
  if (policy.azd.readCommands.includes(joined)) return ALLOW;
  return deny(`\`azd ${joined}\` can change Azure or print secrets. ${PLAN}`);
}

function evaluateTerraform(name, args) {
  const rules = policy.terraform;
  const rest = args.filter((a) => !a.startsWith("-chdir"));
  const path = commandPath(rest);
  const first = path.slice(0, 1).join(" ");
  const two = path.slice(0, 2).join(" ");
  const known = rules.readCommands.includes(two)
    ? two
    : rules.readCommands.includes(first) && first !== "state"
      ? first
      : null;
  if (!known) {
    return deny(`\`${name} ${two || first}\` changes state. ${PLAN}`);
  }
  const flag = rest.find((a) =>
    rules.deniedFlags.some((f) => a === f || a.startsWith(`${f}=`))
  );
  if (flag) {
    return deny(
      `\`${name} ${known} ${flag}\` changes state or prints secrets. ${PLAN}`
    );
  }
  return ALLOW;
}

// Az PowerShell cmdlets anywhere in the text, e.g. inside `pwsh -c "..."`.
function evaluateCmdlets(text) {
  const rules = policy.powershell;
  for (const [cmdlet, verb, noun] of text.matchAll(AZ_CMDLET)) {
    if (!rules.readVerbs.includes(verb.toLowerCase())) {
      return deny(`\`${cmdlet}\` changes Azure state. ${PLAN}`);
    }
    const bare = noun.toLowerCase().replace(/keyvault/g, "");
    if (rules.secretWords.some((w) => bare.includes(w))) {
      return deny(`\`${cmdlet}\` can print a secret. ${PLAN}`);
    }
  }
  return ALLOW;
}

// Evaluates one command line, already split into words.
function evaluateArgv(argv, raw, depth) {
  const args = unwrap(argv);
  if (args.length === 0) return ALLOW;
  const name = base(args[0]);
  const rest = args.slice(1);

  if (name === "az") return evaluateAz(rest);
  if (name === "azd") return evaluateAzd(rest);
  if (name === "terraform" || name === "tofu") {
    return evaluateTerraform(name, rest);
  }
  if (SHELLS.has(name)) {
    const i = rest.indexOf("-c");
    if (i !== -1 && rest[i + 1] !== undefined) {
      return evaluate(rest[i + 1], depth + 1);
    }
  }
  if (name === "eval") return evaluate(rest.join(" "), depth + 1);
  if (name === "find") {
    const i = rest.findIndex((a) => ["-exec", "-execdir", "-ok"].includes(a));
    if (i !== -1) {
      const end = rest.findIndex((a, j) => j > i && (a === ";" || a === "+"));
      const sub = rest.slice(i + 1, end === -1 ? undefined : end);
      return evaluateArgv(sub, sub.join(" "), depth + 1);
    }
  }
  if (TEXT_COMMANDS.has(name)) return ALLOW;

  // Anything else that mentions az or an Az cmdlet, such as `python -c` or
  // `ssh host az ...`, is a command this guard can't read. Fail closed.
  const cmdlets = evaluateCmdlets(raw);
  if (cmdlets.decision === "deny") return cmdlets;
  AZ_WORD.lastIndex = 0;
  if (AZ_WORD.test(raw)) {
    return deny(
      `\`${name}\` runs az in a way this guard can't check. Run az directly, ` +
        `or ${PLAN.charAt(0).toLowerCase()}${PLAN.slice(1)}`
    );
  }
  return ALLOW;
}

export function evaluate(command, depth = 0) {
  if (depth > 5) return deny(`Too deeply nested to check. ${PLAN}`);
  const { rest, inner } = extractSubstitutions(command);
  for (const sub of inner) {
    const verdict = evaluate(sub, depth + 1);
    if (verdict.decision === "deny") return verdict;
  }
  for (const segment of splitSegments(rest)) {
    const verdict = evaluateArgv(words(segment), segment, depth);
    if (verdict.decision === "deny") return verdict;
  }
  return ALLOW;
}

function main() {
  let raw = "";
  try {
    raw = readFileSync(0, "utf8");
    const input = JSON.parse(raw);
    if (input.tool_name !== "Bash") return;
    const verdict = evaluate(String(input.tool_input?.command ?? ""));
    if (verdict.decision === "deny") respond(verdict.reason);
  } catch (error) {
    // Fail closed only when the input looks like it touches Azure.
    if (/\baz\b|\bazd\b|-Az[A-Z]|terraform/i.test(raw)) {
      respond(`The Azure guard failed (${error.message}). ${PLAN}`);
    }
  }
}

function respond(reason) {
  process.stdout.write(
    JSON.stringify({
      hookSpecificOutput: {
        hookEventName: "PreToolUse",
        permissionDecision: "deny",
        permissionDecisionReason: reason
      }
    })
  );
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href) main();
