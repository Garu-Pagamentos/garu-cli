/* eslint-disable @typescript-eslint/no-explicit-any */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  installmentPlansCancelCommand,
  installmentPlansCreateCommand,
  installmentPlansGetCommand,
  installmentPlansListCommand,
  installmentPlansMarkPaidCommand,
  installmentPlansPostponeCommand,
  installmentPlansReissueCommand,
  installmentPlansRequestRefundCommand
} from '../src/commands/installment-plans.js';

let stdoutSpy: any;

beforeEach(() => {
  stdoutSpy = vi.spyOn(process.stdout, 'write').mockImplementation(() => true);
});

afterEach(() => {
  stdoutSpy.mockRestore();
});

const fakePlanUuid = '40381e8e-6ee7-4b8e-9393-766a6e2109d2';

const fakePlan = {
  uuid: fakePlanUuid,
  status: 'active',
  installments: 12,
  installmentsPaid: 3,
  baseValue: 1200,
  fator: 1.3,
  installmentAmount: 130,
  totalScheduled: 1560,
  totalCollected: 390,
  firstDueDate: '2026-06-05',
  graceDays: null,
  cancelReason: null,
  product: { uuid: 'prod-uuid', name: 'Curso' },
  customer: { name: 'Maria Silva', email: 'maria@exemplo.com.br', document: '12345678909' },
  activatedAt: '2026-06-06T00:00:00Z',
  completedAt: null,
  canceledAt: null,
  createdAt: '2026-06-05T00:00:00Z'
};

function makeFakeGaru(overrides: Record<string, unknown> = {}) {
  return {
    installmentPlans: {
      create: vi.fn().mockResolvedValue(fakePlan),
      list: vi.fn().mockResolvedValue({ data: [fakePlan], count: 1, totalCount: 1, totalPages: 1 }),
      get: vi.fn().mockResolvedValue(fakePlan),
      reissueInstallment: vi
        .fn()
        .mockResolvedValue({ status: 'emitted', reason: null, installment: null }),
      postponeInstallment: vi
        .fn()
        .mockResolvedValue({
          number: 4,
          amount: 130,
          dueDate: '2026-12-20',
          status: 'scheduled',
          paidAt: null,
          boleto: null,
          reissueCount: 0
        }),
      markInstallmentPaid: vi
        .fn()
        .mockResolvedValue({
          number: 3,
          amount: 130,
          dueDate: '2026-09-05',
          status: 'paid',
          paidAt: '2026-09-05',
          boleto: null,
          reissueCount: 0
        }),
      cancel: vi.fn().mockResolvedValue({ ...fakePlan, status: 'canceled' }),
      requestRefund: vi
        .fn()
        .mockResolvedValue({ uuid: 'rfr-uuid', status: 'pending', amount: 390, reason: null }),
      ...overrides
    }
  };
}

describe('installmentPlansCreateCommand', () => {
  it('forwards required fields and only the optional flags that were set', async () => {
    const fake = makeFakeGaru();
    await installmentPlansCreateCommand({
      garu: fake as any,
      mode: 'json',
      productId: 'prod-uuid',
      customerId: 4821,
      installments: 12
    });

    expect((fake.installmentPlans.create as any).mock.calls[0][0]).toEqual({
      productId: 'prod-uuid',
      customerId: 4821,
      installments: 12
    });
  });

  it('forwards firstDueDate and affiliateId when provided', async () => {
    const fake = makeFakeGaru();
    await installmentPlansCreateCommand({
      garu: fake as any,
      mode: 'json',
      productId: 'prod-uuid',
      customerId: 4821,
      installments: 6,
      firstDueDate: '2026-10-05',
      affiliateId: 5
    });

    const params = (fake.installmentPlans.create as any).mock.calls[0][0];
    expect(params.firstDueDate).toBe('2026-10-05');
    expect(params.affiliateId).toBe(5);
  });
});

