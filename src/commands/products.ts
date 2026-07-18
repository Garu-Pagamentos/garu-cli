import type { CreateProductParams, Garu, Product, UpdateProductParams } from '@garuhq/node';

import { resolveAuth } from '../lib/auth.js';
import { createGaruClient } from '../lib/client.js';
import { CliError } from '../lib/errors.js';
import { printResult, printSuccess, type OutputOptions } from '../lib/output.js';

export type ProductsGlobalOptions = OutputOptions & {
  apiKey?: string;
  profile?: string;
  baseUrl?: string;
  /** Injectable for tests — bypass auth resolution + SDK construction. */
  garu?: Garu;
};

/** Write fields shared by create and update. */
export type ProductWriteOptions = ProductsGlobalOptions & {
  name?: string;
  /** Price in decimal BRL / reais (e.g. `49.90`) — NOT centavos. Matches the API and `Product.value`. */
  value?: number;
  description?: string;
  image?: string;
  tags?: string[];
  pix?: boolean;
  boleto?: boolean;
  creditCard?: boolean;
  pixAutomatic?: boolean;
  installments?: number;
  isSubscription?: boolean;
  subscriptionType?: string;
  unitLabel?: string;
  returnUrl?: string;
  returnUrlButtonText?: string;
};

export type ProductsCreateOptions = ProductWriteOptions & { name: string };
/** `id` accepts the numeric id or the product UUID (same as `products.update`). */
export type ProductsUpdateOptions = ProductWriteOptions & { id: string | number };

async function getClient(opts: ProductsGlobalOptions): Promise<Garu> {
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

/** Collect only the write fields the caller actually set, so update stays a true partial. */
function buildProductBody(opts: ProductWriteOptions): UpdateProductParams {
  const body: UpdateProductParams = {};
  if (opts.name !== undefined) body.name = opts.name;
  if (opts.value !== undefined) body.value = opts.value;
  if (opts.description !== undefined) body.description = opts.description;
  if (opts.image !== undefined) body.image = opts.image;
  if (opts.tags !== undefined) body.tags = opts.tags;
  if (opts.pix !== undefined) body.pix = opts.pix;
  if (opts.boleto !== undefined) body.boleto = opts.boleto;
  if (opts.creditCard !== undefined) body.creditCard = opts.creditCard;
  if (opts.pixAutomatic !== undefined) body.pixAutomatic = opts.pixAutomatic;
  if (opts.installments !== undefined) body.installments = opts.installments;
  if (opts.isSubscription !== undefined) body.isSubscription = opts.isSubscription;
  if (opts.subscriptionType !== undefined) body.subscriptionType = opts.subscriptionType;
  if (opts.unitLabel !== undefined) body.unitLabel = opts.unitLabel;
  if (opts.returnUrl !== undefined) body.returnUrl = opts.returnUrl;
  if (opts.returnUrlButtonText !== undefined) body.returnUrlButtonText = opts.returnUrlButtonText;
  return body;
}

export async function productsCreateCommand(opts: ProductsCreateOptions): Promise<Product> {
  const garu = await getClient(opts);
  const params: CreateProductParams = { ...buildProductBody(opts), name: opts.name };
  const product = await garu.products.create(params);
  printSuccess(`Created product ${product.uuid ?? product.id}`, opts);
  printResult(product, { ...opts, prettyPrint: prettyProduct });
  return product;
}

export async function productsUpdateCommand(opts: ProductsUpdateOptions): Promise<Product> {
  const body = buildProductBody(opts);
  if (Object.keys(body).length === 0) {
    throw new CliError('invalid_input', 'Nothing to update — pass at least one field to change.');
  }
  const garu = await getClient(opts);
  const product = await garu.products.update(opts.id, body);
  printSuccess(`Updated product ${product.uuid ?? product.id}`, opts);
  printResult(product, { ...opts, prettyPrint: prettyProduct });
  return product;
}

function prettyProduct(p: Product): string {
  const methods = [
    p.pix ? 'pix' : null,
    p.boleto ? 'boleto' : null,
    p.creditCard ? 'card' : null,
    p.pixAutomatic ? 'pix_automatic' : null
  ]
    .filter(Boolean)
    .join(', ');
  const lines = [
    `Product ${p.uuid ?? p.id}`,
    `  name:    ${p.name}`,
    `  value:   ${p.value} (reais)`,
    `  methods: ${methods || '(none)'}`
  ];
  if (p.description) lines.push(`  description: ${p.description}`);
  return lines.join('\n');
}
