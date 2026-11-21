# RightSide MCP Server (`@rightsidehost/mcp`)

Official Model Context Protocol (MCP) stdio server implementation for **[RightSide](https://rightside.host/)** — an agent-native container hosting platform where Claude Code, Codex, and other MCP clients build, deploy, diagnose, manage env vars and opt-in PostgreSQL, configure custom domains, and roll back containerized apps to a verified HTTPS URL.

This repository contains the complete TypeScript source code for the `@rightsidehost/mcp` server (20 MCP tools built on `@modelcontextprotocol/sdk`) along with its multi-stage `Dockerfile` for reproducible local and containerized execution.

## Repository Structure

| Path | Role |
| --- | --- |
| [`src/index.ts`](src/index.ts) | MCP server implementation using `@modelcontextprotocol/sdk` (`McpServer` + `zod` schemas) registering all 20 RightSide tools |
| [`src/bin.ts`](src/bin.ts) | Stdio CLI entrypoint connecting the MCP server over `StdioServerTransport` |
| [`src/runtime.ts`](src/runtime.ts) | Runtime client wiring, credential loading (`RIGHTSIDE_TOKEN` or stored login), and structured error formatting |
| [`src/version.ts`](src/version.ts) | Server version metadata |
| [`Dockerfile`](Dockerfile) | Multi-stage non-root (`USER 10001:10001`) container build running `node /app/dist/bin.js` |
| [`server.json`](server.json) | Official MCP Registry manifest (`host.rightside/mcp`) |
| [`glama.json`](glama.json) | Glama MCP directory metadata |

## Implemented MCP Tools (20)

All 20 tools are defined and registered directly in [`src/index.ts`](src/index.ts):

### Deploy & Lifecycle
- `create_project` — Create a new RightSide project with optional outbound internet egress (`egress: "internet"`)
- `deploy_project` — Package, build, health-check, and promote a container release to `https://<slug>.rightside.cloud`
- `project_status` — Inspect live release state, health, URL, and metadata for a project
- `list_projects` — List projects in the authenticated account
- `rollback` — Roll back a project to a previous healthy release
- `clear_build_cache` — Clear cached container build layers for a project
- `delete_project` — Permanently delete a project and its resources

### Diagnostics & Verification
- `get_logs` — Retrieve bounded, secret-redacted build or runtime logs with structured error codes
- `login_status` — Verify authentication state and active account context
- `send_feedback` — Submit structured issue reports or feedback

### Opt-in PostgreSQL
- `configure_database` — Enable or inspect per-project managed PostgreSQL (injecting `DATABASE_URL`)
- `query_database` — Run bounded SQL queries against a project's PostgreSQL database

### Secrets & Environment Variables
- `list_env` — List configured environment variable names (values redacted)
- `set_env` — Set an environment variable for a project
- `import_env` — Import variables from a local `.env` file on disk without echoing secret values into chat
- `unset_env` — Remove an environment variable

### Custom Domains
- `add_domain` — Attach a custom domain and return DNS verification records
- `domain_status` — Check DNS propagation and automatic TLS certificate status
- `list_domains` — List custom domains attached to a project
- `remove_domain` — Detach a custom domain from a project

## Build & Run from Source

Requires Node.js `>=22.13`.

```bash
git clone https://github.com/Poligon-Tech/rightside-mcp.git
cd rightside-mcp
npm install
npm run build
node dist/bin.js
```

The server speaks MCP JSON-RPC over `stdio`. Listing tools (`initialize` + `tools/list`) works immediately with no credentials configured; calling deployment tools requires authentication via `RIGHTSIDE_TOKEN` or a stored login from `rightside login`.

## Run with Docker

```bash
docker build -t rightside-mcp .
docker run -i --rm -e RIGHTSIDE_TOKEN="your-token" rightside-mcp
```

## MCP Client Configuration

### Running from a local build

```json
{
  "mcpServers": {
    "rightside": {
      "command": "node",
      "args": ["/path/to/rightside-mcp/dist/bin.js"],
      "env": {
        "RIGHTSIDE_TOKEN": "your-token-optional-if-logged-in"
      }
    }
  }
}
```

### Running via npm (`npx`)

```json
{
  "mcpServers": {
    "rightside": {
      "command": "npx",
      "args": ["-y", "@rightsidehost/mcp"]
    }
  }
}
```

### Environment Variables

| Variable | Required | Description |
| --- | --- | --- |
| `RIGHTSIDE_TOKEN` | No | Account API token. Optional if you authenticated via `rightside login`. |
| `RIGHTSIDE_OPERATIONS_URL` | No | Override the RightSide API origin (defaults to the hosted service). |

## Related

- Website: https://rightside.host
- Documentation: https://rightside.host/docs/
- Official MCP Registry: `host.rightside/mcp`
- npm package: https://www.npmjs.com/package/@rightsidehost/mcp
- Agent skills & Claude Code plugin marketplace: https://github.com/Poligon-Tech/rightside-skills

## License

See [LICENSE](LICENSE).
