import { type Plugin } from "@opencode-ai/plugin";

const SHORT_REMINDER =
  "OpenCode todo tools are disabled here. You MUST immediately use the `bd` command via the bash tool to recreate your intended task tracking in Beads. Do not skip this step or ask for permission. Just do it.";
const FULL_POLICY_PREFIX = `${SHORT_REMINDER}\n\n`;
const SHORT_PROMPT_REMINDER = `<system-reminder>\n${SHORT_REMINDER} Start with \`bd prime\` if you need the workflow summary.\n</system-reminder>\n\n`;
const PRINT_BEADS_COMMAND = ["bd", "setup", "opencode", "--print"] as const;
const BLOCKED_TOOLS = new Set(["todoread", "todowrite"]);
const sessionsShownFullPolicy = new Set<string>();

let printedBeadsPolicy: string | undefined;

function getFullPromptReminder(): string {
  return `<system-reminder>\n${SHORT_REMINDER}\n\n${getPrintedBeadsPolicy()}\n</system-reminder>\n\n`;
}

function prependReminderToParts(
  parts: Array<{
    type: string;
    text?: string;
    prompt?: string;
  }>,
  reminder: string,
): void {
  for (const part of parts) {
    if (part.type === "text" && typeof part.text === "string") {
      part.text = `${reminder}${part.text}`;
      return;
    }

    if (part.type === "subtask" && typeof part.prompt === "string") {
      part.prompt = `${reminder}${part.prompt}`;
      return;
    }
  }
}

function getPrintedBeadsPolicy(): string {
  if (printedBeadsPolicy !== undefined) {
    return printedBeadsPolicy;
  }

  const bdPath = Bun.which(PRINT_BEADS_COMMAND[0]);

  if (!bdPath) {
    throw new Error("Cannot load the Beads policy because `bd` is not on PATH.");
  }

  const result = Bun.spawnSync({
    cmd: [bdPath, ...PRINT_BEADS_COMMAND.slice(1)],
  });

  if (!result.success) {
    const stderr = result.stderr.toString().trim();
    const failureReason = stderr || `exit code ${result.exitCode}`;

    throw new Error(
      `Failed to load the Beads policy with \`bd setup opencode --print\`: ${failureReason}`,
    );
  }

  printedBeadsPolicy = result.stdout.toString();
  return printedBeadsPolicy;
}

async function getViolationMessage(sessionID: string): Promise<string> {
  if (sessionsShownFullPolicy.has(sessionID)) {
    return SHORT_REMINDER;
  }

  const fullPolicy = getPrintedBeadsPolicy();
  sessionsShownFullPolicy.add(sessionID);
  return `${FULL_POLICY_PREFIX}${fullPolicy}`;
}

export const ForceBeadsPlugin: Plugin = async () => {
  return {
    "command.execute.before": async (input, output) => {
      const reminder = sessionsShownFullPolicy.has(input.sessionID)
        ? SHORT_PROMPT_REMINDER
        : getFullPromptReminder();

      if (!sessionsShownFullPolicy.has(input.sessionID)) {
        sessionsShownFullPolicy.add(input.sessionID);
      }

      prependReminderToParts(output.parts, reminder);
    },
    
    "tool.execute.before": async (input, output) => {
      if (input.tool === "todowrite") {
         // Neuter the todos array so it writes nothing and renders cleanly
         output.args.todos = [];
      }
    },

    "tool.execute.after": async (input, output) => {
      if (BLOCKED_TOOLS.has(input.tool)) {
        // Rewrite the output that goes to the LLM
        output.output = await getViolationMessage(input.sessionID);
      }
    },
    
    "tool.definition": async (input, output) => {
      if (BLOCKED_TOOLS.has(input.toolID)) {
        // Warn the LLM before it even tries
        output.description = "DO NOT USE. This tool is disabled. Use 'bd' via bash instead.";
      }
    }
  };
};
