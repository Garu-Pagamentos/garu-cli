import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { printResult, printStatus, printSuccess, resolveMode } from '../src/lib/output.js';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
let stdoutSpy: any;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let stderrSpy: any;

beforeEach(() => {
  stdoutSpy = vi.spyOn(process.stdout, 'write').mockImplementation(() => true);
  stderrSpy = vi.spyOn(process.stderr, 'write').mockImplementation(() => true);
});

afterEach(() => {
  stdoutSpy.mockRestore();
  stderrSpy.mockRestore();
});

describe('resolveMode', () => {
  it('returns pretty for a TTY stdout', () => {
    expect(resolveMode({}, { isTTY: true } as NodeJS.WriteStream)).toBe('pretty');
  });

  it('returns json for a non-TTY stdout', () => {
    expect(resolveMode({}, { isTTY: false } as NodeJS.WriteStream)).toBe('json');
  });

  it('lets the caller force a mode', () => {
    expect(resolveMode({ mode: 'json' }, { isTTY: true } as NodeJS.WriteStream)).toBe('json');
    expect(resolveMode({ mode: 'pretty' }, { isTTY: false } as NodeJS.WriteStream)).toBe('pretty');
  });
});

describe('printResult', () => {
  it('writes a compact JSON line in json mode', () => {
    printResult({ id: 1, status: 'paid' }, { mode: 'json' });
    expect(stdoutSpy).toHaveBeenCalledWith('{"id":1,"status":"paid"}\n');
  });

  it('uses the custom prettyPrint fn in pretty mode', () => {
    printResult(
      { id: 1, status: 'paid' },
      { mode: 'pretty', prettyPrint: (v) => `Charge ${v.id} → ${v.status}` }
    );
    expect(stdoutSpy).toHaveBeenCalledWith('Charge 1 → paid\n');
  });

  it('falls back to indented JSON when no prettyPrint is provided', () => {
    printResult({ id: 1 }, { mode: 'pretty' });
    const [[call]] = stdoutSpy.mock.calls as unknown as [[string]];
    expect(call).toContain('  "id": 1');
  });
});

describe('printStatus / printSuccess', () => {
  it('prints to stderr only in pretty mode', () => {
    printStatus('working...', { mode: 'pretty' });
    printSuccess('done', { mode: 'pretty' });
    expect(stderrSpy).toHaveBeenCalledTimes(2);
  });

  it('is silent in json mode', () => {
    printStatus('working...', { mode: 'json' });
    printSuccess('done', { mode: 'json' });
    expect(stderrSpy).not.toHaveBeenCalled();
  });

  it('is silent when --quiet', () => {
    printStatus('working...', { mode: 'pretty', quiet: true });
    printSuccess('done', { mode: 'pretty', quiet: true });
    expect(stderrSpy).not.toHaveBeenCalled();
  });
});
