import { existsSync } from 'node:fs';
import { homedir, platform } from 'node:os';
import { join } from 'node:path';

import { Garu } from '@garuhq/node';

import { resolveAuthOptional } from '../lib/auth.js';
import { credentialsFileMode, credentialsPath } from '../lib/credentials.js';
import { printResult, type OutputOptions } from '../lib/output.js';
import { CLI_VERSION } from '../version.js';

export interface DoctorReport {
  cli: { version: string };
  api: { reachable: boolean; url: string; version?: string; error?: string };
  credentials: {
    path: string;
    source: 'flag' | 'env' | 'file' | 'none';
    profile?: string;
    fileMode?: string;
    warning?: string;
  };
  agents: {
    claudeCode: boolean;
    cursor: boolean;
    codex: boolean;
    windsurf: boolean;
    claudeDesktop: boolean;
    vscodeMcpInCwd: boolean;
  };
}

export interface DoctorOptions extends OutputOptions {
  apiKey?: string;
  profile?: string;
  baseUrl?: string;
  /** Injectable for tests — bypass the real HTTP call. */
  garu?: Garu;
  /** Injectable HOME, for tests. */
  home?: string;
  /** Injectable cwd, for tests. */
  cwd?: string;
  /** Injectable platform, for tests. */
  platform?: NodeJS.Platform;
}

/**
 * Run a full environment diagnostic.
 *
 * Never throws on expected failures — bad auth, unreachable API, missing
 * credentials all become structured report fields. Only genuinely unexpected
 * errors (programming bugs) bubble up.
 */
export async function doctorCommand(opts: DoctorOptions = {}): Promise<DoctorReport> {
  const home = opts.home ?? homedir();
  const cwd = opts.cwd ?? process.cwd();
  const plat = opts.platform ?? platform();

  const credentials = await reportCredentials(opts);
  const api = await reportApi(opts);
  const agents = detectAgents(home, cwd, plat);

  const report: DoctorReport = {
    cli: { version: CLI_VERSION },
    api,
    credentials,
    agents
  };

  printResult(report, { ...opts, prettyPrint: prettyDoctor });
  return report;
}

async function reportCredentials(opts: DoctorOptions): Promise<DoctorReport['credentials']> {
  const path = credentialsPath();
  const resolved = await resolveAuthOptional({
    ...(opts.apiKey !== undefined ? { apiKey: opts.apiKey } : {}),
    ...(opts.profile !== undefined ? { profile: opts.profile } : {})
  });

  if (!resolved) {
    return { path, source: 'none' };
  }

  const out: DoctorReport['credentials'] = { path, source: resolved.source };
  if (resolved.profile) out.profile = resolved.profile;

  if (resolved.source === 'file') {
    const mode = await credentialsFileMode();
    if (mode !== null) {
      out.fileMode = `0${mode.toString(8)}`;
      if (mode !== 0o600) {
        out.warning = `credentials file mode is 0${mode.toString(8)}; expected 0600`;
      }
    }
  }

  return out;
}

async function reportApi(opts: DoctorOptions): Promise<DoctorReport['api']> {
  const url = opts.baseUrl ?? 'https://garu.com.br';
  const garu =
    opts.garu ??
    new Garu({
      ...(opts.baseUrl !== undefined ? { baseUrl: opts.baseUrl } : {})
    });

  try {
    const meta = await garu.meta.get();
    return { reachable: true, url, version: meta.version };
  } catch (err) {
    return {
      reachable: false,
      url,
      error: err instanceof Error ? err.message : String(err)
    };
  }
}

function detectAgents(home: string, cwd: string, plat: NodeJS.Platform): DoctorReport['agents'] {
  return {
    claudeCode: existsSync(join(home, '.claude')),
    cursor: existsSync(join(home, '.cursor')),
    codex: existsSync(join(home, '.codex')),
    windsurf: existsSync(join(home, '.windsurf')),
    claudeDesktop: existsSync(claudeDesktopConfigPath(home, plat)),
    vscodeMcpInCwd: existsSync(join(cwd, '.vscode', 'mcp.json'))
  };
}

function claudeDesktopConfigPath(home: string, plat: NodeJS.Platform): string {
  if (plat === 'darwin') {
    return join(home, 'Library', 'Application Support', 'Claude', 'claude_desktop_config.json');
  }
  if (plat === 'win32') {
    return join(home, 'AppData', 'Roaming', 'Claude', 'claude_desktop_config.json');
  }
  return join(home, '.config', 'Claude', 'claude_desktop_config.json');
}

function prettyDoctor(r: DoctorReport): string {
  const check = (ok: boolean) => (ok ? 'yes' : 'no ');
  const lines = [
    `CLI:          garu ${r.cli.version}`,
    `API:          ${r.api.reachable ? `reachable (${r.api.url}, backend ${r.api.version ?? '?'})` : `unreachable (${r.api.url})`}`,
    r.api.error ? `              ${r.api.error}` : undefined,
    `Credentials:  source=${r.credentials.source}${r.credentials.profile ? ` profile=${r.credentials.profile}` : ''}${r.credentials.fileMode ? ` mode=${r.credentials.fileMode}` : ''}`,
    r.credentials.warning ? `              ⚠ ${r.credentials.warning}` : undefined,
    '',
    'Detected agents:',
    `  Claude Code:    ${check(r.agents.claudeCode)}`,
    `  Cursor:         ${check(r.agents.cursor)}`,
    `  Codex:          ${check(r.agents.codex)}`,
    `  Windsurf:       ${check(r.agents.windsurf)}`,
    `  Claude Desktop: ${check(r.agents.claudeDesktop)}`,
    `  VS Code MCP:    ${check(r.agents.vscodeMcpInCwd)} (.vscode/mcp.json in cwd)`
  ].filter((l): l is string => l !== undefined);
  return lines.join('\n');
}
