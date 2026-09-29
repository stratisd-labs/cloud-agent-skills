// Tests for the azure plugin's PreToolUse guard. Run with `pnpm test`.

import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";

import { evaluate } from "../azure/hooks/az-guard.mjs";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const guard = join(root, "azure/hooks/az-guard.mjs");
const skill = readFileSync(
  join(root, "azure/skills/azure-propose-only/SKILL.md"),
  "utf8"
);

const allowed = [
  // Plain reads
  "az group list",
  'az resource list --resource-group <RG> --query "[?tags.owner == null]"',
  "az account show --query '{sub: id, user: user.name}'",
  "az lock list --resource-group <RG>",
  "az vm get-instance-view -g <RG> -n <VM>",
  "az keyvault list-deleted --resource-type vault",
  "az storage account check-name --name <NAME>",
  "az group exists --name <RG>",
  "az graph query -q 'Resources | take 5'",
  "az keyvault secret list --vault-name <KV>",
  // Previews, help and local commands
  "az deployment group what-if -g <RG> --template-file main.bicep",
  "az group delete --help",
  "az --version",
  "az version",
  "az bicep build --file main.bicep",
  // az rest reads
  "az rest --url https://management.azure.com/subscriptions?api-version=1",
  "az rest --method get --url <URL>",
  "az rest -m head --url <URL>",
  // Shell structure around reads
  "az group list | jq '.[].name'",
  "az group list > groups.json 2>&1",
  'RG=<RG>; az group show -n "$RG"',
  'echo "$(az account show --query id -o tsv)"',
  "bash -c 'az group list'",
  "sudo -u <USER> az group list",
  // Text that only mentions az
  'git commit -m "docs: plan az group delete for the human"',
  'grep -rn "az resource tag" azure/',
  "echo 'az group delete is irreversible'",
  // Other tools
  "azd show",
  "terraform plan -out=tfplan",
  "terraform -chdir=infra validate",
  "terraform state list",
  "pwsh -c 'Get-AzResourceGroup'",
  "pwsh -c 'Get-AzKeyVault -VaultName <KV>'",
  // Not Azure at all
  "ls -la",
  "pnpm test",
  "npx prettier --check ."
];

const denied = [
  // Changes
  "az group delete --name <RG> --yes",
  "az resource tag --ids <ID> --tags a=b",
  "az webapp deployment slot swap -g <RG> -n <APP> --slot preprod",
  "az deployment group create -g <RG> --template-file main.bicep",
  "az stack-whatif group create --name <N> -g <RG> --stack-id <ID>",
  "az vm run-command invoke -g <RG> -n <VM> --command-id RunShellScript",
  "az account set --subscription <SUB>",
  "az login",
  "az keyvault purge --name <KV>",
  // Secrets
  "az storage account keys list -g <RG> -n <ST>",
  "az keyvault secret show --vault-name <KV> --name <S>",
  "az functionapp keys list -g <RG> -n <APP>",
  "az webapp deployment list-publishing-profiles -g <RG> -n <APP>",
  "az webapp config appsettings list -g <RG> -n <APP>",
  "az cosmosdb list-connection-strings -g <RG> -n <DB>",
  "az aks get-credentials -g <RG> -n <AKS>",
  "az account get-access-token",
  // az rest
  "az rest --method post --url <URL>/listKeys",
  "az rest --method=put --url <URL> --body '{}'",
  "az rest --url https://<KV>.vault.azure.net/secrets/<S>",
  // Hidden in shell structure
  "az group list && az group delete -n <RG>",
  'echo "$(az group delete -n <RG> --yes)"',
  "echo `az group delete -n <RG>`",
  'bash -c "az group delete -n <RG>"',
  "sh -c 'echo hi; az group delete -n <RG>'",
  "eval az group delete -n <RG>",
  "cat ids.txt | xargs -I {} az resource delete --ids {}",
  "find . -name '*.json' -exec az deployment group create -f {} \\;",
  "timeout 60 az group delete -n <RG>",
  "FOO=1 az group delete -n <RG>",
  "if true; then az group delete -n <RG>; fi",
  "cat <<EOF | bash\naz group delete -n <RG>\nEOF",
  // Commands the guard can't read
  "python -c \"import os; os.system('az group delete -n x')\"",
  "ssh <HOST> az group delete -n <RG>",
  "az --subscription <SUB> group delete -n <RG>",
  // Other tools
  "azd up",
  "azd env get-values",
  "terraform apply tfplan",
  "terraform destroy",
  "terraform state rm azurerm_resource_group.main",
  "terraform show -json",
  "tofu apply",
  "pwsh -c 'Remove-AzResourceGroup -Name <RG> -Force'",
  "pwsh -c 'Get-AzStorageAccountKey -ResourceGroupName <RG> -Name <ST>'",
  'powershell -Command "New-AzResourceGroup -Name <RG>"'
];

