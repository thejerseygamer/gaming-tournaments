"use client";

import Link from "next/link";
import type { FormEvent } from "react";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "../lib/supabase";

export default function ResetPasswordPage() {
  const router = useRouter();

  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");

  async function updatePassword(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!password.trim()) {
      setMessage("New password is required.");
      return;
    }

    if (password.length < 6) {
      setMessage("Password must be at least 6 characters.");
      return;
    }

    if (password !== confirmPassword) {
      setMessage("Passwords do not match.");
      return;
    }

    setSaving(true);
    setMessage("");

    const { error } = await supabase.auth.updateUser({
      password,
    });

    if (error) {
      setMessage(`Password update error: ${error.message}`);
      setSaving(false);
      return;
    }

    setMessage("Password updated. Redirecting to login...");

    await supabase.auth.signOut();

    window.setTimeout(() => {
      router.push("/login");
      router.refresh();
    }, 1000);
  }

  return (
    <main className="min-h-screen bg-black p-6 text-white">
      <div className="mx-auto max-w-xl">
        <div className="mb-6">
          <Link href="/login" className="text-sm text-gray-400 hover:text-white">
            ← Back to Login
          </Link>
        </div>

        <section className="rounded-2xl border border-gray-800 bg-gray-950 p-6">
          <p className="mb-3 text-sm font-bold uppercase tracking-[0.25em] text-red-500">
            Account Recovery
          </p>

          <h1 className="mb-3 text-4xl font-black">Reset Password</h1>

          <p className="mb-6 text-gray-400">
            Enter a new password for your BattleGrid account.
          </p>

          {message && (
            <p className="mb-5 rounded-lg border border-yellow-800 bg-yellow-950/30 p-4 text-sm text-yellow-200">
              {message}
            </p>
          )}

          <form onSubmit={updatePassword} className="grid gap-4">
            <div>
              <label className="mb-2 block text-sm text-gray-400">
                New Password
              </label>

              <input
                type="password"
                className="w-full rounded-lg border border-gray-700 bg-black px-4 py-3 text-white"
                placeholder="At least 6 characters"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
              />
            </div>

            <div>
              <label className="mb-2 block text-sm text-gray-400">
                Confirm New Password
              </label>

              <input
                type="password"
                className="w-full rounded-lg border border-gray-700 bg-black px-4 py-3 text-white"
                placeholder="Re-enter password"
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

          <div className="mt-6 rounded-xl border border-gray-800 bg-black p-4">
            <p className="text-sm text-gray-400">
              Already reset your password?
            </p>

            <Link
              href="/login"
              className="mt-3 inline-block rounded-lg border border-gray-700 px-5 py-3 text-sm font-bold text-white hover:bg-gray-900"
            >
              Login
            </Link>
          </div>
        </section>
      </div>
    </main>
  );
}