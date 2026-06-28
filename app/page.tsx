"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "./lib/supabase";

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

export default function HomePage() {
  const [tournaments, setTournaments] = useState<Tournament[]>([]);
  const [playerCounts, setPlayerCounts] = useState<Record<string, number>>({});
  const [matchCounts, setMatchCounts] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");

  useEffect(() => {
    let isMounted = true;

    async function loadHomeData() {
      const { data: tournamentData, error: tournamentError } = await supabase
        .from("tournaments")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(6);

      if (!isMounted) return;

      if (tournamentError) {
        setMessage(`Error loading tournaments: ${tournamentError.message}`);
        setTournaments([]);
        setPlayerCounts({});
        setMatchCounts({});
        setLoading(false);
        return;
      }

      const loadedTournaments = (tournamentData || []) as Tournament[];

      const { data: playerData, error: playerError } = await supabase
        .from("tournament_players")
        .select("tournament_id");

      if (!isMounted) return;

      if (playerError) {
        setMessage(`Error loading player counts: ${playerError.message}`);
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
        setMessage(`Error loading bracket status: ${matchError.message}`);
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

    loadHomeData();

    return () => {
      isMounted = false;
    };
  }, []);

  const featuredTournament = useMemo(() => {
    return tournaments[0] || null;
  }, [tournaments]);

  const totalPlayers = useMemo(() => {
    return Object.values(playerCounts).reduce((total, count) => total + count, 0);
  }, [playerCounts]);

  const lockedTournamentCount = useMemo(() => {
    return tournaments.filter((tournament) => {
      return (matchCounts[tournament.id] || 0) > 0;
    }).length;
  }, [tournaments, matchCounts]);

  const closedTournamentCount = useMemo(() => {
    return tournaments.filter((tournament) => {
      const isLocked = (matchCounts[tournament.id] || 0) > 0;
      const isClosed = tournament.registration_open === false;

      return isClosed && !isLocked;
    }).length;
  }, [tournaments, matchCounts]);

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

  return (
    <main className="min-h-screen bg-black text-white">
      <section className="mx-auto grid max-w-6xl gap-10 px-6 py-20 md:grid-cols-2 md:items-center">
        <div>
          <p className="mb-4 text-sm font-bold uppercase tracking-[0.3em] text-red-500">
            Competitive Gaming Starts Here
          </p>

          <h1 className="mb-6 text-5xl font-black leading-tight md:text-6xl">
            Build, join, and win gaming tournaments.
          </h1>

          <p className="mb-8 text-lg text-gray-400">
            BattleGrid gives players a place to join tournaments, track scores,
            view brackets, and compete for prizes.
          </p>

          <div className="flex flex-col gap-3 sm:flex-row">
            <Link
              href="/tournaments"
              className="rounded-lg bg-white px-6 py-4 text-center font-bold text-black hover:bg-gray-200"
            >
              Browse Tournaments
            </Link>

            <Link
              href="/signup"
              className="rounded-lg border border-gray-700 px-6 py-4 text-center font-bold text-white hover:bg-gray-900"
            >
              Create Account
            </Link>
          </div>
        </div>

        <div className="rounded-2xl border border-gray-800 bg-gray-950 p-6">
          <p className="mb-3 text-sm font-bold uppercase tracking-[0.25em] text-red-500">
            Featured Tournament
          </p>

          {loading ? (
            <div className="rounded-xl border border-gray-800 bg-black p-5">
              <p className="text-gray-400">Loading featured tournament...</p>
            </div>
          ) : featuredTournament ? (
            <>
              <div className="mb-4 rounded-xl border border-gray-800 bg-black p-5">
                <h2 className="text-2xl font-bold">
                  {featuredTournament.name}
                </h2>

                <p className="mt-2 text-gray-400">
                  {featuredTournament.game || "Game not set"} •{" "}
                  {featuredTournament.platform || "Platform not set"}
                </p>

                <p className="mt-2 text-sm text-gray-500">
                  Start Time: {formatDisplayDate(featuredTournament.start_time)}
                </p>

                <div className="mt-4 flex flex-wrap gap-2">
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

              <div className="mb-5 grid gap-4 sm:grid-cols-3">
                <div className="rounded-xl border border-gray-800 bg-black p-4">
                  <p className="text-sm text-gray-500">Prize Pool</p>
                  <p className="text-2xl font-bold">
                    ${featuredTournament.prize_pool || 0}
                  </p>
                </div>

                <div className="rounded-xl border border-gray-800 bg-black p-4">
                  <p className="text-sm text-gray-500">Players</p>
                  <p className="text-2xl font-bold">
                    {playerCounts[featuredTournament.id] || 0}
                    {featuredTournament.max_players
                      ? ` / ${featuredTournament.max_players}`
                      : ""}
                  </p>
                </div>

                <div className="rounded-xl border border-gray-800 bg-black p-4">
                  <p className="text-sm text-gray-500">Entry</p>
                  <p className="text-2xl font-bold">
                    ${featuredTournament.entry_fee || 0}
                  </p>
                </div>
              </div>

              <Link
                href={`/tournaments/${featuredTournament.id}`}
                className="block rounded-lg bg-white px-5 py-3 text-center font-bold text-black hover:bg-gray-200"
              >
                View Featured Tournament
              </Link>
            </>
          ) : (
            <div className="rounded-xl border border-gray-800 bg-black p-5">
              <h2 className="mb-2 text-2xl font-bold">No tournaments yet</h2>

              <p className="mb-4 text-gray-400">
                Create your first tournament from the admin dashboard.
              </p>

              <Link
                href="/admin"
                className="inline-block rounded-lg bg-white px-5 py-3 font-bold text-black hover:bg-gray-200"
              >
                Create Tournament
              </Link>
            </div>
          )}
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-6 pb-12">
        <div className="grid gap-5 md:grid-cols-4">
          <div className="rounded-xl border border-gray-800 bg-gray-950 p-6">
            <p className="text-sm text-gray-500">Latest Tournaments</p>
            <p className="mt-2 text-4xl font-black">{tournaments.length}</p>
          </div>

          <div className="rounded-xl border border-gray-800 bg-gray-950 p-6">
            <p className="text-sm text-gray-500">Joined Players</p>
            <p className="mt-2 text-4xl font-black">{totalPlayers}</p>
          </div>

          <div className="rounded-xl border border-gray-800 bg-gray-950 p-6">
            <p className="text-sm text-gray-500">Closed Registration</p>
            <p className="mt-2 text-4xl font-black">{closedTournamentCount}</p>
          </div>

          <div className="rounded-xl border border-gray-800 bg-gray-950 p-6">
            <p className="text-sm text-gray-500">Locked Brackets</p>
            <p className="mt-2 text-4xl font-black">{lockedTournamentCount}</p>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-6 pb-20">
        <div className="mb-6 flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
          <div>
            <h2 className="text-3xl font-black">Latest Tournaments</h2>

            <p className="mt-2 text-gray-400">
              Jump into one of the newest BattleGrid events while registration
              is open.
            </p>
          </div>

          <Link
            href="/tournaments"
            className="rounded-lg border border-gray-700 px-5 py-3 text-center font-bold text-white hover:bg-gray-900"
          >
            View All
          </Link>
        </div>

        {message && (
          <p className="mb-6 rounded-lg border border-red-900 bg-red-950/40 p-4 text-sm text-red-200">
            {message}
          </p>
        )}

        {loading ? (
          <p className="rounded-xl border border-gray-800 bg-gray-950 p-6 text-gray-400">
            Loading tournaments...
          </p>
        ) : tournaments.length === 0 ? (
          <div className="rounded-xl border border-gray-800 bg-gray-950 p-6">
            <h3 className="mb-2 text-2xl font-bold">No tournaments yet</h3>

            <p className="text-gray-400">
              Once tournaments are created, they will appear here.
            </p>
          </div>
        ) : (
          <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-3">
            {tournaments.map((tournament) => {
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
                    <h3 className="text-xl font-bold">{tournament.name}</h3>

                    <p className="mt-1 text-sm text-gray-500">
                      {tournament.game || "Game not set"} •{" "}
                      {tournament.platform || "Platform not set"}
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

                  <Link
                    href={`/tournaments/${tournament.id}`}
                    className="block rounded-lg bg-white px-4 py-3 text-center font-bold text-black hover:bg-gray-200"
                  >
                    View Tournament
                  </Link>
                </div>
              );
            })}
          </div>
        )}
      </section>
    </main>
  );
}