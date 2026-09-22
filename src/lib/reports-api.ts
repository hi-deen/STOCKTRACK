import { supabase } from '@/lib/supabase';
import type { ActivityLogEntry, ReportSummary } from '@/types/reports';

const EMPTY_SUMMARY: ReportSummary = {
  total_stock_value: 0,
  total_payments_collected: 0,
  delivery_count: 0,
  payment_count: 0,
  unique_shops_visited: 0,
  net_outstanding_change: 0,
};

export async function getReportSummary(
  businessId: string,
  startDate: string,
  endDate: string
): Promise<ReportSummary> {
  const { data, error } = await supabase.rpc('get_report_summary', {
    business_id_input: businessId,
    start_date: startDate,
    end_date: endDate,
  });
  if (error) throw error;
  return data?.[0] ?? EMPTY_SUMMARY;
}

export async function getActivityInRange(
  businessId: string,
  startDate: string,
  endDate: string
): Promise<ActivityLogEntry[]> {
  const { data, error } = await supabase.rpc('get_activity_in_range', {
    business_id_input: businessId,
    start_date: startDate,
    end_date: endDate,
  });
  if (error) throw error;
  return data ?? [];
}
