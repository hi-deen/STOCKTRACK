import { redirect } from "next/navigation";
import DashboardShell from "@/components/dashboard/dashboard-shell";
import { BusinessProvider } from "@/components/providers/business-provider";
import { createServerSupabaseClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createServerSupabaseClient();

  if (!supabase) {
    redirect("/login");
  }

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  return (
    <BusinessProvider>
      <DashboardShell>{children}</DashboardShell>
    </BusinessProvider>
  );
}
