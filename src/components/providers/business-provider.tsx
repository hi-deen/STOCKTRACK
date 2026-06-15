"use client";

import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { createClient } from "@/lib/supabase/client";

const STORAGE_KEY = "stocktrack.activeBusinessId";

type BusinessSummary = {
  id: string;
  name: string;
  role: string;
};

type BusinessContextValue = {
  activeBusinessId: string | null;
  activeBusinessRole: string | null;
  businesses: BusinessSummary[];
  loading: boolean;
  setActiveBusiness: (businessId: string | null) => void;
  refreshBusinesses: () => Promise<void>;
};

const BusinessContext = createContext<BusinessContextValue | undefined>(undefined);

function readStoredBusinessId() {
  if (typeof window === "undefined") {
    return null;
  }

  return window.localStorage.getItem(STORAGE_KEY);
}

function persistBusinessId(businessId: string | null) {
  if (typeof window === "undefined") {
    return;
  }

  if (businessId) {
    window.localStorage.setItem(STORAGE_KEY, businessId);
    return;
  }

  window.localStorage.removeItem(STORAGE_KEY);
}

export function BusinessProvider({ children }: { children: ReactNode }) {
  const [businesses, setBusinesses] = useState<BusinessSummary[]>([]);
  const [activeBusinessId, setActiveBusinessId] = useState<string | null>(null);
  const [activeBusinessRole, setActiveBusinessRole] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const supabase = useMemo(() => createClient(), []);

  const refreshBusinesses = async () => {
    if (!supabase) {
      setBusinesses([]);
      setActiveBusinessId(null);
      setActiveBusinessRole(null);
      setLoading(false);
      return;
    }

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      setBusinesses([]);
      setActiveBusinessId(null);
      setActiveBusinessRole(null);
      setLoading(false);
      return;
    }

    const { data, error } = await supabase
      .from("business_members")
      .select("role, businesses(id, name)")
      .eq("user_id", user.id)
      .order("joined_at", { ascending: true });

    if (error) {
      console.error("Unable to load businesses", error);
      setBusinesses([]);
      setLoading(false);
      return;
    }

    const rows = (data ?? []) as unknown as Array<{
      role: string;
      businesses: { id: string; name: string } | null;
    }>;

    const seenBusinessIds = new Set<string>();
    const normalized = rows.flatMap((row) => {
      if (!row.businesses) {
        return [];
      }

      const businessId = row.businesses.id;
      if (seenBusinessIds.has(businessId)) {
        return [];
      }

      seenBusinessIds.add(businessId);
      const normalizedRole = typeof row.role === "string" ? row.role.toLowerCase() : "staff";

      return [
        {
          id: businessId,
          name: row.businesses.name,
          role: normalizedRole,
        },
      ];
    });
    setBusinesses(normalized);

    const storedBusinessId = readStoredBusinessId();
    const nextActiveBusinessId =
      storedBusinessId && normalized.some((business) => business.id === storedBusinessId)
        ? storedBusinessId
        : normalized[0]?.id ?? null;

    setActiveBusinessId(nextActiveBusinessId);
    setActiveBusinessRole(
      normalized.find((business) => business.id === nextActiveBusinessId)?.role ?? null,
    );
    persistBusinessId(nextActiveBusinessId);
    setLoading(false);
  };

  useEffect(() => {
    void refreshBusinesses();

    if (!supabase) {
      return;
    }

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!session) {
        setBusinesses([]);
        setActiveBusinessId(null);
        setActiveBusinessRole(null);
        persistBusinessId(null);
        setLoading(false);
        return;
      }

      void refreshBusinesses();
    });

    return () => subscription.unsubscribe();
  }, [supabase]);

  const setActiveBusiness = (businessId: string | null) => {
    const selectedBusiness = businesses.find((business) => business.id === businessId);
    setActiveBusinessId(businessId);
    setActiveBusinessRole(selectedBusiness?.role ?? null);
    persistBusinessId(businessId);
  };

  const value = useMemo<BusinessContextValue>(
    () => ({
      activeBusinessId,
      activeBusinessRole,
      businesses,
      loading,
      setActiveBusiness,
      refreshBusinesses,
    }),
    [activeBusinessId, activeBusinessRole, businesses, loading],
  );

  return <BusinessContext.Provider value={value}>{children}</BusinessContext.Provider>;
}

export function useBusiness() {
  const context = useContext(BusinessContext);

  if (!context) {
    throw new Error("useBusiness must be used inside a BusinessProvider");
  }

  return context;
}
