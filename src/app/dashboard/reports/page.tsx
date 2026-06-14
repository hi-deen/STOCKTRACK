"use client";

import { useEffect, useState } from "react";
import { endOfMonth, format, startOfMonth, startOfWeek, endOfWeek } from "date-fns";
import { DayPicker, type DateRange } from "react-day-picker";
import { BarChart3, CalendarDays, Download, FileText, FileSpreadsheet, Loader2, Receipt, Store, TrendingDown, TrendingUp, Truck } from "lucide-react";
import { useBusiness } from "@/components/providers/business-provider";
import Badge from "@/components/ui/Badge";
import Button from "@/components/ui/Button";
import Card from "@/components/ui/Card";
import EmptyState from "@/components/ui/EmptyState";
import Skeleton from "@/components/ui/Skeleton";
import StatTile from "@/components/ui/StatTile";
import { createClient } from "@/lib/supabase/client";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import * as XLSX from "xlsx";

import "react-day-picker/dist/style.css";

type ReportSummary = {
  total_stock_value: number;
  total_payments_collected: number;
  delivery_count: number;
  payment_count: number;
  unique_shops_visited: number;
  net_outstanding_change: number;
};

type ActivityEntry = {
  entry_type: "delivery" | "payment";
  entry_date: string;
  shop_id: string;
  shop_name: string;
  shop_area: string | null;
  description: string;
  amount: number;
  product_name: string | null;
  quantity: number | null;
  unit: string | null;
};

const formatCurrency = (value: number) => `₦${value.toLocaleString("en-NG", { maximumFractionDigits: 2 })}`;

function getDefaultRange() {
  const today = new Date();
  return {
    from: startOfMonth(today),
    to: today,
  } as DateRange;
}

function getLabelForRange(range: DateRange) {
  if (!range.from) {
    return "Select a date range";
  }

  const startLabel = format(range.from, "MMM d, yyyy");
  if (!range.to) {
    return startLabel;
  }

  return `${startLabel} - ${format(range.to, "MMM d, yyyy")}`;
}

function buildQuickRange(option: string) {
  const today = new Date();
  switch (option) {
    case "today":
      return { from: today, to: today };
    case "week":
      return { from: startOfWeek(today, { weekStartsOn: 1 }), to: endOfWeek(today, { weekStartsOn: 1 }) };
    case "month":
      return { from: startOfMonth(today), to: endOfMonth(today) };
    default:
      return getDefaultRange();
  }
}

