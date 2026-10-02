import type { CreateOfferParams, Garu, Offer, UpdateOfferParams } from '@garuhq/node';

import { resolveAuth } from '../lib/auth.js';
import { createGaruClient } from '../lib/client.js';
import { CliError } from '../lib/errors.js';
import { printResult, printSuccess, type OutputOptions } from '../lib/output.js';

export type OffersGlobalOptions = OutputOptions & {
  apiKey?: string;
  profile?: string;
  baseUrl?: string;
  /** Injectable for tests — bypass auth resolution + SDK construction. */
  garu?: Garu;
};

export type OffersListOptions = OffersGlobalOptions & {
  product: string;
  active?: 'true' | 'false' | 'all';
  page?: number;
  limit?: number;
};

/** Write fields shared by create and update. */
export type OfferWriteOptions = OffersGlobalOptions & {
  name?: string;
  /**
   * Price in decimal BRL / reais (e.g. `97.00`) — NOT centavos, same unit as `Product.value`.
   * At least R$ 5,00; the API answers 400 otherwise, `0` included.
   */
  value?: number;
  slug?: string | null;
  active?: boolean;
};

export type OffersCreateOptions = OfferWriteOptions & {
  product: string;
  name: string;
  value: number;
};
export type OffersUpdateOptions = OfferWriteOptions & { id: string };
export type OffersGetOptions = OffersGlobalOptions & { id: string };

async function getClient(opts: OffersGlobalOptions): Promise<Garu> {
  if (opts.garu) return opts.garu;
  const auth = await resolveAuth({
    ...(opts.apiKey !== undefined ? { apiKey: opts.apiKey } : {}),
    ...(opts.profile !== undefined ? { profile: opts.profile } : {})
  });
  return createGaruClient({
    auth,
    ...(opts.baseUrl !== undefined ? { baseUrl: opts.baseUrl } : {})
  });
}

/** Collect only the fields the caller actually set, so update stays a true partial. */
function buildOfferBody(opts: OfferWriteOptions): UpdateOfferParams {
  const body: UpdateOfferParams = {};
  if (opts.name !== undefined) body.name = opts.name;
  if (opts.value !== undefined) body.value = opts.value;
  if (opts.slug !== undefined) body.slug = opts.slug;
  if (opts.active !== undefined) body.isActive = opts.active;
  return body;
}

export async function offersListCommand(opts: OffersListOptions): Promise<Offer[]> {
  const garu = await getClient(opts);
  const result = await garu.offers.list(opts.product, {
    ...(opts.active !== undefined ? { active: opts.active } : {}),
    ...(opts.page !== undefined ? { page: opts.page } : {}),
    ...(opts.limit !== undefined ? { limit: opts.limit } : {})
  });
  printResult(result.data, { ...opts, prettyPrint: prettyOfferList });
  return result.data;
}

export async function offersGetCommand(opts: OffersGetOptions): Promise<Offer> {
  const garu = await getClient(opts);
  const offer = await garu.offers.get(opts.id);
  printResult(offer, { ...opts, prettyPrint: prettyOffer });
  return offer;
}

export async function offersCreateCommand(opts: OffersCreateOptions): Promise<Offer> {
  const garu = await getClient(opts);
  const params: CreateOfferParams = {
    ...buildOfferBody(opts),
    name: opts.name,
    value: opts.value
  };
  const offer = await garu.offers.create(opts.product, params);
  printSuccess(`Created offer ${offer.id}`, opts);
  printResult(offer, { ...opts, prettyPrint: prettyOffer });
  return offer;
}

export async function offersUpdateCommand(opts: OffersUpdateOptions): Promise<Offer> {
  const body = buildOfferBody(opts);
  if (Object.keys(body).length === 0) {
    throw new CliError('invalid_input', 'Nothing to update — pass at least one field to change.');
  }
  const garu = await getClient(opts);
  const offer = await garu.offers.update(opts.id, body);
  printSuccess(`Updated offer ${offer.id}`, opts);
  printResult(offer, { ...opts, prettyPrint: prettyOffer });
  return offer;
}

export async function offersDeleteCommand(opts: OffersGetOptions): Promise<void> {
  const garu = await getClient(opts);
  await garu.offers.del(opts.id);
  printSuccess(`Deleted offer ${opts.id}`, opts);
}

const brl = (v: number) =>
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v);

/** The link fragment a seller actually pastes: slug when set, id otherwise. */
const linkParam = (o: Offer) => `?offer=${o.slug ?? o.id}`;

function prettyOffer(o: Offer): string {
  return [
    `${o.name}  ${brl(o.value)}  ${o.isActive ? 'ativa' : 'inativa'}`,
    `  id    ${o.id}`,
    `  link  /pay/${o.productUuid}${linkParam(o)}`
  ].join('\n');
}

function prettyOfferList(offers: Offer[]): string {
  if (offers.length === 0) return 'No offers — this product sells at its default price.';
  return offers
    .map(
      (o) =>
        `${o.isActive ? '●' : '○'} ${o.name.padEnd(24)} ${brl(o.value).padStart(12)}  ${linkParam(o)}`
    )
    .join('\n');
}
