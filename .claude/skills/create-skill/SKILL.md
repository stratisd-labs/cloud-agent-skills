---
name: create-skill
description:
  Create, restructure or change an agent skill in this cloud-agent-skills repo,
  such as a new azure-* skill under azure/skills/. Use when adding a skill to a
  plugin, turning notes into a skill, reshaping an existing skill to the repo's
  standard structure, or changing what an existing skill tells the agent to do.
  Not for skills in other repos.
---

# Create a skill in this repo

This skill is the workflow and the template. The rules live in `AGENTS.md` and
the reasoning in `ARCHITECTURE.md`; read both first and follow them over
anything here. Don't copy rules from them into the skill you write.

Steps 1 and 4 need the Learn and Azure MCP servers. If their tools aren't
available, stop and ask the human to restart with
`claude --plugin-dir ./<cloud>`.

To change an existing skill rather than create one, keep it to the template in
step 3 and finish with step 5. Step 5's eval item then means adding or updating
a case that would fail without your change.

## 1. Decide whether it's a skill at all

Answer these before writing anything. If an answer is no, stop and say why.

- **Is it a task?** Skills are verbs an agent is asked to do, such as naming a
  resource or reviewing cost. Knowledge about one resource type is a noun and
  goes in `<cloud>/reference/<service>/<topic>.md` instead.
- **Is there a delta?** List what the skill adds on top of Microsoft Learn:
  opinions, thresholds, traps, exact settings. Check each item against the Learn
  MCP. If Learn already says it, link to it instead. A skill with no delta left
  doesn't ship.
- **Is it new?** Look in `<cloud>/skills/`. Extend a skill that already covers
  the task rather than adding a near-duplicate that competes with it.
- **Does another skill already hold a trap you need?** Search `<cloud>/skills/`
  for the services the new skill touches. If a trap you need is already written
  there, don't copy it: move it to `reference/` as `AGENTS.md` describes, and
  point both skills to it.
- **Is it one task?** If the draft covers two things an agent would be asked for
  separately, such as naming and tagging, split it into two skills that point to
  each other.

## 2. Name and describe it

Follow the naming rules in `AGENTS.md`. Then check the description:

- It opens with the cloud name.
- It says when to use the skill, in the words a task would use: "when choosing a
  name for", not "resource naming concepts".
- It names the sibling skill for adjacent tasks: "For tags, use
  azure-resource-tagging."

The description is the only part an agent sees before loading the skill. If it
wouldn't match the task, the body never gets read.

## 3. Write it from the template

Use this structure, in this order. Leave a section out only if it would be
empty; don't rename or reorder the ones you keep.

````markdown
---
name: <cloud>-<verb-phrase>
description:
  <Cloud> <task>. Use when <trigger>, when <trigger>, or when <trigger>. For
  <adjacent task>, use <sibling-skill>.
---

# <Title in sentence case>

Propose <things>; never <create, change or apply> anything. Output the proposal
as described in the Output section and let the human apply it.

Learn already covers the baseline. Read these through the Learn MCP instead of
restating them:

- [<Learn page title>][<ref>]: <what it covers, in a few words>.

This skill adds <the delta, in one line>. <Sibling task> is covered by
`<sibling-skill>`.

## Precedence

1. A <convention> the user's project already defines wins. Look in its
   `AGENTS.md`, docs and IaC, and at Azure Policy.
2. If none is written down, infer it from the target subscription and follow it.
   Report deviations; don't fix them.
3. Only on a greenfield estate, use the <convention> below.

## <The delta: convention, decision rules or thresholds>

## Gotchas

- **<The trap, stated as a fact.>** <Why it bites and what to do instead.>

## Checks before proposing

All read-only. Run the ones that apply:

```bash
# <Question the command answers>
az <command> --<verified-flag> <PLACEHOLDER>
```

## Output

For each <item>, give:

1. <The proposal itself, with the numbers that justify it.>
2. Which checks ran and what they returned, or why a check was skipped.
3. An IaC snippet in the project's IaC language.

Flag any <failure condition> as a blocker, not a note.

Last verified: YYYY-MM-DD

[<ref>]: https://learn.microsoft.com/<path>
````

### Section notes

- **Propose-only line.** Every skill that touches cloud state opens with it.
  Keep it to one sentence, point to the Output section by name, and name
  `<cloud>-propose-only`. Don't restate its rules.
- **Precedence.** Include it whenever the skill imposes a convention. The
  adopter's existing convention always wins over this repo's opinion.
- **The delta.** Tables for lookups, short rules for decisions. Say why when the
  reason isn't obvious; an agent follows a rule it understands more reliably
  than a bare one.
- **Gotchas.** Only traps you verified or hit in production. Lead with the
  decision the trap forces, in bold, then the reason. If Learn already states
  the underlying fact, the bullet exists only for the decision; a bullet that
  would just repeat Learn is cut.
- **Checks.** Read-only commands only, each under a comment saying what question
  it answers. Verify every flag against the Learn MCP; tag any you couldn't
  `# verify`. Then run each one through the Azure MCP or `az` against a
  non-production subscription, as `AGENTS.md` describes, and check the output
  matches what the skill says it returns.
- **Last verified.** The date you last checked the content against Learn.

### The Output section

This is the contract between the skill and the human, so make it concrete:

- A numbered list of exactly what to give for each item, in order. No prose
  deliverables like "explain the options".
- Always include the evidence: which checks ran and what they returned.
- Always include something the human can apply: an IaC snippet in the project's
  IaC language, or a plan in the `<cloud>-propose-only` format for existing
  resources. Mutating commands appear only as plan steps for the human, never
  run.
- End with the blocker rule: which findings stop the proposal, so the agent
  doesn't bury them in a list of notes.

## 4. Writing rules the linters don't catch

- **No in-page anchor links.** Write "the Output section", not a link. Agents
  read the whole file, and some tools resolve `#anchor` as a file path.
- **Reference-style links for long URLs**, collected at the bottom. A URL alone
  on its line may pass 80 columns; nothing else may.
- **Placeholders only**: `<SUB>`, `<RG>`, `<NAME>`. Worked examples use generic
  words like `workload1`, never a real client, team, person or email.
- **Indent code blocks that belong to a list item under that item**, three
  spaces for a numbered item. An unindented fence ends the list, so the snippet
  floats free of the deliverable it belongs to.
- **Keep code blocks under 80 columns by hand**, with `\` line continuations in
  shell. Prettier won't wrap them.
- **Check placeholders survive the shell.** `<TEAM_MAILBOX>`, not
  `<TEAM MAILBOX>`, in anything meant to be run.

## 5. Finish

1. Follow the versioning rules in `AGENTS.md` for the plugin you changed, and
   add the skill to its `CHANGELOG.md`.
2. Run `pnpm format`, then `pnpm format:check` and `pnpm lint:md`.
3. Run `pnpm exec claude plugin validate <cloud> --strict`.
4. Add eval cases under `<cloud>/evals/` as `AGENTS.md` describes, or for a
   change, add or update a case that would fail without it. Run `pnpm test`,
   then `pnpm eval --case "<skill>-*"`. A skill whose cases don't beat the
   no-plugin arm has no delta left; go back to step 1.
5. Search the new files for anything that isn't a placeholder: client names,
   emails, IDs, resource names. Output from a live check is the likeliest
   source; write what it returned as placeholders.
6. Commit following the commit rules in `AGENTS.md`, for example
   `feat(azure): add <skill-name> skill`.
