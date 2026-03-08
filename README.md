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

## Context bar

The context bar shows **usable** context, not raw token count — it accounts for Claude's autocompact buffer (~16.5% of the window), which is reserved and unavailable to you.

- **0%** = fresh session
- **100%** = autocompact imminent (context will be compressed)
- Color thresholds: **green** (<50%) → **yellow** (50-65%) → **orange** (65-80%) → **red** (>80%)

## Checking your installed version

```bash
npx claude-code-pulsify --status
```

This shows the currently installed version, hooks location, and whether an update is available.

You can also check manually:
- **VERSION file:** `~/.claude/hooks/claude-code-pulsify/VERSION`
- **Update cache:** `~/.claude/cache/claude-code-pulsify-update.json` — written on each session start, contains `installed`, `latest`, and `updateAvailable` fields

## Configuration

Respects the `CLAUDE_CONFIG_DIR` environment variable. Defaults to `~/.claude`.

## Future Enhancements

- Lines changed display (+added / -removed)
- Token usage counter
