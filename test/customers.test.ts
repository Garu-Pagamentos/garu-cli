/* eslint-disable @typescript-eslint/no-explicit-any */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  customersCreateCommand,
  customersDeleteCommand,
  customersGetCommand,
  customersListCommand,
  customersSetBillingEmailOverrideCommand,
  customersUpdateCommand
} from '../src/commands/customers.js';

let stdoutSpy: any;

beforeEach(() => {
  stdoutSpy = vi.spyOn(process.stdout, 'write').mockImplementation(() => true);
});

afterEach(() => {
  stdoutSpy.mockRestore();
});

const CUSTOMER_UUID = 'a1b2c3d4-e5f6-7890-abcd-ef1234567890';

const fakeCustomer = {
  uuid: CUSTOMER_UUID,
  name: 'Maria Silva',
  email: 'maria@exemplo.com.br',
  phone: '11987654321',
  document: '12345678909',
  personType: 'fisica' as const,
  billingEmail: 'maria@exemplo.com.br',
  hasBillingEmailOverride: false
};

function makeFakeGaru(overrides: Record<string, unknown> = {}) {
  return {
    customers: {
      create: vi.fn().mockResolvedValue(fakeCustomer),
      list: vi
        .fn()
        .mockResolvedValue({ data: [fakeCustomer], count: 1, totalCount: 1, totalPages: 1 }),
      get: vi.fn().mockResolvedValue(fakeCustomer),
      update: vi.fn().mockResolvedValue(fakeCustomer),
      setBillingEmailOverride: vi.fn().mockResolvedValue(fakeCustomer),
      delete: vi.fn().mockResolvedValue({ removed: true }),
      ...overrides
    }
  };
}

describe('customersCreateCommand', () => {
  it('forwards required fields and only the optional ones that were set', async () => {
    const fake = makeFakeGaru();
    await customersCreateCommand({
      garu: fake as any,
      mode: 'json',
      name: 'Maria Silva',
      email: 'maria@exemplo.com.br',
      document: '12345678909',
      phone: '11987654321',
      personType: 'fisica'
    });

    expect((fake.customers.create as any).mock.calls[0][0]).toEqual({
      name: 'Maria Silva',
      email: 'maria@exemplo.com.br',
      document: '12345678909',
      phone: '11987654321',
      personType: 'fisica'
    });
  });

  it('forwards address fields when provided', async () => {
    const fake = makeFakeGaru();
    await customersCreateCommand({
      garu: fake as any,
      mode: 'json',
      name: 'Maria Silva',
      email: 'maria@exemplo.com.br',
      document: '12345678909',
      phone: '11987654321',
      personType: 'fisica',
      zipCode: '01310100',
      city: 'São Paulo',
      state: 'SP'
    });

    const params = (fake.customers.create as any).mock.calls[0][0];
    expect(params.zipCode).toBe('01310100');
    expect(params.city).toBe('São Paulo');
    expect(params.state).toBe('SP');
  });

  it('forwards an explicit idempotency key', async () => {
    const fake = makeFakeGaru();
    await customersCreateCommand({
      garu: fake as any,
      mode: 'json',
      name: 'Maria Silva',
      email: 'maria@exemplo.com.br',
      document: '12345678909',
      phone: '11987654321',
      personType: 'fisica',
      idempotencyKey: 'idem-key-1'
    });

    expect((fake.customers.create as any).mock.calls[0][0].idempotencyKey).toBe('idem-key-1');
  });
});

describe('customersListCommand', () => {
  it('passes empty params for the default list', async () => {
    const fake = makeFakeGaru();
    await customersListCommand({ garu: fake as any, mode: 'json' });
    expect((fake.customers.list as any).mock.calls[0][0]).toEqual({});
  });

  it('forwards the overdue status filter', async () => {
    const fake = makeFakeGaru();
    await customersListCommand({ garu: fake as any, mode: 'json', status: 'overdue' });
    expect((fake.customers.list as any).mock.calls[0][0]).toEqual({ status: 'overdue' });
  });

  it('renders a pretty table', async () => {
    const fake = makeFakeGaru();
    await customersListCommand({ garu: fake as any, mode: 'pretty' });
    const output = stdoutSpy.mock.calls[0][0];
    expect(output).toContain('Customers');
    expect(output).toContain(CUSTOMER_UUID);
  });
});

describe('customersGetCommand', () => {
  it('fetches the customer by uuid', async () => {
    const fake = makeFakeGaru();
    await customersGetCommand({ garu: fake as any, mode: 'json', uuid: CUSTOMER_UUID });
    expect((fake.customers.get as any).mock.calls[0][0]).toBe(CUSTOMER_UUID);
  });
});

describe('customersUpdateCommand', () => {
  it('forwards only the fields provided', async () => {
    const fake = makeFakeGaru();
    await customersUpdateCommand({
      garu: fake as any,
      mode: 'json',
      uuid: CUSTOMER_UUID,
      name: 'Maria Santos'
    });
    expect((fake.customers.update as any).mock.calls[0]).toEqual([
      CUSTOMER_UUID,
      { name: 'Maria Santos' }
    ]);
  });
});

describe('customersSetBillingEmailOverrideCommand', () => {
  it('sets the override', async () => {
    const fake = makeFakeGaru();
    await customersSetBillingEmailOverrideCommand({
      garu: fake as any,
      mode: 'json',
      uuid: CUSTOMER_UUID,
      billingEmailOverride: 'cobrancas@empresa.com.br'
    });
    expect((fake.customers.setBillingEmailOverride as any).mock.calls[0]).toEqual([
      CUSTOMER_UUID,
      { billingEmailOverride: 'cobrancas@empresa.com.br' }
    ]);
  });

  it('clears the override with null', async () => {
    const fake = makeFakeGaru();
    await customersSetBillingEmailOverrideCommand({
      garu: fake as any,
      mode: 'json',
      uuid: CUSTOMER_UUID,
      billingEmailOverride: null
    });
    expect((fake.customers.setBillingEmailOverride as any).mock.calls[0][1]).toEqual({
      billingEmailOverride: null
    });
  });
});

describe('customersDeleteCommand', () => {
  it('deletes the customer by uuid and returns the removed flag', async () => {
    const fake = makeFakeGaru();
    const result = await customersDeleteCommand({
      garu: fake as any,
      mode: 'json',
      uuid: CUSTOMER_UUID
    });
    expect((fake.customers.delete as any).mock.calls[0][0]).toBe(CUSTOMER_UUID);
    expect(result).toEqual({ removed: true });
  });
});
