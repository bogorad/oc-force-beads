# oc-force-beads

`oc-force-beads` is a small OpenCode plugin that blocks native todo tooling and steers agents back to Beads.

## What it enforces

- Block `todoread`
- Block `todowrite`
- Inject a Beads reminder before each command the model executes
- Include the full `bd setup opencode --print` guidance once per session, then fall back to a short reminder on later commands
- Leave normal `task` execution alone
- Return a short prefix plus the output of `bd setup opencode --print` on the first blocked call in a session
- Return a short reminder on later blocked calls in the same session

## Why this hook

This plugin uses `command.execute.before` to steer the model before each command, and `tool.execute.before` to keep a hard doorstop on blocked todo calls at runtime.

The plugin loads the first denial message from `bd setup opencode --print`, so `bd` must be available on `PATH` where OpenCode runs.

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
