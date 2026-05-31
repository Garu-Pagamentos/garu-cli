/* eslint-disable @typescript-eslint/no-explicit-any */
import type { ChargeNowResult, ScheduledChargeRecord } from '@garuhq/node';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  scheduledChargesAttemptsCommand,
  scheduledChargesCancelAtPeriodEndCommand,
  scheduledChargesChargeNowCommand,
  scheduledChargesCreateCommand,
  scheduledChargesGetCommand,
  scheduledChargesListCommand,
  scheduledChargesMarkPaidCommand,
  scheduledChargesPostponeCommand
} from '../src/commands/scheduled-charges.js';

let stdoutSpy: any;
let stderrSpy: any;

beforeEach(() => {
  process.exitCode = 0;
  stdoutSpy = vi.spyOn(process.stdout, 'write').mockImplementation(() => true);
  stderrSpy = vi.spyOn(process.stderr, 'write').mockImplementation(() => true);
});

afterEach(() => {
  stdoutSpy.mockRestore();
  stderrSpy.mockRestore();
  // charge-now sets process.exitCode as a side effect; don't leak it into the runner.
  process.exitCode = 0;
});

const fakeRecord: ScheduledChargeRecord = {
  id: 'sch_abc123',
  sellerId: 1,
  customerId: 42,
  productId: null,
  amount: 297.5,
  description: 'Mensalidade Junho',
  type: 'one_time',
  dueDate: '2026-06-15',
  methods: ['pix', 'boleto'],
  status: 'scheduled',
  externalReference: null,
  maxRecoveryDays: null,
  metadata: null,
  createdAt: '2026-05-25T12:00:00Z',
  updatedAt: '2026-05-25T12:00:00Z'
};

const fakeDetail = {
  charge: fakeRecord,
  events: [
    {
      id: 1,
      scheduledChargeId: 'sch_abc123',
      eventType: 'created' as const,
      actor: { type: 'api_key' as const, id: 7 },
      payload: null,
      createdAt: '2026-05-25T12:00:00Z'
    }
  ],
  transactions: []
};

function makeFakeGaru(overrides: Record<string, unknown> = {}) {
  return {
    scheduledCharges: {
      create: vi.fn().mockResolvedValue(fakeRecord),
      list: vi.fn().mockResolvedValue({
        data: [fakeRecord],
        meta: { page: 1, limit: 50, total: 1, totalPages: 1 }
      }),
      get: vi.fn().mockResolvedValue(fakeDetail),
      postpone: vi.fn().mockResolvedValue({ ...fakeRecord, dueDate: '2026-07-01' }),
      pause: vi.fn().mockResolvedValue({ ...fakeRecord, status: 'paused' }),
      resume: vi.fn().mockResolvedValue(fakeRecord),
      markPaid: vi.fn().mockResolvedValue({ ...fakeRecord, status: 'paid' }),
      cancelRecurrence: vi.fn().mockResolvedValue(fakeRecord),
      setCancelAtPeriodEnd: vi.fn().mockResolvedValue(fakeRecord),
      changePaymentMethod: vi.fn().mockResolvedValue(fakeRecord),
      clearPaymentMethod: vi.fn().mockResolvedValue(fakeRecord),
      listAttempts: vi.fn().mockResolvedValue({
        data: [],
        meta: { page: 1, limit: 50, total: 0, totalPages: 0 }
      }),
      chargeNow: vi.fn(),
      ...overrides
    }
  };
}

