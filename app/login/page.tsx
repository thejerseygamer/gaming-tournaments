"use client";

import Link from "next/link";
import type { FormEvent } from "react";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "../lib/supabase";

type Profile = {
  id: string;
  is_admin: boolean | null;
};

export default function LoginPage() {
  const router = useRouter();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const [loggingIn, setLoggingIn] = useState(false);
  const [message, setMessage] = useState("");

  async function repairMissingProfile(userId: string, userEmail: string) {
    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("id, is_admin")
      .eq("id", userId)
      .maybeSingle();

    if (profileError) {
      return {
        profile: null,
        error: profileError.message,
      };
    }

    if (profile) {
      return {
        profile: profile as Profile,
        error: "",
      };
    }

    const fallbackGamerTag = userEmail.includes("@")
      ? userEmail.split("@")[0]
      : "New Player";

    const { error: insertError } = await supabase.from("profiles").insert({
      id: userId,
      gamer_tag: fallbackGamerTag,
      platform: null,
      favorite_team: null,
      is_admin: false,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    });

    if (insertError) {
      return {
        profile: null,
        error: insertError.message,
      };
    }

    return {
      profile: {
        id: userId,
        is_admin: false,
      } as Profile,
      error: "",
    };
  }

  async function login(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!email.trim()) {
      setMessage("Email is required.");
      return;
    }

    if (!password.trim()) {
      setMessage("Password is required.");
      return;
    }

    setLoggingIn(true);
    setMessage("");

    const { data, error } = await supabase.auth.signInWithPassword({
      email: email.trim(),
      password,
    });

    if (error) {
      setMessage(`Login error: ${error.message}`);
      setLoggingIn(false);
      return;
    }

    if (!data.user) {
      setMessage("Login failed. Please try again.");
      setLoggingIn(false);
      return;
    }

    const repairedProfile = await repairMissingProfile(
      data.user.id,
      data.user.email || email.trim()
    );

    if (repairedProfile.error) {
      setMessage(
        `Login worked, but profile check failed: ${repairedProfile.error}`
      );
      setLoggingIn(false);
      return;
    }

    setEmail("");
    setPassword("");
    setLoggingIn(false);

    if (repairedProfile.profile?.is_admin) {
      router.push("/admin");
    } else {
      router.push("/my-tournaments");
    }

    router.refresh();
  }

  return (
    <main className="min-h-screen bg-black p-6 text-white">
      <div className="mx-auto max-w-xl">
        <div className="mb-6">
          <Link href="/" className="text-sm text-gray-400 hover:text-white">
            ← Back Home
          </Link>
        </div>

        <section className="rounded-2xl border border-gray-800 bg-gray-950 p-6">
          <p className="mb-3 text-sm font-bold uppercase tracking-[0.25em] text-red-500">
            Welcome Back
          </p>

          <h1 className="mb-3 text-4xl font-black">Login</h1>

          <p className="mb-6 text-gray-400">
            Log in to join tournaments, submit scores, view notifications, and
            manage your BattleGrid profile.
          </p>

          {message && (
            <p className="mb-5 rounded-lg border border-yellow-800 bg-yellow-950/30 p-4 text-sm text-yellow-200">
              {message}
            </p>
          )}

          <form onSubmit={login} className="grid gap-4">
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

            <div>
              <div className="mb-2 flex items-center justify-between gap-3">
                <label className="block text-sm text-gray-400">Password</label>

                <Link
                  href="/forgot-password"
                  className="text-sm text-red-300 hover:text-red-200"
                >
                  Forgot password?
                </Link>
              </div>

              <input
                type="password"
                className="w-full rounded-lg border border-gray-700 bg-black px-4 py-3 text-white"
                placeholder="Your password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
              />
            </div>

            <button
              type="submit"
              disabled={loggingIn}
              className="rounded-lg bg-white px-5 py-3 font-bold text-black hover:bg-gray-200 disabled:opacity-50"
            >
              {loggingIn ? "Logging In..." : "Login"}
            </button>
          </form>

          <div className="mt-6 grid gap-4 rounded-xl border border-gray-800 bg-black p-4">
            <div>
              <p className="text-sm text-gray-400">
                New to BattleGrid? Create an account to start competing.
              </p>

              <Link
                href="/signup"
                className="mt-3 inline-block rounded-lg border border-gray-700 px-5 py-3 text-sm font-bold text-white hover:bg-gray-900"
              >
                Create Account
              </Link>
            </div>

            <div className="border-t border-gray-800 pt-4">
              <p className="text-sm text-gray-400">
                Did not receive your confirmation email?
              </p>

              <Link
                href="/resend-confirmation"
                className="mt-3 inline-block rounded-lg border border-red-800 px-5 py-3 text-sm font-bold text-red-300 hover:bg-red-950/40"
              >
                Resend Confirmation
              </Link>
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}