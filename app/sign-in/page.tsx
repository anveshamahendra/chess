"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { NavBar } from "@/components/nav/NavBar";
import { Input } from "@/components/ui/Input";
import { PillButton } from "@/components/ui/PillButton";
import { createClient } from "@/lib/supabase/client";

export default function SignInPage() {
  const [mode, setMode] = useState<"signin" | "reset">("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const router = useRouter();
  const supabase = createClient();

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setNotice(null);
    setLoading(true);
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    setLoading(false);
    if (error) {
      setError(error.message);
      return;
    }
    router.push("/dashboard");
    router.refresh();
  }

  async function handleReset(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setNotice(null);
    setLoading(true);
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/reset-password`,
    });
    setLoading(false);
    if (error) {
      setError(error.message);
      return;
    }
    setNotice("Check your email for a link to reset your password.");
  }

  return (
    <div className="min-h-screen bg-page">
      <NavBar />
      <div className="flex justify-center px-4 py-10">
        <div className="w-full max-w-sm rounded-[26px] bg-card p-8">
          <h1 className="text-3xl font-bold lowercase text-white mb-1">
            {mode === "signin" ? "sign in" : "reset password"}
          </h1>
          <p className="text-[#a3a3a3] text-sm mb-6">
            {mode === "signin"
              ? "Welcome back."
              : "Enter your email and we'll send you a reset link."}
          </p>

          {mode === "signin" ? (
            <form onSubmit={handleSubmit} className="flex flex-col gap-3">
              <Input
                type="email"
                placeholder="Email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
              <Input
                type="password"
                placeholder="Password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
              {error && <p className="text-[#ef4444] text-sm">{error}</p>}
              <PillButton type="submit" variant="primary" className="mt-2" disabled={loading}>
                {loading ? "Signing in…" : "Sign in"}
              </PillButton>
              <button
                type="button"
                onClick={() => {
                  setMode("reset");
                  setError(null);
                  setNotice(null);
                }}
                className="text-[#a3a3a3] text-sm underline hover:text-white transition-colors"
              >
                Forgot password?
              </button>
            </form>
          ) : (
            <form onSubmit={handleReset} className="flex flex-col gap-3">
              <Input
                type="email"
                placeholder="Email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
              {error && <p className="text-[#ef4444] text-sm">{error}</p>}
              {notice && <p className="text-[#22c55e] text-sm">{notice}</p>}
              <PillButton type="submit" variant="primary" className="mt-2" disabled={loading}>
                {loading ? "Sending…" : "Send reset link"}
              </PillButton>
              <button
                type="button"
                onClick={() => {
                  setMode("signin");
                  setError(null);
                  setNotice(null);
                }}
                className="text-[#a3a3a3] text-sm underline hover:text-white transition-colors"
              >
                Back to sign in
              </button>
            </form>
          )}

          <p className="text-[#a3a3a3] text-sm mt-6 text-center">
            {mode === "signin" ? (
              <>
                No account?{" "}
                <Link href="/sign-up" className="text-white underline">
                  Sign up
                </Link>
              </>
            ) : (
              <Link href="/sign-up" className="text-white underline">
                Create an account
              </Link>
            )}
          </p>
        </div>
      </div>
    </div>
  );
}
