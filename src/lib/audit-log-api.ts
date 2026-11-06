import { supabase } from '@/lib/supabase';
import type { AuditLogEntry } from '@/types/audit';

export const AUDIT_ACTIONS = [
  'delivery.recorded',
  'delivery.voided',
  'delivery.deleted',
  'delivery.edited',
  'payment.recorded',
  'payment.voided',
  'payment.deleted',
  'payment.edited',
  'shop.created',
  'shop.updated',
  'shop.deactivated',
  'shop.reactivated',
  'shop.deleted',
  'product.created',
  'product.updated',
  'product.deleted',
  'member.joined',
  'member.removed',
  'member.role_changed',
  'role.permissions_updated',
  'rider.joined',
  'rider.removed',
  'rider_assignment.created',
  'rider_assignment.updated',
  'business_settings.updated',
  'business.ownership_transferred',
  'business.deleted',
  'shops.imported',
  'stock_purchase.edited',
  'stock_purchase.deleted',
  'expense.edited',
  'expense.deleted',
  'stock_purchase.paid',
  'money.recorded',
  'money.deleted',
  'money.opening_balance_set',
  'product_purchase.recorded',
  'product_purchase.deleted',
  'product_purchase.paid',
  'stock.written_off',
] as const;

export const AUDIT_FILTER_GROUPS: { label: string; actions: string[] }[] = [
  {
    label: 'Deliveries',
    actions: ['delivery.recorded', 'delivery.voided', 'delivery.deleted', 'delivery.edited'],
  },
  {
    label: 'Payments',
    actions: ['payment.recorded', 'payment.voided', 'payment.deleted', 'payment.edited'],
  },
  {
    label: 'Shops',
    actions: [
      'shop.created',
      'shop.updated',
      'shop.deactivated',
      'shop.reactivated',
      'shop.deleted',
      'shops.imported',
    ],
  },
  { label: 'Products', actions: ['product.created', 'product.updated', 'product.deleted'] },
  {
    label: 'Purchases',
    actions: [
      'stock_purchase.edited',
      'stock_purchase.deleted',
      'product_purchase.recorded',
      'product_purchase.deleted',
      'stock.written_off',
    ],
  },
  { label: 'Expenses', actions: ['expense.edited', 'expense.deleted'] },
  { label: 'Money', actions: ['stock_purchase.paid', 'product_purchase.paid', 'money.recorded', 'money.deleted', 'money.opening_balance_set'] },
  { label: 'Members', actions: ['member.joined', 'member.removed', 'member.role_changed', 'role.permissions_updated'] },
  {
    label: 'Riders',
    actions: [
      'rider.joined',
      'rider.removed',
      'rider_assignment.created',
      'rider_assignment.updated',
    ],
  },
  { label: 'Settings', actions: ['business_settings.updated'] },
  {
    label: 'Business',
    actions: ['business.ownership_transferred', 'business.deleted'],
  },
];

export function formatAuditAction(action: string): string {
  const [subject, verb] = action.split('.');
  if (!verb) return action;
  const subjectLabel = subject.replace(/_/g, ' ');
  const verbLabel = verb.replace(/_/g, ' ');
  return `${subjectLabel.charAt(0).toUpperCase()}${subjectLabel.slice(1)} ${verbLabel}`;
}

export interface AuditLogFilter {
  startDate: string;
  endDate: string;
  actions?: string[];
}

export const AUDIT_LOG_PAGE_SIZE = 50;

export interface AuditLogPage {
  entries: AuditLogEntry[];
  hasMore: boolean;
}

// page is 0-indexed. Fetches one row past the page size to detect whether
// another page exists, rather than inferring it from "got a full page" —
// that heuristic would make the last page's "Load more" button do nothing
// once, which reads as broken.
export async function listAuditLog(
  businessId: string,
  filter: AuditLogFilter,
  page = 0
): Promise<AuditLogPage> {
  const from = page * AUDIT_LOG_PAGE_SIZE;
  const to = from + AUDIT_LOG_PAGE_SIZE;

  let query = supabase
    .from('audit_log')
    .select(
      'id, actor_type, actor_label, action, target_type, target_id, target_label, metadata, created_at'
    )
    .eq('business_id', businessId)
    .gte('created_at', `${filter.startDate}T00:00:00.000Z`)
    .lte('created_at', `${filter.endDate}T23:59:59.999Z`)
    .order('created_at', { ascending: false })
    .range(from, to);

  if (filter.actions && filter.actions.length > 0) {
    query = query.in('action', filter.actions);
  }

  const { data, error } = await query;
  if (error) throw error;
  const rows = data ?? [];
  const hasMore = rows.length > AUDIT_LOG_PAGE_SIZE;
  return { entries: hasMore ? rows.slice(0, AUDIT_LOG_PAGE_SIZE) : rows, hasMore };
}

// Ignores pagination entirely — loops until exhausted. Used only by
// PDF/CSV export, which must cover the complete filtered range regardless
// of how much the on-screen list has paged in; exporting only what's
// currently loaded on-screen would silently under-report activity.
export async function listAuditLogAll(
  businessId: string,
  filter: AuditLogFilter
): Promise<AuditLogEntry[]> {
  const all: AuditLogEntry[] = [];
  let page = 0;
  for (;;) {
    const { entries, hasMore } = await listAuditLog(businessId, filter, page);
    all.push(...entries);
    if (!hasMore) break;
    page += 1;
  }
  return all;
}
