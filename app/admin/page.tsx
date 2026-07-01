"use client";

import Link from "next/link";
import type { FormEvent } from "react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "../lib/supabase";
import { checkIsAdmin } from "../lib/admin";

type Tournament = {
  id: string;
  name: string;
  game: string | null;
  platform: string | null;
  description: string | null;
  rules: string | null;
  start_time: string | null;
  prize_pool: number | null;
  entry_fee: number | null;
  max_players: number | null;
  registration_open: boolean;
  created_at: string;
};

type Profile = {
  id: string;
  is_admin: boolean | null;
};

type MatchRow = {
  id: string;
  status: string | null;
  score_submitted_by: string | null;
};

type SupportRequest = {
  id: string;
  status: string;
};

function formatMoney(value: number | null) {
  if (value === null || value === undefined) return "Free";

  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
  }).format(value);
}

function formatDateTime(value: string | null) {
  if (!value) return "Not set";

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) return "Not set";

  return date.toLocaleString();
}

export default function AdminDashboardPage() {
  const router = useRouter();

  const [isAdmin, setIsAdmin] = useState(false);

  const [tournaments, setTournaments] = useState<Tournament[]>([]);
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [matches, setMatches] = useState<MatchRow[]>([]);
  const [supportRequests, setSupportRequests] = useState<SupportRequest[]>([]);

  const [name, setName] = useState("");
  const [game, setGame] = useState("");
  const [platform, setPlatform] = useState("");
  const [description, setDescription] = useState("");
  const [rules, setRules] = useState("");
  const [startTime, setStartTime] = useState("");
  const [prizePool, setPrizePool] = useState("");
  const [entryFee, setEntryFee] = useState("");
  const [maxPlayers, setMaxPlayers] = useState("");

  const [checkingAdmin, setCheckingAdmin] = useState(true);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [savingId, setSavingId] = useState("");
  const [deletingId, setDeletingId] = useState("");
  const [message, setMessage] = useState("");

  const loadAdminDashboard = useCallback(async () => {
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

    setIsAdmin(true);
    setCheckingAdmin(false);

    const { data: tournamentData, error: tournamentError } = await supabase
      .from("tournaments")
      .select(
        "id, name, game, platform, description, rules, start_time, prize_pool, entry_fee, max_players, registration_open, created_at"
      )
      .order("created_at", { ascending: false });

    if (tournamentError) {
      setMessage(`Error loading tournaments: ${tournamentError.message}`);
      setTournaments([]);
    } else {
      setTournaments((tournamentData || []) as Tournament[]);
    }

    const { data: profileData } = await supabase
      .from("profiles")
      .select("id, is_admin");

    setProfiles((profileData || []) as Profile[]);

    const { data: matchData } = await supabase
      .from("matches")
      .select("id, status, score_submitted_by");

    setMatches((matchData || []) as MatchRow[]);

    const { data: supportData } = await supabase
      .from("support_requests")
      .select("id, status");

    setSupportRequests((supportData || []) as SupportRequest[]);

    setLoading(false);
  }, [router]);

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      void loadAdminDashboard();
    }, 0);

    return () => {
      window.clearTimeout(timeoutId);
    };
  }, [loadAdminDashboard]);

  const openTournaments = useMemo(() => {
    return tournaments.filter((tournament) => tournament.registration_open);
  }, [tournaments]);

  const closedTournaments = useMemo(() => {
    return tournaments.filter((tournament) => !tournament.registration_open);
  }, [tournaments]);

  const adminCount = useMemo(() => {
    return profiles.filter((profile) => profile.is_admin).length;
  }, [profiles]);

  const playerCount = useMemo(() => {
    return profiles.filter((profile) => !profile.is_admin).length;
  }, [profiles]);

  const pendingScoreReviews = useMemo(() => {
    return matches.filter(
      (match) => match.score_submitted_by && match.status !== "completed"
    );
  }, [matches]);

  const completedMatches = useMemo(() => {
    return matches.filter((match) => match.status === "completed");
  }, [matches]);

  const openSupportRequests = useMemo(() => {
    return supportRequests.filter((request) => request.status === "open");
  }, [supportRequests]);

  const inProgressSupportRequests = useMemo(() => {
    return supportRequests.filter((request) => request.status === "in_progress");
  }, [supportRequests]);

  function clearForm() {
    setName("");
    setGame("");
    setPlatform("");
    setDescription("");
    setRules("");
    setStartTime("");
    setPrizePool("");
    setEntryFee("");
    setMaxPlayers("");
  }

  function parseOptionalNumber(value: string) {
    if (!value.trim()) return null;

    const numberValue = Number(value);

    if (Number.isNaN(numberValue)) return null;

    return numberValue;
  }

  async function createTournament(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!name.trim()) {
      setMessage("Tournament name is required.");
      return;
    }

    if (!game.trim()) {
      setMessage("Game is required.");
      return;
    }

    if (!platform.trim()) {
      setMessage("Platform is required.");
      return;
    }

    setCreating(true);
    setMessage("");

    const { error } = await supabase.from("tournaments").insert({
      name: name.trim(),
      game: game.trim(),
      platform: platform.trim(),
      description: description.trim() || null,
      rules: rules.trim() || null,
      start_time: startTime ? new Date(startTime).toISOString() : null,
      prize_pool: parseOptionalNumber(prizePool),
      entry_fee: parseOptionalNumber(entryFee),
      max_players: parseOptionalNumber(maxPlayers),
      registration_open: true,
    });

    if (error) {
      setMessage(`Error creating tournament: ${error.message}`);
      setCreating(false);
      return;
    }

    setMessage("Tournament created successfully.");
    clearForm();
    await loadAdminDashboard();
    setCreating(false);
  }

  async function toggleRegistration(tournament: Tournament) {
    setSavingId(tournament.id);
    setMessage("");

    const { error } = await supabase
      .from("tournaments")
      .update({
        registration_open: !tournament.registration_open,
      })
      .eq("id", tournament.id);

    if (error) {
      setMessage(`Error updating tournament: ${error.message}`);
      setSavingId("");
      return;
    }

    await loadAdminDashboard();
    setSavingId("");
  }

  async function deleteTournament(tournament: Tournament) {
    const confirmed = window.confirm(
      `Delete "${tournament.name}"? This can remove the tournament from your admin list.`
    );

    if (!confirmed) return;

    setDeletingId(tournament.id);
    setMessage("");

    const { error } = await supabase
      .from("tournaments")
      .delete()
      .eq("id", tournament.id);

    if (error) {
      setMessage(`Error deleting tournament: ${error.message}`);
      setDeletingId("");
      return;
    }

    setMessage("Tournament deleted.");
    await loadAdminDashboard();
    setDeletingId("");
  }

  if (checkingAdmin || loading) {
    return (
      <main className="min-h-screen bg-black p-6 text-white">
        <div className="mx-auto max-w-6xl">
          <p className="rounded-xl border border-gray-800 bg-gray-950 p-6 text-gray-400">
            {checkingAdmin
              ? "Checking admin access..."
              : "Loading admin dashboard..."}
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
        <section className="mb-8 rounded-2xl border border-gray-800 bg-gray-950 p-6">
          <div className="flex flex-col gap-5 md:flex-row md:items-end md:justify-between">
            <div>
              <p className="mb-3 text-sm font-bold uppercase tracking-[0.25em] text-red-500">
                BattleGrid Admin
              </p>

              <h1 className="mb-3 text-4xl font-black">Admin Dashboard</h1>

              <p className="max-w-2xl text-gray-400">
                Create tournaments, manage brackets, review scores, handle
                support, send announcements, and monitor platform reports.
              </p>
            </div>

            <button
              type="button"
              onClick={loadAdminDashboard}
              disabled={loading}
              className="rounded-lg bg-white px-5 py-3 font-bold text-black hover:bg-gray-200 disabled:opacity-50"
            >
              {loading ? "Refreshing..." : "Refresh Dashboard"}
            </button>
          </div>
        </section>

        {message && (
          <p className="mb-6 rounded-lg border border-yellow-800 bg-yellow-950/30 p-4 text-sm text-yellow-200">
            {message}
          </p>
        )}

        <section className="mb-8 grid gap-4 md:grid-cols-4">
          <Link
            href="/admin/reports"
            className="rounded-xl border border-red-800 bg-red-950/20 p-5 hover:bg-red-950/30"
          >
            <p className="text-sm text-red-300">Reports</p>
            <p className="mt-2 text-4xl font-black">View</p>
            <p className="mt-2 text-xs text-red-200">
              Platform stats and activity
            </p>
          </Link>

          <Link
            href="/admin/support"
            className="rounded-xl border border-yellow-800 bg-yellow-950/20 p-5 hover:bg-yellow-950/30"
          >
            <p className="text-sm text-yellow-300">Open Support</p>
            <p className="mt-2 text-4xl font-black">
              {openSupportRequests.length}
            </p>
            <p className="mt-2 text-xs text-yellow-200">
              {inProgressSupportRequests.length} in progress
            </p>
          </Link>

          <Link
            href="/admin/reviews"
            className="rounded-xl border border-yellow-800 bg-yellow-950/20 p-5 hover:bg-yellow-950/30"
          >
            <p className="text-sm text-yellow-300">Score Reviews</p>
            <p className="mt-2 text-4xl font-black">
              {pendingScoreReviews.length}
            </p>
            <p className="mt-2 text-xs text-yellow-200">
              Scores waiting for admin
            </p>
          </Link>

          <Link
            href="/admin/players"
            className="rounded-xl border border-gray-800 bg-gray-950 p-5 hover:border-red-700 hover:bg-red-950/20"
          >
            <p className="text-sm text-gray-500">Accounts</p>
            <p className="mt-2 text-4xl font-black">{profiles.length}</p>
            <p className="mt-2 text-xs text-gray-500">
              {playerCount} players / {adminCount} admins
            </p>
          </Link>
        </section>

        <section className="mb-8 grid gap-4 md:grid-cols-4">
          <div className="rounded-xl border border-gray-800 bg-gray-950 p-5">
            <p className="text-sm text-gray-500">Tournaments</p>
            <p className="mt-2 text-4xl font-black">{tournaments.length}</p>
            <p className="mt-2 text-xs text-gray-500">
              {openTournaments.length} open / {closedTournaments.length} closed
            </p>
          </div>

          <div className="rounded-xl border border-gray-800 bg-gray-950 p-5">
            <p className="text-sm text-gray-500">Matches</p>
            <p className="mt-2 text-4xl font-black">{matches.length}</p>
            <p className="mt-2 text-xs text-gray-500">
              {completedMatches.length} completed
            </p>
          </div>

          <div className="rounded-xl border border-gray-800 bg-gray-950 p-5">
            <p className="text-sm text-gray-500">Support Requests</p>
            <p className="mt-2 text-4xl font-black">
              {supportRequests.length}
            </p>
            <p className="mt-2 text-xs text-gray-500">All-time total</p>
          </div>

          <Link
            href="/admin/announcements"
            className="rounded-xl border border-gray-800 bg-gray-950 p-5 hover:border-red-700 hover:bg-red-950/20"
          >
            <p className="text-sm text-gray-500">Announcements</p>
            <p className="mt-2 text-4xl font-black">Send</p>
            <p className="mt-2 text-xs text-gray-500">Notify users</p>
          </Link>
        </section>

        <section className="grid gap-6 lg:grid-cols-[420px_1fr]">
          <section className="rounded-xl border border-gray-800 bg-gray-950 p-6">
            <h2 className="mb-5 text-2xl font-bold">Create Tournament</h2>

            <form onSubmit={createTournament} className="grid gap-4">
              <div>
                <label className="mb-2 block text-sm text-gray-400">
                  Tournament Name
                </label>

                <input
                  className="w-full rounded-lg border border-gray-700 bg-black px-4 py-3 text-white"
                  placeholder="Friday Night Madden"
                  value={name}
                  onChange={(event) => setName(event.target.value)}
                />
              </div>

              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-1">
                <div>
                  <label className="mb-2 block text-sm text-gray-400">
                    Game
                  </label>

                  <input
                    className="w-full rounded-lg border border-gray-700 bg-black px-4 py-3 text-white"
                    placeholder="Madden"
                    value={game}
                    onChange={(event) => setGame(event.target.value)}
                  />
                </div>

                <div>
                  <label className="mb-2 block text-sm text-gray-400">
                    Platform
                  </label>

                  <input
                    className="w-full rounded-lg border border-gray-700 bg-black px-4 py-3 text-white"
                    placeholder="PS5 / Xbox / PC"
                    value={platform}
                    onChange={(event) => setPlatform(event.target.value)}
                  />
                </div>
              </div>

              <div>
                <label className="mb-2 block text-sm text-gray-400">
                  Description
                </label>

                <textarea
                  className="min-h-24 w-full rounded-lg border border-gray-700 bg-black px-4 py-3 text-white"
                  placeholder="Describe the tournament..."
                  value={description}
                  onChange={(event) => setDescription(event.target.value)}
                />
              </div>

              <div>
                <label className="mb-2 block text-sm text-gray-400">
                  Rules
                </label>

                <textarea
                  className="min-h-24 w-full rounded-lg border border-gray-700 bg-black px-4 py-3 text-white"
                  placeholder="List match rules, settings, deadlines..."
                  value={rules}
                  onChange={(event) => setRules(event.target.value)}
                />
              </div>

              <div>
                <label className="mb-2 block text-sm text-gray-400">
                  Start Time
                </label>

                <input
                  type="datetime-local"
                  className="w-full rounded-lg border border-gray-700 bg-black px-4 py-3 text-white"
                  value={startTime}
                  onChange={(event) => setStartTime(event.target.value)}
                />
              </div>

              <div className="grid gap-4 md:grid-cols-3 lg:grid-cols-1">
                <div>
                  <label className="mb-2 block text-sm text-gray-400">
                    Prize Pool
                  </label>

                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    className="w-full rounded-lg border border-gray-700 bg-black px-4 py-3 text-white"
                    placeholder="100"
                    value={prizePool}
                    onChange={(event) => setPrizePool(event.target.value)}
                  />
                </div>

                <div>
                  <label className="mb-2 block text-sm text-gray-400">
                    Entry Fee
                  </label>

                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    className="w-full rounded-lg border border-gray-700 bg-black px-4 py-3 text-white"
                    placeholder="10"
                    value={entryFee}
                    onChange={(event) => setEntryFee(event.target.value)}
                  />
                </div>

                <div>
                  <label className="mb-2 block text-sm text-gray-400">
                    Max Players
                  </label>

                  <input
                    type="number"
                    min="2"
                    step="1"
                    className="w-full rounded-lg border border-gray-700 bg-black px-4 py-3 text-white"
                    placeholder="8"
                    value={maxPlayers}
                    onChange={(event) => setMaxPlayers(event.target.value)}
                  />
                </div>
              </div>

              <div className="flex flex-col gap-3 sm:flex-row">
                <button
                  type="submit"
                  disabled={creating}
                  className="rounded-lg bg-white px-5 py-3 font-bold text-black hover:bg-gray-200 disabled:opacity-50"
                >
                  {creating ? "Creating..." : "Create Tournament"}
                </button>

                <button
                  type="button"
                  onClick={clearForm}
                  className="rounded-lg border border-gray-700 px-5 py-3 font-bold text-white hover:bg-gray-900"
                >
                  Clear
                </button>
              </div>
            </form>
          </section>

          <section className="rounded-xl border border-gray-800 bg-gray-950 p-6">
            <div className="mb-5 flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
              <div>
                <h2 className="text-2xl font-bold">Recent Tournaments</h2>

                <p className="mt-1 text-sm text-gray-400">
                  Create, edit, open, close, and manage tournament brackets.
                </p>
              </div>

              <Link
                href="/admin/tournaments"
                className="rounded-lg bg-white px-5 py-3 text-center text-sm font-bold text-black hover:bg-gray-200"
              >
                Manage All
              </Link>
            </div>

            {tournaments.length === 0 ? (
              <p className="rounded-lg border border-gray-800 bg-black p-4 text-gray-400">
                No tournaments created yet.
              </p>
            ) : (
              <div className="grid gap-4">
                {tournaments.slice(0, 8).map((tournament) => (
                  <article
                    key={tournament.id}
                    className="rounded-xl border border-gray-800 bg-black p-5"
                  >
                    <div className="mb-4 flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                      <div>
                        <div className="mb-2 flex flex-wrap gap-2">
                          <span
                            className={`rounded-full border px-3 py-1 text-xs font-bold ${
                              tournament.registration_open
                                ? "border-green-700 bg-green-950/30 text-green-300"
                                : "border-red-700 bg-red-950/30 text-red-300"
                            }`}
                          >
                            {tournament.registration_open
                              ? "Registration Open"
                              : "Registration Closed"}
                          </span>

                          <span className="rounded-full border border-gray-700 bg-gray-950 px-3 py-1 text-xs font-bold text-gray-300">
                            {tournament.game || "Game not set"}
                          </span>
                        </div>

                        <h3 className="text-2xl font-black">
                          {tournament.name}
                        </h3>

                        <p className="mt-1 text-sm text-gray-500">
                          {tournament.platform || "Platform not set"} • Starts:{" "}
                          {formatDateTime(tournament.start_time)}
                        </p>
                      </div>

                      <p className="text-sm text-gray-500">
                        Created: {formatDateTime(tournament.created_at)}
                      </p>
                    </div>

                    <div className="mb-4 grid gap-3 md:grid-cols-3">
                      <div className="rounded-lg border border-gray-800 bg-gray-950 p-3">
                        <p className="text-xs text-gray-500">Prize Pool</p>
                        <p className="mt-1 font-black">
                          {formatMoney(tournament.prize_pool)}
                        </p>
                      </div>

                      <div className="rounded-lg border border-gray-800 bg-gray-950 p-3">
                        <p className="text-xs text-gray-500">Entry Fee</p>
                        <p className="mt-1 font-black">
                          {formatMoney(tournament.entry_fee)}
                        </p>
                      </div>

                      <div className="rounded-lg border border-gray-800 bg-gray-950 p-3">
                        <p className="text-xs text-gray-500">Max Players</p>
                        <p className="mt-1 font-black">
                          {tournament.max_players || "Unlimited"}
                        </p>
                      </div>
                    </div>

                    <div className="flex flex-col gap-3 sm:flex-row">
                      <Link
                        href={`/admin/tournaments/${tournament.id}`}
                        className="rounded-lg bg-white px-4 py-3 text-center text-sm font-bold text-black hover:bg-gray-200"
                      >
                        Edit
                      </Link>

                      <Link
                        href={`/tournaments/${tournament.id}`}
                        className="rounded-lg border border-gray-700 px-4 py-3 text-center text-sm font-bold text-white hover:bg-gray-900"
                      >
                        Public Page
                      </Link>

                      <Link
                        href={`/brackets?tournament=${tournament.id}`}
                        className="rounded-lg border border-gray-700 px-4 py-3 text-center text-sm font-bold text-white hover:bg-gray-900"
                      >
                        Bracket
                      </Link>

                      <button
                        type="button"
                        onClick={() => toggleRegistration(tournament)}
                        disabled={savingId === tournament.id}
                        className="rounded-lg border border-yellow-700 px-4 py-3 text-sm font-bold text-yellow-300 hover:bg-yellow-950/40 disabled:opacity-50"
                      >
                        {savingId === tournament.id
                          ? "Saving..."
                          : tournament.registration_open
                            ? "Close"
                            : "Open"}
                      </button>

                      <button
                        type="button"
                        onClick={() => deleteTournament(tournament)}
                        disabled={deletingId === tournament.id}
                        className="rounded-lg border border-red-700 px-4 py-3 text-sm font-bold text-red-300 hover:bg-red-950/40 disabled:opacity-50"
                      >
                        {deletingId === tournament.id ? "Deleting..." : "Delete"}
                      </button>
                    </div>
                  </article>
                ))}
              </div>
            )}
          </section>
        </section>
      </div>
    </main>
  );
}