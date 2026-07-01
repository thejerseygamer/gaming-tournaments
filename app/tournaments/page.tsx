"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { supabase } from "../lib/supabase";

type TournamentRow = {
  id: string;
  name: string;
  game: string | null;
  platform: string | null;
  prize_pool: number | string | null;
  entry_fee: number | string | null;
  max_players: number | string | null;
  created_at: string | null;
};

type TournamentCard = TournamentRow & {
  player_count: number;
  match_count: number;
};

function toNumber(value: number | string | null | undefined): number {
  if (typeof value === "number") return value;

  if (typeof value === "string") {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : 0;
  }

  return 0;
}

function formatDate(value: string | null): string {
  if (!value) return "Recently";

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "Recently";
  }

  return date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function formatPrize(value: number | string | null): string {
  const amount = toNumber(value);

  if (amount <= 0) return "No prize listed";

  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(amount);
}

function formatEntryFee(value: number | string | null): string {
  const amount = toNumber(value);

  if (amount <= 0) return "Free";

  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(amount);
}

function isFull(tournament: TournamentCard): boolean {
  const maxPlayers = toNumber(tournament.max_players);

  if (maxPlayers <= 0) return false;

  return tournament.player_count >= maxPlayers;
}

function hasBracket(tournament: TournamentCard): boolean {
  return tournament.match_count > 0;
}

function getTournamentStatus(tournament: TournamentCard): string {
  if (hasBracket(tournament)) return "Bracket live";
  if (isFull(tournament)) return "Full";
  return "Open";
}

async function fetchTournaments(): Promise<{
  tournaments: TournamentCard[];
  errorMessage: string | null;
}> {
  const { data, error } = await supabase
    .from("tournaments")
    .select(
      "id, name, game, platform, prize_pool, entry_fee, max_players, created_at"
    )
    .order("created_at", { ascending: false });

  if (error) {
    return {
      tournaments: [],
      errorMessage: error.message,
    };
  }

  const tournamentRows = (data ?? []) as TournamentRow[];

  const tournamentsWithCounts = await Promise.all(
    tournamentRows.map(async (tournament) => {
      const [playersResult, matchesResult] = await Promise.all([
        supabase
          .from("tournament_players")
          .select("id", { count: "exact", head: true })
          .eq("tournament_id", tournament.id),
        supabase
          .from("matches")
          .select("id", { count: "exact", head: true })
          .eq("tournament_id", tournament.id),
      ]);

      return {
        ...tournament,
        player_count: playersResult.count ?? 0,
        match_count: matchesResult.count ?? 0,
      };
    })
  );

  return {
    tournaments: tournamentsWithCounts,
    errorMessage: null,
  };
}

