#!/usr/bin/env node
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { createMcpServer } from './index.js';
import { createEnvironmentClient, resolveMcpConnection } from './runtime.js';
const commandName = 'rightside-mcp';

/**
 * stdio entrypoint. stdout carries MCP protocol frames only; every diagnostic
 * goes to stderr. The credential is read from RIGHTSIDE_TOKEN or the
 * mode-0600 credential file on every call and is never written to either stream.
 */
async function main(): Promise<void> {
  const env = process.env;
  const { baseUrl } = resolveMcpConnection(env);

  // Credentials are re-resolved per tool call, so a later `rightside login`
  // takes effect without restarting the MCP server.
  const client = createEnvironmentClient(env);
  const { server } = createMcpServer({ client, env, updateCheck: {} });
  await server.connect(new StdioServerTransport());
  process.stderr.write(`${commandName} ready (control plane ${baseUrl})\n`);
}

if (process.argv.length === 3 && process.argv[2] === '--check') {
  process.stdout.write(`${commandName} ok\n`);
} else {
  void main().catch((err: unknown) => {
    process.stderr.write(`${commandName} failed to start: ${err instanceof Error ? err.message : String(err)}\n`);
    process.exitCode = 1;
  });
}
