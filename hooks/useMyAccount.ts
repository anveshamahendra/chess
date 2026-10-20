"use client";

import { useCallback, useEffect, useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { createClient } from "@/lib/supabase/client";

export interface MyAccount {
  id: string;
  username: string;
  display_name: string | null;
  avatar_url: string | null;
  avatar_color: string | null;
  username_confirmed: boolean;
  username_changed_at: string | null;
  rating: number;
  games_played: number;
  wins: number;
  losses: number;
  draws: number;
}

// Own-account data via get_my_account(): it also covers the fields excluded
// from the public profiles column grants (username_confirmed, changed_at).
export function useMyAccount() {
  const { user, loading: authLoading } = useAuth();
  const [account, setAccount] = useState<MyAccount | null>(null);
  const [loading, setLoading] = useState(true);
  const supabase = createClient();

  const refresh = useCallback(async () => {
    if (!user) {
      setAccount(null);
      setLoading(false);
      return;
    }
    const { data } = await supabase.rpc("get_my_account");
    const row = Array.isArray(data) ? data[0] : data;
    setAccount((row as MyAccount) ?? null);
    setLoading(false);
  }, [user, supabase]);

  useEffect(() => {
    if (authLoading) return;
    refresh();
  }, [authLoading, refresh]);

  return { account, loading: authLoading || loading, refresh };
}
