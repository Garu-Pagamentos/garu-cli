import type {
  Charge,
  ChargeList,
  ChargePaymentMethod,
  ChargeStatus,
  Customer,
  Garu,
  ListChargesParams,
  RefundChargeParams
} from '@garuhq/node';

import { resolveAuth } from '../lib/auth.js';
import { createGaruClient } from '../lib/client.js';
import { CliError } from '../lib/errors.js';
import { printResult, type OutputOptions } from '../lib/output.js';
import { toChargePaymentMethod, type ChargeCreateType } from '../lib/parse.js';

export interface ChargesGlobalOptions extends OutputOptions {
  apiKey?: string;
  profile?: string;
  baseUrl?: string;
  /** Injectable for tests — bypass auth resolution + SDK construction. */
  garu?: Garu;
}

export interface ChargesCreateOptions extends ChargesGlobalOptions {
  type: ChargeCreateType;
  productId: string;
  customerName: string;
  customerEmail: string;
  customerDocument: string;
  customerPhone: string;
  cardNumber?: string;
  cardCvv?: string;
  cardExpiration?: string;
  cardHolder?: string;
  installments?: number;
  idempotencyKey?: string;
  additionalInfo?: string;
}

/** Charge IDs are public uuids (`/api/v1/charges`), not integers. */
export interface ChargesByIdOptions extends ChargesGlobalOptions {
  id: string;
}

export interface ChargesListOptions extends ChargesGlobalOptions {
  page?: number;
  limit?: number;
  status?: ChargeStatus;
  search?: string;
  paymentMethod?: ChargePaymentMethod;
}

export interface ChargesRefundOptions extends ChargesByIdOptions {
  /** Amount in decimal BRL / reais, e.g. `10.00`. Omit for a full refund. */
  amount?: number;
  reason?: string;
  idempotencyKey?: string;
}

async function getClient(opts: ChargesGlobalOptions): Promise<Garu> {
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

type ValidatedCardFields = ChargesCreateOptions & {
  cardNumber: string;
  cardCvv: string;
  cardExpiration: string;
  cardHolder: string;
};

/**
 * Assert that a credit-card charge request has every required card field.
 * Narrows the type so downstream code doesn't need `!` assertions.
 */
function assertCardFieldsPresent(opts: ChargesCreateOptions): asserts opts is ValidatedCardFields {
  const missing: string[] = [];
  if (!opts.cardNumber) missing.push('--card-number');
  if (!opts.cardCvv) missing.push('--card-cvv');
  if (!opts.cardExpiration) missing.push('--card-expiration');
  if (!opts.cardHolder) missing.push('--card-holder');
  if (missing.length) {
    throw new CliError('invalid_input', `Credit-card charges require: ${missing.join(', ')}`);
  }
}

export async function chargesCreateCommand(opts: ChargesCreateOptions): Promise<Charge> {
  const garu = await getClient(opts);

  const customer: Customer = {
    name: opts.customerName,
    email: opts.customerEmail,
    document: opts.customerDocument,
    phone: opts.customerPhone
  };

  const base = {
    productId: opts.productId,
    paymentMethod: opts.type,
    customer,
    additionalInfo: opts.additionalInfo,
    idempotencyKey: opts.idempotencyKey
  };

  let charge: Charge;
  if (opts.type === 'credit_card') {
    assertCardFieldsPresent(opts);
    charge = await garu.charges.create({
      ...base,
      paymentMethod: toChargePaymentMethod(opts.type),
      card: {
        number: opts.cardNumber,
        cvv: opts.cardCvv,
        expirationDate: opts.cardExpiration,
        holderName: opts.cardHolder,
        installments: opts.installments ?? 1
      }
    });
  } else {
    charge = await garu.charges.create({
      ...base,
      paymentMethod: toChargePaymentMethod(opts.type)
    });
  }

  printResult(charge, { ...opts, prettyPrint: prettyCharge });
  return charge;
}

export async function chargesGetCommand(opts: ChargesByIdOptions): Promise<Charge> {
  const garu = await getClient(opts);
  const charge = await garu.charges.retrieve(opts.id);
  printResult(charge, { ...opts, prettyPrint: prettyCharge });
  return charge;
}

export async function chargesRefundCommand(opts: ChargesRefundOptions): Promise<Charge> {
  const garu = await getClient(opts);
  const params: RefundChargeParams = {};
  if (opts.amount !== undefined) params.amount = opts.amount;
  if (opts.reason !== undefined) params.reason = opts.reason;
  if (opts.idempotencyKey !== undefined) params.idempotencyKey = opts.idempotencyKey;
  const charge = await garu.charges.refund(opts.id, params);
  printResult(charge, { ...opts, prettyPrint: prettyCharge });
  return charge;
}

export async function chargesListCommand(opts: ChargesListOptions): Promise<ChargeList> {
  const garu = await getClient(opts);
  const params: ListChargesParams = {};
  if (opts.page !== undefined) params.page = opts.page;
  if (opts.limit !== undefined) params.limit = opts.limit;
  if (opts.status !== undefined) params.status = opts.status;
  if (opts.search !== undefined) params.search = opts.search;
  if (opts.paymentMethod !== undefined) params.paymentMethod = opts.paymentMethod;
  const result = await garu.charges.list(params);
  printResult(result, { ...opts, prettyPrint: prettyChargeList });
  return result;
}

function prettyChargeList(list: ChargeList): string {
  if (list.data.length === 0) {
    return 'No charges found';
  }
  const header = `Charges (${list.count} of ${list.totalCount} total, ${list.totalPages} page(s))`;
  const rows = list.data.map(
    (c) =>
      `  ${c.uuid}  ${String(c.status).padEnd(14)}  ${c.paymentMethod.padEnd(10)}  ${c.createdAt}`
  );
  return [header, ...rows].join('\n');
}

function prettyCharge(charge: Charge): string {
  const lines = [
    `Charge ${charge.uuid}`,
    `  status:       ${charge.status}`,
    `  amount:       ${charge.amount}`,
    `  chargedTotal: ${charge.chargedTotal}`,
    `  method:       ${charge.paymentMethod}`,
    `  createdAt:    ${charge.createdAt}`
  ];
  if (charge.expiresAt) lines.push(`  expiresAt:    ${charge.expiresAt}`);
  if (charge.refund)
    lines.push(`  refund:       ${charge.refund.amount} (${charge.refund.reason ?? 'no reason'})`);
  return lines.join('\n');
}
