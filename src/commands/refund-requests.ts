import type {
  Garu,
  ListRefundRequestsParams,
  RefundRequest,
  RefundRequestList,
  RefundRequestStatus,
  ResolveRefundRequestParams
} from '@garuhq/node';

import { resolveAuth } from '../lib/auth.js';
import { createGaruClient } from '../lib/client.js';
import { printResult, type OutputOptions } from '../lib/output.js';

export type RefundRequestsGlobalOptions = OutputOptions & {
  apiKey?: string;
  profile?: string;
  baseUrl?: string;
  /** Injectable for tests — bypass auth resolution + SDK construction. */
  garu?: Garu;
};

export type RefundRequestsByUuidOptions = RefundRequestsGlobalOptions & {
  uuid: string;
};

export type RefundRequestsListOptions = RefundRequestsGlobalOptions & {
  page?: number;
  limit?: number;
  status?: RefundRequestStatus[];
  planId?: string;
  chargeId?: string;
};

export type RefundRequestsResolveOptions = RefundRequestsByUuidOptions & {
  note?: string;
};

async function getClient(opts: RefundRequestsGlobalOptions): Promise<Garu> {
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

export async function refundRequestsListCommand(
  opts: RefundRequestsListOptions
): Promise<RefundRequestList> {
  const garu = await getClient(opts);
  const params: ListRefundRequestsParams = {};
  if (opts.page !== undefined) params.page = opts.page;
  if (opts.limit !== undefined) params.limit = opts.limit;
  if (opts.planId !== undefined) params.planId = opts.planId;
  if (opts.chargeId !== undefined) params.chargeId = opts.chargeId;
  if (opts.status !== undefined && opts.status.length > 0) {
    params.status = opts.status.length === 1 ? opts.status[0]! : opts.status;
  }
  const result = await garu.refundRequests.list(params);
  printResult(result, { ...opts, prettyPrint: prettyRefundRequestList });
  return result;
}

export async function refundRequestsGetCommand(
  opts: RefundRequestsByUuidOptions
): Promise<RefundRequest> {
  const garu = await getClient(opts);
  const request = await garu.refundRequests.get(opts.uuid);
  printResult(request, { ...opts, prettyPrint: prettyRefundRequest });
  return request;
}

export async function refundRequestsConfirmCommand(
  opts: RefundRequestsResolveOptions
): Promise<RefundRequest> {
  const garu = await getClient(opts);
  const params: ResolveRefundRequestParams = {};
  if (opts.note !== undefined) params.note = opts.note;
  const request = await garu.refundRequests.confirm(opts.uuid, params);
  printResult(request, { ...opts, prettyPrint: prettyRefundRequest });
  return request;
}

export async function refundRequestsRejectCommand(
  opts: RefundRequestsResolveOptions
): Promise<RefundRequest> {
  const garu = await getClient(opts);
  const params: ResolveRefundRequestParams = {};
  if (opts.note !== undefined) params.note = opts.note;
  const request = await garu.refundRequests.reject(opts.uuid, params);
  printResult(request, { ...opts, prettyPrint: prettyRefundRequest });
  return request;
}

function prettyRefundRequestList(list: RefundRequestList): string {
  if (list.data.length === 0) return 'No refund requests found';
  const header = `Refund requests (${list.count} of ${list.totalCount} total, ${list.totalPages} page(s))`;
  const rows = list.data.map(
    (r) =>
      `  ${r.uuid}  ${r.status.padEnd(10)}  ${String(r.amount).padStart(10)}  ${r.installmentPlanId ?? r.chargeId ?? ''}`
  );
  return [header, ...rows].join('\n');
}

function prettyRefundRequest(r: RefundRequest): string {
  const lines = [`Refund request ${r.uuid}`, `  status: ${r.status}`, `  amount: ${r.amount}`];
  if (r.reason) lines.push(`  reason: ${r.reason}`);
  if (r.installmentPlanId) lines.push(`  installmentPlan: ${r.installmentPlanId}`);
  if (r.chargeId) lines.push(`  charge: ${r.chargeId}`);
  if (r.resolvedAt) lines.push(`  resolvedAt: ${r.resolvedAt}`);
  if (r.sellerNote) lines.push(`  sellerNote: ${r.sellerNote}`);
  return lines.join('\n');
}
