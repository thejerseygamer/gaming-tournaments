"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
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
  registration_open: boolean;
  prize_pool: number | null;
  entry_fee: number | null;
  max_players: number | null;
  created_at: string;
};

export default function AdminPage() {
  const router = useRouter();

  const [checkingAdmin, setCheckingAdmin] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);

  const [tournaments, setTournaments] = useState<Tournament[]>([]);
  const [pendingReviews, setPendingReviews] = useState(0);

  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [savingEdit, setSavingEdit] = useState(false);
  const [deletingId, setDeletingId] = useState("");
  const [message, setMessage] = useState("");

  const [name, setName] = useState("");
  const [game, setGame] = useState("");
  const [platform, setPlatform] = useState("");
  const [description, setDescription] = useState("");
  const [rules, setRules] = useState("");
  const [startTime, setStartTime] = useState("");
  const [registrationOpen, setRegistrationOpen] = useState(true);
  const [prizePool, setPrizePool] = useState("");
  const [entryFee, setEntryFee] = useState("");
  const [maxPlayers, setMaxPlayers] = useState("");

  const [editingId, setEditingId] = useState("");
  const [editName, setEditName] = useState("");
  const [editGame, setEditGame] = useState("");
  const [editPlatform, setEditPlatform] = useState("");
  const [editDescription, setEditDescription] = useState("");
  const [editRules, setEditRules] = useState("");
  const [editStartTime, setEditStartTime] = useState("");
  const [editRegistrationOpen, setEditRegistrationOpen] = useState(true);
  const [editPrizePool, setEditPrizePool] = useState("");
  const [editEntryFee, setEditEntryFee] = useState("");
  const [editMaxPlayers, setEditMaxPlayers] = useState("");

  function formatDateTimeForInput(value: string | null) {
    if (!value) return "";

    const date = new Date(value);

    if (Number.isNaN(date.getTime())) return "";

    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");
    const hours = String(date.getHours()).padStart(2, "0");
    const minutes = String(date.getMinutes()).padStart(2, "0");

    return `${year}-${month}-${day}T${hours}:${minutes}`;
  }

  function formatDisplayDate(value: string | null) {
    if (!value) return "Not set";

    const date = new Date(value);

    if (Number.isNaN(date.getTime())) return "Not set";

    return date.toLocaleString();
  }

  function startTimeToDatabase(value: string) {
    if (!value) return null;

    return new Date(value).toISOString();
  }

  useEffect(() => {
    let isMounted = true;

    async function verifyAdminAndLoad() {
      const adminCheck = await checkIsAdmin();

      if (!isMounted) return;

      if (!adminCheck.user) {
        router.push("/login");
        return;
      }

      if (!adminCheck.isAdmin) {
        router.push("/tournaments");
        return;
      }

      setIsAdmin(true);
      setCheckingAdmin(false);

      await loadTournaments();
      await loadPendingReviews();

      if (!isMounted) return;

      setLoading(false);
    }

    verifyAdminAndLoad();

    return () => {
      isMounted = false;
    };
  }, [router]);

  async function loadTournaments() {
    const { data, error } = await supabase
      .from("tournaments")
      .select("*")
      .order("created_at", { ascending: false });

    if (error) {
      setMessage(`Error loading tournaments: ${error.message}`);
      setTournaments([]);
    } else {
      setTournaments((data || []) as Tournament[]);
    }
  }

  async function loadPendingReviews() {
    const { count, error } = await supabase
      .from("matches")
      .select("*", { count: "exact", head: true })
      .not("score_submitted_by", "is", null)
      .neq("status", "completed");

    if (error) {
      setPendingReviews(0);
      return;
    }

    setPendingReviews(count || 0);
  }

  async function verifyAdminAction() {
    const adminCheck = await checkIsAdmin();

    if (!adminCheck.user) {
      setMessage("You must be logged in as an admin.");
      router.push("/login");
      return false;
    }

    if (!adminCheck.isAdmin) {
      setMessage("You are not allowed to manage tournaments.");
      router.push("/tournaments");
      return false;
    }

    return true;
  }

  async function createTournament(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();

    setCreating(true);
    setMessage("");

    const allowed = await verifyAdminAction();

    if (!allowed) {
      setCreating(false);
      return;
    }

    if (!name.trim()) {
      setMessage("Tournament name is required.");
      setCreating(false);
      return;
    }

    const { error } = await supabase.from("tournaments").insert({
      name: name.trim(),
      game: game.trim() || null,
      platform: platform.trim() || null,
      description: description.trim() || null,
      rules: rules.trim() || null,
      start_time: startTimeToDatabase(startTime),
      registration_open: registrationOpen,
      prize_pool: prizePool ? Number(prizePool) : 0,
      entry_fee: entryFee ? Number(entryFee) : 0,
      max_players: maxPlayers ? Number(maxPlayers) : 0,
    });

    if (error) {
      setMessage(`Error creating tournament: ${error.message}`);
      setCreating(false);
      return;
    }

    setMessage("Tournament created successfully.");

    setName("");
    setGame("");
    setPlatform("");
    setDescription("");
    setRules("");
    setStartTime("");
    setRegistrationOpen(true);
    setPrizePool("");
    setEntryFee("");
    setMaxPlayers("");

    await loadTournaments();
    await loadPendingReviews();

    setCreating(false);
  }

  function startEditing(tournament: Tournament) {
    setEditingId(tournament.id);
    setEditName(tournament.name || "");
    setEditGame(tournament.game || "");
    setEditPlatform(tournament.platform || "");
    setEditDescription(tournament.description || "");
    setEditRules(tournament.rules || "");
    setEditStartTime(formatDateTimeForInput(tournament.start_time));
    setEditRegistrationOpen(tournament.registration_open !== false);
    setEditPrizePool(String(tournament.prize_pool || 0));
    setEditEntryFee(String(tournament.entry_fee || 0));
    setEditMaxPlayers(String(tournament.max_players || 0));
    setMessage("");
  }

  function cancelEditing() {
    setEditingId("");
    setEditName("");
    setEditGame("");
    setEditPlatform("");
    setEditDescription("");
    setEditRules("");
    setEditStartTime("");
    setEditRegistrationOpen(true);
    setEditPrizePool("");
    setEditEntryFee("");
    setEditMaxPlayers("");
  }

  async function updateTournament(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();

    if (!editingId) return;

    setSavingEdit(true);
    setMessage("");

    const allowed = await verifyAdminAction();

    if (!allowed) {
      setSavingEdit(false);
      return;
    }

    if (!editName.trim()) {
      setMessage("Tournament name is required.");
      setSavingEdit(false);
      return;
    }

    const { error } = await supabase
      .from("tournaments")
      .update({
        name: editName.trim(),
        game: editGame.trim() || null,
        platform: editPlatform.trim() || null,
        description: editDescription.trim() || null,
        rules: editRules.trim() || null,
        start_time: startTimeToDatabase(editStartTime),
        registration_open: editRegistrationOpen,
        prize_pool: editPrizePool ? Number(editPrizePool) : 0,
        entry_fee: editEntryFee ? Number(editEntryFee) : 0,
        max_players: editMaxPlayers ? Number(editMaxPlayers) : 0,
      })
      .eq("id", editingId);

    if (error) {
      setMessage(`Error updating tournament: ${error.message}`);
      setSavingEdit(false);
      return;
    }

    setMessage("Tournament updated successfully.");
    cancelEditing();

    await loadTournaments();
    await loadPendingReviews();

    setSavingEdit(false);
  }

  async function deleteTournament(tournament: Tournament) {
    const confirmed = window.confirm(
      `Delete "${tournament.name}"? This will remove the tournament, players, bracket, and scores.`
    );

    if (!confirmed) return;

    setDeletingId(tournament.id);
    setMessage("");

    const allowed = await verifyAdminAction();

    if (!allowed) {
      setDeletingId("");
      return;
    }

    await supabase.from("matches").delete().eq("tournament_id", tournament.id);

    await supabase
      .from("tournament_players")
      .delete()
      .eq("tournament_id", tournament.id);

    const { error } = await supabase
      .from("tournaments")
      .delete()
      .eq("id", tournament.id);

    if (error) {
      setMessage(`Error deleting tournament: ${error.message}`);
      setDeletingId("");
      return;
    }

    setMessage("Tournament deleted successfully.");

    await loadTournaments();
    await loadPendingReviews();

    setDeletingId("");
  }

  if (checkingAdmin) {
    return (
      <main className="min-h-screen bg-black p-6 text-white">
        <div className="mx-auto max-w-5xl">
          <p className="rounded-xl border border-gray-800 bg-gray-950 p-6 text-gray-400">
            Checking admin access...
          </p>
        </div>
      </main>
    );
  }

  if (!isAdmin) {
    return (
      <main className="min-h-screen bg-black p-6 text-white">
        <div className="mx-auto max-w-5xl">
          <p className="rounded-xl border border-red-900 bg-red-950/40 p-6 text-red-200">
            You do not have admin access.
          </p>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-black p-6 text-white">
      <div className="mx-auto max-w-6xl">
        <div className="mb-8 flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
          <div>
            <h1 className="mb-2 text-4xl font-bold">BattleGrid Admin</h1>
            <p className="text-gray-400">
              Create tournaments, manage brackets, review scores, and control
              registration.
            </p>
          </div>

          <div className="flex flex-col gap-3 sm:flex-row">
            <Link
              href="/admin/reviews"
              className="rounded-lg bg-yellow-500 px-5 py-3 text-center font-bold text-black hover:bg-yellow-400"
            >
              Score Reviews ({pendingReviews})
            </Link>

            <Link
              href="/admin/players"
              className="rounded-lg border border-gray-700 px-5 py-3 text-center font-bold text-white hover:bg-gray-900"
            >
              Manage Players
            </Link>

            <Link
              href="/admin/tournaments"
              className="rounded-lg border border-gray-700 px-5 py-3 text-center font-bold text-white hover:bg-gray-900"
            >
              Manage Brackets
            </Link>
          </div>
        </div>

        <section className="mb-8 grid gap-4 md:grid-cols-3">
          <div className="rounded-xl border border-gray-800 bg-gray-950 p-5">
            <p className="text-sm text-gray-500">Total Tournaments</p>
            <p className="mt-2 text-4xl font-black">{tournaments.length}</p>
          </div>

          <div className="rounded-xl border border-gray-800 bg-gray-950 p-5">
            <p className="text-sm text-gray-500">Pending Score Reviews</p>
            <p className="mt-2 text-4xl font-black">{pendingReviews}</p>
          </div>

          <div className="rounded-xl border border-gray-800 bg-gray-950 p-5">
            <p className="text-sm text-gray-500">Registration Controls</p>
            <p className="mt-2 text-lg font-bold">Open / Closed / Locked</p>
          </div>
        </section>

        <section className="mb-8 rounded-xl border border-gray-800 bg-gray-950 p-6">
          <h2 className="mb-4 text-2xl font-bold">Create Tournament</h2>

          <form onSubmit={createTournament} className="grid gap-4">
            <div>
              <label className="mb-1 block text-sm text-gray-400">
                Tournament Name
              </label>
              <input
                className="w-full rounded-lg border border-gray-700 bg-black px-4 py-3 text-white"
                placeholder="BattleGrid Madden Open"
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <div>
                <label className="mb-1 block text-sm text-gray-400">
                  Game
                </label>
                <input
                  className="w-full rounded-lg border border-gray-700 bg-black px-4 py-3 text-white"
                  placeholder="Madden 25"
                  value={game}
                  onChange={(e) => setGame(e.target.value)}
                />
              </div>

              <div>
                <label className="mb-1 block text-sm text-gray-400">
                  Platform
                </label>
                <input
                  className="w-full rounded-lg border border-gray-700 bg-black px-4 py-3 text-white"
                  placeholder="PS5 / Xbox"
                  value={platform}
                  onChange={(e) => setPlatform(e.target.value)}
                />
              </div>
            </div>

            <div className="rounded-xl border border-gray-800 bg-black p-4">
              <div className="mb-3 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <p className="font-bold">Registration</p>
                  <p className="text-sm text-gray-400">
                    Turn this off to close signups before generating a bracket.
                  </p>
                </div>

                <button
                  type="button"
                  onClick={() => setRegistrationOpen((current) => !current)}
                  className={`rounded-lg px-5 py-3 font-bold ${
                    registrationOpen
                      ? "bg-green-600 text-white hover:bg-green-500"
                      : "bg-red-700 text-white hover:bg-red-600"
                  }`}
                >
                  {registrationOpen
                    ? "Registration Open"
                    : "Registration Closed"}
                </button>
              </div>
            </div>

            <div>
              <label className="mb-1 block text-sm text-gray-400">
                Description
              </label>
              <textarea
                className="min-h-24 w-full rounded-lg border border-gray-700 bg-black px-4 py-3 text-white"
                placeholder="Describe the tournament, prize details, format, or requirements..."
                value={description}
                onChange={(e) => setDescription(e.target.value)}
              />
            </div>

            <div>
              <label className="mb-1 block text-sm text-gray-400">Rules</label>
              <textarea
                className="min-h-24 w-full rounded-lg border border-gray-700 bg-black px-4 py-3 text-white"
                placeholder="Example: No quitting, proof required, winner reports score..."
                value={rules}
                onChange={(e) => setRules(e.target.value)}
              />
            </div>

            <div className="grid gap-4 md:grid-cols-4">
              <div>
                <label className="mb-1 block text-sm text-gray-400">
                  Start Time
                </label>
                <input
                  type="datetime-local"
                  className="w-full rounded-lg border border-gray-700 bg-black px-4 py-3 text-white"
                  value={startTime}
                  onChange={(e) => setStartTime(e.target.value)}
                />
              </div>

              <div>
                <label className="mb-1 block text-sm text-gray-400">
                  Prize Pool
                </label>
                <input
                  type="number"
                  className="w-full rounded-lg border border-gray-700 bg-black px-4 py-3 text-white"
                  placeholder="100"
                  value={prizePool}
                  onChange={(e) => setPrizePool(e.target.value)}
                />
              </div>

              <div>
                <label className="mb-1 block text-sm text-gray-400">
                  Entry Fee
                </label>
                <input
                  type="number"
                  className="w-full rounded-lg border border-gray-700 bg-black px-4 py-3 text-white"
                  placeholder="10"
                  value={entryFee}
                  onChange={(e) => setEntryFee(e.target.value)}
                />
              </div>

              <div>
                <label className="mb-1 block text-sm text-gray-400">
                  Max Players
                </label>
                <input
                  type="number"
                  className="w-full rounded-lg border border-gray-700 bg-black px-4 py-3 text-white"
                  placeholder="16"
                  value={maxPlayers}
                  onChange={(e) => setMaxPlayers(e.target.value)}
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={creating}
              className="rounded-lg bg-white px-5 py-3 font-bold text-black hover:bg-gray-200 disabled:opacity-50"
            >
              {creating ? "Creating..." : "Create Tournament"}
            </button>
          </form>

          {message && (
            <p className="mt-4 rounded-lg border border-gray-800 bg-black p-3 text-sm text-gray-300">
              {message}
            </p>
          )}
        </section>

        <section className="rounded-xl border border-gray-800 bg-gray-950 p-6">
          <h2 className="mb-4 text-2xl font-bold">Existing Tournaments</h2>

          {loading ? (
            <p className="text-gray-400">Loading tournaments...</p>
          ) : tournaments.length === 0 ? (
            <p className="text-gray-400">No tournaments yet.</p>
          ) : (
            <div className="grid gap-4">
              {tournaments.map((tournament) => (
                <div
                  key={tournament.id}
                  className="rounded-lg border border-gray-800 bg-black p-4"
                >
                  {editingId === tournament.id ? (
                    <form onSubmit={updateTournament} className="grid gap-4">
                      <h3 className="text-xl font-bold">Edit Tournament</h3>

                      <div>
                        <label className="mb-1 block text-sm text-gray-400">
                          Tournament Name
                        </label>
                        <input
                          className="w-full rounded-lg border border-gray-700 bg-black px-4 py-3 text-white"
                          value={editName}
                          onChange={(e) => setEditName(e.target.value)}
                        />
                      </div>

                      <div className="grid gap-4 md:grid-cols-2">
                        <div>
                          <label className="mb-1 block text-sm text-gray-400">
                            Game
                          </label>
                          <input
                            className="w-full rounded-lg border border-gray-700 bg-black px-4 py-3 text-white"
                            value={editGame}
                            onChange={(e) => setEditGame(e.target.value)}
                          />
                        </div>

                        <div>
                          <label className="mb-1 block text-sm text-gray-400">
                            Platform
                          </label>
                          <input
                            className="w-full rounded-lg border border-gray-700 bg-black px-4 py-3 text-white"
                            value={editPlatform}
                            onChange={(e) => setEditPlatform(e.target.value)}
                          />
                        </div>
                      </div>

                      <div className="rounded-xl border border-gray-800 bg-gray-950 p-4">
                        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                          <div>
                            <p className="font-bold">Registration</p>
                            <p className="text-sm text-gray-400">
                              Close or reopen signups for this tournament.
                            </p>
                          </div>

                          <button
                            type="button"
                            onClick={() =>
                              setEditRegistrationOpen((current) => !current)
                            }
                            className={`rounded-lg px-5 py-3 font-bold ${
                              editRegistrationOpen
                                ? "bg-green-600 text-white hover:bg-green-500"
                                : "bg-red-700 text-white hover:bg-red-600"
                            }`}
                          >
                            {editRegistrationOpen
                              ? "Registration Open"
                              : "Registration Closed"}
                          </button>
                        </div>
                      </div>

                      <div>
                        <label className="mb-1 block text-sm text-gray-400">
                          Description
                        </label>
                        <textarea
                          className="min-h-24 w-full rounded-lg border border-gray-700 bg-black px-4 py-3 text-white"
                          value={editDescription}
                          onChange={(e) => setEditDescription(e.target.value)}
                        />
                      </div>

                      <div>
                        <label className="mb-1 block text-sm text-gray-400">
                          Rules
                        </label>
                        <textarea
                          className="min-h-24 w-full rounded-lg border border-gray-700 bg-black px-4 py-3 text-white"
                          value={editRules}
                          onChange={(e) => setEditRules(e.target.value)}
                        />
                      </div>

                      <div className="grid gap-4 md:grid-cols-4">
                        <div>
                          <label className="mb-1 block text-sm text-gray-400">
                            Start Time
                          </label>
                          <input
                            type="datetime-local"
                            className="w-full rounded-lg border border-gray-700 bg-black px-4 py-3 text-white"
                            value={editStartTime}
                            onChange={(e) => setEditStartTime(e.target.value)}
                          />
                        </div>

                        <div>
                          <label className="mb-1 block text-sm text-gray-400">
                            Prize Pool
                          </label>
                          <input
                            type="number"
                            className="w-full rounded-lg border border-gray-700 bg-black px-4 py-3 text-white"
                            value={editPrizePool}
                            onChange={(e) => setEditPrizePool(e.target.value)}
                          />
                        </div>

                        <div>
                          <label className="mb-1 block text-sm text-gray-400">
                            Entry Fee
                          </label>
                          <input
                            type="number"
                            className="w-full rounded-lg border border-gray-700 bg-black px-4 py-3 text-white"
                            value={editEntryFee}
                            onChange={(e) => setEditEntryFee(e.target.value)}
                          />
                        </div>

                        <div>
                          <label className="mb-1 block text-sm text-gray-400">
                            Max Players
                          </label>
                          <input
                            type="number"
                            className="w-full rounded-lg border border-gray-700 bg-black px-4 py-3 text-white"
                            value={editMaxPlayers}
                            onChange={(e) => setEditMaxPlayers(e.target.value)}
                          />
                        </div>
                      </div>

                      <div className="flex flex-col gap-3 md:flex-row">
                        <button
                          type="submit"
                          disabled={savingEdit}
                          className="rounded-lg bg-white px-5 py-3 font-bold text-black hover:bg-gray-200 disabled:opacity-50"
                        >
                          {savingEdit ? "Saving..." : "Save Changes"}
                        </button>

                        <button
                          type="button"
                          onClick={cancelEditing}
                          className="rounded-lg border border-gray-700 px-5 py-3 font-bold text-white hover:bg-gray-900"
                        >
                          Cancel
                        </button>
                      </div>
                    </form>
                  ) : (
                    <>
                      <div className="mb-3 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                        <div>
                          <h3 className="text-xl font-bold">
                            {tournament.name}
                          </h3>

                          <p className="mt-1 text-sm text-gray-500">
                            {tournament.game || "Game not set"} •{" "}
                            {tournament.platform || "Platform not set"}
                          </p>
                        </div>

                        <span
                          className={`w-fit rounded-full border px-3 py-1 text-xs font-bold ${
                            tournament.registration_open
                              ? "border-green-700 bg-green-950/40 text-green-300"
                              : "border-red-700 bg-red-950/40 text-red-300"
                          }`}
                        >
                          {tournament.registration_open
                            ? "Registration Open"
                            : "Registration Closed"}
                        </span>
                      </div>

                      <div className="mt-2 grid gap-1 text-sm text-gray-400">
                        <p>
                          Start Time:{" "}
                          {formatDisplayDate(tournament.start_time)}
                        </p>
                        <p>Prize Pool: ${tournament.prize_pool || 0}</p>
                        <p>Entry Fee: ${tournament.entry_fee || 0}</p>
                        <p>Max Players: {tournament.max_players || 0}</p>
                        <p>
                          Description:{" "}
                          {tournament.description
                            ? tournament.description.slice(0, 120)
                            : "Not set"}
                        </p>
                      </div>

                      <div className="mt-4 flex flex-col gap-3 md:flex-row">
                        <button
                          type="button"
                          onClick={() => startEditing(tournament)}
                          className="rounded-lg bg-white px-5 py-3 font-bold text-black hover:bg-gray-200"
                        >
                          Edit
                        </button>

                        <Link
                          href={`/tournaments/${tournament.id}`}
                          className="rounded-lg border border-gray-700 px-5 py-3 text-center font-bold text-white hover:bg-gray-900"
                        >
                          View
                        </Link>

                        <Link
                          href={`/brackets?tournament=${tournament.id}`}
                          className="rounded-lg border border-gray-700 px-5 py-3 text-center font-bold text-white hover:bg-gray-900"
                        >
                          Bracket
                        </Link>

                        <button
                          type="button"
                          onClick={() => deleteTournament(tournament)}
                          disabled={deletingId === tournament.id}
                          className="rounded-lg border border-red-800 px-5 py-3 font-bold text-red-300 hover:bg-red-950/40 disabled:opacity-50"
                        >
                          {deletingId === tournament.id
                            ? "Deleting..."
                            : "Delete"}
                        </button>
                      </div>
                    </>
                  )}
                </div>
              ))}
            </div>
          )}
        </section>
      </div>
    </main>
  );
}