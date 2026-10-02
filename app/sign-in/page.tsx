"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { NavBar } from "@/components/nav/NavBar";
import { Input } from "@/components/ui/Input";
import { PillButton } from "@/components/ui/PillButton";
import { createClient } from "@/lib/supabase/client";

export default function SignInPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const router = useRouter();
  const supabase = createClient();

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
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

  return (
    <div className="min-h-screen bg-[#f2f2f0]">
      <NavBar />
      <div className="flex justify-center px-4 py-10">
        <div className="w-full max-w-sm rounded-[26px] bg-[#0a0a0a] p-8">
          <h1 className="text-3xl font-bold lowercase text-white mb-1">sign in</h1>
          <p className="text-[#a3a3a3] text-sm mb-6">Welcome back.</p>

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
          </form>

          <p className="text-[#a3a3a3] text-sm mt-6 text-center">
            No account?{" "}
            <Link href="/sign-up" className="text-white underline">
              Sign up
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
