/* eslint-disable @typescript-eslint/no-explicit-any */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  chargesCreateCommand,
  chargesGetCommand,
  chargesListCommand,
  chargesRefundCommand
} from '../src/commands/charges.js';
import { CliError } from '../src/lib/errors.js';

let stdoutSpy: any;

beforeEach(() => {
  stdoutSpy = vi.spyOn(process.stdout, 'write').mockImplementation(() => true);
});

afterEach(() => {
  stdoutSpy.mockRestore();
});

const fakeChargeUuid = '6f1c9b2e-4a7d-4f0b-9a3e-1d2c3b4a5e6f';

function makeFakeGaru(
  overrides: Partial<{ create: unknown; retrieve: unknown; refund: unknown; list: unknown }> = {}
) {
  return {
    charges: {
      create:
        overrides.create ??
        vi.fn().mockResolvedValue({ uuid: fakeChargeUuid, status: 'pending', amount: 100 }),
      retrieve:
        overrides.retrieve ??
        vi.fn().mockResolvedValue({ uuid: fakeChargeUuid, status: 'paid', amount: 100 }),
      refund:
        overrides.refund ??
        vi.fn().mockResolvedValue({ uuid: fakeChargeUuid, status: 'refunded', amount: 100 }),
      list:
        overrides.list ??
        vi.fn().mockResolvedValue({
          data: [
            {
              uuid: fakeChargeUuid,
              status: 'paid',
              paymentMethod: 'pix',
              createdAt: '2026-01-01T00:00:00Z'
            }
          ],
          count: 1,
          totalCount: 1,
          totalPages: 1
        })
    }
  };
}

const fakeCustomer = {
  customerName: 'Maria Silva',
  customerEmail: 'maria@exemplo.com.br',
  customerDocument: '12345678909',
  customerPhone: '11987654321'
};

describe('chargesCreateCommand', () => {
  it('creates a PIX charge and writes JSON to stdout', async () => {
    const fake = makeFakeGaru();
    const charge = await chargesCreateCommand({
      garu: fake as any,
      mode: 'json',
      type: 'pix',
      productId: 'prod-uuid',
      ...fakeCustomer
    });

    expect(charge.uuid).toBe(fakeChargeUuid);
    expect((fake.charges.create as any).mock.calls[0][0]).toMatchObject({
      paymentMethod: 'pix',
      productId: 'prod-uuid'
    });
    expect(stdoutSpy).toHaveBeenCalledWith(
      `{"uuid":"${fakeChargeUuid}","status":"pending","amount":100}\n`
    );
  });

  it('requires all credit-card fields when --type=credit_card', async () => {
    const fake = makeFakeGaru();
    await expect(
      chargesCreateCommand({
        garu: fake as any,
        mode: 'json',
        type: 'credit_card',
        productId: 'p',
        ...fakeCustomer
      })
    ).rejects.toBeInstanceOf(CliError);
  });

  it('forwards card info when --type=credit_card with all flags, mapped to the SDK shape', async () => {
    const fake = makeFakeGaru();
    await chargesCreateCommand({
      garu: fake as any,
      mode: 'json',
      type: 'credit_card',
      productId: 'p',
      ...fakeCustomer,
      cardNumber: '4111111111111111',
      cardCvv: '123',
      cardExpiration: '2030-12',
      cardHolder: 'MARIA SILVA',
      installments: 3
    });

    const call = (fake.charges.create as any).mock.calls[0][0];
    expect(call.paymentMethod).toBe('creditCard');
    expect(call.card).toEqual({
      number: '4111111111111111',
      cvv: '123',
      expirationDate: '2030-12',
      holderName: 'MARIA SILVA',
      installments: 3
    });
  });
});

describe('chargesGetCommand', () => {
  it('calls garu.charges.retrieve with the uuid', async () => {
    const fake = makeFakeGaru();
    await chargesGetCommand({
      garu: fake as any,
      mode: 'json',
      id: fakeChargeUuid
    });
    expect((fake.charges.retrieve as any).mock.calls[0][0]).toBe(fakeChargeUuid);
  });
});

describe('chargesRefundCommand', () => {
  it('passes amount (reais) and reason through', async () => {
    const fake = makeFakeGaru();
    await chargesRefundCommand({
      garu: fake as any,
      mode: 'json',
      id: fakeChargeUuid,
      amount: 10.0,
      reason: 'customer_request'
    });
    const call = (fake.charges.refund as any).mock.calls[0];
    expect(call[0]).toBe(fakeChargeUuid);
    expect(call[1]).toEqual({ amount: 10.0, reason: 'customer_request' });
  });

  it('passes an empty params object for a full refund', async () => {
    const fake = makeFakeGaru();
    await chargesRefundCommand({
      garu: fake as any,
      mode: 'json',
      id: fakeChargeUuid
    });
    expect((fake.charges.refund as any).mock.calls[0][1]).toEqual({});
  });
});

describe('chargesListCommand', () => {
  it('calls garu.charges.list with filters and writes JSON', async () => {
    const fake = makeFakeGaru();
    const result = await chargesListCommand({
      garu: fake as any,
      mode: 'json',
      page: 2,
      limit: 10,
      status: 'paid'
    });

    expect((fake.charges.list as any).mock.calls[0][0]).toEqual({
      page: 2,
      limit: 10,
      status: 'paid'
    });
    expect(result.totalCount).toBe(1);
    expect(stdoutSpy).toHaveBeenCalled();
  });

  it('passes empty params for default list', async () => {
    const fake = makeFakeGaru();
    await chargesListCommand({
      garu: fake as any,
      mode: 'json'
    });

    expect((fake.charges.list as any).mock.calls[0][0]).toEqual({});
  });

  it('forwards search and paymentMethod params', async () => {
    const fake = makeFakeGaru();
    await chargesListCommand({
      garu: fake as any,
      mode: 'json',
      search: 'maria',
      paymentMethod: 'pix'
    });

    expect((fake.charges.list as any).mock.calls[0][0]).toEqual({
      search: 'maria',
      paymentMethod: 'pix'
    });
  });

  it('renders pretty output for TTY mode', async () => {
    const fake = makeFakeGaru();
    await chargesListCommand({
      garu: fake as any,
      mode: 'pretty'
    });

    const output = stdoutSpy.mock.calls[0][0];
    expect(output).toContain('Charges');
    expect(output).toContain('paid');
  });

  it('shows empty message when no charges found', async () => {
    const fake = makeFakeGaru({
      list: vi.fn().mockResolvedValue({ data: [], count: 0, totalCount: 0, totalPages: 0 })
    });
    await chargesListCommand({
      garu: fake as any,
      mode: 'pretty'
    });

    const output = stdoutSpy.mock.calls[0][0];
    expect(output).toContain('No charges found');
  });
});
