import type {
  CreateCustomerParams,
  CustomerList,
  CustomerRecord,
  Garu,
  ListCustomersParams,
  SetBillingEmailOverrideParams,
  UpdateCustomerParams
} from '@garuhq/node';

import { resolveAuth } from '../lib/auth.js';
import { createGaruClient } from '../lib/client.js';
import { printResult, type OutputOptions } from '../lib/output.js';
import type { PersonType } from '../lib/parse.js';

export type CustomersGlobalOptions = OutputOptions & {
  apiKey?: string;
  profile?: string;
  baseUrl?: string;
  /** Injectable for tests — bypass auth resolution + SDK construction. */
  garu?: Garu;
};

/** Customer IDs are public uuids. */
export type CustomersByUuidOptions = CustomersGlobalOptions & {
  uuid: string;
};

export type CustomersCreateOptions = CustomersGlobalOptions & {
  name: string;
  email: string;
  document: string;
  phone: string;
  personType: PersonType;
  zipCode?: string;
  street?: string;
  number?: string;
  complement?: string;
  neighborhood?: string;
  city?: string;
  state?: string;
  idempotencyKey?: string;
};

export type CustomersUpdateOptions = CustomersByUuidOptions & {
  name?: string;
  email?: string;
  phone?: string;
  document?: string;
  personType?: PersonType;
  zipCode?: string;
  street?: string;
  number?: string;
  complement?: string;
  neighborhood?: string;
  city?: string;
  state?: string;
};

export type CustomersListOptions = CustomersGlobalOptions & {
  page?: number;
  limit?: number;
  search?: string;
  status?: 'overdue';
};

export type CustomersSetBillingEmailOverrideOptions = CustomersByUuidOptions & {
  /** Pass null (via --clear) to remove the override. */
  billingEmailOverride: string | null;
};

async function getClient(opts: CustomersGlobalOptions): Promise<Garu> {
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

export async function customersCreateCommand(
  opts: CustomersCreateOptions
): Promise<CustomerRecord> {
  const garu = await getClient(opts);
  const params: CreateCustomerParams = {
    name: opts.name,
    email: opts.email,
    document: opts.document,
    phone: opts.phone,
    personType: opts.personType
  };
  if (opts.zipCode !== undefined) params.zipCode = opts.zipCode;
  if (opts.street !== undefined) params.street = opts.street;
  if (opts.number !== undefined) params.number = opts.number;
  if (opts.complement !== undefined) params.complement = opts.complement;
  if (opts.neighborhood !== undefined) params.neighborhood = opts.neighborhood;
  if (opts.city !== undefined) params.city = opts.city;
  if (opts.state !== undefined) params.state = opts.state;
  if (opts.idempotencyKey !== undefined) params.idempotencyKey = opts.idempotencyKey;

  const customer = await garu.customers.create(params);
  printResult(customer, { ...opts, prettyPrint: prettyCustomer });
  return customer;
}

export async function customersListCommand(opts: CustomersListOptions): Promise<CustomerList> {
  const garu = await getClient(opts);
  const params: ListCustomersParams = {};
  if (opts.page !== undefined) params.page = opts.page;
  if (opts.limit !== undefined) params.limit = opts.limit;
  if (opts.search !== undefined) params.search = opts.search;
  if (opts.status !== undefined) params.status = opts.status;
  const result = await garu.customers.list(params);
  printResult(result, { ...opts, prettyPrint: prettyCustomerList });
  return result;
}

export async function customersGetCommand(opts: CustomersByUuidOptions): Promise<CustomerRecord> {
  const garu = await getClient(opts);
  const customer = await garu.customers.get(opts.uuid);
  printResult(customer, { ...opts, prettyPrint: prettyCustomer });
  return customer;
}

export async function customersUpdateCommand(
  opts: CustomersUpdateOptions
): Promise<CustomerRecord> {
  const garu = await getClient(opts);
  const params: UpdateCustomerParams = {};
  if (opts.name !== undefined) params.name = opts.name;
  if (opts.email !== undefined) params.email = opts.email;
  if (opts.phone !== undefined) params.phone = opts.phone;
  if (opts.document !== undefined) params.document = opts.document;
  if (opts.personType !== undefined) params.personType = opts.personType;
  if (opts.zipCode !== undefined) params.zipCode = opts.zipCode;
  if (opts.street !== undefined) params.street = opts.street;
  if (opts.number !== undefined) params.number = opts.number;
  if (opts.complement !== undefined) params.complement = opts.complement;
  if (opts.neighborhood !== undefined) params.neighborhood = opts.neighborhood;
  if (opts.city !== undefined) params.city = opts.city;
  if (opts.state !== undefined) params.state = opts.state;

  const customer = await garu.customers.update(opts.uuid, params);
  printResult(customer, { ...opts, prettyPrint: prettyCustomer });
  return customer;
}

export async function customersSetBillingEmailOverrideCommand(
  opts: CustomersSetBillingEmailOverrideOptions
): Promise<CustomerRecord> {
  const garu = await getClient(opts);
  const params: SetBillingEmailOverrideParams = {
    billingEmailOverride: opts.billingEmailOverride
  };
  const customer = await garu.customers.setBillingEmailOverride(opts.uuid, params);
  printResult(customer, { ...opts, prettyPrint: prettyCustomer });
  return customer;
}

export async function customersDeleteCommand(
  opts: CustomersByUuidOptions
): Promise<{ removed: boolean }> {
  const garu = await getClient(opts);
  const result = await garu.customers.delete(opts.uuid);
  printResult(result, { ...opts });
  return result;
}

function prettyCustomerList(list: CustomerList): string {
  if (list.data.length === 0) return 'No customers found';
  const header = `Customers (${list.count} of ${list.totalCount} total, ${list.totalPages} page(s))`;
  const rows = list.data.map((c) => `  ${c.uuid}  ${c.name.padEnd(30)}  ${c.email}`);
  return [header, ...rows].join('\n');
}

function prettyCustomer(c: CustomerRecord): string {
  const lines = [
    `Customer ${c.uuid}`,
    `  name:         ${c.name}`,
    `  email:        ${c.email}`,
    `  phone:        ${c.phone}`,
    `  document:     ${c.document}`,
    `  personType:   ${c.personType}`,
    `  billingEmail: ${c.billingEmail}${c.hasBillingEmailOverride ? ' (override)' : ''}`
  ];
  return lines.join('\n');
}
