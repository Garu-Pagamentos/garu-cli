/* eslint-disable @typescript-eslint/no-explicit-any */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  refundRequestsConfirmCommand,
  refundRequestsGetCommand,
  refundRequestsListCommand,
  refundRequestsRejectCommand
} from '../src/commands/refund-requests.js';

let stdoutSpy: any;

beforeEach(() => {
  stdoutSpy = vi.spyOn(process.stdout, 'write').mockImplementation(() => true);
});

afterEach(() => {
  stdoutSpy.mockRestore();
});

const fakeRequestUuid = 'a1b2c3d4-e5f6-7890-abcd-ef1234567890';

const fakeRequest = {
  uuid: fakeRequestUuid,
  status: 'pending',
  amount: 390,
  reason: 'Produto não entregue',
  installmentPlanId: '40381e8e-6ee7-4b8e-9393-766a6e2109d2',
  chargeId: null,
  requestedBy: { type: 'user', id: 1 },
  resolvedBy: null,
  sellerNote: null,
  resolvedAt: null,
  createdAt: '2026-08-01T00:00:00Z'
};

function makeFakeGaru(overrides: Record<string, unknown> = {}) {
  return {
    refundRequests: {
      list: vi
        .fn()
        .mockResolvedValue({ data: [fakeRequest], count: 1, totalCount: 1, totalPages: 1 }),
      get: vi.fn().mockResolvedValue(fakeRequest),
      confirm: vi.fn().mockResolvedValue({ ...fakeRequest, status: 'confirmed' }),
      reject: vi.fn().mockResolvedValue({ ...fakeRequest, status: 'rejected' }),
      ...overrides
    }
  };
}

describe('refundRequestsListCommand', () => {
  it('passes empty params for the default list', async () => {
    const fake = makeFakeGaru();
    await refundRequestsListCommand({ garu: fake as any, mode: 'json' });
    expect((fake.refundRequests.list as any).mock.calls[0][0]).toEqual({});
  });

  it('collapses a single-element status array to a scalar', async () => {
    const fake = makeFakeGaru();
    await refundRequestsListCommand({ garu: fake as any, mode: 'json', status: ['pending'] });
    expect((fake.refundRequests.list as any).mock.calls[0][0].status).toBe('pending');
  });

  it('forwards planId and chargeId filters', async () => {
    const fake = makeFakeGaru();
    await refundRequestsListCommand({
      garu: fake as any,
      mode: 'json',
      planId: 'plan-uuid',
      chargeId: 'charge-uuid'
    });
    expect((fake.refundRequests.list as any).mock.calls[0][0]).toEqual({
      planId: 'plan-uuid',
      chargeId: 'charge-uuid'
    });
  });

  it('renders a pretty table', async () => {
    const fake = makeFakeGaru();
    await refundRequestsListCommand({ garu: fake as any, mode: 'pretty' });
    const output = stdoutSpy.mock.calls[0][0];
    expect(output).toContain('Refund requests');
    expect(output).toContain(fakeRequestUuid);
  });

  it('shows empty message when no requests found', async () => {
    const fake = makeFakeGaru({
      list: vi.fn().mockResolvedValue({ data: [], count: 0, totalCount: 0, totalPages: 0 })
    });
    await refundRequestsListCommand({ garu: fake as any, mode: 'pretty' });
    expect(stdoutSpy.mock.calls[0][0]).toContain('No refund requests found');
  });
});

describe('refundRequestsGetCommand', () => {
  it('fetches the request by uuid', async () => {
    const fake = makeFakeGaru();
    await refundRequestsGetCommand({ garu: fake as any, mode: 'json', uuid: fakeRequestUuid });
    expect((fake.refundRequests.get as any).mock.calls[0][0]).toBe(fakeRequestUuid);
  });
});

describe('refundRequestsConfirmCommand', () => {
  it('forwards an optional note', async () => {
    const fake = makeFakeGaru();
    await refundRequestsConfirmCommand({
      garu: fake as any,
      mode: 'json',
      uuid: fakeRequestUuid,
      note: 'Pix devolvido em 14/08'
    });
    expect((fake.refundRequests.confirm as any).mock.calls[0]).toEqual([
      fakeRequestUuid,
      { note: 'Pix devolvido em 14/08' }
    ]);
  });

  it('passes an empty params object when no note is given', async () => {
    const fake = makeFakeGaru();
    await refundRequestsConfirmCommand({ garu: fake as any, mode: 'json', uuid: fakeRequestUuid });
    expect((fake.refundRequests.confirm as any).mock.calls[0][1]).toEqual({});
  });
});

describe('refundRequestsRejectCommand', () => {
  it('forwards an optional note', async () => {
    const fake = makeFakeGaru();
    await refundRequestsRejectCommand({
      garu: fake as any,
      mode: 'json',
      uuid: fakeRequestUuid,
      note: 'Produto entregue'
    });
    expect((fake.refundRequests.reject as any).mock.calls[0]).toEqual([
      fakeRequestUuid,
      { note: 'Produto entregue' }
    ]);
  });
});
