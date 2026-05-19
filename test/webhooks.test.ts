/* eslint-disable @typescript-eslint/no-explicit-any */
import type { WebhookEvent } from '@garuhq/node';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  webhooksEventsGetCommand,
  webhooksEventsListCommand,
  webhooksEventsResendCommand,
  webhooksEventsRetryCommand
} from '../src/commands/webhooks.js';

let stdoutSpy: any;
let stderrSpy: any;

beforeEach(() => {
  stdoutSpy = vi.spyOn(process.stdout, 'write').mockImplementation(() => true);
  stderrSpy = vi.spyOn(process.stderr, 'write').mockImplementation(() => true);
});

afterEach(() => {
  stdoutSpy.mockRestore();
  stderrSpy.mockRestore();
});

const fakeEndpoint = {
  id: 7,
  url: 'https://example.com/hooks/garu',
  description: 'Prod hook',
  enabled: true,
  events: ['transaction.payment.paid']
};

const fakeEvent: WebhookEvent = {
  id: 42,
  endpointId: 7,
  webhookEndpoint: fakeEndpoint,
  eventType: 'transaction.payment.paid',
  payload: { transactionId: 1234, amount: 9900 },
  status: 'failed',
  attempts: 5,
  lastAttemptAt: '2026-05-19T12:00:00Z',
  nextRetryAt: null,
  responseStatus: 500,
  responseBody: 'Internal Server Error',
  manualResendOf: null,
  createdAt: '2026-05-19T11:00:00Z'
};

function makeFakeGaru(
  overrides: Partial<{ list: unknown; get: unknown; retry: unknown; resend: unknown }> = {}
) {
  return {
    webhookEvents: {
      list:
        overrides.list ??
        vi.fn().mockResolvedValue({
          data: [fakeEvent],
          meta: { page: 1, limit: 50, total: 1, totalPages: 1 }
        }),
      get: overrides.get ?? vi.fn().mockResolvedValue(fakeEvent),
      retry:
        overrides.retry ??
        vi
          .fn()
          .mockResolvedValue({ ...fakeEvent, status: 'pending', attempts: 0, responseStatus: null }),
      resend:
        overrides.resend ??
        vi.fn().mockResolvedValue({
          ...fakeEvent,
          id: 99,
          status: 'pending',
          attempts: 0,
          responseStatus: null,
          responseBody: null,
          lastAttemptAt: null,
          manualResendOf: 42,
          createdAt: '2026-05-19T13:00:00Z'
        })
    }
  };
}

describe('webhooksEventsListCommand', () => {
  it('passes empty params for the default list and writes JSON', async () => {
    const fake = makeFakeGaru();
    const result = await webhooksEventsListCommand({
      garu: fake as any,
      mode: 'json'
    });

    expect((fake.webhookEvents.list as any).mock.calls[0][0]).toEqual({});
    expect(result.data).toHaveLength(1);
    expect(result.data[0]!.id).toBe(42);
    expect(stdoutSpy).toHaveBeenCalled();
  });

  it('forwards all filters', async () => {
    const fake = makeFakeGaru();
    await webhooksEventsListCommand({
      garu: fake as any,
      mode: 'json',
      page: 2,
      limit: 25,
      status: 'failed',
      eventType: 'transaction.payment.paid',
      endpointId: 7
    });

    expect((fake.webhookEvents.list as any).mock.calls[0][0]).toEqual({
      page: 2,
      limit: 25,
      status: 'failed',
      eventType: 'transaction.payment.paid',
      endpointId: 7
    });
  });

  it('renders pretty output with status, attempts, and event type', async () => {
    const fake = makeFakeGaru();
    await webhooksEventsListCommand({
      garu: fake as any,
      mode: 'pretty'
    });

    const output = stdoutSpy.mock.calls[0][0];
    expect(output).toContain('Webhook events');
    expect(output).toContain('transaction.payment.paid');
    expect(output).toContain('attempts= 5');
    // status badge is wrapped in ANSI escapes; assert on the bare token
    expect(output).toContain('failed');
  });

  it('shows empty message when no events found', async () => {
    const fake = makeFakeGaru({
      list: vi.fn().mockResolvedValue({
        data: [],
        meta: { page: 1, limit: 50, total: 0, totalPages: 0 }
      })
    });
    await webhooksEventsListCommand({
      garu: fake as any,
      mode: 'pretty'
    });

    const output = stdoutSpy.mock.calls[0][0];
    expect(output).toContain('No webhook events found');
  });
});

