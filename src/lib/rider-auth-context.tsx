'use client';

import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';

import { riderLogin, riderSessionCheck, riderSignup } from '@/lib/rider-api';
import {
  clearStoredRiderToken,
  getStoredRiderToken,
  setStoredRiderToken,
} from '@/lib/rider-session-storage';

interface RiderAuthState {
  isLoading: boolean;
  token: string | null;
  riderId: string | null;
  fullName: string | null;
}

interface RiderAuthContextValue extends RiderAuthState {
  isAuthenticated: boolean;
  signup: (phone: string, pin: string, fullName: string) => Promise<void>;
  login: (phone: string, pin: string) => Promise<void>;
  logout: () => Promise<void>;
}

const RiderAuthContext = createContext<RiderAuthContextValue | null>(null);

export function RiderAuthProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<RiderAuthState>({
    isLoading: true,
    token: null,
    riderId: null,
    fullName: null,
  });

  useEffect(() => {
    (async () => {
      const storedToken = await getStoredRiderToken();
      if (!storedToken) {
        setState((s) => ({ ...s, isLoading: false }));
        return;
      }
      try {
        const session = await riderSessionCheck(storedToken);
        if (!session) {
          await clearStoredRiderToken();
          setState({ isLoading: false, token: null, riderId: null, fullName: null });
          return;
        }
        setState({
          isLoading: false,
          token: storedToken,
          riderId: session.rider_id,
          fullName: session.full_name,
        });
      } catch {
        await clearStoredRiderToken();
        setState({ isLoading: false, token: null, riderId: null, fullName: null });
      }
    })();
  }, []);

  const value = useMemo<RiderAuthContextValue>(
    () => ({
      ...state,
      isAuthenticated: !!state.token,
      async signup(phone, pin, fullName) {
        await riderSignup(phone, pin, fullName);
        const result = await riderLogin(phone, pin);
        await setStoredRiderToken(result.token);
        setState({
          isLoading: false,
          token: result.token,
          riderId: result.rider_id,
          fullName: result.full_name,
        });
      },
      async login(phone, pin) {
        const result = await riderLogin(phone, pin);
        await setStoredRiderToken(result.token);
        setState({
          isLoading: false,
          token: result.token,
          riderId: result.rider_id,
          fullName: result.full_name,
        });
      },
      async logout() {
        await clearStoredRiderToken();
        setState({ isLoading: false, token: null, riderId: null, fullName: null });
      },
    }),
    [state]
  );

  return <RiderAuthContext.Provider value={value}>{children}</RiderAuthContext.Provider>;
}

export function useRiderAuth(): RiderAuthContextValue {
  const ctx = useContext(RiderAuthContext);
  if (!ctx) throw new Error('useRiderAuth must be used within RiderAuthProvider');
  return ctx;
}
