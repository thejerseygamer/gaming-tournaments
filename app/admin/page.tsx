"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { supabase } from "../lib/supabase";

type Tournament = {
  id: string;
  name: string;
  game: string | null;
  platform: string | null;
  prize_pool: number | string | null;
  entry_fee: number | string | null;
  max_players: number | string | null;
  created_at: string | null;
};

function toNumber(value: string): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
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
  const amount = Number(value ?? 0);

  if (!Number.isFinite(amount) || amount <= 0) return "Free";

  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(amount);
}

export default function AdminPage() {
  const [isAdmin, setIsAdmin] = useState(false);
  const [checkingAdmin, setCheckingAdmin] = useState(true);

  const [tournaments, setTournaments] = useState<Tournament[]>([]);
  const [loadingTournaments, setLoadingTournaments] = useState(false);
  const [creating, setCreating] = useState(false);

  const [name, setName] = useState("");
  const [game, setGame] = useState("");
  const [platform, setPlatform] = useState("");
  const [prizePool, setPrizePool] = useState("");
  const [entryFee, setEntryFee] = useState("");
  const [maxPlayers, setMaxPlayers] = useState("");

  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    let isMounted = true;

    async function checkAdminAndLoad() {
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

      setLoadingTournaments(true);

      const { data: tournamentData, error: tournamentError } = await supabase
        .from("tournaments")
        .select(
          "id, name, game, platform, prize_pool, entry_fee, max_players, created_at"
        )
        .order("created_at", { ascending: false });

      if (!isMounted) return;

      if (tournamentError) {
        setMessage(tournamentError.message);
        setTournaments([]);
      } else {
        setMessage(null);
        setTournaments((tournamentData ?? []) as Tournament[]);
      }

      setLoadingTournaments(false);
    }

    void checkAdminAndLoad();

    return () => {
      isMounted = false;
    };
  }, []);

  async function refreshTournaments() {
    setLoadingTournaments(true);
    setMessage(null);

    const { data, error } = await supabase
      .from("tournaments")
      .select(
        "id, name, game, platform, prize_pool, entry_fee, max_players, created_at"
      )
      .order("created_at", { ascending: false });

    if (error) {
      setMessage(error.message);
      setTournaments([]);
    } else {
      setTournaments((data ?? []) as Tournament[]);
    }

    setLoadingTournaments(false);
  }

  async function createTournament(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!isAdmin) {
      setMessage("You do not have admin access.");
      return;
    }

    if (!name.trim()) {
      setMessage("Tournament name is required.");
      return;
    }

    setCreating(true);
    setMessage(null);

    const { error } = await supabase.from("tournaments").insert({
      name: name.trim(),
      game: game.trim() || null,
      platform: platform.trim() || null,
      prize_pool: toNumber(prizePool),
      entry_fee: toNumber(entryFee),
      max_players: toNumber(maxPlayers),
    });

    if (error) {
      setMessage(error.message);
      setCreating(false);
      return;
    }

    setName("");
    setGame("");
    setPlatform("");
    setPrizePool("");
    setEntryFee("");
    setMaxPlayers("");

    await refreshTournaments();

    setMessage("Tournament created.");
    setCreating(false);
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
              Create Tournament
            </h1>

            <p className="mt-3 max-w-2xl text-slate-300">
              Create tournaments, manage event details, and send them to the
              public tournament list.
            </p>
          </div>

          <div className="flex flex-wrap gap-3">
            <Link
              href="/admin/tournaments"
              className="rounded-xl bg-red-600 px-5 py-3 text-sm font-bold text-white transition hover:bg-red-500"
            >
              Manage Brackets
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

        <form
          onSubmit={createTournament}
          className="mb-8 rounded-3xl border border-white/10 bg-white/5 p-6 shadow-2xl shadow-black/20"
        >
          <div className="grid gap-4 md:grid-cols-2">
            <label className="block">
              <span className="text-sm font-bold text-slate-300">
                Tournament Name
              </span>

              <input
                value={name}
                onChange={(event) => setName(event.target.value)}
                placeholder="Friday Night Madden Showdown"
                className="mt-2 w-full rounded-xl border border-white/10 bg-slate-950 px-4 py-3 text-white outline-none transition focus:border-red-500"
              />
            </label>

            <label className="block">
              <span className="text-sm font-bold text-slate-300">Game</span>

              <input
                value={game}
                onChange={(event) => setGame(event.target.value)}
                placeholder="Madden 26"
                className="mt-2 w-full rounded-xl border border-white/10 bg-slate-950 px-4 py-3 text-white outline-none transition focus:border-red-500"
              />
            </label>

            <label className="block">
              <span className="text-sm font-bold text-slate-300">
                Platform
              </span>

              <input
                value={platform}
                onChange={(event) => setPlatform(event.target.value)}
                placeholder="PS5 / Xbox / Both"
                className="mt-2 w-full rounded-xl border border-white/10 bg-slate-950 px-4 py-3 text-white outline-none transition focus:border-red-500"
              />
            </label>

            <label className="block">
              <span className="text-sm font-bold text-slate-300">
                Prize Pool
              </span>

              <input
                type="number"
                min="0"
                value={prizePool}
                onChange={(event) => setPrizePool(event.target.value)}
                placeholder="100"
                className="mt-2 w-full rounded-xl border border-white/10 bg-slate-950 px-4 py-3 text-white outline-none transition focus:border-red-500"
              />
            </label>

            <label className="block">
              <span className="text-sm font-bold text-slate-300">
                Entry Fee
              </span>

              <input
                type="number"
                min="0"
                value={entryFee}
                onChange={(event) => setEntryFee(event.target.value)}
                placeholder="10"
                className="mt-2 w-full rounded-xl border border-white/10 bg-slate-950 px-4 py-3 text-white outline-none transition focus:border-red-500"
              />
            </label>

            <label className="block">
              <span className="text-sm font-bold text-slate-300">
                Max Players
              </span>

              <input
                type="number"
                min="2"
                value={maxPlayers}
                onChange={(event) => setMaxPlayers(event.target.value)}
                placeholder="8"
                className="mt-2 w-full rounded-xl border border-white/10 bg-slate-950 px-4 py-3 text-white outline-none transition focus:border-red-500"
              />
            </label>
          </div>

          <button
            type="submit"
            disabled={creating}
            className="mt-6 rounded-xl bg-red-600 px-6 py-3 text-sm font-black text-white transition hover:bg-red-500 disabled:cursor-not-allowed disabled:bg-slate-700 disabled:text-slate-400"
          >
            {creating ? "Creating..." : "Create Tournament"}
          </button>
        </form>

        <div className="rounded-3xl border border-white/10 bg-white/5 p-6">
          <h2 className="text-2xl font-black">Latest Tournaments</h2>

          {loadingTournaments ? (
            <p className="mt-4 text-slate-300">Loading tournaments...</p>
          ) : tournaments.length === 0 ? (
            <p className="mt-4 text-slate-300">No tournaments created yet.</p>
          ) : (
            <div className="mt-5 grid gap-4">
              {tournaments.map((tournament) => (
                <article
                  key={tournament.id}
                  className="rounded-2xl border border-white/10 bg-slate-950/60 p-5"
                >
                  <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                    <div>
                      <h3 className="text-xl font-black">{tournament.name}</h3>

                      <div className="mt-2 flex flex-wrap gap-3 text-sm text-slate-300">
                        <span>{tournament.game || "Game not listed"}</span>
                        <span>{tournament.platform || "Platform not listed"}</span>
                        <span>Prize: {formatMoney(tournament.prize_pool)}</span>
                        <span>Entry: {formatMoney(tournament.entry_fee)}</span>
                        <span>
                          Max Players: {tournament.max_players || "No limit"}
                        </span>
                        <span>{formatDate(tournament.created_at)}</span>
                      </div>
                    </div>

                    <Link
                      href={`/tournaments/${tournament.id}`}
                      className="w-fit rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-sm font-black text-white transition hover:bg-white/10"
                    >
                      View
                    </Link>
                  </div>
                </article>
              ))}
            </div>
          )}
        </div>
      </section>
    </main>
  );
}