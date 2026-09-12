/* eslint-disable @typescript-eslint/no-explicit-any */
import type { Offer } from '@garuhq/node';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  offersCreateCommand,
  offersDeleteCommand,
  offersListCommand,
  offersUpdateCommand
} from '../src/commands/offers.js';
import { CliError } from '../src/lib/errors.js';

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

const PRODUCT = 'b3f2c1e8-6e4a-4b9f-9d1c-2a1f6c3d4e5f';

const fakeOffer: Offer = {
  id: 'offer_1Hv7j4EGexuTiOU5BlLNGGuL',
  productUuid: PRODUCT,
  name: 'Black Friday',
  slug: 'black-friday',
  value: 97.0,
  isActive: true,
  createdAt: '2026-09-12T14:22:01.000Z',
  updatedAt: '2026-09-12T14:22:01.000Z'
};

const stubGaru = (impl: Record<string, any>) => ({ offers: impl }) as any;

const written = () => stdoutSpy.mock.calls.map((c: any[]) => String(c[0])).join('');

describe('offers create', () => {
  it('sends the price in reais and returns the created offer', async () => {
    const create = vi.fn().mockResolvedValue(fakeOffer);

    await offersCreateCommand({
      garu: stubGaru({ create }),
      product: PRODUCT,
      name: 'Black Friday',
      value: 97.0
    });

    expect(create).toHaveBeenCalledWith(PRODUCT, { name: 'Black Friday', value: 97.0 });
  });

  it('passes --inactive through as isActive false', async () => {
    const create = vi.fn().mockResolvedValue({ ...fakeOffer, isActive: false });

    await offersCreateCommand({
      garu: stubGaru({ create }),
      product: PRODUCT,
      name: 'Rascunho',
      value: 97,
      active: false
    });

    expect(create).toHaveBeenCalledWith(PRODUCT, expect.objectContaining({ isActive: false }));
  });
});

describe('offers update', () => {
  it('refuses an empty update instead of sending a no-op PATCH', async () => {
    const update = vi.fn();

    await expect(
      offersUpdateCommand({ garu: stubGaru({ update }), id: fakeOffer.id })
    ).rejects.toBeInstanceOf(CliError);
    expect(update).not.toHaveBeenCalled();
  });

  it('sends only the fields given, so update stays a true partial', async () => {
    const update = vi.fn().mockResolvedValue({ ...fakeOffer, isActive: false });

    await offersUpdateCommand({ garu: stubGaru({ update }), id: fakeOffer.id, active: false });

    expect(update).toHaveBeenCalledWith(fakeOffer.id, { isActive: false });
  });
});

describe('offers list output', () => {
  // stdout is not a TTY under vitest, so the default mode is json (scripts) —
  // these assert the HUMAN rendering, which has to be asked for explicitly.
  const pretty = { mode: 'pretty' as const };

  it('prints the link fragment a seller actually pastes', async () => {
    const list = vi.fn().mockResolvedValue({ data: [fakeOffer], totalCount: 1, totalPages: 1 });

    await offersListCommand({ ...pretty, garu: stubGaru({ list }), product: PRODUCT });

    expect(written()).toContain('?offer=black-friday');
    expect(written()).toContain('R$');
  });

  it('falls back to the id when the offer has no slug', async () => {
    // The unguessable option. Printing the slug blindly would show "?offer=null".
    const noSlug = { ...fakeOffer, slug: null };
    const list = vi.fn().mockResolvedValue({ data: [noSlug], totalCount: 1, totalPages: 1 });

    await offersListCommand({ ...pretty, garu: stubGaru({ list }), product: PRODUCT });

    expect(written()).toContain(`?offer=${fakeOffer.id}`);
    expect(written()).not.toContain('null');
  });

  it('says so plainly when a product has no offers', async () => {
    const list = vi.fn().mockResolvedValue({ data: [], totalCount: 0, totalPages: 0 });

    await offersListCommand({ ...pretty, garu: stubGaru({ list }), product: PRODUCT });

    expect(written()).toContain('default price');
  });
});

describe('offers delete', () => {
  it('surfaces the API refusal for an offer that already sold', async () => {
    const del = vi.fn().mockRejectedValue(new Error('Esta oferta já tem vendas'));

    await expect(
      offersDeleteCommand({ garu: stubGaru({ del }), id: fakeOffer.id })
    ).rejects.toThrow(/já tem vendas/);
  });
});