describe('webhooksEventsGetCommand', () => {
  it('calls garu.webhookEvents.get with the parsed id', async () => {
    const fake = makeFakeGaru();
    await webhooksEventsGetCommand({
      garu: fake as any,
      mode: 'json',
      id: 42
    });
    expect((fake.webhookEvents.get as any).mock.calls[0][0]).toBe(42);
  });

  it('renders pretty output with endpoint url and response body', async () => {
    const fake = makeFakeGaru();
    await webhooksEventsGetCommand({
      garu: fake as any,
      mode: 'pretty',
      id: 42
    });
    const output = stdoutSpy.mock.calls[0][0];
    expect(output).toContain('Webhook event 42');
    expect(output).toContain('https://example.com/hooks/garu');
    expect(output).toContain('Internal Server Error');
  });
});

describe('webhooksEventsRetryCommand', () => {
  it('calls garu.webhookEvents.retry with the parsed id and reports the reset state', async () => {
    const fake = makeFakeGaru();
    const event = await webhooksEventsRetryCommand({
      garu: fake as any,
      mode: 'json',
      id: 42
    });
    expect((fake.webhookEvents.retry as any).mock.calls[0][0]).toBe(42);
    expect(event.status).toBe('pending');
    expect(event.attempts).toBe(0);
  });
});

describe('webhooksEventsResendCommand', () => {
  it('calls garu.webhookEvents.resend with the parsed id and returns the clone', async () => {
    const fake = makeFakeGaru();
    const clone = await webhooksEventsResendCommand({
      garu: fake as any,
      mode: 'json',
      id: 42
    });
    expect((fake.webhookEvents.resend as any).mock.calls[0][0]).toBe(42);
    expect(clone.id).toBe(99);
    expect(clone.manualResendOf).toBe(42);
    expect(clone.status).toBe('pending');
  });

  it('writes the JSON clone to stdout in JSON mode (no banner)', async () => {
    const fake = makeFakeGaru();
    await webhooksEventsResendCommand({
      garu: fake as any,
      mode: 'json',
      id: 42
    });
    const stdoutPayload = stdoutSpy.mock.calls[0][0];
    expect(stdoutPayload).toContain('"id":99');
    expect(stdoutPayload).toContain('"manualResendOf":42');
    // status banner is suppressed in JSON mode
    expect(stderrSpy).not.toHaveBeenCalled();
  });

  it('prints a prominent banner with the source id and the clone id in pretty mode', async () => {
    const fake = makeFakeGaru();
    await webhooksEventsResendCommand({
      garu: fake as any,
      mode: 'pretty',
      id: 42
    });
    const stderrOutput = stderrSpy.mock.calls.map((c: any[]) => c[0]).join('');
    expect(stderrOutput).toContain('Resent event 42');
    expect(stderrOutput).toContain('new event 99');

    const stdoutOutput = stdoutSpy.mock.calls[0][0];
    expect(stdoutOutput).toContain('Webhook event 99');
    expect(stdoutOutput).toContain('resendOf:      42');
  });

  it('suppresses the banner when --quiet is set', async () => {
    const fake = makeFakeGaru();
    await webhooksEventsResendCommand({
      garu: fake as any,
      mode: 'pretty',
      quiet: true,
      id: 42
    });
    expect(stderrSpy).not.toHaveBeenCalled();
  });
});

