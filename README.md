# oc-force-beads

`oc-force-beads` is a small OpenCode plugin that redirects native todo usage back to Beads.

## What it enforces

- Intercept `todoread` after execution and replace its output with Beads guidance
- Clear `output.args.todos` before `todowrite` runs
- Prepend a Beads reminder before each command the model executes
- Show the full `bd setup opencode --print` guidance the first time a session needs the full policy, then fall back to a short reminder on later commands
- Leave normal `task` execution alone
- Replace the post-execution output for `todowrite` with Beads guidance

## Session behavior

The plugin keeps one in-memory session set that is shared by the command hook and the todo-tool hooks.

- If a command hook shows the full Beads policy first, later `todoread` and `todowrite` calls in that same session return only the short reminder.
- If a blocked todo tool call is the first thing that needs guidance in a session, that call returns the short reminder plus the full `bd setup opencode --print` output.
- Session state resets when the OpenCode process restarts.

## Why this hook

This plugin uses `command.execute.before` to steer the model before each command, then uses `tool.execute.before` and `tool.execute.after` to redirect native todo calls without breaking the agent loop.

The command hook prepends the reminder to the first text part or `subtask.prompt` it finds.

The plugin loads the first full-policy message from `bd setup opencode --print`, so `bd` must be available on `PATH` where OpenCode runs.

If `bd` is missing or that command fails, the first full-policy reminder for a session fails. If a command output has no text part and no `subtask.prompt`, the plugin has nothing to prepend to for that command.

## Development

This repo includes a Linux-only `flake.nix` for a local dev shell.

If `bun` is not on your plain shell `PATH`, use the dev shell command form:

```bash
nix develop --command bun install
nix develop --command bun test
nix develop --command bun run typecheck
```

If `bun` is already available in your shell, you can run the same Bun commands directly.

## Installation

After you publish or pack the plugin, add it to your OpenCode config:

```json
{
  "plugin": ["oc-force-beads"]
}
```
