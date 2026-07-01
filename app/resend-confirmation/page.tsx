"use client";

import Link from "next/link";
import type { FormEvent } from "react";
import { useState } from "react";
import { supabase } from "../lib/supabase";

export default function ResendConfirmationPage() {
  const [email, setEmail] = useState("");
  const [sending, setSending] = useState(false);
  const [message, setMessage] = useState("");

  async function resendConfirmation(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!email.trim()) {
      setMessage("Email is required.");
      return;
    }

    setSending(true);
    setMessage("");

    const emailRedirectTo =
      typeof window !== "undefined"
        ? `${window.location.origin}/auth/callback?next=/login`
        : undefined;

    const { error } = await supabase.auth.resend({
      type: "signup",
      email: email.trim(),
      options: {
        emailRedirectTo,
      },
    });

    if (error) {
      setMessage(`Confirmation email error: ${error.message}`);
      setSending(false);
      return;
    }

    setMessage("Confirmation email sent. Check your inbox and spam folder.");
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
            Account Confirmation
          </p>

          <h1 className="mb-3 text-4xl font-black">Resend Confirmation</h1>

          <p className="mb-6 text-gray-400">
            Enter the email you used to create your BattleGrid account and we
            will resend the confirmation link.
          </p>

          {message && (
            <p className="mb-5 rounded-lg border border-yellow-800 bg-yellow-950/30 p-4 text-sm text-yellow-200">
              {message}
            </p>
          )}

          <form onSubmit={resendConfirmation} className="grid gap-4">
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
              {sending ? "Sending..." : "Resend Confirmation Email"}
            </button>
          </form>

          <div className="mt-6 grid gap-3 rounded-xl border border-gray-800 bg-black p-4">
            <p className="text-sm text-gray-400">
              Already confirmed your account?
            </p>

            <div className="flex flex-col gap-3 sm:flex-row">
              <Link
                href="/login"
                className="rounded-lg border border-gray-700 px-5 py-3 text-center text-sm font-bold text-white hover:bg-gray-900"
              >
                Login
              </Link>

              <Link
                href="/signup"
                className="rounded-lg border border-gray-700 px-5 py-3 text-center text-sm font-bold text-white hover:bg-gray-900"
              >
                Create Account
              </Link>
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}