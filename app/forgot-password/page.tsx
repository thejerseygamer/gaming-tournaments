"use client";

import Link from "next/link";
import type { FormEvent } from "react";
import { useState } from "react";
import { supabase } from "../lib/supabase";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [sending, setSending] = useState(false);
  const [message, setMessage] = useState("");

  async function sendResetEmail(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!email.trim()) {
      setMessage("Email is required.");
      return;
    }

    setSending(true);
    setMessage("");

    const redirectTo =
      typeof window !== "undefined"
        ? `${window.location.origin}/auth/callback?next=/reset-password`
        : undefined;

    const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), {
      redirectTo,
    });

    if (error) {
      setMessage(`Password reset error: ${error.message}`);
      setSending(false);
      return;
    }

    setMessage("Password reset email sent. Check your inbox.");
    setEmail("");
    setSending(false);
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

          <h1 className="mb-3 text-4xl font-black">Forgot Password</h1>

          <p className="mb-6 text-gray-400">
            Enter your account email and BattleGrid will send you a password
            reset link.
          </p>

          {message && (
            <p className="mb-5 rounded-lg border border-yellow-800 bg-yellow-950/30 p-4 text-sm text-yellow-200">
              {message}
            </p>
          )}

          <form onSubmit={sendResetEmail} className="grid gap-4">
            <div>
              <label className="mb-2 block text-sm text-gray-400">Email</label>

              <input
                type="email"
                className="w-full rounded-lg border border-gray-700 bg-black px-4 py-3 text-white"
                placeholder="you@example.com"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
              />
            </div>

            <button
              type="submit"
              disabled={sending}
              className="rounded-lg bg-white px-5 py-3 font-bold text-black hover:bg-gray-200 disabled:opacity-50"
            >
              {sending ? "Sending..." : "Send Reset Link"}
            </button>
          </form>

          <div className="mt-6 rounded-xl border border-gray-800 bg-black p-4">
            <p className="text-sm text-gray-400">Remembered your password?</p>

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