"use client";

import Link from "next/link";
import type { FormEvent } from "react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "../lib/supabase";

type Profile = {
  id: string;
  gamer_tag: string | null;
  platform: string | null;
  favorite_team: string | null;
  is_admin: boolean | null;
  created_at: string | null;
  updated_at: string | null;
};

type PlayerStats = {
  id: string;
  gamer_tag: string | null;
  platform: string | null;
  favorite_team: string | null;
  tournaments_joined: number;
  matches_played: number;
  wins: number;
  losses: number;
  tournaments_won: number;
  win_percentage: number;
  last_match_at: string | null;
};

function formatDateTime(value: string | null) {
  if (!value) return "Not set";

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) return "Not set";

  return date.toLocaleString();
}

export default function ProfilePage() {
  const router = useRouter();

  const [userId, setUserId] = useState("");
  const [userEmail, setUserEmail] = useState("");

  const [profile, setProfile] = useState<Profile | null>(null);
  const [stats, setStats] = useState<PlayerStats | null>(null);

  const [gamerTag, setGamerTag] = useState("");
  const [platform, setPlatform] = useState("");
  const [favoriteTeam, setFavoriteTeam] = useState("");

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");

  const loadProfile = useCallback(async () => {
    setLoading(true);
    setMessage("");

    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError || !user) {
      router.push("/login");
      return;
    }

    setUserId(user.id);
    setUserEmail(user.email || "");

    const { data: profileData, error: profileError } = await supabase
      .from("profiles")
      .select(
        "id, gamer_tag, platform, favorite_team, is_admin, created_at, updated_at"
      )
      .eq("id", user.id)
      .maybeSingle();

    if (profileError) {
      setMessage(`Error loading profile: ${profileError.message}`);
      setProfile(null);
      setStats(null);
      setLoading(false);
      return;
    }

    if (!profileData) {
      const fallbackGamerTag = user.email?.includes("@")
        ? user.email.split("@")[0]
        : "New Player";

      const { data: createdProfileData, error: createProfileError } =
        await supabase
          .from("profiles")
          .insert({
            id: user.id,
            gamer_tag: fallbackGamerTag,
            platform: null,
            favorite_team: null,
            is_admin: false,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          })
          .select(
            "id, gamer_tag, platform, favorite_team, is_admin, created_at, updated_at"
          )
          .maybeSingle();

      if (createProfileError) {
        setMessage(`Error creating profile: ${createProfileError.message}`);
        setProfile(null);
        setStats(null);
        setLoading(false);
        return;
      }

      const createdProfile = createdProfileData as Profile;

      setProfile(createdProfile);
      setGamerTag(createdProfile.gamer_tag || "");
      setPlatform(createdProfile.platform || "");
      setFavoriteTeam(createdProfile.favorite_team || "");
    } else {
      const loadedProfile = profileData as Profile;

      setProfile(loadedProfile);
      setGamerTag(loadedProfile.gamer_tag || "");
      setPlatform(loadedProfile.platform || "");
      setFavoriteTeam(loadedProfile.favorite_team || "");
    }

    const { data: statsData, error: statsError } = await supabase
      .from("player_stats")
      .select(
        "id, gamer_tag, platform, favorite_team, tournaments_joined, matches_played, wins, losses, tournaments_won, win_percentage, last_match_at"
      )
      .eq("id", user.id)
      .maybeSingle();

    if (statsError) {
      setStats(null);
    } else {
      setStats((statsData || null) as PlayerStats | null);
    }

    setLoading(false);
  }, [router]);

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      void loadProfile();
    }, 0);

    return () => {
      window.clearTimeout(timeoutId);
    };
  }, [loadProfile]);

  const winRateLabel = useMemo(() => {
    if (!stats) return "0%";

    return `${Number(stats.win_percentage || 0).toFixed(1)}%`;
  }, [stats]);

  const profileIsComplete = useMemo(() => {
    return Boolean(gamerTag.trim() && platform.trim() && favoriteTeam.trim());
  }, [favoriteTeam, gamerTag, platform]);

  async function saveProfile(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!userId) {
      router.push("/login");
      return;
    }

    if (!gamerTag.trim()) {
      setMessage("Gamer tag is required.");
      return;
    }

    setSaving(true);
    setMessage("");

    const { data, error } = await supabase
      .from("profiles")
      .upsert({
        id: userId,
        gamer_tag: gamerTag.trim(),
        platform: platform.trim() || null,
        favorite_team: favoriteTeam.trim() || null,
        updated_at: new Date().toISOString(),
      })
      .select(
        "id, gamer_tag, platform, favorite_team, is_admin, created_at, updated_at"
      )
      .maybeSingle();

    if (error) {
      setMessage(`Error saving profile: ${error.message}`);
      setSaving(false);
      return;
    }

    if (data) {
      setProfile(data as Profile);
    }

    setMessage("Profile saved successfully.");
    await loadProfile();
    setSaving(false);
  }

  async function signOut() {
    await supabase.auth.signOut();

    setUserId("");
    setUserEmail("");
    setProfile(null);
    setStats(null);

    router.push("/login");
    router.refresh();
  }

  if (loading) {
    return (
      <main className="min-h-screen bg-black p-6 text-white">
        <div className="mx-auto max-w-6xl">
          <p className="rounded-xl border border-gray-800 bg-gray-950 p-6 text-gray-400">
            Loading profile...
          </p>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-black p-6 text-white">
      <div className="mx-auto max-w-7xl">
        <div className="mb-6 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <Link href="/" className="text-sm text-gray-400 hover:text-white">
            ← Back Home
          </Link>

          <div className="flex flex-col gap-3 sm:flex-row">
            {userId && (
              <Link
                href={`/players/${userId}`}
                className="text-sm text-gray-400 hover:text-white"
              >
                Public Profile →
              </Link>
            )}

            <Link
              href="/my-tournaments"
              className="text-sm text-gray-400 hover:text-white"
            >
              My Tournaments →
            </Link>
          </div>
        </div>

        <section className="mb-8 rounded-2xl border border-gray-800 bg-gray-950 p-6">
          <div className="flex flex-col gap-5 md:flex-row md:items-start md:justify-between">
            <div>
              <p className="mb-3 text-sm font-bold uppercase tracking-[0.25em] text-red-500">
                Player Account
              </p>

              <h1 className="mb-3 text-4xl font-black">My Profile</h1>

              <p className="max-w-2xl text-gray-400">
                Manage your gamer tag, platform, favorite team, and view your
                BattleGrid stats.
              </p>
            </div>

            <div className="flex flex-col gap-3 sm:flex-row">
              {profile?.is_admin && (
                <Link
                  href="/admin"
                  className="rounded-lg border border-red-800 px-5 py-3 text-center font-bold text-red-300 hover:bg-red-950/40"
                >
                  Admin Dashboard
                </Link>
              )}

              <button
                type="button"
                onClick={signOut}
                className="rounded-lg border border-gray-700 px-5 py-3 font-bold text-white hover:bg-gray-900"
              >
                Sign Out
              </button>
            </div>
          </div>
        </section>

        {message && (
          <p className="mb-6 rounded-lg border border-yellow-800 bg-yellow-950/30 p-4 text-sm text-yellow-200">
            {message}
          </p>
        )}

        <section className="mb-8 grid gap-4 md:grid-cols-4">
          <div className="rounded-xl border border-gray-800 bg-gray-950 p-5">
            <p className="text-sm text-gray-500">Tournaments Joined</p>
            <p className="mt-2 text-4xl font-black">
              {stats?.tournaments_joined || 0}
            </p>
          </div>

          <div className="rounded-xl border border-gray-800 bg-gray-950 p-5">
            <p className="text-sm text-gray-500">Record</p>
            <p className="mt-2 text-4xl font-black">
              {stats?.wins || 0}-{stats?.losses || 0}
            </p>
          </div>

          <div className="rounded-xl border border-gray-800 bg-gray-950 p-5">
            <p className="text-sm text-gray-500">Win Rate</p>
            <p className="mt-2 text-4xl font-black">{winRateLabel}</p>
          </div>

          <div className="rounded-xl border border-gray-800 bg-gray-950 p-5">
            <p className="text-sm text-gray-500">Tournament Wins</p>
            <p className="mt-2 text-4xl font-black">
              {stats?.tournaments_won || 0}
            </p>
          </div>
        </section>

        <section className="grid gap-6 lg:grid-cols-[1fr_420px]">
          <section className="rounded-xl border border-gray-800 bg-gray-950 p-6">
            <h2 className="mb-5 text-2xl font-bold">Edit Profile</h2>

            <form onSubmit={saveProfile} className="grid gap-4">
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
                disabled={saving}
                className="rounded-lg bg-white px-5 py-3 font-bold text-black hover:bg-gray-200 disabled:opacity-50"
              >
                {saving ? "Saving..." : "Save Profile"}
              </button>
            </form>
          </section>

          <aside className="grid h-fit gap-6">
            <section className="rounded-xl border border-gray-800 bg-gray-950 p-6">
              <h2 className="mb-4 text-2xl font-bold">Account Info</h2>

              <div className="grid gap-3 text-sm text-gray-300">
                <p>
                  <span className="text-gray-500">Email:</span>{" "}
                  {userEmail || "Not set"}
                </p>

                <p>
                  <span className="text-gray-500">Role:</span>{" "}
                  {profile?.is_admin ? "Admin" : "Player"}
                </p>

                <p>
                  <span className="text-gray-500">Profile Created:</span>{" "}
                  {formatDateTime(profile?.created_at || null)}
                </p>

                <p>
                  <span className="text-gray-500">Last Updated:</span>{" "}
                  {formatDateTime(profile?.updated_at || null)}
                </p>
              </div>
            </section>

            <section
              className={`rounded-xl border p-6 ${
                profileIsComplete
                  ? "border-green-800 bg-green-950/20"
                  : "border-yellow-800 bg-yellow-950/20"
              }`}
            >
              <h2
                className={`mb-2 text-2xl font-bold ${
                  profileIsComplete ? "text-green-300" : "text-yellow-300"
                }`}
              >
                {profileIsComplete ? "Profile Complete" : "Profile Incomplete"}
              </h2>

              <p className="text-sm text-gray-300">
                {profileIsComplete
                  ? "Your profile is ready for tournaments and public rankings."
                  : "Add your gamer tag, platform, and favorite team so other players know who they are facing."}
              </p>
            </section>

            <section className="rounded-xl border border-gray-800 bg-gray-950 p-6">
              <h2 className="mb-4 text-2xl font-bold">Quick Links</h2>

              <div className="grid gap-3">
                {userId && (
                  <Link
                    href={`/players/${userId}`}
                    className="rounded-lg bg-white px-5 py-3 text-center font-bold text-black hover:bg-gray-200"
                  >
                    View Public Profile
                  </Link>
                )}

                <Link
                  href="/leaderboard"
                  className="rounded-lg border border-gray-700 px-5 py-3 text-center font-bold text-white hover:bg-gray-900"
                >
                  Leaderboard
                </Link>

                <Link
                  href="/tournaments"
                  className="rounded-lg border border-gray-700 px-5 py-3 text-center font-bold text-white hover:bg-gray-900"
                >
                  Browse Tournaments
                </Link>
              </div>
            </section>
          </aside>
        </section>
      </div>
    </main>
  );
}