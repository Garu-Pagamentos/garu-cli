/* eslint-disable @typescript-eslint/no-explicit-any */
import type { Product } from '@garuhq/node';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { productsCreateCommand, productsUpdateCommand } from '../src/commands/products.js';

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

const fakeProduct: Product = {
  id: 456,
  uuid: 'b3f2c1e8-6e4a-4b9f-9d1c-2a1f6c3d4e5f',
  name: 'Plano Mensal',
  description: 'Acesso completo',
  image: 'https://cdn.example.com/p.png',
  value: 4990,
  sellerId: 1,
  pix: true,
  boleto: false,
  creditCard: true,
  pixAutomatic: true,
  installments: [1],
  createdAt: '2026-05-25T12:00:00Z',
  updatedAt: '2026-05-25T12:00:00Z'
} as unknown as Product;

function makeFakeGaru(overrides: Record<string, unknown> = {}) {
  return {
    products: {
      create: vi.fn().mockResolvedValue(fakeProduct),
      update: vi.fn().mockResolvedValue(fakeProduct),
      ...overrides
    }
  };
}

describe('productsCreateCommand', () => {
  it('forwards name plus only the write fields that were set', async () => {
    const fake = makeFakeGaru();
    await productsCreateCommand({
      garu: fake as any,
      mode: 'json',
      name: 'Plano Mensal',
      value: 4990,
      pix: true,
      creditCard: true,
      pixAutomatic: true,
      isSubscription: true,
      subscriptionType: 'monthly'
    });

    expect((fake.products.create as any).mock.calls[0][0]).toEqual({
      name: 'Plano Mensal',
      value: 4990,
      pix: true,
      creditCard: true,
      pixAutomatic: true,
      isSubscription: true,
      subscriptionType: 'monthly'
    });
  });

  it('passes pixAutomatic:false through when the flag is negated', async () => {
    const fake = makeFakeGaru();
    await productsCreateCommand({
      garu: fake as any,
      mode: 'json',
      name: 'Plano',
      pixAutomatic: false
    });
    expect((fake.products.create as any).mock.calls[0][0].pixAutomatic).toBe(false);
  });

  it('renders the product with its enabled methods in pretty mode', async () => {
    const fake = makeFakeGaru();
    await productsCreateCommand({ garu: fake as any, mode: 'pretty', name: 'Plano Mensal' });
    const output = stdoutSpy.mock.calls.map((c: any) => c[0]).join('');
    expect(output).toContain('Plano Mensal');
    expect(output).toContain('pix_automatic');
  });
});

describe('productsUpdateCommand', () => {
  it('sends the id and only the changed fields as a partial patch', async () => {
    const fake = makeFakeGaru();
    await productsUpdateCommand({
      garu: fake as any,
      mode: 'json',
      id: 'b3f2c1e8-6e4a-4b9f-9d1c-2a1f6c3d4e5f',
      pixAutomatic: true,
      value: 5990
    });

    expect((fake.products.update as any).mock.calls[0]).toEqual([
      'b3f2c1e8-6e4a-4b9f-9d1c-2a1f6c3d4e5f',
      { pixAutomatic: true, value: 5990 }
    ]);
  });

  it('accepts a numeric id', async () => {
    const fake = makeFakeGaru();
    await productsUpdateCommand({ garu: fake as any, mode: 'json', id: 456, pixAutomatic: false });
    expect((fake.products.update as any).mock.calls[0][0]).toBe(456);
  });

  it('rejects an update with no fields before any SDK call', async () => {
    const fake = makeFakeGaru();
    await expect(
      productsUpdateCommand({ garu: fake as any, mode: 'json', id: 456 })
    ).rejects.toThrowError(/Nothing to update/);
    expect((fake.products.update as any).mock.calls.length).toBe(0);
  });
});