export default function ReportsPage() {
  const { activeBusinessId, businesses } = useBusiness();
  const [loading, setLoading] = useState(true);
  const [summary, setSummary] = useState<ReportSummary | null>(null);
  const [activity, setActivity] = useState<ActivityEntry[]>([]);
  const [range, setRange] = useState<DateRange>(getDefaultRange());
  const [quickFilter, setQuickFilter] = useState("month");
  const [calendarOpen, setCalendarOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [exporting, setExporting] = useState<"pdf" | "xlsx" | null>(null);
  const [sortOrder, setSortOrder] = useState<"desc" | "asc">("desc");

  const loadReportData = async (selectedRange: DateRange) => {
    const supabase = createClient();
    if (!supabase || !activeBusinessId || !selectedRange.from) {
      setSummary(null);
      setActivity([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    const startDate = format(selectedRange.from, "yyyy-MM-dd");
    const endDate = selectedRange.to ? format(selectedRange.to, "yyyy-MM-dd") : startDate;

    const [summaryRes, activityRes] = await Promise.all([
      supabase.rpc("get_report_summary", { business_id_input: activeBusinessId, start_date: startDate, end_date: endDate }),
      supabase.rpc("get_activity_in_range", { business_id_input: activeBusinessId, start_date: startDate, end_date: endDate }),
    ]);

    if (summaryRes.error || activityRes.error) {
      setError(summaryRes.error?.message ?? activityRes.error?.message ?? "Unable to load report data.");
      setLoading(false);
      return;
    }

    const nextSummary = ((summaryRes.data as unknown as ReportSummary[] | null)?.[0] ?? null) as ReportSummary | null;
    const nextActivity = (activityRes.data ?? []) as ActivityEntry[];

    setSummary(nextSummary);
    setActivity(nextActivity);
    setLoading(false);
  };

  useEffect(() => {
    void loadReportData(range);
  }, [activeBusinessId]);

  const handleQuickFilter = (value: string) => {
    const nextRange = buildQuickRange(value);
    setQuickFilter(value);
    setRange(nextRange);
    void loadReportData(nextRange);
  };

  const handleApplyRange = () => {
    setCalendarOpen(false);
    void loadReportData(range);
  };

  const handleExportPdf = () => {
    if (!summary || activity.length === 0) {
      return;
    }

    setExporting("pdf");
    const doc = new jsPDF({ orientation: "portrait", unit: "pt", format: "a4" });
    const businessName = businesses.find((business) => business.id === activeBusinessId)?.name ?? "StockTrack";
    const startDate = range.from ? format(range.from, "yyyy-MM-dd") : "";
    const endDate = range.to ? format(range.to, "yyyy-MM-dd") : startDate;

    doc.setFontSize(18);
    doc.text(businessName, 40, 40);
    doc.setFontSize(10);
    doc.text(`Report period: ${startDate} to ${endDate}`, 40, 60);
    doc.text(`Generated: ${format(new Date(), "MMM d, yyyy")}`, 40, 76);

    doc.setFontSize(12);
    doc.text("Summary", 40, 100);
    autoTable(doc, {
      startY: 112,
      head: [["Metric", "Value"]],
      body: [
        ["Total Stock Distributed", formatCurrency(summary.total_stock_value)],
        ["Total Collected", formatCurrency(summary.total_payments_collected)],
        ["Net Change in Outstanding", formatCurrency(summary.net_outstanding_change)],
        ["Deliveries", summary.delivery_count.toString()],
        ["Payments", summary.payment_count.toString()],
        ["Unique Shops Visited", summary.unique_shops_visited.toString()],
      ],
      theme: "grid",
      styles: { fontSize: 9 },
      headStyles: { fillColor: [143, 98, 38] },
    });

    const lastTableY = (doc as jsPDF & { lastAutoTable?: { finalY?: number } }).lastAutoTable?.finalY ?? 180;
    autoTable(doc, {
      startY: lastTableY + 18,
      head: [["Date", "Shop", "Type", "Description", "Amount"]],
      body: activity.map((item) => [
        item.entry_date,
        `${item.shop_name}${item.shop_area ? ` • ${item.shop_area}` : ""}`,
        item.entry_type === "delivery" ? "Delivery" : "Payment",
        item.description,
        formatCurrency(item.amount),
      ]),
      theme: "grid",
      styles: { fontSize: 8 },
      headStyles: { fillColor: [92, 124, 77] },
    });

    doc.save(`stocktrack-report-${startDate}-to-${endDate}.pdf`);
    setExporting(null);
  };

  const handleExportXlsx = () => {
    if (!summary || activity.length === 0) {
      return;
    }

    setExporting("xlsx");
    const startDate = range.from ? format(range.from, "yyyy-MM-dd") : "";
    const endDate = range.to ? format(range.to, "yyyy-MM-dd") : startDate;

    const summaryRows = [
      ["Metric", "Value"],
      ["Total Stock Distributed", summary.total_stock_value],
      ["Total Collected", summary.total_payments_collected],
      ["Net Change in Outstanding", summary.net_outstanding_change],
      ["Deliveries", summary.delivery_count],
      ["Payments", summary.payment_count],
      ["Unique Shops Visited", summary.unique_shops_visited],
    ];

    const activityRows = [
      ["Entry Type", "Date", "Shop", "Area", "Description", "Amount", "Product", "Quantity", "Unit"],
      ...activity.map((item) => [item.entry_type, item.entry_date, item.shop_name, item.shop_area ?? "", item.description, item.amount, item.product_name ?? "", item.quantity ?? "", item.unit ?? ""]),
    ];

    const workbook = XLSX.utils.book_new();
    const summarySheet = XLSX.utils.aoa_to_sheet(summaryRows);
    const activitySheet = XLSX.utils.aoa_to_sheet(activityRows);
    XLSX.utils.book_append_sheet(workbook, summarySheet, "Summary");
    XLSX.utils.book_append_sheet(workbook, activitySheet, "Activity");
    XLSX.writeFile(workbook, `stocktrack-report-${startDate}-to-${endDate}.xlsx`);
    setExporting(null);
  };

  const emptyState = !loading && (!summary || activity.length === 0);
  const hasData = Boolean(summary && activity.length > 0);
  const sortedActivity = [...activity].sort((left, right) => {
    const leftDate = new Date(left.entry_date).getTime();
    const rightDate = new Date(right.entry_date).getTime();
    return sortOrder === "desc" ? rightDate - leftDate : leftDate - rightDate;
  });
  const areaBreakdown = Object.entries(
    activity.reduce<Record<string, { value: number; payments: number }>>((accumulator, entry) => {
      const area = entry.shop_area || "Unassigned";
      const current = accumulator[area] ?? { value: 0, payments: 0 };
      current.value += entry.entry_type === "delivery" ? entry.amount : 0;
      current.payments += entry.entry_type === "payment" ? entry.amount : 0;
      accumulator[area] = current;
      return accumulator;
    }, {}),
  ).sort((left, right) => right[1].value + right[1].payments - (left[1].value + left[1].payments));

  return (
    <div className="space-y-6">
      <Card className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <p className="text-sm font-semibold uppercase tracking-[0.24em] text-[color:var(--primary)]">Reports</p>
          <h1 className="mt-1 font-[family-name:var(--font-heading)] text-2xl font-semibold text-[color:var(--ink)]">Review business activity and download history</h1>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" icon={CalendarDays} onClick={() => setCalendarOpen((value) => !value)}>Choose range</Button>
          <Button variant="outline" icon={FileText} onClick={() => handleExportPdf()} disabled={!hasData || exporting === "pdf"} title={hasData ? undefined : "Select a date range with data to export"}>
            {exporting === "pdf" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />} Export PDF
          </Button>
          <Button variant="secondary" icon={FileSpreadsheet} onClick={() => handleExportXlsx()} disabled={!hasData || exporting === "xlsx"} title={hasData ? undefined : "Select a date range with data to export"}>
            {exporting === "xlsx" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />} Export Excel
          </Button>
        </div>
      </Card>

      <Card padded={false} className="p-4">
        <div className="flex flex-wrap items-center gap-2">
          {[
            { value: "today", label: "Today" },
            { value: "week", label: "This Week" },
            { value: "month", label: "This Month" },
            { value: "custom", label: "Custom" },
          ].map((filter) => (
            <button
              key={filter.value}
              type="button"
              onClick={() => {
                if (filter.value === "custom") {
                  setCalendarOpen(true);
                  return;
                }
                setQuickFilter(filter.value);
                setCalendarOpen(false);
                const nextRange = buildQuickRange(filter.value);
                setRange(nextRange);
                void loadReportData(nextRange);
              }}
              className={`rounded-full px-3 py-1.5 text-sm font-semibold ${quickFilter === filter.value ? "bg-[color:var(--primary)] text-white" : "bg-[color:var(--cream)] text-[color:var(--ink)]"}`}
            >
              {filter.label}
            </button>
          ))}
        </div>

        <div className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-[1rem] border border-[color:var(--border)] bg-[color:var(--cream)]/40 px-4 py-3">
          <div>
            <p className="text-sm font-medium text-[color:var(--muted)]">Active range</p>
            <p className="text-base font-semibold text-[color:var(--ink)]">{getLabelForRange(range)}</p>
          </div>
          {calendarOpen ? (
            <div className="w-full rounded-[1rem] border border-[color:var(--border)] bg-white p-3 shadow-sm lg:w-auto">
              <DayPicker
                mode="range"
                selected={range}
                onSelect={(value) => {
                  if (!value) {
                    setRange({ from: undefined, to: undefined });
                    return;
                  }

                  setRange(value);
                }}
                captionLayout="dropdown"
                classNames={{
                  root: "text-sm",
                  chevron: "fill-[color:var(--primary)]",
                  day_button: "rounded-full",
                  selected: "bg-[color:var(--primary)] text-white",
                  today: "font-semibold text-[color:var(--primary)]",
                }}
              />
              <div className="mt-3 flex justify-end gap-2">
                <Button variant="ghost" onClick={() => setCalendarOpen(false)}>Cancel</Button>
                <Button variant="secondary" onClick={handleApplyRange}>Apply</Button>
              </div>
            </div>
          ) : null}
        </div>
      </Card>

      {error ? <div className="rounded-[1.35rem] border border-[color:var(--danger-soft)] bg-[color:var(--danger-soft)]/70 p-3 text-sm text-[color:var(--danger)]">{error}</div> : null}

      {loading ? (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {Array.from({ length: 6 }).map((_, index) => <Skeleton key={index} className="h-28" />)}
        </div>
      ) : emptyState ? (
        <EmptyState icon={BarChart3} title="No report data for this range" description="No deliveries or payments were recorded in the selected period yet." />
      ) : (
        <>
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            <StatTile icon={Truck} label="Total Stock Distributed" value={formatCurrency(summary?.total_stock_value ?? 0)} tone="primary" />
            <StatTile icon={Receipt} label="Total Collected" value={formatCurrency(summary?.total_payments_collected ?? 0)} tone="secondary" />
            <StatTile icon={summary && summary.net_outstanding_change >= 0 ? TrendingUp : TrendingDown} label="Net Change in Outstanding" value={formatCurrency(summary?.net_outstanding_change ?? 0)} tone={summary && summary.net_outstanding_change >= 0 ? "warning" : "danger"} />
            <StatTile icon={FileText} label="Deliveries" value={(summary?.delivery_count ?? 0).toString()} tone="accent" />
            <StatTile icon={Receipt} label="Payments" value={(summary?.payment_count ?? 0).toString()} tone="secondary" />
            <StatTile icon={Store} label="Unique Shops Visited" value={(summary?.unique_shops_visited ?? 0).toString()} tone="warning" />
          </div>

          <Card>
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h2 className="text-lg font-semibold text-[color:var(--ink)]">Activity</h2>
                <p className="text-sm text-[color:var(--muted)]">A combined view of deliveries and payments for the selected period.</p>
              </div>
              <button type="button" onClick={() => setSortOrder((value) => (value === "desc" ? "asc" : "desc"))} className="rounded-full border border-[color:var(--border)] px-3 py-1.5 text-sm font-semibold text-[color:var(--ink)]">
                Sort by date: {sortOrder === "desc" ? "Newest first" : "Oldest first"}
              </button>
            </div>
            <div className="mt-4 overflow-x-auto">
              <table className="min-w-full divide-y divide-[color:var(--border)] text-sm">
                <thead className="bg-[color:var(--cream)]/70">
                  <tr>
                    <th className="px-4 py-3 text-left font-semibold text-[color:var(--ink)]">Date</th>
                    <th className="px-4 py-3 text-left font-semibold text-[color:var(--ink)]">Shop</th>
                    <th className="px-4 py-3 text-left font-semibold text-[color:var(--ink)]">Type</th>
                    <th className="px-4 py-3 text-left font-semibold text-[color:var(--ink)]">Description</th>
                    <th className="px-4 py-3 text-left font-semibold text-[color:var(--ink)]">Amount</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[color:var(--border)] bg-[color:var(--surface)]">
                  {sortedActivity.map((entry) => (
                    <tr key={`${entry.entry_type}-${entry.entry_date}-${entry.shop_id}-${entry.description}`}>
                      <td className="px-4 py-3 whitespace-nowrap text-[color:var(--muted)]">{entry.entry_date}</td>
                      <td className="px-4 py-3 text-[color:var(--ink)]">
                        <div className="font-semibold">{entry.shop_name}</div>
                        {entry.shop_area ? <div className="text-xs text-[color:var(--muted)]">{entry.shop_area}</div> : null}
                      </td>
                      <td className="px-4 py-3"><Badge variant={entry.entry_type === "delivery" ? "info" : "success"}>{entry.entry_type === "delivery" ? "Delivery" : "Payment"}</Badge></td>
                      <td className="px-4 py-3 text-[color:var(--muted)]">{entry.description}</td>
                      <td className="px-4 py-3 font-semibold text-[color:var(--ink)]">{formatCurrency(entry.amount)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>

          <Card>
            <h2 className="text-lg font-semibold text-[color:var(--ink)]">Area overview</h2>
            <p className="mt-1 text-sm text-[color:var(--muted)]">A lightweight breakdown of delivery value and payments by area.</p>
            <div className="mt-4 overflow-x-auto">
              <table className="min-w-full divide-y divide-[color:var(--border)] text-sm">
                <thead className="bg-[color:var(--cream)]/70">
                  <tr>
                    <th className="px-4 py-3 text-left font-semibold text-[color:var(--ink)]">Area</th>
                    <th className="px-4 py-3 text-left font-semibold text-[color:var(--ink)]">Delivery Value</th>
                    <th className="px-4 py-3 text-left font-semibold text-[color:var(--ink)]">Payments</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[color:var(--border)] bg-[color:var(--surface)]">
                  {areaBreakdown.map(([area, totals]) => (
                    <tr key={area}>
                      <td className="px-4 py-3 font-semibold text-[color:var(--ink)]">{area}</td>
                      <td className="px-4 py-3 text-[color:var(--muted)]">{formatCurrency(totals.value)}</td>
                      <td className="px-4 py-3 text-[color:var(--muted)]">{formatCurrency(totals.payments)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        </>
      )}
    </div>
  );
}
