# ADR 0001: Use command-time steering plus runtime todo blocking

- Status: Accepted
- Date: 2026-03-19

## Context

The plugin must stop OpenCode from using native todo tooling and steer it back to Beads without breaking normal execution.

The first denial in a session should return a short prefix plus the Beads policy text from `bd setup opencode --print`. Later denials in the same session should return a short reminder so the session does not get flooded with the same long message.

The plugin should get the Beads policy from the `bd` CLI so it stays aligned with the current Beads installation.

The plugin should not depend on a special Beads-only task agent. It should stay narrow and let the model use the live Beads instructions directly.

## Decision

Use the `command.execute.before` hook and override native tools using tool definitions.

Implementation rules:

1. Inject a Beads reminder before each command the model executes.
2. Include the full `bd setup opencode --print` guidance once per session, then use only a short reminder on later commands.
3. Block native `todoread` and `todowrite` by supplying custom implementations that return the reminder string directly.
4. Leave normal `task` execution alone.
5. On overridden todo calls after the full session guidance has already been shown, return only the short reminder.

## Consequences

- Blocked tools return gracefully instead of throwing hard errors, preventing the OpenCode agent loop from aborting.
- The plugin does not depend on any custom Beads-specific agent type.
- Normal subagent execution through `task` keeps working.
- The model gets Beads guidance before each command, not only after a blocked todo call.
- The prompt stays smaller after the first command in a session because later commands get only a short reminder.
- The first denial gives full recovery guidance, while later denials stay brief.
- The plugin depends on `bd` being present on `PATH` at runtime.
- Session-level reminder state lives in plugin memory and resets when the OpenCode process restarts.

## Alternatives considered

## Option 1: tool-definition-only steering

This is too weak for the goal of reliably steering the model away from native todo tools. It was rejected.

## Option 2: always return the full Beads policy on every command or denial

This repeats a long message and wastes session context. It was rejected.

## Option 3: vendor `BEADS.md` inside the package

This can drift from the current Beads installation. It was rejected.
