"use client";

import Link from "next/link";
import { useState } from "react";
import { PillButton } from "@/components/ui/PillButton";
import { SoundToggle } from "@/components/ui/SoundToggle";
import { ThemeToggle } from "@/components/ui/ThemeToggle";
import { useAuth } from "@/hooks/useAuth";
import { useMyAccount } from "@/hooks/useMyAccount";
import { createClient } from "@/lib/supabase/client";

const links = [
  { label: "play", href: "/play/new" },
  { label: "puzzles", href: "/puzzles" },
  { label: "dashboard", href: "/dashboard" },
  { label: "leaderboard", href: "/leaderboard" },
];

export function NavBar() {
  const { user, isAuthed } = useAuth();
  const { account } = useMyAccount();
  const [menuOpen, setMenuOpen] = useState(false);
  const supabase = createClient();

  const displayName = account?.display_name ?? account?.username ?? user?.email;
  const initial = (displayName ?? "?")[0]?.toUpperCase() ?? "?";

  return (
    <nav className="flex items-center justify-between px-4 md:px-8 py-5">
      <Link href="/" className="text-xl font-bold">
        ♟ Chess
      </Link>

      <div className="hidden md:flex items-center gap-1 bg-white/50 dark:bg-white/10 rounded-full px-1 py-1">
        {links.map((link) => (
          <Link
            key={link.href}
            href={link.href}
            className="px-4 py-2 rounded-full text-sm text-gray-700 hover:bg-white dark:text-gray-300 dark:hover:bg-white/20 transition-colors"
          >
            {link.label}
          </Link>
        ))}
      </div>

      <div className="flex items-center gap-3">
        <SoundToggle />
        <ThemeToggle />
        {isAuthed ? (
          <div className="relative">
            <button
              onClick={() => setMenuOpen((v) => !v)}
              className="h-9 w-9 rounded-full bg-violet-500 flex items-center justify-center text-white text-sm font-bold overflow-hidden"
              aria-label="Account menu"
            >
              {account?.avatar_url ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={account.avatar_url} alt="" className="h-full w-full object-cover" />
              ) : (
                initial
              )}
            </button>
            {menuOpen && (
              <div className="absolute right-0 mt-2 w-52 rounded-2xl bg-card p-2 shadow-xl z-50">
                <div className="px-3 py-2 border-b border-white/10 mb-1">
                  <p className="text-white text-sm font-medium truncate">
                    {displayName}
                  </p>
                  {account?.username && (
                    <p className="text-[#a3a3a3] text-xs truncate">@{account.username}</p>
                  )}
                </div>
                <Link
                  href="/dashboard"
                  className="block px-3 py-2 rounded-xl text-sm text-white hover:bg-white/10"
                  onClick={() => setMenuOpen(false)}
                >
                  Dashboard
                </Link>
                <Link
                  href="/settings/profile"
                  className="block px-3 py-2 rounded-xl text-sm text-white hover:bg-white/10"
                  onClick={() => setMenuOpen(false)}
                >
                  Settings
                </Link>
                <button
                  onClick={async () => {
                    await supabase.auth.signOut();
                    setMenuOpen(false);
                    window.location.href = "/";
                  }}
                  className="w-full text-left px-3 py-2 rounded-xl text-sm text-white hover:bg-white/10"
                >
                  Sign out
                </button>
              </div>
            )}
          </div>
        ) : (
          <Link href="/sign-in">
            <PillButton variant="secondary">Sign in</PillButton>
          </Link>
        )}
      </div>
    </nav>
  );
}
