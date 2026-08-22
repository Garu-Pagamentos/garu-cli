import type {
  CancelInstallmentPlanParams,
  CreateInstallmentPlanParams,
  Garu,
  Installment,
  InstallmentPlan,
  InstallmentPlanList,
  InstallmentPlanStatus,
  ListInstallmentPlansParams,
  PostponeInstallmentParams,
  RefundRequest,
  ReissueInstallmentResult,
  RequestPlanRefundParams
} from '@garuhq/node';

import { resolveAuth } from '../lib/auth.js';
import { createGaruClient } from '../lib/client.js';
import { printResult, type OutputOptions } from '../lib/output.js';

export type InstallmentPlansGlobalOptions = OutputOptions & {
  apiKey?: string;
  profile?: string;
  baseUrl?: string;
  /** Injectable for tests — bypass auth resolution + SDK construction. */
  garu?: Garu;
};

/** Installment-plan IDs are public uuids. */
export type InstallmentPlansByUuidOptions = InstallmentPlansGlobalOptions & {
  uuid: string;
};

export type InstallmentPlansByInstallmentOptions = InstallmentPlansByUuidOptions & {
  number: number;
};

export type InstallmentPlansCreateOptions = InstallmentPlansGlobalOptions & {
  productId: string;
  customerId: number;
  installments: number;
  firstDueDate?: string;
  affiliateId?: number;
  idempotencyKey?: string;
};

export type InstallmentPlansListOptions = InstallmentPlansGlobalOptions & {
  page?: number;
  limit?: number;
  status?: InstallmentPlanStatus[];
  customerId?: number;
  productId?: string;
  dueFrom?: string;
  dueTo?: string;
};

export type InstallmentPlansPostponeOptions = InstallmentPlansByInstallmentOptions & {
  newDueDate: string;
};

export type InstallmentPlansCancelOptions = InstallmentPlansByUuidOptions & {
  note?: string;
};

export type InstallmentPlansRequestRefundOptions = InstallmentPlansByUuidOptions & {
  amount?: number;
  reason?: string;
};

