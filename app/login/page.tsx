"use client";

import Link from "next/link";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "../lib/supabase";

export default function LoginPage() {
  const router = useRouter();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");

  async function handleLogin(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    setMessage("");

    if (!email.trim() || !password) {
      setMessage("Email and password are required.");
      setLoading(false);
      return;
    }

    const { error } = await supabase.auth.signInWithPassword({
      email: email.trim(),
      password,
    });

    if (error) {
      setMessage(error.message);
      setLoading(false);
      return;
    }

    setMessage("Logged in successfully.");
    router.push("/tournaments");
    router.refresh();

    setLoading(false);
  }

  return (
    <main className="min-h-screen bg-black p-6 text-white">
      <div className="mx-auto max-w-md">
        <Link
          href="/tournaments"
          className="mb-6 inline-block text-sm text-gray-400 hover:text-white"
        >
          ← Back to Tournaments
        </Link>

        <section className="rounded-xl border border-gray-800 bg-gray-950 p-6">
          <h1 className="mb-2 text-4xl font-bold">Log In</h1>
          <p className="mb-6 text-gray-400">
            Log in to join tournaments and track your BattleGrid profile.
          </p>

          <form onSubmit={handleLogin} className="grid gap-4">
            <div>
              <label className="mb-1 block text-sm text-gray-400">Email</label>
              <input
                type="email"
                className="w-full rounded-lg border border-gray-700 bg-black px-4 py-3 text-white"
                placeholder="you@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>

            <div>
              <label className="mb-1 block text-sm text-gray-400">
                Password
              </label>
              <input
                type="password"
                className="w-full rounded-lg border border-gray-700 bg-black px-4 py-3 text-white"
                placeholder="Your password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="rounded-lg bg-white px-5 py-3 font-bold text-black hover:bg-gray-200 disabled:opacity-50"
            >
              {loading ? "Logging In..." : "Log In"}
            </button>
          </form>

          {message && (
            <p className="mt-4 rounded-lg border border-gray-800 bg-black p-3 text-sm text-gray-300">
              {message}
            </p>
          )}

          <p className="mt-6 text-sm text-gray-400">
            Need an account?{" "}
            <Link
              href="/signup"
              className="font-bold text-white hover:underline"
            >
              Sign up
            </Link>
          </p>
        </section>
      </div>
    </main>
  );
}