"use client";

import Link from "next/link";
import { useState } from "react";
import { Sun } from "lucide-react";
import { PillButton } from "@/components/ui/PillButton";
import { SoundToggle } from "@/components/ui/SoundToggle";
import { useAuth } from "@/hooks/useAuth";
import { createClient } from "@/lib/supabase/client";

const links = [
  { label: "play", href: "/play/new" },
  { label: "puzzles", href: "/puzzles" },
  { label: "dashboard", href: "/dashboard" },
  { label: "leaderboard", href: "/leaderboard" },
];

export function NavBar() {
  const { user, isAuthed } = useAuth();
  const [menuOpen, setMenuOpen] = useState(false);
  const supabase = createClient();

  return (
    <nav className="flex items-center justify-between px-4 md:px-8 py-5">
      <Link href="/" className="text-xl font-bold">
        ♟ Chess
      </Link>

      <div className="hidden md:flex items-center gap-1 bg-white/50 rounded-full px-1 py-1">
        {links.map((link) => (
          <Link
            key={link.href}
            href={link.href}
            className="px-4 py-2 rounded-full text-sm text-gray-700 hover:bg-white transition-colors"
          >
            {link.label}
          </Link>
        ))}
      </div>

      <div className="flex items-center gap-3">
        <SoundToggle />
        <button className="p-2 text-gray-600 hover:text-black" aria-label="Toggle theme">
          <Sun size={18} />
        </button>
        {isAuthed ? (
          <div className="relative">
            <button
              onClick={() => setMenuOpen((v) => !v)}
              className="h-9 w-9 rounded-full bg-violet-500 flex items-center justify-center text-white text-sm font-bold"
            >
              {user?.email?.[0].toUpperCase() ?? "?"}
            </button>
            {menuOpen && (
              <div className="absolute right-0 mt-2 w-44 rounded-2xl bg-[#0a0a0a] p-2 shadow-xl z-50">
                <Link
                  href="/dashboard"
                  className="block px-3 py-2 rounded-xl text-sm text-white hover:bg-white/10"
                  onClick={() => setMenuOpen(false)}
                >
                  Dashboard
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
