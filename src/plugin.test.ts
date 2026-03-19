import { expect, test } from "bun:test";

import { ForceBeadsPlugin } from "./plugin";

const SHORT_REMINDER =
  "OpenCode todo tools are disabled here. Proceed with your task by using Beads via `bd` commands instead.";
const FULL_POLICY_PREFIX = `${SHORT_REMINDER}\n\n`;
const SHORT_PROMPT_REMINDER = `<system-reminder>\n${SHORT_REMINDER} Start with \`bd prime\` if you need the workflow summary.\n</system-reminder>\n\n`;
const printedBeadsPolicyResult = Bun.spawnSync(["bd", "setup", "opencode", "--print"]);

if (!printedBeadsPolicyResult.success) {
  const stderr = printedBeadsPolicyResult.stderr.toString().trim();
  const failureReason = stderr || `exit code ${printedBeadsPolicyResult.exitCode}`;

  throw new Error(
    `Failed to load expected Beads policy with \`bd setup opencode --print\`: ${failureReason}`,
  );
}

const fullBeadsPolicy = printedBeadsPolicyResult.stdout.toString();
const prefixedBeadsPolicy = `${FULL_POLICY_PREFIX}${fullBeadsPolicy}`;
const fullPromptReminder = `<system-reminder>\n${SHORT_REMINDER}\n\n${fullBeadsPolicy}\n</system-reminder>\n\n`;

const pluginInput = {
  client: {} as never,
  project: {} as never,
  directory: "/tmp",
  worktree: "/tmp",
  serverUrl: new URL("https://example.com"),
  $: {} as never,
};

async function runCommandBeforeHook(input: {
  sessionID: string;
  text: string;
}): Promise<string> {
  const hooks = await ForceBeadsPlugin(pluginInput);
  const commandHook = hooks["command.execute.before"];

  if (!commandHook) {
    throw new Error("Missing command.execute.before hook");
  }

  const output = {
    parts: [
      {
        id: `${input.sessionID}-part`,
        sessionID: input.sessionID,
        messageID: `${input.sessionID}-message`,
        type: "text" as const,
        text: input.text,
      },
    ],
  };

  await commandHook(
    {
      command: "user",
      sessionID: input.sessionID,
      arguments: "",
    },
    output,
  );

  const part = output.parts[0];

  if (!part || part.type !== "text") {
    throw new Error("Missing command text part");
  }

  return part.text;
}

test("first blocked todo call intercepts output and neuters args", async () => {
  const hooks = await ForceBeadsPlugin(pluginInput);
  
  const beforeHook = hooks["tool.execute.before"];
  const afterHook = hooks["tool.execute.after"];
  const defHook = hooks["tool.definition"];
  
  if (!beforeHook || !afterHook || !defHook) {
    throw new Error("Missing required hooks");
  }

  const beforeOutput = { args: { todos: ["hello"] } };
  await beforeHook({ tool: "todowrite", sessionID: "smoke-full-policy", callID: "1" }, beforeOutput);
  expect(beforeOutput.args.todos).toEqual([]);

  const afterOutput = { title: "title", output: "success", metadata: {} };
  await afterHook({ tool: "todowrite", sessionID: "smoke-full-policy", callID: "1", args: {} }, afterOutput);
  expect(afterOutput.output).toBe(prefixedBeadsPolicy);
  
  const defOutput = { description: "orig", parameters: {} };
  await defHook({ toolID: "todowrite" }, defOutput);
  expect(defOutput.description).toContain("DO NOT USE");
});

test("later blocked calls in the same session return the short reminder", async () => {
  const hooks = await ForceBeadsPlugin(pluginInput);
  const afterHook = hooks["tool.execute.after"]!;
  
  const sessionID = "smoke-short-reminder";

  const firstOutput = { title: "title", output: "success", metadata: {} };
  await afterHook({ tool: "todowrite", sessionID, callID: "1", args: {} }, firstOutput);
  
  const secondOutput = { title: "title", output: "success", metadata: {} };
  await afterHook({ tool: "todoread", sessionID, callID: "2", args: {} }, secondOutput);

  expect(firstOutput.output).toBe(prefixedBeadsPolicy);
  expect(secondOutput.output).toBe(SHORT_REMINDER);
});

test("task calls are not blocked", async () => {
  const hooks = await ForceBeadsPlugin(pluginInput);
  const afterHook = hooks["tool.execute.after"]!;
  
  const output = { title: "title", output: "success", metadata: {} };
  await afterHook({ tool: "task", sessionID: "task-session", callID: "1", args: {} }, output);
  
  // Ensure it didn't overwrite the output
  expect(output.output).toBe("success");
});

test("first command in a session gets the full Beads reminder", async () => {
  const text = await runCommandBeforeHook({
    sessionID: "smoke-command-full",
    text: "List files in .",
  });

  expect(text).toBe(`${fullPromptReminder}List files in .`);
});

test("later commands in the same session get the short reminder only", async () => {
  const sessionID = "smoke-command-short";

  await runCommandBeforeHook({
    sessionID,
    text: "First command",
  });
  const text = await runCommandBeforeHook({
    sessionID,
    text: "Second command",
  });

  expect(text).toBe(`${SHORT_PROMPT_REMINDER}Second command`);
});
