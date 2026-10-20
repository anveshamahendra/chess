"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { NavBar } from "@/components/nav/NavBar";
import { GoogleButton, OrDivider } from "@/components/auth/GoogleButton";
import { Input } from "@/components/ui/Input";
import { PillButton } from "@/components/ui/PillButton";
import { createClient } from "@/lib/supabase/client";

export default function SignInPage() {
  const [mode, setMode] = useState<"signin" | "reset">("signin");
  const [identity, setIdentity] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const router = useRouter();
  const supabase = createClient();

  // Failed OAuth round-trips land here from /auth/callback.
  useEffect(() => {
    if (new URLSearchParams(window.location.search).get("error") === "oauth") {
      setError("Google sign-in didn't complete. Please try again.");
    }
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setNotice(null);
    setLoading(true);

    // One field for both: anything without "@" is treated as a username and
    // resolved to its email through a security-definer RPC.
    let email = identity.trim();
    if (!email.includes("@")) {
      const { data: resolved } = await supabase.rpc("resolve_username_email", {
        p_username: email,
      });
      if (!resolved) {
        setLoading(false);
        setError("No account with that username.");
        return;
      }
      email = resolved;
    }

    const { error } = await supabase.auth.signInWithPassword({ email, password });
    setLoading(false);
    if (error) {
      setError(
        error.message === "Invalid login credentials"
          ? "Wrong username or password."
          : error.message
      );
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
    const { error } = await supabase.auth.resetPasswordForEmail(identity.trim(), {
      redirectTo: `${window.location.origin}/reset-password`,
    });
    setLoading(false);
    if (error) {
      setError(error.message);
      return;
    }
    setNotice("Check your email for a link to reset your password.");
  }

  async function handleGoogle() {
    setError(null);
    setGoogleLoading(true);
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: `${window.location.origin}/auth/callback?next=/dashboard`,
      },
    });
    if (error) {
      setError(error.message);
      setGoogleLoading(false);
    }
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

          {mode === "signin" && (
            <>
              <GoogleButton onClick={handleGoogle} loading={googleLoading} />
              <OrDivider />
            </>
          )}

          {mode === "signin" ? (
            <form onSubmit={handleSubmit} className="flex flex-col gap-3">
              <Input
                type="text"
                placeholder="Username or email"
                value={identity}
                onChange={(e) => setIdentity(e.target.value)}
                required
                autoComplete="username"
              />
              <Input
                type="password"
                placeholder="Password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                autoComplete="current-password"
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
                value={identity}
                onChange={(e) => setIdentity(e.target.value)}
                required
                autoComplete="email"
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
