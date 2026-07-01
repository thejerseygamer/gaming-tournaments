"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { supabase } from "../../lib/supabase";

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

type AdminTournament = TournamentRow & {
  player_count: number;
  match_count: number;
};

type TournamentPlayer = {
  player_id: string;
};

type MatchInsert = {
  tournament_id: string;
  round: number;
  match_number: number;
  player1_id: string;
  player2_id: string | null;
  winner_id: string | null;
  player1_score: number;
  player2_score: number;
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

  if (Number.isNaN(date.getTime())) return "Recently";

  return date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function formatMoney(value: number | string | null): string {
  const amount = toNumber(value);

  if (amount <= 0) return "Free";

  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(amount);
}

async function fetchAdminTournaments(): Promise<{
  tournaments: AdminTournament[];
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
          .select("*", { count: "exact", head: true })
          .eq("tournament_id", tournament.id),
        supabase
          .from("matches")
          .select("*", { count: "exact", head: true })
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

function buildFirstRoundMatches(
  tournamentId: string,
  players: TournamentPlayer[]
): MatchInsert[] {
  const matches: MatchInsert[] = [];

  for (let index = 0; index < players.length; index += 2) {
    const playerOne = players[index];
    const playerTwo = players[index + 1];

    matches.push({
      tournament_id: tournamentId,
      round: 1,
      match_number: matches.length + 1,
      player1_id: playerOne.player_id,
      player2_id: playerTwo?.player_id ?? null,
      winner_id: playerTwo ? null : playerOne.player_id,
      player1_score: 0,
      player2_score: 0,
    });
  }

  return matches;
}

export default function AdminTournamentsPage() {
  const [isAdmin, setIsAdmin] = useState(false);
  const [checkingAdmin, setCheckingAdmin] = useState(true);

  const [tournaments, setTournaments] = useState<AdminTournament[]>([]);
  const [loading, setLoading] = useState(false);
  const [generatingId, setGeneratingId] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    let isMounted = true;

    async function checkAdminAndLoadTournaments() {
      const { data: userData } = await supabase.auth.getUser();
      const userId = userData.user?.id ?? null;

      if (!userId) {
        if (!isMounted) return;

        setIsAdmin(false);
        setCheckingAdmin(false);
        setMessage("Please log in with an admin account.");
        return;
      }

      const { data: profileData, error: profileError } = await supabase
        .from("profiles")
        .select("role")
        .eq("id", userId)
        .maybeSingle();

      if (!isMounted) return;

      if (profileError) {
        setIsAdmin(false);
        setCheckingAdmin(false);
        setMessage(profileError.message);
        return;
      }

      const userIsAdmin = profileData?.role === "admin";

      setIsAdmin(userIsAdmin);
      setCheckingAdmin(false);

      if (!userIsAdmin) {
        setMessage("You do not have admin access.");
        return;
      }

      setLoading(true);

      const result = await fetchAdminTournaments();

      if (!isMounted) return;

      setTournaments(result.tournaments);
      setMessage(result.errorMessage);
      setLoading(false);
    }

    void checkAdminAndLoadTournaments();

    return () => {
      isMounted = false;
    };
  }, []);

  async function refreshTournaments() {
    if (!isAdmin) {
      setMessage("You do not have admin access.");
      return;
    }

    setLoading(true);
    setMessage(null);

    const result = await fetchAdminTournaments();

    setTournaments(result.tournaments);
    setMessage(result.errorMessage);
    setLoading(false);
  }

  async function generateBracket(tournament: AdminTournament) {
    setMessage(null);

    if (!isAdmin) {
      setMessage("You do not have admin access.");
      return;
    }

    if (tournament.match_count > 0) {
      setMessage("This tournament already has a bracket.");
      return;
    }

    if (tournament.player_count < 2) {
      setMessage("You need at least 2 players before generating a bracket.");
      return;
    }

    setGeneratingId(tournament.id);

    const { data: playersData, error: playersError } = await supabase
      .from("tournament_players")
      .select("player_id")
      .eq("tournament_id", tournament.id);

    if (playersError) {
      setMessage(playersError.message);
      setGeneratingId(null);
      return;
    }

    const players = (playersData ?? []) as TournamentPlayer[];

    if (players.length < 2) {
      setMessage("You need at least 2 players before generating a bracket.");
      setGeneratingId(null);
      return;
    }

    const matches = buildFirstRoundMatches(tournament.id, players);

    const { error: insertError } = await supabase
      .from("matches")
      .insert(matches);

    if (insertError) {
      setMessage(insertError.message);
      setGeneratingId(null);
      return;
    }

    const result = await fetchAdminTournaments();

    setTournaments(result.tournaments);
    setMessage(`Bracket generated for ${tournament.name}.`);
    setGeneratingId(null);
  }

  if (checkingAdmin) {
    return (
      <main className="min-h-screen bg-slate-950 px-6 py-10 text-white">
        <section className="mx-auto max-w-4xl rounded-3xl border border-white/10 bg-white/5 p-8 text-center">
          <p className="text-slate-300">Checking admin access...</p>
        </section>
      </main>
    );
  }

  if (!isAdmin) {
    return (
      <main className="min-h-screen bg-slate-950 px-6 py-10 text-white">
        <section className="mx-auto max-w-4xl rounded-3xl border border-red-500/30 bg-red-500/10 p-8 text-center">
          <h1 className="text-3xl font-black">Admin Access Required</h1>

          <p className="mt-3 text-red-200">
            {message || "You do not have permission to view this page."}
          </p>

          <div className="mt-6 flex flex-wrap justify-center gap-3">
            <Link
              href="/login"
              className="rounded-xl bg-red-600 px-5 py-3 text-sm font-bold text-white transition hover:bg-red-500"
            >
              Log In
            </Link>

            <Link
              href="/tournaments"
              className="rounded-xl border border-white/10 bg-white/5 px-5 py-3 text-sm font-bold text-white transition hover:bg-white/10"
            >
              Back to Tournaments
            </Link>
          </div>
        </section>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-slate-950 px-6 py-10 text-white">
      <section className="mx-auto max-w-6xl">
        <div className="mb-8 flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
          <div>
            <p className="mb-2 text-sm font-bold uppercase tracking-[0.35em] text-red-400">
              Admin
            </p>

            <h1 className="text-4xl font-black tracking-tight md:text-5xl">
              Manage Tournaments
            </h1>

            <p className="mt-3 max-w-2xl text-slate-300">
              View player counts and generate first-round brackets once enough
              players have joined.
            </p>
          </div>

          <div className="flex flex-wrap gap-3">
            <Link
              href="/admin"
              className="rounded-xl border border-white/10 bg-white/5 px-5 py-3 text-sm font-bold text-white transition hover:bg-white/10"
            >
              Create Tournament
            </Link>

            <button
              type="button"
              onClick={refreshTournaments}
              className="rounded-xl border border-red-500/50 bg-red-500/10 px-5 py-3 text-sm font-bold text-red-200 transition hover:bg-red-500/20"
            >
              Refresh
            </button>
          </div>
        </div>

        {message ? (
          <div className="mb-6 rounded-2xl border border-red-500/30 bg-red-500/10 p-4 text-sm font-bold text-red-200">
            {message}
          </div>
        ) : null}

        {loading ? (
          <div className="rounded-2xl border border-white/10 bg-white/5 p-8 text-center text-slate-300">
            Loading tournaments...
          </div>
        ) : tournaments.length === 0 ? (
          <div className="rounded-2xl border border-white/10 bg-white/5 p-8 text-center">
            <h2 className="text-2xl font-black">No tournaments found</h2>

            <p className="mt-2 text-slate-300">
              Create a tournament first, then come back here to generate a
              bracket.
            </p>

            <Link
              href="/admin"
              className="mt-5 inline-flex rounded-xl bg-red-600 px-5 py-3 text-sm font-bold text-white transition hover:bg-red-500"
            >
              Create Tournament
            </Link>
          </div>
        ) : (
          <div className="grid gap-5">
            {tournaments.map((tournament) => {
              const maxPlayers = toNumber(tournament.max_players);
              const hasBracket = tournament.match_count > 0;
              const canGenerate =
                tournament.player_count >= 2 &&
                !hasBracket &&
                generatingId !== tournament.id;

              return (
                <article
                  key={tournament.id}
                  className="rounded-3xl border border-white/10 bg-white/5 p-6 shadow-2xl shadow-black/20"
                >
                  <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
                    <div>
                      <div className="mb-3 flex flex-wrap items-center gap-3">
                        <span
                          className={[
                            "rounded-full px-3 py-1 text-xs font-black uppercase tracking-wide",
                            hasBracket
                              ? "bg-yellow-500/15 text-yellow-300"
                              : "bg-green-500/15 text-green-300",
                          ].join(" ")}
                        >
                          {hasBracket ? "Bracket Generated" : "Ready"}
                        </span>

                        <span className="text-xs text-slate-400">
                          {formatDate(tournament.created_at)}
                        </span>
                      </div>

                      <h2 className="text-2xl font-black">
                        {tournament.name}
                      </h2>

                      <div className="mt-3 grid gap-2 text-sm text-slate-300 md:grid-cols-2 lg:grid-cols-4">
                        <p>
                          <span className="font-bold text-white">Game:</span>{" "}
                          {tournament.game || "Not listed"}
                        </p>

                        <p>
                          <span className="font-bold text-white">
                            Platform:
                          </span>{" "}
                          {tournament.platform || "Not listed"}
                        </p>

                        <p>
                          <span className="font-bold text-white">Prize:</span>{" "}
                          {formatMoney(tournament.prize_pool)}
                        </p>

                        <p>
                          <span className="font-bold text-white">Entry:</span>{" "}
                          {formatMoney(tournament.entry_fee)}
                        </p>
                      </div>

                      <div className="mt-4 flex flex-wrap gap-3 text-sm">
                        <span className="rounded-xl border border-white/10 bg-slate-950/60 px-3 py-2 font-bold text-slate-200">
                          Players: {tournament.player_count}
                          {maxPlayers > 0 ? ` / ${maxPlayers}` : ""}
                        </span>

                        <span className="rounded-xl border border-white/10 bg-slate-950/60 px-3 py-2 font-bold text-slate-200">
                          Matches: {tournament.match_count}
                        </span>
                      </div>
                    </div>

                    <div className="flex flex-wrap gap-3 lg:justify-end">
                      <Link
                        href={`/tournaments/${tournament.id}`}
                        className="rounded-xl border border-white/10 bg-white/5 px-5 py-3 text-sm font-black text-white transition hover:bg-white/10"
                      >
                        View
                      </Link>

                      {hasBracket ? (
                        <Link
                          href="/brackets"
                          className="rounded-xl border border-yellow-500/40 bg-yellow-500/10 px-5 py-3 text-sm font-black text-yellow-200 transition hover:bg-yellow-500/20"
                        >
                          View Bracket
                        </Link>
                      ) : (
                        <button
                          type="button"
                          onClick={() => generateBracket(tournament)}
                          disabled={!canGenerate}
                          className="rounded-xl bg-red-600 px-5 py-3 text-sm font-black text-white transition hover:bg-red-500 disabled:cursor-not-allowed disabled:bg-slate-700 disabled:text-slate-400"
                        >
                          {generatingId === tournament.id
                            ? "Generating..."
                            : tournament.player_count < 2
                              ? "Need 2 Players"
                              : "Generate Bracket"}
                        </button>
                      )}
                    </div>
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