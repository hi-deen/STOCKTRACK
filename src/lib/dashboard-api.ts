import { normalizeEmbedded } from '@/lib/supabase-utils';
import { supabase } from '@/lib/supabase';
import type { ActivityItem, DashboardStats } from '@/types/dashboard';

export async function getDashboardStats(businessId: string): Promise<DashboardStats> {
  const { data, error } = await supabase.rpc('get_business_dashboard_stats', {
    business_id_input: businessId,
  });
  if (error) throw error;
  return data as DashboardStats;
}

export async function getRecentActivity(businessId: string, limit = 8): Promise<ActivityItem[]> {
  const [deliveriesRes, paymentsRes] = await Promise.all([
    supabase
      .from('stock_deliveries')
      .select(
        'id, shop_id, quantity, total_amount, delivery_date, voided_at, is_edited, created_at, shops(name), products(name, unit)'
      )
      .eq('business_id', businessId)
      .order('created_at', { ascending: false })
      .limit(limit),
    supabase
      .from('payments')
      .select('id, shop_id, amount, payment_date, method, voided_at, is_edited, created_at, shops(name)')
      .eq('business_id', businessId)
      .order('created_at', { ascending: false })
      .limit(limit),
  ]);
  if (deliveriesRes.error) throw deliveriesRes.error;
  if (paymentsRes.error) throw paymentsRes.error;

  const deliveries: ActivityItem[] = (deliveriesRes.data ?? []).map((row) => {
    const shop = normalizeEmbedded<{ name: string }>(row.shops as never);
    const product = normalizeEmbedded<{ name: string; unit: string }>(row.products as never);
    return {
      id: row.id,
      type: 'delivery',
      date: row.delivery_date,
      createdAt: row.created_at,
      shop_id: row.shop_id,
      shop_name: shop?.name ?? 'Unknown shop',
      description: `${row.quantity} ${product?.unit ?? ''} ${product?.name ?? ''}`.trim(),
      amount: row.total_amount,
      voided: !!row.voided_at,
      edited: !!row.is_edited,
    };
  });

  const payments: ActivityItem[] = (paymentsRes.data ?? []).map((row) => {
    const shop = normalizeEmbedded<{ name: string }>(row.shops as never);
    return {
      id: row.id,
      type: 'payment',
      date: row.payment_date,
      createdAt: row.created_at,
      shop_id: row.shop_id,
      shop_name: shop?.name ?? 'Unknown shop',
      description: row.method ?? 'Payment',
      amount: row.amount,
      voided: !!row.voided_at,
      edited: !!row.is_edited,
    };
  });

  return [...deliveries, ...payments]
    .sort((a, b) => (a.createdAt < b.createdAt ? 1 : a.createdAt > b.createdAt ? -1 : 0))
    .slice(0, limit);
}
