# ADR 0001: Use command-time steering plus runtime todo redirection

- Status: Accepted
- Date: 2026-03-19

## Context

The plugin must steer OpenCode away from native todo tooling and back to Beads without breaking normal execution.

The plugin should show the full Beads policy text from `bd setup opencode --print` once per session, then fall back to shorter reminders so the session does not get flooded with the same long message.

The plugin should get the Beads policy from the `bd` CLI so it stays aligned with the current Beads installation.

The plugin should not depend on a special Beads-only task agent. It should stay narrow and let the model use the live Beads instructions directly.

## Decision

Use `command.execute.before`, `tool.execute.before`, and `tool.execute.after`.

Implementation rules:

1. `command.execute.before` prepends a Beads reminder before each command the model executes.
2. On the first command in a session, that reminder includes the full `bd setup opencode --print` output inside a `<system-reminder>` block.
3. Later commands in the same session get only the short reminder plus `bd prime`.
4. `tool.execute.before` only changes `todowrite`, by clearing `output.args.todos` so it writes nothing.
5. `tool.execute.after` rewrites the post-execution output for `todoread` and `todowrite` to a Beads guidance message.
6. If an intercepted todo call is the first thing that needs guidance in a session, `tool.execute.after` returns the short reminder plus the full `bd setup opencode --print` output.
7. The command hook and the todo-tool hooks share the same in-memory session state. This means the first full-policy display in a session can happen in either path.
8. If a command has already shown the full policy for a session, later blocked todo calls in that same session return only the short reminder.
9. Leave normal `task` execution alone.
10. Cache the printed Beads policy process-wide after the first successful load.

## Consequences

- Intercepted todo tools return guidance instead of hard errors, preventing the OpenCode agent loop from aborting.
- The plugin does not depend on any custom Beads-specific agent type.
- Normal subagent execution through `task` keeps working.
- The model gets Beads guidance before each command, not only after an intercepted todo call.
- The prompt stays smaller after the first command in a session because later commands get only a short reminder.
- The first blocked todo call in a session only gets the full Beads policy if no earlier command in that session already showed it.
- The plugin depends on `bd` being present on `PATH` at runtime.
- If a command output has no text part and no `subtask.prompt`, that command gets no prepended reminder.
- Session-level reminder state and the printed policy cache live in plugin memory and reset when the OpenCode process restarts.

## Alternatives considered

## Option 1: tool-definition-only steering

This is too weak for the goal of reliably steering the model away from native todo tools. It was rejected.

## Option 2: always return the full Beads policy on every command or denial

This repeats a long message and wastes session context. It was rejected.

## Option 3: vendor `BEADS.md` inside the package

This can drift from the current Beads installation. It was rejected.
