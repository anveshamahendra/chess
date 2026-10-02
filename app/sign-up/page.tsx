"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { NavBar } from "@/components/nav/NavBar";
import { Input } from "@/components/ui/Input";
import { PillButton } from "@/components/ui/PillButton";
import { createClient } from "@/lib/supabase/client";

export default function SignUpPage() {
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);
  const router = useRouter();
  const supabase = createClient();

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: { data: { username } },
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

  return (
    <div className="min-h-screen bg-[#f2f2f0]">
      <NavBar />
      <div className="flex justify-center px-4 py-10">
        <div className="w-full max-w-sm rounded-[26px] bg-[#0a0a0a] p-8">
          <h1 className="text-3xl font-bold lowercase text-white mb-1">sign up</h1>
          <p className="text-[#a3a3a3] text-sm mb-6">Create your account.</p>

          {done ? (
            <p className="text-white text-sm">
              Check your email to confirm your account, then sign in.
            </p>
          ) : (
            <form onSubmit={handleSubmit} className="flex flex-col gap-3">
              <Input
                type="text"
                placeholder="Username"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                required
                minLength={3}
                maxLength={20}
              />
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
                minLength={6}
              />
              {error && <p className="text-[#ef4444] text-sm">{error}</p>}
              <PillButton type="submit" variant="primary" className="mt-2" disabled={loading}>
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
