"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { NavBar } from "@/components/nav/NavBar";
import { Input } from "@/components/ui/Input";
import { PillButton } from "@/components/ui/PillButton";
import { createClient } from "@/lib/supabase/client";

type Status = "checking" | "ready" | "error";

export default function ResetPasswordPage() {
  const [status, setStatus] = useState<Status>("checking");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);
  const router = useRouter();
  const supabase = createClient();

  useEffect(() => {
    let cancelled = false;

    async function establishSession() {
      const { data } = await supabase.auth.getSession();
      if (cancelled) return;
      if (data.session) {
        setStatus("ready");
        return;
      }

      const params = new URLSearchParams(window.location.search);
      const code = params.get("code");
      const tokenHash = params.get("token_hash");
      const type = params.get("type");

      if (code) {
        const { error } = await supabase.auth.exchangeCodeForSession(window.location.href);
        if (cancelled) return;
        if (error) {
          setStatus("error");
          return;
        }
      } else if (tokenHash && type === "recovery") {
        const { error } = await supabase.auth.verifyOtp({ token_hash: tokenHash, type: "recovery" });
        if (cancelled) return;
        if (error) {
          setStatus("error");
          return;
        }
      } else {
        setStatus("error");
        return;
      }

      const { data: after } = await supabase.auth.getSession();
      if (cancelled) return;
      setStatus(after.session ? "ready" : "error");
    }

    establishSession();
    return () => {
      cancelled = true;
    };
  }, [supabase]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (password !== confirm) {
      setError("Passwords don't match.");
      return;
    }
    setLoading(true);
    const { error } = await supabase.auth.updateUser({ password });
    setLoading(false);
    if (error) {
      setError(error.message);
      return;
    }
    setDone(true);
    setTimeout(() => {
      router.push("/dashboard");
      router.refresh();
    }, 1500);
  }

  return (
    <div className="min-h-screen bg-page">
      <NavBar />
      <div className="flex justify-center px-4 py-10">
        <div className="w-full max-w-sm rounded-[26px] bg-card p-8">
          <h1 className="text-3xl font-bold lowercase text-white mb-1">new password</h1>
          <p className="text-[#a3a3a3] text-sm mb-6">Choose a new password for your account.</p>

          {status === "checking" && (
            <p className="text-[#a3a3a3] text-sm">Checking your reset link…</p>
          )}

          {status === "error" && (
            <div className="flex flex-col gap-3">
              <p className="text-[#ef4444] text-sm">
                This reset link is invalid or has expired.
              </p>
              <Link href="/sign-in" className="text-white text-sm underline">
                Request a new link
              </Link>
            </div>
          )}

          {status === "ready" &&
            (done ? (
              <p className="text-[#22c55e] text-sm">
                Password updated. Taking you to your dashboard…
              </p>
            ) : (
              <form onSubmit={handleSubmit} className="flex flex-col gap-3">
                <Input
                  type="password"
                  placeholder="New password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  minLength={6}
                />
                <Input
                  type="password"
                  placeholder="Confirm new password"
                  value={confirm}
                  onChange={(e) => setConfirm(e.target.value)}
                  required
                  minLength={6}
                />
                {error && <p className="text-[#ef4444] text-sm">{error}</p>}
                <PillButton type="submit" variant="primary" className="mt-2" disabled={loading}>
                  {loading ? "Updating…" : "Update password"}
                </PillButton>
              </form>
            ))}
        </div>
      </div>
    </div>
  );
}
