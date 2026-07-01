"use client";

import Link from "next/link";
import type { FormEvent } from "react";
import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "../../lib/supabase";

export default function AccountSecurityPage() {
  const router = useRouter();

  const [userEmail, setUserEmail] = useState("");
  const [checkingUser, setCheckingUser] = useState(true);

  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  const [saving, setSaving] = useState(false);
  const [signingOut, setSigningOut] = useState(false);
  const [message, setMessage] = useState("");

  const loadUser = useCallback(async () => {
    setCheckingUser(true);
    setMessage("");

    const {
      data: { user },
      error,
    } = await supabase.auth.getUser();

    if (error || !user) {
      router.push("/login");
      return;
    }

    setUserEmail(user.email || "");
    setCheckingUser(false);
  }, [router]);

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      void loadUser();
    }, 0);

    return () => {
      window.clearTimeout(timeoutId);
    };
  }, [loadUser]);

  async function updatePassword(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!newPassword.trim()) {
      setMessage("New password is required.");
      return;
    }

    if (newPassword.length < 6) {
      setMessage("Password must be at least 6 characters.");
      return;
    }

    if (newPassword !== confirmPassword) {
      setMessage("Passwords do not match.");
      return;
    }

    setSaving(true);
    setMessage("");

    const { error } = await supabase.auth.updateUser({
      password: newPassword,
    });

    if (error) {
      setMessage(`Password update error: ${error.message}`);
      setSaving(false);
      return;
    }

    setNewPassword("");
    setConfirmPassword("");
    setSaving(false);
    setMessage("Password updated successfully.");
  }

  async function signOut() {
    setSigningOut(true);

    await supabase.auth.signOut();

    setUserEmail("");
    setSigningOut(false);

    router.push("/login");
    router.refresh();
  }

  if (checkingUser) {
    return (
      <main className="min-h-screen bg-black p-6 text-white">
        <div className="mx-auto max-w-5xl">
          <p className="rounded-xl border border-gray-800 bg-gray-950 p-6 text-gray-400">
            Checking account...
          </p>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-black p-6 text-white">
      <div className="mx-auto max-w-5xl">
        <div className="mb-6 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <Link href="/profile" className="text-sm text-gray-400 hover:text-white">
            ← Back to Profile
          </Link>

          <Link
            href="/my-tournaments"
            className="text-sm text-gray-400 hover:text-white"
          >
            My Tournaments →
          </Link>
        </div>

        <section className="mb-8 rounded-2xl border border-gray-800 bg-gray-950 p-6">
          <p className="mb-3 text-sm font-bold uppercase tracking-[0.25em] text-red-500">
            Account Settings
          </p>

          <h1 className="mb-3 text-4xl font-black">Security</h1>

          <p className="max-w-2xl text-gray-400">
            Update your BattleGrid password and manage your current login
            session.
          </p>
        </section>

        {message && (
          <p className="mb-6 rounded-lg border border-yellow-800 bg-yellow-950/30 p-4 text-sm text-yellow-200">
            {message}
          </p>
        )}

        <section className="grid gap-6 lg:grid-cols-[1fr_360px]">
          <section className="rounded-xl border border-gray-800 bg-gray-950 p-6">
            <h2 className="mb-5 text-2xl font-bold">Change Password</h2>

            <form onSubmit={updatePassword} className="grid gap-4">
              <div>
                <label className="mb-2 block text-sm text-gray-400">
                  New Password
                </label>

                <input
                  type="password"
                  className="w-full rounded-lg border border-gray-700 bg-black px-4 py-3 text-white"
                  placeholder="At least 6 characters"
                  value={newPassword}
                  onChange={(event) => setNewPassword(event.target.value)}
                />
              </div>

              <div>
                <label className="mb-2 block text-sm text-gray-400">
                  Confirm New Password
                </label>

                <input
                  type="password"
                  className="w-full rounded-lg border border-gray-700 bg-black px-4 py-3 text-white"
                  placeholder="Re-enter new password"
                  value={confirmPassword}
                  onChange={(event) => setConfirmPassword(event.target.value)}
                />
              </div>

              <button
                type="submit"
                disabled={saving}
                className="rounded-lg bg-white px-5 py-3 font-bold text-black hover:bg-gray-200 disabled:opacity-50"
              >
                {saving ? "Updating..." : "Update Password"}
              </button>
            </form>
          </section>

          <aside className="grid h-fit gap-6">
            <section className="rounded-xl border border-gray-800 bg-gray-950 p-6">
              <h2 className="mb-4 text-2xl font-bold">Current Account</h2>

              <p className="text-sm text-gray-500">Email</p>

              <p className="mt-2 break-all font-bold text-white">
                {userEmail || "Not set"}
              </p>
            </section>

            <section className="rounded-xl border border-red-900 bg-red-950/20 p-6">
              <h2 className="mb-3 text-2xl font-bold text-red-200">
                Session
              </h2>

              <p className="mb-5 text-sm leading-6 text-gray-300">
                Sign out of this browser session when you are finished using
                BattleGrid.
              </p>

              <button
                type="button"
                onClick={signOut}
                disabled={signingOut}
                className="w-full rounded-lg border border-red-700 px-5 py-3 font-bold text-red-300 hover:bg-red-950/40 disabled:opacity-50"
              >
                {signingOut ? "Signing Out..." : "Sign Out"}
              </button>
            </section>

            <section className="rounded-xl border border-gray-800 bg-gray-950 p-6">
              <h2 className="mb-4 text-2xl font-bold">Quick Links</h2>

              <div className="grid gap-3">
                <Link
                  href="/profile"
                  className="rounded-lg bg-white px-5 py-3 text-center font-bold text-black hover:bg-gray-200"
                >
                  Edit Profile
                </Link>

                <Link
                  href="/forgot-password"
                  className="rounded-lg border border-gray-700 px-5 py-3 text-center font-bold text-white hover:bg-gray-900"
                >
                  Forgot Password
                </Link>
              </div>
            </section>
          </aside>
        </section>
      </div>
    </main>
  );
}