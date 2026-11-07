# claude-plan-status

[Polski](README.md) | **English**

A Claude Code mod that shows your Claude plan (Pro/Max) rate-limit usage, the current model and the thinking effort in the status line:

![Status line with model, thinking effort and 5-hour and weekly limit usage](docs/statusline.png)

- refreshes every 60 s and after every model response,
- colored percentages: green < 70%, yellow ≥ 70%, red ≥ 90%,
- `/plan-usage` opens a pane with usage bars.

Each user sees **only their own** usage: the figures come from the API responses in their own session. The mod sends nothing anywhere.

> The status line labels are in Polish: `Tydzień` = week, `reset za 3h 51m` = resets in 3h 51m.

## Installation

In a Claude Code terminal session:

```
/plugin install plan-usage --marketplace KR3C1K/claude-plan-status
```

Answer `y` to "Add marketplace?", then pick a scope (Enter = user).

From a shell:

```
claude plugin install plan-usage --marketplace KR3C1K/claude-plan-status
```

In the desktop app: click + next to the prompt box → Plugins → Add marketplace `KR3C1K/claude-plan-status` → Add plugin.

## Status line (one-time setup)

The mod writes the finished line to `~/.claude/plan-usage/<session_id>.txt` (one file per session). To show it in Claude Code's native status line, add this to `~/.claude/settings.json`:

```json
"statusLine": {
  "type": "command",
  "command": "f=~/.claude/plan-usage/$(sed -n 's/.*\"session_id\" *: *\"\\([^\"]*\\)\".*/\\1/p' | head -1).txt; cat \"$f\" 2>/dev/null"
}
```

and restart `claude`.

## Notes

- Limits are known only after the first API response in a session; until then the line shows `limity: brak odczytu` (no reading yet).
- Limits appear only on subscription accounts (Pro/Max), not with an API key.
- Thinking effort is the main session's (not subagents') and is not shown for models that don't support it.

## License

MIT
