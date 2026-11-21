import { readFileSync } from 'node:fs';
import { clientVersionReport } from '@rightsidehost/client';

export const MCP_SERVER_VERSION = '0.1.3';

/** Same authenticated release stamp and report shape as the CLI. */
export function installedMcpVersion() {
  let pkg: unknown;
  try {
    pkg = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8'));
  } catch {
    pkg = undefined;
  }
  return clientVersionReport(pkg, MCP_SERVER_VERSION);
}
