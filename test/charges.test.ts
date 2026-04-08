import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  chargesCreateCommand,
  chargesGetCommand,
  chargesRefundCommand
} from '../src/commands/charges.js';
import { CliError } from '../src/lib/errors.js';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
let stdoutSpy: any;

beforeEach(() => {
  stdoutSpy = vi.spyOn(process.stdout, 'write').mockImplementation(() => true);
});

afterEach(() => {
  stdoutSpy.mockRestore();
});

function makeFakeGaru(overrides: Partial<{ create: unknown; get: unknown; refund: unknown }> = {}) {
  return {
    charges: {
      create: overrides.create ?? vi.fn().mockResolvedValue({ id: 1, status: 'pending' }),
      get: overrides.get ?? vi.fn().mockResolvedValue({ id: 2, status: 'paid' }),
      refund: overrides.refund ?? vi.fn().mockResolvedValue({ id: 3, status: 'refunded' })
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
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      garu: fake as any,
      mode: 'json',
      type: 'pix',
      productId: 'prod-uuid',
      ...fakeCustomer
    });

    expect(charge.id).toBe(1);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    expect((fake.charges.create as any).mock.calls[0][0]).toMatchObject({
      paymentMethod: 'pix',
      productId: 'prod-uuid'
    });
    expect(stdoutSpy).toHaveBeenCalledWith('{"id":1,"status":"pending"}\n');
  });

  it('requires all credit-card fields when --type=credit_card', async () => {
    const fake = makeFakeGaru();
    await expect(
      chargesCreateCommand({
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        garu: fake as any,
        mode: 'json',
        type: 'credit_card',
        productId: 'p',
        ...fakeCustomer
      })
    ).rejects.toBeInstanceOf(CliError);
  });

  it('forwards card info when --type=credit_card with all flags', async () => {
    const fake = makeFakeGaru();
    await chargesCreateCommand({
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
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

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const call = (fake.charges.create as any).mock.calls[0][0];
    expect(call.cardInfo).toEqual({
      cardNumber: '4111111111111111',
      cvv: '123',
      expirationDate: '2030-12',
      holderName: 'MARIA SILVA',
      installments: 3
    });
  });
});

describe('chargesGetCommand', () => {
  it('calls garu.charges.get with the parsed id', async () => {
    const fake = makeFakeGaru();
    await chargesGetCommand({
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      garu: fake as any,
      mode: 'json',
      id: 42
    });
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    expect((fake.charges.get as any).mock.calls[0][0]).toBe(42);
  });
});

describe('chargesRefundCommand', () => {
  it('passes amount and reason through', async () => {
    const fake = makeFakeGaru();
    await chargesRefundCommand({
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      garu: fake as any,
      mode: 'json',
      id: 7,
      amount: 1000,
      reason: 'customer_request'
    });
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const call = (fake.charges.refund as any).mock.calls[0];
    expect(call[0]).toBe(7);
    expect(call[1]).toEqual({ amount: 1000, reason: 'customer_request' });
  });

  it('passes an empty params object for a full refund', async () => {
    const fake = makeFakeGaru();
    await chargesRefundCommand({
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      garu: fake as any,
      mode: 'json',
      id: 7
    });
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    expect((fake.charges.refund as any).mock.calls[0][1]).toEqual({});
  });
});
