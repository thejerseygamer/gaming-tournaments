"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "../../lib/supabase";
import { checkIsAdmin } from "../../lib/admin";

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
  tournaments_joined: number;
  matches_played: number;
  wins: number;
  losses: number;
  tournaments_won: number;
  win_percentage: number;
  last_match_at: string | null;
};

type RoleFilter = "all" | "admins" | "players";

type SortOption =
  | "newest"
  | "gamer_tag"
  | "wins"
  | "matches_played"
  | "win_percentage"
  | "tournaments_joined";

function formatDateTime(value: string | null) {
  if (!value) return "Not set";

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) return "Not set";

  return date.toLocaleString();
}

function formatWinPercentage(value: number | null | undefined) {
  return `${Number(value || 0).toFixed(1)}%`;
}

export default function AdminPlayersPage() {
  const router = useRouter();

  const [currentUserId, setCurrentUserId] = useState("");
  const [isAdmin, setIsAdmin] = useState(false);

  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [statsRows, setStatsRows] = useState<PlayerStats[]>([]);

  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState<RoleFilter>("all");
  const [platformFilter, setPlatformFilter] = useState("all");
  const [sortBy, setSortBy] = useState<SortOption>("newest");

  const [checkingAdmin, setCheckingAdmin] = useState(true);
  const [loading, setLoading] = useState(true);
  const [savingId, setSavingId] = useState("");
  const [message, setMessage] = useState("");

  const loadPlayers = useCallback(async () => {
    setCheckingAdmin(true);
    setLoading(true);
    setMessage("");

    const adminCheck = await checkIsAdmin();

    if (!adminCheck.user) {
      setCheckingAdmin(false);
      setLoading(false);
      router.push("/login");
      return;
    }

    if (!adminCheck.isAdmin) {
      setCheckingAdmin(false);
      setLoading(false);
      router.push("/tournaments");
      return;
    }

    setCurrentUserId(adminCheck.user.id);
    setIsAdmin(true);
    setCheckingAdmin(false);

    const { data: profileData, error: profileError } = await supabase
      .from("profiles")
      .select("id, gamer_tag, platform, favorite_team, is_admin, created_at, updated_at")
      .order("created_at", { ascending: false });

    if (profileError) {
      setMessage(`Error loading players: ${profileError.message}`);
      setProfiles([]);
      setStatsRows([]);
      setLoading(false);
      return;
    }

    setProfiles((profileData || []) as Profile[]);

    const { data: statsData, error: statsError } = await supabase
      .from("player_stats")
      .select(
        "id, tournaments_joined, matches_played, wins, losses, tournaments_won, win_percentage, last_match_at"
      );

    if (statsError) {
      setStatsRows([]);
      setMessage(
        "Players loaded. Stats could not load. If needed, rerun the leaderboard SQL view."
      );
    } else {
      setStatsRows((statsData || []) as PlayerStats[]);
    }

    setLoading(false);
  }, [router]);

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      void loadPlayers();
    }, 0);

    return () => {
      window.clearTimeout(timeoutId);
    };
  }, [loadPlayers]);

  const statsById = useMemo(() => {
    return statsRows.reduce((acc, row) => {
      acc[row.id] = row;
      return acc;
    }, {} as Record<string, PlayerStats>);
  }, [statsRows]);

  const platforms = useMemo(() => {
    const platformSet = new Set(
      profiles
        .map((profile) => profile.platform?.trim())
        .filter((platform): platform is string => Boolean(platform))
    );

    return Array.from(platformSet).sort((a, b) => a.localeCompare(b));
  }, [profiles]);

  const adminCount = useMemo(() => {
    return profiles.filter((profile) => profile.is_admin).length;
  }, [profiles]);

  const playerCount = useMemo(() => {
    return profiles.filter((profile) => !profile.is_admin).length;
  }, [profiles]);

  const totalMatches = useMemo(() => {
    return statsRows.reduce((total, row) => total + row.matches_played, 0);
  }, [statsRows]);

  const filteredProfiles = useMemo(() => {
    const cleanSearch = search.trim().toLowerCase();

    const searchedProfiles = profiles.filter((profile) => {
      const gamerTag = profile.gamer_tag?.toLowerCase() || "";
      const platform = profile.platform?.toLowerCase() || "";
      const favoriteTeam = profile.favorite_team?.toLowerCase() || "";
      const role = profile.is_admin ? "admin" : "player";

      const matchesSearch =
        !cleanSearch ||
        gamerTag.includes(cleanSearch) ||
        platform.includes(cleanSearch) ||
        favoriteTeam.includes(cleanSearch) ||
        role.includes(cleanSearch);

      const matchesRole =
        roleFilter === "all" ||
        (roleFilter === "admins" && profile.is_admin) ||
        (roleFilter === "players" && !profile.is_admin);

      const matchesPlatform =
        platformFilter === "all" || profile.platform === platformFilter;

      return matchesSearch && matchesRole && matchesPlatform;
    });

    const sortedProfiles = [...searchedProfiles];

    sortedProfiles.sort((a, b) => {
      const aStats = statsById[a.id];
      const bStats = statsById[b.id];

      if (sortBy === "gamer_tag") {
        return profileName(a).localeCompare(profileName(b));
      }

      if (sortBy === "wins") {
        return (bStats?.wins || 0) - (aStats?.wins || 0);
      }

      if (sortBy === "matches_played") {
        return (bStats?.matches_played || 0) - (aStats?.matches_played || 0);
      }

      if (sortBy === "win_percentage") {
        return (bStats?.win_percentage || 0) - (aStats?.win_percentage || 0);
      }

      if (sortBy === "tournaments_joined") {
        return (
          (bStats?.tournaments_joined || 0) -
          (aStats?.tournaments_joined || 0)
        );
      }

      return (
        new Date(b.created_at || 0).getTime() -
        new Date(a.created_at || 0).getTime()
      );
    });

    return sortedProfiles;
  }, [platformFilter, profiles, roleFilter, search, sortBy, statsById]);

  function profileName(profile: Profile) {
    return profile.gamer_tag || "Unnamed Player";
  }

  function roleLabel(profile: Profile) {
    return profile.is_admin ? "Admin" : "Player";
  }

  function roleClass(profile: Profile) {
    if (profile.is_admin) {
      return "border-red-700 bg-red-950/40 text-red-300";
    }

    return "border-gray-700 bg-black text-gray-300";
  }

  async function toggleAdmin(profile: Profile) {
    if (!isAdmin) {
      setMessage("You do not have admin access.");
      return;
    }

    if (profile.id === currentUserId && profile.is_admin) {
      setMessage("You cannot remove your own admin access from this page.");
      return;
    }

    const nextAdminValue = !Boolean(profile.is_admin);

    const confirmed = window.confirm(
      nextAdminValue
        ? `Make ${profileName(profile)} an admin?`
        : `Remove admin access from ${profileName(profile)}?`
    );

    if (!confirmed) return;

    setSavingId(profile.id);
    setMessage("");

    const { error } = await supabase
      .from("profiles")
      .update({
        is_admin: nextAdminValue,
        updated_at: new Date().toISOString(),
      })
      .eq("id", profile.id);

    if (error) {
      setMessage(`Error updating admin access: ${error.message}`);
      setSavingId("");
      return;
    }

    setMessage(
      nextAdminValue
        ? `${profileName(profile)} is now an admin.`
        : `${profileName(profile)} is now a regular player.`
    );

    await loadPlayers();
    setSavingId("");
  }

  if (checkingAdmin || loading) {
    return (
      <main className="min-h-screen bg-black p-6 text-white">
        <div className="mx-auto max-w-6xl">
          <p className="rounded-xl border border-gray-800 bg-gray-950 p-6 text-gray-400">
            {checkingAdmin ? "Checking admin access..." : "Loading players..."}
          </p>
        </div>
      </main>
    );
  }

  if (!isAdmin) {
    return (
      <main className="min-h-screen bg-black p-6 text-white">
        <div className="mx-auto max-w-6xl">
          <p className="rounded-xl border border-red-900 bg-red-950/40 p-6 text-red-200">
            You do not have admin access.
          </p>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-black p-6 text-white">
      <div className="mx-auto max-w-7xl">
        <div className="mb-6 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <Link href="/admin" className="text-sm text-gray-400 hover:text-white">
            ← Back to Admin
          </Link>

          <Link
            href="/leaderboard"
            className="text-sm text-gray-400 hover:text-white"
          >
            View Leaderboard →
          </Link>
        </div>

        <section className="mb-8 rounded-2xl border border-gray-800 bg-gray-950 p-6">
          <div className="flex flex-col gap-5 md:flex-row md:items-end md:justify-between">
            <div>
              <p className="mb-3 text-sm font-bold uppercase tracking-[0.25em] text-red-500">
                Admin Tools
              </p>

              <h1 className="mb-3 text-4xl font-black">Players</h1>

              <p className="max-w-2xl text-gray-400">
                Search player accounts, view stats, open public profiles, and
                manage admin access.
              </p>
            </div>

            <button
              type="button"
              onClick={loadPlayers}
              disabled={loading}
              className="rounded-lg bg-white px-5 py-3 font-bold text-black hover:bg-gray-200 disabled:opacity-50"
            >
              {loading ? "Refreshing..." : "Refresh Players"}
            </button>
          </div>
        </section>

        {message && (
          <p className="mb-6 rounded-lg border border-yellow-800 bg-yellow-950/30 p-4 text-sm text-yellow-200">
            {message}
          </p>
        )}

        <section className="mb-8 grid gap-4 md:grid-cols-4">
          <div className="rounded-xl border border-gray-800 bg-gray-950 p-5">
            <p className="text-sm text-gray-500">Total Accounts</p>
            <p className="mt-2 text-4xl font-black">{profiles.length}</p>
          </div>

          <div className="rounded-xl border border-red-800 bg-red-950/20 p-5">
            <p className="text-sm text-red-300">Admins</p>
            <p className="mt-2 text-4xl font-black">{adminCount}</p>
          </div>

          <div className="rounded-xl border border-gray-800 bg-gray-950 p-5">
            <p className="text-sm text-gray-500">Players</p>
            <p className="mt-2 text-4xl font-black">{playerCount}</p>
          </div>

          <div className="rounded-xl border border-gray-800 bg-gray-950 p-5">
            <p className="text-sm text-gray-500">Match Entries</p>
            <p className="mt-2 text-4xl font-black">{totalMatches}</p>
          </div>
        </section>

        <section className="mb-6 rounded-xl border border-gray-800 bg-gray-950 p-5">
          <div className="grid gap-4 lg:grid-cols-4">
            <div>
              <label className="mb-2 block text-sm text-gray-400">
                Search
              </label>

              <input
                className="w-full rounded-lg border border-gray-700 bg-black px-4 py-3 text-white"
                placeholder="Search gamer tag, platform, team, role..."
                value={search}
                onChange={(event) => setSearch(event.target.value)}
              />
            </div>

            <div>
              <label className="mb-2 block text-sm text-gray-400">Role</label>

              <select
                className="w-full rounded-lg border border-gray-700 bg-black px-4 py-3 text-white"
                value={roleFilter}
                onChange={(event) => setRoleFilter(event.target.value as RoleFilter)}
              >
                <option value="all">All Roles</option>
                <option value="admins">Admins</option>
                <option value="players">Players</option>
              </select>
            </div>

            <div>
              <label className="mb-2 block text-sm text-gray-400">
                Platform
              </label>

              <select
                className="w-full rounded-lg border border-gray-700 bg-black px-4 py-3 text-white"
                value={platformFilter}
                onChange={(event) => setPlatformFilter(event.target.value)}
              >
                <option value="all">All Platforms</option>

                {platforms.map((platform) => (
                  <option key={platform} value={platform}>
                    {platform}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="mb-2 block text-sm text-gray-400">
                Sort By
              </label>

              <select
                className="w-full rounded-lg border border-gray-700 bg-black px-4 py-3 text-white"
                value={sortBy}
                onChange={(event) => setSortBy(event.target.value as SortOption)}
              >
                <option value="newest">Newest Accounts</option>
                <option value="gamer_tag">Gamer Tag</option>
                <option value="wins">Most Wins</option>
                <option value="matches_played">Most Matches</option>
                <option value="win_percentage">Best Win Rate</option>
                <option value="tournaments_joined">Tournaments Joined</option>
              </select>
            </div>
          </div>
        </section>

        {filteredProfiles.length === 0 ? (
          <section className="rounded-xl border border-gray-800 bg-gray-950 p-6">
            <h2 className="mb-2 text-2xl font-bold">No players found</h2>

            <p className="mb-5 text-gray-400">
              Try clearing your filters or search text.
            </p>

            <button
              type="button"
              onClick={() => {
                setSearch("");
                setRoleFilter("all");
                setPlatformFilter("all");
                setSortBy("newest");
              }}
              className="rounded-lg bg-white px-5 py-3 font-bold text-black hover:bg-gray-200"
            >
              Clear Filters
            </button>
          </section>
        ) : (
          <section className="grid gap-4">
            {filteredProfiles.map((profile) => {
              const stats = statsById[profile.id];

              return (
                <article
                  key={profile.id}
                  className="rounded-xl border border-gray-800 bg-gray-950 p-5"
                >
                  <div className="grid gap-5 lg:grid-cols-[1fr_auto] lg:items-start">
                    <div>
                      <div className="mb-3 flex flex-wrap items-center gap-2">
                        <span
                          className={`rounded-full border px-3 py-1 text-xs font-bold ${roleClass(
                            profile
                          )}`}
                        >
                          {roleLabel(profile)}
                        </span>

                        {profile.id === currentUserId && (
                          <span className="rounded-full border border-yellow-700 bg-yellow-950/40 px-3 py-1 text-xs font-bold text-yellow-300">
                            You
                          </span>
                        )}
                      </div>

                      <h2 className="text-2xl font-black">
                        {profileName(profile)}
                      </h2>

                      <p className="mt-1 text-sm text-gray-500">
                        {profile.platform || "Platform not set"} •{" "}
                        {profile.favorite_team || "Favorite team not set"}
                      </p>

                      <p className="mt-2 text-xs text-gray-600">
                        Joined: {formatDateTime(profile.created_at)} • Updated:{" "}
                        {formatDateTime(profile.updated_at)}
                      </p>
                    </div>

                    <div className="flex flex-col gap-3 sm:flex-row lg:flex-col">
                      <Link
                        href={`/players/${profile.id}`}
                        className="rounded-lg bg-white px-5 py-3 text-center text-sm font-bold text-black hover:bg-gray-200"
                      >
                        Public Profile
                      </Link>

                      <button
                        type="button"
                        onClick={() => toggleAdmin(profile)}
                        disabled={savingId === profile.id}
                        className={`rounded-lg border px-5 py-3 text-sm font-bold disabled:opacity-50 ${
                          profile.is_admin
                            ? "border-red-700 text-red-300 hover:bg-red-950/40"
                            : "border-gray-700 text-white hover:bg-gray-900"
                        }`}
                      >
                        {savingId === profile.id
                          ? "Saving..."
                          : profile.is_admin
                            ? "Remove Admin"
                            : "Make Admin"}
                      </button>
                    </div>
                  </div>

                  <div className="mt-5 grid gap-3 md:grid-cols-6">
                    <div className="rounded-lg border border-gray-800 bg-black p-3">
                      <p className="text-xs text-gray-500">Record</p>
                      <p className="mt-1 text-xl font-black">
                        {stats?.wins || 0}-{stats?.losses || 0}
                      </p>
                    </div>

                    <div className="rounded-lg border border-gray-800 bg-black p-3">
                      <p className="text-xs text-gray-500">Win Rate</p>
                      <p className="mt-1 text-xl font-black">
                        {formatWinPercentage(stats?.win_percentage)}
                      </p>
                    </div>

                    <div className="rounded-lg border border-gray-800 bg-black p-3">
                      <p className="text-xs text-gray-500">Matches</p>
                      <p className="mt-1 text-xl font-black">
                        {stats?.matches_played || 0}
                      </p>
                    </div>

                    <div className="rounded-lg border border-gray-800 bg-black p-3">
                      <p className="text-xs text-gray-500">Joined</p>
                      <p className="mt-1 text-xl font-black">
                        {stats?.tournaments_joined || 0}
                      </p>
                    </div>

                    <div className="rounded-lg border border-gray-800 bg-black p-3">
                      <p className="text-xs text-gray-500">Tournament Wins</p>
                      <p className="mt-1 text-xl font-black">
                        {stats?.tournaments_won || 0}
                      </p>
                    </div>

                    <div className="rounded-lg border border-gray-800 bg-black p-3">
                      <p className="text-xs text-gray-500">Last Match</p>
                      <p className="mt-1 text-sm font-bold">
                        {formatDateTime(stats?.last_match_at || null)}
                      </p>
                    </div>
                  </div>
                </article>
              );
            })}
          </section>
        )}
      </div>
    </main>
  );
}