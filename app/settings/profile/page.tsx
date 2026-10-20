"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { NavBar } from "@/components/nav/NavBar";
import { Input } from "@/components/ui/Input";
import { PillButton } from "@/components/ui/PillButton";
import { useAuth } from "@/hooks/useAuth";
import { useMyAccount } from "@/hooks/useMyAccount";
import { createClient } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";
import {
  USERNAME_RE,
  useUsernameAvailability,
  usernameStatusText,
} from "@/hooks/useUsernameAvailability";

// Must stay in sync with CHANGE_INTERVAL in supabase/migrations/20261020_accounts.sql
// (the database is the source of truth — it also embeds the unlock date in errors).
const CHANGE_INTERVAL_DAYS = 30;

type Tab = "profile" | "account";

function unlockDate(usernameChangedAt: string): Date {
  const at = new Date(usernameChangedAt);
  at.setDate(at.getDate() + CHANGE_INTERVAL_DAYS);
  return at;
}

export default function SettingsProfilePage() {
  const { user, isAuthed, loading: authLoading } = useAuth();
  const { account, loading: accountLoading, refresh } = useMyAccount();
  const router = useRouter();
  const supabase = createClient();

  const [tab, setTab] = useState<Tab>("profile");

  // Profile tab state
  const [displayName, setDisplayName] = useState("");
  const [profileNote, setProfileNote] = useState<string | null>(null);
  const [newUsername, setNewUsername] = useState("");
  const [usernameError, setUsernameError] = useState<string | null>(null);
  const [usernameSaving, setUsernameSaving] = useState(false);

  // Account tab state
  const [newEmail, setNewEmail] = useState("");
  const [emailNote, setEmailNote] = useState<string | null>(null);
  const [emailSaving, setEmailSaving] = useState(false);
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [passwordNote, setPasswordNote] = useState<string | null>(null);
  const [passwordSaving, setPasswordSaving] = useState(false);

  useEffect(() => {
    if (!authLoading && !isAuthed) router.replace("/sign-in");
  }, [authLoading, isAuthed, router]);

  // Google users who haven't picked a username yet belong in onboarding.
  useEffect(() => {
    if (!accountLoading && account && !account.username_confirmed) {
      router.replace(`/onboarding/username?next=${encodeURIComponent("/settings/profile")}`);
    }
  }, [accountLoading, account, router]);

  // Seed the editable fields once per account load — refreshes after saves
  // must not clobber what the user is mid-typing.
  const [seededFor, setSeededFor] = useState<string | null>(null);
  useEffect(() => {
    if (account && seededFor !== account.id) {
      setSeededFor(account.id);
      setDisplayName(account.display_name ?? account.username);
      setNewEmail(user?.email ?? "");
    }
  }, [account, user?.email, seededFor]);

  const status = useUsernameAvailability(
    newUsername,
    account?.username ?? undefined
  );
  const statusNote = usernameStatusText(status);

  const lockedUntil =
    account?.username_confirmed && account.username_changed_at
      ? unlockDate(account.username_changed_at)
      : null;
  const changeLocked = !!lockedUntil && lockedUntil.getTime() > Date.now();

  // --- Profile: display name saves on a short debounce ("instantly") ---
  useEffect(() => {
    if (!account || !user) return;
    const value = displayName.trim();
    const original = account.display_name ?? account.username;
    if (!value || value === original) return;
    const timer = setTimeout(async () => {
      const { error } = await supabase
        .from("profiles")
        .update({ display_name: value })
        .eq("id", user.id);
      if (error) {
        setProfileNote(error.message);
      } else {
        setProfileNote("Saved.");
        refresh();
      }
    }, 600);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [displayName]);

  async function saveAvatarUrl(value: string) {
    if (!user || !account) return;
    const trimmed = value.trim();
    if (trimmed && !/^https?:\/\//i.test(trimmed)) {
      setProfileNote("Avatar URL must start with http:// or https://");
      return;
    }
    if (trimmed === (account.avatar_url ?? "")) return;
    const { error } = await supabase
      .from("profiles")
      .update({ avatar_url: trimmed || null })
      .eq("id", user.id);
    setProfileNote(error ? error.message : "Saved.");
    if (!error) refresh();
  }

  async function handleChangeUsername(e: React.FormEvent) {
    e.preventDefault();
    setUsernameError(null);
    const clean = newUsername.trim().toLowerCase();
    if (!USERNAME_RE.test(clean)) {
      setUsernameError("Usernames are 3–20 characters: lowercase letters, numbers, underscores.");
      return;
    }
    if (status !== "available") {
      setUsernameError("That username isn't available.");
      return;
    }
    setUsernameSaving(true);
    const { error } = await supabase.rpc("change_username", {
      p_new_username: clean,
    });
    setUsernameSaving(false);
    if (error) {
      setUsernameError(error.message);
      return;
    }
    setNewUsername("");
    refresh();
  }

  async function handleChangeEmail(e: React.FormEvent) {
    e.preventDefault();
    setEmailNote(null);
    setEmailSaving(true);
    const { error } = await supabase.auth.updateUser({ email: newEmail.trim() });
    setEmailSaving(false);
    setEmailNote(
      error
        ? error.message
        : "Check both your old and new email to confirm the change."
    );
  }

  async function handleChangePassword(e: React.FormEvent) {
    e.preventDefault();
    setPasswordNote(null);
    if (newPassword !== confirmPassword) {
      setPasswordNote("Passwords don't match.");
      return;
    }
    if (newPassword.length < 6) {
      setPasswordNote("Password must be at least 6 characters.");
      return;
    }
    setPasswordSaving(true);
    const { error } = await supabase.auth.updateUser({ password: newPassword });
    setPasswordSaving(false);
    if (error) {
      setPasswordNote(error.message);
      return;
    }
    setNewPassword("");
    setConfirmPassword("");
    setPasswordNote("Password updated.");
  }

  async function handleSignOut() {
    await supabase.auth.signOut();
    window.location.href = "/";
  }

  const provider = (user?.app_metadata?.provider as string) ?? "email";
  const isEmailUser = provider === "email";

  if (authLoading || !isAuthed || accountLoading || !account) {
    return (
      <div className="min-h-screen bg-page">
        <NavBar />
        <div className="px-4 md:px-8 py-10">
          <div className="h-10 w-40 rounded bg-black/5 dark:bg-white/10 animate-pulse mb-6" />
          <div className="h-72 max-w-2xl rounded-[26px] bg-black/5 dark:bg-white/10 animate-pulse" />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-page">
      <NavBar />
      <div className="px-4 md:px-8 py-10 max-w-2xl">
        <h1 className="text-3xl font-bold lowercase text-[#0a0a0a] dark:text-[#f5f5f5] mb-1">
          settings
        </h1>
        <p className="text-gray-500 dark:text-gray-400 mb-6">
          Your profile, how you sign in, and your account.
        </p>

        <div className="flex gap-1 bg-white/50 dark:bg-white/10 rounded-full px-1 py-1 mb-6 w-fit">
          {(["profile", "account"] as const).map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={cn(
                "px-5 py-2 rounded-full text-sm transition-colors",
                tab === t
                  ? "bg-white text-[#0a0a0a] dark:bg-[#0a0a0a] dark:text-white"
                  : "text-gray-600 dark:text-gray-300 hover:bg-white/60 dark:hover:bg-white/10"
              )}
            >
              {t}
            </button>
          ))}
        </div>

        {tab === "profile" ? (
          <div className="rounded-[26px] bg-card p-6 md:p-8 flex flex-col gap-8">
            {/* Avatar + display name */}
            <section>
              <h2 className="text-white font-bold mb-4">profile</h2>
              <div className="flex items-center gap-4 mb-4">
                {account.avatar_url ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={account.avatar_url}
                    alt=""
                    className="h-16 w-16 rounded-full object-cover bg-white/10"
                  />
                ) : (
                  <div
                    className="h-16 w-16 rounded-full flex items-center justify-center text-2xl font-bold text-white"
                    style={{ backgroundColor: account.avatar_color || "#5B8DEF" }}
                  >
                    {(account.display_name ?? account.username)[0]?.toUpperCase()}
                  </div>
                )}
                <div className="flex-1">
                  <label className="text-[#a3a3a3] text-xs block mb-1">Avatar image URL</label>
                  <Input
                    type="url"
                    placeholder="https://…"
                    defaultValue={account.avatar_url ?? ""}
                    onBlur={(e) => saveAvatarUrl(e.target.value)}
                  />
                </div>
              </div>

              <label className="text-[#a3a3a3] text-xs block mb-1">Display name</label>
              <Input
                type="text"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                maxLength={30}
                placeholder="How you appear to other players"
              />
              <p className="text-[#a3a3a3] text-xs mt-1.5">
                Shown as your main name across the site.{" "}
                {profileNote && (
                  <span
                    className={
                      profileNote === "Saved." ? "text-[#22c55e]" : "text-[#ef4444]"
                    }
                  >
                    {profileNote}
                  </span>
                )}
              </p>
            </section>

            {/* Username */}
            <section>
              <h3 className="text-white font-bold mb-1">username</h3>
              <p className="text-[#a3a3a3] text-sm mb-3">
                Your public handle: <span className="text-white">@{account.username}</span> —{" "}
                <Link href={`/member/${account.username}`} className="text-white underline">
                  view public profile
                </Link>
              </p>

              <form onSubmit={handleChangeUsername} className="flex flex-col gap-3">
                <div>
                  <Input
                    type="text"
                    value={newUsername}
                    onChange={(e) => setNewUsername(e.target.value)}
                    placeholder="New username"
                    maxLength={20}
                    disabled={changeLocked}
                  />
                  {changeLocked && (
                    <p className="mt-1.5 text-xs text-[#a3a3a3]">
                      Locked until{" "}
                      {lockedUntil?.toLocaleDateString(undefined, {
                        year: "numeric",
                        month: "short",
                        day: "numeric",
                      })}
                      .
                    </p>
                  )}
                  {!changeLocked && statusNote && (
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
                {usernameError && (
                  <p className="text-[#ef4444] text-sm">{usernameError}</p>
                )}
                <div className="flex items-center gap-3">
                  <PillButton
                    type="submit"
                    variant="secondary"
                    disabled={changeLocked || status !== "available" || usernameSaving}
                  >
                    {usernameSaving ? "Saving…" : "Change username"}
                  </PillButton>
                  <span className="text-[#a3a3a3] text-xs">
                    You can change your username once every {CHANGE_INTERVAL_DAYS} days.
                  </span>
                </div>
              </form>
            </section>

            {/* Sign-in method */}
            <section>
              <h3 className="text-white font-bold mb-2">sign-in method</h3>
              <div className="rounded-2xl bg-card-alt px-4 py-3 text-sm text-white w-fit">
                {provider === "google" ? "Google" : "Email"}
                <span className="text-[#a3a3a3]"> · {user?.email}</span>
              </div>
            </section>
          </div>
        ) : (
          <div className="rounded-[26px] bg-card p-6 md:p-8 flex flex-col gap-8">
            {/* Email */}
            <section>
              <h2 className="text-white font-bold mb-3">email</h2>
              <form onSubmit={handleChangeEmail} className="flex flex-col gap-3">
                <Input
                  type="email"
                  value={newEmail}
                  onChange={(e) => setNewEmail(e.target.value)}
                  placeholder="New email"
                  required
                  autoComplete="email"
                />
                {emailNote && <p className="text-[#a3a3a3] text-sm">{emailNote}</p>}
                <div>
                  <PillButton
                    type="submit"
                    variant="secondary"
                    disabled={emailSaving || !newEmail.trim() || newEmail.trim() === user?.email}
                  >
                    {emailSaving ? "Saving…" : "Update email"}
                  </PillButton>
                </div>
              </form>
            </section>

            {/* Password — only meaningful for email/password accounts */}
            {isEmailUser && (
              <section>
                <h3 className="text-white font-bold mb-3">password</h3>
                <form onSubmit={handleChangePassword} className="flex flex-col gap-3">
                  <Input
                    type="password"
                    placeholder="New password"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    required
                    minLength={6}
                    autoComplete="new-password"
                  />
                  <Input
                    type="password"
                    placeholder="Confirm new password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    required
                    minLength={6}
                    autoComplete="new-password"
                  />
                  {passwordNote && <p className="text-[#a3a3a3] text-sm">{passwordNote}</p>}
                  <div>
                    <PillButton type="submit" variant="secondary" disabled={passwordSaving}>
                      {passwordSaving ? "Saving…" : "Update password"}
                    </PillButton>
                  </div>
                </form>
              </section>
            )}

            {!isEmailUser && (
              <section>
                <h3 className="text-white font-bold mb-3">password</h3>
                <p className="text-[#a3a3a3] text-sm">
                  You sign in with Google, so this account has no password.
                </p>
              </section>
            )}

            {/* Sign out */}
            <section>
              <h3 className="text-white font-bold mb-3">session</h3>
              <PillButton variant="danger" onClick={handleSignOut}>
                Sign out
              </PillButton>
            </section>
          </div>
        )}
      </div>
    </div>
  );
}