export default function TournamentsPage() {
  const [tournaments, setTournaments] = useState<TournamentCard[]>([]);
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    let isMounted = true;

    async function loadTournaments() {
      const result = await fetchTournaments();

      if (!isMounted) return;

      setTournaments(result.tournaments);
      setErrorMessage(result.errorMessage);
      setLoading(false);
    }

    void loadTournaments();

    return () => {
      isMounted = false;
    };
  }, []);

  async function refreshTournaments() {
    setLoading(true);

    const result = await fetchTournaments();

    setTournaments(result.tournaments);
    setErrorMessage(result.errorMessage);
    setLoading(false);
  }

  const openTournamentCount = tournaments.filter(
    (tournament) => !isFull(tournament) && !hasBracket(tournament)
  ).length;

  const activeBracketCount = tournaments.filter((tournament) =>
    hasBracket(tournament)
  ).length;

  return (
    <main className="min-h-screen bg-slate-950 px-6 py-10 text-white">
      <section className="mx-auto max-w-6xl">
        <div className="mb-8 flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
          <div>
            <p className="mb-2 text-sm font-bold uppercase tracking-[0.35em] text-red-400">
              BattleGrid
            </p>

            <h1 className="text-4xl font-black tracking-tight md:text-5xl">
              Tournaments
            </h1>

            <p className="mt-3 max-w-2xl text-slate-300">
              Join open tournaments, track player counts, and view live brackets
              once a tournament starts.
            </p>
          </div>

          <button
            type="button"
            onClick={refreshTournaments}
            className="rounded-xl border border-red-500/50 bg-red-500/10 px-5 py-3 text-sm font-bold text-red-200 transition hover:bg-red-500/20"
          >
            Refresh
          </button>
        </div>

        <div className="mb-8 grid gap-4 md:grid-cols-3">
          <div className="rounded-2xl border border-white/10 bg-white/5 p-5">
            <p className="text-sm text-slate-400">Total tournaments</p>
            <p className="mt-2 text-3xl font-black">{tournaments.length}</p>
          </div>

          <div className="rounded-2xl border border-white/10 bg-white/5 p-5">
            <p className="text-sm text-slate-400">Open tournaments</p>
            <p className="mt-2 text-3xl font-black text-green-400">
              {openTournamentCount}
            </p>
          </div>

          <div className="rounded-2xl border border-white/10 bg-white/5 p-5">
            <p className="text-sm text-slate-400">Live brackets</p>
            <p className="mt-2 text-3xl font-black text-yellow-400">
              {activeBracketCount}
            </p>
          </div>
        </div>

        {loading ? (
          <div className="rounded-2xl border border-white/10 bg-white/5 p-8 text-center text-slate-300">
            Loading tournaments...
          </div>
        ) : errorMessage ? (
          <div className="rounded-2xl border border-red-500/30 bg-red-500/10 p-8 text-center text-red-200">
            {errorMessage}
          </div>
        ) : tournaments.length === 0 ? (
          <div className="rounded-2xl border border-white/10 bg-white/5 p-8 text-center">
            <h2 className="text-2xl font-black">No tournaments yet</h2>
            <p className="mt-2 text-slate-300">
              Create your first tournament from the admin dashboard.
            </p>

            <Link
              href="/admin"
              className="mt-5 inline-flex rounded-xl bg-red-600 px-5 py-3 text-sm font-bold text-white transition hover:bg-red-500"
            >
              Go to Admin
            </Link>
          </div>
        ) : (
          <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
            {tournaments.map((tournament) => {
              const maxPlayers = toNumber(tournament.max_players);
              const tournamentFull = isFull(tournament);
              const bracketReady = hasBracket(tournament);
              const status = getTournamentStatus(tournament);

              return (
                <article
                  key={tournament.id}
                  className="rounded-3xl border border-white/10 bg-white/5 p-6 shadow-2xl shadow-black/20"
                >
                  <div className="mb-4 flex items-center justify-between gap-3">
                    <span
                      className={[
                        "rounded-full px-3 py-1 text-xs font-black uppercase tracking-wide",
                        bracketReady
                          ? "bg-yellow-500/15 text-yellow-300"
                          : tournamentFull
                            ? "bg-red-500/15 text-red-300"
                            : "bg-green-500/15 text-green-300",
                      ].join(" ")}
                    >
                      {status}
                    </span>

                    <span className="text-xs text-slate-400">
                      {formatDate(tournament.created_at)}
                    </span>
                  </div>

                  <h2 className="text-2xl font-black">{tournament.name}</h2>

                  <div className="mt-3 space-y-2 text-sm text-slate-300">
                    <p>
                      <span className="font-bold text-white">Game:</span>{" "}
                      {tournament.game || "Not listed"}
                    </p>

                    <p>
                      <span className="font-bold text-white">Platform:</span>{" "}
                      {tournament.platform || "Not listed"}
                    </p>

                    <p>
                      <span className="font-bold text-white">Prize Pool:</span>{" "}
                      {formatPrize(tournament.prize_pool)}
                    </p>

                    <p>
                      <span className="font-bold text-white">Entry Fee:</span>{" "}
                      {formatEntryFee(tournament.entry_fee)}
                    </p>

                    <p>
                      <span className="font-bold text-white">Players:</span>{" "}
                      {tournament.player_count}
                      {maxPlayers > 0 ? ` / ${maxPlayers}` : ""}
                    </p>
                  </div>

                  <div className="mt-6 flex flex-wrap gap-3">
                    <Link
                      href={`/tournaments/${tournament.id}`}
                      className="rounded-xl bg-red-600 px-4 py-2 text-sm font-bold text-white transition hover:bg-red-500"
                    >
                      View Tournament
                    </Link>

                    {bracketReady ? (
                      <Link
                        href="/brackets"
                        className="rounded-xl border border-yellow-500/40 bg-yellow-500/10 px-4 py-2 text-sm font-bold text-yellow-200 transition hover:bg-yellow-500/20"
                      >
                        View Bracket
                      </Link>
                    ) : null}
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </section>
    </main>
  );
}