describe('scheduledChargesCreateCommand', () => {
  it('forwards required fields and only the optional flags that were set', async () => {
    const fake = makeFakeGaru();
    await scheduledChargesCreateCommand({
      garu: fake as any,
      mode: 'json',
      customerId: 42,
      amount: 297.5,
      type: 'one_time',
      dueDate: '2026-06-15',
      methods: ['pix', 'boleto']
    });

    expect((fake.scheduledCharges.create as any).mock.calls[0][0]).toEqual({
      customerId: 42,
      amount: 297.5,
      type: 'one_time',
      dueDate: '2026-06-15',
      methods: ['pix', 'boleto']
    });
  });

  it('forwards maxRecoveryDays when provided', async () => {
    const fake = makeFakeGaru();
    await scheduledChargesCreateCommand({
      garu: fake as any,
      mode: 'json',
      customerId: 42,
      amount: 297.5,
      type: 'one_time',
      dueDate: '2026-06-15',
      methods: ['pix'],
      maxRecoveryDays: 30
    });

    expect((fake.scheduledCharges.create as any).mock.calls[0][0].maxRecoveryDays).toBe(30);
  });

  it('assembles a recurrence block from the recurrence-* options', async () => {
    const fake = makeFakeGaru();
    await scheduledChargesCreateCommand({
      garu: fake as any,
      mode: 'json',
      customerId: 42,
      amount: 99,
      type: 'recurring',
      dueDate: '2026-06-15',
      methods: ['card'],
      productId: 5,
      recurrenceInterval: 'monthly',
      recurrenceIntervalCount: 1,
      recurrenceEndsAfter: 12
    });

    const params = (fake.scheduledCharges.create as any).mock.calls[0][0];
    expect(params.recurrence).toEqual({ interval: 'monthly', intervalCount: 1, endsAfter: 12 });
    expect(params.productId).toBe(5);
  });

  it('forwards a pix_automatic recurring charge with its product id', async () => {
    const fake = makeFakeGaru();
    await scheduledChargesCreateCommand({
      garu: fake as any,
      mode: 'json',
      customerId: 42,
      amount: 49.9,
      type: 'recurring',
      dueDate: '2026-06-15',
      methods: ['pix_automatic'],
      productId: 456,
      recurrenceInterval: 'monthly'
    });

    const params = (fake.scheduledCharges.create as any).mock.calls[0][0];
    expect(params.methods).toEqual(['pix_automatic']);
    expect(params.productId).toBe(456);
  });

  it('rejects pix_automatic without --type=recurring before any SDK call', async () => {
    const fake = makeFakeGaru();
    await expect(
      scheduledChargesCreateCommand({
        garu: fake as any,
        mode: 'json',
        customerId: 42,
        amount: 49.9,
        type: 'one_time',
        dueDate: '2026-06-15',
        methods: ['pix_automatic'],
        productId: 456
      })
    ).rejects.toThrowError(/requires --type=recurring/);
    expect((fake.scheduledCharges.create as any).mock.calls.length).toBe(0);
  });

  it('rejects pix_automatic without --product-id before any SDK call', async () => {
    const fake = makeFakeGaru();
    await expect(
      scheduledChargesCreateCommand({
        garu: fake as any,
        mode: 'json',
        customerId: 42,
        amount: 49.9,
        type: 'recurring',
        dueDate: '2026-06-15',
        methods: ['pix_automatic']
      })
    ).rejects.toThrowError(/requires --product-id/);
    expect((fake.scheduledCharges.create as any).mock.calls.length).toBe(0);
  });
});

describe('scheduledChargesListCommand', () => {
  it('passes empty params for the default list', async () => {
    const fake = makeFakeGaru();
    await scheduledChargesListCommand({ garu: fake as any, mode: 'json' });
    expect((fake.scheduledCharges.list as any).mock.calls[0][0]).toEqual({});
  });

  it('collapses a single-element status array to a scalar', async () => {
    const fake = makeFakeGaru();
    await scheduledChargesListCommand({
      garu: fake as any,
      mode: 'json',
      status: ['overdue']
    });
    expect((fake.scheduledCharges.list as any).mock.calls[0][0].status).toBe('overdue');
  });

  it('forwards a multi-status filter as an array', async () => {
    const fake = makeFakeGaru();
    await scheduledChargesListCommand({
      garu: fake as any,
      mode: 'json',
      status: ['scheduled', 'due_today']
    });
    expect((fake.scheduledCharges.list as any).mock.calls[0][0].status).toEqual([
      'scheduled',
      'due_today'
    ]);
  });

  it('renders a pretty table', async () => {
    const fake = makeFakeGaru();
    await scheduledChargesListCommand({ garu: fake as any, mode: 'pretty' });
    const output = stdoutSpy.mock.calls[0][0];
    expect(output).toContain('Scheduled charges');
    expect(output).toContain('sch_abc123');
  });
});

describe('scheduledChargesGetCommand', () => {
  it('fetches the detail and renders the event timeline in pretty mode', async () => {
    const fake = makeFakeGaru();
    await scheduledChargesGetCommand({ garu: fake as any, mode: 'pretty', id: 'sch_abc123' });
    expect((fake.scheduledCharges.get as any).mock.calls[0][0]).toBe('sch_abc123');
    const output = stdoutSpy.mock.calls[0][0];
    expect(output).toContain('Scheduled charge sch_abc123');
    expect(output).toContain('created');
  });
});

describe('scheduledChargesPostponeCommand', () => {
  it('forwards the new due date and reason', async () => {
    const fake = makeFakeGaru();
    await scheduledChargesPostponeCommand({
      garu: fake as any,
      mode: 'json',
      id: 'sch_abc123',
      newDueDate: '2026-07-01',
      reason: 'cliente pediu prazo'
    });
    expect((fake.scheduledCharges.postpone as any).mock.calls[0]).toEqual([
      'sch_abc123',
      { newDueDate: '2026-07-01', reason: 'cliente pediu prazo' }
    ]);
  });
});

