# claude-dash

A local dashboard for [Claude Code](https://claude.com/product/claude-code) usage — sessions, tokens, cost, and full chat transcripts, live-updating as you work.

```sh
npx claude-dash
```

That's it. It starts a local server, reads Claude Code's session logs from `~/.claude` (or `$CLAUDE_CONFIG_DIR`), and opens the dashboard in your browser.

## What it shows

- **Dashboard** — total cost, tokens, API calls, cache hit rate, cost over time, model/project/tool breakdowns
- **Projects & Sessions** — every session, past and currently running, filterable and searchable
- **Live** — sessions with recent activity, updating in near real time
- **Session detail** — full chat transcript (user, assistant, thinking, tool calls, MCP, sub-agents, errors), toggle-filterable by message kind, with tool-specific views (Bash stdout/stderr, Edit diffs, Read file contents, sub-agent threads inline)
- **Search** — full-text search across every transcript
- **Cost accounting** — exact per-token cost using live LiteLLM pricing, correctly deduped across multi-block turns and forked/resumed sessions

Everything runs locally. No data leaves your machine.

## Options

```sh
npx claude-dash [options]

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
