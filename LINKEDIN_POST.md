I use Claude Code every day and had no idea what any single session actually cost until the monthly total showed up.

So I looked at where Claude Code already keeps the answer — full session logs sitting locally in ~/.claude — and built a dashboard that reads them directly instead of asking a service to tell me.

That became Claude Dash: a local dashboard for Claude Code cost, tokens, and session history, plus a full replay of every transcript.

🧮 Live cost & token dashboard, broken down by model, project, and tool — exact dollar cost on API billing, an estimated API-equivalent on a Pro/Max session plan, deduped across multi-block turns and forked/resumed sessions

📼 Full session replay — every message kind, thinking included, with tool-specific views for Bash output, Edit diffs, and sub-agent threads

🔍 Full-text search across every transcript you've ever run

🔗 Secure sharing for when I do want a second pair of eyes — a Cloudflare tunnel and an access code, scoped to the whole dashboard or just one session

The part I spent the most time on wasn't the charts, it was making sure nothing leaves your machine by default — the whole thing runs locally against logs Claude Code already wrote.

npx @darshanpatel2608/claude-dash@latest — opens straight in your browser.

npm: https://www.npmjs.com/package/@darshanpatel2608/claude-dash

#ClaudeCode #BuildInPublic #DeveloperTools #TypeScript