for (const command of allowed) {
  test(`allows: ${command}`, () => {
    assert.equal(evaluate(command).decision, "allow");
  });
}

for (const command of denied) {
  test(`denies: ${command}`, () => {
    const verdict = evaluate(command);
    assert.equal(verdict.decision, "deny");
    assert.match(verdict.reason, /azure-propose-only/);
  });
}

// The skill and the hook must agree: every az command the skill's "What
// counts as read-only" section names gets the verdict the section gives it.
function section(text, start, end) {
  const from = text.indexOf(start);
  assert.notEqual(from, -1, `missing in SKILL.md: ${start}`);
  const to = text.indexOf(end, from);
  assert.notEqual(to, -1, `missing in SKILL.md: ${end}`);
  return text.slice(from, to);
}

const codeSpans = (text) =>
  [...text.matchAll(/`([^`]+)`/g)].map(([, span]) => span);

const concrete = (span) =>
  span.replace(/<scope>/g, "group").replace(/\.\.\./g, "group");

test("skill: every command it calls safe is allowed", () => {
  const safe = section(skill, "Safe to run:", "Never run these");
  for (const span of codeSpans(safe)) {
    if (span.startsWith("-")) continue;
    const command = span.startsWith("az ")
      ? concrete(span)
      : `az resource ${span}`;
    assert.equal(evaluate(command).decision, "allow", command);
  }
});

test("skill: every command it says never to run is denied", () => {
  const never = section(skill, "Never run these", "Any other command");
  const commands = codeSpans(never).filter((s) => s.startsWith("az "));
  assert.ok(commands.length > 0, "no az commands found in the section");
  for (const span of commands) {
    const command = concrete(span);
    assert.equal(evaluate(command).decision, "deny", command);
  }
});

test("skill: every verb it lists as changing state is denied", () => {
  const verbs = section(skill, "Any other command", "## IaC-managed");
  for (const verb of codeSpans(verbs)) {
    const command = `az resource ${verb}`;
    assert.equal(evaluate(command).decision, "deny", command);
  }
});

// End to end, through stdin and stdout as Claude Code runs it.
function run(input) {
  const result = spawnSync(process.execPath, [guard], {
    input: typeof input === "string" ? input : JSON.stringify(input)
  });
  assert.equal(result.status, 0, result.stderr.toString());
  return result.stdout.toString();
}

test("hook: denies with a PreToolUse decision", () => {
  const out = JSON.parse(
    run({ tool_name: "Bash", tool_input: { command: "az group delete" } })
  );
  assert.equal(out.hookSpecificOutput.hookEventName, "PreToolUse");
  assert.equal(out.hookSpecificOutput.permissionDecision, "deny");
});

test("hook: prints nothing for a read, so normal permissions apply", () => {
  const out = run({
    tool_name: "Bash",
    tool_input: { command: "az group list" }
  });
  assert.equal(out, "");
});

test("hook: ignores tools other than Bash", () => {
  const out = run({ tool_name: "Read", tool_input: { file_path: "az" } });
  assert.equal(out, "");
});

test("hook: fails closed on bad input that mentions az", () => {
  const out = JSON.parse(run("not json: az group delete"));
  assert.equal(out.hookSpecificOutput.permissionDecision, "deny");
});

test("hook: stays out of the way on bad input that doesn't", () => {
  assert.equal(run("not json"), "");
});
