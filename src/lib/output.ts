import pc from 'picocolors';

import { CliError, toCliError } from './errors.js';

export type OutputMode = 'pretty' | 'json';

export interface OutputOptions {
  /** Force a mode. If omitted, auto-detect from TTY. */
  mode?: OutputMode;
  /** Passed by `--quiet`; suppresses everything except errors and the final value. */
  quiet?: boolean;
}

/**
 * Resolve the output mode. Rules:
 *   - Explicit `--json` (or `opts.mode === 'json'`) wins.
 *   - Non-TTY stdout (pipe, CI) → `json`.
 *   - Everything else → `pretty`.
 */
export function resolveMode(
  opts: OutputOptions = {},
  stdout: NodeJS.WriteStream = process.stdout
): OutputMode {
  if (opts.mode) return opts.mode;
  return stdout.isTTY ? 'pretty' : 'json';
}

/**
 * Print a successful command result. In JSON mode the full object is written
 * to stdout with a trailing newline. In pretty mode the caller's `prettyPrint`
 * fallback (if provided) is used; otherwise the JSON is indented.
 */
export function printResult<T>(
  value: T,
  opts: OutputOptions & { prettyPrint?: (value: T) => string } = {}
): void {
  const mode = resolveMode(opts);
  if (mode === 'json') {
    process.stdout.write(`${JSON.stringify(value)}\n`);
    return;
  }
  if (opts.prettyPrint) {
    process.stdout.write(`${opts.prettyPrint(value)}\n`);
    return;
  }
  process.stdout.write(`${JSON.stringify(value, null, 2)}\n`);
}

/** Print a short status line — suppressed in JSON mode and when `--quiet`. */
export function printStatus(message: string, opts: OutputOptions = {}): void {
  if (opts.quiet) return;
  if (resolveMode(opts) === 'json') return;
  process.stderr.write(`${pc.dim('→')} ${message}\n`);
}

/** Print a success line — suppressed in JSON mode and when `--quiet`. */
export function printSuccess(message: string, opts: OutputOptions = {}): void {
  if (opts.quiet) return;
  if (resolveMode(opts) === 'json') return;
  process.stderr.write(`${pc.green('✓')} ${message}\n`);
}

/**
 * Print an error and exit with the appropriate code. Always uses the
 * CLI-standard shape `{"error":{"code","message"}}` on stdout in JSON mode,
 * or a red `Error:` line on stderr in pretty mode.
 */
export function printErrorAndExit(err: unknown, opts: OutputOptions = {}): never {
  const cliErr: CliError = toCliError(err);
  const payload: {
    error: { code: string; message: string; status?: number; body?: unknown };
  } = { error: { code: cliErr.code, message: cliErr.message } };
  if (cliErr.status !== null) payload.error.status = cliErr.status;
  if (cliErr.body !== undefined) payload.error.body = cliErr.body;

  if (resolveMode(opts) === 'json') {
    process.stdout.write(`${JSON.stringify(payload)}\n`);
  } else {
    process.stderr.write(`${pc.red('Error:')} ${cliErr.message}\n`);
    if (cliErr.code !== 'unknown_error') {
      process.stderr.write(`${pc.dim(`  code: ${cliErr.code}`)}\n`);
    }
    if (cliErr.status !== null) {
      process.stderr.write(`${pc.dim(`  status: ${cliErr.status}`)}\n`);
    }
  }
  process.exit(cliErr.exitCode);
}
