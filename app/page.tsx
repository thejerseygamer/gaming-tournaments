"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "./lib/supabase";

type Tournament = {
  id: string;
  name: string;
  game: string | null;
  platform: string | null;
  prize_pool: number | null;
  entry_fee: number | null;
  max_players: number | null;
  created_at: string | null;
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
    let active = true;

    async function loadHomeData() {
      await Promise.resolve();

      const { data: tournamentData, error: tournamentError } = await supabase
        .from("tournaments")
        .select(
          "id, name, game, platform, prize_pool, entry_fee, max_players, created_at"
        )
        .order("created_at", { ascending: false })
        .limit(3);

      if (!active) {
        return;
      }

      if (tournamentError) {
        setMessage(tournamentError.message);
        setLoading(false);
        return;
      }

      const loadedTournaments = (tournamentData || []) as Tournament[];
      const tournamentIds = loadedTournaments.map((tournament) => tournament.id);

      if (tournamentIds.length === 0) {
        setTournaments([]);
        setPlayerCounts({});
        setMatchCounts({});
        setLoading(false);
        return;
      }

      const { data: playerData, error: playerError } = await supabase
        .from("tournament_players")
        .select("tournament_id")
        .in("tournament_id", tournamentIds);

      if (!active) {
        return;
      }

      if (playerError) {
        setMessage(playerError.message);
        setLoading(false);
        return;
      }

      const playerCountMap: Record<string, number> = {};

      ((playerData || []) as TournamentPlayerRow[]).forEach((row) => {
        playerCountMap[row.tournament_id] =
          (playerCountMap[row.tournament_id] || 0) + 1;
      });

      const { data: matchData, error: matchError } = await supabase
        .from("matches")
        .select("tournament_id")
        .in("tournament_id", tournamentIds);

      if (!active) {
        return;
      }

      if (matchError) {
        setMessage(matchError.message);
        setLoading(false);
        return;
      }

      const matchCountMap: Record<string, number> = {};

      ((matchData || []) as MatchRow[]).forEach((row) => {
        matchCountMap[row.tournament_id] =
          (matchCountMap[row.tournament_id] || 0) + 1;
      });

      setTournaments(loadedTournaments);
      setPlayerCounts(playerCountMap);
      setMatchCounts(matchCountMap);
      setLoading(false);
    }

    loadHomeData();

    return () => {
      active = false;
    };
  }, []);

  const totalOpenTournaments = useMemo(() => {
    return tournaments.filter((tournament) => {
      const joinedPlayers = playerCounts[tournament.id] || 0;

      if (!tournament.max_players) {
        return true;
      }

      return joinedPlayers < tournament.max_players;
    }).length;
  }, [tournaments, playerCounts]);

  const totalPlayersShown = useMemo(() => {
    return Object.values(playerCounts).reduce((total, count) => total + count, 0);
  }, [playerCounts]);

  const totalMatchesShown = useMemo(() => {
    return Object.values(matchCounts).reduce((total, count) => total + count, 0);
  }, [matchCounts]);

  function formatMoney(value: number | null) {
    if (value === null) {
      return "Not set";
    }

    if (value === 0) {
      return "Free";
    }

    return `$${value}`;
  }

  return (
    <main className="min-h-screen bg-zinc-950 text-white">
      <section className="border-b border-zinc-800 bg-linear-to-b from-zinc-900 to-zinc-950 px-6 py-20">
        <div className="mx-auto grid max-w-7xl gap-12 lg:grid-cols-[1.2fr_0.8fr] lg:items-center">
          <div>
            <p className="mb-4 text-sm font-black uppercase tracking-[0.3em] text-red-400">
              BattleGrid Gaming Tournaments
            </p>

            <h1 className="max-w-4xl text-5xl font-black tracking-tight sm:text-6xl lg:text-7xl">
              Build brackets, join tournaments, and crown champions.
            </h1>

            <p className="mt-6 max-w-2xl text-lg leading-8 text-zinc-400">
              BattleGrid gives Madden and competitive gaming players a place to
              join events, track brackets, report winners, and follow tournament
              progress from one clean dashboard.
            </p>

            <div className="mt-8 flex flex-col gap-4 sm:flex-row">
              <Link
                href="/tournaments"
                className="rounded-xl bg-red-600 px-6 py-4 text-center font-bold text-white hover:bg-red-700"
              >
                Browse Tournaments
              </Link>

              <Link
                href="/signup"
                className="rounded-xl border border-zinc-700 px-6 py-4 text-center font-bold text-white hover:bg-zinc-800"
              >
                Create Player Account
              </Link>
            </div>
          </div>

          <div className="rounded-2xl border border-zinc-800 bg-zinc-950 p-6 shadow-2xl">
            <div className="rounded-xl border border-red-500/30 bg-red-500/10 p-5">
              <p className="text-sm font-bold uppercase tracking-widest text-red-300">
                Live Platform Snapshot
              </p>

              <div className="mt-6 grid gap-4">
                <div className="rounded-xl bg-zinc-950 p-5">
                  <p className="text-sm text-zinc-500">Featured Tournaments</p>
                  <p className="mt-1 text-4xl font-black">
                    {loading ? "..." : tournaments.length}
                  </p>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="rounded-xl bg-zinc-950 p-5">
                    <p className="text-sm text-zinc-500">Open Events</p>
                    <p className="mt-1 text-3xl font-black">
                      {loading ? "..." : totalOpenTournaments}
                    </p>
                  </div>

                  <div className="rounded-xl bg-zinc-950 p-5">
                    <p className="text-sm text-zinc-500">Players</p>
                    <p className="mt-1 text-3xl font-black">
                      {loading ? "..." : totalPlayersShown}
                    </p>
                  </div>
                </div>

                <div className="rounded-xl bg-zinc-950 p-5">
                  <p className="text-sm text-zinc-500">Generated Matches</p>
                  <p className="mt-1 text-3xl font-black">
                    {loading ? "..." : totalMatchesShown}
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="px-6 py-16">
        <div className="mx-auto max-w-7xl">
          <div className="mb-8 flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <p className="mb-2 text-sm font-black uppercase tracking-widest text-red-400">
                Featured Events
              </p>

              <h2 className="text-4xl font-black">Latest Tournaments</h2>

              <p className="mt-3 max-w-2xl text-zinc-400">
                Jump into available events, check player counts, and follow
                brackets once they are generated.
              </p>
            </div>

            <Link
              href="/tournaments"
              className="rounded-lg border border-zinc-700 px-5 py-3 text-center font-semibold text-white hover:bg-zinc-800"
            >
              View All Tournaments
            </Link>
          </div>

          {message && (
            <div className="rounded-xl border border-red-500/40 bg-red-500/10 p-5 text-red-300">
              {message}
            </div>
          )}

          {!message && loading && (
            <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-8 text-zinc-400">
              Loading featured tournaments...
            </div>
          )}

          {!message && !loading && tournaments.length === 0 && (
            <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-8 text-center">
              <h3 className="text-2xl font-bold">No tournaments yet</h3>

              <p className="mt-2 text-zinc-400">
                Create your first tournament from the admin dashboard.
              </p>

              <Link
                href="/admin"
                className="mt-6 inline-block rounded-lg bg-red-600 px-5 py-3 font-semibold text-white hover:bg-red-700"
              >
                Create Tournament
              </Link>
            </div>
          )}

          {!message && !loading && tournaments.length > 0 && (
            <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-3">
              {tournaments.map((tournament) => {
                const joinedPlayers = playerCounts[tournament.id] || 0;
                const totalMatches = matchCounts[tournament.id] || 0;
                const maxPlayers = tournament.max_players;
                const isFull =
                  maxPlayers !== null &&
                  maxPlayers !== undefined &&
                  joinedPlayers >= maxPlayers;

                return (
                  <article
                    key={tournament.id}
                    className="flex flex-col rounded-2xl border border-zinc-800 bg-zinc-900 p-6 shadow-lg"
                  >
                    <div className="mb-5 flex items-start justify-between gap-4">
                      <div>
                        <h3 className="text-2xl font-black">
                          {tournament.name}
                        </h3>

                        <p className="mt-2 text-sm text-zinc-400">
                          {tournament.game || "Game not set"} •{" "}
                          {tournament.platform || "Platform not set"}
                        </p>
                      </div>

                      <span
                        className={`rounded-full px-3 py-1 text-xs font-bold ${
                          isFull
                            ? "bg-red-500/10 text-red-300"
                            : "bg-green-500/10 text-green-300"
                        }`}
                      >
                        {isFull ? "Full" : "Open"}
                      </span>
                    </div>

                    <div className="grid gap-3 text-sm">
                      <div className="grid grid-cols-2 gap-3">
                        <div className="rounded-lg bg-zinc-950 p-4">
                          <p className="text-zinc-500">Prize</p>
                          <p className="mt-1 font-bold">
                            {formatMoney(tournament.prize_pool)}
                          </p>
                        </div>

                        <div className="rounded-lg bg-zinc-950 p-4">
                          <p className="text-zinc-500">Entry</p>
                          <p className="mt-1 font-bold">
                            {formatMoney(tournament.entry_fee)}
                          </p>
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-3">
                        <div className="rounded-lg bg-zinc-950 p-4">
                          <p className="text-zinc-500">Players</p>
                          <p className="mt-1 font-bold">
                            {joinedPlayers}
                            {maxPlayers ? ` / ${maxPlayers}` : ""}
                          </p>
                        </div>

                        <div className="rounded-lg bg-zinc-950 p-4">
                          <p className="text-zinc-500">Matches</p>
                          <p className="mt-1 font-bold">{totalMatches}</p>
                        </div>
                      </div>
                    </div>

                    <div className="mt-6 flex flex-col gap-3">
                      <Link
                        href={`/tournaments/${tournament.id}`}
                        className="rounded-lg bg-red-600 px-4 py-3 text-center font-bold text-white hover:bg-red-700"
                      >
                        View Details / Join
                      </Link>

                      <Link
                        href="/brackets"
                        className="rounded-lg border border-zinc-700 px-4 py-3 text-center font-bold text-white hover:bg-zinc-800"
                      >
                        View Brackets
                      </Link>
                    </div>
                  </article>
                );
              })}
            </div>
          )}
        </div>
      </section>

      <section className="border-t border-zinc-800 px-6 py-16">
        <div className="mx-auto max-w-7xl">
          <div className="mb-8">
            <p className="mb-2 text-sm font-black uppercase tracking-widest text-red-400">
              How It Works
            </p>

            <h2 className="text-4xl font-black">Run tournaments in 4 steps</h2>
          </div>

          <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-4">
            <div className="rounded-2xl border border-zinc-800 bg-zinc-900 p-6">
              <p className="text-4xl font-black text-red-500">01</p>
              <h3 className="mt-4 text-xl font-bold">Create Profile</h3>
              <p className="mt-2 text-zinc-400">
                Players add a gamer tag, platform, and favorite team.
              </p>
            </div>

            <div className="rounded-2xl border border-zinc-800 bg-zinc-900 p-6">
              <p className="text-4xl font-black text-red-500">02</p>
              <h3 className="mt-4 text-xl font-bold">Join Tournament</h3>
              <p className="mt-2 text-zinc-400">
                Players join open events and track them from My Tournaments.
              </p>
            </div>

            <div className="rounded-2xl border border-zinc-800 bg-zinc-900 p-6">
              <p className="text-4xl font-black text-red-500">03</p>
              <h3 className="mt-4 text-xl font-bold">Generate Bracket</h3>
              <p className="mt-2 text-zinc-400">
                Admins generate matchups and save winners after games finish.
              </p>
            </div>

            <div className="rounded-2xl border border-zinc-800 bg-zinc-900 p-6">
              <p className="text-4xl font-black text-red-500">04</p>
              <h3 className="mt-4 text-xl font-bold">Crown Champion</h3>
              <p className="mt-2 text-zinc-400">
                Winners advance until one final champion is shown on brackets.
              </p>
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}