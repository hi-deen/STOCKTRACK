'use client';

import type { Session } from '@supabase/supabase-js';
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';

import { createBusiness, fetchMyMemberships, redeemBusinessInviteCode } from '@/lib/business-api';
import { getStoredActiveBusinessId, setStoredActiveBusinessId } from '@/lib/active-business-storage';
import { getErrorMessage } from '@/lib/error-message';
import { getMyPermissions } from '@/lib/members-api';
import type { Permission } from '@/lib/permissions';
import { clearQueryCache, useCachedState } from '@/lib/query-cache';
import { supabase } from '@/lib/supabase';
import { clearSignedUrlCache } from '@/lib/upload-photo';
import type { BusinessMembership } from '@/types/business';

interface BusinessAuthContextValue {
  isLoading: boolean;
  isAuthenticated: boolean;
  userId: string | null;
  userEmail: string | null;
  memberships: BusinessMembership[];
  membershipsLoading: boolean;
  membershipsError: string | null;
  activeBusinessId: string | null;
  activeMembership: BusinessMembership | null;
  // Whether the signed-in member may do this in the active business.
  can: (permission: Permission) => boolean;
  setActiveBusinessId: (id: string) => Promise<void>;
  refetchMemberships: () => Promise<void>;
  signUp: (email: string, password: string) => Promise<{ needsVerification: boolean }>;
  signIn: (email: string, password: string) => Promise<void>;
  verifySignupOtp: (email: string, token: string) => Promise<void>;
  requestPasswordReset: (email: string) => Promise<void>;
  verifyRecoveryOtp: (email: string, token: string) => Promise<void>;
  updatePassword: (password: string) => Promise<void>;
  signOut: () => Promise<void>;
  createBusiness: (name: string) => Promise<void>;
  joinBusiness: (code: string) => Promise<void>;
}

const BusinessAuthContext = createContext<BusinessAuthContextValue | null>(null);

export function BusinessAuthProvider({ children }: { children: ReactNode }) {
  const [isLoading, setIsLoading] = useState(true);
  const [session, setSession] = useState<Session | null>(null);
  const [memberships, setMemberships] = useState<BusinessMembership[]>([]);
  const [membershipsLoading, setMembershipsLoading] = useState(false);
  const [membershipsError, setMembershipsError] = useState<string | null>(null);
  const [activeBusinessId, setActiveBusinessIdState] = useState<string | null>(null);

  // What the member may do in the active business, saved with the query
  // cache so the right buttons show offline. The database enforces the same
  // rules either way.
  const [permissionList, setPermissionList] = useCachedState<Permission[]>(
    activeBusinessId ? `permissions:${activeBusinessId}` : null,
    []
  );

  useEffect(() => {
    if (!activeBusinessId || !session?.user?.id) return;
    let active = true;
    getMyPermissions(activeBusinessId)
      .then((list) => {
        if (active) setPermissionList(list);
      })
      .catch(() => {});
    return () => {
      active = false;
    };
    // Re-checked whenever memberships reload, e.g. after a role change.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeBusinessId, session?.user?.id, memberships]);

  useEffect(() => {
    let mounted = true;
    supabase.auth.getSession().then(({ data }) => {
      if (!mounted) return;
      setSession(data.session);
      setIsLoading(false);
    });
    const { data: subscription } = supabase.auth.onAuthStateChange((_event, newSession) => {
      setSession(newSession);
    });
    return () => {
      mounted = false;
      subscription.subscription.unsubscribe();
    };
  }, []);

  const loadMembershipsForUser = useCallback(async (userId: string) => {
    setMembershipsLoading(true);
    setMembershipsError(null);
    try {
      const [stored, data] = await Promise.all([
        getStoredActiveBusinessId(),
        fetchMyMemberships(userId),
      ]);
      setMemberships(data);
      const storedIsValid = stored && data.some((m) => m.business_id === stored);
      const next = storedIsValid ? stored : (data[0]?.business_id ?? null);
      setActiveBusinessIdState(next);
      if (next) await setStoredActiveBusinessId(next);
    } catch (err) {
      setMembershipsError(
        getErrorMessage(err, 'Could not load your businesses.')
      );
    } finally {
      setMembershipsLoading(false);
    }
  }, []);

  useEffect(() => {
    if (session?.user) {
      loadMembershipsForUser(session.user.id);
    } else {
      setMemberships([]);
      setActiveBusinessIdState(null);
      setMembershipsError(null);
    }
  }, [session?.user?.id, loadMembershipsForUser]);

  const refetchMemberships = useCallback(async () => {
    if (session?.user) {
      await loadMembershipsForUser(session.user.id);
    }
  }, [session?.user, loadMembershipsForUser]);

  const activeMembership = memberships.find((m) => m.business_id === activeBusinessId) ?? null;

  const value = useMemo<BusinessAuthContextValue>(
    () => ({
      isLoading,
      isAuthenticated: !!session,
      userId: session?.user?.id ?? null,
      userEmail: session?.user?.email ?? null,
      memberships,
      membershipsLoading,
      membershipsError,
      activeBusinessId,
      activeMembership,
      can: (permission: Permission) => activeMembership?.role === 'owner' || permissionList.includes(permission),
      async setActiveBusinessId(id: string) {
        setActiveBusinessIdState(id);
        await setStoredActiveBusinessId(id);
      },
      refetchMemberships,
      async signUp(email: string, password: string) {
        const { data, error } = await supabase.auth.signUp({ email, password });
        if (error) throw error;
        return { needsVerification: !data.session };
      },
      async signIn(email: string, password: string) {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
      },
      async verifySignupOtp(email: string, token: string) {
        const { error } = await supabase.auth.verifyOtp({ email, token, type: 'signup' });
        if (error) throw error;
      },
      async requestPasswordReset(email: string) {
        const { error } = await supabase.auth.resetPasswordForEmail(email);
        if (error) throw error;
      },
      async verifyRecoveryOtp(email: string, token: string) {
        const { error } = await supabase.auth.verifyOtp({ email, token, type: 'recovery' });
        if (error) throw error;
      },
      async updatePassword(password: string) {
        const { error } = await supabase.auth.updateUser({ password });
        if (error) throw error;
      },
      async signOut() {
        await supabase.auth.signOut();
        clearQueryCache();
        clearSignedUrlCache();
      },
      async createBusiness(name: string) {
        const newBusinessId = await createBusiness(name);
        await refetchMemberships();
        // Land the caller in the business they just created rather than
        // wherever refetchMemberships() would otherwise keep them (it only
        // switches away from a stored active id that's no longer valid —
        // an existing membership stays valid, so without this a member
        // creating an *additional* business would stay on their old one).
        setActiveBusinessIdState(newBusinessId);
        await setStoredActiveBusinessId(newBusinessId);
      },
      async joinBusiness(code: string) {
        const newBusinessId = await redeemBusinessInviteCode(code);
        await refetchMemberships();
        setActiveBusinessIdState(newBusinessId);
        await setStoredActiveBusinessId(newBusinessId);
      },
    }),
    [
      isLoading,
      session,
      memberships,
      membershipsLoading,
      membershipsError,
      activeBusinessId,
      activeMembership,
      permissionList,
      refetchMemberships,
    ]
  );

  return <BusinessAuthContext.Provider value={value}>{children}</BusinessAuthContext.Provider>;
}

export function useBusinessAuth(): BusinessAuthContextValue {
  const ctx = useContext(BusinessAuthContext);
  if (!ctx) throw new Error('useBusinessAuth must be used within BusinessAuthProvider');
  return ctx;
}
