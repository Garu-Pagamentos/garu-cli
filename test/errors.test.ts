import { GaruAPIError, GaruAuthenticationError, GaruPermissionError } from '@garuhq/node';
import { describe, expect, it } from 'vitest';

import { CliError, toCliError } from '../src/lib/errors.js';

describe('toCliError — SDK code mapping', () => {
  it('maps GaruAuthenticationError (401) to CLI code `auth_error`', () => {
    const sdkErr = new GaruAuthenticationError('Invalid API key', 401, 'req_1', {
      message: 'Invalid API key'
    });

    const cliErr = toCliError(sdkErr);

    expect(cliErr).toBeInstanceOf(CliError);
    expect(cliErr.code).toBe('auth_error');
    expect(cliErr.status).toBe(401);
    expect(cliErr.body).toEqual({ message: 'Invalid API key' });
  });

  it('maps GaruPermissionError (403) to CLI code `permission_error` — not `auth_error`', () => {
    // Regression for v0.4.2: a 403 was previously collapsed into `auth_error`,
    // so users hitting a cross-seller resource saw "your key is bad" instead of
    // "valid key, not your resource".
    const sdkErr = new GaruPermissionError('Unauthorized', 403, 'req_2', {
      message: 'Unauthorized'
    });

    const cliErr = toCliError(sdkErr);

    expect(cliErr.code).toBe('permission_error');
    expect(cliErr.status).toBe(403);
    expect(cliErr.body).toEqual({ message: 'Unauthorized' });
  });

  it('carries status + body from any GaruAPIError', () => {
    const sdkErr = new GaruAPIError('api_error', 'Teapot', 418, null, { foo: 'bar' });

    const cliErr = toCliError(sdkErr);

    expect(cliErr.status).toBe(418);
    expect(cliErr.body).toEqual({ foo: 'bar' });
  });

  it('leaves status null and body undefined for non-API errors', () => {
    const cliErr = toCliError(new Error('boom'));

    expect(cliErr.code).toBe('unknown_error');
    expect(cliErr.status).toBeNull();
    expect(cliErr.body).toBeUndefined();
  });

  it('returns CliError instances unchanged', () => {
    const original = new CliError('user_cancelled', 'cancelled', 130);
    expect(toCliError(original)).toBe(original);
  });
});
