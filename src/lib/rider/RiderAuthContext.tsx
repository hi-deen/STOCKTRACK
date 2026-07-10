"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";

const RIDER_SESSION_TOKEN_KEY = "rider_session_token";

type RiderUser = {
  id: string;
  full_name: string;
};

type RiderLoginResult = {
  rider_id: string;
  token: string;
  full_name: string;
};

type RiderSessionCheckResult = {
  rider_id: string;
  full_name: string;
};

type RiderAuthContextValue = {
  rider: RiderUser | null;
  loading: boolean;
  error: string | null;
  login: (phone: string, pin: string) => Promise<void>;
  signup: (phone: string, pin: string, fullName: string) => Promise<void>;
  logout: () => Promise<void>;
};

const RiderAuthContext = createContext<RiderAuthContextValue | undefined>(undefined);

export function RiderAuthProvider({ children }: { children: React.ReactNode }) {
  const [rider, setRider] = useState<RiderUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const supabase = useMemo(() => createClient(), []);

  useEffect(() => {
    let isMounted = true;

    const validateStoredSession = async () => {
      if (!supabase) {
        if (isMounted) {
          setLoading(false);
        }
        return;
      }

      const token = typeof window !== "undefined" ? window.localStorage.getItem(RIDER_SESSION_TOKEN_KEY) : null;
      if (!token) {
        if (isMounted) {
          setLoading(false);
        }
        return;
      }

      const { data, error: sessionError } = await supabase.rpc("rider_session_check", { token_input: token });
      if (!isMounted) {
        return;
      }

      if (sessionError || !data || (Array.isArray(data) && data.length === 0)) {
        if (typeof window !== "undefined") {
          window.localStorage.removeItem(RIDER_SESSION_TOKEN_KEY);
        }
        setRider(null);
        setLoading(false);
        return;
      }

      const sessionRows = (data ?? []) as RiderSessionCheckResult[];
      const session = sessionRows[0];
      if (session) {
        setRider({
          id: session.rider_id,
          full_name: session.full_name,
        });
      }
      setLoading(false);
    };

    void validateStoredSession();

    return () => {
      isMounted = false;
    };
  }, [supabase]);

  const persistSession = useCallback((result: RiderLoginResult) => {
    if (typeof window !== "undefined") {
      window.localStorage.setItem(RIDER_SESSION_TOKEN_KEY, result.token);
    }
    setRider({
      id: result.rider_id,
      full_name: result.full_name,
    });
  }, []);

  const login = useCallback(async (phone: string, pin: string) => {
    if (!supabase) {
      setError("Supabase client is not configured.");
      return;
    }

    setError(null);
    const { data, error: loginError } = await supabase.rpc("rider_login", {
      phone_input: phone.trim(),
      pin_input: pin,
    });

    if (loginError || !data || (Array.isArray(data) && data.length === 0)) {
      setError(loginError?.message ?? "Invalid phone or PIN.");
      return;
    }

    const loginRows = (data ?? []) as RiderLoginResult[];
    const loginResult = loginRows[0];
    if (!loginResult) {
      setError("Invalid phone or PIN.");
      return;
    }

    persistSession(loginResult);
  }, [persistSession, supabase]);

  const signup = useCallback(async (phone: string, pin: string, fullName: string) => {
    if (!supabase) {
      setError("Supabase client is not configured.");
      return;
    }

    setError(null);
    const { data: signupId, error: signupError } = await supabase.rpc("rider_signup", {
      phone_input: phone.trim(),
      pin_input: pin,
      full_name_input: fullName.trim(),
    });

    if (signupError || !signupId) {
      setError(signupError?.message ?? "Unable to sign up rider.");
      return;
    }

    const { data: loginData, error: loginError } = await supabase.rpc("rider_login", {
      phone_input: phone.trim(),
      pin_input: pin,
    });

    if (loginError || !loginData || (Array.isArray(loginData) && loginData.length === 0)) {
      setError(loginError?.message ?? "Unable to sign in after signup.");
      return;
    }

    const loginRows = (loginData ?? []) as RiderLoginResult[];
    const loginResult = loginRows[0];
    if (!loginResult) {
      setError("Unable to sign in after signup.");
      return;
    }

    persistSession(loginResult);
  }, [persistSession, supabase]);

  const logout = useCallback(async () => {
    if (typeof window !== "undefined") {
      window.localStorage.removeItem(RIDER_SESSION_TOKEN_KEY);
    }
    setRider(null);
    setError(null);
  }, []);

  const value = useMemo<RiderAuthContextValue>(
    () => ({
      rider,
      loading,
      error,
      login,
      signup,
      logout,
    }),
    [error, loading, login, logout, rider, signup],
  );

  return <RiderAuthContext.Provider value={value}>{children}</RiderAuthContext.Provider>;
}

export function useRiderAuth() {
  const context = useContext(RiderAuthContext);
  if (!context) {
    throw new Error("useRiderAuth must be used within RiderAuthProvider");
  }
  return context;
}
