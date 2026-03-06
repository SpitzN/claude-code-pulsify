# claude-code-pulsify

Context-aware statusline and context monitor for [Claude Code](https://docs.anthropic.com/en/docs/claude-code).

Shows a live progress bar of context window usage, active task info, and warns you when context is running low.

## Install

```bash
npx claude-code-pulsify@latest
```

This copies hooks to `~/.claude/hooks/claude-code-pulsify/` and patches `~/.claude/settings.json`. Restart Claude Code to activate.

## Update

Run the same command:

```bash
npx claude-code-pulsify@latest
```

The statusline also shows an arrow indicator when an update is available.

## Uninstall

```bash
npx claude-code-pulsify@latest --uninstall
```

## What it does

- **Statusline** -- Shows model name, working directory, context usage bar (color-coded), and active task
- **Context monitor** -- Warns at 65% and 75% context usage via PostToolUse hook
- **Update checker** -- Background version check on session start, non-blocking

## Configuration

Respects the `CLAUDE_CONFIG_DIR` environment variable. Defaults to `~/.claude`.