describe('scheduledChargesMarkPaidCommand', () => {
  it('forwards the cycle number for recurring schedules', async () => {
    const fake = makeFakeGaru();
    await scheduledChargesMarkPaidCommand({
      garu: fake as any,
      mode: 'json',
      id: 'sch_abc123',
      paymentDate: '2026-06-20',
      cycleNumber: 3
    });
    expect((fake.scheduledCharges.markPaid as any).mock.calls[0]).toEqual([
      'sch_abc123',
      { paymentDate: '2026-06-20', cycleNumber: 3 }
    ]);
  });
});

describe('scheduledChargesCancelAtPeriodEndCommand', () => {
  it('enables soft cancel by default', async () => {
    const fake = makeFakeGaru();
    await scheduledChargesCancelAtPeriodEndCommand({
      garu: fake as any,
      mode: 'json',
      id: 'sch_abc123',
      enabled: true
    });
    expect((fake.scheduledCharges.setCancelAtPeriodEnd as any).mock.calls[0]).toEqual([
      'sch_abc123',
      { enabled: true }
    ]);
  });

  it('clears the flag when disabled', async () => {
    const fake = makeFakeGaru();
    await scheduledChargesCancelAtPeriodEndCommand({
      garu: fake as any,
      mode: 'json',
      id: 'sch_abc123',
      enabled: false
    });
    expect((fake.scheduledCharges.setCancelAtPeriodEnd as any).mock.calls[0][1]).toEqual({
      enabled: false
    });
  });
});

describe('scheduledChargesAttemptsCommand', () => {
  it('forwards the cycle-number filter', async () => {
    const fake = makeFakeGaru();
    await scheduledChargesAttemptsCommand({
      garu: fake as any,
      mode: 'json',
      id: 'sch_abc123',
      cycleNumber: 2
    });
    expect((fake.scheduledCharges.listAttempts as any).mock.calls[0]).toEqual([
      'sch_abc123',
      { cycleNumber: 2 }
    ]);
  });
});

describe('scheduledChargesChargeNowCommand', () => {
  function chargeNowResult(over: Partial<ChargeNowResult>): ChargeNowResult {
    return { outcome: 'dispatched', cycleNumber: null, message: 'ok', ...over };
  }

  it('calls chargeNow with the id and returns the result', async () => {
    const fake = makeFakeGaru({
      chargeNow: vi
        .fn()
        .mockResolvedValue(
          chargeNowResult({ outcome: 'dispatched', cycleNumber: 1, message: 'Cobrança enviada.' })
        )
    });
    const result = await scheduledChargesChargeNowCommand({
      garu: fake as any,
      mode: 'json',
      id: 'sch_abc123'
    });
    expect((fake.scheduledCharges.chargeNow as any).mock.calls[0][0]).toBe('sch_abc123');
    expect(result.outcome).toBe('dispatched');
  });

  it('prints the returned message in pretty mode', async () => {
    const fake = makeFakeGaru({
      chargeNow: vi
        .fn()
        .mockResolvedValue(chargeNowResult({ message: 'Cobrança enviada (ciclo 1).' }))
    });
    await scheduledChargesChargeNowCommand({ garu: fake as any, mode: 'pretty', id: 'sch_abc123' });
    expect(stdoutSpy.mock.calls[0][0]).toContain('Cobrança enviada (ciclo 1).');
  });

  it('emits the full result as JSON (message included) in JSON mode', async () => {
    const fake = makeFakeGaru({
      chargeNow: vi.fn().mockResolvedValue(chargeNowResult({ message: 'pronto' }))
    });
    await scheduledChargesChargeNowCommand({ garu: fake as any, mode: 'json', id: 'sch_abc123' });
    expect(stdoutSpy.mock.calls[0][0]).toContain('"message":"pronto"');
  });

  it('exits 0 (leaves exitCode unset) on already_sent — idempotent no-op', async () => {
    const fake = makeFakeGaru({
      chargeNow: vi
        .fn()
        .mockResolvedValue(chargeNowResult({ outcome: 'already_sent', cycleNumber: 1 }))
    });
    await scheduledChargesChargeNowCommand({ garu: fake as any, mode: 'json', id: 'sch_abc123' });
    expect(process.exitCode).toBe(0);
  });

  it.each(['failed', 'not_sent'] as const)('sets a non-zero exit code on %s', async (outcome) => {
    const fake = makeFakeGaru({
      chargeNow: vi
        .fn()
        .mockResolvedValue(chargeNowResult({ outcome, reason: 'card_expired', message: 'falhou' }))
    });
    const result = await scheduledChargesChargeNowCommand({
      garu: fake as any,
      mode: 'json',
      id: 'sch_abc123'
    });
    expect(result.outcome).toBe(outcome);
    expect(process.exitCode).toBe(1);
  });
});
