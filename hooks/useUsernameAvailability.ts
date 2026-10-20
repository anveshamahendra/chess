"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";

export const USERNAME_RE = /^[a-z0-9_]{3,20}$/;

export type UsernameStatus =
  | "idle"
  | "invalid"
  | "checking"
  | "available"
  | "taken";

// Debounced availability check against the username_available RPC.
// Pass `exclude` (your current username) so your own name reads as free.
export function useUsernameAvailability(
  username: string,
  exclude?: string
): UsernameStatus {
  const [status, setStatus] = useState<UsernameStatus>("idle");
  const value = username.trim().toLowerCase();

  useEffect(() => {
    let cancelled = false;

    if (!value) {
      setStatus("idle");
      return;
    }
    if (!USERNAME_RE.test(value)) {
      setStatus("invalid");
      return;
    }
    if (exclude && value === exclude.toLowerCase()) {
      setStatus("available");
      return;
    }

    setStatus("checking");
    const timer = setTimeout(async () => {
      const { data } = await createClient().rpc("username_available", {
        p_username: value,
      });
      if (!cancelled) setStatus(data === true ? "available" : "taken");
    }, 400);

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [value, exclude]);

  return status;
}

export function usernameStatusText(status: UsernameStatus): {
  text: string;
  tone: "muted" | "good" | "bad";
} | null {
  switch (status) {
    case "idle":
      return null;
    case "invalid":
      return {
        text: "3–20 characters — lowercase letters, numbers, underscores",
        tone: "bad",
      };
    case "checking":
      return { text: "checking availability…", tone: "muted" };
    case "available":
      return { text: "username available", tone: "good" };
    case "taken":
      return { text: "that username is taken", tone: "bad" };
  }
}
