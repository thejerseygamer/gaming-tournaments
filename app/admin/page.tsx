"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "../lib/supabase";

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

type TournamentForm = {
  name: string;
  game: string;
  platform: string;
  prizePool: string;
  entryFee: string;
  maxPlayers: string;
};

type TournamentPlayerRow = {
  tournament_id: string;
};

type MatchRow = {
  tournament_id: string;
};

const defaultForm: TournamentForm = {
  name: "",
  game: "Madden NFL",
  platform: "Xbox Series X|S",
  prizePool: "",
  entryFee: "",
  maxPlayers: "8",
};

const gameOptions = [
  "Madden NFL",
  "NBA 2K",
  "EA Sports College Football",
  "Call of Duty",
  "Fortnite",
  "Rocket League",
  "UFC",
  "Other",
];

const platformOptions = [
  "Xbox Series X|S",
  "PlayStation 5",
  "PC",
  "Xbox One",
  "PlayStation 4",
  "Nintendo Switch",
  "Mobile",
  "Cross Platform",
];

export default function AdminDashboardPage() {
  const [tournaments, setTournaments] = useState<Tournament[]>([]);
  const [playerCounts, setPlayerCounts] = useState<Record<string, number>>({});
  const [matchCounts, setMatchCounts] = useState<Record<string, number>>({});
  const [form, setForm] = useState<TournamentForm>(defaultForm);

  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [message, setMessage] = useState("");

  useEffect(() => {
    let active = true;

    async function loadAdminData() {
      await Promise.resolve();

      const { data: tournamentData, error: tournamentError } = await supabase
        .from("tournaments")
        .select(
          "id, name, game, platform, prize_pool, entry_fee, max_players, created_at"
        )
        .order("created_at", { ascending: false });

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

    loadAdminData();

    return () => {
      active = false;
    };
  }, []);

  const totalPlayers = useMemo(() => {
    return Object.values(playerCounts).reduce((total, count) => total + count, 0);
  }, [playerCounts]);

  const totalMatches = useMemo(() => {
    return Object.values(matchCounts).reduce((total, count) => total + count, 0);
  }, [matchCounts]);

  const activeBrackets = useMemo(() => {
    return Object.values(matchCounts).filter((count) => count > 0).length;
  }, [matchCounts]);

  function updateForm(field: keyof TournamentForm, value: string) {
    setForm((currentForm) => ({
      ...currentForm,
      [field]: value,
    }));
  }

  function parseOptionalNumber(value: string) {
    const trimmedValue = value.trim();

    if (!trimmedValue) {
      return null;
    }

    const numberValue = Number(trimmedValue);

    if (Number.isNaN(numberValue)) {
      return null;
    }

    return numberValue;
  }

  function formatMoney(value: number | null) {
    if (value === null) {
      return "Not set";
    }

    if (value === 0) {
      return "Free";
    }

    return `$${value}`;
  }

  function formatDate(value: string | null) {
    if (!value) {
      return "Date not available";
    }

    return new Date(value).toLocaleDateString();
  }

  async function createTournament() {
    if (!form.name.trim()) {
      setMessage("Tournament name is required.");
      return;
    }

    if (!form.game.trim()) {
      setMessage("Game is required.");
      return;
    }

    if (!form.platform.trim()) {
      setMessage("Platform is required.");
      return;
    }

    setCreating(true);
    setMessage("");

    const prizePool = parseOptionalNumber(form.prizePool);
    const entryFee = parseOptionalNumber(form.entryFee);
    const maxPlayers = parseOptionalNumber(form.maxPlayers);

    const { data, error } = await supabase
      .from("tournaments")
      .insert({
        name: form.name.trim(),
        game: form.game.trim(),
        platform: form.platform.trim(),
        prize_pool: prizePool,
        entry_fee: entryFee,
        max_players: maxPlayers,
      })
      .select(
        "id, name, game, platform, prize_pool, entry_fee, max_players, created_at"
      )
      .single();

    if (error) {
      setMessage(error.message);
      setCreating(false);
      return;
    }

    const newTournament = data as Tournament;

    setTournaments((currentTournaments) => [
      newTournament,
      ...currentTournaments,
    ]);

    setPlayerCounts((currentCounts) => ({
      ...currentCounts,
      [newTournament.id]: 0,
    }));

    setMatchCounts((currentCounts) => ({
      ...currentCounts,
      [newTournament.id]: 0,
    }));

    setForm(defaultForm);
    setMessage("Tournament created successfully.");
    setCreating(false);
  }

  if (loading) {
    return (
      <main className="min-h-screen bg-zinc-950 px-6 py-10 text-white">
        <div className="mx-auto max-w-7xl">
          <h1 className="text-3xl font-bold">Admin Dashboard</h1>
          <p className="mt-4 text-zinc-400">Loading admin dashboard...</p>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-zinc-950 px-6 py-10 text-white">
      <div className="mx-auto max-w-7xl">
        <div className="mb-8 flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <p className="mb-2 text-sm font-black uppercase tracking-widest text-red-400">
              BattleGrid Admin
            </p>

            <h1 className="text-4xl font-black">Admin Dashboard</h1>

            <p className="mt-3 text-zinc-400">
              Create tournaments, review platform stats, and manage brackets.
            </p>
          </div>

          <div className="flex flex-col gap-3 sm:flex-row">
            <Link
              href="/admin/tournaments"
              className="rounded-lg bg-red-600 px-4 py-2 text-center font-semibold text-white hover:bg-red-700"
            >
              Manage Brackets
            </Link>

            <Link
              href="/tournaments"
              className="rounded-lg border border-zinc-700 px-4 py-2 text-center font-semibold text-white hover:bg-zinc-800"
            >
              Public Tournaments
            </Link>
          </div>
        </div>

        {message && (
          <div className="mb-6 rounded-lg border border-red-500/40 bg-red-500/10 p-4 text-red-300">
            {message}
          </div>
        )}

        <section className="mb-8 grid gap-5 md:grid-cols-2 xl:grid-cols-4">
          <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-6">
            <p className="text-sm text-zinc-500">Total Tournaments</p>
            <p className="mt-2 text-4xl font-black">{tournaments.length}</p>
          </div>

          <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-6">
            <p className="text-sm text-zinc-500">Joined Players</p>
            <p className="mt-2 text-4xl font-black">{totalPlayers}</p>
          </div>

          <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-6">
            <p className="text-sm text-zinc-500">Generated Matches</p>
            <p className="mt-2 text-4xl font-black">{totalMatches}</p>
          </div>

          <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-6">
            <p className="text-sm text-zinc-500">Active Brackets</p>
            <p className="mt-2 text-4xl font-black">{activeBrackets}</p>
          </div>
        </section>

        <div className="grid gap-8 xl:grid-cols-[0.9fr_1.1fr]">
          <section className="rounded-xl border border-zinc-800 bg-zinc-900 p-6">
            <h2 className="text-2xl font-bold">Create Tournament</h2>

            <p className="mt-2 text-sm text-zinc-400">
              Add a new event for players to join.
            </p>

            <div className="mt-6 space-y-5">
              <div>
                <label className="mb-2 block text-sm font-semibold text-zinc-300">
                  Tournament Name
                </label>

                <input
                  value={form.name}
                  onChange={(event) => updateForm("name", event.target.value)}
                  placeholder="Example: Friday Night Madden Showdown"
                  className="w-full rounded-lg border border-zinc-700 bg-zinc-950 px-4 py-3 text-white outline-none focus:border-red-500"
                />
              </div>

              <div>
                <label className="mb-2 block text-sm font-semibold text-zinc-300">
                  Game
                </label>

                <select
                  value={form.game}
                  onChange={(event) => updateForm("game", event.target.value)}
                  className="w-full rounded-lg border border-zinc-700 bg-zinc-950 px-4 py-3 text-white outline-none focus:border-red-500"
                >
                  {gameOptions.map((game) => (
                    <option key={game} value={game}>
                      {game}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="mb-2 block text-sm font-semibold text-zinc-300">
                  Platform
                </label>

                <select
                  value={form.platform}
                  onChange={(event) =>
                    updateForm("platform", event.target.value)
                  }
                  className="w-full rounded-lg border border-zinc-700 bg-zinc-950 px-4 py-3 text-white outline-none focus:border-red-500"
                >
                  {platformOptions.map((platform) => (
                    <option key={platform} value={platform}>
                      {platform}
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid gap-5 sm:grid-cols-3">
                <div>
                  <label className="mb-2 block text-sm font-semibold text-zinc-300">
                    Prize Pool
                  </label>

                  <input
                    value={form.prizePool}
                    onChange={(event) =>
                      updateForm("prizePool", event.target.value)
                    }
                    placeholder="100"
                    inputMode="numeric"
                    className="w-full rounded-lg border border-zinc-700 bg-zinc-950 px-4 py-3 text-white outline-none focus:border-red-500"
                  />
                </div>

                <div>
                  <label className="mb-2 block text-sm font-semibold text-zinc-300">
                    Entry Fee
                  </label>

                  <input
                    value={form.entryFee}
                    onChange={(event) =>
                      updateForm("entryFee", event.target.value)
                    }
                    placeholder="0"
                    inputMode="numeric"
                    className="w-full rounded-lg border border-zinc-700 bg-zinc-950 px-4 py-3 text-white outline-none focus:border-red-500"
                  />
                </div>

                <div>
                  <label className="mb-2 block text-sm font-semibold text-zinc-300">
                    Max Players
                  </label>

                  <input
                    value={form.maxPlayers}
                    onChange={(event) =>
                      updateForm("maxPlayers", event.target.value)
                    }
                    placeholder="8"
                    inputMode="numeric"
                    className="w-full rounded-lg border border-zinc-700 bg-zinc-950 px-4 py-3 text-white outline-none focus:border-red-500"
                  />
                </div>
              </div>

              <button
                onClick={createTournament}
                disabled={creating}
                className="w-full rounded-lg bg-red-600 px-5 py-3 font-bold text-white hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {creating ? "Creating..." : "Create Tournament"}
              </button>
            </div>
          </section>

          <section className="rounded-xl border border-zinc-800 bg-zinc-900 p-6">
            <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h2 className="text-2xl font-bold">Latest Tournaments</h2>

                <p className="mt-2 text-sm text-zinc-400">
                  Recently created events and their current status.
                </p>
              </div>

              <Link
                href="/admin/tournaments"
                className="rounded-lg border border-zinc-700 px-4 py-2 text-center text-sm font-semibold text-white hover:bg-zinc-800"
              >
                Manage All
              </Link>
            </div>

            {tournaments.length === 0 && (
              <div className="rounded-lg border border-zinc-800 bg-zinc-950 p-6 text-center text-zinc-400">
                No tournaments created yet.
              </div>
            )}

            {tournaments.length > 0 && (
              <div className="space-y-4">
                {tournaments.slice(0, 6).map((tournament) => {
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
                      className="rounded-xl border border-zinc-800 bg-zinc-950 p-5"
                    >
                      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                        <div>
                          <div className="flex flex-wrap items-center gap-3">
                            <h3 className="text-xl font-bold">
                              {tournament.name}
                            </h3>

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

                          <p className="mt-2 text-sm text-zinc-400">
                            {tournament.game || "Game not set"} •{" "}
                            {tournament.platform || "Platform not set"} • Created{" "}
                            {formatDate(tournament.created_at)}
                          </p>

                          <div className="mt-4 grid gap-3 text-sm sm:grid-cols-4">
                            <div className="rounded-lg bg-zinc-900 p-3">
                              <p className="text-zinc-500">Prize</p>
                              <p className="mt-1 font-semibold">
                                {formatMoney(tournament.prize_pool)}
                              </p>
                            </div>

                            <div className="rounded-lg bg-zinc-900 p-3">
                              <p className="text-zinc-500">Entry</p>
                              <p className="mt-1 font-semibold">
                                {formatMoney(tournament.entry_fee)}
                              </p>
                            </div>

                            <div className="rounded-lg bg-zinc-900 p-3">
                              <p className="text-zinc-500">Players</p>
                              <p className="mt-1 font-semibold">
                                {joinedPlayers}
                                {maxPlayers ? ` / ${maxPlayers}` : ""}
                              </p>
                            </div>

                            <div className="rounded-lg bg-zinc-900 p-3">
                              <p className="text-zinc-500">Matches</p>
                              <p className="mt-1 font-semibold">
                                {totalMatches}
                              </p>
                            </div>
                          </div>
                        </div>

                        <div className="flex flex-col gap-3 lg:min-w-44">
                          <Link
                            href={`/tournaments/${tournament.id}`}
                            className="rounded-lg bg-red-600 px-4 py-2 text-center text-sm font-semibold text-white hover:bg-red-700"
                          >
                            View Details
                          </Link>

                          <Link
                            href="/admin/tournaments"
                            className="rounded-lg border border-zinc-700 px-4 py-2 text-center text-sm font-semibold text-white hover:bg-zinc-800"
                          >
                            Manage Bracket
                          </Link>
                        </div>
                      </div>
                    </article>
                  );
                })}
              </div>
            )}
          </section>
        </div>
      </div>
    </main>
  );
}