describe('installmentPlansListCommand', () => {
  it('passes empty params for the default list', async () => {
    const fake = makeFakeGaru();
    await installmentPlansListCommand({ garu: fake as any, mode: 'json' });
    expect((fake.installmentPlans.list as any).mock.calls[0][0]).toEqual({});
  });

  it('collapses a single-element status array to a scalar', async () => {
    const fake = makeFakeGaru();
    await installmentPlansListCommand({ garu: fake as any, mode: 'json', status: ['defaulted'] });
    expect((fake.installmentPlans.list as any).mock.calls[0][0].status).toBe('defaulted');
  });

  it('forwards a multi-status filter as an array', async () => {
    const fake = makeFakeGaru();
    await installmentPlansListCommand({
      garu: fake as any,
      mode: 'json',
      status: ['active', 'pending_activation']
    });
    expect((fake.installmentPlans.list as any).mock.calls[0][0].status).toEqual([
      'active',
      'pending_activation'
    ]);
  });

  it('renders a pretty table', async () => {
    const fake = makeFakeGaru();
    await installmentPlansListCommand({ garu: fake as any, mode: 'pretty' });
    const output = stdoutSpy.mock.calls[0][0];
    expect(output).toContain('Installment plans');
    expect(output).toContain(fakePlanUuid);
  });
});

describe('installmentPlansGetCommand', () => {
  it('fetches the plan and renders its installments in pretty mode', async () => {
    const fake = makeFakeGaru({
      get: vi.fn().mockResolvedValue({
        ...fakePlan,
        installmentsDetail: [
          {
            number: 1,
            amount: 130,
            dueDate: '2026-06-05',
            status: 'paid',
            paidAt: '2026-06-06',
            boleto: null,
            reissueCount: 0
          }
        ]
      })
    });
    await installmentPlansGetCommand({ garu: fake as any, mode: 'pretty', uuid: fakePlanUuid });
    expect((fake.installmentPlans.get as any).mock.calls[0][0]).toBe(fakePlanUuid);
    const output = stdoutSpy.mock.calls[0][0];
    expect(output).toContain(`Installment plan ${fakePlanUuid}`);
    expect(output).toContain('#1');
  });
});

describe('installmentPlansReissueCommand', () => {
  it('forwards the uuid and installment number', async () => {
    const fake = makeFakeGaru();
    await installmentPlansReissueCommand({
      garu: fake as any,
      mode: 'json',
      uuid: fakePlanUuid,
      number: 4
    });
    expect((fake.installmentPlans.reissueInstallment as any).mock.calls[0]).toEqual([
      fakePlanUuid,
      4
    ]);
  });
});

describe('installmentPlansPostponeCommand', () => {
  it('forwards the new due date', async () => {
    const fake = makeFakeGaru();
    await installmentPlansPostponeCommand({
      garu: fake as any,
      mode: 'json',
      uuid: fakePlanUuid,
      number: 4,
      newDueDate: '2026-12-20'
    });
    expect((fake.installmentPlans.postponeInstallment as any).mock.calls[0]).toEqual([
      fakePlanUuid,
      4,
      { newDueDate: '2026-12-20' }
    ]);
  });
});

describe('installmentPlansMarkPaidCommand', () => {
  it('forwards the uuid and installment number', async () => {
    const fake = makeFakeGaru();
    await installmentPlansMarkPaidCommand({
      garu: fake as any,
      mode: 'json',
      uuid: fakePlanUuid,
      number: 3
    });
    expect((fake.installmentPlans.markInstallmentPaid as any).mock.calls[0]).toEqual([
      fakePlanUuid,
      3
    ]);
  });
});

describe('installmentPlansCancelCommand', () => {
  it('forwards an optional note', async () => {
    const fake = makeFakeGaru();
    await installmentPlansCancelCommand({
      garu: fake as any,
      mode: 'json',
      uuid: fakePlanUuid,
      note: 'Comprador desistiu'
    });
    expect((fake.installmentPlans.cancel as any).mock.calls[0]).toEqual([
      fakePlanUuid,
      { note: 'Comprador desistiu' }
    ]);
  });

  it('passes an empty params object when no note is given', async () => {
    const fake = makeFakeGaru();
    await installmentPlansCancelCommand({ garu: fake as any, mode: 'json', uuid: fakePlanUuid });
    expect((fake.installmentPlans.cancel as any).mock.calls[0][1]).toEqual({});
  });
});

describe('installmentPlansRequestRefundCommand', () => {
  it('forwards amount and reason', async () => {
    const fake = makeFakeGaru();
    await installmentPlansRequestRefundCommand({
      garu: fake as any,
      mode: 'json',
      uuid: fakePlanUuid,
      amount: 390,
      reason: 'Produto não entregue'
    });
    expect((fake.installmentPlans.requestRefund as any).mock.calls[0]).toEqual([
      fakePlanUuid,
      { amount: 390, reason: 'Produto não entregue' }
    ]);
  });
});
