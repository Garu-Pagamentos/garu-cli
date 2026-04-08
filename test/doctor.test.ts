import { mkdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { doctorCommand } from '../src/commands/doctor.js';

let tmpHome: string;
let tmpCwd: string;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let stdoutSpy: any;

const fakeGaruOK = {
  meta: {
    async get() {
      return { version: '1.3.2' };
    }
  }
};

const fakeGaruDown = {
  meta: {
    async get(): Promise<never> {
      throw new Error('ECONNREFUSED');
    }
  }
};

beforeEach(async () => {
  tmpHome = join(
    tmpdir(),
    `garu-cli-doctor-home-${Date.now()}-${Math.random().toString(36).slice(2)}`
  );
  tmpCwd = join(
    tmpdir(),
    `garu-cli-doctor-cwd-${Date.now()}-${Math.random().toString(36).slice(2)}`
  );
  await mkdir(tmpHome, { recursive: true });
  await mkdir(tmpCwd, { recursive: true });
  stdoutSpy = vi.spyOn(process.stdout, 'write').mockImplementation(() => true);
});

afterEach(async () => {
  stdoutSpy.mockRestore();
  await rm(tmpHome, { recursive: true, force: true });
  await rm(tmpCwd, { recursive: true, force: true });
});

describe('doctorCommand', () => {
  it('reports api.reachable=true when the mocked SDK succeeds', async () => {
    const report = await doctorCommand({
      mode: 'json',
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      garu: fakeGaruOK as any,
      home: tmpHome,
      cwd: tmpCwd,
      platform: 'linux'
    });
    expect(report.api.reachable).toBe(true);
    expect(report.api.version).toBe('1.3.2');
  });

  it('reports api.reachable=false with the error message when the API is down', async () => {
    const report = await doctorCommand({
      mode: 'json',
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      garu: fakeGaruDown as any,
      home: tmpHome,
      cwd: tmpCwd,
      platform: 'linux'
    });
    expect(report.api.reachable).toBe(false);
    expect(report.api.error).toContain('ECONNREFUSED');
  });

  it('detects Claude Code when ~/.claude exists', async () => {
    await mkdir(join(tmpHome, '.claude'));
    const report = await doctorCommand({
      mode: 'json',
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      garu: fakeGaruOK as any,
      home: tmpHome,
      cwd: tmpCwd,
      platform: 'linux'
    });
    expect(report.agents.claudeCode).toBe(true);
    expect(report.agents.cursor).toBe(false);
  });

  it('detects VS Code MCP config in cwd', async () => {
    await mkdir(join(tmpCwd, '.vscode'));
    await writeFile(join(tmpCwd, '.vscode', 'mcp.json'), '{}');
    const report = await doctorCommand({
      mode: 'json',
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      garu: fakeGaruOK as any,
      home: tmpHome,
      cwd: tmpCwd,
      platform: 'linux'
    });
    expect(report.agents.vscodeMcpInCwd).toBe(true);
  });

  it('detects Claude Desktop on darwin at the platform-specific path', async () => {
    const cfgDir = join(tmpHome, 'Library', 'Application Support', 'Claude');
    await mkdir(cfgDir, { recursive: true });
    await writeFile(join(cfgDir, 'claude_desktop_config.json'), '{}');
    const report = await doctorCommand({
      mode: 'json',
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      garu: fakeGaruOK as any,
      home: tmpHome,
      cwd: tmpCwd,
      platform: 'darwin'
    });
    expect(report.agents.claudeDesktop).toBe(true);
  });
});
