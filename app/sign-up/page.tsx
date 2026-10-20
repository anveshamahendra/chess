"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { NavBar } from "@/components/nav/NavBar";
import { GoogleButton, OrDivider } from "@/components/auth/GoogleButton";
import { Input } from "@/components/ui/Input";
import { PillButton } from "@/components/ui/PillButton";
import { createClient } from "@/lib/supabase/client";
import {
  USERNAME_RE,
  useUsernameAvailability,
  usernameStatusText,
} from "@/hooks/useUsernameAvailability";

export default function SignUpPage() {
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [done, setDone] = useState(false);
  const router = useRouter();
  const supabase = createClient();

  const usernameStatus = useUsernameAvailability(username);
  const statusNote = usernameStatusText(usernameStatus);
  const canSubmit =
    usernameStatus === "available" && !!email && password.length >= 6 && !loading;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    const cleanUsername = username.trim().toLowerCase();
    if (!USERNAME_RE.test(cleanUsername)) {
      setError("Pick a username: 3–20 characters, lowercase letters, numbers, underscores.");
      setLoading(false);
      return;
    }
    if (usernameStatus !== "available") {
      setError(
        usernameStatus === "checking"
          ? "One moment — checking that username…"
          : "That username isn't available."
      );
      setLoading(false);
      return;
    }
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: { data: { username: cleanUsername } },
    });
    setLoading(false);
    if (error) {
      setError(error.message);
      return;
    }
    // If email confirmation is off in Supabase, session exists immediately.
    if (data.session) {
      router.push("/dashboard");
      router.refresh();
    } else {
      setDone(true);
    }
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
          <h1 className="text-3xl font-bold lowercase text-white mb-1">sign up</h1>
          <p className="text-[#a3a3a3] text-sm mb-6">Create your account.</p>

          <GoogleButton onClick={handleGoogle} loading={googleLoading} />
          <OrDivider />

          {done ? (
            <p className="text-white text-sm">
              Check your email to confirm your account, then sign in.
            </p>
          ) : (
            <form onSubmit={handleSubmit} className="flex flex-col gap-3">
              <div>
                <Input
                  type="text"
                  placeholder="Username"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  required
                  minLength={3}
                  maxLength={20}
                  autoComplete="username"
                />
                {statusNote && (
                  <p
                    className={
                      "mt-1.5 text-xs " +
                      (statusNote.tone === "good"
                        ? "text-[#22c55e]"
                        : statusNote.tone === "bad"
                          ? "text-[#ef4444]"
                          : "text-[#a3a3a3]")
                    }
                  >
                    {statusNote.text}
                  </p>
                )}
              </div>
              <Input
                type="email"
                placeholder="Email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                autoComplete="email"
              />
              <Input
                type="password"
                placeholder="Password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                minLength={6}
                autoComplete="new-password"
              />
              {error && <p className="text-[#ef4444] text-sm">{error}</p>}
              <PillButton type="submit" variant="primary" className="mt-2" disabled={!canSubmit}>
                {loading ? "Creating account…" : "Create account"}
              </PillButton>
            </form>
          )}

          <p className="text-[#a3a3a3] text-sm mt-6 text-center">
            Already have an account?{" "}
            <Link href="/sign-in" className="text-white underline">
              Sign in
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
