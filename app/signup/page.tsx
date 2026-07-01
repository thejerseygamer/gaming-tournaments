"use client";

import Link from "next/link";
import type { FormEvent } from "react";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "../lib/supabase";

export default function SignupPage() {
  const router = useRouter();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [gamerTag, setGamerTag] = useState("");
  const [platform, setPlatform] = useState("");
  const [favoriteTeam, setFavoriteTeam] = useState("");

  const [creating, setCreating] = useState(false);
  const [message, setMessage] = useState("");

  async function createAccount(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!email.trim()) {
      setMessage("Email is required.");
      return;
    }

    if (!password.trim()) {
      setMessage("Password is required.");
      return;
    }

    if (password.length < 6) {
      setMessage("Password must be at least 6 characters.");
      return;
    }

    if (!gamerTag.trim()) {
      setMessage("Gamer tag is required.");
      return;
    }

    setCreating(true);
    setMessage("");

    const emailRedirectTo =
      typeof window !== "undefined"
        ? `${window.location.origin}/auth/callback?next=/login`
        : undefined;

    const { data, error } = await supabase.auth.signUp({
      email: email.trim(),
      password,
      options: {
        emailRedirectTo,
        data: {
          gamer_tag: gamerTag.trim(),
          platform: platform.trim() || null,
          favorite_team: favoriteTeam.trim() || null,
        },
      },
    });

    if (error) {
      setMessage(`Signup error: ${error.message}`);
      setCreating(false);
      return;
    }

    if (data.user && data.session) {
      const { error: profileError } = await supabase.from("profiles").upsert({
        id: data.user.id,
        gamer_tag: gamerTag.trim(),
        platform: platform.trim() || null,
        favorite_team: favoriteTeam.trim() || null,
        is_admin: false,
        updated_at: new Date().toISOString(),
      });

      if (profileError) {
        setMessage(
          `Account created, but profile save failed: ${profileError.message}`
        );
        setCreating(false);
        return;
      }

      router.push("/profile");
      router.refresh();
      return;
    }

    setMessage(
      "Account created. Check your email to confirm your account, then log in."
    );

    setEmail("");
    setPassword("");
    setGamerTag("");
    setPlatform("");
    setFavoriteTeam("");
    setCreating(false);
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
            Join BattleGrid
          </p>

          <h1 className="mb-3 text-4xl font-black">Create Account</h1>

          <p className="mb-6 text-gray-400">
            Sign up to join tournaments, submit scores, track your record, and
            climb the leaderboard.
          </p>

          {message && (
            <p className="mb-5 rounded-lg border border-yellow-800 bg-yellow-950/30 p-4 text-sm text-yellow-200">
              {message}
            </p>
          )}

          <form onSubmit={createAccount} className="grid gap-4">
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
              <label className="mb-2 block text-sm text-gray-400">
                Password
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
                Gamer Tag
              </label>

              <input
                className="w-full rounded-lg border border-gray-700 bg-black px-4 py-3 text-white"
                placeholder="TheJerseyGamer"
                value={gamerTag}
                onChange={(event) => setGamerTag(event.target.value)}
              />
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <div>
                <label className="mb-2 block text-sm text-gray-400">
                  Platform
                </label>

                <input
                  className="w-full rounded-lg border border-gray-700 bg-black px-4 py-3 text-white"
                  placeholder="PS5 / Xbox / PC"
                  value={platform}
                  onChange={(event) => setPlatform(event.target.value)}
                />
              </div>

              <div>
                <label className="mb-2 block text-sm text-gray-400">
                  Favorite Team
                </label>

                <input
                  className="w-full rounded-lg border border-gray-700 bg-black px-4 py-3 text-white"
                  placeholder="Eagles, Cowboys, Giants..."
                  value={favoriteTeam}
                  onChange={(event) => setFavoriteTeam(event.target.value)}
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={creating}
              className="rounded-lg bg-white px-5 py-3 font-bold text-black hover:bg-gray-200 disabled:opacity-50"
            >
              {creating ? "Creating Account..." : "Create Account"}
            </button>
          </form>

          <div className="mt-6 rounded-xl border border-gray-800 bg-black p-4">
            <p className="text-sm text-gray-400">Already have an account?</p>

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