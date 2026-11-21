import {
  CredentialStore,
  LOCALHOST_CONTROL_PLANE_URL,
  RightSideClient,
  RightSideError,
  defaultControlPlaneUrl,
  defaultCredentialPath,
  normalizeControlPlaneOrigin
} from '@rightsidehost/client';
import type { RightSideApi } from './index.js';

export interface McpConnection {
  credentialFile: string;
  token: string | undefined;
  tokenSource: 'env' | 'file' | 'none';
  baseUrl: string;
  issue?: string;
  recovery?: string;
}

function nonBlank(value: string | undefined): string | undefined {
  return value !== undefined && value.trim().length > 0 ? value : undefined;
}

function originFailure(credentialFile: string, error: unknown): McpConnection {
  const message = error instanceof Error ? error.message : 'The MCP operations origin is invalid.';
  return {
    credentialFile,
    token: undefined,
    tokenSource: 'none',
    baseUrl: LOCALHOST_CONTROL_PLANE_URL,
    issue: message
  };
}

/** Resolve token and audience together so a file-backed bearer cannot be redirected. */
export function resolveMcpConnection(env: NodeJS.ProcessEnv): McpConnection {
  const credentialFile = nonBlank(env['RIGHTSIDE_CONFIG']) ?? defaultCredentialPath(env);
  let stored: ReturnType<CredentialStore['load']> = null;
  let credentialIssue: string | undefined;
  let credentialRecovery: string | undefined;
  try {
    stored = new CredentialStore(credentialFile).load();
  } catch (error) {
    credentialIssue = error instanceof Error ? error.message : 'The credential file is unreadable.';
    credentialRecovery =
      error instanceof RightSideError
        ? error.suggestedFix
        : 'Run `rightside logout`, then `rightside login` to replace the credential file.';
  }
  const envToken = nonBlank(env['RIGHTSIDE_TOKEN']);
  const explicitOperations = nonBlank(env['RIGHTSIDE_OPERATIONS_URL']);

  if (envToken) {
    try {
      return {
        credentialFile,
        token: envToken,
        tokenSource: 'env',
        baseUrl: normalizeControlPlaneOrigin(
          explicitOperations ?? LOCALHOST_CONTROL_PLANE_URL,
          'RIGHTSIDE_OPERATIONS_URL'
        )
      };
    } catch (error) {
      return originFailure(credentialFile, error);
    }
  }

  if (stored) {
    const storedOrigin = normalizeControlPlaneOrigin(stored.baseUrl, 'The stored MCP operations origin');
    if (
      storedOrigin === 'https://ops.apps.poligontech.ro' ||
      stored.authorizationBaseUrl === 'https://api.apps.poligontech.ro'
    ) {
      return {
        credentialFile,
        token: undefined,
        tokenSource: 'none',
        baseUrl: LOCALHOST_CONTROL_PLANE_URL,
        issue: 'Stored RightSide credentials use a retired beta origin.',
        recovery: 'Run `rightside login --url https://api.rightside.host`, then reinstall optional MCP integrations.'
      };
    }
    if (explicitOperations) {
      let explicitOrigin: string;
      try {
        explicitOrigin = normalizeControlPlaneOrigin(explicitOperations, 'RIGHTSIDE_OPERATIONS_URL');
      } catch (error) {
        return originFailure(credentialFile, error);
      }
      if (explicitOrigin !== storedOrigin) {
        return {
          credentialFile,
          token: undefined,
          tokenSource: 'none',
          baseUrl: explicitOrigin,
          issue:
            'Stored credentials target a different operations origin. Run `rightside install claude` or `rightside install codex` to reconcile that client registration.'
        };
      }
    }
    return { credentialFile, token: stored.accessToken, tokenSource: 'file', baseUrl: storedOrigin };
  }

  try {
    return {
      credentialFile,
      token: undefined,
      tokenSource: 'none',
      baseUrl: normalizeControlPlaneOrigin(
        explicitOperations ?? defaultControlPlaneUrl(env),
        'RIGHTSIDE_OPERATIONS_URL'
      ),
      ...(credentialIssue ? { issue: credentialIssue, ...(credentialRecovery ? { recovery: credentialRecovery } : {}) } : {})
    };
  } catch (error) {
    return originFailure(credentialFile, error);
  }
}

/**
 * A RightSideApi that resolves the token and audience on every call (a cheap
 * file read), exactly as login_status does. A long-lived MCP server therefore
 * picks up `rightside login` / `rightside logout` without a restart.
 */
export function createEnvironmentClient(env: NodeJS.ProcessEnv, fetchImpl?: typeof fetch): RightSideApi {
  const current = (): RightSideClient => {
    const { token, baseUrl } = resolveMcpConnection(env);
    return new RightSideClient({ baseUrl, ...(token ? { token } : {}), ...(fetchImpl ? { fetchImpl } : {}) });
  };
  return {
    health: () => {
      const connection = resolveMcpConnection(env);
      if (connection.issue) throw new RightSideError('CONFIG_ERROR', 'MCP connection needs configuration.');
      const stored = connection.tokenSource === 'file' ? new CredentialStore(connection.credentialFile).load() : null;
      const baseUrl = normalizeControlPlaneOrigin(nonBlank(env['RIGHTSIDE_URL']) ?? stored?.authorizationBaseUrl ?? connection.baseUrl);
      // Health is anonymous; never forward the operations bearer to this origin.
      return new RightSideClient({ baseUrl, ...(fetchImpl ? { fetchImpl } : {}) }).health();
    },
    whoami: () => current().whoami(),
    listProjects: () => current().listProjects(),
    getProject: (projectId) => current().getProject(projectId),
    createProject: (input, options) => current().createProject(input, options),
    deployDirectory: (projectId, directory, options) => current().deployDirectory(projectId, directory, options),
    logs: (projectId, options) => current().logs(projectId, options),
    rollback: (projectId, options) => current().rollback(projectId, options),
    status: (projectId) => current().status(projectId),
    clearBuildCache: (projectId) => current().clearBuildCache(projectId),
    deleteProject: (projectId, confirmSlug) => current().deleteProject(projectId, confirmSlug),
    deleteDatabase: (projectId, confirmSlug) => current().deleteDatabase(projectId, confirmSlug),
    databaseUsage: (projectId) => current().databaseUsage(projectId),
    queryDatabase: (projectId, input) => current().queryDatabase(projectId, input),
    enableDatabase: (projectId) => current().enableDatabase(projectId),
    listEnv: (projectId) => current().listEnv(projectId),
    updateEnv: (projectId, input, options) => current().updateEnv(projectId, input, options),
    sendFeedback: (input) => current().sendFeedback(input),
    addDomain: (projectId, hostname, options) => current().addDomain(projectId, hostname, options),
    domainStatus: (hostname, options) => current().domainStatus(hostname, options),
    listDomains: (options) => current().listDomains(options),
    removeDomain: (hostname, confirm) => current().removeDomain(hostname, confirm)
  };
}
