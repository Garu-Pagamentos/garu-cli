import type { Charge, Customer, Garu, PaymentMethod, RefundChargeParams } from '@garuhq/node';

import { resolveAuth } from '../lib/auth.js';
import { createGaruClient } from '../lib/client.js';
import { CliError } from '../lib/errors.js';
import { printResult, type OutputOptions } from '../lib/output.js';

export interface ChargesGlobalOptions extends OutputOptions {
  apiKey?: string;
  profile?: string;
  baseUrl?: string;
  /** Injectable for tests — bypass auth resolution + SDK construction. */
  garu?: Garu;
}

export interface ChargesCreateOptions extends ChargesGlobalOptions {
  type: PaymentMethod;
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

export interface ChargesByIdOptions extends ChargesGlobalOptions {
  id: number;
}

export interface ChargesRefundOptions extends ChargesByIdOptions {
  /** Amount in centavos. Omit for full refund. */
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
      cardInfo: {
        cardNumber: opts.cardNumber,
        cvv: opts.cardCvv,
        expirationDate: opts.cardExpiration,
        holderName: opts.cardHolder,
        installments: opts.installments ?? 1
      }
    });
  } else {
    charge = await garu.charges.create(base);
  }

  printResult(charge, { ...opts, prettyPrint: prettyCharge });
  return charge;
}

export async function chargesGetCommand(opts: ChargesByIdOptions): Promise<Charge> {
  const garu = await getClient(opts);
  const charge = await garu.charges.get(opts.id);
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

function prettyCharge(charge: Charge): string {
  const lines = [
    `Charge ${charge.id}`,
    `  status:  ${charge.status}`,
    `  amount:  ${charge.amount}`,
    `  method:  ${charge.paymentMethodId}`,
    `  date:    ${charge.date}`
  ];
  if (charge.deadline) lines.push(`  deadline: ${charge.deadline}`);
  return lines.join('\n');
}
