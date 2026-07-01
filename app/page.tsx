"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "./lib/supabase";
import { checkIsAdmin } from "./lib/admin";

type Tournament = {
  id: string;
  name: string;
  game: string | null;
  platform: string | null;
  prize_pool: number | null;
  entry_fee: number | null;
  max_players: number | null;
  start_time: string | null;
  registration_open: boolean;
  created_at: string;
};

type TournamentPlayer = {
  tournament_id: string;
  player_id: string;
};

type LeaderboardPlayer = {
  leaderboard_rank: number | null;
  id: string;
  gamer_tag: string | null;
  platform: string | null;
  favorite_team: string | null;
  wins: number;
  losses: number;
  tournaments_won: number;
  win_percentage: number;
};

type MatchRow = {
  id: string;
  status: string | null;
};

function formatMoney(value: number | null) {
  if (value === null || value === undefined) return "Free";

  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
  }).format(value);
}

function formatDateTime(value: string | null) {
  if (!value) return "Date TBD";

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) return "Date TBD";

  return date.toLocaleString();
}

function formatWinPercentage(value: number) {
  return `${Number(value || 0).toFixed(1)}%`;
}

export default function HomePage() {
  const [userEmail, setUserEmail] = useState("");
  const [isAdmin, setIsAdmin] = useState(false);

  const [tournaments, setTournaments] = useState<Tournament[]>([]);
  const [tournamentPlayers, setTournamentPlayers] = useState<
    TournamentPlayer[]
  >([]);
  const [topPlayers, setTopPlayers] = useState<LeaderboardPlayer[]>([]);
  const [matches, setMatches] = useState<MatchRow[]>([]);

  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");

  const loadHomeData = useCallback(async () => {
    setLoading(true);
    setMessage("");

    const adminCheck = await checkIsAdmin();

    setUserEmail(adminCheck.user?.email || "");
    setIsAdmin(Boolean(adminCheck.isAdmin));

    const { data: tournamentData, error: tournamentError } = await supabase
      .from("tournaments")
      .select(
        "id, name, game, platform, prize_pool, entry_fee, max_players, start_time, registration_open, created_at"
      )
      .order("created_at", { ascending: false })
      .limit(6);

    if (tournamentError) {
      setMessage(`Error loading tournaments: ${tournamentError.message}`);
      setTournaments([]);
    } else {
      setTournaments((tournamentData || []) as Tournament[]);
    }

    const { data: playerData, error: playerError } = await supabase
      .from("tournament_players")
      .select("tournament_id, player_id");

    if (playerError) {
      setTournamentPlayers([]);
    } else {
      setTournamentPlayers((playerData || []) as TournamentPlayer[]);
    }

    const { data: leaderboardData, error: leaderboardError } = await supabase
      .from("player_leaderboard")
      .select(
        "leaderboard_rank, id, gamer_tag, platform, favorite_team, wins, losses, tournaments_won, win_percentage"
      )
      .order("leaderboard_rank", { ascending: true })
      .limit(5);

    if (leaderboardError) {
      setTopPlayers([]);
    } else {
      setTopPlayers((leaderboardData || []) as LeaderboardPlayer[]);
    }

    const { data: matchData, error: matchError } = await supabase
      .from("matches")
      .select("id, status");

    if (matchError) {
      setMatches([]);
    } else {
      setMatches((matchData || []) as MatchRow[]);
    }

    setLoading(false);
  }, []);

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      void loadHomeData();
    }, 0);

    return () => {
      window.clearTimeout(timeoutId);
    };
  }, [loadHomeData]);

  const playerCountsByTournament = useMemo(() => {
    return tournamentPlayers.reduce((acc, row) => {
      acc[row.tournament_id] = (acc[row.tournament_id] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);
  }, [tournamentPlayers]);

  const openTournaments = useMemo(() => {
    return tournaments.filter((tournament) => tournament.registration_open);
  }, [tournaments]);

  const completedMatches = useMemo(() => {
    return matches.filter((match) => match.status === "completed");
  }, [matches]);

  const pendingMatches = useMemo(() => {
    return matches.filter((match) => match.status !== "completed");
  }, [matches]);

  function tournamentStatus(tournament: Tournament) {
    if (!tournament.registration_open) return "Registration Closed";

    const playerCount = playerCountsByTournament[tournament.id] || 0;

    if (tournament.max_players && playerCount >= tournament.max_players) {
      return "Full";
    }

    return "Open";
  }

  function tournamentStatusClass(tournament: Tournament) {
    const status = tournamentStatus(tournament);

    if (status === "Open") {
      return "border-green-700 bg-green-950/30 text-green-300";
    }

    if (status === "Full") {
      return "border-yellow-700 bg-yellow-950/30 text-yellow-300";
    }

    return "border-red-700 bg-red-950/30 text-red-300";
  }

  function playerName(player: LeaderboardPlayer) {
    return player.gamer_tag || "Unnamed Player";
  }

  return (
    <main className="min-h-screen bg-black text-white">
      <section className="border-b border-gray-800 bg-[radial-gradient(circle_at_top,rgba(127,29,29,0.45),transparent_45%),linear-gradient(to_bottom,#020617,#000000)] px-6 py-20">
        <div className="mx-auto grid max-w-7xl gap-10 lg:grid-cols-[1.2fr_0.8fr] lg:items-center">
          <div>
            <p className="mb-4 text-sm font-black uppercase tracking-[0.3em] text-red-400">
              BattleGrid
            </p>

            <h1 className="mb-6 max-w-4xl text-5xl font-black leading-tight md:text-7xl">
              Run tournaments. Track scores. Crown champions.
            </h1>

            <p className="mb-8 max-w-2xl text-lg leading-8 text-gray-300">
              BattleGrid is your tournament hub for competitive gamers. Join
              events, generate brackets, submit scores, review results, and climb
              the leaderboard.
            </p>

            <div className="flex flex-col gap-3 sm:flex-row">
              <Link
                href="/tournaments"
                className="rounded-xl bg-white px-6 py-4 text-center font-black text-black hover:bg-gray-200"
              >
                Browse Tournaments
              </Link>

              {userEmail ? (
                <Link
                  href="/my-tournaments"
                  className="rounded-xl border border-gray-700 px-6 py-4 text-center font-black text-white hover:bg-gray-900"
                >
                  My Dashboard
                </Link>
              ) : (
                <Link
                  href="/signup"
                  className="rounded-xl border border-gray-700 px-6 py-4 text-center font-black text-white hover:bg-gray-900"
                >
                  Create Account
                </Link>
              )}

              {isAdmin && (
                <Link
                  href="/admin"
                  className="rounded-xl border border-red-700 bg-red-950/30 px-6 py-4 text-center font-black text-red-200 hover:bg-red-950/60"
                >
                  Admin Tools
                </Link>
              )}
            </div>

            {userEmail && (
              <p className="mt-5 text-sm text-gray-500">
                Logged in as {userEmail}
              </p>
            )}
          </div>

          <section className="rounded-3xl border border-red-900/60 bg-black/70 p-6 shadow-2xl shadow-red-950/40">
            <p className="mb-4 text-sm font-bold uppercase tracking-[0.25em] text-red-400">
              Live Platform Stats
            </p>

            <div className="grid gap-4">
              <div className="rounded-2xl border border-gray-800 bg-gray-950 p-5">
                <p className="text-sm text-gray-500">Open Tournaments</p>
                <p className="mt-2 text-5xl font-black">
                  {openTournaments.length}
                </p>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div className="rounded-2xl border border-gray-800 bg-gray-950 p-5">
                  <p className="text-sm text-gray-500">Players Registered</p>
                  <p className="mt-2 text-4xl font-black">
                    {tournamentPlayers.length}
                  </p>
                </div>

                <div className="rounded-2xl border border-gray-800 bg-gray-950 p-5">
                  <p className="text-sm text-gray-500">Matches Completed</p>
                  <p className="mt-2 text-4xl font-black">
                    {completedMatches.length}
                  </p>
                </div>
              </div>

              <div className="rounded-2xl border border-gray-800 bg-gray-950 p-5">
                <p className="text-sm text-gray-500">Pending / Active Matches</p>
                <p className="mt-2 text-4xl font-black">
                  {pendingMatches.length}
                </p>
              </div>
            </div>
          </section>
        </div>
      </section>

      <section className="px-6 py-10">
        <div className="mx-auto max-w-7xl">
          {message && (
            <p className="mb-6 rounded-lg border border-yellow-800 bg-yellow-950/30 p-4 text-sm text-yellow-200">
              {message}
            </p>
          )}

          <section className="mb-10 grid gap-4 md:grid-cols-4">
            <Link
              href="/tournaments"
              className="rounded-2xl border border-gray-800 bg-gray-950 p-5 hover:border-red-700 hover:bg-red-950/20"
            >
              <p className="text-sm text-gray-500">Find Events</p>
              <p className="mt-2 text-2xl font-black">Tournaments</p>
            </Link>

            <Link
              href="/brackets"
              className="rounded-2xl border border-gray-800 bg-gray-950 p-5 hover:border-red-700 hover:bg-red-950/20"
            >
              <p className="text-sm text-gray-500">Track Matchups</p>
              <p className="mt-2 text-2xl font-black">Brackets</p>
            </Link>

            <Link
              href="/leaderboard"
              className="rounded-2xl border border-gray-800 bg-gray-950 p-5 hover:border-red-700 hover:bg-red-950/20"
            >
              <p className="text-sm text-gray-500">See Rankings</p>
              <p className="mt-2 text-2xl font-black">Leaderboard</p>
            </Link>

            <Link
              href={userEmail ? "/notifications" : "/login"}
              className="rounded-2xl border border-gray-800 bg-gray-950 p-5 hover:border-red-700 hover:bg-red-950/20"
            >
              <p className="text-sm text-gray-500">Stay Updated</p>
              <p className="mt-2 text-2xl font-black">Notifications</p>
            </Link>
          </section>

          <section className="grid gap-8 lg:grid-cols-[1fr_420px]">
            <div>
              <div className="mb-5 flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
                <div>
                  <p className="mb-2 text-sm font-bold uppercase tracking-[0.25em] text-red-500">
                    Featured Events
                  </p>

                  <h2 className="text-3xl font-black">Latest Tournaments</h2>
                </div>

                <Link
                  href="/tournaments"
                  className="text-sm font-bold text-gray-400 hover:text-white"
                >
                  View All →
                </Link>
              </div>

              {loading ? (
                <p className="rounded-xl border border-gray-800 bg-gray-950 p-6 text-gray-400">
                  Loading tournaments...
                </p>
              ) : tournaments.length === 0 ? (
                <section className="rounded-xl border border-gray-800 bg-gray-950 p-6">
                  <h3 className="mb-2 text-2xl font-bold">
                    No tournaments yet
                  </h3>

                  <p className="mb-5 text-gray-400">
                    Once tournaments are created, they will appear here.
                  </p>

                  {isAdmin ? (
                    <Link
                      href="/admin"
                      className="inline-block rounded-lg bg-white px-5 py-3 font-bold text-black hover:bg-gray-200"
                    >
                      Create Tournament
                    </Link>
                  ) : (
                    <Link
                      href="/signup"
                      className="inline-block rounded-lg bg-white px-5 py-3 font-bold text-black hover:bg-gray-200"
                    >
                      Join BattleGrid
                    </Link>
                  )}
                </section>
              ) : (
                <div className="grid gap-4">
                  {tournaments.map((tournament) => {
                    const playerCount =
                      playerCountsByTournament[tournament.id] || 0;

                    return (
                      <article
                        key={tournament.id}
                        className="rounded-2xl border border-gray-800 bg-gray-950 p-5"
                      >
                        <div className="mb-4 flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                          <div>
                            <div className="mb-3 flex flex-wrap gap-2">
                              <span
                                className={`rounded-full border px-3 py-1 text-xs font-bold ${tournamentStatusClass(
                                  tournament
                                )}`}
                              >
                                {tournamentStatus(tournament)}
                              </span>

                              <span className="rounded-full border border-gray-700 bg-black px-3 py-1 text-xs font-bold text-gray-300">
                                {tournament.game || "Game TBD"}
                              </span>
                            </div>

                            <h3 className="text-2xl font-black">
                              {tournament.name}
                            </h3>

                            <p className="mt-1 text-sm text-gray-500">
                              {tournament.platform || "Platform TBD"} • Starts:{" "}
                              {formatDateTime(tournament.start_time)}
                            </p>
                          </div>

                          <Link
                            href={`/tournaments/${tournament.id}`}
                            className="rounded-lg bg-white px-5 py-3 text-center text-sm font-bold text-black hover:bg-gray-200"
                          >
                            View Event
                          </Link>
                        </div>

                        <div className="grid gap-3 md:grid-cols-4">
                          <div className="rounded-lg border border-gray-800 bg-black p-3">
                            <p className="text-xs text-gray-500">Players</p>
                            <p className="mt-1 text-xl font-black">
                              {playerCount}/{tournament.max_players || "∞"}
                            </p>
                          </div>

                          <div className="rounded-lg border border-gray-800 bg-black p-3">
                            <p className="text-xs text-gray-500">Prize Pool</p>
                            <p className="mt-1 text-xl font-black">
                              {formatMoney(tournament.prize_pool)}
                            </p>
                          </div>

                          <div className="rounded-lg border border-gray-800 bg-black p-3">
                            <p className="text-xs text-gray-500">Entry</p>
                            <p className="mt-1 text-xl font-black">
                              {formatMoney(tournament.entry_fee)}
                            </p>
                          </div>

                          <div className="rounded-lg border border-gray-800 bg-black p-3">
                            <p className="text-xs text-gray-500">Platform</p>
                            <p className="mt-1 text-xl font-black">
                              {tournament.platform || "TBD"}
                            </p>
                          </div>
                        </div>
                      </article>
                    );
                  })}
                </div>
              )}
            </div>

            <aside className="grid h-fit gap-6">
              <section className="rounded-2xl border border-gray-800 bg-gray-950 p-6">
                <div className="mb-5 flex items-end justify-between gap-3">
                  <div>
                    <p className="mb-2 text-sm font-bold uppercase tracking-[0.25em] text-red-500">
                      Rankings
                    </p>

                    <h2 className="text-2xl font-black">Top Players</h2>
                  </div>

                  <Link
                    href="/leaderboard"
                    className="text-sm font-bold text-gray-400 hover:text-white"
                  >
                    View →
                  </Link>
                </div>

                {loading ? (
                  <p className="rounded-lg border border-gray-800 bg-black p-4 text-gray-400">
                    Loading rankings...
                  </p>
                ) : topPlayers.length === 0 ? (
                  <p className="rounded-lg border border-gray-800 bg-black p-4 text-gray-400">
                    Rankings will appear after matches are completed.
                  </p>
                ) : (
                  <div className="grid gap-3">
                    {topPlayers.map((player, index) => (
                      <Link
                        key={player.id}
                        href={`/players/${player.id}`}
                        className="rounded-xl border border-gray-800 bg-black p-4 hover:border-red-700 hover:bg-red-950/20"
                      >
                        <div className="flex items-center justify-between gap-3">
                          <div>
                            <p className="font-black">
                              #{player.leaderboard_rank || index + 1}{" "}
                              {playerName(player)}
                            </p>

                            <p className="mt-1 text-xs text-gray-500">
                              {player.platform || "Platform not set"} •{" "}
                              {player.favorite_team || "Team not set"}
                            </p>
                          </div>

                          <div className="text-right">
                            <p className="text-sm font-black">
                              {player.wins}-{player.losses}
                            </p>

                            <p className="text-xs text-gray-500">
                              {formatWinPercentage(player.win_percentage)}
                            </p>
                          </div>
                        </div>
                      </Link>
                    ))}
                  </div>
                )}
              </section>

              <section className="rounded-2xl border border-red-900 bg-red-950/20 p-6">
                <h2 className="mb-3 text-2xl font-black">
                  Ready to compete?
                </h2>

                <p className="mb-5 text-sm leading-6 text-gray-300">
                  Join tournaments, submit your scores, and build your record on
                  BattleGrid.
                </p>

                <div className="grid gap-3">
                  <Link
                    href="/tournaments"
                    className="rounded-lg bg-white px-5 py-3 text-center font-bold text-black hover:bg-gray-200"
                  >
                    Browse Tournaments
                  </Link>

                  <Link
                    href={userEmail ? "/my-tournaments" : "/signup"}
                    className="rounded-lg border border-gray-700 px-5 py-3 text-center font-bold text-white hover:bg-gray-900"
                  >
                    {userEmail ? "My Tournaments" : "Create Account"}
                  </Link>
                </div>
              </section>
            </aside>
          </section>
        </div>
      </section>
    </main>
  );
}