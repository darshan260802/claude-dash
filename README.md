# Claude Dash

[![npm version](https://img.shields.io/npm/v/@darshanpatel2608/claude-dash.svg)](https://www.npmjs.com/package/@darshanpatel2608/claude-dash)
[![license](https://img.shields.io/npm/l/@darshanpatel2608/claude-dash.svg)](https://github.com/darshan260802/claude-dash/blob/master/LICENSE)
[![node](https://img.shields.io/node/v/@darshanpatel2608/claude-dash.svg)](package.json)

Ever wonder how much your [Claude Code](https://claude.com/product/claude-code) sessions are actually costing you, or want to revisit a past chat transcript in full? Claude Dash is a local dashboard that turns Claude Code's own session logs into live cost, token, and usage analytics — plus a full, searchable replay of every chat.

Requires that you already use the Claude Code CLI — Claude Dash reads its local session logs (`~/.claude` by default) and doesn't collect or send any data anywhere.

## Quick start

```sh
npx @darshanpatel2608/claude-dash@latest
```

That's it — it starts a local server and opens the dashboard in your browser.

![Claude Dash dashboard](https://raw.githubusercontent.com/darshan260802/claude-dash/development/docs/dashboard.png)

## Installation

The `npx` command above works with no install. If you'd rather have it as a standing command, install it globally and run it as `claude-dash`:

```sh
npm i -g @darshanpatel2608/claude-dash@latest
claude-dash
```

Either way, it starts a local server, reads Claude Code's session logs from `~/.claude` (or `$CLAUDE_CONFIG_DIR`), and opens the dashboard in your browser.

## What it shows

- **Dashboard** — total cost, tokens, API calls, cache hit rate, cost over time, model/project/tool breakdowns
- **Projects & Sessions** — every session, past and currently running, filterable and searchable
- **Live** — sessions with recent activity, updating in near real time
- **Session detail** — full chat transcript (user, assistant, thinking, tool calls, MCP, sub-agents, errors), toggle-filterable by message kind, with tool-specific views (Bash stdout/stderr, Edit diffs, Read file contents, sub-agent threads inline)
- **Search** — full-text search across every transcript
- **Cost accounting** — exact per-token cost using live LiteLLM pricing, correctly deduped across multi-block turns and forked/resumed sessions
- **Settings** — see which log directories are indexed, index stats, and manually refresh pricing data

Everything runs locally. No data leaves your machine.

## Options

```sh
claude-dash [options]

  --port <n>            Port to listen on (default 4317)
  --host <s>            Host to bind (default 127.0.0.1)
  --claude-dir <path>   Override ~/.claude location (repeatable)
  --no-open              Don't open the browser automatically
  --poll                  Use polling for file watching (WSL/NFS/Docker)
  --json                  Print an index summary as JSON and exit
  -h, --help
  -v, --version
```

## Requirements

Node.js `>=20.19.0`.

## Development

```sh
bun install
bun run dev      # Vite (5173) + API server (4317) with hot reload
bun run build    # typecheck, build web + server
bun run test     # run unit tests
```