async function getClient(opts: InstallmentPlansGlobalOptions): Promise<Garu> {
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

export async function installmentPlansCreateCommand(
  opts: InstallmentPlansCreateOptions
): Promise<InstallmentPlan> {
  const garu = await getClient(opts);
  const params: CreateInstallmentPlanParams = {
    productId: opts.productId,
    customerId: opts.customerId,
    installments: opts.installments
  };
  if (opts.firstDueDate !== undefined) params.firstDueDate = opts.firstDueDate;
  if (opts.affiliateId !== undefined) params.affiliateId = opts.affiliateId;
  if (opts.idempotencyKey !== undefined) params.idempotencyKey = opts.idempotencyKey;

  const plan = await garu.installmentPlans.create(params);
  printResult(plan, { ...opts, prettyPrint: prettyInstallmentPlan });
  return plan;
}

export async function installmentPlansListCommand(
  opts: InstallmentPlansListOptions
): Promise<InstallmentPlanList> {
  const garu = await getClient(opts);
  const params: ListInstallmentPlansParams = {};
  if (opts.page !== undefined) params.page = opts.page;
  if (opts.limit !== undefined) params.limit = opts.limit;
  if (opts.customerId !== undefined) params.customerId = opts.customerId;
  if (opts.productId !== undefined) params.productId = opts.productId;
  if (opts.dueFrom !== undefined) params.dueFrom = opts.dueFrom;
  if (opts.dueTo !== undefined) params.dueTo = opts.dueTo;
  if (opts.status !== undefined && opts.status.length > 0) {
    params.status = opts.status.length === 1 ? opts.status[0]! : opts.status;
  }
  const result = await garu.installmentPlans.list(params);
  printResult(result, { ...opts, prettyPrint: prettyInstallmentPlanList });
  return result;
}

export async function installmentPlansGetCommand(
  opts: InstallmentPlansByUuidOptions
): Promise<InstallmentPlan> {
  const garu = await getClient(opts);
  const plan = await garu.installmentPlans.get(opts.uuid);
  printResult(plan, { ...opts, prettyPrint: prettyInstallmentPlanDetail });
  return plan;
}

export async function installmentPlansReissueCommand(
  opts: InstallmentPlansByInstallmentOptions
): Promise<ReissueInstallmentResult> {
  const garu = await getClient(opts);
  const result = await garu.installmentPlans.reissueInstallment(opts.uuid, opts.number);
  printResult(result, { ...opts, prettyPrint: prettyReissueResult });
  return result;
}

export async function installmentPlansPostponeCommand(
  opts: InstallmentPlansPostponeOptions
): Promise<Installment> {
  const garu = await getClient(opts);
  const params: PostponeInstallmentParams = { newDueDate: opts.newDueDate };
  const installment = await garu.installmentPlans.postponeInstallment(
    opts.uuid,
    opts.number,
    params
  );
  printResult(installment, { ...opts, prettyPrint: prettyInstallment });
  return installment;
}

export async function installmentPlansMarkPaidCommand(
  opts: InstallmentPlansByInstallmentOptions
): Promise<Installment> {
  const garu = await getClient(opts);
  const installment = await garu.installmentPlans.markInstallmentPaid(opts.uuid, opts.number);
  printResult(installment, { ...opts, prettyPrint: prettyInstallment });
  return installment;
}

export async function installmentPlansCancelCommand(
  opts: InstallmentPlansCancelOptions
): Promise<InstallmentPlan> {
  const garu = await getClient(opts);
  const params: CancelInstallmentPlanParams = {};
  if (opts.note !== undefined) params.note = opts.note;
  const plan = await garu.installmentPlans.cancel(opts.uuid, params);
  printResult(plan, { ...opts, prettyPrint: prettyInstallmentPlan });
  return plan;
}

export async function installmentPlansRequestRefundCommand(
  opts: InstallmentPlansRequestRefundOptions
): Promise<RefundRequest> {
  const garu = await getClient(opts);
  const params: RequestPlanRefundParams = {};
  if (opts.amount !== undefined) params.amount = opts.amount;
  if (opts.reason !== undefined) params.reason = opts.reason;
  const request = await garu.installmentPlans.requestRefund(opts.uuid, params);
  printResult(request, { ...opts, prettyPrint: prettyRefundRequest });
  return request;
}

function prettyInstallmentPlan(p: InstallmentPlan): string {
  const lines = [
    `Installment plan ${p.uuid}`,
    `  status:            ${p.status}`,
    `  installments:      ${p.installmentsPaid}/${p.installments} paid`,
    `  baseValue:         ${p.baseValue}`,
    `  installmentAmount: ${p.installmentAmount}`,
    `  totalScheduled:    ${p.totalScheduled}`,
    `  totalCollected:    ${p.totalCollected}`,
    `  firstDueDate:      ${p.firstDueDate}`
  ];
  if (p.product) lines.push(`  product:           ${p.product.name} (${p.product.uuid})`);
  if (p.customer) lines.push(`  customer:          ${p.customer.name} <${p.customer.email}>`);
  return lines.join('\n');
}

function prettyInstallmentPlanDetail(p: InstallmentPlan): string {
  const lines = [prettyInstallmentPlan(p)];
  if (p.installmentsDetail && p.installmentsDetail.length > 0) {
    lines.push('  installments:');
    for (const i of p.installmentsDetail) {
      lines.push(
        `    #${i.number}  ${i.status.padEnd(10)}  ${String(i.amount).padStart(10)}  due ${i.dueDate}${i.paidAt ? `  paid ${i.paidAt}` : ''}`
      );
    }
  }
  return lines.join('\n');
}

function prettyInstallmentPlanList(list: InstallmentPlanList): string {
  if (list.data.length === 0) return 'No installment plans found';
  const header = `Installment plans (${list.count} of ${list.totalCount} total, ${list.totalPages} page(s))`;
  const rows = list.data.map(
    (p) =>
      `  ${p.uuid}  ${p.status.padEnd(18)}  ${p.installmentsPaid}/${p.installments} paid  ${p.firstDueDate}`
  );
  return [header, ...rows].join('\n');
}

function prettyInstallment(i: Installment): string {
  const lines = [
    `Installment #${i.number}`,
    `  status:  ${i.status}`,
    `  amount:  ${i.amount}`,
    `  dueDate: ${i.dueDate}`
  ];
  if (i.paidAt) lines.push(`  paidAt:  ${i.paidAt}`);
  if (i.boleto) lines.push(`  boleto:  ${i.boleto.barcodeLine}`);
  return lines.join('\n');
}

function prettyReissueResult(result: ReissueInstallmentResult): string {
  const lines = [`Reissue: ${result.status}`];
  if (result.reason) lines.push(`  reason: ${result.reason}`);
  if (result.installment) lines.push(prettyInstallment(result.installment));
  return lines.join('\n');
}

function prettyRefundRequest(r: RefundRequest): string {
  const lines = [`Refund request ${r.uuid}`, `  status: ${r.status}`, `  amount: ${r.amount}`];
  if (r.reason) lines.push(`  reason: ${r.reason}`);
  return lines.join('\n');
}
