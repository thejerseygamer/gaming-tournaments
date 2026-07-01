"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "../lib/supabase";

type LeaderboardPlayer = {
  leaderboard_rank: number | null;
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

type SortOption =
  | "rank"
  | "wins"
  | "win_percentage"
  | "matches_played"
  | "tournaments_won"
  | "tournaments_joined";

function formatDateTime(value: string | null) {
  if (!value) return "No matches yet";

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) return "No matches yet";

  return date.toLocaleString();
}

function formatWinPercentage(value: number) {
  return `${Number(value || 0).toFixed(1)}%`;
}

export default function LeaderboardPage() {
  const [players, setPlayers] = useState<LeaderboardPlayer[]>([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");

  const [search, setSearch] = useState("");
  const [platformFilter, setPlatformFilter] = useState("all");
  const [sortBy, setSortBy] = useState<SortOption>("rank");

  const loadLeaderboard = useCallback(async () => {
    setLoading(true);
    setMessage("");

    const { data, error } = await supabase
      .from("player_leaderboard")
      .select(
        "leaderboard_rank, id, gamer_tag, platform, favorite_team, tournaments_joined, matches_played, wins, losses, tournaments_won, win_percentage, last_match_at"
      )
      .order("leaderboard_rank", { ascending: true });

    if (error) {
      setMessage(`Error loading leaderboard: ${error.message}`);
      setPlayers([]);
      setLoading(false);
      return;
    }

    setPlayers((data || []) as LeaderboardPlayer[]);
    setLoading(false);
  }, []);

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      void loadLeaderboard();
    }, 0);

    return () => {
      window.clearTimeout(timeoutId);
    };
  }, [loadLeaderboard]);

  const platforms = useMemo(() => {
    const platformSet = new Set(
      players
        .map((player) => player.platform?.trim())
        .filter((platform): platform is string => Boolean(platform))
    );

    return Array.from(platformSet).sort((a, b) => a.localeCompare(b));
  }, [players]);

  const topPlayer = useMemo(() => {
    return players[0] || null;
  }, [players]);

  const totalMatchesPlayed = useMemo(() => {
    return players.reduce((total, player) => total + player.matches_played, 0);
  }, [players]);

  const totalWins = useMemo(() => {
    return players.reduce((total, player) => total + player.wins, 0);
  }, [players]);

  const filteredPlayers = useMemo(() => {
    const cleanSearch = search.trim().toLowerCase();

    const searchedPlayers = players.filter((player) => {
      const gamerTag = player.gamer_tag?.toLowerCase() || "";
      const platform = player.platform?.toLowerCase() || "";
      const favoriteTeam = player.favorite_team?.toLowerCase() || "";

      const matchesSearch =
        !cleanSearch ||
        gamerTag.includes(cleanSearch) ||
        platform.includes(cleanSearch) ||
        favoriteTeam.includes(cleanSearch);

      const matchesPlatform =
        platformFilter === "all" || player.platform === platformFilter;

      return matchesSearch && matchesPlatform;
    });

    const sortedPlayers = [...searchedPlayers];

    sortedPlayers.sort((a, b) => {
      if (sortBy === "wins") {
        return b.wins - a.wins || b.win_percentage - a.win_percentage;
      }

      if (sortBy === "win_percentage") {
        return b.win_percentage - a.win_percentage || b.wins - a.wins;
      }

      if (sortBy === "matches_played") {
        return b.matches_played - a.matches_played || b.wins - a.wins;
      }

      if (sortBy === "tournaments_won") {
        return b.tournaments_won - a.tournaments_won || b.wins - a.wins;
      }

      if (sortBy === "tournaments_joined") {
        return b.tournaments_joined - a.tournaments_joined || b.wins - a.wins;
      }

      return (a.leaderboard_rank || 999999) - (b.leaderboard_rank || 999999);
    });

    return sortedPlayers;
  }, [players, platformFilter, search, sortBy]);

  function playerName(player: LeaderboardPlayer) {
    return player.gamer_tag || "Unnamed Player";
  }

  function rankLabel(player: LeaderboardPlayer, index: number) {
    if (sortBy !== "rank") {
      return index + 1;
    }

    return player.leaderboard_rank || index + 1;
  }

  function rankBadgeClass(index: number) {
    if (sortBy !== "rank") {
      return "border-gray-700 bg-black text-gray-300";
    }

    if (index === 0) {
      return "border-yellow-600 bg-yellow-950/40 text-yellow-300";
    }

    if (index === 1) {
      return "border-gray-500 bg-gray-900 text-gray-200";
    }

    if (index === 2) {
      return "border-orange-700 bg-orange-950/30 text-orange-300";
    }

    return "border-gray-700 bg-black text-gray-300";
  }

  return (
    <main className="min-h-screen bg-black p-6 text-white">
      <div className="mx-auto max-w-7xl">
        <div className="mb-6 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <Link href="/" className="text-sm text-gray-400 hover:text-white">
            ← Back Home
          </Link>

          <Link
            href="/tournaments"
            className="text-sm text-gray-400 hover:text-white"
          >
            Browse Tournaments →
          </Link>
        </div>

        <section className="mb-8 rounded-2xl border border-gray-800 bg-gray-950 p-6">
          <div className="flex flex-col gap-5 md:flex-row md:items-end md:justify-between">
            <div>
              <p className="mb-3 text-sm font-bold uppercase tracking-[0.25em] text-red-500">
                BattleGrid Rankings
              </p>

              <h1 className="mb-3 text-4xl font-black">Leaderboard</h1>

              <p className="max-w-2xl text-gray-400">
                Track top competitors by wins, win rate, tournament wins, and
                match activity.
              </p>
            </div>

            <button
              type="button"
              onClick={loadLeaderboard}
              disabled={loading}
              className="rounded-lg bg-white px-5 py-3 font-bold text-black hover:bg-gray-200 disabled:opacity-50"
            >
              {loading ? "Refreshing..." : "Refresh Rankings"}
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
            <p className="text-sm text-gray-500">Ranked Players</p>
            <p className="mt-2 text-4xl font-black">{players.length}</p>
          </div>

          <div className="rounded-xl border border-gray-800 bg-gray-950 p-5">
            <p className="text-sm text-gray-500">Total Match Entries</p>
            <p className="mt-2 text-4xl font-black">{totalMatchesPlayed}</p>
          </div>

          <div className="rounded-xl border border-gray-800 bg-gray-950 p-5">
            <p className="text-sm text-gray-500">Total Wins</p>
            <p className="mt-2 text-4xl font-black">{totalWins}</p>
          </div>

          <div className="rounded-xl border border-red-800 bg-red-950/20 p-5">
            <p className="text-sm text-red-300">Current #1</p>
            <p className="mt-2 truncate text-3xl font-black">
              {topPlayer ? playerName(topPlayer) : "None"}
            </p>
          </div>
        </section>

        {topPlayer && (
          <section className="mb-8 rounded-2xl border border-yellow-700 bg-yellow-950/10 p-6">
            <div className="flex flex-col gap-5 md:flex-row md:items-center md:justify-between">
              <div>
                <p className="mb-2 text-sm font-bold uppercase tracking-[0.2em] text-yellow-300">
                  Top Ranked Player
                </p>

                <h2 className="text-4xl font-black">{playerName(topPlayer)}</h2>

                <p className="mt-2 text-gray-400">
                  {topPlayer.platform || "Platform not set"} •{" "}
                  {topPlayer.favorite_team || "Favorite team not set"}
                </p>
              </div>

              <div className="grid gap-3 sm:grid-cols-3">
                <div className="rounded-xl border border-yellow-800 bg-black p-4">
                  <p className="text-sm text-gray-500">Record</p>
                  <p className="mt-1 text-2xl font-black">
                    {topPlayer.wins}-{topPlayer.losses}
                  </p>
                </div>

                <div className="rounded-xl border border-yellow-800 bg-black p-4">
                  <p className="text-sm text-gray-500">Win Rate</p>
                  <p className="mt-1 text-2xl font-black">
                    {formatWinPercentage(topPlayer.win_percentage)}
                  </p>
                </div>

                <div className="rounded-xl border border-yellow-800 bg-black p-4">
                  <p className="text-sm text-gray-500">Tournament Wins</p>
                  <p className="mt-1 text-2xl font-black">
                    {topPlayer.tournaments_won}
                  </p>
                </div>
              </div>

              <Link
                href={`/players/${topPlayer.id}`}
                className="rounded-lg bg-white px-5 py-3 text-center font-bold text-black hover:bg-gray-200"
              >
                View Profile
              </Link>
            </div>
          </section>
        )}

        <section className="mb-6 rounded-xl border border-gray-800 bg-gray-950 p-5">
          <div className="grid gap-4 md:grid-cols-3">
            <div>
              <label className="mb-2 block text-sm text-gray-400">
                Search Players
              </label>

              <input
                className="w-full rounded-lg border border-gray-700 bg-black px-4 py-3 text-white"
                placeholder="Search gamer tag, platform, or team..."
                value={search}
                onChange={(event) => setSearch(event.target.value)}
              />
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
                <option value="rank">Official Rank</option>
                <option value="wins">Most Wins</option>
                <option value="win_percentage">Best Win Rate</option>
                <option value="matches_played">Most Matches</option>
                <option value="tournaments_won">Tournament Wins</option>
                <option value="tournaments_joined">Tournaments Joined</option>
              </select>
            </div>
          </div>
        </section>

        {loading ? (
          <p className="rounded-xl border border-gray-800 bg-gray-950 p-6 text-gray-400">
            Loading leaderboard...
          </p>
        ) : filteredPlayers.length === 0 ? (
          <section className="rounded-xl border border-gray-800 bg-gray-950 p-6">
            <h2 className="mb-2 text-2xl font-bold">No ranked players found</h2>

            <p className="mb-5 text-gray-400">
              Players will appear here after joining tournaments and completing
              matches.
            </p>

            <button
              type="button"
              onClick={() => {
                setSearch("");
                setPlatformFilter("all");
                setSortBy("rank");
              }}
              className="rounded-lg bg-white px-5 py-3 font-bold text-black hover:bg-gray-200"
            >
              Clear Filters
            </button>
          </section>
        ) : (
          <section className="grid gap-4">
            {filteredPlayers.map((player, index) => (
              <article
                key={player.id}
                className="rounded-xl border border-gray-800 bg-gray-950 p-5"
              >
                <div className="grid gap-5 lg:grid-cols-[90px_1fr_auto] lg:items-center">
                  <div
                    className={`flex h-16 w-16 items-center justify-center rounded-2xl border text-2xl font-black ${rankBadgeClass(
                      index
                    )}`}
                  >
                    #{rankLabel(player, index)}
                  </div>

                  <div>
                    <Link
                      href={`/players/${player.id}`}
                      className="text-2xl font-black hover:text-red-400"
                    >
                      {playerName(player)}
                    </Link>

                    <p className="mt-1 text-sm text-gray-500">
                      {player.platform || "Platform not set"} •{" "}
                      {player.favorite_team || "Favorite team not set"}
                    </p>

                    <p className="mt-2 text-xs text-gray-600">
                      Last match: {formatDateTime(player.last_match_at)}
                    </p>
                  </div>

                  <Link
                    href={`/players/${player.id}`}
                    className="rounded-lg bg-white px-5 py-3 text-center text-sm font-bold text-black hover:bg-gray-200"
                  >
                    View Profile
                  </Link>
                </div>

                <div className="mt-5 grid gap-3 md:grid-cols-6">
                  <div className="rounded-lg border border-gray-800 bg-black p-3">
                    <p className="text-xs text-gray-500">Record</p>
                    <p className="mt-1 text-xl font-black">
                      {player.wins}-{player.losses}
                    </p>
                  </div>

                  <div className="rounded-lg border border-gray-800 bg-black p-3">
                    <p className="text-xs text-gray-500">Win Rate</p>
                    <p className="mt-1 text-xl font-black">
                      {formatWinPercentage(player.win_percentage)}
                    </p>
                  </div>

                  <div className="rounded-lg border border-gray-800 bg-black p-3">
                    <p className="text-xs text-gray-500">Matches</p>
                    <p className="mt-1 text-xl font-black">
                      {player.matches_played}
                    </p>
                  </div>

                  <div className="rounded-lg border border-gray-800 bg-black p-3">
                    <p className="text-xs text-gray-500">Joined</p>
                    <p className="mt-1 text-xl font-black">
                      {player.tournaments_joined}
                    </p>
                  </div>

                  <div className="rounded-lg border border-gray-800 bg-black p-3">
                    <p className="text-xs text-gray-500">Tournament Wins</p>
                    <p className="mt-1 text-xl font-black">
                      {player.tournaments_won}
                    </p>
                  </div>

                  <div className="rounded-lg border border-gray-800 bg-black p-3">
                    <p className="text-xs text-gray-500">Losses</p>
                    <p className="mt-1 text-xl font-black">{player.losses}</p>
                  </div>
                </div>
              </article>
            ))}
          </section>
        )}
      </div>
    </main>
  );
}