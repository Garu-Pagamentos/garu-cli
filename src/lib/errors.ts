/**
 * CLI error model. All user-visible failures flow through these types so that
 * the output layer can render them consistently — pretty with a red prefix in
 * TTY mode, strict `{"error":{"code","message"}}` on stdout + exit 1 in JSON mode.
 */

import { GaruError } from '@garuhq/node';

export type CliErrorCode =
  | 'auth_error'
  | 'not_found'
  | 'validation_error'
  | 'rate_limited'
  | 'server_error'
  | 'connection_error'
  | 'signature_verification_failed'
  | 'user_cancelled'
  | 'invalid_input'
  | 'unknown_error';

export class CliError extends Error {
  public readonly code: CliErrorCode;
  public readonly exitCode: number;

  constructor(code: CliErrorCode, message: string, exitCode = 1) {
    super(message);
    this.name = 'CliError';
    this.code = code;
    this.exitCode = exitCode;
  }
}

/** Wrap an unknown thrown value as a {@link CliError}. */
export function toCliError(err: unknown): CliError {
  if (err instanceof CliError) return err;
  if (err instanceof GaruError) {
    return new CliError(mapSdkCodeToCliCode(err.code), err.message, 1);
  }
  if (err instanceof Error) return new CliError('unknown_error', err.message);
  return new CliError('unknown_error', String(err));
}

function mapSdkCodeToCliCode(sdkCode: string): CliErrorCode {
  switch (sdkCode) {
    case 'authentication_error':
    case 'permission_error':
      return 'auth_error';
    case 'not_found':
      return 'not_found';
    case 'validation_error':
      return 'validation_error';
    case 'rate_limited':
      return 'rate_limited';
    case 'server_error':
      return 'server_error';
    case 'connection_error':
      return 'connection_error';
    case 'signature_verification_failed':
      return 'signature_verification_failed';
    default:
      return 'unknown_error';
  }
}
