"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "../lib/supabase";

type Tournament = {
  id: string;
  name: string;
  game: string | null;
  platform: string | null;
  description: string | null;
  rules: string | null;
  start_time: string | null;
  registration_open: boolean;
  prize_pool: number | null;
  entry_fee: number | null;
  max_players: number | null;
  created_at: string;
};

type TournamentPlayerRow = {
  tournament_id: string;
};

type MatchRow = {
  tournament_id: string;
};

type StatusFilter = "all" | "open" | "closed" | "locked" | "full";
type SortBy = "latest" | "players" | "prize" | "entry" | "start";

export default function TournamentsPage() {
  const [tournaments, setTournaments] = useState<Tournament[]>([]);
  const [playerCounts, setPlayerCounts] = useState<Record<string, number>>({});
  const [matchCounts, setMatchCounts] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState("");

  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [sortBy, setSortBy] = useState<SortBy>("latest");

  useEffect(() => {
    let isMounted = true;

    async function loadTournaments() {
      const { data: tournamentData, error: tournamentError } = await supabase
        .from("tournaments")
        .select("*")
        .order("created_at", { ascending: false });

      if (!isMounted) return;

      if (tournamentError) {
        setErrorMessage(tournamentError.message);
        setTournaments([]);
        setLoading(false);
        return;
      }

      const loadedTournaments = (tournamentData || []) as Tournament[];

      const { data: playerData, error: playerError } = await supabase
        .from("tournament_players")
        .select("tournament_id");

      if (!isMounted) return;

      if (playerError) {
        setErrorMessage(playerError.message);
        setTournaments(loadedTournaments);
        setPlayerCounts({});
        setMatchCounts({});
        setLoading(false);
        return;
      }

      const { data: matchData, error: matchError } = await supabase
        .from("matches")
        .select("tournament_id");

      if (!isMounted) return;

      if (matchError) {
        setErrorMessage(matchError.message);
        setTournaments(loadedTournaments);
        setPlayerCounts({});
        setMatchCounts({});
        setLoading(false);
        return;
      }

      const newPlayerCounts: Record<string, number> = {};

      for (const row of (playerData || []) as TournamentPlayerRow[]) {
        newPlayerCounts[row.tournament_id] =
          (newPlayerCounts[row.tournament_id] || 0) + 1;
      }

      const newMatchCounts: Record<string, number> = {};

      for (const row of (matchData || []) as MatchRow[]) {
        newMatchCounts[row.tournament_id] =
          (newMatchCounts[row.tournament_id] || 0) + 1;
      }

      setTournaments(loadedTournaments);
      setPlayerCounts(newPlayerCounts);
      setMatchCounts(newMatchCounts);
      setLoading(false);
    }

    loadTournaments();

    return () => {
      isMounted = false;
    };
  }, []);

  function formatDisplayDate(value: string | null) {
    if (!value) return "Not set";

    const date = new Date(value);

    if (Number.isNaN(date.getTime())) return "Not set";

    return date.toLocaleString();
  }

  function isTournamentFull(tournament: Tournament) {
    const joinedPlayers = playerCounts[tournament.id] || 0;
    const maxPlayers = tournament.max_players || 0;

    return maxPlayers > 0 && joinedPlayers >= maxPlayers;
  }

  function isRegistrationLocked(tournament: Tournament) {
    return (matchCounts[tournament.id] || 0) > 0;
  }

  function isRegistrationClosed(tournament: Tournament) {
    return tournament.registration_open === false;
  }

  function getRegistrationLabel(tournament: Tournament) {
    if (isRegistrationLocked(tournament)) return "Registration Locked";
    if (isRegistrationClosed(tournament)) return "Registration Closed";

    return "Registration Open";
  }

  function getRegistrationClass(tournament: Tournament) {
    if (isRegistrationLocked(tournament)) {
      return "border-yellow-700 bg-yellow-950/40 text-yellow-300";
    }

    if (isRegistrationClosed(tournament)) {
      return "border-red-700 bg-red-950/40 text-red-300";
    }

    return "border-green-700 bg-green-950/40 text-green-300";
  }

  const featuredTournament = useMemo(() => {
    return tournaments[0] || null;
  }, [tournaments]);

  const filteredTournaments = useMemo(() => {
    const search = searchTerm.trim().toLowerCase();

    const filtered = tournaments.filter((tournament) => {
      const joinedPlayers = playerCounts[tournament.id] || 0;
      const maxPlayers = tournament.max_players || 0;
      const isFull = maxPlayers > 0 && joinedPlayers >= maxPlayers;
      const isLocked = (matchCounts[tournament.id] || 0) > 0;
      const isClosed = tournament.registration_open === false;

      const matchesSearch =
        !search ||
        tournament.name.toLowerCase().includes(search) ||
        (tournament.game || "").toLowerCase().includes(search) ||
        (tournament.platform || "").toLowerCase().includes(search);

      const matchesStatus =
        statusFilter === "all" ||
        (statusFilter === "open" && !isFull && !isLocked && !isClosed) ||
        (statusFilter === "closed" && isClosed && !isLocked) ||
        (statusFilter === "locked" && isLocked) ||
        (statusFilter === "full" && isFull);

      return matchesSearch && matchesStatus;
    });

    filtered.sort((a, b) => {
      if (sortBy === "players") {
        return (playerCounts[b.id] || 0) - (playerCounts[a.id] || 0);
      }

      if (sortBy === "prize") {
        return (b.prize_pool || 0) - (a.prize_pool || 0);
      }

      if (sortBy === "entry") {
        return (a.entry_fee || 0) - (b.entry_fee || 0);
      }

      if (sortBy === "start") {
        const aTime = a.start_time
          ? new Date(a.start_time).getTime()
          : Infinity;

        const bTime = b.start_time
          ? new Date(b.start_time).getTime()
          : Infinity;

        return aTime - bTime;
      }

      return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
    });

    return filtered;
  }, [tournaments, playerCounts, matchCounts, searchTerm, statusFilter, sortBy]);

  function clearFilters() {
    setSearchTerm("");
    setStatusFilter("all");
    setSortBy("latest");
  }

  return (
    <main className="min-h-screen bg-black p-6 text-white">
      <div className="mx-auto max-w-6xl">
        <section className="mb-8 rounded-2xl border border-gray-800 bg-gray-950 p-6">
          <div className="flex flex-col gap-6 md:flex-row md:items-center md:justify-between">
            <div>
              <p className="mb-3 text-sm font-bold uppercase tracking-[0.25em] text-red-500">
                BattleGrid Events
              </p>

              <h1 className="mb-3 text-4xl font-black md:text-5xl">
                Tournaments
              </h1>

              <p className="max-w-2xl text-gray-400">
                Browse tournaments, check registration status, view brackets, and
                join events while registration is open.
              </p>
            </div>

            <div className="flex flex-col gap-3 sm:flex-row">
              <Link
                href="/my-tournaments"
                className="rounded-lg border border-gray-700 px-5 py-3 text-center font-bold text-white hover:bg-gray-900"
              >
                My Tournaments
              </Link>

              <Link
                href="/brackets"
                className="rounded-lg bg-white px-5 py-3 text-center font-bold text-black hover:bg-gray-200"
              >
                View Brackets
              </Link>
            </div>
          </div>
        </section>

        {featuredTournament && (
          <section className="mb-8 rounded-2xl border border-red-900/50 bg-red-950/20 p-6">
            <p className="mb-2 text-sm font-bold uppercase tracking-[0.25em] text-red-400">
              Featured
            </p>

            <div className="flex flex-col gap-5 md:flex-row md:items-center md:justify-between">
              <div>
                <h2 className="mb-2 text-3xl font-bold">
                  {featuredTournament.name}
                </h2>

                <p className="text-gray-300">
                  {featuredTournament.game || "Game not set"} •{" "}
                  {featuredTournament.platform || "Platform not set"}
                </p>

                <p className="mt-2 text-sm text-gray-400">
                  Start Time: {formatDisplayDate(featuredTournament.start_time)}
                </p>

                <div className="mt-3 flex flex-wrap gap-2">
                  <span
                    className={`rounded-full border px-3 py-1 text-xs font-bold ${getRegistrationClass(
                      featuredTournament
                    )}`}
                  >
                    {getRegistrationLabel(featuredTournament)}
                  </span>

                  <span
                    className={`rounded-full border px-3 py-1 text-xs font-bold ${
                      isTournamentFull(featuredTournament)
                        ? "border-red-700 bg-red-950/40 text-red-300"
                        : "border-gray-700 bg-black text-gray-300"
                    }`}
                  >
                    {isTournamentFull(featuredTournament)
                      ? "Full"
                      : "Spots Open"}
                  </span>
                </div>
              </div>

              <Link
                href={`/tournaments/${featuredTournament.id}`}
                className="rounded-lg bg-white px-5 py-3 text-center font-bold text-black hover:bg-gray-200"
              >
                View Featured Tournament
              </Link>
            </div>
          </section>
        )}

        <section className="mb-8 rounded-xl border border-gray-800 bg-gray-950 p-5">
          <div className="grid gap-4 lg:grid-cols-[1fr_190px_190px_auto] lg:items-end">
            <div>
              <label className="mb-1 block text-sm text-gray-400">
                Search tournaments
              </label>

              <input
                className="w-full rounded-lg border border-gray-700 bg-black px-4 py-3 text-white"
                placeholder="Search by name, game, or platform..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>

            <div>
              <label className="mb-1 block text-sm text-gray-400">
                Status
              </label>

              <select
                className="w-full rounded-lg border border-gray-700 bg-black px-4 py-3 text-white"
                value={statusFilter}
                onChange={(e) =>
                  setStatusFilter(e.target.value as StatusFilter)
                }
              >
                <option value="all">All</option>
                <option value="open">Registration Open</option>
                <option value="closed">Registration Closed</option>
                <option value="locked">Registration Locked</option>
                <option value="full">Full</option>
              </select>
            </div>

            <div>
              <label className="mb-1 block text-sm text-gray-400">
                Sort by
              </label>

              <select
                className="w-full rounded-lg border border-gray-700 bg-black px-4 py-3 text-white"
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value as SortBy)}
              >
                <option value="latest">Latest</option>
                <option value="start">Start Time</option>
                <option value="players">Most Players</option>
                <option value="prize">Prize Pool</option>
                <option value="entry">Lowest Entry</option>
              </select>
            </div>

            <button
              type="button"
              onClick={clearFilters}
              className="rounded-lg border border-gray-700 px-5 py-3 font-bold text-white hover:bg-gray-900"
            >
              Clear
            </button>
          </div>
        </section>

        {loading && (
          <p className="rounded-xl border border-gray-800 bg-gray-950 p-6 text-gray-400">
            Loading tournaments...
          </p>
        )}

        {!loading && errorMessage && (
          <div className="rounded-xl border border-red-900 bg-red-950/40 p-6">
            <h2 className="mb-2 text-xl font-bold text-red-300">
              Error loading tournaments
            </h2>

            <p className="text-red-200">{errorMessage}</p>
          </div>
        )}

        {!loading && !errorMessage && tournaments.length === 0 && (
          <div className="rounded-xl border border-gray-800 bg-gray-950 p-6">
            <h2 className="mb-2 text-2xl font-bold">No tournaments yet</h2>

            <p className="mb-4 text-gray-400">
              Once tournaments are created, they will show up here.
            </p>

            <Link
              href="/admin"
              className="inline-block rounded-lg bg-white px-5 py-3 font-bold text-black hover:bg-gray-200"
            >
              Create Tournament
            </Link>
          </div>
        )}

        {!loading &&
          !errorMessage &&
          tournaments.length > 0 &&
          filteredTournaments.length === 0 && (
            <div className="rounded-xl border border-gray-800 bg-gray-950 p-6">
              <h2 className="mb-2 text-2xl font-bold">No matches found</h2>

              <p className="mb-4 text-gray-400">
                Try changing your search or filter settings.
              </p>

              <button
                type="button"
                onClick={clearFilters}
                className="rounded-lg bg-white px-5 py-3 font-bold text-black hover:bg-gray-200"
              >
                Clear Filters
              </button>
            </div>
          )}

        {!loading && !errorMessage && filteredTournaments.length > 0 && (
          <>
            <p className="mb-4 text-sm text-gray-400">
              Showing {filteredTournaments.length} of {tournaments.length}{" "}
              tournaments.
            </p>

            <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-3">
              {filteredTournaments.map((tournament) => {
                const joinedPlayers = playerCounts[tournament.id] || 0;
                const maxPlayers = tournament.max_players || 0;
                const spotsLeft =
                  maxPlayers > 0
                    ? Math.max(maxPlayers - joinedPlayers, 0)
                    : null;

                const isFull = isTournamentFull(tournament);

                return (
                  <div
                    key={tournament.id}
                    className="rounded-xl border border-gray-800 bg-gray-950 p-5"
                  >
                    <div className="mb-4">
                      <h2 className="text-2xl font-bold">
                        {tournament.name}
                      </h2>

                      <p className="mt-1 text-sm text-gray-500">
                        Created{" "}
                        {new Date(tournament.created_at).toLocaleDateString()}
                      </p>
                    </div>

                    <div className="mb-4 flex flex-wrap gap-2">
                      <span
                        className={`rounded-full border px-3 py-1 text-xs font-bold ${getRegistrationClass(
                          tournament
                        )}`}
                      >
                        {getRegistrationLabel(tournament)}
                      </span>

                      <span
                        className={`rounded-full border px-3 py-1 text-xs font-bold ${
                          isFull
                            ? "border-red-700 bg-red-950/40 text-red-300"
                            : "border-gray-700 bg-black text-gray-300"
                        }`}
                      >
                        {isFull ? "Full" : "Spots Open"}
                      </span>
                    </div>

                    <div className="mb-5 grid gap-2 text-sm text-gray-300">
                      <p>
                        <span className="text-gray-500">Game:</span>{" "}
                        {tournament.game || "Not set"}
                      </p>

                      <p>
                        <span className="text-gray-500">Platform:</span>{" "}
                        {tournament.platform || "Not set"}
                      </p>

                      <p>
                        <span className="text-gray-500">Start Time:</span>{" "}
                        {formatDisplayDate(tournament.start_time)}
                      </p>

                      <p>
                        <span className="text-gray-500">Prize Pool:</span> $
                        {tournament.prize_pool || 0}
                      </p>

                      <p>
                        <span className="text-gray-500">Entry Fee:</span> $
                        {tournament.entry_fee || 0}
                      </p>

                      <p>
                        <span className="text-gray-500">Players:</span>{" "}
                        {joinedPlayers}
                        {maxPlayers > 0 ? ` / ${maxPlayers}` : ""}
                      </p>

                      <p>
                        <span className="text-gray-500">Spots Left:</span>{" "}
                        {spotsLeft === null ? "Unlimited" : spotsLeft}
                      </p>
                    </div>

                    <div className="grid gap-3">
                      <Link
                        href={`/tournaments/${tournament.id}`}
                        className="block rounded-lg bg-white px-4 py-3 text-center font-bold text-black hover:bg-gray-200"
                      >
                        View Tournament
                      </Link>

                      <Link
                        href={`/brackets?tournament=${tournament.id}`}
                        className="block rounded-lg border border-gray-700 px-4 py-3 text-center font-bold text-white hover:bg-gray-900"
                      >
                        View Bracket
                      </Link>
                    </div>
                  </div>
                );
              })}
            </div>
          </>
        )}
      </div>
    </main>
  );
}